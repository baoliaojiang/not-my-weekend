/* 竖屏排版验证：390×844（典型手机竖屏）
   检查：
     1. body 有 is-portrait 类
     2. 立绘高度、左右偏移是否收敛（不全屏、不互相完全遮住）
     3. 说话的人是否 z-index 提升、没在说话的是否压暗
     4. 对话框高度是否够、正文有没有被裁
     5. 设置里切到横屏后 is-portrait 是否去掉
   顺带存几张图看效果。
*/
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const OUT = 'D:/workbuddy/2026-10-23-16-33-10/tools/shots-portrait';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const logs = [];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = n => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(900);
await shot('p01-title');

/* ---------- 进游戏：直接开第一章 ---------- */
await page.evaluate(() => window.__ZBNX.go('ch1'));
await sleep(1200);
// 推进到有立绘的地方
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__ZBNX.engine.advance && window.__ZBNX.engine.advance());
  await sleep(120);
}
await sleep(600);
await shot('p02-ch1');

/* ---------- 收拾掉路上弹出的材料面板，腾出干净的舞台 ---------- */
async function closeAll() {
  for (let i = 0; i < 8; i++) {
    const hit = await page.evaluate(() => {
      const pick = ['#matTake', '#panelClose', '#chatContinueBtn'];
      for (const sel of pick) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.click(); return sel; }
      }
      return null;
    });
    if (!hit) break;
    await sleep(220);
  }
}
await closeAll();

/* ---------- 手动摆两个人，测说话人置顶 ---------- */
await page.evaluate(() => {
  const s = window.__ZBNX.stage;
  s.restoreScene && s.restoreScene({ bg: 'classroom', sprites: [] });
  s.showSprite('luo', 'left');
  s.showSprite('chen', 'right');
  s.setSpeaker && s.setSpeaker('luo');
  // 兜底：直接挂 speaking 类
  const els = document.querySelectorAll('.sprite');
  els.forEach(el => el.classList.remove('speaking'));
  if (els[0]) els[0].classList.add('speaking');
});
await sleep(700);
await shot('p03-two-sprites');

const m = await page.evaluate(() => {
  const out = { vw: innerWidth, vh: innerHeight, bodyClass: document.body.className, sprites: [] };
  document.querySelectorAll('.sprite').forEach(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.sprites.push({
      cls: el.className,
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      w: Math.round(r.width), h: Math.round(r.height),
      opacity: cs.opacity, z: cs.zIndex, translate: cs.translate
    });
  });
  const d = document.querySelector('.dialogue');
  const b = document.querySelector('.dlg-body');
  const t = document.querySelector('.dlg-text');
  if (d && b) {
    const rb = b.getBoundingClientRect(), rt = t.getBoundingClientRect();
    out.dialogue = {
      bodyTop: Math.round(rb.top), bodyH: Math.round(rb.height),
      textH: Math.round(rt.height), textClipped: rt.bottom > rb.bottom + 1,
      textScroll: t.scrollHeight > t.clientHeight + 1
    };
  }
  out.hud = (() => { const e = document.querySelector('.hud'); if (!e) return null; const r = e.getBoundingClientRect(); return { h: Math.round(r.height) }; })();
  out.apBar = (() => { const e = document.querySelector('.ap-bar'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right) }; })();
  return out;
});
console.log('PORTRAIT-METRICS', JSON.stringify(m, null, 1));

/* ---------- 断言 ---------- */
const ok = [];
const bad = [];
const A = (cond, msg) => (cond ? ok : bad).push(msg);

A(/is-portrait/.test(m.bodyClass), 'body.is-portrait 已生效');
const sp = m.sprites;
A(sp.length >= 2, `立绘数量 ${sp.length}`);
if (sp.length >= 2) {
  const spk = sp.find(s => /speaking/.test(s.cls));
  const oth = sp.find(s => !/speaking/.test(s.cls));
  A(!!spk, '存在 speaking 立绘');
  if (spk) {
    A(Number(spk.z) >= 3, `说话人 z-index=${spk.z}（应 ≥3，置顶）`);
    A(Number(spk.opacity) >= 0.95, `说话人 opacity=${spk.opacity}（应接近 1）`);
    A(spk.h <= m.vh * 0.66, `说话人高度 ${spk.h}px ≤ 66% 屏高（${Math.round(m.vh * 0.66)}）`);
    A(spk.bottom <= m.vh + 2, `说话人底部 ${spk.bottom} 未溢出屏幕 ${m.vh}`);
  }
  if (oth) {
    A(Number(oth.opacity) <= 0.8, `非说话人 opacity=${oth.opacity}（应 ≤0.8，压暗）`);
  }
  // 两张立绘不能完全重叠：各自至少露出 25% 宽度在画面内
  const inView = s => Math.max(0, Math.min(s.right, m.vw) - Math.max(s.left, 0));
  sp.forEach(s => A(inView(s) >= s.w * 0.4, `立绘在画面内的可见宽度 ${inView(s)}px ≥ 40%×${s.w}`));
}
if (m.dialogue) {
  A(!m.dialogue.textClipped, '对话正文未被上下裁切');
  A(!m.dialogue.textScroll, '对话正文无内部滚动');
  A(m.dialogue.bodyH >= 150, `对话框高度 ${m.dialogue.bodyH}px ≥ 150`);
  A(m.dialogue.bodyTop > 380, `对话框顶边 ${m.dialogue.bodyTop}px 在下半屏（留出立绘区）`);
}
if (m.apBar) A(m.apBar.left < 60, `行动点靠左 ${m.apBar.left}px（不与右侧按钮挤）`);

/* ---------- 面板全屏化 ---------- */
await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
await sleep(600);
await shot('p04-settings');
const pn = await page.evaluate(() => {
  const p = document.querySelector('#panelLayer .panel');
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight };
});
if (pn) {
  A(Math.abs(pn.w - pn.vw) <= 2, `面板宽度 ${pn.w} = 屏宽 ${pn.vw}`);
  A(Math.abs(pn.h - pn.vh) <= 2, `面板高度 ${pn.h} = 屏高 ${pn.vh}`);
}

/* ---------- 切横屏 ---------- */
const switched = await page.evaluate(() => {
  const seg = document.querySelector('#screenSeg');
  if (!seg) return 'no-seg';
  const b = seg.querySelector('[data-screen="landscape"]');
  if (!b) return 'no-btn';
  b.click();
  return document.body.className;
});
await sleep(600);
await shot('p05-forced-landscape');
A(switched !== 'no-seg' && switched !== 'no-btn', `设置里有画面方向控件（${switched}）`);
const land = await page.evaluate(() => ({
  bodyClass: document.body.className,
  spriteH: (() => { const e = document.querySelector('.sprite'); return e ? Math.round(e.getBoundingClientRect().height) : null; })()
}));
A(!/is-portrait/.test(land.bodyClass), '切横屏后 is-portrait 被移除');
A(/is-landscape/.test(land.bodyClass), '切横屏后加上 is-landscape');

console.log('\n通过 ' + ok.length + ' 项');
ok.forEach(s => console.log('  ✓ ' + s));
if (bad.length) { console.log('\n失败 ' + bad.length + ' 项'); bad.forEach(s => console.log('  ✗ ' + s)); }
console.log('\nJS 错误: ' + (errors.length ? errors.join('\n') : '(none)'));
await browser.close();
process.exit(bad.length ? 1 : 0);
