/* 查更新日志里哪几张配图没加载出来 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const BASE = 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 892 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 1400));
await page.evaluate(async () => {
  const s = document.querySelector('#bootSkip'); if (s) s.click();
  const bs = document.querySelector('#bootSeq'); if (bs) bs.remove();
  await new Promise(r => setTimeout(r, 120));
});
await new Promise(r => setTimeout(r, 1200));
await page.evaluate(() => window.__ZBNX.ui.openChangelog());
await new Promise(r => setTimeout(r, 4000));
const r = await page.evaluate(() => {
  const shots = [...document.querySelectorAll('.clog-shot')];
  return shots.map(s => {
    const im = s.querySelector('img');
    return {
      src: im ? im.getAttribute('src') : '(无 img)',
      w: im ? im.naturalWidth : 0,
      complete: im ? im.complete : false,
      currentSrc: im ? im.currentSrc : '',
      parent: s.parentElement ? s.parentElement.className : ''
    };
  });
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
