/* =========================================================
   HUD 收起 / 展开 交互验证
   ---------------------------------------------------------
   用户的要求（两轮都提过）：
     · 收起时画面上只留左上角（或右上角）一个小圆入口，不要整条横遮罩
     · 展开时才显示那条横向的按钮遮罩
   这条脚本把两种状态都量一遍：
     · 收起时可见的按钮数量（应为 0）
     · 展开时可见的按钮数量（应 > 0）
     · 两种状态下 hud-right 的可见性与遮罩透明度
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd(); const WWW = path.join(ROOT, 'build', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(WWW, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(8093, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:8093/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' }); await wait(900);
await page.evaluate(() => document.querySelector('[data-act="new"]')?.click()); await wait(700);
await page.evaluate(() => document.querySelector('#disclaimerOk')?.click()); await wait(900);
for (let i = 0; i < 14; i++) {
  const done = await page.evaluate(() => {
    const bs = document.querySelector('#bootSeq');
    if (!bs) return true;
    const btn = document.querySelector('#bootSkip');
    if (btn && !btn.hidden) { btn.click(); return false; }
    bs.remove(); return true;
  });
  if (done) break;
  await wait(600);
}
await wait(1200);

const snap = () => page.evaluate(() => {
  const hud = document.querySelector('#hud');
  const nav = document.querySelector('#hudNav');
  const isl = document.querySelector('#hudToggle');
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && r.height > 0; };
  const btns = [...document.querySelectorAll('#hudNav .hbtn')];
  const hudCs = getComputedStyle(hud);
  return {
    isMin: hud.classList.contains('is-min'),
    islandVisible: vis(isl),
    islandSize: isl ? [Math.round(isl.getBoundingClientRect().width), Math.round(isl.getBoundingClientRect().height)] : null,
    navVisible: vis(nav),
    navBg: getComputedStyle(nav).backgroundColor,
    visibleButtons: btns.filter(vis).length,
    totalButtons: btns.length,
    hudPointerEvents: hudCs.pointerEvents,
    hudImg: hudCs.backgroundImage.slice(0, 70),
    // 收起时画面上不能残留横向遮罩：hud 本身不该有渐变压暗
    hudHasGradient: /gradient/.test(hudCs.backgroundImage),
    // 收起时小圆入口应贴在角上（宽高都是小尺寸）
    islandRect: isl ? (r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }))(isl.getBoundingClientRect()) : null
  };
});

const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

let s = await snap();
console.log('收起态:', JSON.stringify(s));
check(s.isMin === true, '初始应为收起态');
check(s.navVisible === false, '收起时按钮条应不可见');
check(s.visibleButtons === 0, `收起时不应有可见按钮（实际 ${s.visibleButtons}）`);
check(s.islandVisible === true, '收起时应留一个小入口');
check(s.islandSize && s.islandSize[0] <= 60 && s.islandSize[1] <= 60, `小入口应是小圆钮（实际 ${s.islandSize}）`);
check(s.hudHasGradient === false, '收起时顶栏不该残留横向渐变遮罩');

await page.evaluate(() => document.querySelector('#hudToggle')?.click());
await wait(500);
s = await snap();
console.log('展开态:', JSON.stringify(s));
check(s.isMin === false, '点击后应展开');
check(s.navVisible === true, '展开时按钮条应可见');
check(s.visibleButtons > 0, '展开时按钮应可见');
check(s.hudHasGradient === true, '展开时顶栏应出现横向遮罩');

await page.evaluate(() => document.querySelector('#hudCollapse')?.click());
await wait(500);
s = await snap();
console.log('再收起:', JSON.stringify(s));
check(s.isMin === true, '点 × 应重新收起');
check(s.visibleButtons === 0, '收起后不应残留可见按钮');

console.log('\n结果：', fail.length ? 'FAIL\n - ' + fail.join('\n - ') : '全部通过');
await b.close(); server.close();
process.exit(fail.length ? 1 : 0);
