/* =========================================================
   剧情 ⇄ Markdown 双向工具
   ---------------------------------------------------------
   导出：node tools/story-md.mjs export
         → docs/剧情全文-可编辑.md

   回写：node tools/story-md.mjs import [md路径]
         → 把 md 里改过的文字写回 scripts/data/*.js

   自检：node tools/story-md.mjs verify
         → 导出→解析→比对，必须零差异

   设计要点
   --------
   1. 每一段可编辑文字的行末都带一个定位标记：
          九月一日，星期一。 <!--#ch0:nodes[3].text@narr-->
      标记里是「章节 + 数据路径 + 段落类型」，与文字内容无关，
      文字怎么改都不影响定位。标记到行末之间可以放说明性内容
      （跳转标签、副作用），不会被当成正文。
   2. 回写时按标记找到数据里的旧字符串，再在 .js 源文件里按
      出现顺序定位同一段字面量，整段替换。没有标记的段落不动。
   3. 章节标题、行动标题这类「结构性文字」不参与回写。
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
import { ENDINGS } from '../scripts/core/judge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MD = path.join(ROOT, 'docs', '剧情全文-可编辑.md');

const CHAPTERS = [ch0, ch1, ch2, ch3, ch4, ch5, ch6, side1, side2, side3];
const FILE_OF = (id) => `scripts/data/${id}.js`;

const SIDE_ENDING_NAMES = {
  side_coin: '一元钱', side_clear: '处理完了', side_partial: '各说各的',
  side_procedural: '走完了流程', side_dispute: '各执一词',
  side_filter: '最后一杯', side_clear2: '换了新的',
  side_partial2: '换了新的，但记录还是空的', side_procedural2: '流程走完了',
  side_dispute2: '三个人在传',
  side_eighth: '那节课从课表上消失了', side_clear3: '四页',
  side_partial3: '贴在走廊上了', side_procedural3: '六个「已要求」',
  side_dispute3: '个别班级'
};

const matTitle = (id) => (MATERIALS[id] ? `《${MATERIALS[id].title}》` : '');
const whoName = (n) => n.name || (CHARACTERS[n.who] ? CHARACTERS[n.who].name : n.who);

/* =========================================================
   一、遍历：收集每一段可编辑文字 + 定位 id
   ========================================================= */

function walkScript(nodes, prefix, file, add) {
  (nodes || []).forEach((n, i) => {
    if (!n || !n.t) return;
    const p = `${prefix}[${i}]`;
    switch (n.t) {
      case 'narr': add(`${p}.text`, 'narr', n.text, file); break;
      case 'say': add(`${p}.text`, 'say', n.text, file); break;
      case 'note': add(`${p}.text`, 'note', n.text, file); break;
      case 'chatmsg': add(`${p}.text`, 'msg', n.text, file); break;
      case 'choice':
        add(`${p}.prompt`, 'prompt', n.prompt, file);
        (n.options || []).forEach((o, k) => add(`${p}.options[${k}].text`, 'opt', o.text, file));
        break;
      case 'chatreply':
        add(`${p}.prompt`, 'prompt', n.prompt, file);
        (n.options || []).forEach((o, k) => {
          add(`${p}.options[${k}].text`, 'opt', o.text, file);
          (o.msgs || []).forEach((m, j) => add(`${p}.options[${k}].msgs[${j}].text`, 'msg', m.text, file));
        });
        break;
      case 'quiz':
        add(`${p}.intro`, 'block', n.intro, file);
        (n.questions || []).forEach((q, k) => {
          add(`${p}.questions[${k}].q`, 'q', q.q, file);
          (q.options || []).forEach((t, j) => add(`${p}.questions[${k}].options[${j}]`, 'item', t, file));
          add(`${p}.questions[${k}].explain`, 'explain', q.explain, file);
        });
        break;
      case 'hotline':
        (n.steps || []).forEach((s, k) => {
          add(`${p}.steps[${k}].text`, 'msg', s.text, file);
          add(`${p}.steps[${k}].ask`, 'prompt', s.ask, file);
          (s.options || []).forEach((o, j) => {
            add(`${p}.steps[${k}].options[${j}].text`, 'opt', o.text, file);
            add(`${p}.steps[${k}].options[${j}].reply`, 'reply', o.reply, file);
          });
        });
        break;
      case 'if':
        if (Array.isArray(n.then)) walkScript(n.then, `${p}.then`, file, add);
        if (Array.isArray(n.else)) walkScript(n.else, `${p}.else`, file, add);
        break;
      default: break;
    }
  });
}

