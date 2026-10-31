/* 给剧情补音乐：按「换背景 = 换场景」自动插 music 节点。
 *
 * 原来的问题是全篇只有 11 处 music，第二章开始几乎一路放着同一首，
 * 教室、办公室、下雨的走廊、医务室全是同一个调子。
 *
 * 规则（保守，不抢作者写好的 cue）：
 *   1. 只在 bg 换到一个**不同的**场景时看一次；
 *   2. 后面 8 行内已经有 music 节点 → 作者有意为之，跳过；
 *   3. 映射出来的曲子如果就是当前正在放的 → 不重复插。
 *
 * 用法：node tools/bind-music.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'scripts', 'data');

/* 场景 → 曲子。一个场景一首，情绪由章节自己的 music 决定。 */
const MAP = {
  classroom: 'classroom',
  corridor: 'hall',
  bedroom: 'home',
  infirmary: 'calm',
  gate: 'city',
  shop: 'canteen',
  canteen: 'canteen',
  auditorium: 'hall'
};

/* 场面中立、只表示"在放点什么"的那几首。同一个场景反复用它们，
   听感就是全篇一个调子（实测 calm2 出现 75 次、daily 62 次、calm 48 次）。
   场景有自己的曲子时，把它们换掉；tense / hope / silent 这类有明确
   情绪指向的不动。 */
const GENERIC = new Set(['daily', 'calm2', 'calm', 'room']);

/* 但 calm 在教室里往往意味着"安静下来的紧张"，不能一律换成教室日常。 */
const KEEP = { classroom: new Set(['calm']) };

const FILES = ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6',
  'side1', 'side2', 'side3', 'side4', 'side5']
  .map(n => `${n}.js`);

const dry = process.argv.includes('--dry');
let totalAdded = 0;
let replacedCount = 0;

for (const f of FILES) {
  const file = path.join(DATA, f);
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  // 章节自带的音乐 = 开场的曲子
  let cur = null;
  const m0 = lines.find(l => /^\s*music:\s*'/.test(l));
  if (m0) cur = m0.match(/music:\s*'([^']+)'/)[1];

  const out = [];
  let lastBg = null;
  let added = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    const bg = line.match(/\{\s*t:\s*'bg',\s*id:\s*'([^']+)'/);
    if (bg) {
      const id = bg[1];
      if (id === lastBg) continue;
      lastBg = id;

      // 紧跟着的那条 cue 如果是"放在哪都行"的曲子，换成这个场景的。
      // 这一步必须在 authored 判断之前：那种 cue 本来就"有音乐"，
      // 先判断就会被当成作者有意为之、直接跳过。
      let replaced = false;
      const want0 = MAP[id];
      if (want0) {
        for (let k = 1; k <= 3 && i + k < lines.length; k++) {
          const mm = lines[i + k].match(/\{\s*t:\s*'music',\s*id:\s*'([^']+)'/);
          if (!mm) continue;
          const keep = KEEP[id] && KEEP[id].has(mm[1]);
          if (!keep && GENERIC.has(mm[1]) && mm[1] !== want0) {
            lines[i + k] = lines[i + k].replace(`id: '${mm[1]}'`, `id: '${want0}'`);
            cur = want0;
            replaced = true;
            replacedCount++;
          }
          break;
        }
      }
      if (replaced) continue;

      // 后面 8 行内有作者写的 music → 不插
      let authored = false;
      for (let k = 1; k <= 8 && i + k < lines.length; k++) {
        if (/\{\s*t:\s*'music'/.test(lines[i + k])) { authored = true; break; }
      }
      if (authored) continue;

      const want = MAP[id];
      if (!want || want === cur) continue;

      const indent = (line.match(/^\s*/) || [''])[0];
      out.push(`${indent}{ t: 'music', id: '${want}' },`);
      cur = want;
      added++;
    }

    const mu = line.match(/\{\s*t:\s*'music',\s*id:\s*'([^']+)'/);
    if (mu) cur = mu[1];
  }

  if (added) {
    totalAdded += added;
    console.log(`${f}: +${added}`);
    if (!dry) fs.writeFileSync(file, out.join('\n'), 'utf8');
  }
}

console.log(dry ? `[dry] 新插入 ${totalAdded} 处，改写 ${replacedCount} 处` : `新插入 ${totalAdded} 处，改写 ${replacedCount} 处`);
