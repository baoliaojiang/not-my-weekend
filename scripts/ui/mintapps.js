/* =========================================================
   手机里的「独立应用」
   ---------------------------------------------------------
   以前桌面上的设置、更新、关于、通讯录、存档、进度，
   点下去全都是在关掉手机、弹出游戏自己的面板——
   手机只是个外壳，图标是通往游戏功能的快捷方式。
   这一版把它们做成真正的 App：留着手机的导航栏，
   页面照澎湃 OS 4 / iOS 26 的分组卡片来写，
   而且真的能改东西（夜间模式、音量、动效、档位恢复）。
   ========================================================= */
import { faceUrl } from '../config/assets.js';
import { charNowLine } from '../data/characters.js';
import { mintIcon } from './mintos.js';
import { CHANGELOG } from '../data/changelog.js';

/* ---------------- 设备信息（虚构机型，别对号入座） ---------------- */
export const DEVICE = {
  brand: 'Mint',
  os: 'MintOS 4',
  model: 'Mint Note 11SE',
  chip: '薄荷 680',
  cpu: '八核 · 最高 2.4GHz',
  ram: '8.00 GB',
  rom: '256 GB',
  screen: '6.67 英寸 · 720p（1600 × 720）',
  battery: '4500mAh · 66W 快充',
  camera: '后置 1.08 亿像素三摄 / 前置 3200 万',
  weight: '186g'
};

/* ---------------- MintOS 自己的版本与更新日志 ----------------
   手机里显示的更新，是"这台手机的系统更新"，跟游戏版本不是一回事：
   学生机由学校信息中心统一管控，推送的都是安全补丁、管控策略、
   以及"不允许安装校外应用"这类说明。 */
export const MINTOS_VER = '4.0.6.2';