function collectChapter(ch, sink) {
  const file = FILE_OF(ch.id);
  const add = (id, kind, value, f) => {
    if (typeof value !== 'string' || !value.trim()) return;
    sink.push({ id, file: f, old: value, kind });
  };
  walkScript(ch.nodes || [], `${ch.id}:nodes`, file, add);
  (ch.hubActions || []).forEach((a, i) => {
    add(`${ch.id}:hubActions[${i}].title`, 'atitle', a.title, file);
    walkScript(a.script || [], `${ch.id}:hubActions[${i}].script`, file, add);
  });
  (ch.hubEvents || []).forEach((e, i) => {
    walkScript(e.script || [], `${ch.id}:hubEvents[${i}].script`, file, add);
  });
  if (ch.summary) {
    add(`${ch.id}:summary.quote`, 'quote', ch.summary.quote, file);
    (ch.summary.known || []).forEach((t, i) => add(`${ch.id}:summary.known[${i}]`, 'item', t, file));
    (ch.summary.unknown || []).forEach((t, i) => add(`${ch.id}:summary.unknown[${i}]`, 'item', t, file));
  }
}

function collectAll() {
  const sink = [];
  CHAPTERS.forEach((ch) => collectChapter(ch, sink));
  return sink;
}

/* =========================================================
   二、导出
   ========================================================= */

const A = (id, kind) => `<!--#${id}@${kind}-->`;

function effDesc(e) {
  if (!e) return '';
  if (e.mat) return `获得材料 ${e.mat}${matTitle(e.mat)}`;
  if (e.stat) return '关系变化';
  if (e.flag) return `标记 ${e.flag}`;
  return '';
}

