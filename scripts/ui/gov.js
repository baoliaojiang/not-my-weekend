/* =========================================================
   政务服务平台 · 网页界面
   ---------------------------------------------------------
   三块内容：
     1) 我要反映 —— 可填写的表单（类型 / 时间 / 金额 / 内容 /
        诉求 / 联系方式 / 验证码 / 承诺勾选）
     2) 提交成功 —— 受理编号与查询提示
     3) 进度查询详情 —— 办理流程节点 + 节点意见（教育局答复）
   全部是纯 DOM，不依赖任何第三方库，样式在 main.css 的 .gov-* 里。
   ========================================================= */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ---------------- 可插入的事实（随玩家收集的材料变化） ---------------- */
export function factLines(state) {
  const has = (id) => (state.materials || []).includes(id);
  const f = state.flags || {};
  const out = [];
  if (has('M001')) out.push('学校于 9 月 5 日发布《周日学业支持活动通知》，写明"学生自愿参加"。');
  if (has('M002')) out.push('班级《参加意向登记表》按全班人数印了 42 行，未参加者需在备注栏说明原因。');
  if (has('M005')) out.push('9 月 7 日家长群内出现接龙"已签"，接龙由家长自行发起，共 31 条。');
  if (has('M008')) out.push('年级组下发的统计表设有"情况"一栏，其中出现"家长态度不明"等评价性用语。');
  if (has('M011')) out.push('确认书于 9 月 3 日早读发放，当晚家长群开始接龙，两者相隔约十四小时。');
  if (f.knows_teacher_words) out.push('班主任在班会上表示"不签的要说明理由"，与通知中的自愿表述不一致。');
  if (f.saw_excel || f.knows_excel_detail) out.push('有同学看到年级组的表格里记录了"未参与"学生的跟进情况。');
  if (f.bureau_sent) out.push('此前已就同一事项向平台反映过一次，答复未涉及具体做法。');
  return out;
}