export const MINTOS_LOG = [
  {
    version: '4.0.6.2',
    date: '2026-10-01',
    intro: '这一版主要是安全补丁和管控策略，界面没有改动。',
    items: [
      '合入 2026 年 9 月安全补丁，修复系统组件中的两处越权问题。',
      '校园管控策略升级：卸载管控组件、修改系统分区会触发设备锁定。',
      '应用签名校验改为强制模式，未在校内白名单的安装包一律拒绝。',
      '修复部分机型在低电量下自动关机的问题（Mint Note 系列）。'
    ]
  },
  {
    version: '4.0.5.0',
    date: '2026-08-12',
    intro: '这一版把家长端和学生端拆开了。',
    items: [
      '新增「校园管控」设置页，可查看当前生效的策略条目。',
      '新增使用时长统计，家长端可以按周查看。',
      '优化后台调度，待机耗电下降约 8%。',
      '修复锁屏通知在深色模式下看不清的问题。'
    ]
  },
  {
    version: '4.0.0.0',
    date: '2026-06-20',
    intro: 'MintOS 4 第一个正式版，随新机预装。',
    items: [
      '全新分层式界面，状态栏改为左时间右图标。',
      '文件级数据加密默认开启。',
      '移除第三方应用商店入口，仅保留校内白名单。'
    ]
  }
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 行：图标 + 标题 + 副标题 + 右侧值/开关/箭头 */
function row({ icon, label, sub, value, arrow, extra = '', cls = '' }) {
  return `<div class="mapp-row ${cls}">
    ${icon ? `<span class="mapp-ri"><img src="${mintIcon(icon)}" alt="" /></span>` : ''}
    <span class="mapp-rt">
      <span class="mapp-rl">${label}</span>
      ${sub ? `<span class="mapp-rs">${sub}</span>` : ''}
    </span>
    ${value ? `<span class="mapp-rv">${value}</span>` : ''}
    ${extra}
    ${arrow ? '<span class="mapp-ar" aria-hidden="true">›</span>' : ''}
  </div>`;
}

function sw(on, key, label) {
  return `<button class="mapp-sw ${on ? 'on' : ''}" type="button"
    data-sw="${key}" role="switch" aria-checked="${on ? 'true' : 'false'}"
    aria-label="${esc(label || key)}"></button>`;
}

/* =========================================================
   设置
   ========================================================= */
export function settingsAppHTML(s, opts = {}) {
  const ver = opts.version || '0.6.3.0';
  const night = s.nightMode !== false;
  const motionOn = s.motion !== 'reduced';
  const bgmOn = !!s.bgmOn;
  const hero = `<div class="mapp-hero">
    <span class="mapp-hero-av">林</span>
    <span class="mapp-hero-t">
      <b>林知序</b>
      <i>薄荷账号 · 已登录 · ${DEVICE.model}</i>
    </span>
    <span class="mapp-ar" aria-hidden="true">›</span>
  </div>`;

  return `<div class="mapp">
    ${hero}

    <p class="mapp-gt">网络与连接</p>
    <div class="mapp-card">
      ${row({ icon: 'browser', label: 'WLAN', value: '校园网 · Mint-ZX', arrow: true })}
      ${row({ icon: 'phone', label: '蓝牙', value: '未开启', arrow: true })}
      ${row({ icon: 'chain', label: '个人热点', value: '关闭', arrow: true })}
      ${row({ icon: 'browser', label: '流量使用', value: '本月 1.2 GB', arrow: true })}
    </div>

    <p class="mapp-gt">显示</p>
    <div class="mapp-card">
      ${row({ label: '深色模式', sub: '游戏界面用深色底', extra: sw(night, 'night', '深色模式') })}
      <div class="mapp-row mapp-row-slider">
        <span class="mapp-rt"><span class="mapp-rl">对话字号</span></span>
        <input class="mapp-range" type="range" min="80" max="160" step="5"
               value="${Math.round((s.dlgScale || 1) * 100)}" data-range="dlgScale" aria-label="对话字号" />
        <span class="mapp-rv" id="mappScaleVal">${Math.round((s.dlgScale || 1) * 100)}%</span>
      </div>
      ${row({ label: '屏幕方向', value: screenText(s.screenMode), arrow: true, cls: 'mapp-row-nav' })}
    </div>

    <p class="mapp-gt">声音与振动</p>
    <div class="mapp-card">
      ${row({ label: '背景音乐', extra: sw(bgmOn, 'bgm', '背景音乐') })}
      <div class="mapp-row mapp-row-slider">
        <span class="mapp-rt"><span class="mapp-rl">音乐音量</span></span>
        <input class="mapp-range" type="range" min="0" max="1" step="0.05"
               value="${s.bgmVolume == null ? 0.6 : s.bgmVolume}" data-range="bgmVolume" aria-label="音乐音量" />
      </div>
      <div class="mapp-row mapp-row-slider">
        <span class="mapp-rt"><span class="mapp-rl">音效音量</span></span>
        <input class="mapp-range" type="range" min="0" max="1" step="0.05"
               value="${s.sfxVolume == null ? 0.7 : s.sfxVolume}" data-range="sfxVolume" aria-label="音效音量" />
      </div>
    </div>

    <p class="mapp-gt">动态效果</p>
    <div class="mapp-card">
      ${row({ label: '界面动画', sub: '关掉只留淡入淡出', extra: sw(motionOn, 'motion', '界面动画') })}
    </div>

    <p class="mapp-gt">系统</p>
    <div class="mapp-card">
      <div class="mapp-row mapp-row-nav" data-go-app="update">
        <span class="mapp-rt"><span class="mapp-rl">软件更新</span></span>
        <span class="mapp-rv">${esc(ver)}</span>
        <span class="mapp-ar" aria-hidden="true">›</span>
      </div>
      <div class="mapp-row mapp-row-nav" data-go-app="about">
        <span class="mapp-rt"><span class="mapp-rl">关于手机</span></span>
        <span class="mapp-rv">${DEVICE.model}</span>
        <span class="mapp-ar" aria-hidden="true">›</span>
      </div>
    </div>

    <p class="mapp-gt">电池与存储</p>
    <div class="mapp-card">
      ${row({ label: '电池', value: '78% · 约 1 天 4 小时', arrow: true })}
      ${row({ label: '存储空间', value: '已用 38.2 GB / 256 GB', arrow: true })}
      ${row({ label: '省电模式', value: '关闭', arrow: true })}
    </div>

    <p class="mapp-gt">安全与隐私</p>
    <div class="mapp-card">
      ${row({ label: '屏幕锁定', sub: '数字密码 · 4 位', value: '已开启', arrow: true })}
      ${row({ label: '应用锁', sub: '薄聊、相册', value: '已开启', arrow: true })}
      ${row({ label: '查找设备', sub: '关机后仍可定位', value: '已开启', arrow: true })}
      ${row({ label: '权限管理', value: '12 个应用', arrow: true })}
      ${row({ label: '隐私保护', value: '默认严格', arrow: true })}
    </div>

    <p class="mapp-gt">其他</p>
    <div class="mapp-card">
      ${row({ label: '语言与输入法', value: '简体中文 · 薄荷输入法', arrow: true })}
      ${row({ label: '日期与时间', value: '自动 · 网络时间', arrow: true })}
      ${row({ label: '无障碍', value: '关闭', arrow: true })}
      ${row({ label: '应用管理', value: '20 个应用', arrow: true })}
      ${row({ label: '恢复出厂设置', arrow: true })}
    </div>

    <p class="mapp-foot">${DEVICE.model} · ${DEVICE.os} · 版本 ${esc(ver)}<br>这台手机是游戏里的道具，设置会同步到游戏本体。</p>
  </div>`;
}

function screenText(mode) {
  return mode === 'portrait' ? '竖屏' : mode === 'landscape' ? '横屏' : '跟随设备';
}

/* 绑定：返回一个"重渲染自己"的函数，改完值就地刷新，不用退出重进 */
export function bindSettingsApp(root, settings, save, onChange) {
  const apply = () => { if (onChange) onChange(); };

  root.querySelectorAll('[data-sw]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.sw;
      const on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      if (k === 'night') settings.nightMode = on;
      if (k === 'bgm') settings.bgmOn = on;
      if (k === 'motion') settings.motion = on ? 'full' : 'reduced';
      save && save();
      apply();
    });
  });

  root.querySelectorAll('[data-range]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.range;
      const v = Number(inp.value);
      if (k === 'bgmVolume') settings.bgmVolume = v;
      else if (k === 'sfxVolume') settings.sfxVolume = v;
      else if (k === 'dlgScale') {
        settings.dlgScale = v / 100;
        const out = root.querySelector('#mappScaleVal');
        if (out) out.textContent = v + '%';
      }
      save && save();
      apply();
    });
  });
}

