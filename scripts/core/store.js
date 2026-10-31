/* =========================================================
   存储层：设置 / 已读节点 / 存档槽
   ---------------------------------------------------------
   全部基于 localStorage；若浏览器禁用存储（如某些 file:// 环境），
   自动退化为内存存储并给出提示，游戏仍可继续游玩。
   ========================================================= */

import { CONFIG } from '../config/game.js';

const memory = new Map();
let storageOK = true;

/* ---------------------------------------------------------
   原生容器存储桥（Android WebView 的 file:// 环境可能禁用 localStorage，
   由 MainActivity 注入 window.ZBStore）。存在时优先使用。
   --------------------------------------------------------- */
const nativeStore = (typeof window !== 'undefined' && window.ZBStore) ? window.ZBStore : null;

function rawGet(key) {
  if (nativeStore) {
    try {
      const v = nativeStore.get(key);
      return (v === null || v === undefined) ? null : String(v);
    } catch (e) { /* 落到 localStorage */ }
  }
  try {
    const v = window.localStorage.getItem(key);
    return v;
  } catch (e) {
    storageOK = false;
    return memory.has(key) ? memory.get(key) : null;
  }
}

function rawSet(key, value) {
  if (nativeStore) {
    try {
      nativeStore.set(key, String(value));
      return true;
    } catch (e) { /* 落到 localStorage */ }
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    storageOK = false;
    memory.set(key, value);
    return false;
  }
}

function rawRemove(key) {
  if (nativeStore) {
    try { nativeStore.remove(key); return; } catch (e) { /* ignore */ }
  }
  try { window.localStorage.removeItem(key); }
  catch (e) { memory.delete(key); }
}

function readJSON(key, fallback) {
  const raw = rawGet(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

export function storageAvailable() { return storageOK; }

/* ---------------- 设置 ---------------- */
export function loadSettings() {
  const saved = readJSON(CONFIG.keys.settings, {});
  return { ...CONFIG.defaultSettings, ...(saved || {}) };
}

/* 存档里原始的设置对象（未与默认值合并）。
   用于判断玩家是否亲手改过某一项——比如「画面方向」在安卓端
   要默认锁横屏，但玩家自己选过的值不能被覆盖掉。 */
export function rawSettings() {
  return readJSON(CONFIG.keys.settings, {}) || {};
}

export function saveSettings(settings) {
  rawSet(CONFIG.keys.settings, JSON.stringify(settings));
}

/* ---------------- 已读节点（跨存档共享） ---------------- */
let readSet = new Set(readJSON(CONFIG.keys.read, []));
let readDirty = false;

export function isRead(key) { return readSet.has(key); }

export function markRead(key) {
  if (!key || readSet.has(key)) return;
  readSet.add(key);
  readDirty = true;
}

export function flushRead() {
  if (!readDirty) return;
  readDirty = false;
  // 控制体积：只保留最近 6000 条
  let arr = Array.from(readSet);
  if (arr.length > 6000) {
    arr = arr.slice(arr.length - 6000);
    readSet = new Set(arr);
  }
  rawSet(CONFIG.keys.read, JSON.stringify(arr));
}

export function countRead() { return readSet.size; }

export function resetRead() {
  readSet = new Set();
  readDirty = true;
  flushRead();
}

/* ---------------- 一键清档 ----------------
   把所有 zbnx.* 的数据删掉，只留设置（设置里带着 AI 的地址、模型与 Key）。
   用前缀扫而不是逐个列 key：存档位、支线存档（zbnx.save.side.<id>.<slot>）、
   已读、章节进度、AI 会话都在这个前缀下面，以后新加的存储项也会被一起清掉，
   不会出现「清了档但某一块还在」的残留。
   原生桥（安卓）只能按键删，所以再把已知的键显式删一遍作兜底。 */
export function wipeAllData() {
  const keep = CONFIG.keys.settings;
  const removed = [];
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k && k.indexOf('zbnx.') === 0 && k !== keep) { ls.removeItem(k); removed.push(k); }
    }
  } catch (e) { /* 存储不可用，下面按已知键再删 */ }
  // 已知键显式删（覆盖原生桥与存储不可用时的内存副本）
  const known = [CONFIG.keys.save, CONFIG.keys.read, CONFIG.keys.progress, 'zbnx.ai.chats.v1'];
  for (let slot = 0; slot <= CONFIG.slots; slot++) known.push(`${CONFIG.keys.save}.${slot}`);
  known.forEach(k => {
    if (k === keep) return;
    if (removed.indexOf(k) < 0) { rawRemove(k); removed.push(k); }
  });
  readSet = new Set();
  readDirty = false;
  memory.forEach((_v, k) => { if (k !== keep) memory.delete(k); });
  return removed.length;
}

