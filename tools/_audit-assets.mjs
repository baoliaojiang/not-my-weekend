import fs from 'node:fs';
import path from 'node:path';
import { BACKGROUNDS, SPRITES, MUSIC } from '../scripts/config/assets.js';
import { CHARACTERS } from '../scripts/data/characters.js';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const files = ['ch0','ch1','ch2','ch3','ch4','ch5','ch6','side1','side2'];
const mods = {};
for (const f of files) mods[f] = (await import(`../scripts/data/${f}.js`)).default;

const bgUse = {}, musicUse = {}, showUse = {}, spriteUse = {};
function walk(arr, ch, cb) {
  for (const n of arr || []) {
    cb(n, ch);
    if (n.script) walk(n.script, ch, cb);
  }
}
for (const [ch, d] of Object.entries(mods)) {
  walk(d.nodes || [], ch, (n) => {
    if (n.t === 'bg' && n.id) (bgUse[n.id] ||= []).push(ch);
    if (n.t === 'music' && n.id) (musicUse[n.id] ||= []).push(ch);
    if (n.t === 'show' && n.who) (spriteUse[n.who] ||= []).push(ch);
  });
  for (const ev of d.hubEvents || []) {
    walk(ev.script || [], ch, (n) => {
      if (n.t === 'bg' && n.id) (bgUse[n.id] ||= []).push(ch);
      if (n.t === 'music' && n.id) (musicUse[n.id] ||= []).push(ch);
      if (n.t === 'show' && n.who) (spriteUse[n.who] ||= []).push(ch);
    });
  }
  for (const h of d.hubActions || []) {
    walk(h.script || [], ch, (n) => {
      if (n.t === 'bg' && n.id) (bgUse[n.id] ||= []).push(ch);
      if (n.t === 'music' && n.id) (musicUse[n.id] ||= []).push(ch);
      if (n.t === 'show' && n.who) (spriteUse[n.who] ||= []).push(ch);
    });
  }
}

const fileExists = (p) => fs.existsSync(path.join(ROOT, p));

console.log('=== 背景：注册 / 文件 / 引用次数 ===');
for (const [id, cfg] of Object.entries(BACKGROUNDS)) {
  const u = bgUse[id] || [];
  const uniq = [...new Set(u)];
  console.log(`${id.padEnd(12)} 文件${fileExists(cfg.src) ? '✓' : '✗缺失'} 引用${String(u.length).padStart(3)} 章节[${uniq.join(',')}]`);
}
const undefBg = Object.keys(bgUse).filter(k => !BACKGROUNDS[k]);
console.log('未注册但被引用:', undefBg.length ? undefBg.map(k => `${k}(x${bgUse[k].length})`).join(', ') : '无');

console.log('\n=== 音乐：引用次数 ===');
for (const [id, cfg] of Object.entries(MUSIC)) {
  const u = musicUse[id] || [];
  console.log(`${id.padEnd(13)} 文件${fileExists(cfg.src) ? '✓' : '✗缺失'} 引用${String(u.length).padStart(3)}`);
}
const undefM = Object.keys(musicUse).filter(k => !MUSIC[k]);
console.log('未注册但被引用:', undefM.length ? undefM.join(', ') : '无');

console.log('\n=== 立绘：角色 → 立绘 id → 引用次数 ===');
for (const [cid, c] of Object.entries(CHARACTERS)) {
  const sp = c.sprite;
  const cfg = SPRITES[sp];
  const u = spriteUse[cid] || spriteUse[sp] || [];
  console.log(`${cid.padEnd(8)} sprite=${String(sp).padEnd(8)} ${cfg ? (fileExists(cfg.src) ? '文件✓' : '文件✗') : '未注册✗'} 台词引用${u.length}`);
}
const spriteFiles = {};
for (const [id, cfg] of Object.entries(SPRITES)) spriteFiles[cfg.src] = (spriteFiles[cfg.src] || []).concat(id);
console.log('\n同一张图被多个 id 共用:', Object.entries(spriteFiles).filter(([, v]) => v.length > 1).map(([k, v]) => `${k} → ${v.join('/')}`));
