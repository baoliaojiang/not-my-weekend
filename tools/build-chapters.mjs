/* =========================================================
   story.json → scripts/data/ch*.js
   ---------------------------------------------------------
   把《重写3.docx》解析出来的行，转换成引擎的节点数组。

   用法：node tools/build-chapters.mjs [--dry]
        --dry  只统计不写文件

   映射原则
   --------
   - 场景台词一句不删，只做资源映射（背景/音乐/立绘）。
   - 文档里的玩法块（小游戏、属性、条件）在解析阶段已剔除。
   - 成就 → flag + 一行提示；情报 → flag；关系 Lv → stat。
   - 结局锚点 → ending 节点，直接用现有的八个结局 id。
   - 跨章 goto（goto ch1）→ end，由主流程接下一章。
   ========================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '.workbuddy', 'tmp', 'story.json');
const DRY = process.argv.includes('--dry');

const story = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/* ---------------- 角色映射 ---------------- */

// 文档里的说话人 → 引擎角色 id。null = 没有立绘的路人
const SPEAKER = {
  林知序: { id: 'lin', sprite: null },
  沈予安: { id: 'shen', sprite: 'shen' },
  陈老师: { id: 'chen', sprite: 'chen' },
  郑野: { id: 'zheng', sprite: 'zheng' },
  周予晴: { id: 'zhou', sprite: 'zhou' },
  孙芃: { id: 'sun', sprite: 'sun' },
  吴老师: { id: 'wu', sprite: 'wu' },
  妈妈: { id: 'mom', sprite: null },
  数学老师: { id: 'math', sprite: null },
  英语老师: { id: 'eng', sprite: null },
  语文老师: { id: 'chi', sprite: null },
  唐老师: { id: 'tang', sprite: null },
  后勤老师: { id: 'logi', sprite: null },
  男老师: { id: 'mteach', sprite: null },
  女老师: { id: 'fteach', sprite: null },
  老师: { id: 'teacher', sprite: null },
  班主任: { id: 'chen', sprite: 'chen' },
  男生: { id: 'boy', sprite: null },
  女生: { id: 'girl', sprite: null },
  保安: { id: 'guard', sprite: null },
  门卫: { id: 'guard', sprite: null },
  接线员: { id: 'operator', sprite: null },
  对方: { id: 'other', sprite: null },
  爸爸: { id: 'dad', sprite: null },
  女人: { id: 'woman', sprite: null },
  男人: { id: 'man', sprite: null },
  短袖男人: { id: 'man2', sprite: null },
  穿衬衫的男人: { id: 'man3', sprite: null },
  卷发妈妈: { id: 'p1', sprite: null },
  眼镜妈妈: { id: 'p2', sprite: null },
  夹克爸爸: { id: 'p3', sprite: null },
  男生的妈妈: { id: 'p4', sprite: null },
  劳动委员: { id: 'lab', sprite: null },
  许清和: { id: 'xqh', sprite: null },
  '？？？': { id: 'unk', sprite: null },
  我: { id: 'lin', sprite: null },
  沈予安小声: { id: 'shen', sprite: 'shen' },
  郑野在群里: { id: 'zheng', sprite: 'zheng' }
};

const DISPLAY = {
  lin: '林知序', shen: '沈予安', chen: '陈老师', zheng: '郑野', zhou: '周予晴',
  sun: '孙芃', wu: '吴老师', mom: '妈妈', math: '数学老师', eng: '英语老师',
  chi: '语文老师', tang: '唐老师', logi: '后勤老师', mteach: '男老师',
  fteach: '女老师', teacher: '老师', boy: '男生', girl: '女生', guard: '门卫',
  operator: '接线员', other: '对方', dad: '爸爸', woman: '女人', man: '男人',
  man2: '短袖男人', man3: '穿衬衫的男人', p1: '卷发妈妈', p2: '眼镜妈妈',
  p3: '夹克爸爸', p4: '男生的妈妈', lab: '劳动委员', xqh: '许清和', unk: '？？？'
};

/* ---------------- 背景映射 ---------------- */

