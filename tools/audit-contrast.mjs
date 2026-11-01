/* =========================================================
   深色 / 浅色模式对比度全站审计
   ---------------------------------------------------------
   把所有能开的页面都开一遍，在 nightMode 开 / 关两种情况下
   逐个可见文本节点算一次对比度，低于阈值的打出来。

   用法：
     node tools/audit-contrast.mjs            # 只报告
     node tools/audit-contrast.mjs --shots    # 同时截图（存 build/_contrast/）
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = process.cwd();
const WWW = path.join(ROOT, 'build', 'www');
const SHOTS = process.argv.includes('--shots');
const OUTDIR = path.join(ROOT, 'build', '_contrast');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(WWW, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(8097, '127.0.0.1', r));

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://127.0.0.1:8097/', { waitUntil: 'networkidle0' });
const wait = ms => new Promise(r => setTimeout(r, ms));

const setNight = async (on) => {
  await page.evaluate((v) => {
    const s = JSON.parse(localStorage.getItem('zbnx.settings') || '{}');
    s.nightMode = v; localStorage.setItem('zbnx.settings', JSON.stringify(s));
  }, on);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(700);
  // 跳过开场：直接进游戏
  await page.evaluate(() => {
    const b = document.querySelector('[data-act="new"]'); if (b) b.click();
  });
  await wait(500);
  await page.evaluate(() => document.querySelector('#disclaimerOk')?.click());
  await wait(700);
  const nightOn = await page.evaluate(() => document.body.classList.contains('night'));
  console.log('  night =', nightOn);
};

/* 在页面里跑一遍对比度检测。
   背景色要"合成"：半透明层叠在下面才算得出真实底色。 */
const AUDIT = () => {
  function parse(c) { const m = (c || '').match(/[\d.]+/g); return m ? m.map(Number) : null; }
  function over(fg, bg) { // fg alpha over bg
    const a = fg[3] === undefined ? 1 : fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  }
  function lum(c) { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
  /* 渐变 / 图片背景：取里面出现过的 rgb() 求均值当作底色近似。
     比"直接跳过"好——HUD 顶栏正是渐变底，跳过它等于放过了最该查的地方。 */
  function imageBgApprox(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bi = getComputedStyle(n).backgroundImage;
      if (bi && bi !== 'none') {
        const cols = (bi.match(/rgba?\([^)]+\)/g) || [])
          .map(c => parse(c)).filter(Boolean);
        if (cols.length) {
          let r = 0, g = 0, bl = 0, a = 0;
          cols.forEach(c => { r += c[0]; g += c[1]; bl += c[2]; a += (c[3] === undefined ? 1 : c[3]); });
          const k = cols.length;
          return [r / k, g / k, bl / k, a / k];
        }
        return null;
      }
      n = n.parentElement;
    }
    return null;
  }
  function bgStack(el) {
    const stack = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && (c[3] === undefined || c[3] > 0)) stack.push(c);
      n = n.parentElement;
    }
    stack.push([255, 255, 255, 1]);
    // 从最底层往上叠
    let acc = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  }
  const out = [];
  const roots = [document.body];
  const pb = document.querySelector('#panelBody');
  if (pb) roots.push(pb);
  const seen = new Set();
  roots.forEach(root => root.querySelectorAll('*').forEach(el => {
    const t = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join('');
    if (!t) return;
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const cs = getComputedStyle(el);
    if (cs.opacity === '0' || cs.visibility === 'hidden') return;
    const fg = parse(cs.color); if (!fg) return;
    // 祖先链上有渐变 / 图片背景时，用渐变里的颜色均值近似底色。
    // 但元素自己已经有不透明底色时不用近似——那层底色才是真正压在渐变上的。
    const ownBg = parse(cs.backgroundColor);
    const ownOpaque = ownBg && (ownBg[3] === undefined || ownBg[3] > 0.9);
    const approx = ownOpaque ? null : imageBgApprox(el);
    const bg = approx ? over(approx, bgStack(el)) : bgStack(el);
    const F = fg[3] === undefined ? 1 : fg[3];
    const eff = over(fg, bg);
    const l1 = lum(eff), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    const key = cs.color + '|' + bg.map(x => Math.round(x)).join(',') + '|' + t.slice(0, 12) + '|' + el.className;
    if (seen.has(key)) return; seen.add(key);
    if (ratio < 2.6) out.push({ t: t.slice(0, 20), cls: String(el.className).slice(0, 34), color: cs.color, bg: 'rgb(' + bg.map(x => Math.round(x)).join(',') + ')', ratio: +ratio.toFixed(2) });
  }));
  return out;
};

