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
await wait(1000);
const r1 = await p.evaluate(() => ({
  body: document.body.className,
  motion: window.__ZBNX.settings && window.__ZBNX.settings.motion,
  appSettingsMotion: window.__ZBNX && window.__ZBNX.settings
}));
console.log('state', JSON.stringify(r1).slice(0, 300));
// 跳到选项
await p.evaluate(() => { const e = window.__ZBNX.engine; e.frame().i = 54; e.run(); });
await wait(900);
const r2 = await p.evaluate(() => {
  const items = [...document.querySelectorAll('.choice, .choice-item, [data-choice]')].slice(0, 3);
  const layer = document.querySelector('.choice-layer, #choiceLayer, #choices');
  const cs = (el) => el ? { anim: getComputedStyle(el).animationName, dur: getComputedStyle(el).animationDuration, trans: getComputedStyle(el).transitionDuration, op: getComputedStyle(el).opacity } : null;
  return {
    body: document.body.className,
    layer: layer ? { cls: layer.className, ...cs(layer) } : null,
    first: items[0] ? { cls: items[0].className, ...cs(items[0]) } : null,
    html: layer ? layer.outerHTML.slice(0, 300) : null
  };
});
console.log(JSON.stringify(r2, null, 1));
console.log('errs', errs.length ? errs.slice(0,5) : 'none');
await b.close();
