import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 700));

const shot = async (n) => { await p.screenshot({ path: `build/v-${n}.png` }); console.log('shot', n); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const tapStage = async (n) => {
  for (let i = 0; i < n; i++) { await p.evaluate(() => { const s = document.querySelector('#stage'); s && s.click(); }); await wait(70); }
};

// 1) 开新游戏：先看有没有存档提示（此时还没有存档，应直接进免责声明）
await p.evaluate(() => document.querySelector('[data-act="new"]').click());
await wait(400);
await shot('01-disclaimer');

// 2) 进游戏，走一段，让自动存档落地
await p.evaluate(() => document.querySelector('#disclaimerOk').click());
await wait(900);
await tapStage(30);
await shot('02-game');
await p.evaluate(() => window.__ZBNX.save(0));
await wait(200);

// 3) 回标题 → 再点开始游戏，此时应弹「覆盖自动存档」确认框
await p.evaluate(() => window.__ZBNX.backToTitle());
await wait(600);
await p.evaluate(() => document.querySelector('[data-act="new"]').click());
await wait(450);
const hasConfirm = await p.evaluate(() => !!document.getElementById('confirmMask'));
await shot('03-confirm-overwrite');
console.log('confirm shown:', hasConfirm);
await p.evaluate(() => { const c = document.querySelector('[data-cfm="cancel"]'); c && c.click(); });
await wait(300);

// 4) 继续游戏：一级（章列表）
await p.evaluate(() => document.querySelector('[data-act="continue"]').click());
await wait(500);
await shot('04-continue-list');
const chCount = await p.evaluate(() => document.querySelectorAll('[data-ch]').length);
console.log('chapters listed:', chCount);

// 5) 点第一章 → 二级（横向时间轴 + 分支）
await p.evaluate(() => { const c = document.querySelector('[data-ch]'); c && c.click(); });
await wait(500);
await shot('05-continue-timeline');
const tl = await p.evaluate(() => {
  const t = document.querySelector('#tlx');
  return t ? { nodes: t.querySelectorAll('.tlx-node').length, scrollW: t.scrollWidth, clientW: t.clientWidth } : null;
});
const br = await p.evaluate(() => document.querySelectorAll('.tlx-branch').length);
console.log('timeline:', JSON.stringify(tl), 'branches:', br);
await p.evaluate(() => { const c = document.querySelector('#panelClose'); c && c.click(); });
await wait(300);

// 6) 设置：分段控件圆角 + 通透模式开关
await p.evaluate(() => document.querySelector('[data-act="settings"]').click());
await wait(450);
await shot('06-settings-rounded');
const hasGlass = await p.evaluate(() => !!document.getElementById('glassToggle'));
console.log('glass toggle present:', hasGlass);

// 7) 开通透模式，看玻璃效果
await p.evaluate(() => document.getElementById('glassToggle').click());
await wait(500);
await shot('07-glass-settings');
const cls = await p.evaluate(() => document.body.className);
console.log('body class:', cls);
await p.evaluate(() => { const c = document.querySelector('#panelClose'); c && c.click(); });
await wait(350);
await shot('08-glass-title');

// 8) 玻璃模式下的游戏画面
await p.evaluate(() => document.querySelector('[data-act="continue"]').click());
await wait(400);
await p.evaluate(() => { const r = document.querySelector('#contResume'); if (r) r.click(); });
await wait(1200);
await tapStage(6);
await shot('09-glass-game');

// 9) 关掉通透模式，确认回到实色
await p.evaluate(() => { window.__ZBNX.backToTitle(); });
await wait(600);
await p.evaluate(() => document.querySelector('[data-act="settings"]').click());
await wait(400);
await p.evaluate(() => document.getElementById('glassToggle').click());
await wait(300);
const cls2 = await p.evaluate(() => document.body.className);
console.log('body class after off:', cls2);

console.log('errors:', errs.length ? errs : '(none)');
await b.close();
