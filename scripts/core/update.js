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

function baseUrl() {
  const u = (CONFIG.update && CONFIG.update.baseUrl) || '';
  if (!u) return './';
  return u.endsWith('/') ? u : u + '/';
}

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
  const url = baseUrl() + 'version.json';
  const data = await fetchJson(url, CONFIG.update.timeoutMs || 8000);
  if (!data || !data.content) return { ok: false, kind: 'none' };

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
  try { absWww = new URL(data.www, baseUrl()).href; } catch (e) { /* 保留原值 */ }
  data.www = absWww;

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
  return { ok: false, reason: 'no-shell' };
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