function renderScript(nodes, prefix, out, heading = '####') {
  (nodes || []).forEach((n, i) => {
    if (!n || !n.t) return;
    const p = `${prefix}[${i}]`;
    switch (n.t) {
      case 'bg': out.push('', `> **〔场景〕${n.place || n.id}**`, ''); break;
      case 'music': out.push(`*〔音乐〕${n.id}*`); break;
      case 'sfx': out.push(`*〔音效〕${n.id}*`); break;
      case 'show': out.push(`*〔立绘〕出场：${CHARACTERS[n.id] ? CHARACTERS[n.id].name : n.id}（${n.pos || 'center'}）*`); break;
      case 'hide': out.push(n.all ? '*〔立绘〕全部退场*' : `*〔立绘〕退场：${CHARACTERS[n.id] ? CHARACTERS[n.id].name : n.id}*`); break;
      case 'wait': break;
      case 'label': out.push('', `${heading} 分支标签：\`${n.name}\``, ''); break;
      case 'goto': out.push('', `↳ 跳转到 \`${n.label || n.name}\``, ''); break;

      case 'narr': out.push('', `${n.text} ${A(`${p}.text`, 'narr')}`); break;
      case 'say': {
        const nm = whoName(n);
        out.push('', `${nm ? `**${nm}**：` : ''}${n.text} ${A(`${p}.text`, 'say')}`);
        break;
      }
      case 'note': out.push('', `〔作者注〕${n.text} ${A(`${p}.text`, 'note')}`); break;
      case 'chatmsg': {
        const th = n.thread === 'class' ? '班级群'
          : n.thread === 'shen' ? '与沈予安'
            : n.thread === 'parents' ? '家长群'
              : n.thread === 'students' ? '学生群'
                : n.thread === 'xu' ? '与许小满' : n.thread;
        out.push('', `〔${th}〕${n.from ? `**${n.from}**：` : ''}${n.text} ${A(`${p}.text`, 'msg')}`);
        break;
      }
      case 'mat': out.push('', `**〔获得材料〕${n.id}${matTitle(n.id)}**`); break;
      case 'stat': {
        const who = CHARACTERS[n.who] ? CHARACTERS[n.who].name : n.who;
        const parts = [];
        if (typeof n.trust === 'number') parts.push(`信任 ${n.trust > 0 ? '+' : ''}${n.trust}`);
        if (typeof n.pressure === 'number') parts.push(`压力 ${n.pressure > 0 ? '+' : ''}${n.pressure}`);
        if (typeof n.stance === 'number') parts.push(`立场 ${n.stance > 0 ? '+' : ''}${n.stance}`);
        out.push(`*（${who}：${parts.join('，') || '状态变化'}${n.hint ? ' · ' + n.hint : ''}）*`);
        break;
      }
      case 'flag': out.push(`*（标记：${n.key}）*`); break;
      case 'unlock': out.push(`*（解锁：${n.id || n.key}）*`); break;

      case 'choice': {
        out.push('');
        if (n.prompt) out.push(`**▸ 选择：${n.prompt}** ${A(`${p}.prompt`, 'prompt')}`);
        else out.push('**▸ 选择：**');
        out.push('');
        (n.options || []).forEach((o, k) => {
          const tags = [];
          if (o.goto) tags.push(`→ \`${o.goto}\``);
          if (o.effects && o.effects.length) {
            const e = o.effects.map(effDesc).filter(Boolean);
            if (e.length) tags.push(`（${e.join('；')}）`);
          }
          if (o.flag) tags.push(`标记 ${o.flag}`);
          out.push(`- **${String.fromCharCode(65 + k)}.** ${o.text} ${A(`${p}.options[${k}].text`, 'opt')}${tags.length ? ' ' + tags.join(' ') : ''}`);
        });
        out.push('');
        break;
      }
      case 'chatreply': {
        out.push('');
        out.push(n.prompt
          ? `**▸ 聊天回复：${n.prompt}** ${A(`${p}.prompt`, 'prompt')}`
          : '**▸ 聊天回复选择：**');
        out.push('');
        (n.options || []).forEach((o, k) => {
          const eff = o.effects && o.effects.length
            ? (() => { const e = o.effects.map(effDesc).filter(Boolean); return e.length ? `（${e.join('；')}）` : ''; })()
            : '';
          out.push(`- **${String.fromCharCode(65 + k)}.** ${o.text} ${A(`${p}.options[${k}].text`, 'opt')}${eff}`);
          (o.msgs || []).forEach((m, j) => {
            out.push(`  - **${m.from}**：${m.text} ${A(`${p}.options[${k}].msgs[${j}].text`, 'msg')}`);
          });
        });
        out.push('');
        break;
      }
      case 'quiz': {
        out.push('');
        out.push(`### 〔${n.tag || '随堂练'}〕${n.time || ''}　${n.title}`);
        out.push('');
        if (n.intro) out.push(`${n.intro} ${A(`${p}.intro`, 'block')}`, '');
        (n.questions || []).forEach((q, k) => {
          out.push(`**第 ${k + 1} 题**`);
          out.push('');
          out.push(`${q.q} ${A(`${p}.questions[${k}].q`, 'q')}`);
          out.push('');
          (q.options || []).forEach((t, j) => {
            out.push(`- ${t} ${A(`${p}.questions[${k}].options[${j}]`, 'item')}`);
          });
          if (q.explain) out.push('', `*解析：*${q.explain} ${A(`${p}.questions[${k}].explain`, 'explain')}`);
          out.push('');
        });
        break;
      }
      case 'hotline': {
        out.push('', `### 〔电话〕${n.callTitle || ''}${n.number ? `　拨打 ${n.number}` : ''}`, '');
        (n.steps || []).forEach((s, k) => {
          if (s.text) out.push('', `**${s.who || '接线员'}**：${s.text} ${A(`${p}.steps[${k}].text`, 'msg')}`);
          if (s.ask) {
            out.push('', `**▸ ${s.ask}** ${A(`${p}.steps[${k}].ask`, 'prompt')}`, '');
            (s.options || []).forEach((o, j) => {
              out.push(`- ${o.text} ${A(`${p}.steps[${k}].options[${j}].text`, 'opt')}`);
              if (o.reply) out.push(`  - ↳ **接线员**：${o.reply} ${A(`${p}.steps[${k}].options[${j}].reply`, 'reply')}`);
            });
          }
        });
        out.push('');
        break;
      }
      case 'govform':
      case 'govprogress':
        out.push('', '*〔政务平台面板〕表单与答复文本由程序生成，不在此处编辑。*', '');
        break;
      case 'branch': {
        out.push('', '---', '');
        if (Array.isArray(n.outcomes)) {
          out.push('**〔支线结果判定〕** 材料是否充分、是否区分批次、是否走完校内与外部两条线、有没有急着公开指控。', '');
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
        out.push(e ? `## ★ 结局：${e.name}（${e.kind}）` : `## ★ 支线结果：${SIDE_ENDING_NAMES[n.id] || n.id}`);
        out.push('', `\`ending: ${n.id}\``, '');
        break;
      }
      case 'hub': out.push('', '**〔调查中枢〕** 玩家自由选择行动，见本节末尾「自由活动」。', ''); break;
      case 'end': out.push('', '**— 本章结束 —**', ''); break;
      case 'if': out.push('', '*〔条件分支〕以下两组台词按条件二选一。*', ''); break;
      default: out.push(`*〔${n.t}〕*`);
    }
  });
}

function renderChapter(ch, out) {
  out.push('', '---', '');
  out.push(`# ${ch.title} · ${ch.name}`);
  out.push('');
  out.push(`*${ch.dayLabel || ''}${ch.apMax ? '　|　行动点 ' + ch.apMax : ''}　|　源文件：\`scripts/data/${ch.id}.js\`*`);
  out.push('');
  renderScript(ch.nodes || [], `${ch.id}:nodes`, out);

  const acts = ch.hubActions || [];
  if (acts.length) {
    out.push('', '## 自由活动（调查中枢）', '');
    acts.forEach((a, k) => {
      const no = String(k + 1).padStart(2, '0');
      out.push('', `### 行动 ${no}　${a.title} ${A(`${ch.id}:hubActions[${k}].title`, 'atitle')}${a.once ? '　*(仅一次)*' : ''}`);
      out.push('');
      out.push(`*分类：${a.tag || ''}${a.desc ? '　|　提示：' + a.desc : ''}*`);
      out.push('');
      renderScript(a.script || [], `${ch.id}:hubActions[${k}].script`, out, '#####');
    });
  }

  const evts = ch.hubEvents || [];
  if (evts.length) {
    out.push('', '## 定时事件', '');
    evts.forEach((e, k) => {
      out.push('', `### 事件 \`${e.id}\`（第 ${e.after} 次行动后触发）`, '');
      renderScript(e.script || [], `${ch.id}:hubEvents[${k}].script`, out);
    });
  }

  if (ch.summary) {
    const s = ch.summary;
    out.push('', '## 章末小结卡', '');
    out.push(`**${s.title || ''}**${s.subtitle ? '　·　' + s.subtitle : ''}`);
    if (s.quote) out.push('', `> ${s.quote} ${A(`${ch.id}:summary.quote`, 'quote')}`);
    if (s.known && s.known.length) {
      out.push('', '**已知：**');
      s.known.forEach((t, i) => out.push(`- ${t} ${A(`${ch.id}:summary.known[${i}]`, 'item')}`));
    }
    if (s.unknown && s.unknown.length) {
      out.push('', '**未知：**');
      s.unknown.forEach((t, i) => out.push(`- ${t} ${A(`${ch.id}:summary.unknown[${i}]`, 'item')}`));
    }
  }
}

function doExport(target) {
  const out = [];
  out.push('# 《周日不返校》剧情全文 · 可编辑版');
  out.push('');
  out.push('> **这份文件可以改。** 改完说一声「更新回去」，或执行 `node tools/story-md.mjs import`。');
  out.push('');
  out.push('**怎么改**');
  out.push('');
  out.push('1. 只改中文正文、台词、选项文字。想改长改短、改语气、整段重写都可以。');
  out.push('2. 每段行末那个 `<!--#…-->` 是位置编号，**不要删、不要改、不要换行拆开**。');
  out.push('   文字怎么改都不影响它定位；它丢了，这一段就同步不回去。');
  out.push('3. 段落之间的空行、`**角色**：` 前缀、`- ` 列表符号请保留 —— ');
  out.push('   程序靠它们区分「旁白」「台词」「选项」。');
  out.push('4. 标记**之后**的内容（`→ 跳转`、`（获得材料…）`）是说明，随便动都不影响剧情。');
  out.push('5. **不要用自动格式化**（Prettier、Markdown 整理之类），它会把段落折行、把标记挪位。');
  out.push('6. 想删掉整段：把这一行删掉即可。回写时会列出「哪些段不见了」，');
  out.push('   确认后一起删（不会自动删，防止误删）。');
  out.push('7. `〔场景〕``〔音乐〕``〔立绘〕` 是演出指令；`#### 分支标签`、`↳ 跳转到` 是流程控制。');
  out.push('   这些不在本次回写范围内，要改直接说。');
  out.push('8. 章节标题、行动标题带标记但只用于定位，标题文字本身改了不会生效。');
  out.push('');
  out.push('阅读约定：直排正文＝旁白；`**角色**：台词`＝对白；`- `＝选项或条目。');
  out.push('');

  out.push('## 目录');
  out.push('');
  CHAPTERS.forEach((ch, i) => out.push(`${i + 1}. ${ch.title} · ${ch.name}（\`${ch.id}\`）`));
  out.push('');

  CHAPTERS.forEach((ch) => renderChapter(ch, out));

  const items = collectAll();
  const chars = items.reduce((a, b) => a + b.old.length, 0);
  out.push('', '---', '');
  out.push(`*导出时间：${new Date().toISOString().slice(0, 10)}　可编辑段落 ${items.length} 段　正文 ${chars} 字　约 ${(chars / 300).toFixed(0)} 分钟*`);
  out.push('');

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out.join('\n'), 'utf8');
  console.log(`已导出：${target}`);
  console.log(`可编辑段落：${items.length} 段　正文 ${chars} 字　约 ${(chars / 300).toFixed(0)} 分钟`);
  return target;
}

