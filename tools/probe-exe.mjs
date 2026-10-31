import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9334', defaultViewport: null });
const pages = await browser.pages();
const page = pages.find(p => p.url().includes('index.html')) || pages[0];
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('requestfailed', r => errs.push('FAILED ' + r.url() + ' ' + r.failure()?.errorText));

const info = await page.evaluate(async () => {
  const bg = document.querySelector('.title-bg');
  const cs = getComputedStyle(bg);
  const img = new Image();
  const url = getComputedStyle(document.documentElement).getPropertyValue('--x') || null;
  const bgUrl = cs.backgroundImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
  let loadState = 'pending';
  await new Promise(res => {
    img.onload = () => { loadState = 'ok ' + img.naturalWidth + 'x' + img.naturalHeight; res(); };
    img.onerror = (e) => { loadState = 'error'; res(); };
    img.src = bgUrl;
    setTimeout(res, 4000);
  });
  return {
    bgUrl, loadState,
    opacity: cs.opacity, display: cs.display, visibility: cs.visibility,
    rect: bg.getBoundingClientRect().toJSON(),
    filter: cs.filter,
    zIndex: cs.zIndex,
    titleRect: document.querySelector('.title-screen').getBoundingClientRect().toJSON(),
    fontFamily: getComputedStyle(document.querySelector('.title-main')).fontFamily,
    fontOk: document.fonts ? document.fonts.check('16px MiSans') : null
  };
});
console.log(JSON.stringify(info, null, 1));
console.log('ERRORS', errs.slice(0, 8));
await browser.disconnect();
