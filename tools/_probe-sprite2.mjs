import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});

const run = async (w, h, tag) => {
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(900);
  await p.evaluate(() => document.querySelector('[data-act="new"]').click()); await wait(320);
  await p.evaluate(() => { const c = document.querySelector('[data-cfm="ok"]'); c && c.click(); }); await wait(280);
  await p.evaluate(() => document.querySelector('#disclaimerOk').click()); await wait(900);

  const idx = await p.evaluate(() => {
    const ch = window.__ZBNX.chapters['ch0'];
    const nodes = ch.nodes || ch.scenes || [];
    return nodes.findIndex(n => n.text === '我妈说第一天不能迟到。');
  });
  console.log(tag, 'node index', idx);
  await p.evaluate(i => window.__ZBNX.go('ch0', i), idx);
  await wait(800);
  await p.evaluate(() => { const s = document.querySelector('#stage'); s && s.click(); });
  await wait(400);

  const d = await p.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
    const sp = document.querySelector('#spriteLayer .sprite');
    const dlg = document.querySelector('#dialogue') || document.querySelector('.dialogue');
    const tag = document.querySelector('#placeTag');
    const hud = document.querySelector('#hud');
    return {
      vw: innerWidth, vh: innerHeight,
      sprite: sp ? { ...r(sp), cls: sp.className, nat: sp.naturalWidth ? `${sp.naturalWidth}x${sp.naturalHeight}` : 'n/a', src: (sp.getAttribute('src') || '').split('/').pop() } : null,
      dialogue: dlg ? r(dlg) : null,
      place: tag && !tag.hidden ? { ...r(tag), text: tag.textContent } : null,
      hud: hud ? r(hud) : null
    };
  });
  await p.screenshot({ path: `build/_sp2-${tag}.png` });
  console.log(tag, JSON.stringify(d));
  if (errs.length) console.log(tag, 'ERR', errs);
  await p.close();
};

await run(1080, 517, '1080x517');
await run(872, 393, '872x393');
await run(390, 844, '390x844');
await b.close();