/* 依次打开各个页面。每一项是一个"打开 + 可选点击"的脚本。 */
const PAGES = [
  ['剧情页（HUD）', () => { }],
  ['菜单', () => document.querySelector('#btnMenu')?.click()],
  ['设置', () => document.querySelector('[data-menu="settings"]')?.click()],
  ['更新日志', () => document.querySelector('[data-menu="changelog"]')?.click()],
  ['关于本作', () => document.querySelector('[data-menu="about"]')?.click()],
  ['存档', () => document.querySelector('[data-menu="saves"]')?.click()],
  ['材料', () => document.querySelector('#btnMaterials')?.click()],
  ['人物', () => document.querySelector('#btnCharacters')?.click()],
  ['政务平台', () => document.querySelector('#btnGov')?.click()],
  ['手机桌面', () => document.querySelector('#btnPhone')?.click()],
];

const MINT_PAGES = [
  ['校园通', 'campus'], ['浏览器', 'browser'], ['便笺', 'note'], ['相册', 'gallery'],
  ['接龙', 'chain'], ['计算器', 'calc'], ['应用商店', 'store'], ['游戏中心', 'games'],
  ['相机', 'camera'], ['时钟', 'clock'], ['天气', 'weather'], ['音乐', 'music'],
  ['文件管理', 'files'], ['通讯录', 'people'], ['进度', 'timeline'], ['备份', 'save'],
  ['手机设置', 'settings'], ['软件更新', 'changelog'], ['关于', 'about'], ['电话', 'dial'],
];

/* 关掉当前面板 */
const closePanel = () => page.evaluate(() => {
  const b = document.querySelector('#panelClose'); if (b) b.click();
  else document.querySelector('[data-mos-exit]')?.click();
});

const results = {};
for (const night of [true, false]) {
  console.log(`\n========== ${night ? '深色' : '浅色'}模式 ==========`);
  await setNight(night);
  const bad = [];
  // 剧情页
  let r = await page.evaluate(AUDIT);
  if (r.length) bad.push(['剧情页', r]);
  // 各个游戏面板
  for (const [name, fn] of PAGES.slice(1)) {
    await page.evaluate(fn);
    await wait(600);
    r = await page.evaluate(AUDIT);
    if (r.length) bad.push([name, r]);
    await closePanel(); await wait(350);
  }
  // 手机里的各个应用
  await page.evaluate(() => document.querySelector('#btnPhone')?.click());
  await wait(700);
  for (const [name, id] of MINT_PAGES) {
    await page.evaluate((appId) => {
      const u = window.__ZBNX && window.__ZBNX.ui;
      if (u && u._phoneApp) u._phoneApp(appId, appId);
    }, id);
    await wait(700);
    r = await page.evaluate(AUDIT);
    if (r.length) bad.push(['手机/' + name, r]);
    if (SHOTS) {
      fs.mkdirSync(OUTDIR, { recursive: true });
      await page.screenshot({ path: path.join(OUTDIR, `${night ? 'dark' : 'light'}-mint-${id}.png`) });
    }
    await closePanel(); await wait(300);
    // 关掉手机，回到剧情
    await page.evaluate(() => { const u = window.__ZBNX && window.__ZBNX.ui; if (u) { u.closePanel(); } });
    await wait(300);
    await page.evaluate(() => document.querySelector('#btnPhone')?.click());
    await wait(500);
  }
  await closePanel(); await wait(300);

  for (const [name, list] of bad) {
    console.log(`\n-- ${name}`);
    list.slice(0, 6).forEach(x => console.log('   LOW', JSON.stringify(x)));
  }
  results[night ? 'dark' : 'light'] = bad.map(([n, l]) => [n, l.length]);
}
console.log('\n汇总：', JSON.stringify(results));
await b.close(); server.close();
