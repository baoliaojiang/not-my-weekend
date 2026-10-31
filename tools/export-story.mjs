/* =========================================================
   剧本导出：把 ch0–ch6 的节点数据展开成一份可读的 Markdown
   ---------------------------------------------------------
   用法：node tools/export-story.mjs [输出路径]
   默认输出：docs/剧情全文.md

   这份文档是「阅读/校对/改写参考稿」，不是运行数据。
   真正生效的仍然是 scripts/data/ch*.js。
   ========================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { ENDINGS, ENDING_HINTS } from '../scripts/core/judge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'docs', '剧情全文.md');

const MAIN_CHAPTERS = [ch0, ch1, ch2, ch3, ch4, ch5, ch6];
const SIDE_CHAPTERS = [side1, side2, side3];
const CHAPTERS = [...MAIN_CHAPTERS, ...SIDE_CHAPTERS];

/* ---------------- 小工具 ---------------- */

const pad2 = (n) => String(n).padStart(2, '0');
const matTitle = (id) => (MATERIALS[id] ? `《${MATERIALS[id].title}》` : '');

// 支线结局不在主线 judge.js 的 ENDINGS 表里，这里单独给中文名
const SIDE_ENDING_NAMES = {
  side_coin: '一元钱',
  side_clear: '处理完了',
  side_partial: '各说各的',
  side_procedural: '走完了流程',
  side_dispute: '各执一词',
  side_filter: '最后一杯',
  side_clear2: '换了新的',
  side_partial2: '换了新的，但记录还是空的',
  side_procedural2: '流程走完了',
  side_dispute2: '三个人在传'
};

function statLine(n) {
  const who = CHARACTERS[n.who] ? CHARACTERS[n.who].name : n.who;
  const parts = [];
  if (typeof n.trust === 'number') parts.push(`信任 ${n.trust > 0 ? '+' : ''}${n.trust}`);
  if (typeof n.pressure === 'number') parts.push(`压力 ${n.pressure > 0 ? '+' : ''}${n.pressure}`);
  if (typeof n.stance === 'number') parts.push(`立场 ${n.stance > 0 ? '+' : ''}${n.stance}`);
  if (!parts.length) parts.push('状态变化');
  return `（${who}：${parts.join('，')}）`;
}

/**
 * 副作用对象有两套写法，这里统一成「谁 + 什么变化」：
 *   选项里：{ stat: 'shen', trust: -2 }        （stat 是角色 id）
 *   节点里：{ t: 'stat', who: 'shen', trust: -2 }
 */
function effectDesc(e) {
  if (!e) return '';
  if (e.mat) return `获得材料 ${e.mat}${matTitle(e.mat)}`;
  if (e.stat) {
    if (typeof e.stat === 'string') return statLine({ t: 'stat', who: e.stat, ...e }).replace(/[（）]/g, '');
    return statLine({ t: 'stat', ...e.stat }).replace(/[（）]/g, '');
  }
  if (e.flag) return e.value !== undefined ? `标记 ${e.flag} = ${e.value}` : `标记 ${e.flag}`;
  return '';
}

function effectLine(effects) {
  if (!Array.isArray(effects) || !effects.length) return '';
  const parts = effects.map(effectDesc).filter(Boolean);
  return parts.length ? `（${parts.join('；')}）` : '';
}

function nodeEffects(n) {
  const parts = [];
  if (n.mat) parts.push(`获得材料 ${n.mat}${matTitle(n.mat)}`);
  if (n.flag) parts.push(`标记 ${n.flag}`);
  if (n.stat) parts.push(statLine({ t: 'stat', ...n.stat }).replace(/[（）]/g, ''));
  return parts.length ? `（${parts.join('；')}）` : '';
}

/* ---------------- 节点渲染 ---------------- */

/**
 * 把一个 script 数组渲染成若干 Markdown 行。
 * @param {Array} nodes
 * @param {object} opt { heading: 用于 label 的层级, indent }
 */