function hourOf(s) {
  const m = s.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  if (/深夜|夜里|凌晨/.test(s)) return 23;
  if (/晚自习|晚上|夜间|傍晚后/.test(s)) return 20;
  if (/傍晚|放学/.test(s)) return 17;
  if (/午休|中午|正午/.test(s)) return 12.5;
  if (/早读|清晨|早晨|早/.test(s)) return 7;
  return null;
}

// 手机/界面类场景：不切背景，观感上保持在同一处
const UI_SCENE = /手机|屏幕|便笺|相册|截图|群聊|薄聊|界面|页面|消息|工单|表单页面|搜索框|输入框|浏览器/;

function pickBg(scene) {
  const h = hourOf(scene);
  const night = h !== null ? (h >= 18.5 || h < 6) : /夜/.test(scene);
  const dusk = h !== null && h >= 16 && h < 18.5;
  const dawn = h !== null && h < 8;

  const has = (...kw) => kw.some((k) => scene.includes(k));

  if (has('校门', '大门', '门柱', '栅栏')) return night ? 'gateNight' : dusk ? 'gateDusk' : 'gate';
  if (has('小卖部', '超市', '副食')) return night ? 'shopNight' : 'shop';
  if (has('食堂', '餐厅', '打饭')) return 'canteen';
  if (has('医务', '校医', '保健')) return 'infirmary';
  if (has('礼堂', '体育馆', '报告厅', '主席台', '开学典礼')) return 'auditorium';
  if (has('操场', '跑道', '草地', '升旗', '集合')) return night ? 'skyDusk' : 'townDay';
  if (has('天台', '楼顶')) return 'skyDusk';
  if (has('办公室', '年级组', '教务处', '后勤', '办公楼', '教研')) return 'hallwayEnd';
  if (has('广播', '机房', '实验楼')) return 'studio';
  if (has('家 · 客厅', '客厅', '餐桌', '玄关', '沙发')) return 'homeLiving';
  if (has('家', '房间', '书桌', '卧室', '阳台', '床')) return night ? 'bedroom' : 'bedroom';
  if (has('公交', '车站', '路口', '街', '路上', '回家', '小区', '便利店')) {
    return night ? 'streetNight' : dusk ? 'streetDusk' : 'streetDay';
  }
  if (has('教室', '班', '课桌', '讲台', '黑板', '自习')) {
    return night ? 'classroomNight' : dusk ? 'classroomDusk' : 'classroom';
  }
  if (has('走廊', '楼梯', '楼道', '过道', '公告栏', '橱窗', '大厅')) {
    if (night) return 'corridorNight';
    if (dusk) return 'corridorDusk';
    if (dawn) return 'corridorDawn';
    return 'corridor';
  }
  if (has('公共', '活动室', '阅览', '图书馆', '社团')) return night ? 'commonsDusk' : 'commons';
  return night ? 'classroomNight' : dusk ? 'classroomDusk' : 'classroom';
}

/* ---------------- 音乐映射 ---------------- */

const MUSIC = {
  prologue: 'title',
  daily: 'daily',
  calm: 'calm',
  calm2: 'calm2',
  night: 'night_street',
  tension: 'tense',
  morning: 'hall',
  sad: 'silent',
  hope: 'hope'
};

/* ---------------- 材料 ---------------- */

const MAT_TYPES = {
  M203: ['通知', '公告栏'],
  M201: ['通知', '饮水机'],
  M305: ['通知', '班主任'],
  M309: ['通知', '家长会'],
  M404: ['文件', '教育局'],
  M502: ['文件', '省级'],
  M504: ['通知', '家长会']
};

/* ---------------- 手工接线：条件分支 / 尾声 ---------------- */

// 文档里有一段「沈予安在公交站」的空白分支（c2_bus_quiet），
// 原稿标注「仅当第二章选了 sign_c（不接话）才插入」。引擎用 if 节点还原。
const COND_INSERTS = {
  ch2: [{ onGoto: 'c2_bus', label: 'c2_bus_quiet', flag: 'br_sign_c' }]
};

// 某些标签需要打标记，供上面的条件判断
const FLAG_AT_LABEL = {
  ch2: { sign_c: 'br_sign_c' }
};

