/* =========================================================
   正文里的 emoji
   ---------------------------------------------------------
   和"表情包"是两件事：
     · 表情包（assets/ai/*.png）是一条独立消息，整张发出去；
     · emoji 是跟着文字走的，嵌在句子里。
   这里的 emoji 不预置图片，直接用系统字形——
   在 iPhone / Mac 上就是苹果那套，在 Windows 上退到 Segoe，
   在安卓上退到 Noto，不会出现"方框"。
   ========================================================= */

/* 覆盖常见表情与符号。刻意不匹配数字、#、* 这类，
   免得把「1# 楼」或者「3:00」拆成表情。 */
const EMO_RE = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;

export function hasEmoji(text) {
  return EMO_RE.test(String(text || ''));
}

/** 把 emoji 包一层 span，好在样式里单独控制大小与基线 */
export function emojiHTML(text) {
  const s = String(text == null ? '' : text);
  if (!s) return '';
  return s.split(EMO_RE).map((part, i) => {
    if (i % 2 === 1) return `<span class="emo">${part}</span>`;
    return esc(part);
  }).join('');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
