import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const WWW = path.join(ROOT, 'build', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(WWW, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(8095, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1280, height: 800 });
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const night of [true, false]) {
  await page.goto('http://127.0.0.1:8095/', { waitUntil: 'networkidle0' });
  await page.evaluate((v) => { const s = JSON.parse(localStorage.getItem('zbnx.settings') || '{}'); s.nightMode = v; localStorage.setItem('zbnx.settings', JSON.stringify(s)); }, night);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(800);
  await page.evaluate(() => document.querySelector('[data-act="new"]')?.click()); await wait(500);
  await page.evaluate(() => document.querySelector('#disclaimerOk')?.click()); await wait(12000);
  await page.evaluate(() => document.querySelector('#btnPhone')?.click()); await wait(900);
  const info = await page.evaluate(() => {
    const out = [];
    let n = document.querySelector('.mos-clock');
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      out.push({ cls: String(n.className).slice(0, 30), bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 60), color: cs.color });
      n = n.parentElement;
    }
    return out;
  });
  console.log(night ? 'DARK' : 'LIGHT');
  info.forEach(x => console.log('  ', JSON.stringify(x)));
  await page.screenshot({ path: path.join(ROOT, 'build', `_mos-${night ? 'dark' : 'light'}.png`) });
}
await b.close(); server.close();
