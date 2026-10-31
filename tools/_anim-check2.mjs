import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 1280, height: 800 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display='none');
  window.__ZBNX.go('ch0');
});
await wait(900);
// 打开设置面板
await p.evaluate(() => window.__ZBNX.ui.openSettings && window.__ZBNX.ui.openSettings());
await wait(120);
const r = await p.evaluate(() => {
  const layer = document.querySelector('#panelLayer');
  const card = document.querySelector('.panel');
  const cs = (el) => el ? { anim: getComputedStyle(el).animationName, dur: getComputedStyle(el).animationDuration, trans: getComputedStyle(el).transitionDuration, cls: el.className } : null;
  return { layer: cs(layer), card: cs(card), dialogs: [...document.querySelectorAll('.dialog-mask')].map(d => d.className) };
});
console.log(JSON.stringify(r, null, 1));
// 手机
await wait(400);
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); });
await wait(300);
await p.evaluate(() => window.__ZBNX.ui.openPhone('home', null));
await wait(150);
const r2 = await p.evaluate(() => {
  const ph = document.querySelector('.mos');
  const cs = ph ? { anim: getComputedStyle(ph).animationName, dur: getComputedStyle(ph).animationDuration, trans: getComputedStyle(ph).transitionDuration, cls: ph.className } : null;
  return { phone: cs, layerCls: (document.querySelector('#panelLayer') || {}).className };
});
console.log(JSON.stringify(r2, null, 1));
console.log('errs', errs.length ? errs.slice(0,5) : 'none');
await b.close();
