/* 截图辅助：进游戏并展开 HUD（自动跳过启动序列） */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const WWW = path.join(ROOT, 'build', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(WWW, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(8094, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1280, height: 800 });
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function enterGame(night) {
  await page.goto('http://127.0.0.1:8094/', { waitUntil: 'networkidle0' });
  await page.evaluate((v) => { const s = JSON.parse(localStorage.getItem('zbnx.settings') || '{}'); s.nightMode = v; localStorage.setItem('zbnx.settings', JSON.stringify(s)); }, night);
  await page.reload({ waitUntil: 'networkidle0' }); await wait(900);
  await page.evaluate(() => document.querySelector('[data-act="new"]')?.click()); await wait(700);
  await page.evaluate(() => document.querySelector('#disclaimerOk')?.click()); await wait(900);
  // 启动序列：直接跳过（点按钮或强制隐藏都行，这里只是要一张游戏内截图）
  for (let i = 0; i < 14; i++) {
    const done = await page.evaluate(() => {
      const bs = document.querySelector('#bootSeq');
      if (!bs || bs.hidden) return true;
      const btn = document.querySelector('#bootSkip');
      if (btn && !btn.hidden) { btn.click(); return false; }
      bs.remove(); return true;
    });
    if (done) break;
    await wait(600);
  }
  await page.evaluate(() => { const bs = document.querySelector('#bootSeq'); if (bs) bs.hidden = true; });
  await wait(1500);
}

if (process.argv[1].endsWith('_shot2.mjs')) {
  for (const night of [false, true]) {
    await enterGame(night);
    await page.evaluate(() => { const bs = document.querySelector('#bootSeq'); if (bs) bs.remove(); });
    await wait(400);
    await page.evaluate(() => document.querySelector('#hudToggle')?.click()); await wait(700);
    // 模拟明亮的教室背景（真实截图里游戏画面是亮色，HUD 压在上面最容易糊）
    await page.evaluate(() => {
      const st = document.querySelector('#stage') || document.querySelector('.stage') || document.querySelector('#game');
      if (st) { st.style.background = 'linear-gradient(180deg,#dfe7ef 0%,#f3efe6 60%,#e8e2d6 100%)'; }
      document.querySelectorAll('.stage-bg,.bg-layer,#bg,.scene-bg').forEach(e => e.style.background = '#e8e2d6');
    });
    await wait(500);
    console.log('  state', await page.evaluate(() => ({
      boot: !!document.querySelector('#bootSeq'),
      bootHidden: document.querySelector('#bootSeq')?.hidden,
      titleHidden: document.querySelector('#titleScreen')?.hidden,
      gameHidden: document.querySelector('#game')?.hidden,
      hudMin: document.querySelector('#hud')?.classList.contains('is-min'),
      bootStageText: (document.querySelector('#bootStage')?.textContent || '').slice(0, 30)
    })));
    await page.screenshot({ path: path.join(ROOT, 'build', `_hud2-${night ? 'dark' : 'light'}.png`) });
    console.log(night ? 'DARK ok' : 'LIGHT ok');
  }
  await b.close(); server.close();
}
