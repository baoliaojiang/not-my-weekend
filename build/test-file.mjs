/* 验证打包后的站点能在 file:// 下直接运行（APK / EXE 都用这套资源） */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const url = 'file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html';
const errors = [];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
page.on('requestfailed', r => errors.push('REQFAIL ' + r.url()));

await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 900));
await page.screenshot({ path: 'D:/workbuddy/2026-10-23-16-33-10/build/shot-file-title.png' });

await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await new Promise(r => setTimeout(r, 1400));
await page.screenshot({ path: 'D:/workbuddy/2026-10-23-16-33-10/build/shot-file-game.png' });

const info = await page.evaluate(() => ({
  title: !document.querySelector('#titleScreen').hidden,
  chapter: window.__ZBNX ? window.__ZBNX.state.chapterId : null,
  text: document.querySelector('#dlgText').textContent.slice(0, 40),
  bg: getComputedStyle(document.querySelector('#bgA')).backgroundImage.slice(0, 60),
  font: getComputedStyle(document.querySelector('#dlgText')).fontFamily
}));

console.log(JSON.stringify(info, null, 1));
console.log('errors:', errors.length ? errors.join('\n') : '(none)');
await browser.close();
