/* =========================================================
   八类结局可达性检查（纯逻辑，不开浏览器）
   ---------------------------------------------------------
   1. 给每一类结局构造一份「按规则应该得到它」的存档状态，
      确认 decideEnding 真的返回它；
   2. 确认第六章里存在对应的结局段落标签，跳得过去；
   3. 顺带检查关键材料都能在剧情里拿到（否则高分结局永远打不出来）。

   用法：node tools/test-endings.mjs
   ========================================================= */

import ch6 from '../scripts/data/ch6.js';
import ch2 from '../scripts/data/ch2.js';
import ch3 from '../scripts/data/ch3.js';
import ch4 from '../scripts/data/ch4.js';
import ch5 from '../scripts/data/ch5.js';
import ch1 from '../scripts/data/ch1.js';
import ch0 from '../scripts/data/ch0.js';
import { ENDINGS, ENDING_HINTS, decideEnding, keyMaterialCount } from '../scripts/core/judge.js';

let bad = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? '　' + extra : ''}`);
};

const KEY = ['M009', 'M010', 'M014', 'M015', 'M016', 'M019', 'M021', 'M022'];
const mats = (n) => KEY.slice(0, n);

function st({ mode = 'none', flags = {}, shen = 0, chen = 0, zhou = 0, luo = 0, keyMats = 0 } = {}) {
  return {
    flags: { report_mode: mode, ...flags },
    stats: {
      shen: { trust: shen, pressure: 0 },
      chen: { trust: chen, pressure: 0 },
      zhou: { trust: zhou, pressure: 0 },
      luo: { trust: luo, pressure: 0 }
    },
    materials: mats(keyMats)
  };
}

/* ---------------- 1. 每类结局各一条“应该命中”的状态 ---------------- */
const CASES = [
  ['hidden', st({
    mode: 'formal',
    keyMats: 7,
    shen: 62,
    flags: { sun_origin: true, knows_excel_detail: true, supplement: 'safe', ch4_stance: 'quiet' }
  }), '正式反映＋查清来源＋只写已核实＋克制＋沈予安 62'],
  ['collective', st({
    mode: 'talk', keyMats: 3,
    flags: { ch4_stance: 'collective', collective_formed: true }
  }), '第四章联合他人且真的组成了'],
  ['institutional', st({
    mode: 'formal', keyMats: 7, chen: 56
  }), '正式反映＋关键材料 7＋陈老师 56'],
  ['procedural', st({
    mode: 'formal', keyMats: 4, chen: 20
  }), '正式反映＋关键材料 4'],
  ['isolated', st({
    mode: 'formal', keyMats: 2, chen: 20
  }), '正式反映但材料不足'],
  ['reconcile', st({
    mode: 'talk', keyMats: 3, shen: 56, zhou: 51
  }), '面谈＋沈予安 56＋周予晴 51'],
  ['compromise', st({
    mode: 'talk', keyMats: 2, shen: 30, zhou: 20
  }), '面谈但只推动了一部分'],
  ['silence', st({ mode: 'none', keyMats: 1 }), '什么都没做']
];

console.log('== 一、结局判定 ==');
for (const [want, state, desc] of CASES) {
  const got = decideEnding(state);
  ok(`${want} ← ${desc}`, got === want, got === want ? '' : `实际得到 ${got}`);
}

/* ---------------- 2. 第六章必须有对应段落 ---------------- */
console.log('\n== 二、结局段落 ==');
const labels = new Set((ch6.nodes || []).filter(n => n.t === 'label').map(n => n.name));
const endingNodes = new Map((ch6.nodes || []).filter(n => n.t === 'ending').map(n => [n.id, n]));
for (const id of Object.keys(ENDINGS)) {
  ok(`第六章有 ${ENDINGS[id].name}（${id}）`, labels.has('e_' + id) && endingNodes.has(id));
}
ok('结局段落数量与结局表一致', endingNodes.size === Object.keys(ENDINGS).length,
  `${endingNodes.size} / ${Object.keys(ENDINGS).length}`);
ok('关于本作里的结局提示齐全', ENDING_HINTS.length === Object.keys(ENDINGS).length);
ok('第六章有结局判定节点', (ch6.nodes || []).some(n => n.t === 'branch'));

/* ---------------- 3. 关键材料在剧情里拿得到 ---------------- */
console.log('\n== 三、关键材料来源 ==');
const CH = [ch0, ch1, ch2, ch3, ch4, ch5];
const obtained = new Set();
for (const ch of CH) {
  const scan = (nodes) => (nodes || []).forEach(n => {
    if (n.t === 'mat' && n.id) obtained.add(n.id);
    if (n.t === 'choice') (n.options || []).forEach(o => (o.effects || []).forEach(e => e.mat && obtained.add(e.mat)));
  });
  scan(ch.nodes);
  (ch.hubActions || []).forEach(a => scan(a.script));
  (ch.hubEvents || []).forEach(e => scan(e.script));
}
for (const id of KEY) {
  ok(`关键材料 ${id} 可获得`, obtained.has(id));
}
ok('关键材料数等于 8', KEY.length === 8);

/* ---------------- 4. 关键材料数真的按材料表算 ---------------- */
const full = st({ mode: 'formal', keyMats: 8 });
ok('keyMaterialCount 统计正确', keyMaterialCount(full) === 8, `${keyMaterialCount(full)}`);

console.log(`\n结果：${bad ? bad + ' 项未通过' : '全部通过'}`);
process.exit(bad ? 1 : 0);
