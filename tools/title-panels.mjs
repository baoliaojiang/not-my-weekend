/* 标题页各按钮回归：设置 / 关于 / 读取存档 → 关闭后必须仍停在标题，不能黑屏 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const OUT = 'D:/workbuddy/2026-10-23-16-33-10/tools/shots-m';
fs.mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W || 800), H = Number(process.env.H || 360);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(600);

const state = () => page.evaluate(() => ({
  title: !document.querySelector('#titleScreen').hidden,
  game: !document.querySelector('#game').hidden,
  panel: !document.querySelector('#panelLayer').hidden,
  titleRect: document.querySelector('#titleScreen').getBoundingClientRect().height,
  ptitle: document.querySelector('#panelTitle').textContent.trim(),
  titleOverflow: document.querySelector('#titleScreen').scrollHeight - document.querySelector('#titleScreen').clientHeight
}));

for (const act of ['settings', 'changelog', 'about', 'load']) {
  await page.evaluate(a => document.querySelector(`[data-act="${a}"]`).click(), act);
  await sleep(450);
  const opened = await state();
  await page.screenshot({ path: `${OUT}/t-${act}.png` });
  await page.evaluate(() => document.querySelector('#panelClose').click());
  await sleep(400);
  const closed = await state();
  await page.screenshot({ path: `${OUT}/t-${act}-back.png` });
  console.log(act, 'open:', JSON.stringify(opened));
  console.log(act, 'back:', JSON.stringify(closed));
  if (!closed.title || closed.game || closed.panel) console.log('!!! FAIL', act);
}

// 音乐状态
const audio = await page.evaluate(() => {
  const a = window.__ZBNX && window.__ZBNX.engine ? null : null;
  return { hidden: document.hidden };
});
console.log('music?', JSON.stringify(audio), 'errors:', errors.length ? errors : '(none)');
await browser.close();