/* =========================================================
   软件更新 —— 照 MagicOS 那个页面的结构：
   渐变英雄卡 + 白色药丸按钮 + 当前版本信息
   ========================================================= */
export function updateAppHTML(opts = {}) {
  const osVer = opts.osVersion || MINTOS_VER;
  const latest = MINTOS_LOG[0];

  return `<div class="mapp mapp-up">
    <div class="up-hero" id="upHero">
      <div class="up-hero-glow" aria-hidden="true"></div>
      <div class="up-hero-top">
        <img class="up-hero-ico" src="${mintIcon('changelog')}" alt="" />
        <div class="up-hero-tt">
          <b id="upState">已是最新版本</b>
          <i id="upSub">上次检查：刚刚</i>
        </div>
      </div>
      <button class="up-pill" type="button" id="upCheck">检查更新</button>
    </div>

    <div class="mapp-card">
      ${row({ label: '当前版本', value: esc(osVer) })}
      ${row({ label: '系统内核', value: DEVICE.os })}
      ${row({ label: '安全补丁级别', value: '2026-10-01' })}
      ${row({ label: '更新包大小', value: '无需下载' })}
    </div>

    <p class="mapp-gt">安全防护</p>
    <div class="mapp-card">
      ${row({ label: '系统完整性', sub: '启动链逐级校验', value: '通过' })}
      ${row({ label: '应用签名校验', sub: '第三方签名一律拒绝安装', value: '开启' })}
      ${row({ label: '防调试与防注入', sub: '检测到调试器会要求重装系统', value: '开启' })}
      ${row({ label: '数据加密', sub: '文件级加密，换机不可读', value: '开启' })}
      ${row({ label: '校园管控', sub: '由学校信息中心下发', value: '已生效' })}
    </div>
    <p class="mapp-foot">这台终端由学校统一管控：不能安装校外应用，不能修改系统分区。<br>破解会导致设备锁定，需交回信息中心解锁。</p>

    <p class="mapp-gt">本次更新内容</p>
    <div class="mapp-card">
      ${(latest.items || []).slice(0, 3).map(t => `<div class="up-note"><span class="up-dot"></span><span>${esc(t)}</span></div>`).join('')}
      <div class="mapp-row mapp-row-nav" data-go-app="log">
        <span class="mapp-rt"><span class="mapp-rl">查看完整更新日志</span></span>
        <span class="mapp-ar" aria-hidden="true">›</span>
      </div>
    </div>

    <p class="mapp-foot">更新由学校信息中心统一推送，连接校园网时才能下载。</p>
  </div>`;
}