/* ---------------- 生成 ---------------- */

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const SKIP_SCENE_IF = /手机|屏幕|便笺|相册/;

function build(ch) {
  const rows = ch.rows;

  // 找最后一个 ending 之后的「尾声块」：该块不含 label/choice，纯收尾
  let lastEnding = -1;
  rows.forEach((r, i) => { if (r.k === 'ending') lastEnding = i; });
  let outroStart = -1;
  if (lastEnding >= 0) {
    for (let i = lastEnding + 1; i < rows.length; i++) {
      if (rows[i].k === 'label') { outroStart = i; break; }
      if (rows[i].k === 'choice' || rows[i].k === 'opt') break;
    }
  }
  const outroRows = outroStart >= 0 ? rows.slice(outroStart + 1) : [];

  const nodes = [];
  let shown = new Set();
  let pendingChoice = null;
  const push = (n) => nodes.push(n);
  const flushChoice = () => { if (pendingChoice) { nodes.push(pendingChoice); pendingChoice = null; } };

  const conds = COND_INSERTS[ch.id] || [];
  const flagsAt = FLAG_AT_LABEL[ch.id] || {};

  // 当前是否正处在某个标签块内部
  let curLabel = null;
  const inBlock = (name) => curLabel === name;

  const emit = (row) => {
    const { k, v } = row;
    switch (k) {
      case 'scene': {
        if (UI_SCENE.test(v)) {
          if (!nodes.some((n) => n.t === 'bg')) {
            push({ t: 'bg', id: 'bedroom', place: v });
          }
          break;
        }
        if (shown.size) { push({ t: 'hide', all: true }); shown = new Set(); }
        push({ t: 'bg', id: pickBg(v), place: v });
        break;
      }
      case 'music': push({ t: 'music', id: MUSIC[v] || 'daily' }); break;
      case 'show': {
        const t = SPEAKER[v.who];
        if (!t || !t.sprite) break;
        push({ t: 'show', id: t.sprite, pos: v.pos || 'center' });
        shown.add(t.sprite);
        break;
      }
      case 'hide': {
        const t = SPEAKER[v];
        if (!t || !t.sprite) break;
        push({ t: 'hide', id: t.sprite });
        shown.delete(t.sprite);
        break;
      }
      case 'say': {
        const t = SPEAKER[v.who] || { id: 'npc', sprite: null };
        const node = { t: 'say', who: t.id, name: DISPLAY[t.id] || v.who, text: v.text };
        if (t.sprite) node.sprite = t.sprite;
        push(node);
        break;
      }
      case 'narr': push({ t: 'narr', text: v }); break;
      case 'choice':
        flushChoice();
        pendingChoice = { t: 'choice', prompt: v || '怎么选？', options: [] };
        break;
      case 'opt': {
        if (!pendingChoice) pendingChoice = { t: 'choice', prompt: '怎么选？', options: [] };
        const o = { text: v.text };
        if (v.goto) o.goto = v.goto;
        pendingChoice.options.push(o);
        break;
      }
      case 'label': {
        flushChoice();
        curLabel = v;
        push({ t: 'label', name: v });
        if (flagsAt[v]) push({ t: 'flag', key: flagsAt[v] });
        break;
      }
      case 'goto': {
        flushChoice();
        for (const c of conds) {
          // 只插一次，且避免插在该分支自己内部（否则会自己跳自己）
          if (c.onGoto === v && !c.done && !inBlock(c.label)) {
            c.done = true;
            push({ t: 'if', cond: c.flag, thenLabel: c.label });
          }
        }
        if (/^ch\d|^side\d/.test(v)) push({ t: 'end' });
        else push({ t: 'goto', label: v });
        break;
      }
      case 'mat': push({ t: 'mat', id: v.id }); break;
      case 'ending': {
        flushChoice();
        push({ t: 'ending', id: v });
        push(outroRows.length ? { t: 'goto', label: '__outro' } : { t: 'end' });
        break;
      }
      case 'ach': push({ t: 'flag', key: v.id }); break;
      case 'info': push({ t: 'flag', key: 'info_' + Math.abs(hash(v)).toString(36) }); break;
      case 'rel': {
        const t = SPEAKER[v.who];
        if (t) push({ t: 'stat', who: t.id, trust: (v.to - v.from) * 6 });
        break;
      }
      default: break;
    }
  };

  for (let i = 0; i < rows.length; i++) {
    if (outroStart >= 0 && i >= outroStart) break; // 尾声单独放到最后
    emit(rows[i]);
  }
  flushChoice();

  // 尾声：所有结局共用一份，避免复制
  if (outroRows.length) {
    push({ t: 'label', name: '__outro' });
    for (const r of outroRows) emit(r);
    flushChoice();
    push({ t: 'end' });
  }

  if (!nodes.length || nodes[0].t !== 'bg') nodes.unshift({ t: 'bg', id: 'classroom', place: ch.name });
  const last = nodes[nodes.length - 1];
  if (last.t !== 'end' && last.t !== 'ending') nodes.push({ t: 'end' });
  return nodes;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function dumpNode(n) {
  if (n.t === 'if') {
    // 条件分支：判断某个分支标记是否被走过
    return `{ t: 'if', cond: (s) => !!(s.flags && s.flags.${n.cond}), then: '${n.thenLabel}' }`;
  }
  const parts = [];
  for (const [key, val] of Object.entries(n)) {
    if (key === 't') continue;
    if (typeof val === 'string') parts.push(`${key}: ${q(val)}`);
    else if (typeof val === 'number') parts.push(`${key}: ${val}`);
    else if (typeof val === 'boolean') parts.push(`${key}: ${val}`);
    else if (key === 'options') {
      const opts = val.map((o) => {
        const seg = [`text: ${q(o.text)}`];
        if (o.goto) seg.push(`goto: ${q(o.goto)}`);
        return `{ ${seg.join(', ')} }`;
      });
      parts.push(`options: [\n        ${opts.join(',\n        ')}\n      ]`);
    }
  }
  return `{ t: '${n.t}', ${parts.join(', ')} }`;
}

const DAY_LABEL = {
  ch0: '九月一日 · 周一', ch1: '九月一日—三日', ch2: '九月三日 · 周三',
  ch3: '九月五日 · 周五', ch4: '九月八日 · 周一', ch5: '九月十二日 · 周五',
  ch6: '九月二十日 · 周六', side1: '九月 · 支线', side2: '九月 · 支线',
  side3: '九月 · 支线', side4: '九月 · 支线', side5: '九月 · 支线'
};

const report = [];
for (const ch of story.chapters) {
  const nodes = build(ch);
  const body = nodes.map((n) => '    ' + dumpNode(n)).join(',\n');
  const chars = nodes.filter((n) => n.t === 'narr' || n.t === 'say')
    .reduce((a, b) => a + b.text.length, 0);

  const head = `/* =========================================================
   ${ch.title} · ${ch.name}
   ---------------------------------------------------------
   由《重写3.docx》自动转换，请改文档后重新运行：
     python tools/docx_to_story.py
     node tools/build-chapters.mjs
   ========================================================= */

export default {
  id: ${q(ch.id)},
  title: ${q(ch.title)},
  name: ${q(ch.name)},
  dayLabel: ${q(DAY_LABEL[ch.id] || '')},
  music: 'daily',

  nodes: [
${body}
  ]
};
`;
  const out = path.join(ROOT, 'scripts', 'data', `${ch.id}.js`);
  if (!DRY) fs.writeFileSync(out, head, 'utf8');
  report.push({ id: ch.id, nodes: nodes.length, chars });
}

console.log('章节'.padEnd(8) + '节点'.padStart(6) + '字数'.padStart(9));
let tn = 0, tc = 0;
for (const r of report) {
  console.log(r.id.padEnd(8) + String(r.nodes).padStart(6) + String(r.chars).padStart(9));
  tn += r.nodes; tc += r.chars;
}
console.log(`合计 ${tn} 节点 / ${tc} 字 / 约 ${(tc / 300).toFixed(0)} 分钟${DRY ? '（未写文件）' : ''}`);
