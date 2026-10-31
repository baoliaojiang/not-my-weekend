import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path'; import fs from 'node:fs';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await p.setViewport({ width: 1280, height: 800 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display = 'none');
  window.__ZBNX.go('ch0');
});
await wait(1200);
// 往前走几步，让第一节有内容
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => { const el = document.querySelector('#stageTap, .stage, #dialogue'); if (window.__ZBNX.engine) window.__ZBNX.engine.next(); });
  await wait(120);
}
await wait(400);
await p.evaluate(() => document.querySelector('#btnSkip').click());
await wait(500);
await p.screenshot({ path: path.join(ROOT, 'build', '_skip-card.png') });
const info = await p.evaluate(() => {
  const box = document.querySelector('#skipPrompt');
  return {
    open: !box.hidden,
    chapter: document.querySelector('#skipChapter').textContent,
    sub: document.querySelector('#skipSub').textContent,
    points: [...document.querySelectorAll('#skipPoints li')].map(x => x.textContent),
    cast: [...document.querySelectorAll('#skipCast .skip-face b')].map(x => x.textContent),
    hasBg: [...document.querySelectorAll('#skipCast .skip-face i')].map(x => x.getAttribute('style'))
  };
});
console.log(JSON.stringify(info, null, 1));
// 确认跳
await p.evaluate(() => document.querySelector('#skipGo').click());
await wait(1200);
await p.screenshot({ path: path.join(ROOT, 'build', '_skip-after.png') });
const after = await p.evaluate(() => ({
  node: window.__ZBNX.engine && window.__ZBNX.engine.current && window.__ZBNX.engine.current.t,
  idx: window.__ZBNX.engine && window.__ZBNX.engine.frame() && window.__ZBNX.engine.frame().i,
  len: window.__ZBNX.engine && window.__ZBNX.engine.frame() && window.__ZBNX.engine.frame().nodes.length,
  choiceOpen: !!document.querySelector('.choices, #choices, .choice-panel') && !document.querySelector('.choices, #choices, .choice-panel').hidden,
  text: (document.querySelector('#dlgText') || {}).textContent
}));
console.log(JSON.stringify(after, null, 1));
console.log('errs:', errs.length ? errs.slice(0, 6) : 'none');
await b.close();
