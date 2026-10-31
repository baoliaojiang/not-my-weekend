/* 把 7 首此前没接入的曲子按场景语义接进剧情 */
import fs from 'node:fs';
const P = (f) => 'scripts/data/' + f;
const edits = [
  // 1) 广播：校门口，喇叭里在放一首很旧的曲子
  ['ch0.js',
   "    { t: 'narr', text: '距离开学典礼还有半小时。广播里在放一首很旧的曲子，喇叭有点破，高音发毛，放两句就抖一下。' },",
   "    { t: 'narr', text: '距离开学典礼还有半小时。广播里在放一首很旧的曲子，喇叭有点破，高音发毛，放两句就抖一下。' },\n    { t: 'music', id: 'broadcast' },"],

  // 2) 操场：从走廊挤到操场，人群、太阳、发软的塑胶
  ['ch0.js',
   "    { t: 'narr', text: '操场是塑胶的，红色跑道，绿色草皮，被太阳晒得发软，踩上去有一点黏，抬脚的时候会带起一声轻响。' },",
   "    { t: 'music', id: 'playground' },\n    { t: 'narr', text: '操场是塑胶的，红色跑道，绿色草皮，被太阳晒得发软，踩上去有一点黏，抬脚的时候会带起一声轻响。' },"],

  // 3) 清晨：周六七点三十的校门口长队（原来的 daily 换成更亮的清晨）
  ['ch2.js',
   "    { t: 'bg', id: 'gate', place: '薄荷中学 · 校门口' },\n    { t: 'music', id: 'daily' },",
   "    { t: 'bg', id: 'gate', place: '薄荷中学 · 校门口' },\n    { t: 'music', id: 'morning' },"],

  // 4) 考试：发小测卷子的下午（低沉、稀疏，压住教室里的安静）
  ['ch4.js',
   "    { t: 'bg', id: 'classroom', place: '高一（2）班 · 教室 · 下午第一节课前' },\n    { t: 'music', id: 'classroom' },",
   "    { t: 'bg', id: 'classroom', place: '高一（2）班 · 教室 · 下午第一节课前' },\n    { t: 'music', id: 'exam' },"],

  // 5) 家：客厅、妈妈剥毛豆（原来用的是通用的室内曲）
  ['ch1.js',
   "    { t: 'bg', id: 'homeLiving', place: '家 · 客厅' },\n    { t: 'music', id: 'room' },",
   "    { t: 'bg', id: 'homeLiving', place: '家 · 客厅' },\n    { t: 'music', id: 'home' },"],

  // 6) 回忆：熨斗声、小时候睡不着
  ['ch6.js',
   "    { t: 'narr', text: '这个声音我从小听到大。' },",
   "    { t: 'music', id: 'memory' },\n    { t: 'narr', text: '这个声音我从小听到大。' },"],

  // 7) 告别：洗完手走出教学楼，梧桐、风、口袋里的纸
  ['ch6.js',
   "    { t: 'narr', text: '我甩了甩手，走出教学楼。' },",
   "    { t: 'music', id: 'goodbye' },\n    { t: 'narr', text: '我甩了甩手，走出教学楼。' },"]
];

const cache = new Map();
for (const [f, from, to] of edits) {
  const src = cache.get(f) ?? fs.readFileSync(P(f), 'utf8');
  if (!src.includes(from)) { console.log('✗ 没找到锚点:', f, from.slice(0, 40)); continue; }
  if (src.includes(to)) { console.log('· 已存在，跳过:', f); continue; }
  cache.set(f, src.replace(from, to));
  console.log('✓', f, '←', to.match(/id: '(\w+)'/)[1]);
}
for (const [f, src] of cache) fs.writeFileSync(P(f), src);
