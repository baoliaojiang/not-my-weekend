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
  const c = document.createElement('canvas').getContext('2d');
  const w = (f, t) => { c.font = `64px ${f}`; return Math.round(c.measureText(t).width * 100) / 100; };
  const sample = '跳过这一节游戏中心应用商店九月一日设置关于手机天气时钟音乐文件管理通讯录备份恢复阅读记录更新日志空如也相机';
  const miss = [], hit = [];
  for (const ch of sample) {
    const a = w('"DingTalk JinBuTi"', ch), bx = w('"MiSans"', ch);
    (a === bx ? hit : miss).push(ch + ':' + a + '/' + bx);
  }
  return { same: hit.length, diff: miss.length, hit: hit.slice(0, 100), diffList: miss.slice(0, 40) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
