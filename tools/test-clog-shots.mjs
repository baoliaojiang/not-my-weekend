/* =========================================================
   更新日志配图测试
   ---------------------------------------------------------
   检查三件事：
     1. 素材文件都存在、不是空文件
     2. 游戏内的「更新日志」面板（openChangelog）图文混排正常
     3. MintOS 系统更新页保持原样，不掺游戏内容

   注意：按用户要求，**不注册独立的游戏更新日志 App**，
   游戏更新日志只在游戏内面板与首页入口里，所以这里不检查独立 App。
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const fails = [];
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fails.push(msg); }
};

console.log('[0] 素材文件');
const dir = path.join(ROOT, 'assets', 'ui', 'changelog');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
ok(files.includes('hud-light.png'), 'hud-light.png 存在');
ok(files.includes('campus-score.png'), 'campus-score.png 存在');
ok(files.includes('versions.png'), 'versions.png 存在');
ok(files.includes('contrast.gif'), 'contrast.gif 存在');
for (const f of files) {
  const sz = fs.statSync(path.join(dir, f)).size;
  ok(sz > 1024, f + ' 不是空文件（' + (sz / 1024).toFixed(0) + ' KB）');
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const failedReqs = [];
page.on('requestfailed', r => failedReqs.push(r.url()));
page.on('response', r => { if (r.status() === 404) failedReqs.push(r.url() + ' 404'); });

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 1400));
await page.evaluate(async () => {
  const s = document.querySelector('#bootSkip'); if (s) s.click();
  const bs = document.querySelector('#bootSeq'); if (bs) bs.remove();
  await new Promise(r => setTimeout(r, 120));
});
await new Promise(r => setTimeout(r, 1200));

console.log('\n[1] 游戏内更新日志面板');
await page.evaluate(() => window.__ZBNX.ui.openChangelog());
await new Promise(r => setTimeout(r, 1200));
/* 配图是 loading="lazy" 的：视口外的图浏览器压根不下载，
   naturalWidth 恒为 0，但那是设计如此（省流量），不是加载失败。
   所以先滚一遍面板把懒加载全部触发，再等它们解码完。 */
await page.evaluate(async () => {
  const body = document.querySelector('.panel-body') || document.body;
  const H = body.scrollHeight;
  for (let y = 0; y < H; y += 300) {
    body.scrollTop = y;
    await new Promise(r => setTimeout(r, 60));
  }
  body.scrollTop = 0;
  await Promise.all([...document.querySelectorAll('.clog-shot img')].map(im =>
    im.complete ? Promise.resolve() : new Promise(r => {
      im.addEventListener('load', r, { once: true });
      im.addEventListener('error', r, { once: true });
    })
  ));
});
await new Promise(r => setTimeout(r, 600));
const panel = await page.evaluate(() => {
  const shots = [...document.querySelectorAll('.clog-shot')];
  return {
    count: shots.length,
    imgs: shots.map(s => {
      const im = s.querySelector('img');
      return {
        src: im ? im.getAttribute('src') : '',
        w: im ? im.naturalWidth : 0, h: im ? im.naturalHeight : 0,
        cap: s.querySelector('figcaption') ? s.querySelector('figcaption').textContent : ''
      };
    }),
    /* 图必须夹在正文条目中间，而不是集中在某一块 */
    inline: shots.every(s => {
      const p = s.parentElement;
      return p && (p.classList.contains('clog-item') || p.classList.contains('clog-items') || p.classList.contains('clog-sec'));
    }),
    panelOpen: !!document.querySelector('.panel-layer') && !document.querySelector('.panel-layer').hidden
  };
});
ok(panel.panelOpen, '更新日志面板打开');
ok(panel.count >= 8, '面板里有 ' + panel.count + ' 张配图');
ok(panel.imgs.filter(i => i.w > 0).length === panel.imgs.length,
  '所有配图都真的加载出来了（' + panel.imgs.filter(i => i.w > 0).length + '/' + panel.imgs.length + '）');
ok(panel.imgs.some(i => /\.gif$/i.test(i.src)), '里面有 GIF');
ok(panel.imgs.some(i => /\.png$/i.test(i.src)), '里面有静态图');
ok(panel.imgs.every(i => i.cap && i.cap.length > 4), '每张图都有说明文字');
ok(panel.inline, '图是穿插在正文条目中间的');

/* 图片不重复 */
const srcs = panel.imgs.map(i => i.src);
ok(srcs.length === new Set(srcs).size, '配图没有重复（' + new Set(srcs).size + '/' + srcs.length + '）');

/* 只 0.6.6.0 与 0.6.5.0 两版有图 */
const vers = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.clog-sec').forEach(sec => {
    const t = sec.querySelector('.clog-sec-t');
    const shots = sec.querySelectorAll('.clog-shot');
    if (shots.length) out.push({ title: t ? t.textContent.trim() : '', n: shots.length });
  });
  return out;
});
ok(vers.length >= 5, '有 ' + vers.length + ' 个分节配了图');

console.log('\n[2] MintOS 系统更新页（保持原样）');
await page.evaluate(() => {
  const u = window.__ZBNX.ui;
  u.closePanel();
  u._mintStack = [];
  u._renderPhoneHome();
});
await new Promise(r => setTimeout(r, 700));
await page.evaluate(() => {
  const u = window.__ZBNX.ui;
  u._mintPush(u._appConf('log').html, '更新日志', () => { });
});
await new Promise(r => setTimeout(r, 900));
const mint = await page.evaluate(() => {
  const body = document.querySelector('.mapp');
  const txt = body ? body.textContent : '';
  return {
    hasGame: txt.includes('游戏本体') || txt.includes('版本管理') || txt.includes('立绘'),
    hasSystem: txt.includes('安全补丁') || txt.includes('学校信息中心'),
    verCount: document.querySelectorAll('.lg-ver').length,
    shots: document.querySelectorAll('.mapp .clog-shot').length
  };
});
ok(mint.hasSystem, 'MintOS 更新页是系统更新内容');
ok(!mint.hasGame, 'MintOS 更新页里没有掺游戏内容');
ok(mint.verCount >= 3, 'MintOS 更新页有 ' + mint.verCount + ' 条系统版本记录');
ok(mint.shots === 0, 'MintOS 更新页没有游戏配图');

console.log('\n[3] 没有独立的游戏更新日志 App');
const hasGameLog = await page.evaluate(() => {
  const u = window.__ZBNX.ui;
  return !!u._appConf('gamelog');
});
ok(!hasGameLog, '没有注册 gamelog 这个独立 App');

console.log('\n[4] 资源请求');
const bad404 = failedReqs.filter(u => /changelog\//.test(u));
ok(bad404.length === 0, '配图没有 404' + (bad404.length ? '：' + bad404.join(', ') : ''));

await browser.close();
console.log('\n' + (fails.length ? '✗ 失败 ' + fails.length + ' 项：\n  - ' + fails.join('\n  - ') : '✓ 全部通过'));
process.exit(fails.length ? 1 : 0);
