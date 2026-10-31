/* =========================================================
   MintOS 4 · 手机桌面与内置应用
   ---------------------------------------------------------
   场景里的那台学习终端（薄荷 680 / Mint OS 4）不是一个空壳子：
   校园通、便笺、相册、计算器、薄聊、家长群接龙，都是剧情里出现过的，
   这里按《重写3》里的设定把它们做成能点、能看、能填的东西。

   所有图标都取自 assets/icons/hyperos/（同一套图标来源，
   不再出现手绘 SVG 和图标包混在一起的情况）。

   数据尽量从当前存档状态派生（材料、聊天、进度），
   这样"手机里看到的东西"和"剧情里拿到的东西"是同一份，
   不会各说各话。
   ========================================================= */

import { assetUrl } from '../config/assets.js';
import { MATERIALS, MATERIAL_STATUS } from '../data/materials.js';

const ICONS = 'assets/icons/hyperos';

export const MINT_APPS = [
  { id: 'chat',    name: '薄聊',   icon: 'phone' },
  { id: 'campus',  name: '校园通', icon: 'campus', badge: 3 },
  { id: 'note',    name: '便笺',   icon: 'mats' },
  { id: 'gallery', name: '相册',   icon: 'gallery' },
  { id: 'chain',   name: '接龙',   icon: 'chain' },
  { id: 'calc',    name: '计算器', icon: 'calc' },
  { id: 'gov',     name: '政务',   icon: 'govhub' },
  { id: 'people',  name: '通讯录', icon: 'people' },
  { id: 'timeline',name: '进度',   icon: 'timeline' },
  { id: 'save',    name: '存档',   icon: 'save' },
  { id: 'settings',name: '设置',   icon: 'settings' },
  { id: 'changelog',name:'更新',   icon: 'changelog' },
  { id: 'about',   name: '关于',   icon: 'about' }
];

export function mintIcon(name) { return `${ICONS}/${name}.png`; }

/* =========================================================
   便笺：玩家自己写的东西，存在本机
   ---------------------------------------------------------
   三栏（亲历 / 他人说法 / 待核实）是《重写3》里的原设定。
   默认内容从当前存档派生——材料进"亲历"，
   材料里"还不能证明"的部分进"待核实"——
   玩家也可以自己加行，加的存 localStorage。
   ========================================================= */
const NOTE_KEY = 'zb_mint_note_v1';

function loadNoteExtra() {
  try {
    const raw = localStorage.getItem(NOTE_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return o && typeof o === 'object' ? o : {};
  } catch (e) { return {}; }
}
function saveNoteExtra(obj) {
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(obj)); } catch (e) { /* 存不了就算了 */ }
}

function noteSeed(state) {
  const seen = [];
  const todo = [];
  (state.materials || []).forEach(id => {
    const m = MATERIALS[id];
    if (!m) return;
    seen.push({ text: `${m.time} · ${m.title}`, sub: m.source });
    (m.questions || []).slice(0, 2).forEach(q => todo.push({ text: q, sub: '' }));
  });
  return { seen, others: [], todo };
}

/** 便笺三栏 */
export function noteHTML(state) {
  const seed = noteSeed(state);
  const extra = loadNoteExtra();
  const cols = [
    { key: 'seen',   label: '亲历',     hint: '我亲眼看见、亲耳听见的' },
    { key: 'others', label: '他人说法', hint: '别人告诉我的，不等于事实' },
    { key: 'todo',   label: '待核实',   hint: '我还不知道的' }
  ];
  const body = cols.map(c => {
    const items = (seed[c.key] || []).concat(Array.isArray(extra[c.key]) ? extra[c.key] : []);
    const rows = items.length
      ? items.map(it => `<li class="mn-item">
            <span class="mn-text">${escape(it.text)}</span>
            ${it.sub ? `<span class="mn-sub">${escape(it.sub)}</span>` : ''}
          </li>`).join('')
      : `<li class="mn-empty">${c.hint}</li>`;
    return `<section class="mn-col" data-col="${c.key}">
      <h4 class="mn-h">${c.label}<em>${items.length}</em></h4>
      <ul class="mn-list">${rows}</ul>
      <form class="mn-add" data-add="${c.key}">
        <input class="mn-input" type="text" placeholder="在「${c.label}」里加一行…" maxlength="120" />
        <button class="mn-btn" type="submit">记下</button>
      </form>
    </section>`;
  }).join('');
  return `<div class="mn">${body}</div>`;
}