function renderScript(nodes, opt = {}) {
  const out = [];
  let lastWasStage = false;
  const heading = opt.heading || '####';

  nodes.forEach((n, i) => {
    if (!n || !n.t) return;

    switch (n.t) {
      case 'bg': {
        out.push('');
        out.push(`> **〔场景〕${n.place || n.id}**`);
        out.push('');
        lastWasStage = true;
        break;
      }
      case 'music': {
        out.push(`*〔音乐〕${n.id}*`);
        break;
      }
      case 'sfx': {
        out.push(`*〔音效〕${n.id}*`);
        break;
      }
      case 'show': {
        out.push(`*〔立绘〕出场：${CHARACTERS[n.id] ? CHARACTERS[n.id].name : n.id}（${n.pos || 'center'}）*`);
        break;
      }
      case 'hide': {
        out.push(n.all ? '*〔立绘〕全部退场*' : `*〔立绘〕退场：${CHARACTERS[n.id] ? CHARACTERS[n.id].name : n.id}*`);
        break;
      }
      case 'wait': {
        break;
      }
      case 'label': {
        out.push('');
        out.push(`${heading} 分支标签：\`${n.name}\``);
        out.push('');
        break;
      }
      case 'goto': {
        out.push('');
        out.push(`↳ 跳转到 \`${n.label || n.name}\``);
        out.push('');
        break;
      }
      case 'narr': {
        out.push('');
        out.push(n.text);
        break;
      }
      case 'say': {
        const who = n.name || (CHARACTERS[n.who] ? CHARACTERS[n.who].name : n.who);
        out.push('');
        out.push(`**${who}**：${n.text}`);
        break;
      }
      case 'note': {
        out.push('');
        out.push(`〔作者注〕${n.text}`);
        break;
      }
      case 'choice': {
        out.push('');
        if (n.prompt) out.push(`**▸ 选择：${n.prompt}**`);
        else out.push('**▸ 选择：**');
        out.push('');
        n.options.forEach((o, k) => {
          const tags = [];
          if (o.goto) tags.push(`→ \`${o.goto}\``);
          const eff = effectLine(o.effects);
          if (eff) tags.push(eff);
          if (o.flag) tags.push(`标记 ${o.flag}`);
          out.push(`- **${String.fromCharCode(65 + k)}.** ${o.text}${tags.length ? ' ' + tags.join(' ') : ''}`);
        });
        out.push('');
        break;
      }
      case 'chatreply': {
        out.push('');
        out.push('**▸ 聊天回复选择：**');
        out.push('');
        n.options.forEach((o, k) => {
          out.push(`- **${String.fromCharCode(65 + k)}.** ${o.text}${effectLine(o.effects)}`);
          (o.msgs || []).forEach((m) => out.push(`  - ${m.from}：${m.text}`));
        });
        out.push('');
        break;
      }
      case 'chatmsg': {
        const thread = n.thread === 'class' ? '班级群' : n.thread === 'shen' ? '与沈予安' : n.thread === 'parents' ? '家长群' : n.thread;
        out.push('');
        out.push(`〔${thread}〕**${n.from}**：${n.text}`);
        break;
      }
      case 'mat': {
        out.push('');
        out.push(`**〔获得材料〕${n.id}${matTitle(n.id)}**`);
        break;
      }
      case 'stat': {
        out.push(statLine(n) + (n.hint ? ` *${n.hint}*` : ''));
        break;
      }
      case 'flag': {
        out.push(`*（标记：${n.key}）*`);
        break;
      }
      case 'ai': {
        out.push('');
        out.push('**〔AI 助手〕** 玩家可自由提问（离线问答 / 接入模型均可）');
        out.push('');
        break;
      }
      case 'aireply': {
        out.push('');
        out.push(`**〔AI 撰写的公文〕** ${n.name || ''}`);
        out.push('');
        const fb = Array.isArray(n.fallback) ? n.fallback : [n.fallback];
        out.push('*接入模型时由模型现写；未接入时使用下面这段内置稿：*');
        out.push('');
        fb.filter(Boolean).forEach((t) => out.push(`> ${t}`));
        out.push('');
        break;
      }
      case 'branch': {
        out.push('');
        out.push('---');
        out.push('');
        if (Array.isArray(n.outcomes)) {
          out.push('**〔支线结果判定〕** 依据「材料是否充分、是否区分批次、是否走完校内与外部两条线、有没有急着公开指控」，进入下列五种结果之一。');
          out.push('');
          out.push(`可能结果：${n.outcomes.map((e) => `\`${n.prefix || ''}${e}\``).join(' / ')}`);
        } else {
          out.push('**〔结局判定〕** 根据材料、立场与关系，进入八类结局之一。');
        }
        out.push('');
        break;
      }
      case 'ending': {
        const e = ENDINGS[n.id];
        out.push('');
        if (e) out.push(`## ★ 结局：${e.name}（${e.kind}）`);
        else out.push(`## ★ 支线结果：${SIDE_ENDING_NAMES[n.id] || n.id}`);
        out.push('');
        out.push(`\`ending: ${n.id}\``);
        out.push('');
        break;
      }
      case 'hub': {
        out.push('');
        out.push('**〔调查中枢〕** 玩家自由选择行动，行动见本节末尾「自由活动」。');
        out.push('');
        break;
      }
      case 'unlock': {
        out.push(`*（解锁：${n.id || n.key}）*`);
        break;
      }
      case 'end': {
        out.push('');
        out.push('**— 本章结束 —**');
        out.push('');
        break;
      }
      default: {
        out.push(`*〔未知节点类型：${n.t}〕*`);
      }
    }
  });

  return out;
}