/* ---------------- 1) 表单 ---------------- */
export function complaintHTML(state, cfg = {}) {
  const types = [
    { k: 'fee', label: '违规收费' },
    { k: 'force', label: '变相强制' },
    { k: 'time', label: '作息与减负' },
    { k: 'other', label: '其他' }
  ];
  const claims = [
    { k: 'stop', label: '停止相关做法' },
    { k: 'refund', label: '退还费用' },
    { k: 'write', label: '书面说明依据' },
    { k: 'handle', label: '依法处理' }
  ];
  const facts = factLines(state);
  // 日期默认用剧情内时间（cfg.time 形如 2025-09-10 22:40），不要取系统日期
  const timeHit = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(cfg.time || ''));
  const today = cfg.date || (timeHit ? `${timeHit[1]}-${timeHit[2]}-${timeHit[3]}` : '2025-09-18');

  return `<div class="gov">
  <div class="gov-top">
    <div class="gov-brand">
      <span class="gov-seal">政务</span>
      <span class="gov-brand-t">市政务服务平台</span>
    </div>
    <span class="gov-crumb">首页 / 我要反映 / 教育</span>
  </div>

  <form class="gov-form" id="govForm" autocomplete="off" novalidate>
    <h3 class="gov-h">我要反映</h3>
    <p class="gov-sub">请客观陈述事实，勿包含他人隐私信息。带 <b>*</b> 为必填项。</p>

    <label class="gov-row">
      <span class="gov-lb">反映对象 <b>*</b></span>
      <select id="gvUnit" class="gov-input">
        <option value="明德中学">明德中学</option>
        <option value="明德中学 高一年级组">明德中学 · 高一年级组</option>
        <option value="其他">其他（在内容中说明）</option>
      </select>
    </label>

    <div class="gov-row">
      <span class="gov-lb">问题类型 <b>*</b></span>
      <div class="gov-chips" id="gvType">
        ${types.map(t => `<button type="button" class="gov-chip" data-k="${t.k}">${t.label}</button>`).join('')}
      </div>
    </div>

    <div class="gov-row gov-row-2">
      <label class="gov-cell">
        <span class="gov-lb">事发日期 <b>*</b></span>
        <input type="date" id="gvDate" class="gov-input" value="${today}" />
      </label>
      <label class="gov-cell">
        <span class="gov-lb">涉及金额（元）</span>
        <input type="number" id="gvAmount" class="gov-input" placeholder="选填" min="0" step="1" />
      </label>
    </div>

    <label class="gov-row">
      <span class="gov-lb">反映内容 <b>*</b>
        <em class="gov-count"><span id="gvCount">0</span> / 500</em>
      </span>
      <textarea id="gvDesc" class="gov-input gov-textarea" maxlength="500"
        placeholder="请写明时间、地点、涉及人员与具体经过。"></textarea>
      <div class="gov-tools">
        <button type="button" class="gov-mini" id="gvPaste" ${facts.length ? '' : 'disabled'}>
          插入我整理过的事实${facts.length ? `（${facts.length} 条）` : '（暂无）'}
        </button>
        <span class="gov-hint" id="gvPasteHint"></span>
      </div>
    </label>

    <div class="gov-row">
      <span class="gov-lb">诉求（可多选）</span>
      <div class="gov-checks" id="gvClaims">
        ${claims.map(c => `<label class="gov-check"><input type="checkbox" value="${c.k}" /><i></i>${c.label}</label>`).join('')}
      </div>
    </div>

    <div class="gov-row gov-row-2">
      <label class="gov-cell">
        <span class="gov-lb">联系人</span>
        <input type="text" id="gvName" class="gov-input" placeholder="选填" maxlength="20" />
      </label>
      <label class="gov-cell">
        <span class="gov-lb">手机号</span>
        <input type="tel" id="gvPhone" class="gov-input" placeholder="选填，用于接收答复" maxlength="11" />
      </label>
    </div>

    <label class="gov-row gov-row-inline">
      <span class="gov-lb">验证码 <b>*</b></span>
      <span class="gov-code"><b id="gvCodeQ">3 + 5</b> =</span>
      <input type="text" id="gvCode" class="gov-input gov-input-code" maxlength="4" inputmode="numeric" />
      <span class="gov-hint">看不清可以刷新</span>
    </label>

    <label class="gov-check gov-check-alone">
      <input type="checkbox" id="gvPromise" /><i></i>
      我承诺所填内容真实，知悉虚假反映需承担相应责任。
    </label>

    <p class="gov-err" id="gvErr"></p>

    <div class="gov-actions">
      <button type="submit" class="gov-submit" id="gvSubmit">提 交</button>
      <button type="button" class="gov-cancel" id="gvCancel">关掉页面</button>
    </div>
    <p class="gov-foot">本页面为虚构的游戏内界面，不对应任何真实的政务系统。</p>
  </form>
</div>`;
}

