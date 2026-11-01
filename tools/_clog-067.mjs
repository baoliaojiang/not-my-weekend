/* 检查 0.6.7.0 更新日志渲染是否正常 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const BASE = 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 892, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  for (let i = 0; i < 12; i++) {
    const b = document.querySelector('#bootSkip'); if (b) b.click();
    const bs = document.querySelector('#bootSeq'); if (bs) bs.remove();
    const d = document.querySelector('#disclaimer');
    const ok2 = document.querySelector('#disclaimerOk'); if (ok2) ok2.click();
    await new Promise(r => setTimeout(r, 120));
  }
});
await new Promise(r => setTimeout(r, 800));

const r = await page.evaluate(() => {
  const ui = window.__ZBNX.ui;
  ui.openChangelog();
  const body = document.querySelector('.panel-body') || document.body;
  const txt = body.innerText || '';
  return {
    hasVer: txt.includes('0.6.7.0'),
    hasFix: txt.includes('手机端导入存档拉不起文件管理器'),
    hasPhone: txt.includes('电话里不再只有薄荷一个人'),
    hasPerf: txt.includes('优化了性能与功耗'),
    len: txt.length
  };
});
console.log(JSON.stringify(r, null, 2));
console.log('页面错误：', errs.length ? errs.slice(0, 5) : '无');
await page.screenshot({ path: 'D:/workbuddy/2026-10-23-16-33-10/tools/shots/clog-067.png' });
await browser.close();