export function bindNote(root, state, onChange) {
  root.querySelectorAll('.mn-add').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const key = form.dataset.add;
      const input = form.querySelector('.mn-input');
      const text = (input.value || '').trim();
      if (!text) return;
      const extra = loadNoteExtra();
      if (!Array.isArray(extra[key])) extra[key] = [];
      extra[key].push({ text, sub: '' });
      saveNoteExtra(extra);
      input.value = '';
      if (onChange) onChange();
    });
  });
}

/* =========================================================
   校园通
   ---------------------------------------------------------
   首页四个入口：通知公告 / 服务大厅 / 成绩查询 / 请假。
   底下是「我的」：我的课表、我的成绩、我的考勤、我的课后服务。
   ========================================================= */
export function campusHTML(state) {
  const unread = 3;
  const entries = [
    { id: 'notice',   name: '通知公告' },
    { id: 'service',  name: '服务大厅' },
    { id: 'score',    name: '成绩查询' },
    { id: 'leave',    name: '请假' }
  ];
  const mine = [
    { id: 'timetable', name: '我的课表' },
    { id: 'score',     name: '我的成绩' },
    { id: 'attend',    name: '我的考勤', badge: 1 },
    { id: 'afterschool', name: '我的课后服务' }
  ];
  const ent = (x) => `<button class="cp-entry" type="button" data-cp="${x.id}">
      <span class="cp-entry-n">${x.name}</span>
      ${x.badge ? `<span class="cp-dot">${x.badge}</span>` : ''}
    </button>`;
  return `<div class="cp">
    <div class="cp-brand">
      <span class="cp-logo">校园通</span>
      <span class="cp-crumb">薄荷中学 · 高一（2）班</span>
    </div>
    <div class="cp-grid">${entries.map(ent).join('')}</div>
    <div class="cp-sec">
      <h4 class="cp-sec-h">我的</h4>
      <div class="cp-grid cp-grid-4">${mine.map(ent).join('')}</div>
    </div>
    <p class="cp-note">本通知已推送至 <b>48</b> 个学生账号，已读 <b>12</b> 人。</p>
  </div>`;
}

const CAMPUS_NOTICES = [
  {
    id: 'n1', important: true, unread: true,
    title: '【重要】关于周六课后服务安排的通知',
    time: '9 月 1 日 08:42',
    body: '本次活动严格遵循学生与家长自愿参加的原则。\n\n服务时间：周六上午 8:00—11:30，下午 14:00—16:30，共四节。\n\n参加原则那一行是加粗的：遵循自愿。',
    attach: '《周六课后服务自愿申请表（高一）.pdf）',
    stat: '已推送至 48 个学生账号，已读 12 人'
  },
  {
    id: 'n2', important: false, unread: true,
    title: '关于规范课后服务报名材料的提醒',
    time: '9 月 5 日',
    body: '各班报名材料请于本周五前交至班主任处，由班主任统一年级组备案。\n\n逾期未交视为放弃本次报名资格。',
    attach: '',
    stat: ''
  },
  {
    id: 'n3', important: false, unread: false,
    title: '开学典礼时间调整通知',
    time: '8 月 30 日',
    body: '开学典礼改在 9 月 1 日上午 8:00 举行，请各班提前十分钟到操场集合。',
    attach: '',
    stat: ''
  }
];

export function campusNoticeHTML() {
  return `<div class="cpn">
    ${CAMPUS_NOTICES.map(n => `
      <button class="cpn-item${n.unread ? ' is-unread' : ''}" type="button" data-notice="${n.id}">
        <span class="cpn-title">${n.title}</span>
        <span class="cpn-time">${n.time}</span>
        ${n.unread ? '<span class="cpn-badge">未读</span>' : ''}
      </button>`).join('')}
  </div>`;
}

export function campusNoticeDetail(id) {
  const n = CAMPUS_NOTICES.find(x => x.id === id) || CAMPUS_NOTICES[0];
  return `<div class="cpd">
    <h3 class="cpd-t">${n.title}</h3>
    <p class="cpd-time">发布时间：${n.time} · 阅读状态：${n.unread ? '未读' : '已读'}</p>
    <div class="cpd-body">${n.body.split('\n\n').map(p => `<p>${escape(p)}</p>`).join('')}</div>
    ${n.attach ? `<button class="cpd-attach" type="button" data-attach="1">
        <span class="cpd-attach-i">PDF</span>
        <span class="cpd-attach-n">${n.attach}</span>
      </button>` : ''}
    ${n.stat ? `<p class="cpd-stat">${n.stat}</p>` : ''}
  </div>`;
}

