import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path'; import fs from 'node:fs';
const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(() => {
  ['bootSeq','boot'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.querySelectorAll('.boot-screen,#bootScreen').forEach(el => el.style.display = 'none');
});
await p.evaluate(() => { window.__ZBNX.go('ch0'); });
await wait(900);
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
await wait(600);
await p.evaluate(() => document.querySelector('[data-app="store"]').click());
await wait(500);
await p.evaluate(() => document.querySelector('[data-st-tab="installed"]').click());
await wait(400);
await p.screenshot({ path: path.join(ROOT, 'build', '_store-installed.png') });
// 音乐
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
await wait(500);
await p.evaluate(() => document.querySelector('[data-app="music"]').click());
await wait(500);
await p.screenshot({ path: path.join(ROOT, 'build', '_music-app.png') });
// 相机
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
await wait(500);
await p.evaluate(() => document.querySelector('[data-app="camera"]').click());
await wait(500);
await p.screenshot({ path: path.join(ROOT, 'build', '_camera-app.png') });
// 时钟
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
await wait(500);
await p.evaluate(() => document.querySelector('[data-app="clock"]').click());
await wait(500);
await p.screenshot({ path: path.join(ROOT, 'build', '_clock-app.png') });
// 天气
await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
await wait(500);
await p.evaluate(() => document.querySelector('[data-app="weather"]').click());
await wait(500);
await p.screenshot({ path: path.join(ROOT, 'build', '_weather-app.png') });
console.log('errs:', errs.length ? errs : 'none');
await b.close();
