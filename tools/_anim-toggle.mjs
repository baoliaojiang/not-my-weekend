import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display='none');
  window.__ZBNX.go('ch0');
});
await wait(800);
const rep = async (tag) => {
  const r = await p.evaluate(() => ({
    body: document.body.className,
    motion: window.__ZBNX.settings.motion,
    btnOn: (document.querySelector('#motionToggle') || {}).className
  }));
  console.log(tag, JSON.stringify(r));
};
await p.evaluate(() => window.__ZBNX.ui.openSettings());
await wait(400);
await rep('init');
await p.evaluate(() => document.querySelector('#motionToggle').click());
await wait(200);
await rep('after click1');
await p.evaluate(() => document.querySelector('#motionToggle').click());
await wait(200);
await rep('after click2');
// 检查主界面标题页入场（staged 类）
await b.close();