/* ---------------- 章节渲染 ---------------- */

function renderChapter(ch, idx) {
  const out = [];
  out.push('');
  out.push('---');
  out.push('');
  out.push(`# ${ch.title} · ${ch.name}`);
  out.push('');
  const meta = [];
  if (ch.dayLabel) meta.push(ch.dayLabel);
  if (ch.apMax) meta.push(`行动点 ${ch.apMax}`);
  if (ch.music) meta.push(`默认音乐：${ch.music}`);
  meta.push(`源文件：\`scripts/data/${ch.id}.js\``);
  out.push(`*${meta.join('　|　')}*`);
  out.push('');

  out.push(...renderScript(ch.nodes || []));

  /* ---- 自由活动 ---- */
  const acts = ch.hubActions || [];
  if (acts.length) {
    out.push('');
    out.push('## 自由活动（调查中枢）');
    out.push('');
    acts.forEach((a, k) => {
      out.push('');
      out.push(`### 行动 ${pad2(k + 1)}　${a.title}${a.once ? '　*(仅一次)*' : ''}`);
      out.push('');
      const head = [];
      if (a.tag) head.push(`分类：${a.tag}`);
      if (a.desc) head.push(`提示：${a.desc}`);
      if (head.length) out.push(`*${head.join('　|　')}*`);
      out.push('');
      out.push(...renderScript(a.script || [], { heading: '#####' }));
    });
  }

  /* ---- 定时事件 ---- */
  const evts = ch.hubEvents || [];
  if (evts.length) {
    out.push('');
    out.push('## 定时事件');
    out.push('');
    evts.forEach((e) => {
      out.push('');
      out.push(`### 事件 \`${e.id}\`　（第 ${e.after} 次行动后触发）`);
      out.push('');
      out.push(...renderScript(e.script || [], { heading: '####' }));
    });
  }

  /* ---- 章末小结 ---- */
  if (ch.summary) {
    const s = ch.summary;
    out.push('');
    out.push('## 章末小结卡');
    out.push('');
    if (s.title) out.push(`**${s.title}**${s.subtitle ? '　·　' + s.subtitle : ''}`);
    if (s.quote) out.push('');
    if (s.quote) out.push(`> ${s.quote}`);
    if (s.known && s.known.length) {
      out.push('');
      out.push('**已知：**');
      s.known.forEach((t) => out.push(`- ${t}`));
    }
    if (s.unknown && s.unknown.length) {
      out.push('');
      out.push('**未知：**');
      s.unknown.forEach((t) => out.push(`- ${t}`));
    }
  }

  return out;
}

/* ---------------- 主流程 ---------------- */

const lines = [];