export function bindUpdateApp(root, opts = {}) {
  const btn = root.querySelector('#upCheck');
  if (!btn) return;
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const state = root.querySelector('#upState');
    const sub = root.querySelector('#upSub');
    const old = btn.textContent;
    btn.textContent = '正在检查…';
    btn.classList.add('is-busy');
    if (state) state.textContent = '正在检查更新';
    // 真的去查，查不到就说查不到——不假装"已是最新"
    let txt = '已是最新版本';
    let line = '上次检查：刚刚';
    try {
      const r = opts.check ? await opts.check() : null;
      if (r && r.ok && r.kind !== 'none') {
        txt = '发现新版本';
        line = `可用版本 ${esc(r.content || '')}，进入学校网络后可下载`;
      } else if (r && r.ok) {
        txt = '已是最新版本';
        line = '当前已是最新版本，无需更新';
      } else {
        txt = '暂时无法检查';
        line = '没有连上更新服务器，稍后再试';
      }
    } catch (e) {
      txt = '暂时无法检查';
      line = '没有连上更新服务器，稍后再试';
    }
    if (state) state.textContent = txt;
    if (sub) sub.textContent = line;
    btn.textContent = '再次检查';
    btn.classList.remove('is-busy');
    busy = false;
    if (btn.textContent === old) btn.textContent = '检查更新';
  });
}

/* =========================================================
   关于手机
   ========================================================= */
export function aboutAppHTML(opts = {}) {
  const ver = opts.version || '0.6.3.0';
  return `<div class="mapp">
    <div class="ab-top">
      <img class="ab-ico" src="${mintIcon('settings')}" alt="" />
      <b>${DEVICE.model}</b>
      <i>${DEVICE.os} · ${esc(ver)}</i>
    </div>

    <div class="mapp-card">
      ${row({ label: '设备名称', value: DEVICE.model })}
      ${row({ label: '处理器', value: DEVICE.chip })}
      ${row({ label: '运行内存', value: DEVICE.ram })}
      ${row({ label: '存储空间', value: DEVICE.rom })}
      ${row({ label: '屏幕', value: DEVICE.screen })}
      ${row({ label: '电池', value: DEVICE.battery })}
      ${row({ label: '摄像头', value: DEVICE.camera })}
      ${row({ label: '重量', value: DEVICE.weight })}
    </div>

    <p class="mapp-gt">系统</p>
    <div class="mapp-card">
      ${row({ label: '系统版本', value: DEVICE.os })}
      ${row({ label: '游戏版本', value: esc(ver) })}
      ${row({ label: '序列号', value: 'MN11SE-2026-0901' })}
    </div>

    <p class="mapp-foot">
      本机系统与硬件信息均为虚构，用于游戏内叙事。<br>
      《不属于我的周末》不收集任何个人信息。
    </p>
  </div>`;
}

/* =========================================================
   通讯录
   ========================================================= */
