/* 移动端复现：小高度横屏下的标题布局 + 设置面板开关后黑屏 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const OUT = 'D:/workbuddy/2026-10-23-16-33-10/tools/shots-m';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
const W = Number(process.env.W || 1092), H = Number(process.env.H || 506);
await page.setViewport({ width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = n => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(700);
await shot('m01-title');

const metrics = await page.evaluate(() => {
  const r = el => { const b = el.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
  const menu = document.querySelector('.title-menu');
  const inner = document.querySelector('.title-inner');
  const foot = document.querySelector('.title-footer');
  return {
    vw: innerWidth, vh: innerHeight,
    scrollH: document.documentElement.scrollHeight,
    inner: r(inner), menu: r(menu), foot: r(foot),
    buttons: [...document.querySelectorAll('.tbtn')].map(b => ({ t: b.textContent.trim(), ...r(b) }))
  };
});
console.log('LAYOUT', JSON.stringify(metrics, null, 1));

// 点设置
await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
await sleep(500);
await shot('m02-settings');

// 关闭
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(500);
await shot('m03-after-close');

const after = await page.evaluate(() => {
  const cs = el => el ? getComputedStyle(el) : null;
  const t = document.querySelector('#titleScreen');
  const p = document.querySelector('#panelLayer');
  return {
    titleHidden: t.hidden, titleDisplay: cs(t).display, titleOpacity: cs(t).opacity, titleZ: cs(t).zIndex,
    titleRect: t.getBoundingClientRect().toJSON(),
    panelHidden: p.hidden, panelDisplay: cs(p).display,
    bodyClass: document.body.className,
    gameHidden: document.querySelector('#game').hidden,
    bgOfTitle: cs(document.querySelector('.title-bg')) ? cs(document.querySelector('.title-bg')).backgroundImage : null,
    bgRect: document.querySelector('.title-bg') ? document.querySelector('.title-bg').getBoundingClientRect().toJSON() : null,
    disclaimerHidden: document.querySelector('#disclaimer').hidden
  };
});
console.log('AFTER', JSON.stringify(after, null, 1));
console.log('ERRORS', errors.length ? errors : '(none)');
await browser.close();
