/* =========================================================
   运行日志
   ---------------------------------------------------------
   目的只有一个：玩家反馈问题时，能把"当时到底发生了什么"一起发过来。
   所以这里记三样东西：
     1 环境（UA、屏幕、WebView 版本、外壳版本、资源版本）
     2 运行事件（启动、更新检查结果、章节切换、存档读写、错误）
     3 错误（未捕获异常、未处理的 Promise 拒绝、console.error）

   三条设计约束：
     · 全部在内存里，不写文件、不联网——玩家不点导出，别人看不到。
     · 环形缓冲，只留最近 400 条，长时间游玩也不会把内存吃满。
     · 任何一步出问题都静默吞掉：日志模块自己绝不能把游戏搞崩。
   ========================================================= */

const MAX = 400;
const buf = [];
let installed = false;
let bootAt = Date.now();

/** 单条记录；字段短，方便对方一眼扫完 */
function push(level, msg, extra) {
  try {
    const t = new Date();
    const p = (n, w = 2) => String(n).padStart(w, '0');
    const ts = `${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}.${p(t.getMilliseconds(), 3)}`;
    let line = `[${ts}] ${level} ${msg}`;
    if (extra !== undefined) {
      try {
        const v = typeof extra === 'string' ? extra : JSON.stringify(extra);
        if (v && v !== '{}' && v !== 'null') line += ' ' + v.slice(0, 600);
      } catch (e) { /* 循环引用之类，忽略附加信息 */ }
    }
    buf.push(line);
    if (buf.length > MAX) buf.splice(0, buf.length - MAX);
  } catch (e) { /* 日志不能反过来报错 */ }
}

export const log = {
  info: (m, e) => push('INFO', m, e),
  warn: (m, e) => push('WARN', m, e),
  error: (m, e) => push('ERR ', m, e),
  /** 关键节点用：会和上一条之间插入空行，导出后好读 */
  mark: (m) => { buf.push(''); push('----', '> ' + m); }
};

/** 环境信息：出问题时最先要看的东西 */
function env() {
  const out = [];
  const add = (k, v) => out.push(`${k}: ${v}`);
  try {
    add('时间', new Date().toString());
    add('页面地址', location.href.replace(/[?#].*$/, ''));
    add('UA', navigator.userAgent);
    add('平台', `${navigator.platform || '-'} · 语言 ${navigator.language || '-'}`);
    add('屏幕', `${screen.width}x${screen.height} @${window.devicePixelRatio || 1}x · 视口 ${innerWidth}x${innerHeight}`);
    add('时区', Intl.DateTimeFormat().resolvedOptions().timeZone || '-');
    add('内存', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '未提供');
    add('CPU 核数', navigator.hardwareConcurrency || '未提供');
    add('在线', navigator.onLine ? '是' : '否');

    // WebView / 浏览器版本：安卓壳里最关键的一行
    const m = /Chrome\/(\d+)/.exec(navigator.userAgent);
    add('内核', m ? `Chromium ${m[1]}` : '非 Chromium');
    // 安卓壳注入的桥，有就是客户端
    add('客户端', (window.ZBApp ? 'Android 壳' : '') + (window.ZBUpdate ? ' +热更新桥' : '') || '网页版');
    if (window.ZBUpdate && typeof window.ZBUpdate.shellVersion === 'function') {
      try { add('外壳版本', window.ZBUpdate.shellVersion()); } catch (e) { /* 忽略 */ }
    }
    // 能力探测：这些直接影响画面与音频
    const can = [];
    try { can.push('webgl:' + (!!document.createElement('canvas').getContext('webgl') ? 'yes' : 'no')); } catch (e) { can.push('webgl:?'); }
    can.push('webaudio:' + (window.AudioContext || window.webkitAudioContext ? 'yes' : 'no'));
    can.push('fontapi:' + (document.fonts && document.fonts.ready ? 'yes' : 'no'));
    can.push('animate:' + (typeof Element !== 'undefined' && Element.prototype.animate ? 'yes' : 'no'));
    can.push('has:' + (window.CSS && CSS.supports && CSS.supports('selector(:has(*))') ? 'yes' : 'no'));
    add('能力', can.join(' '));
    add('兼容层', window.__COMPAT ? '已启用（兼容版 APK）' : '未启用');
    add('动效', document.body.classList.contains('motion-off') ? '已关闭' : '开启');
    add('屏幕方向', document.body.classList.contains('is-portrait') ? '竖屏' : '横屏');
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('zb_')) keys.push(k);
      }
      add('本地存储', keys.length ? keys.join(', ') : '空');
    } catch (e) { add('本地存储', '不可读'); }
  } catch (e) { /* 环境探测失败也要能导出 */ }
  return out.join('\n');
}

/** 挂上全局的错误捕获。只需装一次。 */
export function installLog() {
  if (installed) return;
  installed = true;
  bootAt = Date.now();
  log.mark('启动');

  // console.error / warn 一并留档：第三方脚本报错也跑不掉
  const wrap = (name, level) => {
    const orig = console[name];
    if (typeof orig !== 'function') return;
    console[name] = function (...args) {
      try {
        push(level, args.map((a) => {
          if (a instanceof Error) return a.message;
          if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return '[obj]'; } }
          return String(a);
        }).join(' '));
      } catch (e) { /* 忽略 */ }
      return orig.apply(console, args);
    };
  };
  wrap('error', 'ERR ');
  wrap('warn', 'WARN');

  window.addEventListener('error', (e) => {
    const where = e.filename ? ` @${String(e.filename).split('/').pop()}:${e.lineno}` : '';
    push('ERR ', '未捕获异常：' + (e.message || e.type) + where,
      e.error && e.error.stack ? e.error.stack.split('\n').slice(0, 3).join(' | ') : undefined);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    push('ERR ', '未处理的 Promise 拒绝：' + (r && r.message ? r.message : String(r)),
      r && r.stack ? r.stack.split('\n').slice(0, 3).join(' | ') : undefined);
  });
}

/** 导出成文本：前段是环境，后段是事件与错误 */
export function dumpLog() {
  const head = [
    '不属于我的周末 · 运行日志',
    '（这份文件由游戏内存中的日志导出，只包含运行状态，不包含任何个人信息）',
    '',
    '========== 环境 ==========',
    env(),
    '',
    '========== 事件 ==========',
    `本次会话已运行 ${Math.round((Date.now() - bootAt) / 1000)} 秒，记录 ${buf.length} 条`,
    ''
  ].join('\n');
  const body = buf.length ? buf.join('\n') : '（没有记录到事件）';
  const tail = '\n\n========== 反馈时请附上 ==========\n'
    + '1. 出问题时你在做什么（哪一章、点了哪个按钮）\n'
    + '2. 这份日志文件\n'
    + '3. 如果有截图更好\n';
  return head + body + tail;
}

/** 反馈面板里给一句最短的摘要，方便玩家直接复制 */
export function quickSummary() {
  const errs = buf.filter((l) => l.includes('] ERR ')).length;
  const warns = buf.filter((l) => l.includes('] WARN')).length;
  return `记录 ${buf.length} 条 · 错误 ${errs} · 警告 ${warns}`;
}

/* 模块加载即生效：这样后续任何模块初始化的报错都能被记下来 */
installLog();
