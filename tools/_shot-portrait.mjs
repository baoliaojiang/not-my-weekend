// 竖屏标题页截图专用
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
await new Promise(r => server.listen(8096, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await page.goto('http://127.0.0.1:8096/index.html', { waitUntil: 'networkidle0' });
await wait(1600);
await page.evaluate(() => document.body.classList.add('is-portrait'));
await wait(600);
await page.screenshot({ path: path.join(ROOT, 'build', '_verify-portrait-title.png') });
// 滚到底看页脚
await page.evaluate(() => { const s = document.querySelector('#titleScreen'); s.scrollTop = s.scrollHeight; });
await wait(400);
await page.screenshot({ path: path.join(ROOT, 'build', '_verify-portrait-title-bottom.png') });
const info = await page.evaluate(() => {
  const s = document.querySelector('#titleScreen');
  const f = document.querySelector('.title-footer');
  return { scrollH: s.scrollHeight, clientH: s.clientHeight, footTop: Math.round(f.getBoundingClientRect().top), footBottom: Math.round(f.getBoundingClientRect().bottom) };
});
console.log('标题页滚动:', JSON.stringify(info));
await browser.close(); server.close();
