import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
const r = await p.evaluate(async () => {
  await document.fonts.ready;
  const t = (txt) => document.fonts.check('16px "DingTalk JinBuTi"', txt);
  return {
    latin: t('ABC'),
    han: t('跳过'),
    han2: t('九月一日'),
    han3: t('游戏中心'),
    canvasLatin: (() => { const c = document.createElement('canvas').getContext('2d'); c.font = '32px "DingTalk JinBuTi"'; return c.measureText('ABC').width; })(),
    canvasLatinFix: (() => { const c = document.createElement('canvas').getContext('2d'); c.font = '32px "MiSans"'; return c.measureText('ABC').width; })()
  };
});
console.log(JSON.stringify(r));
await b.close();
