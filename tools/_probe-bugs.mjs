import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});

const probe = async (w, h, tag) => {
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(900);
  await p.evaluate(() => document.querySelector('[data-act="new"]').click()); await wait(350);
  await p.evaluate(() => { const c = document.querySelector('[data-cfm="ok"]'); c && c.click(); }); await wait(300);
  await p.evaluate(() => document.querySelector('#disclaimerOk').click()); await wait(900);
  for (let i = 0; i < 8; i++) { await p.evaluate(() => { const s = document.querySelector('#stage'); s && s.click(); }); await wait(60); }

  const data = await p.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const stage = document.getElementById('stage');
    const layer = document.getElementById('spriteLayer');
    const sp = layer.querySelector('.sprite');
    const img = sp && sp.querySelector('img');
    window.__ZBNX.ui.toast('读取成功');
    const tst = document.getElementById('toast');
    const cs = getComputedStyle(tst);
    return {
      vw: innerWidth, vh: innerHeight,
      docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight,
      stage: r(stage), layer: r(layer), sprite: sp ? r(sp) : null,
      imgNatural: img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.getAttribute('src') } : null,
      spriteCS: sp ? { height: getComputedStyle(sp).height, width: getComputedStyle(sp).width, bottom: getComputedStyle(sp).bottom } : null,
      toast: r(tst),
      toastCS: { width: cs.width, position: cs.position, ws: cs.whiteSpace, wordBreak: cs.wordBreak, display: cs.display, fontSize: cs.fontSize },
      vertMode: getComputedStyle(document.body).writingMode
    };
  });
  await wait(200);
  await p.screenshot({ path: `build/_probe-${tag}.png` });
  console.log(tag, JSON.stringify(data, null, 0));
  if (errs.length) console.log(tag, 'ERR', errs);
  await p.close();
};

await probe(1080, 517, '1080x517');
await probe(872, 393, '872x393');
await probe(390, 844, '390x844');
await b.close();
