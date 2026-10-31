/* =========================================================
   「继续游戏」路径：从标题页按钮进入，检查场景与推进是否正常
   ---------------------------------------------------------
   与 test-load-scene 的区别：那个测的是存档面板里手动读档，
   这个测的是标题页「继续游戏」——它走 store.latestSlot()，
   曾经读进来是黑屏的（存档没带场景快照）。
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const PORT = 5199;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fails = [];
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fails.push(m); };

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--no-sandbox', '--mute-audio']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(500);

const scene = () => page.evaluate(() => {
  const layers = [...document.querySelectorAll('.bg-layer')];
  const on = layers.find(el => el.classList.contains('on'));
  return {
    hasImage: !!(on && getComputedStyle(on).backgroundImage.includes('url')),
    opacity: on ? getComputedStyle(on).opacity : '0',
    index: window.__ZBNX.state.index,
    chapter: window.__ZBNX.state.chapterId,
    titleHidden: document.querySelector('#titleScreen').hidden
  };
});

console.log('\n[1] 新游戏并推进');
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await page.evaluate(() => { document.querySelector('#disclaimerOk')?.click(); window.__ZBNX.settings.textSpeed = 'instant'; });
await sleep(600);
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => {
    const p = document.querySelector('#panelLayer');
    if (!p.hidden) {
      const t = document.querySelector('#matTake');
      if (t) { t.click(); return; }
      const c = document.querySelector('#panelClose');
      if (c && getComputedStyle(c).visibility !== 'hidden') { c.click(); return; }
      return;
    }
    const ch = document.querySelector('#choiceLayer');
    if (!ch.hidden) { document.querySelector('#choiceBox .choice-item')?.click(); return; }
    const d = document.querySelector('#dialogue');
    if (d && !d.hidden) d.click(); else document.querySelector('#stage').click();
  });
  await sleep(80);
}
const beforeSave = await scene();
console.log('  ', JSON.stringify(beforeSave));
ok(beforeSave.hasImage, '推进后背景正常');

console.log('\n[2] 写自动存档并回标题');
const latest = await page.evaluate(() => {
  window.__ZBNX.save(0);
  return window.__ZBNX.saveAPI.current();
});
await sleep(300);
await page.evaluate(() => window.__ZBNX.backToTitle());
await sleep(600);
ok(await page.evaluate(() => !document.querySelector('#titleScreen').hidden), '回到标题页');

console.log('\n[3] 点「继续游戏」');
const btnOk = await page.evaluate(() => {
  const b = document.querySelector('[data-act="continue"]');
  if (!b || b.disabled) return false;
  b.click(); return true;
});
ok(btnOk, '继续游戏按钮可用');
await sleep(900);
const after = await scene();
console.log('  ', JSON.stringify(after));
ok(after.hasImage, '继续游戏后背景不黑（修复验证）');
ok(after.opacity === '1' || after.opacity === '', `背景层可见 opacity=${after.opacity}`);
ok(after.index >= beforeSave.index, `进度没退（${beforeSave.index} → ${after.index}）`);

console.log('\n[4] 继续后还能推进');
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const p = document.querySelector('#panelLayer');
    if (!p.hidden) { document.querySelector('#matTake')?.click() || document.querySelector('#panelClose')?.click(); return; }
    const d = document.querySelector('#dialogue');
    if (d && !d.hidden) d.click(); else document.querySelector('#stage').click();
  });
  await sleep(90);
}
const moved = await scene();
ok(moved.index > after.index, `能继续推进（${after.index} → ${moved.index}）`);

console.log('\n错误:', errors.length ? errors.slice(0, 3).join(' | ') : '(none)');
console.log(`结果：${fails.length ? '失败 ' + fails.length + ' 项\n - ' + fails.join('\n - ') : '全部通过'}`);
await browser.close();
process.exit(fails.length ? 1 : 0);
