import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const SRC = 'file:///C:/Users/12821/Documents/Tencent%20Files/1643732839/nt_qq/nt_data/Video/2026-10/Ori/efaabb9631bf1b035918aa826bbab9c3.mp4';
const OUT = 'D:/workbuddy/2026-10-23-16-33-10/build/tmpframe';
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/grab.html`, '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"></body>');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 1067 });
page.on('console', m => console.log('[console]', m.text()));
await page.goto(`file:///${OUT}/grab.html`);

try {
  const dataUrls = await page.evaluate(async (src) => {
    const v = document.createElement('video');
    v.src = src; v.muted = true; v.playsInline = true;
    document.body.appendChild(v);
    await new Promise((res, rej) => {
      v.onloadedmetadata = res;
      v.onerror = () => rej(new Error('video error code=' + (v.error && v.error.code) + ' msg=' + (v.error && v.error.message)));
      setTimeout(() => rej(new Error('metadata timeout rs=' + v.readyState)), 8000);
    });
    const dur = v.duration || 2.8;
    const c = document.createElement('canvas');
    c.width = 480; c.height = Math.round(480 * v.videoHeight / v.videoWidth);
    const ctx = c.getContext('2d');
    const out = [];
    const n = 15;
    for (let i = 0; i < n; i++) {
      const t = Math.min(dur - 0.02, (dur * i) / (n - 1));
      await new Promise(res => { v.onseeked = res; v.currentTime = t; });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      out.push({ t, url: c.toDataURL('image/png') });
    }
    return { dur, out };
  }, SRC);

  dataUrls.out.forEach((f, i) => {
    const b64 = f.url.split(',')[1];
    fs.writeFileSync(`${OUT}/f${String(i + 1).padStart(2, '0')}_${f.t.toFixed(2)}s.png`, Buffer.from(b64, 'base64'));
  });
  console.log('frames:', dataUrls.out.length, 'duration:', dataUrls.dur);
} catch (e) {
  console.log('FAIL', e.message);
}
await browser.close();
