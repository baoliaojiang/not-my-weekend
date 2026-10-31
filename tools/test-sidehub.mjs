/* 支线路口 / 支线存档 的自动化验证
   1) 未通关序章时，首页「支线」按钮是锁定的
   2) 通关序章后解锁，路口能列出条目
   3) 进入支线后存档写进支线自己的键，主线存档位不受影响
   4) 支线存档页读的是支线槽位
   5) 读档能回到支线里 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = 'tools/shots/sidehub';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,820']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 820 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await sleep(500);

const btnText = () => page.evaluate(() => document.querySelector('[data-act="side"]')?.innerText.replace(/\n/g, ' / '));
console.log('1) 初始状态按钮:', await btnText());
console.log('   locked class:', await page.evaluate(() => document.querySelector('[data-act="side"]').classList.contains('is-locked')));

// 点开路口（锁定态）
await page.evaluate(() => document.querySelector('[data-act="side"]').click());
await sleep(400);
await page.screenshot({ path: `${OUT}/01-locked.png` });
const lockedCards = await page.evaluate(() => [...document.querySelectorAll('[data-side]')].map(b => ({
  id: b.dataset.side, disabled: b.disabled, state: b.querySelector('.sh-state')?.textContent
})));
console.log('2) 锁定态卡片:', JSON.stringify(lockedCards));
console.log('   提示:', await page.evaluate(() => document.querySelector('.sh-lock')?.textContent));
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(200);

// 模拟"序章通关"
await page.evaluate(() => {
  localStorage.setItem('zbnx.progress', JSON.stringify({ v: 1, chapters: ['ch0'], sides: {} }));
});
await page.reload({ waitUntil: 'networkidle2' });
await sleep(400);
console.log('3) 解锁后按钮:', await btnText());
await page.evaluate(() => document.querySelector('[data-act="side"]').click());
await sleep(400);
await page.screenshot({ path: `${OUT}/02-hub.png` });
const cards = await page.evaluate(() => [...document.querySelectorAll('[data-side]')].map(b => ({
  id: b.dataset.side, disabled: b.disabled, state: b.querySelector('.sh-state')?.textContent
})));
console.log('   解锁态卡片:', JSON.stringify(cards));

// 进详情
await page.evaluate(() => document.querySelector('[data-side="side1"]').click());
await sleep(350);
await page.screenshot({ path: `${OUT}/03-detail.png` });
console.log('4) 详情页标题:', await page.evaluate(() => document.querySelector('#panelTitle')?.textContent));

// 读支线存档（应当是空的）
await page.evaluate(() => document.querySelector('#sdSave').click());
await sleep(350);
await page.screenshot({ path: `${OUT}/04-sidesaves-empty.png` });
console.log('   支线存档页标题:', await page.evaluate(() => document.querySelector('#panelTitle')?.textContent));
console.log('   空槽位数量:', await page.evaluate(() => document.querySelectorAll('.slot.empty').length));
await page.evaluate(() => document.querySelector('#panelClose').click());
await sleep(200);

// 进入支线
await page.evaluate(() => document.querySelector('[data-act="side"]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('[data-side="side1"]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('#sdGo').click());
await sleep(1200);
const inSide = await page.evaluate(() => ({
  chapterId: window.__ZBNX.state.chapterId,
  hud: document.querySelector('#hudChapter')?.textContent,
  scope: window.__ZBNX.ui.saveAPI.current()
}));
console.log('5) 进入支线:', JSON.stringify(inSide));

// 在支线里存档
const saveInfo = await page.evaluate(() => {
  const ok = window.__ZBNX.ui.saveAPI.save(1, 'side', 'side1');
  return {
    ok,
    side1: !!localStorage.getItem('zbnx.save.side.side1.1'),
    main1: !!localStorage.getItem('zbnx.save.1'),
    main0: !!localStorage.getItem('zbnx.save.0')
  };
});
console.log('6) 支线存档写入:', JSON.stringify(saveInfo));

// 菜单里的存档页（应当显示支线槽位）
await page.evaluate(() => window.__ZBNX.ui.toggleMenu());
await sleep(300);
await page.screenshot({ path: `${OUT}/05-menu.png` });
console.log('7) 菜单标题:', await page.evaluate(() => document.querySelector('#panelTitle')?.textContent));
console.log('   菜单提示:', await page.evaluate(() => document.querySelector('.menu-hint')?.textContent || '(无)'));
await page.evaluate(() => [...document.querySelectorAll('[data-menu]')].find(b => b.dataset.menu === 'save').click());
await sleep(350);
await page.screenshot({ path: `${OUT}/06-saves.png` });
console.log('   存档页标题:', await page.evaluate(() => document.querySelector('#panelTitle')?.textContent));
console.log('   已填槽位:', await page.evaluate(() => [...document.querySelectorAll('.slot')].filter(s => s.dataset.has === '1').length));

console.log('errors:', errs.length ? errs : 'none');
await browser.close();
