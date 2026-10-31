/* =========================================================
   数据校验脚本（node tools/validate.mjs）
   ---------------------------------------------------------
   检查：
   1. 节点类型是否合法
   2. goto / choice.goto 指向的标签是否存在
   3. 材料 / 立绘 / 背景 / 音乐 ID 是否存在于配置
   4. 选项中是否混入了非法字段
   5. 章节总结是否齐全
   ========================================================= */

import ch0 from '../scripts/data/ch0.js';
import ch1 from '../scripts/data/ch1.js';
import ch2 from '../scripts/data/ch2.js';
import ch3 from '../scripts/data/ch3.js';
import ch4 from '../scripts/data/ch4.js';
import ch5 from '../scripts/data/ch5.js';
import ch6 from '../scripts/data/ch6.js';
import side1 from '../scripts/data/side1.js';
import side2 from '../scripts/data/side2.js';
import side3 from '../scripts/data/side3.js';
import { MATERIALS } from '../scripts/data/materials.js';
import { CHARACTERS } from '../scripts/data/characters.js';
import { BACKGROUNDS, SPRITES, MUSIC, SFX } from '../scripts/config/assets.js';

const CHAPTERS = [ch0, ch1, ch2, ch3, ch4, ch5, ch6, side1, side2, side3];

// 主线八类结局；支线可用 branch.outcomes 自己声明结果集合
const DEFAULT_OUTCOMES = ['hidden', 'collective', 'institutional', 'procedural', 'isolated', 'reconcile', 'compromise', 'silence'];

const VALID_TYPES = new Set([
  'bg', 'music', 'sfx', 'show', 'hide', 'say', 'narr', 'choice', 'mat',
  'flag', 'stat', 'note', 'chatmsg', 'phone', 'chatreply', 'hub', 'label',
  'goto', 'wait', 'unlock', 'end', 'branch', 'ending', 'if',
  'govform', 'govprogress', 'hotline', 'quiz', 'card', 'ask'
]);

const KNOWN_WHO = Object.keys(CHARACTERS);

let errors = 0;
let warnings = 0;

function err(chapter, where, msg) {
  errors++;
  console.log(`✗ [${chapter}] ${where}: ${msg}`);
}
function warn(chapter, where, msg) {
  warnings++;
  console.log(`! [${chapter}] ${where}: ${msg}`);
}

