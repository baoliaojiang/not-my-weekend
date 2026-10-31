/* 支线截图：开场 / 中枢 / 后勤主任立绘 / 手机端标题与对话 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = path.join(ROOT, 'build', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };

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

async function makePage(w, h, mobile) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
  await sleep(500);
  // 跳过免责声明
  await page.evaluate(() => { const b = document.querySelector('#disclaimerOk') || document.querySelector('#disclaimer button'); if (b) b.click(); });
  await sleep(300);
  return page;
}

const clickDlg = (page) => page.evaluate(() => {
  const d = document.querySelector('#dialogue');
  if (d && !d.hidden) d.click(); else document.querySelector('#stage').click();
});

// 桌面端
const page = await makePage(1440, 900, false);
await page.screenshot({ path: path.join(OUT, 's01-title.png') });
await page.evaluate(() => window.__ZBNX.go('side1'));
await sleep(500);
for (let i = 0; i < 30; i++) { await clickDlg(page); await sleep(35); }
await page.screenshot({ path: path.join(OUT, 's02-open.png') });

// 走到后勤办公室（找 wu 立绘）
await page.evaluate(() => {
  const ch = window.__ZBNX.chapters.side1;
  const i = ch.nodes.findIndex(n => n.t === 'show' && n.id === 'wu');
  window.__ZBNX.go('side1', i);
});
await sleep(600);
for (let i = 0; i < 6; i++) { await clickDlg(page); await sleep(60); }
await page.screenshot({ path: path.join(OUT, 's03-wu.png') });

// 中枢
await page.evaluate(() => {
  const ch = window.__ZBNX.chapters.side1;
  const i = ch.nodes.findIndex(n => n.t === 'hub');
  window.__ZBNX.go('side1', i);
});
await sleep(800);
await page.screenshot({ path: path.join(OUT, 's04-hub.png') });

// 手机端
const m = await makePage(390, 844, true);
await m.screenshot({ path: path.join(OUT, 's05-m-title.png') });
await m.evaluate(() => window.__ZBNX.go('side1'));
await sleep(500);
for (let i = 0; i < 14; i++) { await clickDlg(m); await sleep(40); }
await m.screenshot({ path: path.join(OUT, 's06-m-open.png') });
await m.evaluate(() => {
  const ch = window.__ZBNX.chapters.side1;
  window.__ZBNX.go('side1', ch.nodes.findIndex(n => n.t === 'hub'));
});
await sleep(700);
await m.screenshot({ path: path.join(OUT, 's07-m-hub.png') });

console.log('已保存截图到 build/shots');
await browser.close();
web.close();
