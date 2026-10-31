import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.setViewport({ width: 1280, height: 800 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display='none');
  window.__ZBNX.go('ch0');
});
await wait(1000);
// 直接挪到 ask 之后，再从这儿跳
await p.evaluate(() => { const e = window.__ZBNX.engine; const f = e.frame(); f.i = 12; e.run(); });
await wait(800);
const before = await p.evaluate(() => ({ i: window.__ZBNX.engine.frame().i, t: window.__ZBNX.engine.current.t }));
await p.evaluate(() => document.querySelector('#btnSkip').click());
await wait(400);
await p.evaluate(() => document.querySelector('#skipGo').click());
await wait(1500);
const after = await p.evaluate(() => {
  const e = window.__ZBNX.engine;
  const choices = document.querySelector('#choiceLayer, .choice-layer, #choices');
  return {
    i: e.frame().i, t: e.current && e.current.t,
    choiceVisible: choices ? !choices.hidden : null,
    optCount: document.querySelectorAll('[data-choice], .choice-btn').length
  };
});
console.log('before', JSON.stringify(before), 'after', JSON.stringify(after), 'errs', errs.length ? errs : 'none');
await p.screenshot({ path: path.join(ROOT, 'build', '_skip-choice.png') });
await b.close();
