import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path'; import fs from 'node:fs';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
for (const [n, w, h, mob] of [['pc',1280,800,false],['p393',393,852,true]]) {
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await p.waitForFunction('!!window.__ZBNX');
  await p.evaluate(() => {
    ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display='none'; });
    document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display='none');
  });
  await wait(1200);
  await p.screenshot({ path: path.join(ROOT, 'build', `_title-${n}.png`) });
  const box = await p.evaluate(() => {
    const q = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top)]; };
    return { ai: q('#aiFab'), fb: q('#feedbackFab') };
  });
  console.log(n, JSON.stringify(box), 'errs', errs.length ? errs : 'none');
  await p.close();
}
await b.close();
