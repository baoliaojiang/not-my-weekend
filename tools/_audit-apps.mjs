/* 手机应用自查：逐个点开桌面图标，截图 + 收集 JS 错误 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const VIEWS = [
  { n: 'p393', w: 393, h: 852, mobile: true },
  { n: 'l844', w: 844, h: 390, mobile: true }
];

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});

for (const v of VIEWS) {
  const p = await browser.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.setViewport({ width: v.w, height: v.h, isMobile: v.mobile, hasTouch: v.mobile, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await p.waitForFunction('!!window.__ZBNX', { timeout: 20000 });
  // 跳过启动流程
  await p.evaluate(() => {
    ['bootSeq', 'boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display = 'none');
  });
  await p.evaluate(() => { window.__ZBNX.go('ch0'); });
  await wait(1000);
  await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
  await wait(700);
  await p.screenshot({ path: path.join(ROOT, 'build', `_app-home-${v.n}.png`) });

  // 浅色模式再截一轮
  await p.evaluate(() => {
    document.body.classList.remove('night');
    document.documentElement.style.colorScheme = 'light';
  });
  await wait(300);
  await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
  await wait(600);
  await p.screenshot({ path: path.join(ROOT, 'build', `_app-home-light-${v.n}.png`) });
  await p.evaluate(() => {
    const b = document.querySelector('[data-app="settings"]'); if (b) b.click();
  });
  await wait(500);
  await p.screenshot({ path: path.join(ROOT, 'build', `_app-settings-light-${v.n}.png`) });
  await p.evaluate(() => {
    const b = document.querySelector('[data-mint-back]'); if (b) b.click();
  });
  await wait(300);
  await p.evaluate(() => {
    document.body.classList.add('night');
    document.documentElement.style.colorScheme = 'dark';
    window.__ZBNX.ui.closeAll();
  });
  await wait(300);
  await p.evaluate(() => { window.__ZBNX.ui.openPhone('home', null); });
  await wait(600);

  const apps = ['store', 'camera', 'clock', 'weather', 'music', 'files', 'settings', 'changelog', 'about', 'people', 'save', 'timeline'];
  for (const id of apps) {
    const ok = await p.evaluate((appId) => {
      const b = document.querySelector(`[data-app="${appId}"]`);
      if (!b) return false;
      b.click();
      return true;
    }, id);
    if (!ok) { console.log(`✗ ${v.n} ${id} 图标不存在`); continue; }
    await wait(500);
    await p.screenshot({ path: path.join(ROOT, 'build', `_app-${id}-${v.n}.png`) });
    const info = await p.evaluate(() => {
      const nav = document.querySelector('.mos-nav-t');
      const view = document.querySelector('.mos-view');
      const mapp = document.querySelector('.mapp');
      const r = view ? view.getBoundingClientRect() : null;
      return {
        title: nav ? nav.textContent : '(无导航栏)',
        hasPage: !!mapp,
        h: r ? Math.round(r.height) : 0,
        scroll: view ? view.scrollHeight > view.clientHeight + 2 : false
      };
    });
    console.log(`${info.hasPage ? '✓' : '⚠'} ${v.n} ${id.padEnd(10)} 标题=${info.title} 高=${info.h} 可滚=${info.scroll}`);
    // 回到桌面
    await p.evaluate(() => {
      const b = document.querySelector('[data-mint-back]');
      if (b) b.click();
    });
    await wait(350);
  }

  if (errs.length) console.log(`   ${v.n} JS 错误:`, [...new Set(errs)].slice(0, 6).join(' | '));
  await p.close();
}

await browser.close();
