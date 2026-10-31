/* 移动端横屏专项自查：多尺寸截屏 + 溢出/越界测量 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms));

const VIEWS = [
  { n: '844x390', w: 844, h: 390 },
  { n: '780x360', w: 780, h: 360 },
  { n: '926x428', w: 926, h: 428 },
  { n: '667x375', w: 667, h: 375 }
];

const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));

const measure = () => p.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    if (el.closest('[hidden]')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    if (r.right > vw + 2 || r.left < -2 || r.bottom > vh + 2 || r.top < -2) {
      const cls = (el.className && el.className.toString().slice(0, 40)) || el.tagName;
      bad.push(`${cls} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  });
  const doc = document.scrollingElement;
  return {
    vw, vh,
    scrollY: doc.scrollHeight > vh + 4,
    scrollX: doc.scrollWidth > vw + 4,
    overflow: bad.slice(0, 6)
  };
});

for (const v of VIEWS) {
  await p.setViewport({ width: v.w, height: v.h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await p.waitForFunction('!!window.__ZBNX', { timeout: 20000 });
  await p.evaluate(() => { const s = document.querySelector('#bootSeq'); if (s) s.style.display = 'none'; });
  await wait(500);

  // 标题页（带退出按钮）
  await p.evaluate(() => { const q = document.querySelector('#titleQuit'); if (q) q.hidden = false; });
  await wait(400);
  let m = await measure();
  console.log(`[标题] ${v.n}`, m.scrollY ? '纵向溢出' : '', m.scrollX ? '横向溢出' : '', m.overflow.join(' | '));
  await p.screenshot({ path: path.join(ROOT, 'build', `_ls-title-${v.n}.png`) });

  // 游戏内：2 人立绘
  await p.evaluate(() => {
    window.__ZBNX.go('ch0');
  });
  await wait(900);
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await wait(350); }
  await p.evaluate(() => {
    const s = window.__ZBNX.stage;
    s.hideAllSprites();
    s.showSprite('shen', 'center');
    s.showSprite('zhou', 'left');
  });
  await wait(700);
  m = await measure();
  console.log(`[游戏] ${v.n}`, m.scrollY ? '纵向溢出' : '', m.overflow.join(' | '));
  await p.screenshot({ path: path.join(ROOT, 'build', `_ls-game-${v.n}.png`) });

  // 手机桌面
  await p.evaluate(() => window.__ZBNX.ui.openPhone('home', null));
  await wait(700);
  m = await measure();
  const phone = await p.evaluate(() => {
    const el = document.querySelector('.mos');
    const grid = document.querySelector('.mos-grid');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      h: Math.round(r.height), vh: innerHeight,
      gridScroll: grid ? Math.round(grid.scrollHeight - grid.clientHeight) : 0,
      cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0
    };
  });
  console.log(`[手机] ${v.n}`, JSON.stringify(phone), m.overflow.join(' | '));
  await p.screenshot({ path: path.join(ROOT, 'build', `_ls-phone-${v.n}.png`) });

  // 聊天窗
  await p.evaluate(() => {
    const s = window.__ZBNX.settings;
    s.ai = { ...s.ai, on: true, baseUrl: 'https://x.test/v1', model: 'mock', apiKey: 'k' };
    window.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '我在。' } }] }) });
    window.__ZBNX.ui.closeAll();
    window.__ZBNX.ui.openAssistant();
  });
  await wait(700);
  m = await measure();
  console.log(`[聊天] ${v.n}`, m.overflow.join(' | '));
  await p.screenshot({ path: path.join(ROOT, 'build', `_ls-chat-${v.n}.png`) });
}

if (errs.length) console.log('JS 错误:', [...new Set(errs)].slice(0, 5));
await b.close();
