/* 验证：适龄提示标识、页脚小字、面板开关动画、选项入场、自定义提示词提醒
   用法：node tools/_verify-060.mjs */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(8099, '127.0.0.1', r));

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });

const shots = [];
async function shot(page, name) {
  const f = path.join(ROOT, 'build', name);
  await page.screenshot({ path: f });
  shots.push(name);
}

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('!! pageerror', e.message));
await page.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));   // 等入场动画走完

/* 1. 徽标与页脚 */
const badge = await page.evaluate(() => {
  const b = document.querySelector('#ageBadge');
  const r = b.getBoundingClientRect();
  const img = b.querySelector('img');
  const foot = document.querySelector('.title-footer .foot-age');
  const fr = foot.getBoundingClientRect();
  return {
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    natural: { nw: img.naturalWidth, nh: img.naturalHeight },
    loaded: img.complete && img.naturalWidth > 0,
    footText: foot.textContent.trim().slice(0, 40),
    footVisible: fr.width > 0 && fr.height > 0,
    footSize: getComputedStyle(foot).fontSize,
    staged: document.querySelector('#titleScreen').classList.contains('staged')
  };
});
console.log('徽标：', JSON.stringify(badge));
await shot(page, '_v3-01-title.png');

/* 2. 点开徽标 */
await page.click('#ageBadge');
await new Promise(r => setTimeout(r, 420));
await shot(page, '_v3-02-agebadge.png');
const agePanel = await page.evaluate(() => ({
  title: document.querySelector('#panelTitle').textContent,
  animIn: document.querySelector('#panelLayer').classList.contains('anim-in'),
  panelTransform: getComputedStyle(document.querySelector('#panelLayer .panel')).transform,
  hasNote: !!document.querySelector('.age-badge-note')
}));
console.log('适龄面板：', JSON.stringify(agePanel));

/* 3. 关闭动画：点 ×，170ms 内应还在，之后 hidden */
await page.click('#panelClose');
await new Promise(r => setTimeout(r, 60));
const mid = await page.evaluate(() => ({
  hidden: document.querySelector('#panelLayer').hidden,
  cls: document.querySelector('#panelLayer').className
}));
await new Promise(r => setTimeout(r, 260));
const after = await page.evaluate(() => ({
  hidden: document.querySelector('#panelLayer').hidden,
  cls: document.querySelector('#panelLayer').className
}));
console.log('关闭动画：60ms时', JSON.stringify(mid), ' 320ms后', JSON.stringify(after));

/* 4. 设置面板 + 自定义提示词提醒 */
await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
await new Promise(r => setTimeout(r, 420));
const warn = await page.evaluate(() => {
  const d = [...document.querySelectorAll('#panelBody details')].find(x => x.textContent.includes('高级参数'));
  d.open = true;
  const w = document.querySelector('.ai-warn');
  return { exists: !!w, text: (w && w.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)), color: w && getComputedStyle(w).color };
});
console.log('提示词提醒：', JSON.stringify(warn));
await page.evaluate(() => document.querySelector('.ai-warn').scrollIntoView({ block: 'center' }));
await new Promise(r => setTimeout(r, 200));
await shot(page, '_v3-03-aiwarn.png');

/* 5. 界面动画开关默认状态 */
const motionState = await page.evaluate(() => {
  const btn = document.querySelector('#motionToggle');
  return { on: btn.classList.contains('on'), bodyOff: document.body.classList.contains('motion-off'), label: btn.closest('.setting').querySelector('.setting-label').textContent };
});
console.log('动画开关：', JSON.stringify(motionState));

/* 关掉动画 → body.motion-off 应该出现；再打开 */
await page.click('#motionToggle');
await new Promise(r => setTimeout(r, 120));
const offNow = await page.evaluate(() => document.body.classList.contains('motion-off'));
await page.click('#motionToggle');
await new Promise(r => setTimeout(r, 120));
const onNow = await page.evaluate(() => document.body.classList.contains('motion-off'));
console.log('关→', offNow, '/ 开→', !onNow);
await page.click('#panelClose');
await new Promise(r => setTimeout(r, 320));

/* 6. 选项入场：直接开一局，走到第一个选项 */
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await new Promise(r => setTimeout(r, 500));
const dis = await page.evaluate(() => document.querySelector('#disclaimer').hidden);
console.log('免责声明显示：', !dis);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await new Promise(r => setTimeout(r, 900));

/* 一路点到出现选项 */
let found = false;
for (let i = 0; i < 120; i++) {
  const st = await page.evaluate(() => ({
    choice: !document.querySelector('#choiceLayer').hidden,
    hub: !document.querySelector('#hubLayer').hidden,
    dlg: !document.querySelector('#dialogue').hidden
  }));
  if (st.choice) { found = true; break; }
  if (st.hub) { await page.evaluate(() => document.querySelector('#hubLeave')?.click()); }
  else await page.mouse.click(640, 640);
  await new Promise(r => setTimeout(r, 130));
}
console.log('走到选项：', found);
if (found) {
  const cAnim = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.choice-item')];
    return items.map(el => ({ t: el.textContent.trim().slice(0, 8), anim: getComputedStyle(el).animationName, delay: getComputedStyle(el).animationDelay }));
  });
  console.log('选项动画：', JSON.stringify(cAnim.slice(0, 3)));
  await shot(page, '_v3-04-choices.png');
}

/* 7. 竖屏 390 宽：徽标不压标题、页脚一行在 */
const p2 = await browser.newPage();
await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p2.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));
const portrait = await p2.evaluate(() => {
  const b = document.querySelector('#ageBadge').getBoundingClientRect();
  const head = document.querySelector('.title-head').getBoundingClientRect();
  const foot = document.querySelector('.title-footer .foot-age').getBoundingClientRect();
  return {
    badge: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
    head: { x: Math.round(head.x), y: Math.round(head.y) },
    overlap: !(b.bottom <= head.top || b.right <= head.left),
    footBottom: Math.round(foot.bottom), vh: innerHeight,
    scrollH: document.querySelector('.title-screen').scrollHeight,
    overflow: document.querySelector('.title-screen').scrollHeight > innerHeight + 2
  };
});
console.log('竖屏 390×844：', JSON.stringify(portrait));
await shot(p2, '_v3-05-portrait.png');

/* 8. 极矮横屏 640×340：页脚只剩适龄那一行 */
await p2.setViewport({ width: 640, height: 340, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await new Promise(r => setTimeout(r, 600));
const short = await p2.evaluate(() => {
  const spans = [...document.querySelectorAll('.title-footer > span')].map(s => ({ cls: s.className, shown: s.getBoundingClientRect().height > 0 }));
  const scr = document.querySelector('.title-screen');
  return { spans, overflow: scr.scrollHeight > innerHeight + 2, vh: innerHeight, sh: scr.scrollHeight };
});
console.log('极矮横屏：', JSON.stringify(short));
await shot(p2, '_v3-06-short.png');

await browser.close();
server.close();
console.log('\n截图：', shots.join(', '));