function checkNodes(chapter, nodes, scope) {
  const labels = new Set(nodes.filter(n => n.t === 'label').map(n => n.name));

  // 外部标签（主脚本里的）也允许从行动脚本跳转
  const mainLabels = new Set(chapter.nodes.filter(n => n.t === 'label').map(n => n.name));

  nodes.forEach((n, i) => {
    const where = `${scope}#${i}(${n.t})`;
    if (!VALID_TYPES.has(n.t)) { err(chapter.id, where, `未知节点类型 ${n.t}`); return; }

    if (n.t === 'bg' && !BACKGROUNDS[n.id]) err(chapter.id, where, `背景 id 不存在: ${n.id}`);
    if (n.t === 'music' && !MUSIC[n.id]) err(chapter.id, where, `音乐 id 不存在: ${n.id}`);
    if (n.t === 'sfx' && !SFX[n.id]) err(chapter.id, where, `音效 id 不存在: ${n.id}`);
    if ((n.t === 'show' || n.t === 'hide') && n.id && !SPRITES[n.id]) err(chapter.id, where, `立绘 id 不存在: ${n.id}`);
    if (n.t === 'mat' && !MATERIALS[n.id]) err(chapter.id, where, `材料 id 不存在: ${n.id}`);
    if ((n.t === 'say' || n.t === 'narr' || n.t === 'card') && !n.text) err(chapter.id, where, '缺少 text');
    if (n.t === 'say' && n.sprite && !SPRITES[n.sprite]) err(chapter.id, where, `立绘 id 不存在: ${n.sprite}`);
    if (n.t === 'goto' && !labels.has(n.label) && !mainLabels.has(n.label)) {
      err(chapter.id, where, `goto 标签不存在: ${n.label}`);
    }
    if (n.t === 'stat' && n.who && !KNOWN_WHO.includes(n.who)) {
      warn(chapter.id, where, `stat.who 未在人物表中定义: ${n.who}`);
    }
    if (n.t === 'ending' && !n.id) err(chapter.id, where, 'ending 缺少 id');
    // 政务平台表单：关闭页面要能跳到「关掉」分支
    if (n.t === 'govform') {
      if (n.closeGoto && !labels.has(n.closeGoto) && !mainLabels.has(n.closeGoto)) {
        err(chapter.id, where, `closeGoto 标签不存在: ${n.closeGoto}`);
      }
      if (n.mat && !MATERIALS[n.mat]) err(chapter.id, where, `材料 id 不存在: ${n.mat}`);
    }
    if (n.t === 'hotline') {
      if (!Array.isArray(n.steps) || !n.steps.length) err(chapter.id, where, 'hotline 缺少 steps');
      (n.steps || []).forEach((st, j) => {
        if (st.ask && (!st.options || st.options.length < 2)) {
          err(chapter.id, where, `hotline 第 ${j} 步选项少于 2 个`);
        }
      });
      if (n.mat && !MATERIALS[n.mat]) err(chapter.id, where, `材料 id 不存在: ${n.mat}`);
    }
    if (n.t === 'govprogress') {
      if (!n.data) err(chapter.id, where, 'govprogress 缺少 data');
      if (n.mat && !MATERIALS[n.mat]) err(chapter.id, where, `材料 id 不存在: ${n.mat}`);
    }
    if (n.t === 'quiz') {
      if (!Array.isArray(n.questions) || !n.questions.length) {
        err(chapter.id, where, 'quiz 缺少 questions');
      } else {
        n.questions.forEach((q, j) => {
          if (!q.q) err(chapter.id, where, `quiz 第 ${j + 1} 题缺少题干`);
          if (!Array.isArray(q.options) || q.options.length < 2) {
            err(chapter.id, where, `quiz 第 ${j + 1} 题选项少于 2 个`);
          } else if (q.options.length > 5) {
            err(chapter.id, where, `quiz 第 ${j + 1} 题选项超过 5 个`);
          } else if (!(q.answer >= 0 && q.answer < q.options.length)) {
            err(chapter.id, where, `quiz 第 ${j + 1} 题 answer 越界`);
          }
        });
      }
      if (n.mat && !MATERIALS[n.mat]) err(chapter.id, where, `材料 id 不存在: ${n.mat}`);
    }
    if (n.t === 'branch' && typeof n.decide !== 'function') err(chapter.id, where, 'branch 缺少 decide 函数');
    if (n.t === 'branch' && n.prefix) {
      // branch 会跳转到 prefix+结局 id，检查这些标签是否都存在
      const outcomes = Array.isArray(n.outcomes) ? n.outcomes : DEFAULT_OUTCOMES;
      outcomes.forEach(e => {
        if (!mainLabels.has(n.prefix + e)) err(chapter.id, where, `branch 结局标签缺失: ${n.prefix}${e}`);
      });
    }
    if (n.t === 'chatreply') {
      if (!n.options || !n.options.length) err(chapter.id, where, 'chatreply 缺少 options');
      (n.options || []).forEach((o, j) => {
        if (!o.text) err(chapter.id, where, `选项 ${j} 缺少 text`);
        (o.effects || []).forEach(e => {
          if (e.mat && !MATERIALS[e.mat]) err(chapter.id, where, `选项 ${j} 材料不存在: ${e.mat}`);
        });
      });
    }
    if (n.t === 'choice') {
      if (!n.options || n.options.length < 2) err(chapter.id, where, '选项少于 2 个');
      (n.options || []).forEach((o, j) => {
        if (!o.text) err(chapter.id, where, `选项 ${j} 缺少 text`);
        if (o.goto && !labels.has(o.goto) && !mainLabels.has(o.goto)) {
          err(chapter.id, where, `选项 ${j} goto 不存在: ${o.goto}`);
        }
        (o.effects || []).forEach(e => {
          if (e.mat && !MATERIALS[e.mat]) err(chapter.id, where, `选项 ${j} 材料不存在: ${e.mat}`);
        });
      });
    }
  });

  // 检查未被引用的标签
  const used = new Set();
  nodes.forEach(n => {
    if (n.t === 'goto') used.add(n.label);
    if (n.t === 'govform' && n.closeGoto) used.add(n.closeGoto);
    if (n.t === 'choice') (n.options || []).forEach(o => o.goto && used.add(o.goto));
    if (n.t === 'branch' && n.prefix) {
      (Array.isArray(n.outcomes) ? n.outcomes : DEFAULT_OUTCOMES)
        .forEach(e => used.add(n.prefix + e));
    }
    if (n.t === 'if') {
      if (n.then) used.add(n.then);
      if (n.else) used.add(n.else);
    }
  });
  // if 节点的 then/else 也必须真的存在
  nodes.forEach(n => {
    if (n.t === 'if') {
      if (n.then && !labels.has(n.then) && !mainLabels.has(n.then)) {
        err(chapter.id, 'main', `if 的 then 标签不存在: ${n.then}`);
      }
      if (n.else && !labels.has(n.else) && !mainLabels.has(n.else)) {
        err(chapter.id, 'main', `if 的 else 标签不存在: ${n.else}`);
      }
    }
  });
  labels.forEach(l => { if (!used.has(l)) warn(chapter.id, scope, `标签未被引用: ${l}`); });
}

for (const ch of CHAPTERS) {
  console.log(`\n== ${ch.id} ${ch.title} ${ch.name} ==`);
  if (!ch.nodes || !ch.nodes.length) { err(ch.id, 'chapter', '缺少 nodes'); continue; }
  if (!ch.summary) warn(ch.id, 'chapter', '缺少 summary');
  checkNodes(ch, ch.nodes, 'main');

  (ch.hubActions || []).forEach(a => {
    if (!a.id || !a.title) err(ch.id, `action:${a.id}`, '缺少 id 或 title');
    if (!a.script || !a.script.length) err(ch.id, `action:${a.id}`, '缺少 script');
    else checkNodes(ch, a.script, `action:${a.id}`);
  });

  (ch.hubEvents || []).forEach(ev => {
    if (typeof ev.after !== 'number') err(ch.id, `event:${ev.id}`, '缺少 after');
    checkNodes(ch, ev.script || [], `event:${ev.id}`);
  });

  const ids = (ch.hubActions || []).map(a => a.id);
  if (ids.length) {
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) err(ch.id, 'hubActions', `行动 id 重复: ${dup.join(',')}`);
    console.log(`   行动 ${ids.length} 项 / 中段事件 ${(ch.hubEvents || []).length} 个`);
  }
}

console.log(`\n结果：${errors} 个错误，${warnings} 个提醒`);
process.exit(errors ? 1 : 0);