lines.push('# 《周日不返校》剧情全文');
lines.push('');
lines.push('> 本文件由 `tools/export-story.mjs` 从 `scripts/data/ch0.js`–`ch6.js` 与 `side1.js` 自动展开，');
lines.push('> 用于通读、校对与改写参考。**游戏实际运行的仍是源文件**，改这里不会生效。');
lines.push('> 若要修改剧情，请改对应章节的 `.js` 源文件，然后重新执行：`node tools/export-story.mjs`。');
lines.push('');
lines.push('阅读约定：');
lines.push('');
lines.push('- 直排正文＝旁白/叙述；`**角色**：台词` ＝对白；');
lines.push('- `> **〔场景〕**` 为场景切换，`*〔…〕*` 为演出指示（音乐、立绘、音效）；');
lines.push('- `**▸ 选择：**` 后列出选项，括号内是副作用（材料/关系/标记）与跳转标签；');
lines.push('- `#### 分支标签` 表示剧情在此处汇合或分叉；`↳ 跳转到` 表示强制跳转；');
lines.push('- 每章末尾的「自由活动」是调查中枢里可选做的行动，顺序由玩家决定。');
lines.push('');

/* 目录 */
lines.push('## 目录');
lines.push('');
CHAPTERS.forEach((ch, i) => {
  lines.push(`${i + 1}. [${ch.title} · ${ch.name}](#${(ch.title + '-' + ch.name).replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, '')})`);
});
lines.push(`${CHAPTERS.length + 1}. [附录 A · 八类结局](#附录-a--八类结局)`);
lines.push(`${CHAPTERS.length + 2}. [附录 B · 材料索引](#附录-b--材料索引)`);
lines.push(`${CHAPTERS.length + 3}. [附录 C · 人物索引](#附录-c--人物索引)`);
lines.push(`${CHAPTERS.length + 4}. [附录 D · 支线《一元口罩》结果表](#附录-d--支线一元口罩结果表)`);
lines.push('');
/* 正文章节 */
CHAPTERS.forEach((ch, i) => {
  lines.push(...renderChapter(ch, i));
});

/* 附录 A：结局 */
lines.push('');
lines.push('---');
lines.push('');
lines.push('# 附录 A · 八类结局');
lines.push('');
lines.push('结局不是靠单一数值决定的，而是看「实际做了什么」：交了什么材料、拿到哪些关键材料、');
lines.push('第四章怎么面对班级、跟谁的关系撑得住、第五章有没有查清执行链的来源。');
lines.push('判定按下列顺序进行，命中即停。');
lines.push('');
lines.push('| 优先级 | 结局 | 类型 | 触发条件（摘要） |');
lines.push('| --- | --- | --- | --- |');
const order = [
  ['1', 'hidden', '正式反映 + 查清来源 + 只写已核实 + 第四章保持克制 + 沈予安信任 ≥ 60 + 关键材料 ≥ 7'],
  ['2', 'collective', '第四章选择联合他人，且确实组成了联名/共同行动'],
  ['3', 'institutional', '正式反映 + 关键材料 ≥ 7 + 班主任信任 ≥ 55 或罗一舟愿意出面作证'],
  ['4', 'procedural', '正式反映 + 关键材料 ≥ 4'],
  ['5', 'isolated', '正式反映，但材料不足以支撑'],
  ['6', 'reconcile', '面谈路线 + 沈予安 ≥ 55 + 周予晴 ≥ 50'],
  ['7', 'compromise', '面谈路线，但只推动了一部分'],
  ['8', 'silence', '以上都不满足（没交材料、没谈）']
];
order.forEach(([p, id, cond]) => {
  const e = ENDINGS[id];
  lines.push(`| ${p} | ${e.name} | ${e.kind} | ${cond} |`);
});
lines.push('');
lines.push('**关键材料**（计入 `keyMats`）：M009、M010、M014、M015、M016、M019、M021、M022。');
lines.push('');
lines.push('给玩家看的提示（不剧透数值）：');
lines.push('');
ENDING_HINTS.forEach((h) => {
  const e = ENDINGS[h.id];
  lines.push(`- **${e.name}**：${h.text}`);
});