export function campusServiceHTML(state) {
  const cats = ['后勤报修', '学籍事务', '咨询建议', '投诉举报'];
  const has = !!state.gov;
  return `<div class="cps">
    <div class="cps-cats">
      ${cats.map(c => `<button class="cps-cat" type="button" data-scat="${c}">${c}</button>`).join('')}
    </div>
    <div class="cps-hint">一般事项五个工作日内答复。</div>
    ${has ? `<button class="cps-case" type="button" data-scat="mine">
        <span class="cps-case-t">我的工单</span>
        <span class="cps-case-m">${escape(state.gov.no || '')} · ${escape(state.gov.time || '')}</span>
        <span class="cps-badge">${state.gov.replied ? '已办结' : '已收悉'}</span>
      </button>` : '<p class="cps-empty">还没有提交过任何事项。</p>'}
  </div>`;
}

/** 咨询建议表单（校园通自己的那一套，不是市政务平台） */
export function campusConsultHTML() {
  return `<div class="cpc">
    <p class="cpc-warn">恶意投诉、诬告陷害的，将依法依规追究责任。</p>
    <p class="cpc-sub">本栏目受理的事项，需提供具体事实与相关证据。</p>
    <label class="cpc-f">
      <span class="cpc-l">我要反映的事</span>
      <textarea class="cpc-ta" id="cpcBody" rows="5" placeholder="写清时间、地点、经过。写不出来也可以先写问题。"></textarea>
    </label>
    <label class="cpc-f">
      <span class="cpc-l">我是否希望收到答复</span>
      <select class="cpc-sel" id="cpcReply">
        <option value="yes">希望回复（请注明希望的联系方式）</option>
        <option value="no">不用回复，只是记录一下</option>
      </select>
    </label>
    <label class="cpc-f">
      <span class="cpc-l">是否公开</span>
      <select class="cpc-sel" id="cpcOpen">
        <option value="no">不公开</option>
        <option value="yes">公开（其他同学可在服务大厅查看）</option>
      </select>
    </label>
    <label class="cpc-check">
      <input type="checkbox" id="cpcAgree" />
      <span>我已阅读并同意《服务大厅使用须知》</span>
    </label>
    <button class="btn btn-primary cpc-submit" id="cpcSubmit" type="button">提交</button>
  </div>`;
}

export function campusReceiptHTML(no, time) {
  return `<div class="cpr">
    <div class="cpr-ok">✓</div>
    <h3 class="cpr-t">您的提交已收悉</h3>
    <p class="cpr-kv">工单号：<b>${escape(no)}</b></p>
    <p class="cpr-kv">受理时间：${escape(time)}</p>
    <p class="cpr-kv">办理时限：5 个工作日内</p>
    <p class="cpr-kv">当前状态：已收悉</p>
    <p class="cpr-note">同一个事项请勿重复提交。如需补充材料，请携带相关证件到服务大厅现场办理。</p>
  </div>`;
}

/** 我的考勤 / 课后服务 */
export function campusAttendHTML(state) {
  const rows = [
    ['9 月 1 日 周一', '已签到 07:41　已签退 17:12', ''],
    ['9 月 6 日 周六', '已签到 07:41　已签退 12:05', '课后服务'],
    ['9 月 8 日 周一', '已签到 07:52　已签退 17:05', '']
  ];
  return `<div class="cpa">
    <div class="cpa-head">
      <span>我的考勤</span>
      <span class="cpa-sub">可查看班级考勤（家长可见）</span>
    </div>
    ${rows.map(r => `<div class="cpa-row${r[2] ? ' is-weekend' : ''}">
        <span class="cpa-d">${r[0]}</span>
        <span class="cpa-t">${r[1]}</span>
        ${r[2] ? `<span class="cpa-tag">${r[2]}</span>` : ''}
      </div>`).join('')}
  </div>`;
}

/* =========================================================
   家长群接龙
   ---------------------------------------------------------
   剧情里那个"没有人要求，却自己发起"的接龙。
   ========================================================= */
export function chainHTML(state) {
  const list = [
    { who: '沈予安妈妈', time: '9 月 8 日 21:04', text: '收到，已签。' },
    { who: '周予晴妈妈', time: '9 月 8 日 21:07', text: '收到。' },
    { who: '吴建国（吴磊爸爸）', time: '9 月 8 日 21:12', text: '收到。' },
    { who: '孙芃妈妈', time: '9 月 8 日 21:19', text: '收到，麻烦把表发给老师。' },
    { who: '许小满妈妈', time: '9 月 8 日 22:03', text: '收到' },
    { who: '李阿姨', time: '9 月 8 日 22:41', text: '收到。' }
  ];
  return `<div class="mch">
    <div class="mch-h">
      <span class="mch-t">周六课后服务签到接龙</span>
      <span class="mch-c">${list.length} 人</span>
    </div>
    <p class="mch-note">没有人要求接龙。它自己就长出来了。</p>
    <ul class="mch-list">
      ${list.map(i => `<li class="mch-item">
        <span class="mch-n">${i.who}</span>
        <span class="mch-x">${i.text}</span>
        <span class="mch-time">${i.time}</span>
      </li>`).join('')}
    </ul>
    <p class="mch-foot">到底是谁先发的那一条，群里没人记得。</p>
  </div>`;
}

