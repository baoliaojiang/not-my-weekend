/* 浅色 / 通透模式黑底排查：抓各个面板的浅色截图 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build', '_lightcheck');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await wait(1500);

/* 直接进游戏并把主题设成浅色 */
await page.evaluate(() => {
  const s = document.querySelector('#bootSkip'); if (s) s.click();
  const bs = document.querySelector('#bootSeq'); if (bs) bs.remove();
});
await wait(700);
await page.evaluate(() => {
  window.__ZBNX.settings.nightMode = false;
  document.body.classList.remove('night');
});
await wait(300);

/* 找出页面上所有「背景明显偏黑」的元素 */
async function darkScan(tag) {
  const list = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      if (r.bottom < 0 || r.top > innerHeight) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') return;
      const bg = cs.backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) return;
      const p = m[1].split(',').map(s => parseFloat(s));
      const a = p.length > 3 ? p[3] : 1;
      if (a < 0.15) return;
      const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      if (lum < 60) {
        out.push({
          sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
          bg, lum: Math.round(lum), alpha: a,
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          text: (el.textContent || '').trim().slice(0, 30)
        });
      }
    });
    return out.slice(0, 60);
  });
  console.log('\n===== ' + tag + ' 深色元素 =====');
  list.forEach(x => console.log(`  ${x.sel}  bg=${x.bg} lum=${x.lum} a=${x.alpha} @${x.rect.join(',')} "${x.text}"`));
  if (!list.length) console.log('  （无）');
  return list;
}

/* 抓整屏 */
async function shot(name) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), type: 'png' });
  console.log('  截图 ' + name + '.png');
}

await darkScan('浅色 · 标题页');
await shot('01-title-light');

/* 进游戏 */
await page.evaluate(() => { const n = document.querySelector('[data-act="new"]'); if (n) n.click(); });
await wait(800);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /覆盖/.test(x.textContent)); if (b) b.click(); });
await wait(600);
await page.evaluate(() => { const o = document.querySelector('#disclaimerOk'); if (o) o.click(); });
await wait(2200);
/* 免责页可能还在，再点一次 */
await page.evaluate(() => { const o = document.querySelector('#disclaimerOk'); if (o) o.click(); });
await wait(1500);
/* 推进到有对话的画面 */
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => {
    const c = document.querySelector('#curtain');
    if (c && !c.hidden) { c.click(); return; }
    const btns = [...document.querySelectorAll('button')].filter(b => {
      if (b.closest('[hidden]')) return false;
      const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    });
    const ask = btns.find(x => /就这样|我已了解|进入游戏|继续$|确定/.test((x.textContent || '').trim()));
    if (ask) { ask.click(); return; }
  });
  await wait(700);
}
await page.evaluate(() => { window.__ZBNX.ui._renderPhoneHome(); });
await wait(1200);
const r = await page.evaluate(() => {
  const ico = document.querySelector('.mos-ico');
  const img = ico && ico.querySelector('img');
  const g = e => e ? { r: getComputedStyle(e).borderRadius, ow: getComputedStyle(e).overflow, w: getComputedStyle(e).width, h: getComputedStyle(e).height } : null;
  return { ico: g(ico), img: g(img) };
});
console.log('MOS-ICO', JSON.stringify(r));
await shot('06-phone-home');
await page.evaluate(() => { window.__ZBNX.ui._pushApp('settings'); });
await wait(1000);
await shot('07-phone-settings');
await page.evaluate(() => { window.__ZBNX.ui._mintBack(); window.__ZBNX.ui._pushApp('store'); const t=document.querySelector('[data-st-tab=installed]'); if(t) t.click(); });
await wait(1000);
await shot('08-phone-store');
await browser.close();
process.exit(0);
await browser.close();
process.exit(0);
await shot('02-game-light');
await darkScan('浅色 · 剧情中');

/* 打开游戏设置面板 */
await page.evaluate(() => { window.__ZBNX.ui.openSettings(); });
await wait(700);
await shot('03-settings-light');
await darkScan('浅色 · 设置面板');

/* 通透模式 */
await page.evaluate(() => {
  window.__ZBNX.settings.glassMode = true;
  document.body.classList.add('glass');
});
await wait(500);
await shot('04-settings-glass');
await darkScan('通透 · 设置面板');

await page.evaluate(() => { window.__ZBNX.ui.closePanel(); });
await wait(400);
await shot('05-game-glass');
await darkScan('通透 · 剧情中');

await browser.close();
console.log('\n输出目录: ' + OUT);