/* ---------------- 表单交互 ---------------- */
export function bindComplaint(root, state, onSubmit) {
  const $ = (s) => root.querySelector(s);
  const form = $('#govForm');
  if (!form) return;

  const picked = new Set();
  const codeQ = $('#gvCodeQ');
  let codeAns = 0;

  const newCode = () => {
    const a = 2 + Math.floor(Math.random() * 7);
    const b = 2 + Math.floor(Math.random() * 7);
    codeAns = a + b;
    if (codeQ) codeQ.textContent = `${a} + ${b}`;
  };
  newCode();
  const codeBox = $('#gvCode');
  if (codeBox) codeBox.addEventListener('focus', () => { if (!codeBox.dataset.once) { codeBox.dataset.once = '1'; } });

  root.querySelectorAll('#gvType .gov-chip').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (picked.has(k)) picked.delete(k); else picked.add(k);
      // 单选更接近真实表单的“问题类型”，但仍允许多选两类
      b.classList.toggle('on', picked.has(k));
      $('#gvErr').textContent = '';
    });
  });

  const desc = $('#gvDesc');
  const count = $('#gvCount');
  desc.addEventListener('input', () => {
    if (count) count.textContent = String(desc.value.length);
    $('#gvErr').textContent = '';
  });

  const facts = factLines(state);
  const paste = $('#gvPaste');
  if (paste) {
    paste.addEventListener('click', () => {
      if (!facts.length) return;
      const body = '现将有关情况反映如下：\n' + facts.map((x, i) => `${i + 1}. ${x}`).join('\n');
      desc.value = desc.value.trim() ? desc.value.trim() + '\n' + body : body;
      desc.dispatchEvent(new Event('input'));
      desc.scrollTop = desc.scrollHeight;
      const hint = $('#gvPasteHint');
      if (hint) hint.textContent = `已插入 ${facts.length} 条，可继续补充`;
      root.dataset.evidence = '1';
      paste.disabled = true;
    });
  }

  const cancel = $('#gvCancel');
  if (cancel) cancel.addEventListener('click', () => onSubmit({ submitted: false }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#gvErr');
    const setErr = (msg, sel) => {
      err.textContent = msg;
      if (sel) { const el = $(sel); if (el) el.focus(); }
    };
    if (!picked.size) return setErr('请选择问题类型。', '#gvType');
    const d = (desc.value || '').trim();
    if (d.length < 30) return setErr(`反映内容太短（${d.length}/30 字），请写清时间、地点与经过。`, '#gvDesc');
    if (!(root.querySelector('#gvPromise') || {}).checked) return setErr('请勾选真实性承诺。', '#gvPromise');
    const code = (($('#gvCode') || {}).value || '').trim();
    if (code !== String(codeAns)) {
      newCode();
      if ($('#gvCode')) $('#gvCode').value = '';
      return setErr('验证码不正确，已刷新，请重新输入。', '#gvCode');
    }

    const claims = Array.from(root.querySelectorAll('#gvClaims input:checked')).map(i => i.value);
    const amountRaw = (($('#gvAmount') || {}).value || '').trim();

    onSubmit({
      submitted: true,
      unit: ($('#gvUnit') || {}).value || '明德中学',
      types: Array.from(picked),
      date: ($('#gvDate') || {}).value || '',
      amount: amountRaw ? Number(amountRaw) : 0,
      desc: d,
      claims,
      phone: (($('#gvPhone') || {}).value || '').trim(),
      evidence: !!(root.dataset && root.dataset.evidence),
      len: d.length
    });
  });
}

/* ---------------- 2) 提交回执 ---------------- */
export function receiptHTML(res) {
  return `<div class="gov">
  <div class="gov-top">
    <div class="gov-brand"><span class="gov-seal">政务</span><span class="gov-brand-t">市政务服务平台</span></div>
    <span class="gov-crumb">我要反映 / 提交结果</span>
  </div>
  <div class="gov-done">
    <div class="gov-tick">✓</div>
    <h3>提交成功</h3>
    <p class="gov-sub">您的反映已进入受理流程，请保存受理编号以便查询。</p>
    <dl class="gov-kv">
      <dt>受理编号</dt><dd class="gov-no">${esc(res.no)}</dd>
      <dt>提交时间</dt><dd>${esc(res.time)}</dd>
      <dt>办理单位</dt><dd>${esc(res.unit || '市教育局')}</dd>
      <dt>问题类型</dt><dd>${esc(res.typeText)}</dd>
      <dt>答复方式</dt><dd>办理完成后通过本页面或短信告知</dd>
    </dl>
    <p class="gov-note">${esc(res.note || '')}</p>
    <div class="gov-actions">
      <button type="button" class="gov-submit" id="gvProgress">查看办理进度</button>
      <button type="button" class="gov-cancel" id="gvBack">返回</button>
    </div>
    <p class="gov-foot">本页面为虚构的游戏内界面，不对应任何真实的政务系统。</p>
  </div>
</div>`;
}

