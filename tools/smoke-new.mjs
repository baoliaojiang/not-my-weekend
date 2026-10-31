/* 新剧本冒烟：从标题进 ch0，连点 400 次，看会不会卡、报错、文本是否在推进 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const url = 'file:///D:/workbuddy/2026-10-23-16-33-10/index.html';
const errors = [];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await new Promise(r => setTimeout(r, 1200));

let last = '';
let stuck = 0;
let maxChapter = 'ch0';
const seen = [];

for (let i = 0; i < 1800; i++) {
  // 章节总结 → 下一章；有选项就选第一个
  const picked = await page.evaluate(() => {
    const next = document.querySelector('#sumNext');
    if (next && next.offsetParent !== null) { next.click(); return 'next'; }
    const opts = document.querySelectorAll('#choiceBox .choice-item');
    if (opts.length) { opts[0].click(); return 'choice'; }
    return null;
  });
  if (!picked) {
    await page.evaluate(() => {
      const b = document.querySelector('#dlgNext, #clickLayer, #stage');
      if (b) b.click();
    });
  }
  await new Promise(r => setTimeout(r, 26));

  const st = await page.evaluate(() => ({
    text: (document.querySelector('#dlgText') || {}).textContent || '',
    ch: window.__ZBNX ? window.__ZBNX.state.chapterId : null,
    panel: !!(document.querySelector('#summaryScreen') && !document.querySelector('#summaryScreen').hidden)
  }));
  if (st.ch && st.ch !== maxChapter) { seen.push(st.ch); maxChapter = st.ch; }
  if (st.text === last) stuck++; else { stuck = 0; last = st.text; }
  if (stuck > 60) { console.log(`!! 卡在第 ${i} 次，章节 ${maxChapter}，文本: ${last.slice(0, 50)}`); break; }
}

const info = await page.evaluate(() => ({
  ch: window.__ZBNX ? window.__ZBNX.state.chapterId : null,
  text: (document.querySelector('#dlgText') || {}).textContent.slice(0, 60),
  idx: window.__ZBNX ? window.__ZBNX.engine.frames.length : -1
}));
await page.screenshot({ path: 'D:/workbuddy/2026-10-23-16-33-10/build/shot-newch0.png' });
console.log(JSON.stringify(info, null, 1));
console.log('经历章节:', seen.join(' → '));
console.log('errors:', errors.length ? errors.slice(0, 6) : '(none)');
await browser.close();
