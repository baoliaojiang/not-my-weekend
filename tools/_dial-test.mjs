import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display='none');
  window.__ZBNX.go('ch0');
});
await wait(1000);
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
await wait(600);
await p.evaluate(() => document.querySelector('[data-app="dial"]').click());
await wait(700);
await p.screenshot({ path: path.join(ROOT, 'build', '_dial-home.png') });
// 打给薄荷
await p.evaluate(() => document.querySelector('[data-dial="mint"]').click());
await wait(2200);
await p.screenshot({ path: path.join(ROOT, 'build', '_dial-call.png') });
// 说一句
await p.evaluate(() => { const i = document.querySelector('#dlInput'); i.value = '我现在该干嘛'; });
await p.evaluate(() => document.querySelector('#dlSend').click());
await wait(1500);
await p.screenshot({ path: path.join(ROOT, 'build', '_dial-talk.png') });
const info = await p.evaluate(() => ({
  lines: [...document.querySelectorAll('.dl-line p')].map(x => x.textContent),
  state: (document.querySelector('#dlCallState') || {}).textContent
}));
console.log(JSON.stringify(info, null, 1));
console.log('errs', errs.length ? errs.slice(0,4) : 'none');
await b.close();