export function contactsAppHTML(state, characters) {
  const list = Object.values(characters || {}).filter(c => c && state.flags[c.metFlag]);
  const groups = new Map();
  list.forEach(c => {
    const ch = (c.name || '#')[0];
    if (!groups.has(ch)) groups.set(ch, []);
    groups.get(ch).push(c);
  });
  const keys = [...groups.keys()].sort();

  const body = keys.map(k => `<p class="ct-letter">${esc(k)}</p>
    <div class="mapp-card">${groups.get(k).map(c => {
      const face = c.sprite ? faceUrl(c.sprite) : null;
      return `<button class="ct-row" type="button" data-contact="${esc(c.id)}">
        <span class="ct-face"${face ? ` style="background-image:url('${face}')"` : ''}>${face ? '' : esc((c.name || '?')[0])}</span>
        <span class="ct-t"><b>${esc(c.name)}</b><i>${esc(c.role || '')}</i></span>
        <span class="mapp-ar" aria-hidden="true">›</span>
      </button>`;
    }).join('')}</div>`).join('');

  return `<div class="mapp mapp-ct">
    <div class="ct-search"><span class="ct-mag" aria-hidden="true"></span><span>搜索联系人</span></div>
    ${keys.length ? body : `<p class="mapp-empty">还没有存下任何人。<br>见过面、说过话的人会自动记进来。</p>`}
    <p class="mapp-foot">共 ${list.length} 位联系人</p>
  </div>`;
}

export function contactDetailHTML(c, state) {
  const face = c.sprite ? faceUrl(c.sprite) : null;
  const now = state ? charNowLine(state) : '';
  return `<div class="mapp mapp-ct-d">
    <div class="ctd-top">
      <span class="ctd-face"${face ? ` style="background-image:url('${face}')"` : ''}></span>
      <b>${esc(c.name)}</b>
      <i>${esc(c.role || '')}</i>
    </div>
    <div class="mapp-card">
      ${c.intro ? `<div class="ctd-block"><span class="mapp-gt">印象</span><p>${esc(c.intro)}</p></div>` : ''}
      ${now ? `<div class="ctd-block"><span class="mapp-gt">此刻</span><p>${esc(now)}</p></div>` : ''}
    </div>
    <p class="mapp-foot">号码、微信一类的东西，她没给过，你也没有。</p>
  </div>`;
}

/* =========================================================
   备份与恢复（原「存档」图标）
   ========================================================= */
export function backupAppHTML(slots, opts = {}) {
  const items = (slots || []).map(sl => {
    const has = !!sl.data;
    const when = sl.time ? sl.time : '';
    return `<div class="mapp-card bk-card">
      <div class="bk-head">
        <span class="bk-no">${sl.index === 0 ? '自动' : '档位 ' + sl.index}</span>
        <span class="bk-time">${has ? esc(when) : '空'}</span>
      </div>
      ${has ? `<div class="bk-meta">${esc(sl.title || '')}${sl.day ? ' · ' + esc(sl.day) : ''}</div>` : '<div class="bk-meta bk-empty">还没有备份</div>'}
      ${has ? `<button class="bk-btn" type="button" data-restore="${sl.index}">从这个备份恢复</button>` : ''}
    </div>`;
  }).join('');

  return `<div class="mapp">
    <div class="bk-top">
      <img src="${mintIcon('save')}" alt="" />
      <div><b>本地备份</b><i>存在这台手机里，卸载游戏就没了</i></div>
    </div>
    ${items || '<p class="mapp-empty">没有可用的备份。</p>'}
    <p class="mapp-foot">备份只在同一台设备上有效，不上传任何服务器。</p>
  </div>`;
}

/* =========================================================
   阅读记录（原「进度」图标）
   ========================================================= */
export function readingAppHTML(chapters, progress) {
  const done = new Set((progress && progress.chapters) || []);
  const rows = (chapters || []).filter(c => !c.side).map(c => {
    const isDone = done.has(c.id);
    return `<div class="mapp-row rd-row ${isDone ? 'is-done' : ''}">
      <span class="rd-no">${esc(c.title || '')}</span>
      <span class="mapp-rt">
        <span class="mapp-rl">${esc(c.name || '')}</span>
        ${c.dayLabel ? `<span class="mapp-rs">${esc(c.dayLabel)}</span>` : ''}
      </span>
      <span class="rd-flag">${isDone ? '已读完' : '未开始'}</span>
    </div>`;
  }).join('');

  return `<div class="mapp">
    <div class="rd-head">
      <b>阅读记录</b>
      <i>${done.size} 章已读完</i>
    </div>
    <div class="mapp-card">${rows || '<p class="mapp-empty">还没有读过任何一章。</p>'}</div>
    <p class="mapp-foot">这里只记你走过的地方，不记你选了什么。</p>
  </div>`;
}

