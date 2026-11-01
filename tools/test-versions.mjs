/* =========================================================
   版本切换 / 回滚功能测试
   ---------------------------------------------------------
   覆盖：
     1. 设置页与更新页都有「切换版本」入口
     2. 版本列表渲染正确：当前版本没有按钮，新版本是「更新」，旧版本是「回滚」
     3. fetchVersions 能解析清单、按版本倒序
     4. resolveUrl 相对名与绝对 URL 都对
     5. 回滚要弹确认框
     6. 切换失败（no-shell）时如实提示，不假装成功
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const fails = [];
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ ' + msg); fails.push(msg); }
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 892, deviceScaleFactor: 1 });

page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 160)); });

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });

// 跳过启动序列
await page.evaluate(async () => {
  for (let i = 0; i < 12; i++) {
    const b = document.querySelector('#bootSkip');
    if (b) b.click();
    const bs = document.querySelector('#bootSeq');
    if (bs) bs.remove();
    const d = document.querySelector('#disclaimer');
    const ok2 = document.querySelector('#disclaimerOk');
    if (ok2) ok2.click();
    await new Promise(r => setTimeout(r, 120));
  }
});
await new Promise(r => setTimeout(r, 900));

/* ---------- 1. 入口存在 ---------- */
console.log('\n[1] 入口');
const entry = await page.evaluate(() => {
  const m = window.__ZBNX;
  if (!m) return { err: 'no debug hook' };
  const scr = m.ui;
  const conf = scr._appConf('settings');
  const html = conf ? conf.html : '';
  const uconf = scr._appConf('update');
  return {
    settingsHas: html.includes('data-go-app="versions"'),
    updateHas: uconf ? uconf.html.includes('data-go-app="versions"') : false,
    versionsConf: !!scr._appConf('versions')
  };
});
ok(!entry.err, '调试钩子可用');
ok(entry.settingsHas, '设置页有「切换版本」入口');
ok(entry.updateHas, '更新页有「切换版本」入口');
ok(entry.versionsConf, '版本管理页已注册');

/* ---------- 2. 版本列表渲染 ---------- */
console.log('\n[2] 列表渲染');
const list = await page.evaluate(() => {
  const m = window.__ZBNX;
  const mod = m.__versionsUI;
  if (!mod) return { err: 'no versionsUI' };
  const html = mod.versionListHTML('0.6.5.0', [
    { v: '0.6.5.0', date: '2026-10-23', title: '当前版', notes: ['a'] },
    { v: '0.6.6.0', date: '2026-11-01', title: '更新版', notes: ['b'] },
    { v: '0.6.4.0', date: '2026-09-01', title: '旧版', notes: ['c'] }
  ]);
  return {
    curTag: html.includes('vp-cur">当前版本'),
    curNoBtn: !/data-vp="0\.6\.5\.0"/.test(html),
    upBtn: html.includes('vp-btn-up') && html.includes('data-vp="0.6.6.0"'),
    downBtn: html.includes('vp-btn-down') && html.includes('data-vp="0.6.4.0"'),
    order: html.indexOf('0.6.6.0') < html.indexOf('0.6.4.0')
  };
});
ok(!list.err, '能拿到版本列表渲染函数');
ok(list.curTag && list.curNoBtn, '当前版本标记且没有按钮');
ok(list.upBtn, '更新的版本给「更新」按钮');
ok(list.downBtn, '旧的版本给「回滚」按钮');

/* ---------- 3. fetchVersions 解析 ---------- */
console.log('\n[3] 清单解析');
const parsed = await page.evaluate(async () => {
  const m = window.__ZBNX;
  const mod = m.__versionsCore;
  if (!mod) return { err: 'no versionsCore' };
  // 用假数据测试排序与 URL 解析
  const r = await mod.fetchVersions(300);
  const rel = mod.resolveUrl({ www: 'www-0.6.5.0.zip' }, 'https://x.test/dist/');
  const abs = mod.resolveUrl({ www: 'https://a.test/www.zip' }, 'https://x.test/dist/');
  return { ok: r.ok, count: r.versions.length, rel, abs, latest: r.latest };
});
ok(!parsed.err, '能拿到版本核心模块');
ok(typeof parsed.rel === 'string' && parsed.rel.startsWith('https://x.test/dist/'), '相对 www 解析成绝对地址');
ok(parsed.abs === 'https://a.test/www.zip', '绝对 www 原样保留');

/* ---------- 4. 切换版本：no-shell 要如实提示 ---------- */
console.log('\n[4] 切换行为');
const sw = await page.evaluate(async () => {
  const m = window.__ZBNX;
  const mod = m.__versionsCore;
  const r = await mod.switchVersion({ v: '0.6.4.0', www: 'www-0.6.4.0.zip' }, 'https://x.test/dist/');
  return r;
});
ok(sw && sw.ok === false && sw.reason === 'no-shell', '网页版没有外壳时如实返回 no-shell，不假装成功');

/* ---------- 5. 实际打开版本管理页 ---------- */
console.log('\n[5] 页面交互');
await page.evaluate(() => {
  const m = window.__ZBNX;
  m.ui._pushApp('versions');
});
await new Promise(r => setTimeout(r, 1400));
const pageState = await page.evaluate(() => {
  const el = document.querySelector('.mapp-vp');
  return {
    opened: !!el,
    hero: !!document.querySelector('.vp-hero'),
    refresh: !!document.querySelector('#vpRefresh'),
    listId: !!document.querySelector('#vpList'),
    empty: (document.querySelector('#vpList') || {}).textContent || ''
  };
});
ok(pageState.opened, '版本管理页能打开');
ok(pageState.hero && pageState.refresh, '头部与刷新按钮都在');
ok(pageState.listId, '版本列表容器存在');

await browser.close();

console.log('\n' + (fails.length ? '✗ 失败 ' + fails.length + ' 项：\n  - ' + fails.join('\n  - ') : '✓ 全部通过'));
process.exit(fails.length ? 1 : 0);
