// 竖屏游戏内界面截图（对话 + 立绘 + 顶栏）
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(8097, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await page.goto('http://127.0.0.1:8097/index.html', { waitUntil: 'networkidle0' });
await wait(1600);
await page.evaluate(() => document.body.classList.add('is-portrait'));
// 造一个对话场景
await page.evaluate(() => {
  document.querySelector('#titleScreen').hidden = true;
  const game = document.querySelector('#game');
  game.hidden = false;
  const dlg = document.querySelector('.dialogue');
  dlg.hidden = false;
  const name = dlg.querySelector('.dlg-name');
  if (name) name.textContent = '林小满';
  const txt = dlg.querySelector('.dlg-text');
  if (txt) txt.textContent = '十六岁该有点自己的东西，这话我也听人说过。冰汽水，天台的晚风，夕阳底下偷偷看一眼的谁……';
  document.querySelector('#hudChapter').textContent = '第一章';
  document.querySelector('#hudDay').textContent = '九月一日 · 周一';
});
await wait(900);
await page.screenshot({ path: path.join(ROOT, 'build', '_verify-portrait-game.png') });
const dlg = await page.evaluate(() => {
  const d = document.querySelector('.dialogue');
  const b = d.querySelector('.dlg-body');
  const r = d.getBoundingClientRect(), rb = b.getBoundingClientRect();
  return { dlgTop: Math.round(r.top), dlgH: Math.round(r.height), bodyH: Math.round(rb.height),
    vh: window.innerHeight, ratio: +(rb.height / window.innerHeight).toFixed(3),
    overflowX: r.left < -1 || r.right > window.innerWidth + 1 };
});
console.log('对话区:', JSON.stringify(dlg));
await browser.close(); server.close();
