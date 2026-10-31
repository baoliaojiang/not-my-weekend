import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- 1. 横屏手机：toast 宽度 / 立绘 / 地点标签 ----
{
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: 1080, height: 517, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
  await wait(900);
  await p.evaluate(() => document.querySelector('[data-act="new"]').click()); await wait(320);
  await p.evaluate(() => { const c = document.querySelector('[data-cfm="ok"]'); c && c.click(); }); await wait(280);
  await p.evaluate(() => document.querySelector('#disclaimerOk').click()); await wait(900);
  await p.evaluate(() => window.__ZBNX.ui.toast('读取成功'));
  await wait(300);
  const t = await p.evaluate(() => {
    const el = document.getElementById('toast');
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), text: el.textContent, ws: getComputedStyle(el).whiteSpace };
  });
  console.log('toast@1080x517:', JSON.stringify(t));

  // 跳到有立绘的节点
  const idx = await p.evaluate(() => {
    const ch = window.__ZBNX.chapters['ch0'];
    return ch.nodes.findIndex(n => n.text === '我妈说第一天不能迟到。');
  });
  await p.evaluate(i => window.__ZBNX.go('ch0', i), idx);
  await wait(800);
  const s = await p.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
    const sp = document.querySelector('#spriteLayer .sprite');
    const tag = document.querySelector('#placeTag');
    const hud = document.querySelector('#hud');
    return {
      cls: document.body.className,
      stageH: Math.round(document.getElementById('stage').getBoundingClientRect().height),
      sprite: sp ? r(sp) : null,
      place: tag && !tag.hidden ? r(tag) : null,
      hud: r(hud),
      dlgH: Math.round(document.querySelector('.dialogue').getBoundingClientRect().height)
    };
  });
  console.log('game@1080x517:', JSON.stringify(s));
  await p.screenshot({ path: 'build/_fix-01-landscape.png' });

  // 菜单字色
  await p.evaluate(() => document.getElementById('btnMenu').click()); await wait(400);
  const menu = await p.evaluate(() => {
    const btn = document.querySelector('.menu-list .btn');
    const cs = getComputedStyle(btn);
    return { color: cs.color, bg: cs.backgroundColor, bgImg: cs.backgroundImage };
  });
  console.log('menu btn:', JSON.stringify(menu));
  await p.screenshot({ path: 'build/_fix-02-menu.png' });
  console.log('errors:', errs.length ? errs : '(none)');
  await p.close();
}

// ---- 2. 模拟 X5：innerWidth/innerHeight 停在竖屏旧值 ----
{
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 517, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
  await wait(800);
  await p.evaluate(() => {
    Object.defineProperty(window, 'innerWidth', { get: () => 1080, configurable: true });
    Object.defineProperty(window, 'innerHeight', { get: () => 2367, configurable: true });
    window.dispatchEvent(new Event('resize'));
  });
  await wait(500);
  const c = await p.evaluate(() => document.body.className);
  console.log('lying-innerHeight class:', c);
  await p.close();
}

// ---- 3. 竖屏仍正常 ----
{
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
  await wait(700);
  const c = await p.evaluate(() => document.body.className);
  console.log('portrait class:', c);
  await p.close();
}

await b.close();
