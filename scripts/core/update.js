/* =========================================================
   热更新：版本协商
   ---------------------------------------------------------
   两条独立的版本线：
     content（网页资源：剧情 / 立绘 / 背景 / 音乐 / 界面）→ 可热更
     shell  （客户端外壳：APK 的 Java、EXE 的 Electron）→ 只能重装

   流程：
     1. 读远端 version.json
     2. content 比我新 → 交给外壳去下载解压（网页自己无能为力，它跑在壳里）
     3. shell 低于 shellMin → 提示"必须更新客户端"
     4. 都没有 → 静默

   这个模块只做"判断 + 提示"，真正下载由各端外壳负责：
     · Android：ZBUpdate 桥（MainActivity 里的 UpdateManager）
     · Electron：主进程 window.zbUpdate
     · 网页版：没有外壳，直接提示去刷新 / 换新版本
   ========================================================= */

import { CONFIG } from '../config/game.js';

const CACHE_KEY = 'zb_update_last_check';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;   // 6 小时最多查一次，不打扰

/** 把 "0.6.10" 解析成可比较的数字数组，非数字段按 0 处理 */
export function parseVersion(v) {
  return String(v || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map(x => {
      const n = parseInt(x, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/** a > b 返正数，相等返 0，a < b 返负数（逐段比较） */
export function compareVersion(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}

/* 下载源列表。
   为什么不只写一个：raw.githubusercontent.com 在国内经常连不上，
   GitHub Pages 也有被墙的时段。所以按"国内可达优先"排三个源，
   逐个试，谁先回来用谁——玩家不需要知道背后发生了什么。
     1 jsDelivr   走 CDN，国内多数网络能开
     2 Pages      GitHub 自己的静态托管
     3 raw       最后兜底（海外直连最稳）
   配置里写 baseUrls 数组就用它；只写 baseUrl 就退化成单源。 */
function baseUrls() {
  const u = (CONFIG.update || {});
  if (Array.isArray(u.baseUrls) && u.baseUrls.length) {
    return u.baseUrls.map((x) => (String(x).endsWith('/') ? x : x + '/'));
  }
  if (!u.baseUrl) return ['./'];
  return [String(u.baseUrl).endsWith('/') ? u.baseUrl : u.baseUrl + '/'];
}

/** 兼容旧调用：取第一个源 */
function baseUrl() { return baseUrls()[0]; }

/** 当前客户端外壳版本：Android / Electron 会注入，网页版当作同版本 */
function shellVersion() {
  if (window.ZBUpdate && typeof window.ZBUpdate.shellVersion === 'function') {
    try { return String(window.ZBUpdate.shellVersion()); } catch (e) { /* 忽略 */ }
  }
  if (window.zbUpdate && window.zbUpdate.shellVersion) {
    return String(window.zbUpdate.shellVersion);
  }
  // 网页版：资源就是最新，外壳视为同版本，永远不需要"更新客户端"
  return CONFIG.version;
}

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* 三个源同时发，谁先回来用谁。
   ---------------------------------------------------------
   以前是串行 for 循环：每个源等满 timeoutMs 才轮到下一个，
   离线或被墙时 6s × 3 = 18s 全压在「检查更新」这一屏上，
   玩家看到的就是「检查更新一直超时」。
   并发之后总等待 ≈ 一个源的超时时间，最坏也有个硬闸兜底。 */
function raceVersion(bases, timeoutMs) {
  if (!bases.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    let pending = bases.length;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };
    // 硬闸：任何一路都没回、或者 deffered 卡在 DNS 上，也别拖过这个点
    const hard = setTimeout(() => done(null), timeoutMs + 500);
    for (const base of bases) {
      fetchJson(base + 'version.json', timeoutMs).then((got) => {
        pending--;
        if (settled) return;
        if (got && got.content) {
          clearTimeout(hard);
          done({ data: got, base });
          return;
        }
        if (pending === 0) { clearTimeout(hard); done(null); }
      }).catch(() => {
        pending--;
        if (!settled && pending === 0) { clearTimeout(hard); done(null); }
      });
    }
  });
}

/**
 * 检查更新。返回：
 *   { ok, kind: 'none'|'content'|'shell'|'both', remote, content, shell, shellMin, notes }
 * kind 说明：
 *   none    什么都没有
 *   content 有新的网页资源，可热更（交给外壳）
 *   shell   外壳太旧，必须更新客户端
 *   both    两样都要
 */
export async function checkUpdate() {
  if (!CONFIG.update || CONFIG.update.enabled === false) return { ok: false, kind: 'none' };

  /* 并发试各个源。第一个能解析出版本信息的就用它。
     全部失败就是"查不到"，不是"出错"——游戏照常进，不弹窗。 */
  const bases = baseUrls();
  const picked = await raceVersion(bases, CONFIG.update.timeoutMs || 4000);
  if (!picked) {
    // 记一次时间戳：接下来 6 小时不再反复等，免得每次都卡在这一屏
    markChecked();
    return { ok: false, kind: 'none' };
  }
  const data = picked.data;
  const usedBase = picked.base;

  const curContent = CONFIG.version;
  const curShell = shellVersion();
  const shellMin = data.shellMin || data.shell || '0.0.0';

  const contentNewer = compareVersion(data.content, curContent) > 0;
  const shellTooOld = compareVersion(curShell, shellMin) < 0;

  const kind = contentNewer && shellTooOld ? 'both'
    : contentNewer ? 'content'
      : shellTooOld ? 'shell'
        : 'none';

  /* www 在 version.json 里写的是相对路径（./www-0.6.0.zip）：
     Pages 部署时这样没问题，但 APK/EXE 的页面在 file:// 下，
     相对路径会指向本地不存在的文件。这里统一解析成绝对地址。 */
  let absWww = data.www || '';
  try { absWww = new URL(data.www, usedBase).href; } catch (e) { /* 保留原值 */ }
  data.www = absWww;
  data._base = usedBase;

  return {
    ok: true,
    kind,
    remote: data,
    content: data.content,
    shell: data.shell,
    shellMin,
    notes: data.notes || '',
    curContent,
    curShell
  };
}

/** 让外壳去下载并准备下次启动生效；返回外壳给的结果 */
export async function applyContentUpdate(remote) {
  // Android
  if (window.ZBUpdate && typeof window.ZBUpdate.download === 'function') {
    try {
      return await new Promise((resolve) => {
        window.__ZB_update_done = (json) => {
          delete window.__ZB_update_done;
          try { resolve(JSON.parse(json)); } catch (e) { resolve({ ok: false }); }
        };
        window.ZBUpdate.download(JSON.stringify(remote));
        // 下载可能很久，90 秒后当作超时（外壳那边还会继续，不影响下次启动）
        setTimeout(() => {
          if (window.__ZB_update_done) {
            delete window.__ZB_update_done;
            resolve({ ok: false, reason: 'timeout' });
          }
        }, 90000);
      });
    } catch (e) { return { ok: false, reason: 'bridge-error' }; }
  }
  // Electron
  if (window.zbUpdate && typeof window.zbUpdate.download === 'function') {
    try { return await window.zbUpdate.download(remote); } catch (e) { return { ok: false }; }
  }
  /* 网页版没有外壳可换，但它同样能"热更"：
     资源是静态文件，带上时间戳强刷一次就等于拿到了新版本。
     以前这里直接返回失败，网页玩家点「立即更新」只会看到一句
     "刷新页面即可"，等于让他自己动手——现在替他刷。 */
  try {
    const u = new URL(location.href);
    u.searchParams.set('v', String(Date.now()));
    setTimeout(() => location.replace(u.href), 240);
    return { ok: true, reason: 'web-reload' };
  } catch (e) {
    return { ok: false, reason: 'no-shell' };
  }
}

/** 必须在用户第一次点击之后才弹，否则 WebAudio 与 focus 都会被挡 */
export function shouldAutoCheck() {
  try {
    const last = Number(localStorage.getItem(CACHE_KEY) || 0);
    return Date.now() - last > CHECK_EVERY_MS;
  } catch (e) { return true; }
}

export function markChecked() {
  try { localStorage.setItem(CACHE_KEY, String(Date.now())); } catch (e) { /* 忽略 */ }
}