/* =========================================================
   相册
   ---------------------------------------------------------
   照片用的是现有背景素材，标注按剧情时间排。
   ========================================================= */
const ALBUM = [
  { bg: 'classroom',  date: '9 月 1 日', cap: '开学第一天，公告栏那张格子纸' },
  { bg: 'bedroom',   date: '8 月 31 日', cap: '我家的天花板（拍糊了）' },
  { bg: 'corridor',  date: '9 月 6 日', cap: '周六的走廊，比平时安静' },
  { bg: 'playground',date: '9 月 8 日', cap: '操场，第三楼能拍到这里' },
  { bg: 'canteen',   date: '9 月 9 日', cap: '晚自习前的食堂' }
];

export function galleryHTML() {
  const items = ALBUM.map((a, i) => {
    const url = assetUrl('background', a.bg);
    return `<button class="mg-item" type="button" data-album="${i}">
      <span class="mg-img"${url ? ` style="background-image:url('${url}')"` : ''}></span>
      <span class="mg-cap">${a.cap}</span>
      <span class="mg-date">${a.date}</span>
    </button>`;
  }).join('');
  return `<div class="mg">
    <div class="mg-head"><span>按时间</span><span>${ALBUM.length} 张</span></div>
    <div class="mg-grid">${items}</div>
  </div>`;
}

export function galleryDetailHTML(i) {
  const a = ALBUM[i] || ALBUM[0];
  const url = assetUrl('background', a.bg);
  return `<div class="mgd">
    <div class="mgd-img"${url ? ` style="background-image:url('${url}')"` : ''}></div>
    <p class="mgd-cap">${a.cap}</p>
    <p class="mgd-date">${a.date}</p>
  </div>`;
}

/* =========================================================
   计算器
   ---------------------------------------------------------
   剧情里出现过：一个男生举起手机，屏幕上是计算器。
   这里做成真能按的计算器，不是摆设。
   ========================================================= */
export function calcHTML() {
  const keys = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['0', '.', '=', '=']
  ];
  const cells = keys.flat().map(k => {
    if (k === '=') return '';
    const cls = /[0-9.]/.test(k) ? 'is-num' : 'is-op';
    return `<button class="mk ${cls}" type="button" data-k="${k}">${k}</button>`;
  }).join('');
  return `<div class="mca">
    <div class="mca-screen" id="calcScreen">0</div>
    <div class="mca-pad">${cells}</div>
  </div>`;
}

/** 计算器逻辑：挂在 mca-screen 上，返回一个清理函数 */
export function bindCalc(root) {
  const screen = root.querySelector('#calcScreen');
  if (!screen) return () => {};
  let acc = null, op = null, cur = '0', fresh = true;
  const show = () => { screen.textContent = cur; };
  const num = (a, b, o) => {
    const x = parseFloat(a), y = parseFloat(b);
    if (o === '+') return x + y;
    if (o === '−') return x - y;
    if (o === '×') return x * y;
    if (o === '÷') return y === 0 ? NaN : x / y;
    return y;
  };
  const fmt = (n) => {
    if (!isFinite(n)) return '错误';
    const r = Math.round(n * 1e10) / 1e10;
    return String(r);
  };
  root.querySelectorAll('.mk').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (/[0-9]/.test(k)) {
        cur = (fresh || cur === '0') ? k : cur + k;
        fresh = false;
      } else if (k === '.') {
        if (fresh) { cur = '0.'; fresh = false; }
        else if (!cur.includes('.')) cur += '.';
      } else if (k === 'C') {
        acc = null; op = null; cur = '0'; fresh = true;
      } else if (k === '⌫') {
        cur = cur.length > 1 ? cur.slice(0, -1) : '0';
        if (cur === '-') cur = '0';
      } else if (k === '%') {
        cur = fmt(parseFloat(cur) / 100);
      } else if (k === '=') {
        if (op !== null && acc !== null) cur = fmt(num(acc, cur, op));
        acc = null; op = null; fresh = true;
      } else {
        if (op !== null && acc !== null && !fresh) cur = fmt(num(acc, cur, op));
        acc = parseFloat(cur); op = k; fresh = true;
      }
      show();
    });
  });
  return () => {};
}

/* =========================================================
   小工具
   ========================================================= */
export function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
