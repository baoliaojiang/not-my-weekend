/* =========================================================
   支线三《第八节课》自动化通关测试
   ---------------------------------------------------------
   目的：确认支线三能在真实浏览器里从入口走到结局，
        并且三种典型玩法分别落到预期结果：
        A 隐藏结局《那节课从课表上消失了》（课表 + 黑板 + 名单 + 校内书面 + 答复后补名单）
        B 只有程序进展（什么都不查，也不递）
        C 陷入争议（没证据就在学生群里公开说）

   运行：node tools/test-side3.mjs
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
    mats: (NX.state.materials || []).filter(m => /^M0(5|6)/.test(m)),
    flags: Object.keys(NX.state.flags || {}).filter(k => k.startsWith('s3_')),
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
  await page.evaluate(() => window.__ZBNX.go('side3'));
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
  // A：课表、黑板、点名册、自己数人、校内书面，一条不缺，最后从平台递上去并补名单
  hidden: {
    pickAction(titles) {
      const pref = [
        '把课表抄下来',
        '拍下黑板',
        '看点名册',
        '数一数不参加的人',
        '翻家长群',
        '在校内留一份书面',
        '查政策原文',
        '往外面递一份'
      ];
      for (const p of pref) {
        const i = titles.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return -1;
    },
    pickChoice(texts) {
      const pref = ['试运行了一个学期', '网上填表', '补一份材料'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    },
    pickReply() { return 0; },
    pickHot(texts) {
      const pref = ['如果课后服务不能讲新课', '有。我写过一张纸', '留个姓'];
      for (const p of pref) {
        const i = texts.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return 0;
    }
  },
  // B：什么都不查，也不往外面递
  lazy: {
    pickAction() { return -1; },
    pickChoice() { return 2; },
    pickReply() { return 0; },
    pickHot() { return 0; }
  },
  // C：只翻了家长群，然后就在学生群里说了
  rush: {
    pickAction(titles) {
      const pref = ['翻家长群', '在学生群说一句', '往外面递一份'];
      for (const p of pref) {
        const i = titles.findIndex(t => t.includes(p));
        if (i >= 0) return i;
      }
      return -1;
    },
    pickChoice(texts) {
      const pref = ['你为什么不走', '打 12345'];
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

const expect = { hidden: 'side_eighth', lazy: 'side_procedural3', rush: 'side_dispute3' };
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
const side3Enabled = await page.evaluate(() => {
  const b = document.querySelector('#panelBody [data-side="side3"]');
  return b ? !b.disabled : false;
});
check(side3Enabled, '支线三《第八节课》已开放');

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.close();
process.exit(fail ? 1 : 0);
