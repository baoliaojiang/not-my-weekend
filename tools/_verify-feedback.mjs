// 反馈问卷入口验证：按钮存在、位置在薄荷上方、面板内容完整、链接正确
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
await new Promise(r => server.listen(8093, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 860 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('http://127.0.0.1:8093/index.html', { waitUntil: 'networkidle0' });
await wait(1400);

// 1. 按钮存在性与位置
const fabs = await page.evaluate(() => {
  const f = document.querySelector('#feedbackFab');
  const a = document.querySelector('#aiFab');
  if (!f || !a) return { ok: false, hasF: !!f, hasA: !!a };
  const fr = f.getBoundingClientRect(), ar = a.getBoundingClientRect();
  return {
    ok: true, fbText: f.textContent.trim(),
    fbBottom: Math.round(fr.bottom), aiTop: Math.round(ar.top),
    above: fr.bottom <= ar.top + 1,
    visible: fr.width > 0 && fr.height > 0
  };
});
console.log('反馈按钮:', JSON.stringify(fabs));

// 2. 点击打开面板
await page.click('#feedbackFab');
await wait(700);
const panel = await page.evaluate(() => {
  const b = document.querySelector('#panelBody');
  if (!b) return { ok: false };
  const t = b.textContent;
  const link = b.querySelector('a.btn-primary');
  return {
    ok: true,
    hasTypes: t.includes('反馈 BUG') && t.includes('提建议') && t.includes('支线内容投稿') && t.includes('其他'),
    hasQQ: t.includes('QQ 号'), hasAttach: t.includes('附件'),
    hasHelp: !!b.querySelector('.fb-help') && t.includes('问卷里每一项是干什么的'),
    typeCards: b.querySelectorAll('.fb-type').length,
    helpItems: b.querySelectorAll('.fb-help-body li').length,
    linkHref: link ? link.getAttribute('href') : null,
    linkTarget: link ? link.getAttribute('target') : null
  };
});
console.log('反馈面板:', JSON.stringify(panel));

// 3. 展开帮助
await page.evaluate(() => { const d = document.querySelector('.fb-help'); if (d) d.open = true; });
await wait(300);
const helpOpen = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.fb-help-body li')].map(li => li.textContent.trim().slice(0, 26));
  return { count: items.length, first: items[0], last: items[items.length - 1] };
});
console.log('帮助内容:', JSON.stringify(helpOpen));

await page.screenshot({ path: path.join(ROOT, 'build', '_verify-feedback.png') });
console.log('JS 错误:', errors.length ? errors.join(' | ') : '无');
await browser.close();
server.close();
