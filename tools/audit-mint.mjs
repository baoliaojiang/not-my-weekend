/* =========================================================
   手机功能全量点击审计
   ---------------------------------------------------------
   把手机上每个 App、每个 App 里每个可点的东西都点一遍，
   记录哪些点下去只有一句"还没有做"的 toast —— 那些就是没做的功能。

   用法：node tools/audit-mint.mjs [--shots]
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd(); const WWW = path.join(ROOT, 'build', 'www');
const SHOTS = process.argv.includes('--shots');
const OUTDIR = path.join(ROOT, 'build', '_mint');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(WWW, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(8092, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:8092/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' }); await wait(900);
await page.evaluate(() => document.querySelector('[data-act="new"]')?.click()); await wait(700);
await page.evaluate(() => document.querySelector('#disclaimerOk')?.click()); await wait(900);
for (let i = 0; i < 14; i++) {
  const done = await page.evaluate(() => {
    const bs = document.querySelector('#bootSeq'); if (!bs) return true;
    const btn = document.querySelector('#bootSkip');
    if (btn && !btn.hidden) { btn.click(); return false; }
    bs.remove(); return true;
  });
  if (done) break; await wait(500);
}
await wait(1200);

/* 抓 toast 文本 */
await page.evaluate(() => {
  window.__toasts = [];
  const orig = window.__ZBNX.ui.toast.bind(window.__ZBNX.ui);
  window.__ZBNX.ui.toast = (msg, d) => { window.__toasts.push(String(msg)); return orig(msg, d); };
});

const APPS = ['chat', 'dial', 'campus', 'browser', 'ai', 'note', 'gallery', 'music', 'camera',
  'clock', 'weather', 'store', 'games', 'files', 'chain', 'calc', 'people', 'timeline',
  'save', 'settings', 'changelog', 'about'];

const openPhone = async () => {
  await page.evaluate(() => { const u = window.__ZBNX.ui; u.closePanel(); });
  await wait(300);
  await page.evaluate(() => document.querySelector('#btnPhone')?.click());
  await wait(700);
};

const report = [];
for (const app of APPS) {
  await openPhone();
  const opened = await page.evaluate((appId) => {
    const u = window.__ZBNX.ui;
    if (!u || !u._phoneApp) return false;
    u._phoneApp(appId, appId);
    return true;
  }, app);
  await wait(700);
  if (!opened) { report.push([app, '打不开']); continue; }

  // 列出当前页所有可点元素
  const clickables = await page.evaluate(() => {
    const body = document.querySelector('#panelBody');
    if (!body) return [];
    return [...body.querySelectorAll('button, [data-cp], [data-app], [data-notice], [data-scat], [data-score], [data-album], [data-mint-back], [data-mos-exit], input, select, textarea')]
      .filter(e => !e.disabled && e.offsetParent !== null)
      .map((e, i) => ({
        i, tag: e.tagName.toLowerCase(),
        id: e.id || '',
        data: Object.keys(e.dataset || {}).join(','),
        text: (e.textContent || '').trim().slice(0, 18),
        cls: String(e.className).slice(0, 30)
      }));
  });

  // 逐个点，记录 toast
  for (const c of clickables) {
    if (c.data.includes('mint-back') || c.data.includes('mos-exit')) continue;
    await page.evaluate(() => { window.__toasts = []; });
    await page.evaluate((idx) => {
      const body = document.querySelector('#panelBody');
      const list = [...body.querySelectorAll('button, [data-cp], [data-app], [data-notice], [data-scat], [data-score], [data-album], input, select, textarea')]
        .filter(e => !e.disabled && e.offsetParent !== null);
      const el = list[idx];
      if (el) el.click();
    }, c.i);
    await wait(450);
    const toasts = await page.evaluate(() => window.__toasts || []);
    const bad = toasts.filter(t => /还没有做|只做了|Demo 里|没做/.test(t));
    if (bad.length) report.push([app, `${c.text || c.cls || c.tag} → ${bad[0]}`]);
    // 有页面跳转了就返回上一层继续
    const depth = await page.evaluate(() => (window.__ZBNX.ui._mintStack || []).length);
    if (depth > 1) {
      await page.evaluate(() => { const u = window.__ZBNX.ui; u._mintBack(); });
      await wait(400);
    }
  }
  if (SHOTS) { fs.mkdirSync(OUTDIR, { recursive: true }); await page.screenshot({ path: path.join(OUTDIR, app + '.png') }); }
}

console.log('\n=== 点了之后只有"没做"提示的入口 ===');
if (!report.length) console.log('  无：所有可点入口都有真实反应');
else report.forEach(([a, t]) => console.log(`  [${a}] ${t}`));
await b.close(); server.close();