/* =========================================================
   三、解析 md
   ========================================================= */

const RE_ANCHOR = /<!--#([A-Za-z0-9_]+:[^@>]+)@([a-z]+)-->/g;

function stripDecoration(kind, raw) {
  // 先去掉列表符号（含嵌套项的前导缩进），后面再按类型剥前缀
  let t = raw.trim().replace(/^[-*]\s+/, '');
  switch (kind) {
    case 'say': t = t.replace(/^\*\*[^*]*\*\*：/, ''); break;
    case 'note': t = t.replace(/^〔作者注〕/, ''); break;
    case 'msg': t = t.replace(/^〔[^〕]*〕/, '').replace(/^\*\*[^*]+\*\*：/, ''); break;
    case 'opt': t = t.replace(/^\*\*[A-Z]\.\*\* /, ''); break;
    case 'item': break;
    case 'quote': t = t.replace(/^> /, ''); break;
    case 'prompt':
      t = t.replace(/^\*\*▸ ?(选择：|聊天回复：)?/, '').replace(/\*\*$/, '');
      break;
    case 'reply': t = t.replace(/^↳ \*\*[^*]+\*\*：/, ''); break;
    case 'atitle': t = t.replace(/^### 行动 \d+　/, ''); break;
    case 'explain': t = t.replace(/^\*解析：\*/, ''); break;
    default: break;
  }
  return t.trim();
}

/**
 * 每一行可能有多个锚点：上一个锚点之后到本锚点之前的文字，就是本锚点的内容。
 * 锚点之后没有别的锚点时，剩下的文字是说明（跳转、副作用），丢弃。
 */
function parseMd(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('<!--#')) continue;
    const marks = [...line.matchAll(RE_ANCHOR)];
    if (!marks.length) continue;
    let prev = 0;
    for (const m of marks) {
      const seg = line.slice(prev, m.index);
      prev = m.index + m[0].length;
      const value = stripDecoration(m[2], seg);
      if (value) map.set(m[1], value);
    }
  }
  return map;
}

