/* =========================================================
   正文里的 emoji
   ---------------------------------------------------------
   和"表情包"是两件事：
     · 表情包（assets/ai/*.png）是一条独立消息，整张发出去；
     · emoji 是跟着文字走的，嵌在句子里。

   图源是苹果那一套，已经离线抓进 assets/emoji/（见 tools/fetch-emoji.mjs），
   所以 Windows / 安卓上看到的也是同一张脸，不会各平台一个画风。
   映射表里没有的生僻字符退回系统字形，不会出现方框。
   ========================================================= */
import { EMOJI_IMG } from './emoji-map.js';

/* 覆盖常见表情与符号。刻意不匹配数字、#、* 这类，
   免得把「1# 楼」或者「3:00」拆成表情。 */
const EMO_RE = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;

export function hasEmoji(text) {
  return EMO_RE.test(String(text || ''));
}

/** 可发布的 emoji（表情面板用），顺序即映射表顺序 */
export const EMOJI_ALL = Object.keys(EMOJI_IMG);

/** 把 emoji 换成内联小图；表里没有的保留字形，包一层 span 好统一样式 */
export function emojiHTML(text) {
  const s = String(text == null ? '' : text);
  if (!s) return '';
  return s.split(EMO_RE).map((part, i) => {
    if (i % 2 !== 1) return esc(part);
    const src = EMOJI_IMG[part];
    if (src) return `<img class="emo" src="${src}" alt="${part}" draggable="false">`;
    return `<span class="emo">${part}</span>`;
  }).join('');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
