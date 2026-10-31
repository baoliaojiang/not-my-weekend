import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 3 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display='none');
});
await wait(1000);
const el = await p.$('.title-tools');
await el.screenshot({ path: path.join(ROOT, 'build', '_fab-zoom.png') });
const bg = await p.evaluate(() => {
  const a = document.querySelector('.ai-fab .ai-avatar');
  const cs = getComputedStyle(a);
  return { img: cs.backgroundImage.slice(0, 80), size: cs.backgroundSize, w: a.getBoundingClientRect().width };
});
console.log(JSON.stringify(bg));
await b.close();
