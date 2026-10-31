/* 统计各章正文字数（按 300 字/分钟折算阅读时长）
   用法：node tools/story-stats.mjs
   统计口径：narr / say / chatmsg / chatreply 的 msgs / choice 的 options，
   以及 hubActions 的 script 与 hubEvents 的 script；
   同一章内完全相同的一句只算一次（避免分支复读把字数灌水）。 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../scripts/data');
const MODS = ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'side1', 'side2', 'side3'];

let count = 0;
const seen = new Set();

function bump(text) {
  if (!text) return;
  if (seen.has(text)) return;
  seen.add(text);
  count += text.length;
}

function walk(nodes) {
  for (const n of nodes || []) {
    bump(n.text);
    if (n.name && n.t === 'label') bump(n.name);
    if (n.msgs) for (const m of n.msgs) bump(m.text);
    if (n.options) for (const o of n.options) bump(o.text);
    if (n.prompt) bump(n.prompt);
    if (n.nodes) walk(n.nodes);
    if (n.script) walk(n.script);
    if (n.then) walk(n.then);
    if (n.else) walk(n.else);
    if (n.events) for (const e of n.events) walk(e.nodes || e.script || []);
  }
}

let total = 0;
for (const m of MODS) {
  const mod = await import(new URL(`file:///${dataDir.replace(/\\/g, '/')}/${m}.js`).href);
  const d = mod.default;
  seen.clear();
  count = 0;
  walk(d.nodes);
  for (const a of d.hubActions || []) walk(a.nodes || a.script || []);
  for (const e of d.hubEvents || []) walk(e.nodes || e.script || []);
  total += count;
  console.log(`${m.padEnd(6)} ${String(count).padStart(6)} 字   约 ${(count / 300).toFixed(1)} 分钟`);
}
console.log(`合计   ${String(total).padStart(6)} 字   约 ${(total / 300).toFixed(1)} 分钟`);
