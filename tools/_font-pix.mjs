import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width: 600, height: 200 });
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
await p.evaluate(async () => { await document.fonts.ready; });
const shot = async (font, text) => {
  await p.evaluate((f, t) => {
    let d = document.getElementById('__fx');
    if (!d) { d = document.createElement('div'); d.id = '__fx'; document.body.appendChild(d); }
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff;color:#000;font-size:56px;padding:8px;';
    d.style.fontFamily = f;
    d.textContent = t;
  }, font, text);
  const buf = await p.screenshot({ clip: { x: 0, y: 0, width: 560, height: 100 } });
  return crypto.createHash('md5').update(buf).digest('hex');
};
const cases = [
  ['饕餮魑魅', '"DingTalk JinBuTi"'], ['饕餮魑魅', '"MiSans"'],
  ['序章九月', '"DingTalk JinBuTi"'], ['序章九月', '"MiSans"'],
  ['档案室', '"DingTalk JinBuTi"'], ['档案室', '"MiSans"']
];
for (const [t, f] of cases) console.log(f.padEnd(22), t, await shot(f, t));
// 三者两两比较
await b.close();
