/* =========================================================
   支线二《直饮水》自动化通关测试
   ---------------------------------------------------------
   目的：确认支线二能在真实浏览器里从入口走到结局，
        并且三种典型玩法分别落到预期结果：
        A 隐藏结局《最后一杯》（证据齐 + 问到了人 + 保留校内追问 + 不公开指责）
        B 只有程序进展（什么都不查，直接走流程）
        C 陷入争议（核实前就在群里公开说）

   运行：node tools/test-side2.mjs
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2'
};

const web = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const PORT = await new Promise(r => web.listen(0, '127.0.0.1', () => r(web.address().port)));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(400);

const snap = () => page.evaluate(() => {
  const NX = window.__ZBNX;
  const panelOpen = !document.querySelector('#panelLayer').hidden;
  return {
    ending: NX.state.ending,
    chapter: NX.state.chapterId,
    ap: NX.state.ap,
    blocked: NX.engine.blocked,
    typing: NX.engine.typing,
    hub: !document.querySelector('#hubLayer').hidden,
    choice: !document.querySelector('#choiceLayer').hidden,
    reply: !!document.querySelector('#phoneBody .wx-reply button[data-reply]'),
    chatNext: !!document.querySelector('#chatContinueBtn'),
    panel: panelOpen,
    matTake: panelOpen && !!document.querySelector('#matTake'),
    hot: panelOpen && !!document.querySelector('.hot'),
    govForm: panelOpen && !!document.querySelector('#govForm'),
    receipt: panelOpen && !!document.querySelector('#gvProgress'),
    govProgress: panelOpen && !!document.querySelector('#gvOk'),
    summary: panelOpen && !!document.querySelector('#sumNext'),
    title: !document.querySelector('#titleScreen').hidden,
    hubTitles: [...document.querySelectorAll('#hubGrid .hub-card .hn')].map(e => e.textContent.trim()),
    choiceTexts: [...document.querySelectorAll('#choiceLayer .choice-item')].map(e => e.textContent.trim()),
    replyTexts: [...document.querySelectorAll('#phoneBody .wx-reply button[data-reply]')].map(e => e.textContent.trim()),
    hotTexts: [...document.querySelectorAll('.hot-opt')].map(e => e.textContent.trim()),
    hotNext: !!document.querySelector('#hotFoot .hot-btn'),
    mats: (NX.state.materials || []).filter(m => /^M0(4|5)/.test(m)),
    flags: Object.keys(NX.state.flags || {}).filter(k => k.startsWith('side2_')),
    text: (document.querySelector('#dlgText') || {}).textContent || '',
    frames: NX.engine.frames.map(f => ({ key: f.key, i: f.i }))
  };
});

/* 单步推进：优先处理需要玩家操作的那一层 */
async function step(strategy) {
  const s = await snap();
  if (s.ending) return { done: true, s };

  if (s.matTake) {
    await page.evaluate(() => document.querySelector('#matTake')?.click());
    await sleep(120);
    return { done: false, s };
  }
  if (s.govForm) {
    await page.evaluate(() => {
      const chip = document.querySelector('#gvType .gov-chip');
      if (chip) chip.click();
      const d = document.querySelector('#gvDesc');
      if (d) {
        d.value = '教学楼三楼直饮水机出水有异味，出水口有水垢，机身维护记录最后一次填写为去年十月八日，公示的检测报告为去年十月十六日。';
        d.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const q = (document.querySelector('#gvCodeQ') || {}).textContent || '';
      const m = /(\d+)\s*([+\-*])\s*(\d+)/.exec(q);
      let ans = '';
      if (m) {
        const a = Number(m[1]); const b = Number(m[3]);
        ans = String(m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b);
      }
      const code = document.querySelector('#gvCode');
      if (code) { code.value = ans; code.dispatchEvent(new Event('input', { bubbles: true })); }
      const p = document.querySelector('#gvPromise');
      if (p && !p.checked) p.click();
      document.querySelector('#gvSubmit')?.click();
    });
    await sleep(260);
    return { done: false, s };
  }
  if (s.receipt) {
    await page.evaluate(() => document.querySelector('#gvProgress')?.click());
    await sleep(260);
    return { done: false, s };
  }
  if (s.govProgress) {
    await page.evaluate(() => document.querySelector('#gvOk')?.click());
    await sleep(200);
    return { done: false, s };
  }
  if (s.hot) {
    if (s.hotTexts.length) {
      // 有选项：按策略选一项
      const idx = strategy.pickHot(s.hotTexts);
      await page.evaluate((i) => {
        const b = document.querySelectorAll('.hot-opt')[i];
        if (b) b.click();
      }, idx);
      await sleep(200);
    } else {
      // 普通对话行：点「继续」
      await page.evaluate(() => document.querySelector('#hotFoot .hot-btn')?.click());
      await sleep(120);
    }
    return { done: false, s };
  }
  if (s.reply) {
    const idx = strategy.pickReply(s.replyTexts);
    await page.evaluate((i) => {
      const b = document.querySelectorAll('#phoneBody .wx-reply button[data-reply]')[i];
      if (b) b.click();
    }, idx);
    await sleep(120);
    return { done: false, s };
  }
  if (s.chatNext) {
    await page.click('#chatContinueBtn');
    await sleep(120);
    return { done: false, s };
  }
  if (s.choice) {
    const idx = strategy.pickChoice(s.choiceTexts);
    await page.evaluate((i) => {
      const b = document.querySelectorAll('#choiceLayer .choice-item')[i];
      if (b) b.click();
    }, idx);
    await sleep(150);
    return { done: false, s };
  }
  if (s.hub) {
    const pick = strategy.pickAction(s.hubTitles);
    if (pick < 0) {
      await page.click('#hubLeave');
      await sleep(200);
      return { done: false, s };
    }
    await page.evaluate((i) => {
      const b = document.querySelectorAll('#hubGrid .hub-card')[i];
      if (b) b.click();
    }, pick);
    await sleep(200);
    return { done: false, s };
  }
  if (s.title) return { done: true, s };

  await page.evaluate(() => {
    const dlg = document.querySelector('#dialogue');
    if (dlg && !dlg.hidden) dlg.click();
    else document.querySelector('#stage').click();
  });
  await sleep(45);
  return { done: false, s };
}

let stuckKey = '';
let playedTexts = 0;

async function play(name, strategy, maxSteps = 5000) {
  await page.evaluate(() => window.__ZBNX.go('side2'));
  await sleep(400);

  let last = null;
  let stuck = 0;
  const texts = new Set();
  for (let i = 0; i < maxSteps; i++) {
    const { done, s } = await step(strategy);
    last = s;
    if (s.text) texts.add(s.text);
    playedTexts = texts.size;
    if (done) break;
    const key = JSON.stringify({ f: s.frames, h: s.hub, c: s.choice, r: s.reply, cn: s.chatNext, ho: s.hot });
    if (key === stuckKey) stuck++; else { stuck = 0; stuckKey = key; }
    if (stuck > 200) throw new Error(`${name}: 疑似卡死（${stuck} 步无变化）`);
  }
  return last;
}

/* ---------------- 三种玩法 ---------------- */
const STRATEGIES = {
  // A：记录、报修、实测、空白表、公示、喝过的人 一样不缺，最后走政务平台
  hidden: {
    pickAction(titles) {
      const pref = [
        '去后勤要滤芯更换记录',
        '去保健室要报修单复印件',
        '借一支 TDS 笔测一测',
        '要一张空白的维护记录',
        '问公示为什么不放到网上',
        '问三班那个转学的孩子',
        '往外面递一份'
      ];
      for (const p of pref) {
        const i = titles.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return -1;
    },
    pickChoice(texts) {
      const pref = ['把公示看仔细', '整理成一份书面追问', '网上填表'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; },
    pickHot(texts) {
      const pref = ['滤芯', '有同学喝完拉肚子', '核实滤芯更换和检测记录', '留个姓就行'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    }
  },
  // B：什么都不查，只把公示看一眼
  lazy: {
    pickAction() { return -1; },
    pickChoice(texts) {
      const pref = ['把公示看仔细', '先在班里说一句'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; },
    pickHot() { return 0; }
  },
  // C：没拿到记录，就在班里先说了
  rush: {
    pickAction(titles) {
      const i = titles.findIndex(t => t.includes('把这件事发到班群'));
      return i >= 0 ? i : -1;
    },
    pickChoice(texts) {
      const pref = ['把公示看仔细', '先在班里说一句'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; },
    pickHot() { return 0; }
  }
};

const expect = { hidden: 'side_filter', lazy: 'side_procedural2', rush: 'side_dispute2' };
let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  if (ok) { pass++; console.log(`✓ ${label}${extra ? '：' + extra : ''}`); }
  else { fail++; console.log(`✗ ${label}${extra ? '：' + extra : ''}`); }
};

for (const [name, strat] of Object.entries(STRATEGIES)) {
  console.log(`\n== 玩法 ${name} ==`);
  let s = null;
  try {
    s = await play(name, strat);
  } catch (e) {
    check(false, `${name} 流程`, e.message);
    continue;
  }
  check(s && s.ending === expect[name], `${name} 结局`, `期望 ${expect[name]}，实际 ${s && s.ending}（支线材料 ${s && s.mats.length}）`);
  if (s) console.log(`   材料：${JSON.stringify(s.mats)}\n   标记：${JSON.stringify(s.flags)}`);
  check(s && s.frames && s.frames.length >= 1, `${name} 帧栈正常`, JSON.stringify(s && s.frames));
  console.log(`   本次共显示 ${playedTexts} 条正文/台词`);
}

/* 入口：标题页支线按钮 + 支线路口里出现两条 */
await page.evaluate(() => { window.location.reload(); });
await sleep(1400);
const hasSideBtn = await page.evaluate(() => !!document.querySelector('.tbtn-side'));
check(hasSideBtn, '标题页存在支线入口');

// 解锁状态：模拟已完成序章
await page.evaluate(() => {
  localStorage.setItem('zbnx.progress', JSON.stringify({ chapters: ['ch0'], sides: {} }));
});
await page.evaluate(() => { window.location.reload(); });
await sleep(1400);
const hubCount = await page.evaluate(() => {
  document.querySelector('[data-act="side"]')?.click();
  return document.querySelectorAll('#panelBody [data-side]').length;
});
check(hubCount === 3, '支线路口列出 3 条支线', `实际 ${hubCount}`);
const side2Enabled = await page.evaluate(() => {
  const b = document.querySelector('#panelBody [data-side="side2"]');
  return b ? !b.disabled : false;
});
check(side2Enabled, '支线二《直饮水》已开放');

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.close();
process.exit(fail ? 1 : 0);
