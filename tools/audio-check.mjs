/* 检查音频链路：进入游戏后 Web Audio 图是否搭起来、增益是否合理 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(500);
await page.mouse.click(640, 400);           // 触发一次手势
await sleep(900);

const s1 = await page.evaluate(() => {
  const a = window.__ZBNX.audio;
  return {
    ctx: a._ctx ? a._ctx.state : null,
    gains: a._trackGains ? a._trackGains.map(g => +g.gain.value.toFixed(3)) : null,
    currentId: a.currentId,
    active: a.active,
    paused: a.tracks.map(t => t.paused),
    volumes: a.tracks.map(t => +t.volume.toFixed(2))
  };
});
console.log('标题页:', JSON.stringify(s1));

// 进游戏
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(1500);
await page.evaluate(() => {
  for (let i = 0; i < 12; i++) document.querySelector('#dialogue').click();
});
await sleep(1200);

const s2 = await page.evaluate(() => {
  const a = window.__ZBNX.audio;
  return {
    ctx: a._ctx ? a._ctx.state : null,
    gains: a._trackGains ? a._trackGains.map(g => +g.gain.value.toFixed(3)) : null,
    currentId: a.currentId,
    paused: a.tracks.map(t => t.paused),
    srcs: a.tracks.map(t => (t.currentSrc || '').split('/').pop())
  };
});
console.log('游戏中:', JSON.stringify(s2));
console.log('errors:', errs.length ? errs : '(none)');
await browser.close();
