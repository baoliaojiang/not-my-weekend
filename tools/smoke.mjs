/* 冒烟测试：用 Edge 无头模式跑一遍原型流程，抓控制台错误并截图 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const OUT = 'D:/workbuddy/2026-10-23-16-33-10/tools/shots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const logs = [];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });

page.on('console', (m) => {
  const t = m.text();
  logs.push(`[${m.type()}] ${t}`);
  if (m.type() === 'error') errors.push(t);
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(800);
await shot('01-title');

// 开始游戏 → 免责声明
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(400);
await shot('02-disclaimer');
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(900);
await shot('03-prologue');

// 推进对话（点击舞台/对话框）
async function advance(times = 1, delay = 260) {
  for (let i = 0; i < times; i++) {
    const hasChoice = await page.evaluate(() => !document.querySelector('#choiceLayer').hidden);
    if (hasChoice) {
      await page.evaluate(() => {
        const b = document.querySelector('#choiceBox .choice-item');
        if (b) b.click();
      });
      await sleep(500);
      continue;
    }
    const hasHub = await page.evaluate(() => !document.querySelector('#hubLayer').hidden);
    if (hasHub) return 'hub';
    await page.evaluate(() => {
      const dlg = document.querySelector('#dialogue');
      if (dlg && !dlg.hidden) dlg.click();
      else document.querySelector('#stage').click();
    });
    await sleep(delay);
  }
  return 'ok';
}

// 序章：推进到第一个选择（地点选择）
await advance(8);
await shot('04-choice-place');
await advance(1); // 选第一个（教室）
await sleep(600);
await shot('05-classroom');

// 继续推进，遇到选项就选
for (let i = 0; i < 90; i++) {
  const r = await advance(1, 200);
  if (r === 'hub') break;
  const done = await page.evaluate(() => !document.querySelector('#panelLayer').hidden);
  if (done) break;
}
await shot('06-mid');

// 打开材料面板看看
await page.evaluate(() => document.querySelector('#btnMaterials').click());
await sleep(500);
await shot('07-materials');
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(300);

// 打开人物
await page.evaluate(() => document.querySelector('#btnCharacters').click());
await sleep(400);
await shot('08-characters');
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(300);

// 打开手机
await page.evaluate(() => document.querySelector('#btnPhone').click());
await sleep(400);
await shot('09-phone');
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(300);

// 打开菜单
await page.evaluate(() => document.querySelector('#btnMenu').click());
await sleep(400);
await shot('10-menu');
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(300);

// 一直推进到底（会自动过章节总结 → 第一章）
for (let i = 0; i < 400; i++) {
  const state = await page.evaluate(() => {
    const sumNext = document.querySelector('#sumNext');
    if (sumNext && !document.querySelector('#panelLayer').hidden) return 'summary';
    if (!document.querySelector('#choiceLayer').hidden) return 'choice';
    if (!document.querySelector('#hubLayer').hidden) return 'hub';
    if (!document.querySelector('#panelLayer').hidden) return 'panel';
    if (document.querySelector('#titleScreen') && !document.querySelector('#titleScreen').hidden) return 'title';
    return 'dlg';
  });

  if (state === 'summary') { await shot('11-summary'); await page.evaluate(() => document.querySelector('#sumNext').click()); await sleep(900); continue; }
  if (state === 'choice') { await page.evaluate(() => document.querySelector('#choiceBox .choice-item').click()); await sleep(500); continue; }
  if (state === 'hub') { await shot('12-hub'); break; }
  if (state === 'panel') { await page.evaluate(() => document.querySelector('#panelClose').click()); await sleep(300); continue; }
  if (state === 'title') break;
  await page.evaluate(() => {
    const dlg = document.querySelector('#dialogue');
    if (dlg && !dlg.hidden) dlg.click(); else document.querySelector('#stage').click();
  });
  await sleep(140);
}

// 在调查中枢里做两次行动，触发中段事件
const hub = await page.evaluate(() => !document.querySelector('#hubLayer').hidden);
if (hub) {
  for (let k = 0; k < 2; k++) {
    await page.evaluate(() => {
      const cards = document.querySelectorAll('#hubGrid .hub-card:not([disabled])');
      if (cards[k]) cards[k].click();
    });
    await sleep(600);
    // 推进该行动脚本
    for (let i = 0; i < 120; i++) {
      const st = await page.evaluate(() => {
        if (!document.querySelector('#choiceLayer').hidden) return 'choice';
        if (!document.querySelector('#hubLayer').hidden) return 'hub';
        return 'dlg';
      });
      if (st === 'hub') break;
      if (st === 'choice') {
        await page.evaluate(() => document.querySelector('#choiceBox .choice-item').click());
        await sleep(400);
        continue;
      }
      await page.evaluate(() => {
        const dlg = document.querySelector('#dialogue');
        if (dlg && !dlg.hidden) dlg.click(); else document.querySelector('#stage').click();
      });
      await sleep(120);
    }
  }
  await shot('13-hub-after-actions');
}

// 设置面板
await page.evaluate(() => document.querySelector('#btnMenu').click());
await sleep(300);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#panelBody [data-menu]')].find(x => x.dataset.menu === 'settings');
  if (b) b.click();
});
await sleep(500);
await shot('14-settings');
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(200);

console.log('\n--- console errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
console.log('\n--- resource 404 ---');
console.log(logs.filter(l => l.includes('404') || l.includes('Failed')).join('\n') || '(none)');

await browser.close();