/* 附录 B：材料 */
lines.push('');
lines.push('---');
lines.push('');
lines.push('# 附录 B · 材料索引');
lines.push('');
lines.push('| 编号 | 名称 | 类型 | 来源 | 核实状态 |');
lines.push('| --- | --- | --- | --- | --- |');
Object.values(MATERIALS).forEach((m) => {
  lines.push(`| ${m.id} | ${m.title} | ${m.type || ''} | ${m.source || ''} | ${m.status || ''} |`);
});

/* 附录 C：人物 */
lines.push('');
lines.push('---');
lines.push('');
lines.push('# 附录 C · 人物索引');
lines.push('');
Object.values(CHARACTERS).forEach((c) => {
  lines.push(`## ${c.name}`);
  lines.push('');
  lines.push(`*${c.role || ''}*`);
  lines.push('');
  if (c.intro) lines.push(c.intro);
  if (c.notes && c.notes.length) {
    lines.push('');
    c.notes.forEach((t) => lines.push(`- ${t}`));
  }
  lines.push('');
});

/* 附录 D：支线结果 */
lines.push('');
lines.push('---');
lines.push('');
lines.push('# 附录 D · 支线《一元口罩》结果表');
lines.push('');
lines.push('支线不参与主线的八结局判定（`scripts/core/judge.js`），');
lines.push('而是由 `scripts/data/side1.js` 里的 `decideSideResult()` 单独判定。');
lines.push('判定看的不是「点了哪个按钮」，而是四件事：材料够不够、批次分没分清、');
lines.push('校内与校外两条线有没有同时走到、有没有在核实之前就把话说到最满。');
lines.push('');
lines.push('| 优先级 | 结果标签 | 名称 | 触发条件（摘要） |');
lines.push('| --- | --- | --- | --- |');
[
  ['1', 'r_hidden', '一元钱（隐藏）', '实物/付款/同批次三证齐全 + 区分批次 + 至少一条外部渠道 + 保留校内追问 + 追问已售出部分 + 全程没有公开发未经核实的指控'],
  ['2', 'r_clear', '处理完了', '三证齐全 + 区分批次 + 至少一条外部渠道'],
  ['3', 'r_dispute', '各执一词', '公开发过未经核实的指控，且没有区分批次'],
  ['4', 'r_partial', '各说各的', '拿到了自己的实物与付款记录，但没解决批次问题'],
  ['5', 'r_procedural', '走完了流程', '以上都不满足：只有过程，没有可核查的东西']
].forEach(([p, id, name, cond]) => lines.push(`| ${p} | \`${id}\` | ${name} | ${cond} |`));
lines.push('');
lines.push('**渠道分工**（游戏内不写具体号码与时限，学生需自行查当地官方渠道）：');
lines.push('');
lines.push('| 渠道 | 能解决什么 | 解决不了什么 |');
lines.push('| --- | --- | --- |');
lines.push('| 市场监管 | 产品本身：过期、标识、来源是否合规 | 学校的内部管理与追责 |');
lines.push('| 教育主管 | 管理责任：谁该负责、流程哪里断了 | 产品是否合格的技术判定 |');
lines.push('| 卫健 | 健康风险：这样的口罩还能不能用 | 消费纠纷与退费 |');
lines.push('| 消保 | 消费关系：收费的部分怎么退、怎么赔 | 校内免费发放的部分 |');
lines.push('| 继续追问学校 | 已发出的部分怎么处理、怎么告知 | 对外部机构的处理进度 |');
lines.push('');
lines.push('**设计红线**：不编造现实投诉热线、受理时限或法定权限；');
lines.push('所有「该找谁」的答案都落在「去当地官方渠道自己查」这一步上，');
lines.push('玩家得到的是判断方法，不是一串可以直接照抄的号码。');

lines.push('');
lines.push(`*导出时间：${new Date().toISOString().slice(0, 10)}*`);
lines.push('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

const stat = fs.statSync(OUT);
console.log(`已导出：${OUT}`);
console.log(`行数：${lines.length}　大小：${(stat.size / 1024).toFixed(1)} KB`);
