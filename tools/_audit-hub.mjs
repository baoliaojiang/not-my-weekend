import { MATERIALS } from '../scripts/data/materials.js';

const files = ['ch1','ch2','ch3','ch4','ch5','side1','side2'];
const CLUES = ['刚才', '之前', '上次', '那张', '那份', '拿到的', '拍下来', '问过', '查过', '说过',
  '我跟', '我找', '我拍', '我量', '我记下', '已经拿到', '手里有', '前面', '早些时候', '刚问'];

function texts(script, out = []) {
  for (const n of script || []) {
    if (n.text) out.push({ t: n.t, text: n.text });
    if (n.script) texts(n.script, out);
    if (n.steps) for (const s of n.steps) if (s.text) out.push({ t: 'hot', text: s.text });
    if (n.options) for (const o of n.options) if (o.reply) out.push({ t: 'hotopt', text: o.reply });
  }
  return out;
}

for (const f of files) {
  const d = (await import(`../scripts/data/${f}.js`)).default;
  for (const a of d.hubActions || []) {
    const tx = texts(a.script);
    const hits = tx.filter(x => CLUES.some(c => x.text.includes(c)));
    // 这个行动产出的材料
    const ownMats = [];
    const collect = (s) => { for (const n of s || []) { if (n.t === 'mat' && n.id) ownMats.push(n.id); if (n.script) collect(n.script); } };
    collect(a.script);
    // 文本里提到的材料名
    const named = [];
    for (const [id, m] of Object.entries(MATERIALS)) {
      if (tx.some(x => x.text.includes(m.title))) named.push(id);
    }
    if (hits.length || named.length) {
      console.log(`\n### ${f} / ${a.id} 「${a.title}」 产出=${ownMats.join(',') || '无'} 文本提到材料=${named.join(',') || '无'}`);
      for (const h of hits.slice(0, 6)) console.log(`   [${h.t}] ${h.text.slice(0, 90)}`);
    }
  }
}
