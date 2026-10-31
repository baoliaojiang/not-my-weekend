/* 圆角审计：找出「有底色/边框、却是直角」的元素 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 700));

const probe = () => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return;
    const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const hasBd = ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none');
    const hasShadow = cs.boxShadow !== 'none';
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
    const sharp = rad.every(v => parseFloat(v) === 0);
    const fullBleed = r.width >= vw - 2 && r.height >= vh - 2;
    const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    if ((filled || hasShadow) && sharp && !fullBleed) {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      out.push({
        sel: tag + (el.id ? '#' + el.id : '') + cls,
        w: Math.round(r.width), h: Math.round(r.height),
        bg: hasBg ? cs.backgroundColor : '', bd: hasBd ? cs.borderTopWidth + ' ' + cs.borderTopColor : '',
        sh: hasShadow
      });
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  return out;
};

const seen = new Map();
const collect = async (label) => {
  const list = await p.evaluate(probe);
  for (const it of list) {
    const k = it.sel;
    if (!seen.has(k)) seen.set(k, { ...it, where: [label] });
    else seen.get(k).where.includes(label) || seen.get(k).where.push(label);
  }
  console.log(`[${label}] 直角元素 ${list.length}`);
};

await collect('title');

const openAct = async (act) => {
  await p.evaluate(a => {
    const el = document.querySelector(`[data-act="${a}"]`);
    if (el) el.click();
  }, act);
  await new Promise(r => setTimeout(r, 420));
};
const closePanel = async () => {
  await p.evaluate(() => {
    const c = document.querySelector('#panelClose');
    if (c) c.click();
    const pl = document.querySelector('#panelLayer');
    if (pl) pl.hidden = true;
  });
  await new Promise(r => setTimeout(r, 320));
};

for (const act of ['settings', 'changelog', 'about', 'load', 'continue', 'side']) {
  await openAct(act);
  await new Promise(r => setTimeout(r, 260));
  await collect(act);
  await closePanel();
}

// 进游戏，看舞台 / HUD / 对话框 / 选项
try {
  await p.evaluate(() => { const d = document.querySelector('#disclaimerOk'); if (d) d.click(); });
  await new Promise(r => setTimeout(r, 600));
  await p.evaluate(() => window.__ZBNX && window.__ZBNX.start && window.__ZBNX.start());
  await new Promise(r => setTimeout(r, 1200));
  await collect('game');
  for (let i = 0; i < 24; i++) { await p.evaluate(() => window.__ZBNX && window.__ZBNX.tap && window.__ZBNX.tap()); await new Promise(r => setTimeout(r, 90)); }
  await collect('game2');
} catch (e) { console.log('game probe failed:', e.message); }

console.log('\n===== 直角清单 =====');
const rows = [...seen.values()].sort((a, b) => b.w * b.h - a.w * a.h);
for (const r of rows) console.log(`${r.w}x${r.h}\t${r.sel}\t${r.bg || r.bd}\t@${r.where.join(',')}`);
console.log('\ntotal', rows.length, 'errors', errs.length ? errs : '(none)');
await b.close();
