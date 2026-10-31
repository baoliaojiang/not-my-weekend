/* =========================================================
   支线《一元口罩》自动化通关测试
   ---------------------------------------------------------
   目的：确认支线在真实浏览器里能从标题页走到结局，
        并且三种典型玩法分别落到预期结果：
        A 隐藏结局（查清批次 + 校内校外都走到 + 追问已售出 + 不公开指控）
        B 部分查明（什么都没查，只跟着流程走）
        C 各执一词（没分批次就把话发到群里）

   运行：node tools/test-side.mjs
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
  const vis = (id) => { const el = document.querySelector(id); return !!el && !el.hidden && el.offsetParent !== null; };
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
    // 新拿到的材料：必须点「收下」才会继续剧情
    matTake: panelOpen && !!document.querySelector('#matTake'),
    govForm: panelOpen && !!document.querySelector('#govForm'),
    receipt: panelOpen && !!document.querySelector('#gvProgress'),
    govProgress: panelOpen && !!document.querySelector('#gvOk, .gv-ok, #prOk'),
    hotOpt: panelOpen && !!document.querySelector('#hotFoot .hot-opt'),
    hotBtn: panelOpen && !!document.querySelector('#hotFoot .hot-btn:not([disabled])'),
    quiz: panelOpen && !!document.querySelector('.quiz'),
    summary: panelOpen && !!document.querySelector('#sumNext'),
    title: !document.querySelector('#titleScreen').hidden,
    hubTitles: [...document.querySelectorAll('#hubGrid .hub-card .hn')].map(e => e.textContent.trim()),
    choiceTexts: [...document.querySelectorAll('#choiceLayer .choice-item')].map(e => e.textContent.trim()),
    replyTexts: [...document.querySelectorAll('#phoneBody .wx-reply button[data-reply]')].map(e => e.textContent.trim()),
    matCount: (NX.state.materials || []).length,
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
  /* 政务服务平台：填完必填项提交（验证码是页面上那道口算） */
  if (s.govForm) {
    await page.evaluate(() => {
      const chip = document.querySelector('#gvType .gov-chip');
      if (chip) chip.click();
      const d = document.querySelector('#gvDesc');
      if (d) {
        d.value = '校内以一元购得应急口罩一只，包装标示有效期至二〇二三年十二月，同箱另有二〇二二年一月的批次。';
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
  /* 提交回执：点「查看办理进度」继续 */
  if (s.receipt) {
    await page.evaluate(() => document.querySelector('#gvProgress')?.click());
    await sleep(260);
    return { done: false, s };
  }
  /* 政务进度页：点「知道了」关掉 */
  if (s.govProgress) {
    await page.evaluate(() => {
      const b = document.querySelector('#gvOk, .gv-ok, #prOk');
      if (b) b.click();
      else document.querySelector('#panelClose')?.click();
    });
    await sleep(200);
    return { done: false, s };
  }
  /* 12345 通话：有选项就选第一个，有「继续」就点 */
  if (s.hotOpt) {
    await page.evaluate(() => document.querySelector('#hotFoot .hot-opt')?.click());
    await sleep(220);
    return { done: false, s };
  }
  if (s.hotBtn) {
    await page.evaluate(() => document.querySelector('#hotFoot .hot-btn:not([disabled])')?.click());
    await sleep(220);
    return { done: false, s };
  }
  if (s.quiz) {
    // 课堂小测：全部选第一个选项，交卷，然后点「继续」
    await page.evaluate(() => {
      document.querySelectorAll('.qz').forEach(qEl => {
        const b = qEl.querySelector('.qz-opt[data-o="0"]');
        if (b) b.click();
      });
    });
    await sleep(80);
    await page.evaluate(() => document.querySelector('#qzSubmit')?.click());
    await sleep(300);
    await page.evaluate(() => document.querySelector('#qzOk')?.click());
    await sleep(200);
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
  if (s.title) return { done: true, s }; // 兜底，避免死循环

  // 普通对话：点一下推进
  await page.evaluate(() => {
    const dlg = document.querySelector('#dialogue');
    if (dlg && !dlg.hidden) dlg.click();
    else document.querySelector('#stage').click();
  });
  await sleep(45);
  return { done: false, s };
}

async function play(name, strategy, maxSteps = 4000) {
  await page.evaluate(() => window.__ZBNX.go('side1'));
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
    // 卡死检测：帧位置与可见层都没变化
    const key = JSON.stringify({ f: s.frames, h: s.hub, c: s.choice, r: s.reply, cn: s.chatNext });
    if (key === stuckKey) stuck++; else { stuck = 0; stuckKey = key; }
    if (stuck > 200) throw new Error(`${name}: 疑似卡死（${stuck} 步无变化）`);
  }
  return last;
}
let stuckKey = '';
let playedTexts = 0;

/* ---------------- 三种玩法 ---------------- */

const STRATEGIES = {
  // A：分清批次 + 问过那一百四十七块 + 校内留书面 + 走政务平台 + 答复后补材料
  hidden: {
    pickAction(titles) {
      const pref = ['对批号', '看那本《临时收费登记》', '往外面递一份'];
      for (const p of pref) {
        const i = titles.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return -1;
    },
    pickChoice(texts) {
      const pref = ['找后勤吴主任', '写一份书面追问', '市政府门户网站', '补一份材料'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; }
  },
  // B：什么都不查，直接离开，收束时也只在校内问一句
  lazy: {
    pickAction() { return -1; },
    pickChoice(texts) {
      const pref = ['什么也不说', '先在校内问到答复为止'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; }
  },
  // C：没分批次，就把话发到群里
  rush: {
    pickAction(titles) {
      const i = titles.findIndex(t => t.includes('发到家长群'));
      return i >= 0 ? i : -1;
    },
    pickChoice(texts) {
      const pref = ['什么也不说', '先在校内问到答复为止'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; }
  }
};

const expect = { hidden: 'side_coin', lazy: 'side_procedural', rush: 'side_dispute' };
let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  if (ok) { pass++; console.log(`✓ ${label}${extra ? '：' + extra : ''}`); }
  else { fail++; console.log(`✗ ${label}${extra ? '：' + extra : ''}`); }
};

for (const [name, strat] of Object.entries(STRATEGIES)) {
  console.log(`\n== 玩法 ${name} ==`);
  const s = await play(name, strat);
  const mats = s ? s.matCount : 0;
  check(s && s.ending === expect[name], `${name} 结局`, `期望 ${expect[name]}，实际 ${s && s.ending}（材料 ${mats}）`);
  check(s && s.frames && s.frames.length >= 1, `${name} 帧栈正常`, JSON.stringify(s && s.frames));
  console.log(`   本次共显示 ${playedTexts} 条正文/台词`);
}

/* 标题页入口 */
await page.evaluate(() => window.__ZBNX.go('ch0'));
await sleep(200);
await page.evaluate(() => { window.location.reload(); });
await sleep(1200);
const hasSideBtn = await page.evaluate(() => !!document.querySelector('.tbtn-side'));
check(hasSideBtn, '标题页存在支线入口');
const sideLabel = await page.evaluate(() => (document.querySelector('.tbtn-side') || {}).textContent?.replace(/\s+/g, '') || '');
check(sideLabel === '支线', '支线入口只显示「支线」', sideLabel);

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.close();
process.exit(fail ? 1 : 0);
