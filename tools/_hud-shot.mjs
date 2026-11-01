import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const WWW = path.join(ROOT, 'build', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(WWW, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(8096, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1280, height: 800 });
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const night of [false, true]) {
  await page.goto('http://127.0.0.1:8096/', { waitUntil: 'networkidle0' });
  await page.evaluate((v) => { const s = JSON.parse(localStorage.getItem('zbnx.settings') || '{}'); s.nightMode = v; localStorage.setItem('zbnx.settings', JSON.stringify(s)); }, night);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(800);
  await page.evaluate(() => document.querySelector('[data-act="new"]')?.click()); await wait(500);
  await page.evaluate(() => document.querySelector('#disclaimerOk')?.click()); await wait(12000);
  await page.evaluate(() => document.querySelector('#hudToggle')?.click()); await wait(600);
  await page.screenshot({ path: path.join(ROOT, 'build', `_hud-${night ? 'dark' : 'light'}.png`) });
  const info = await page.evaluate(() => {
    const r = document.querySelector('#hudNav'); const h = document.querySelector('#hud');
    const cs = getComputedStyle(r); const hs = getComputedStyle(h);
    const btn = document.querySelector('.hbtn');
    return { hudBg: hs.backgroundColor, hudImg: hs.backgroundImage.slice(0, 80), navBg: cs.backgroundColor, navColor: cs.color, btnColor: btn ? getComputedStyle(btn).color : null, min: h.classList.contains('is-min') };
  });
  console.log(night ? 'DARK' : 'LIGHT', JSON.stringify(info));
}
await b.close(); server.close();