/* ---------------- 3) 进度查询详情 ---------------- */
export function progressHTML(data) {
  const nodes = data.nodes || [];
  const rows = nodes.map((n, i) => `
    <li class="gov-node ${i === nodes.length - 1 ? 'last' : ''} ${n.done === false ? 'todo' : ''}" data-i="${i}">
      <span class="gov-dot"></span>
      <div class="gov-node-main">
        <div class="gov-node-head">
          <span class="gov-node-t">${esc(n.title)}</span>
          <span class="gov-node-time">${esc(n.time || '')}</span>
        </div>
        <div class="gov-node-who">${esc(n.who || '')}</div>
        <div class="gov-node-op">${esc(n.opinion || '')}</div>
      </div>
    </li>`).join('');

  const last = nodes[nodes.length - 1] || {};

  return `<div class="gov">
  <div class="gov-top">
    <div class="gov-brand"><span class="gov-seal">政务</span><span class="gov-brand-t">市政务服务平台</span></div>
    <span class="gov-crumb">进度查询 / 详情</span>
  </div>
  <div class="gov-progress">
    <h3 class="gov-h">进度查询详情</h3>
    <dl class="gov-kv">
      <dt>事项编号</dt><dd class="gov-no">${esc(data.no || '')}</dd>
      <dt>反映事项</dt><dd>${esc(data.subject || '')}</dd>
      <dt>当前状态</dt><dd><span class="gov-badge">${esc(last.state || '已办结')}</span></dd>
      <dt>承办单位</dt><dd>${esc(data.unit || '市教育局')}</dd>
    </dl>

    <h4 class="gov-h4">办理流程</h4>
    <ul class="gov-flow">${rows}</ul>

    <div class="gov-reply" id="govReply">
      <div class="gov-reply-head">节点意见 · ${esc(last.title || '')}</div>
      <div class="gov-reply-body">${(data.reply || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      ${data.tail ? `<div class="gov-reply-tail">${esc(data.tail)}</div>` : ''}
    </div>

    <div class="gov-actions">
      <button type="button" class="gov-submit" id="gvOk">我已看过</button>
      <button type="button" class="gov-cancel" id="gvAgain">补充材料后再问一次</button>
    </div>
    <p class="gov-foot">本页面为虚构的游戏内界面，不对应任何真实的政务系统。</p>
  </div>
</div>`;
}

export function bindProgress(root, data, onPick, onClose) {
  const $ = (s) => root.querySelector(s);
  const items = Array.from(root.querySelectorAll('.gov-node'));
  const reply = $('#govReply');
  items.forEach((el, i) => {
    el.addEventListener('click', () => {
      items.forEach(x => x.classList.remove('sel'));
      el.classList.add('sel');
      const n = (data.nodes || [])[i] || {};
      if (reply) {
        reply.innerHTML = `<div class="gov-reply-head">节点意见 · ${esc(n.title)}</div>
          <div class="gov-reply-body">${n.opinionHtml || `<p>${esc(n.opinion || '（该节点无意见记录）')}</p>`}</div>
          ${n.time ? `<div class="gov-reply-tail">${esc(n.time)} · ${esc(n.who || '')}</div>` : ''}`;
      }
      if (onPick) onPick(n, i);
    });
  });
  const ok = $('#gvOk');
  if (ok) ok.addEventListener('click', () => onClose('ok'));
  const again = $('#gvAgain');
  if (again) again.addEventListener('click', () => onClose('again'));
}

/* ---------------- 从存档里的反映记录重建进度页 ---------------- */
const TYPE_TEXT = { fee: '违规收费', force: '变相强制', time: '作息与减负', other: '其他' };

