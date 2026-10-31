// 竖屏适配验证：模拟真机竖屏（393×852），检查顶栏按钮、标题页页脚、浮窗遮挡
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
await new Promise(r => server.listen(8094, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:8094/index.html', { waitUntil: 'networkidle0' });
await wait(1600);

// 强制竖屏排版（真机上由设置/原生方向决定，这里直接打 class 验证 CSS）
await page.evaluate(() => document.body.classList.add('is-portrait'));
await wait(600);

// 1. 标题页：页脚是否完整可读、是否被浮窗压住
const titleCheck = await page.evaluate(() => {
  const foot = document.querySelector('.title-footer');
  const fr = foot.getBoundingClientRect();
  const screen = document.querySelector('#titleScreen');
  const sr = screen.getBoundingClientRect();
  // 页脚是否完全在可视区里（可滚动则允许）
  const scrollable = screen.scrollHeight > screen.clientHeight + 2;
  const fabs = [...document.querySelectorAll('#feedbackFab, #aiFab')].map(f => {
    const r = f.getBoundingClientRect();
    return { id: f.id, top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), text: f.textContent.trim() };
  });
  return {
    footBottom: Math.round(fr.bottom), footH: Math.round(fr.height),
    screenH: Math.round(sr.height), scrollable,
    scrollH: screen.scrollHeight, clientH: screen.clientHeight,
    fabs
  };
});
console.log('标题页:', JSON.stringify(titleCheck));

// 2. 顶栏：每个按钮的文字是否单行（用 Range 量实际排版行数，不能靠高度猜）
await page.evaluate(() => { document.querySelector('#titleScreen').hidden = true; document.querySelector('#game').hidden = false; });
await wait(800);
const hudCheck = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.hud-right .hbtn')].map(b => {
    const r = b.getBoundingClientRect();
    // 量文字实际占了几行：Range 包住第一个文本节点，取它的 client rects 高度
    const node = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    let lines = 1;
    if (node) {
      const rg = document.createRange();
      rg.selectNodeContents(node);
      lines = rg.getClientRects().length || 1;
    }
    return { t: b.textContent.trim().slice(0, 4), w: Math.round(r.width), h: Math.round(r.height), lines };
  });
  const right = document.querySelector('.hud-right');
  return {
    btns,
    allSingleLine: btns.every(b => b.lines <= 1),
    scrollW: right.scrollWidth, clientW: right.clientWidth,
    canScroll: right.scrollWidth > right.clientWidth,
    overflowY: right.scrollHeight > right.clientHeight + 1
  };
});
console.log('顶栏:', JSON.stringify(hudCheck));

// 3. 竖屏下对话框是否出界
const dlgCheck = await page.evaluate(() => {
  const d = document.querySelector('.dialogue');
  if (!d) return { none: true };
  const r = d.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), vh: window.innerHeight,
    overflow: r.left < -1 || r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1 };
});
console.log('对话框:', JSON.stringify(dlgCheck));

await page.screenshot({ path: path.join(ROOT, 'build', '_verify-portrait.png') });
console.log('JS 错误:', errors.length ? errors.join(' | ') : '无');
await browser.close();
server.close();