/* =========================================================
   四、回写
   ========================================================= */

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
const lit = (s) => `'${esc(s)}'`;

function doImport(mdPath) {
  const file = path.resolve(mdPath || DEFAULT_MD);
  if (!fs.existsSync(file)) {
    console.error(`找不到：${file}`);
    process.exit(1);
  }
  const parsed = parseMd(fs.readFileSync(file, 'utf8'));
  const items = collectAll();

  const byFile = new Map();
  const seen = new Set();
  const missingMark = [];

  for (const it of items) {
    seen.add(it.id);
    const next = parsed.get(it.id);
    if (next === undefined) { missingMark.push(it.id); continue; }
    if (next === it.old) continue;
    if (!byFile.has(it.file)) byFile.set(it.file, []);
    byFile.get(it.file).push(it.id + ' | ' + it.old);
  }

  const unknown = [...parsed.keys()].filter((id) => !seen.has(id));

  let total = 0;
  for (const [rel, list] of byFile) {
    const abs = path.join(ROOT, rel);
    let src = fs.readFileSync(abs, 'utf8');
    const patches = [];
    let cursor = 0;

    for (const entry of list) {
      const sep = entry.indexOf(' | ');
      const id = entry.slice(0, sep);
      const oldText = entry.slice(sep + 3);
      const next = parsed.get(id);
      const target = lit(oldText);
      let at = src.indexOf(target, cursor);
      if (at < 0) at = src.indexOf(target);
      if (at < 0) {
        console.warn(`  ! ${rel} 里找不到这段原文（源码可能已被改动）：${id}`);
        continue;
      }
      patches.push({ start: at, end: at + target.length, text: lit(next), id });
      cursor = at + target.length;
    }

    patches.sort((a, b) => b.start - a.start);
    for (const p of patches) {
      src = src.slice(0, p.start) + p.text + src.slice(p.end);
      total++;
    }
    fs.writeFileSync(abs, src, 'utf8');
    console.log(`  ${rel}：${patches.length} 处`);
  }

  console.log('');
  console.log(`共更新 ${total} 段文字。`);
  if (missingMark.length) {
    console.log(`md 中缺少标记（未改动）：${missingMark.length} 段`);
    missingMark.slice(0, 10).forEach((id) => console.log(`  - ${id}`));
  }
  if (unknown.length) {
    console.log(`md 中有无法识别的标记（已忽略）：${unknown.length} 个`);
    unknown.slice(0, 10).forEach((id) => console.log(`  - ${id}`));
  }
  if (!total) console.log('没有检测到文字变化。');
  return total;
}