export { esc as escapeApp };

/* =========================================================
   更新日志（从「软件更新」里点进去的那一层）
   ========================================================= */
export function changelogAppHTML() {
  const body = MINTOS_LOG.map(v => `
    <div class="lg-ver">
      <div class="lg-head"><b>${esc(v.version)}</b><i>${esc(v.date)}</i></div>
      ${v.intro ? `<p class="lg-intro">${esc(v.intro)}</p>` : ''}
      ${(v.items || []).map(t => `<div class="lg-item">
        <span class="lg-tag fix">改动</span><span>${esc(t)}</span>
      </div>`).join('')}
    </div>`).join('');

  return `<div class="mapp">
    ${body}
    <p class="mapp-foot">MintOS 系统更新由厂商与学校信息中心联合推送。<br>本机型号 ${DEVICE.model}。</p>
  </div>`;
}


/* =========================================================
   应用商店
   ---------------------------------------------------------
   第一页是「待安装」：空着，写「空空如也」。
   第二页才是「已安装」：列的是手机上真有的应用，点开就进去。
   ========================================================= */
export function storeAppHTML(apps) {
  const list = Array.isArray(apps) ? apps : [];
  const rows = list.map(a => `
    <button class="st-row" data-open-app="${a.id}">
      <span class="st-ico"><img src="${mintIcon(a.icon)}" alt=""></span>
      <span class="st-t"><b>${esc(a.name)}</b><i>已安装 · MintOS 4</i></span>
      <span class="st-btn">打开</span>
    </button>`).join('');

  return `<div class="mapp">
    <div class="st-tabs">
      <button class="st-tab on" data-st-tab="pending">待安装</button>
      <button class="st-tab" data-st-tab="installed">已安装<i>${list.length}</i></button>
    </div>
    <div data-st-pane="pending">
      <div class="mapp-card">
        <div class="st-empty">
          <span class="st-empty-ico"></span>
          <b>空空如也</b>
          <i>校内镜像站暂时没有可安装的包。</i>
        </div>
      </div>
    </div>
    <div data-st-pane="installed" hidden>
      <div class="mapp-card">${rows}</div>
    </div>
    <p class="mapp-foot">应用来源：Mint 应用商店 · 校内镜像站。<br>未通过签名校验的安装包无法装进 ${DEVICE.model}。</p>
  </div>`;
}

export function bindStore(root) {
  const tabs = root.querySelectorAll('[data-st-tab]');
  const panes = root.querySelectorAll('[data-st-pane]');
  tabs.forEach(t => t.addEventListener('click', () => {
    const k = t.dataset.stTab;
    tabs.forEach(x => x.classList.toggle('on', x === t));
    panes.forEach(p => { p.hidden = p.dataset.stPane !== k; });
  }));
}

/* =========================================================
   相机
   ---------------------------------------------------------
   取景框直接拿当前场景的背景图。按快门只做一次补光闪白，
   底片缩略图换成刚拍的那一张——不会真的存文件，也不上传。
   ========================================================= */
export function cameraAppHTML(bg) {
  const shot = bg ? ` style="background-image:url('${bg}')"` : '';
  return `<div class="mapp mapp-cam">
    <div class="cam-view" id="camView"${shot}>
      <span class="cam-grid"></span>
      <span class="cam-badge" id="camBadge">方框 · 1×</span>
    </div>
    <div class="cam-bar">
      <span class="cam-thumb" id="camThumb"${shot}></span>
      <button class="cam-shot" id="camShot" aria-label="快门"></button>
      <button class="cam-flip" id="camFlip" aria-label="切换镜头">⟳</button>
    </div>
    <p class="mapp-foot">照片只留在本机相册，不会上传。<br>拍别人之前，先问一句。</p>
  </div>`;
}