export function typeText(types) {
  return (types || []).map(k => TYPE_TEXT[k] || k).join('、') || '未填写';
}

const SCHOOL_REPLY = [
  '同学您好！您的反馈已收悉，我局高度重视，已转相关科室核查。现将有关情况说明及处理结果回复如下：',
  '一、情况说明。经了解，明德中学于本学期开展周日学业支持活动。学校称该活动依据自愿原则组织，由学生和家长自主选择是否参加，未参加的学生不作任何处理。',
  '二、整改措施。我局已要求学校：一是再次向学生和家长说明活动性质，不得以任何形式将参与情况与学生评价、班级考核挂钩；二是规范家长群内的信息发布方式，不得以接龙、统计接龙等方式变相要求家长表态；三是涉及签字的材料，须同时提供“不参加”的明确选项，并留存家长知情的记录；四是如发现执行偏差，及时纠正并向家长说明。',
  '三、下一步。我局将持续关注该校相关工作的落实情况。',
  '感谢您对教育工作的关心与监督。'
];

const MASK_REPLY = [
  '同学您好！您的反馈已收悉，我局高度重视，已转相关科室核查。现将有关情况说明及处理结果回复如下：',
  '一、情况说明。经了解，本学期流感高发期间，学校保健室出于方便学生应急使用的考虑，将部分库存口罩向有需要的同学提供。该做法虽出于善意，但不符合医疗物资使用相关规范。',
  '二、整改措施。我局已责令学校立即整改：一是立即停止发放并全部封存；二是对该批口罩依规销毁，按医疗废弃物处理规范进行；三是通过正规采购渠道购置符合国家标准的医用防护口罩，保障师生日常防护需求；四是经核查，本学期保健室提供给学生的口罩都是免费的，故不存在退款情况。'
];

export function buildCaseProgress(gov) {
  if (!gov) return null;
  const mask = gov.kind === 'mask';
  const t0 = gov.time || '';
  const day = (offset) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t0);
    if (!m) return t0;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + offset);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const nodes = [
    {
      title: '提交', time: t0, who: '本人 · 政务服务平台', state: '已提交',
      opinion: `反映对象：${mask ? '明德中学（保健室）' : '明德中学'}；问题类型：${typeText(gov.types)}。`
    },
    {
      title: '受理', time: `${day(1)} 09:12`, who: '市政务服务热线', state: '已受理',
      opinion: '您反映的事项已受理，已按属地管理原则转交主管部门办理。'
    },
    {
      title: '交办', time: `${day(1)} 15:40`, who: '市教育局', state: '已交办',
      opinion: mask ? '转市场监督管理相关部门、市教育局分别核实。' : '转基础教育科核实并答复。'
    },
    {
      title: '承办', time: `${day(4)} 10:05`, who: mask ? '市教育局 · 体育卫生与艺术教育科' : '市教育局 · 基础教育科', state: '办理中',
      opinion: '已联系学校了解情况，调阅相关通知与登记材料。'
    },
    {
      title: '答复', time: `${day(6)} 16:20`, who: mask ? '市教育局' : '市教育局 · 基础教育科', state: '已办结',
      opinion: '办理结果已通过本页面答复，并同步发送短信提示。'
    }
  ];
  if (!gov.replied) {
    nodes[nodes.length - 1].title = '答复';
    nodes[nodes.length - 1].time = '';
    nodes[nodes.length - 1].state = '办理中';
    nodes[nodes.length - 1].opinion = '正在办理，答复后将通过本页面或短信告知。';
    nodes[nodes.length - 1].done = false;
  }
  return {
    no: gov.no,
    subject: mask ? '反映学校保健室向学生提供过期口罩并收费' : '反映学校周日学业支持活动组织方式问题',
    unit: '市教育局',
    nodes,
    reply: gov.replied ? (mask ? MASK_REPLY : SCHOOL_REPLY) : ['您的反映已受理，正在办理中。'],
    tail: gov.replied ? '本答复由市教育局通过市政务服务平台答复，办理结果可在平台查询。' : ''
  };
}