/* ---------------- 存档 ---------------- */
const slotKey = (slot) => `${CONFIG.keys.save}.${slot}`;

export function writeSlot(slot, payload) {
  return rawSet(slotKey(slot), JSON.stringify(payload));
}

export function readSlot(slot) {
  const data = readJSON(slotKey(slot), null);
  if (!data || typeof data !== 'object') return null;
  if (data.v !== 1) return null;
  return data;
}

export function clearSlot(slot) {
  rawRemove(slotKey(slot));
}

export function listSlots() {
  const out = [];
  for (let i = 0; i <= CONFIG.slots; i++) { // 0 = 自动存档
    out.push({ slot: i, auto: i === 0, data: readSlot(i) });
  }
  return out;
}

export function latestSlot() {
  let best = null;
  for (let i = 0; i <= CONFIG.slots; i++) {
    const d = readSlot(i);
    if (!d) continue;
    if (!best || (d.ts || 0) > (best.data.ts || 0)) best = { slot: i, data: d };
  }
  return best;
}

/* ---------------- 支线存档（与主线完全分开的一套槽位） ----------------
   支线的进度、材料、标记都和主线不是一回事，混在一个槽位里会互相顶掉：
   读一个支线存档回到主线，会把主线的行动点、人物关系一起改掉。
   所以支线各用各的命名空间：zbnx.save.side.<支线 id>.<槽位>。 */
const sideKey = (sideId, slot) => `${CONFIG.keys.save}.side.${sideId}.${slot}`;

export function writeSideSlot(sideId, slot, payload) {
  return rawSet(sideKey(sideId, slot), JSON.stringify(payload));
}

export function readSideSlot(sideId, slot) {
  const data = readJSON(sideKey(sideId, slot), null);
  if (!data || typeof data !== 'object') return null;
  if (data.v !== 1) return null;
  return data;
}

export function clearSideSlot(sideId, slot) {
  rawRemove(sideKey(sideId, slot));
}

export function listSideSlots(sideId) {
  const out = [];
  for (let i = 0; i <= CONFIG.slots; i++) {
    out.push({ slot: i, auto: i === 0, data: readSideSlot(sideId, i) });
  }
  return out;
}

export function latestSideSlot(sideId) {
  let best = null;
  for (let i = 0; i <= CONFIG.slots; i++) {
    const d = readSideSlot(sideId, i);
    if (!d) continue;
    if (!best || (d.ts || 0) > (best.data.ts || 0)) best = { slot: i, data: d };
  }
  return best;
}

/* ---------------- 跨存档进度 ----------------
   只记"发生过什么"，不记"当时怎么选的"：
   chapters —— 通关过的章节 id（用来解锁支线路口）
   sides    —— 每条支线的通关记录与最好结果 */
function emptyProgress() {
  return { v: 1, chapters: [], sides: {} };
}

export function loadProgress() {
  const p = readJSON(CONFIG.keys.progress, null);
  if (!p || typeof p !== 'object') return emptyProgress();
  return {
    v: 1,
    chapters: Array.isArray(p.chapters) ? p.chapters.slice() : [],
    sides: (p.sides && typeof p.sides === 'object') ? { ...p.sides } : {}
  };
}

export function saveProgress(p) {
  rawSet(CONFIG.keys.progress, JSON.stringify(p));
}

/** 记录一章通关。重复调用无副作用。 */
export function markChapterDone(id) {
  if (!id) return loadProgress();
  const p = loadProgress();
  if (!p.chapters.includes(id)) {
    p.chapters.push(id);
    saveProgress(p);
  }
  return p;
}

/**
 * 记录一次支线通关。
 * @param {string} sideId 支线 id
 * @param {{ending?:string, endingName?:string, kind?:string, hidden?:boolean}} result
 */
export function markSideDone(sideId, result = {}) {
  const p = loadProgress();
  const prev = p.sides[sideId] || { count: 0, endings: {} };
  const endings = { ...(prev.endings || {}) };
  if (result.ending) endings[result.ending] = (endings[result.ending] || 0) + 1;
  p.sides[sideId] = {
    count: (prev.count || 0) + 1,
    last: result.ending || prev.last || null,
    lastName: result.endingName || prev.lastName || null,
    lastKind: result.kind || prev.lastKind || null,
    hidden: !!(result.hidden || prev.hidden),
    ts: Date.now(),
    endings
  };
  saveProgress(p);
  return p;
}

export function sideProgress(sideId) {
  return loadProgress().sides[sideId] || null;
}

