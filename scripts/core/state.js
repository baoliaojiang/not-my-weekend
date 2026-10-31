/* =========================================================
   游戏状态
   ---------------------------------------------------------
   · 主线进度（章节 / 节点）
   · 玩家可见数据：材料、聊天记录、选择历史、行动点
   · 隐藏数据：人物的信任 / 压力 / 立场（不显示数值，只给质性描述）
   ========================================================= */

import { CONFIG } from '../config/game.js';

export function createState() {
  return {
    chapterId: 'ch0',
    index: 0,
    dayLabel: '九月一日 · 周一',
    ap: CONFIG.actionPoints,
    apMax: CONFIG.actionPoints,
    flags: {},
    stats: {
      shen: { trust: 40, pressure: 55, stance: 'unclear' },
      zhou: { trust: 35, pressure: 30, stance: 'support' },
      chen: { trust: 40, pressure: 60, stance: 'unclear' },
      luo: { trust: 30, pressure: 20, stance: 'neutral' },
      he: { trust: 25, pressure: 70, stance: 'resist' }
    },
    materials: [],     // 材料 id 数组（按获得顺序）
    chats: [],         // 聊天消息 {thread, from, text, me, day}
    choices: [],       // 选择历史 {chapter, q, a}
    visits: {},        // 调查行动执行次数 {actionId: n}
    chaptersDone: [],
    notes: [],          // 整理材料时生成的笔记
    log: [],            // 对话历史（上限 240 条）
    hubActive: false,   // 是否处于调查章节（控制行动点条显示）
    gov: null,          // 在政务平台上提交过的反映 {no,time,types,desc,claims,replied}
    quizzes: {}         // 课堂小测成绩 {quizId: {right,total}}
  };
}

/* ---------------- 材料 ---------------- */
export function addMaterial(state, id) {
  if (!id || state.materials.includes(id)) return false;
  state.materials.push(id);
  return true;
}

export function hasMaterial(state, id) {
  return state.materials.includes(id);
}

/* ---------------- 标记 ---------------- */
export function setFlag(state, key, value = true) {
  state.flags[key] = value;
}

export function getFlag(state, key) {
  return state.flags[key];
}

/* ---------------- 隐藏数值 ---------------- */
export function addStat(state, who, delta = {}) {
  const s = state.stats[who];
  if (!s) return;
  if (typeof delta.trust === 'number') s.trust = clamp(s.trust + delta.trust, 0, 100);
  if (typeof delta.pressure === 'number') s.pressure = clamp(s.pressure + delta.pressure, 0, 100);
  if (delta.stance) s.stance = delta.stance;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ---------------- 质性描述（给人物档案用，不暴露数字） ---------------- */
export function describeTrust(v) {
  if (v >= 75) return '她愿意把话说完整';
  if (v >= 55) return '还算谈得来';
  if (v >= 35) return '客气，但留着距离';
  if (v >= 18) return '有所回避';
  return '几乎不开口';
}

export function describePressure(v) {
  if (v >= 78) return '绷得很紧';
  if (v >= 58) return '有些东西压在肩上';
  if (v >= 38) return '看起来还算平常';
  return '松下来了';
}

export const STANCE_TEXT = {
  support: '支持活动',
  neutral: '没有明确表态',
  resist: '不想参加',
  unclear: '看不出来',
  unknown: '尚不清楚'
};

/* ---------------- 行动点 ---------------- */
export function resetAP(state, n = CONFIG.actionPoints) {
  state.ap = n;
  state.apMax = n;
}

export function spendAP(state, n = 1) {
  if (state.ap < n) return false;
  state.ap -= n;
  return true;
}

/* ---------------- 选择记录 ---------------- */
export function recordChoice(state, chapter, q, a) {
  state.choices.push({ chapter, q, a, ts: Date.now() });
}

/* ---------------- 序列化 ---------------- */
export function serialize(state) {
  return JSON.parse(JSON.stringify(state));
}

export function hydrate(data) {
  const base = createState();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    stats: { ...base.stats, ...(data.stats || {}) },
    flags: { ...(data.flags || {}) },
    materials: Array.isArray(data.materials) ? data.materials.slice() : [],
    chats: Array.isArray(data.chats) ? data.chats.slice() : [],
    choices: Array.isArray(data.choices) ? data.choices.slice() : [],
    visits: { ...(data.visits || {}) },
    chaptersDone: Array.isArray(data.chaptersDone) ? data.chaptersDone.slice() : [],
    notes: Array.isArray(data.notes) ? data.notes.slice() : []
  };
}
