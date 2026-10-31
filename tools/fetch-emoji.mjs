/* =========================================================
   抓取苹果 emoji 小图，落到 assets/emoji/
   ---------------------------------------------------------
   游戏里的 emoji 是"跟着文字走"的小图，不是表情包。
   以前直接用系统字形，在 Windows / 安卓上会变成另外一套画风，
   所以这里预抓一份苹果版本，离线可用、跨平台一致。

   用法：node tools/fetch-emoji.mjs [--force]
     · 已存在的文件会跳过（除非 --force）
     · 抓完顺手生成 scripts/ui/emoji-map.js（字符 → 相对路径）
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets/emoji');
const MAP_FILE = path.join(ROOT, 'scripts/ui/emoji-map.js');
const FORCE = process.argv.includes('--force');
const SRC = (e) => `https://emojicdn.elk.sh/${encodeURIComponent(e)}?style=apple`;

/* 日常聊天里真会用到的那一批。刻意只收常用脸 + 少量手势/物件/天气，
   太多了游戏体积受不了，生僻的让系统字体兜底就行。 */
const EMOJI = [
  // 笑脸
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😲', '🥺',
  '😢', '😭', '😤', '😠', '😡', '🤯', '😳', '😱', '😨', '😰',
  '😥', '😓', '😔', '😞', '😟', '😕', '🙁', '☹️', '😣', '😖',
  '😫', '😩', '🥱', '😴', '😪', '😵', '🤐', '🥴', '🤢', '🤧',
  '😷', '🤒', '🤕', '🥳', '😎', '🤓', '🧐', '😕', '🫠', '🫡',
  // 手势与身体
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👋', '🙏', '🤝',
  '👏', '🙌', '💪', '🫶', '👀', '🧠', '❤️', '💔', '💜', '💙',
  '💚', '💛', '🧡', '🤍', '💕', '💞', '💗', '💯',
  // 自然
  '🌿', '🌱', '🍃', '🌸', '🌷', '🌻', '🌙', '☀️', '⛅', '☁️',
  '🌧️', '⛈️', '🌈', '❄️', '⭐', '✨', '🌊', '🔥',
  // 吃喝
  '☕', '🍵', '🥤', '🧋', '🍜', '🍚', '🍞', '🍎', '🍊', '🍰',
  '🍫', '🍬', '🥟', '🍺',
  // 物件
  '📄', '📱', '💻', '📚', '✏️', '🎧', '🎵', '🎮', '⏰', '🕐',
  '🔔', '💡', '🔍', '📎', '📝', '📌', '🗂️', '🖼️', '🎒', '🗜️',
  // 符号
  '✅', '❌', '❗', '❓', '💤', '💬', '💭', '🎉', '🎈', '🕯️',
  '☺️', '😺', '🐱', '🐶', '🌚', '🌝'
];

const codeName = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).join('-');

async function grab(e, attempt = 1) {
  const file = path.join(OUT_DIR, `${codeName(e)}.png`);
  if (!FORCE && fs.existsSync(file) && fs.statSync(file).size > 500) return { e, file, cached: true };
  try {
    const res = await fetch(SRC(e), { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('不是 PNG');
    fs.writeFileSync(file, buf);
    return { e, file, cached: false, size: buf.length };
  } catch (err) {
    if (attempt >= 3) return { e, error: err.message };
    await new Promise((r) => setTimeout(r, 400 * attempt));
    return grab(e, attempt + 1);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// 去重（上面列表里有重复项，比如 😕 写了两次）
const list = [...new Set(EMOJI)];
const results = [];
let i = 0;
const CONCURRENCY = 4;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (i < list.length) {
      const e = list[i++];
      const r = await grab(e);
      results.push(r);
      if (r.error) console.log(`  ✗ ${e}  ${r.error}`);
    }
  })
);

const ok = results.filter((r) => !r.error);
const failed = results.filter((r) => r.error);

/* 生成映射表。用字面量字符做 key，运行时按字符查，不经过任何编码转换 */
const entries = ok
  .slice()
  .sort((a, b) => codeName(a.e).localeCompare(codeName(b.e)))
  .map((r) => `  '${r.e}': 'assets/emoji/${path.basename(r.file)}'`)
  .join(',\n');

fs.writeFileSync(
  MAP_FILE,
  `/* 自动生成，请勿手改 —— 见 tools/fetch-emoji.mjs
   字符 → 苹果 emoji 小图。表里没有的字符，emoji.js 会退回系统字形。 */
export const EMOJI_IMG = {
${entries}
};
`
);

const bytes = ok.reduce((s, r) => s + (r.size || fs.statSync(r.file).size), 0);
console.log(`\n完成：${ok.length} 张（新下载 ${ok.filter((r) => !r.cached).length}），合计 ${(bytes / 1024 / 1024).toFixed(2)} MB`);
if (failed.length) console.log(`失败 ${failed.length} 个：${failed.map((f) => f.e).join(' ')}`);
console.log(`映射表：${path.relative(ROOT, MAP_FILE)}`);
