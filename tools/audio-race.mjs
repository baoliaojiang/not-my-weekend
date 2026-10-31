/* 快速连续切歌时是否出现两条轨同时出声（叠音 → 削波） */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__peak = 0;
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    try {
      if (dest && dest.constructor && dest.constructor.name === 'AudioDestinationNode') {
        const ctx = dest.context;
        if (!window.__an || window.__anCtx !== ctx) {
          window.__an = ctx.createAnalyser();
          window.__an.fftSize = 2048;
          window.__anCtx = ctx;
          origConnect.call(window.__an, dest);
          setInterval(() => {
            const b = new Float32Array(2048);
            window.__an.getFloatTimeDomainData(b);
            let m = 0;
            for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > m) m = v; }
            if (m > window.__peak) window.__peak = m;
          }, 30);
        }
        return origConnect.call(this, window.__an, ...rest);
      }
    } catch (e) {}
    return origConnect.call(this, dest, ...rest);
  };
});
await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(500);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(250);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(2500);

// 模拟场景快切：每 120ms 换一首
const seq = ['city', 'tense', 'relax', 'room', 'hall', 'hope', 'calm', 'city'];
await page.evaluate(() => { window.__peak = 0; });
for (const id of seq) {
  await page.evaluate((m) => window.__ZBNX.audio.play(m), id);
  await sleep(120);
}
await sleep(1500);
const r = await page.evaluate(() => {
  const a = window.__ZBNX.audio;
  return {
    peak: window.__peak,
    gains: a._trackGains ? a._trackGains.map(g => +g.gain.value.toFixed(3)) : null,
    paused: a.tracks.map(t => t.paused),
    playing: a.tracks.map(t => !t.paused),
    currentId: a.currentId
  };
});
console.log(JSON.stringify(r, null, 2));
console.log('peak dBFS', (20 * Math.log10(r.peak || 1e-9)).toFixed(1));
console.log('同时发声轨数', r.playing.filter(Boolean).length);
await browser.close();
