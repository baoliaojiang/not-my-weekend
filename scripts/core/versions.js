/* =========================================================
   版本清单：可用的历史版本 + 切换 / 回滚
   ---------------------------------------------------------
   version.json 只说明"现在最新是多少"，玩家没法自己选版本。
   这里多维护一份 versions.json：

     {
       latest: "0.6.5.0",
       versions: [
         { v, date, shell, www, sha256, size, title, notes: [] }
       ]
     }

   www 可能是两种形式：
     · 相对名（"www-0.6.5.0.zip"）→ 相对取到清单的那个源解析
     · 完整 URL（GitHub Release 附件）→ 老版本的热更包不在 Pages 上，
       只能从 Release 下载

   切换版本的落地靠外壳已有的下载接口：
     · Electron：zbUpdate.download({ www, sha256 })
     · Android：ZBUpdate.download(JSON.stringify({ www, sha256 }))
   两者都是"下载 zip → 校验 → 解压替换资源目录 → 重启生效"，
   所以回滚和更新走的是同一条路，不用另写一套。
   ========================================================= */

import { CONFIG } from '../config/game.js';
import { compareVersion } from './update.js';

/* 取清单的三个源，和 version.json 用同一组，容错逻辑保持一致 */
function bases() {
  const u = CONFIG.update || {};
  const list = Array.isArray(u.baseUrls) && u.baseUrls.length
    ? u.baseUrls
    : (u.baseUrl ? [u.baseUrl] : ['./']);
  return list.map(x => (String(x).endsWith('/') ? x : x + '/'));
}

async function getJson(url, timeoutMs) {
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
 * 并发取各源的 versions.json，谁先回用谁。
 * 返回 { ok, versions, base, latest }；取不到就是 ok:false，不报错。
 */
export async function fetchVersions(timeoutMs) {
  const ms = timeoutMs || (CONFIG.update && CONFIG.update.timeoutMs) || 4000;
  const list = bases();
  const got = await Promise.race([
    Promise.all(list.map(async (b) => {
      const j = await getJson(b + 'versions.json', ms);
      return j && Array.isArray(j.versions) ? { j, b } : null;
    })),
    new Promise((r) => setTimeout(() => r(null), ms + 500))
  ]);
  const picked = Array.isArray(got) ? got.find(Boolean) : null;
  if (!picked) return { ok: false, versions: [], base: list[0] || './', latest: '' };
  return {
    ok: true,
    base: picked.b,
    latest: picked.j.latest || (picked.j.versions[0] || {}).v || '',
    versions: picked.j.versions.slice().sort((a, b) => compareVersion(b.v, a.v))
  };
}

/** 把条目的 www 变成能直接下载的绝对地址 */
export function resolveUrl(entry, base) {
  const w = String((entry && entry.www) || '');
  if (!w) return '';
  if (/^https?:\/\//i.test(w)) return w;
  const b = String(base || './');
  try { return new URL(w, b).href; } catch (e) { return w; }
}

/**
 * 切换到指定版本。
 * 有外壳（APK / EXE）→ 让外壳下载并替换资源，成功后提示重启。
 * 网页版没有外壳能换资源目录，只能提示玩家去下载对应版本的客户端。
 */
export async function switchVersion(entry, base) {
  const url = resolveUrl(entry, base);
  if (!url) return { ok: false, reason: 'no-url' };

  const remote = {
    www: url,
    sha256: (entry && entry.sha256) || '',
    content: (entry && entry.v) || '',
    shell: (entry && entry.shell) || ''
  };

  // Android
  if (window.ZBUpdate && typeof window.ZBUpdate.download === 'function') {
    try {
      return await new Promise((resolve) => {
        window.__ZB_update_done = (json) => {
          delete window.__ZB_update_done;
          try { resolve(JSON.parse(json)); } catch (e) { resolve({ ok: false }); }
        };
        window.ZBUpdate.download(JSON.stringify(remote));
        setTimeout(() => {
          if (window.__ZB_update_done) {
            delete window.__ZB_update_done;
            resolve({ ok: false, reason: 'timeout' });
          }
        }, 120000);
      });
    } catch (e) { return { ok: false, reason: 'bridge-error' }; }
  }

  // Electron
  if (window.zbUpdate && typeof window.zbUpdate.download === 'function') {
    try { return await window.zbUpdate.download(remote); } catch (e) { return { ok: false, reason: 'exception' }; }
  }

  // 网页版：没有能替换资源目录的外壳，如实说明，不假装成功
  return { ok: false, reason: 'no-shell' };
}

/** 这个版本是不是比当前的还新（往前看） */
export function isNewerThan(entry, current) {
  return compareVersion((entry && entry.v) || '0', current || '0') > 0;
}