export function bindCamera(root) {
  const view = root.querySelector('#camView');
  const badge = root.querySelector('#camBadge');
  const thumb = root.querySelector('#camThumb');
  const shot = root.querySelector('#camShot');
  const flip = root.querySelector('#camFlip');
  const baseBadge = badge ? badge.textContent : '';
  let zoom = 1;
  let timer = 0;

  if (shot && view) {
    shot.addEventListener('click', () => {
      view.classList.add('is-shot');
      setTimeout(() => view.classList.remove('is-shot'), 130);
      if (thumb && view.style.backgroundImage) thumb.style.backgroundImage = view.style.backgroundImage;
      if (badge) {
        badge.textContent = '已保存到相册';
        clearTimeout(timer);
        timer = setTimeout(() => { badge.textContent = baseBadge; }, 1600);
      }
    });
  }

  if (flip && badge) {
    flip.addEventListener('click', () => {
      zoom = zoom === 1 ? 2 : 1;
      badge.textContent = `方框 · ${zoom}×`;
    });
  }
}

/* =========================================================
   时钟：真实时间 + 秒表
   ========================================================= */
export function clockAppHTML() {
  return `<div class="mapp">
    <div class="clk-now">
      <b id="clkNow">--:--</b>
      <i id="clkDate">正在对时</i>
    </div>
    <div class="mapp-card">
      <div class="clk-sec"><span>秒表</span><b class="clk-val" id="swVal">00:00.0</b></div>
      <div class="clk-btns">
        <button class="btn-line" id="swReset">归零</button>
        <button class="btn-solid" id="swStart">开始</button>
      </div>
    </div>
    <p class="mapp-foot">时间跟随本机，不跟随剧情。<br>闹钟已静音——今天不必早起。</p>
  </div>`;
}

