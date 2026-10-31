/* 立绘自查：多种分辨率 × 1/2/3 人，量真实包围盒，判断是否重叠/出画。
   只读，不修改任何文件。 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';

const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
import fs from 'node:fs';

const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms));

const VIEWS = [
  { n: 'portrait-393', w: 393, h: 852, portrait: true },
  { n: 'portrait-360', w: 360, h: 740, portrait: true },
  { n: 'landscape-844', w: 844, h: 390, portrait: false },
  { n: 'landscape-1280', w: 1280, h: 720, portrait: false }
];

const SETS = [
  ['shen'],
  ['luo', 'sun'],          // 两张最宽的
  ['luo', 'sun', 'lin'],   // 三张最宽的
  ['shen', 'zhou'],
  ['shen', 'zhou', 'lin'],
  ['luo', 'sun', 'lin', 'shen'],   // 四人同台
  ['luo', 'sun', 'lin', 'shen', 'zhou'] // 五人同台
];

const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });

for (const v of VIEWS) {
  await p.setViewport({ width: v.w, height: v.h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await p.waitForFunction('!!window.__ZBNX', { timeout: 20000 });
  // 跳过启动序列，否则截到的永远是启动页
  await p.evaluate(() => { const b = document.querySelector('#bootSkip'); if (b) b.click(); });
  await wait(1400);
  await p.evaluate(() => { const s = document.querySelector('#bootSeq'); if (s) s.style.display = 'none'; });
  await p.evaluate((por) => {
    document.body.classList.toggle('is-portrait', por);
    window.__ZBNX.ui.closeAll && window.__ZBNX.ui.closeAll();
    window.__ZBNX.go('ch0');
  }, v.portrait);
  await wait(1200);
  // 序章开头是几张黑底卡片，按空格推过去，进到有立绘的场景
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Space'); await wait(450); }
  await p.evaluate(() => { window.__ZBNX.stage.hideAllSprites(); });
  await wait(500);

  for (const set of SETS) {
    await p.evaluate((ids) => {
      window.__ZBNX.stage.hideAllSprites();
      ids.forEach((id, i) => window.__ZBNX.stage.showSprite(id, i === 0 ? 'center' : 'left'));
    }, set);
    await wait(700);
    const res = await p.evaluate(() => {
      const els = [...document.querySelectorAll('#spriteLayer .sprite, .sprite-layer .sprite')]
        .filter(e => e.isConnected);
      const vw = innerWidth, vh = innerHeight;
      const rects = els.map(e => {
        const r = e.getBoundingClientRect();
        return { id: e.dataset.id, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      });
      const overlaps = [];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], c = rects[j];
          const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
          const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
          if (ox > 2 && oy > 2) overlaps.push(`${a.id}×${c.id} ${ox}px`);
        }
      }
      const out = rects.filter(r => r.x < -2 || r.x + r.w > vw + 2 || r.y < -2 || r.y + r.h > vh + 2)
        .map(r => `${r.id}(${r.x},${r.y},${r.w}×${r.h})`);
      const layer = document.querySelector('.sprite-layer');
      const dlg = document.querySelector('.dialogue');
      const d = dlg && dlg.getBoundingClientRect();
      const dlgRect = d ? { x: Math.round(d.left), y: Math.round(d.top), w: Math.round(d.width), h: Math.round(d.height) } : null;
      const coverDlg = dlgRect ? rects.filter(r => Math.min(r.x + r.w, dlgRect.x + dlgRect.w) - Math.max(r.x, dlgRect.x) > 4
        && Math.min(r.y + r.h, dlgRect.y + dlgRect.h) - Math.max(r.y, dlgRect.y) > 4).map(r => r.id) : [];
      return { count: rects.length, rects, overlaps, out, dataCount: layer && layer.dataset.count, vw, vh, dlgRect, coverDlg };
    });
    const tag = `${v.n} · ${set.join('+')}`;
    const bad = res.overlaps.length || res.out.length;
    console.log(`${bad ? '❌' : '✅'} ${tag} count=${res.count} data-count=${res.dataCount}`,
      res.rects.map(r => `${r.id} ${r.w}×${r.h}@${r.x},${r.y}`).join(' | '),
      res.overlaps.length ? '重叠:' + res.overlaps.join(',') : '',
      res.out.length ? '出画:' + res.out.join(',') : '',
      res.coverDlg.length ? '压对话框:' + res.coverDlg.join(',') : '');
    await p.screenshot({ path: path.join(ROOT, 'build', `_spr-${v.n}-${set.length}.png`) });
  }
}

if (errs.length) console.log('JS 错误:', [...new Set(errs)].slice(0, 8));
await b.close();