/* =========================================================
   五、verify
   ========================================================= */

function doVerify() {
  const tmp = path.join(ROOT, 'docs', '.tmp-verify.md');
  doExport(tmp);
  const parsed = parseMd(fs.readFileSync(tmp, 'utf8'));
  const items = collectAll();
  let bad = 0;
  for (const it of items) {
    const got = parsed.get(it.id);
    if (got !== it.old) {
      bad++;
      if (bad <= 12) {
        console.log(`  不一致：${it.id}`);
        console.log(`    原文：${JSON.stringify(it.old)}`);
        console.log(`    回读：${JSON.stringify(got)}`);
      }
    }
  }
  fs.unlinkSync(tmp);
  console.log(bad
    ? `自检失败：${bad} 段对不上（共 ${items.length} 段）`
    : `自检通过：${items.length} 段往返一致`);
  return bad;
}

/* =========================================================
   入口
   ========================================================= */

const mode = process.argv[2] || 'export';
const arg = process.argv[3];
if (mode === 'export') doExport(arg ? path.resolve(arg) : DEFAULT_MD);
else if (mode === 'import') doImport(arg);
else if (mode === 'verify') process.exitCode = doVerify() ? 1 : 0;
else {
  console.log('用法：node tools/story-md.mjs [export|import|verify] [路径]');
  process.exit(1);
}