let _clkTick = 0;
export function bindClock(root) {
  const now = root.querySelector('#clkNow');
  const date = root.querySelector('#clkDate');
  const val = root.querySelector('#swVal');
  const startBtn = root.querySelector('#swStart');
  const resetBtn = root.querySelector('#swReset');
  const pad = n => String(n).padStart(2, '0');
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  const paintNow = () => {
    const d = new Date();
    if (now) now.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (date) date.textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${WEEK[d.getDay()]}`;
  };
  paintNow();

  clearInterval(_clkTick);
  _clkTick = setInterval(() => {
    if (!root.isConnected) { clearInterval(_clkTick); return; }
    paintNow();
  }, 1000);

  /* 秒表 */
  let base = 0, from = 0, raf = 0, running = false;
  const fmt = ms => {
    const t = Math.max(0, ms);
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const d = Math.floor((t % 1000) / 100);
    return `${pad(m)}:${pad(s)}.${d}`;
  };
  const loop = () => {
    if (!running) return;
    if (val) val.textContent = fmt(base + (performance.now() - from));
    raf = requestAnimationFrame(loop);
  };
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      running = !running;
      startBtn.textContent = running ? '暂停' : '继续';
      if (running) { from = performance.now(); loop(); }
      else { base += performance.now() - from; cancelAnimationFrame(raf); }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      running = false;
      base = 0;
      cancelAnimationFrame(raf);
      if (startBtn) startBtn.textContent = '开始';
      if (val) val.textContent = '00:00.0';
    });
  }
}

/* =========================================================
   天气（虚构城市，别对号入座）
   ========================================================= */
export function weatherAppHTML() {
  const days = [
    ['今天', '多云转晴', 26, 18],
    ['明天', '阴 · 短时阵雨', 23, 17],
    ['周三', '晴', 27, 19],
    ['周四', '晴', 29, 20],
    ['周五', '多云', 28, 21]
  ].map((d, i) => `<div class="wx-day ${i === 0 ? 'is-today' : ''}">
      <span class="wx-d">${d[0]}</span>
      <span class="wx-w">${d[1]}</span>
      <span class="wx-t"><b>${d[2]}°</b><i>${d[3]}°</i></span>
    </div>`).join('');

  return `<div class="mapp">
    <div class="wx-hero">
      <p class="wx-city">薄荷市 · 薄荷中学</p>
      <p class="wx-temp">26<span>°</span></p>
      <p class="wx-cond">多云转晴 · 东南风 2 级</p>
      <p class="wx-tip">夜里会降温，外套带一件。</p>
    </div>
    <div class="mapp-card">${days}</div>
    <p class="mapp-foot">数据由本机模拟生成，仅供剧情参考。</p>
  </div>`;
}

/* =========================================================
   音乐播放器：列的是游戏里真有的 BGM，点了真的换
   ========================================================= */
export function musicAppHTML(tracks, currentId) {
  const list = Array.isArray(tracks) ? tracks : [];
  const rows = list.map((t, i) => {
    const on = t.id === currentId;
    return `<button class="mu-row ${on ? 'is-on' : ''}" data-track="${t.id}">
      <span class="mu-no">${String(i + 1).padStart(2, '0')}</span>
      <span class="mu-t"><b>${esc(t.label || t.id)}</b><i>MintOS 原声</i></span>
      ${on ? '<span class="mu-playing"><i></i><i></i><i></i></span>' : ''}
    </button>`;
  }).join('');

  return `<div class="mapp">
    <div class="mu-now">
      <div class="mu-cover"><span>♫</span></div>
      <b id="muTitle">未在播放</b>
      <i id="muSub">未在播放</i>
      <div class="mu-ctrl">
        <button class="mu-btn" data-mu="prev" aria-label="上一首">◀◀</button>
        <button class="mu-btn mu-main" id="muToggle" data-mu="toggle" aria-label="播放">▶</button>
        <button class="mu-btn" data-mu="next" aria-label="下一首">▶▶</button>
      </div>
    </div>
    <div class="mapp-card">${rows || '<p class="mapp-empty">本机没有曲目。</p>'}</div>
    <p class="mapp-foot">共 ${list.length} 首 · 时长约一分钟，循环播放。<br>关掉手机，音乐不会停。</p>
  </div>`;
}

/* =========================================================
   文件管理
   ========================================================= */
const FILES = [
  { kind: 'doc', name: '高一（3）班 座位表.pdf', meta: '学校 · 今早 07:12 · 218 KB' },
  { kind: 'doc', name: '军训日程安排.docx', meta: '学校 · 昨天 · 96 KB' },
  { kind: 'img', name: 'IMG_0913_操场.jpg', meta: '相机 · 昨天 · 2.4 MB' },
  { kind: 'img', name: 'IMG_0921_走廊.jpg', meta: '相机 · 昨天 · 1.8 MB' },
  { kind: 'aud', name: '广播站_试音.m4a', meta: '录音 · 3 天前 · 5.1 MB' },
  { kind: 'zip', name: '材料备份_0901.zip', meta: '本机 · 9 月 1 日 · 12.6 MB' },
  { kind: 'doc', name: '转学申请表_空表.pdf', meta: '教务处 · 9 月 1 日 · 340 KB' }
];
const KIND = { doc: '📄', img: '🖼', aud: '🎧', zip: '🗜' };
const KIND_NAME = { all: '全部', doc: '文档', img: '图片', aud: '音频', zip: '压缩包' };

export function filesAppHTML() {
  const chips = Object.keys(KIND_NAME).map((k, i) =>
    `<button class="fl-chip ${i === 0 ? 'on' : ''}" data-fl="${k}">${KIND_NAME[k]}</button>`).join('');
  const rows = FILES.map(f => `<div class="fl-row" data-kind="${f.kind}">
      <span class="fl-ico">${KIND[f.kind] || '📄'}</span>
      <span class="fl-t"><b>${esc(f.name)}</b><i>${esc(f.meta)}</i></span>
    </div>`).join('');

  return `<div class="mapp">
    <div class="fl-chips">${chips}</div>
    <div class="mapp-card" data-fl-list>${rows}</div>
    <p class="mapp-foot">本机 128 GB · 已用 41.2 GB。<br>云端同步已由学校关闭。</p>
  </div>`;
}

export function bindFiles(root) {
  const chips = root.querySelectorAll('[data-fl]');
  const rows = root.querySelectorAll('[data-kind]');
  chips.forEach(c => c.addEventListener('click', () => {
    const k = c.dataset.fl;
    chips.forEach(x => x.classList.toggle('on', x === c));
    rows.forEach(r => { r.style.display = (k === 'all' || r.dataset.kind === k) ? '' : 'none'; });
  }));
}
