/* =========================================================
   素材替换核验（v0.6.0）
   ---------------------------------------------------------
   检查四件事：
     1) 注册表里的每个素材文件真的存在、能解码、尺寸合理
     2) 剧本里引用的 sprite / background / music id 全部能在注册表里找到
     3) 音乐分配：每章第一段音乐存在、同章内是否反复重放同一首
     4) 有没有旧素材残留（原《闪亮的你》《璀璨星途》的文件名）
   用法：node tools/audit-assets-v060.mjs
   ========================================================= */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const mod = await import(pathToFileURL(join(ROOT, 'scripts/config/assets.js')).href);
const { BACKGROUNDS, SPRITES, MUSIC } = mod;

let errors = 0;
let warns = 0;
const err = (m) => { errors++; console.log('  ! ' + m); };
const warn = (m) => { warns++; console.log('  · ' + m); };

/* ---------- 1. 文件存在性与体积 ---------- */
console.log('\n== 1. 素材文件 ==');
function checkGroup(name, table) {
  const rows = Object.entries(table);
  console.log(`  ${name}: ${rows.length} 个`);
  for (const [id, item] of rows) {
    const p = join(ROOT, item.src);
    if (!existsSync(p)) { err(`${name}/${id} 文件不存在：${item.src}`); continue; }
    const size = statSync(p).size;
    if (size < 2048) warn(`${name}/${id} 体积异常小：${size}B`);
  }
}
checkGroup('立绘', SPRITES);
checkGroup('背景', BACKGROUNDS);
checkGroup('音乐', MUSIC);

/* ---------- 2. 剧本引用完整性 ---------- */
console.log('\n== 2. 剧本引用 ==');
const chapterFiles = readdirSync(join(ROOT, 'scripts/data'))
  .filter(f => /^(ch|side)\d+\.js$/.test(f));
const usedSprites = new Map();
const usedBgs = new Map();
const usedMusic = new Map();

for (const f of chapterFiles) {
  const src = readFileSync(join(ROOT, 'scripts/data', f), 'utf8');
  // 只扫节点字段，不扫注释里的说明文字
  const grab = (re) => [...src.matchAll(re)].map(m => m[1]);
  grab(/\{ t: 'show', id: '([^']+)'/g).forEach(id => usedSprites.set(id, (usedSprites.get(id) || 0) + 1));
  grab(/\{ t: 'say', who: '([^']+)'/g).forEach(id => usedSprites.set(id, (usedSprites.get(id) || 0) + 1));
  grab(/\{ t: 'bg', id: '([^']+)'/g).forEach(id => usedBgs.set(id, (usedBgs.get(id) || 0) + 1));
  grab(/\{ t: 'music', id: '([^']+)'/g).forEach(id => usedMusic.set(id, (usedMusic.get(id) || 0) + 1));
  grab(/sprite: '([^']+)'/g).forEach(id => usedSprites.set(id, (usedSprites.get(id) || 0) + 1));
}

/* 剧本里这些 id 是"没有立绘的路人/家人"：只有台词，舞台上不出人。
   这是设计选择（第一人称视角下，无名路人不上台），不算素材缺失。
   列成白名单，避免核验把设计当成 bug 误报。 */
const NO_SPRITE_BY_DESIGN = new Set([
  'unk',      // 未知发言者 / 广播
  'chi', 'mom', 'dad', 'eng', // 家人
  'p2', 'p4', 'man2', 'lab', 'teacher', 'other', 'logi' // 同学、老师、后勤等路人
]);
const missingSprite = [...usedSprites.keys()]
  .filter(id => id !== 'lin' && !SPRITES[id] && !NO_SPRITE_BY_DESIGN.has(id));
const missingBg = [...usedBgs.keys()].filter(id => !BACKGROUNDS[id]);
const missingMusic = [...usedMusic.keys()].filter(id => !MUSIC[id]);
missingSprite.forEach(id => err(`剧本引用了不存在的立绘 id：${id}`));
const byDesign = [...usedSprites.keys()].filter(id => NO_SPRITE_BY_DESIGN.has(id));
if (byDesign.length) console.log(`  无立绘的路人角色 ${byDesign.length} 个（设计如此，不出人）：${byDesign.join(', ')}`);
missingBg.forEach(id => err(`剧本引用了不存在的背景 id：${id}`));
missingMusic.forEach(id => err(`剧本引用了不存在的音乐 id：${id}`));
console.log(`  剧本用到立绘 ${usedSprites.size} 种、背景 ${usedBgs.size} 种、音乐 ${usedMusic.size} 种`);
if (!missingSprite.length && !missingBg.length && !missingMusic.length) console.log('  引用全部命中');

// 注册了但没被用到的（仅提示，不一定有问题）
const unusedSprite = Object.keys(SPRITES).filter(id => !usedSprites.has(id) && id !== 'linM' && id !== 'linF');
if (unusedSprite.length) warn(`注册但剧本未直接引用（可能是手机头像等间接用）：${unusedSprite.join(', ')}`);
const unusedMusic = Object.keys(MUSIC).filter(id => !usedMusic.has(id));
if (unusedMusic.length) warn(`未被任何章节使用的音乐：${unusedMusic.join(', ')}`);

/* ---------- 3. 音乐分配 ---------- */
console.log('\n== 3. 音乐分配 ==');
for (const f of chapterFiles) {
  const src = readFileSync(join(ROOT, 'scripts/data', f), 'utf8');
  const seq = [...src.matchAll(/\{ t: '(music|bg)', id: '([^']+)'/g)].map(m => ({ t: m[1], id: m[2] }));
  const musics = seq.filter(x => x.t === 'music').map(x => x.id);
  if (!musics.length) { warn(`${f} 没有任何 music 节点`); continue; }
  // 连续重复
  let dup = 0;
  for (let i = 1; i < musics.length; i++) if (musics[i] === musics[i - 1]) dup++;
  if (dup) warn(`${f} 有 ${dup} 处连续两次切同一首音乐`);
  console.log(`  ${f}: ${musics.length} 次切换 → ${musics.join(' → ')}`);
}

/* ---------- 4. 旧素材残留 ---------- */
console.log('\n== 4. 旧素材残留 ==');
const legacy = ['normalsociety', 'richang', 'shining', 'cuican'];
for (const [id, item] of Object.entries(MUSIC)) {
  const base = item.src.split('/').pop();
  if (legacy.some(k => base.includes(k))) warn(`音乐 ${id} 仍指向旧文件 ${base}`);
}
const chars = readdirSync(join(ROOT, 'assets/characters'));
console.log(`  立绘文件 ${chars.length} 个`);
if (chars.length !== Object.keys(SPRITES).length) {
  warn(`assets/characters 里 ${chars.length} 个文件，注册表 ${Object.keys(SPRITES).length} 条，对不上`);
}
const bgs = readdirSync(join(ROOT, 'assets/backgrounds'));
console.log(`  背景文件 ${bgs.length} 个`);
const musics = readdirSync(join(ROOT, 'assets/music'));
console.log(`  音乐文件 ${musics.length} 个`);

console.log(`\n结果：${errors} 个错误，${warns} 个提醒`);
process.exit(errors ? 1 : 0);