/* ---------------- 4) 12345 通话 ----------------
   steps:
     { who:'接线员', text:'…' }
     { ask:'接线员：您怎么称呼？', options:[{ text:'…', reply:'…', flag:'hot_no_name' }] }
   玩家每点一次“继续”，Transcript 里就多一行。
   ------------------------------------------------ */
export function hotlineHTML(cfg) {
  const no = cfg.number || '12345';
  return `<div class="hot">
  <div class="hot-top">
    <div class="hot-line">
      <span class="hot-rec"></span>录音中
    </div>
    <div class="hot-title">${esc(cfg.title || '政务服务便民热线')}</div>
    <div class="hot-no">${esc(no)}</div>
    <div class="hot-status" id="hotStatus">正在呼叫…</div>
    <div class="hot-timer" id="hotTimer">00:00</div>
  </div>
  <div class="hot-body" id="hotBody"></div>
  <div class="hot-foot" id="hotFoot">
    <button class="hot-btn" id="hotNext" disabled>接通中</button>
  </div>
  <p class="hot-tip">本页面为虚构的游戏内界面，不对应任何真实的热线系统。</p>
</div>`;
}

export function bindHotline(root, steps, onDone) {
  const $ = (s) => root.querySelector(s);
  const body = $('#hotBody');
  const foot = $('#hotFoot');
  const status = $('#hotStatus');
  const timerEl = $('#hotTimer');
  if (!body || !foot) return;

  let sec = 0;
  let ticks = null;
  const flags = [];

  const startTimer = () => {
    if (ticks) return;
    ticks = setInterval(() => {
      sec += 1;
      timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 1000);
  };

  const addLine = (who, text, cls = '') => {
    const el = document.createElement('div');
    el.className = 'hot-msg ' + cls;
    el.innerHTML = `${who ? `<div class="hot-who">${esc(who)}</div>` : ''}
      <div class="hot-bubble">${esc(text)}</div>`;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  };

  const clearFoot = () => { foot.innerHTML = ''; };

  let i = 0;
  const step = () => {
    if (i >= steps.length) return finish();
    const s = steps[i++];
    if (s.who || s.text) {
      addLine(s.who || '', s.text || '');
      clearFoot();
      const b = document.createElement('button');
      b.className = 'hot-btn';
      b.textContent = s.promptNext || '继续';
      b.addEventListener('click', step);
      foot.appendChild(b);
      return;
    }
    if (s.ask) {
      addLine('接线员', s.ask, 'ask');
      clearFoot();
      (s.options || []).forEach((o, k) => {
        const b = document.createElement('button');
        b.className = 'hot-opt';
        b.innerHTML = `<span class="hot-idx">${k + 1}</span>${esc(o.text)}`;
        b.addEventListener('click', () => {
          addLine('我', o.text, 'me');
          if (o.flag) flags.push(o.flag);
          if (o.reply) addLine('接线员', o.reply);
          clearFoot();
          const n = document.createElement('button');
          n.className = 'hot-btn';
          n.textContent = '继续';
          n.addEventListener('click', step);
          foot.appendChild(n);
        });
        foot.appendChild(b);
      });
      return;
    }
    step();
  };

  const finish = () => {
    if (ticks) { clearInterval(ticks); ticks = null; }
    if (status) status.textContent = '通话结束';
    clearFoot();
    const b = document.createElement('button');
    b.className = 'hot-btn';
    b.textContent = '挂断';
    b.addEventListener('click', () => onDone({ flags }));
    foot.appendChild(b);
  };

  // 先是“正在呼叫”，一秒多之后接通
  setTimeout(() => {
    if (status) status.textContent = '已接通 · 通话中';
    startTimer();
    step();
  }, 1100);
}
