/* 测量游戏内音乐的实际输出峰值：注入 AudioNode.connect，把 destination 前挂一个 analyser */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));

await page.evaluateOnNewDocument(() => {
  window.__peak = 0;
  window.__peakHistory = [];
  window.__dbg = { hooked: 0, ctx: null };
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    try {
      if (dest && dest.constructor && dest.constructor.name === 'AudioDestinationNode') {
        const ctx = dest.context;
        if (!window.__an || window.__anCtx !== ctx) {
          window.__an = ctx.createAnalyser();
          window.__an.fftSize = 2048;
          window.__anCtx = ctx;
          window.__dbg.ctx = ctx;
          origConnect.call(window.__an, dest);
          setInterval(() => {
            const buf = new Float32Array(window.__an.fftSize);
            window.__an.getFloatTimeDomainData(buf);
            let m = 0;
            for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > m) m = v; }
            if (m > window.__peak) window.__peak = m;
            window.__peakHistory.push(+m.toFixed(4));
            if (window.__peakHistory.length > 400) window.__peakHistory.shift();
          }, 40);
        }
        window.__dbg.hooked++;
        return origConnect.call(this, window.__an, ...rest);
      }
    } catch (e) { /* ignore */ }
    return origConnect.call(this, dest, ...rest);
  };
});

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(600);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(4000);

const info = await page.evaluate(() => {
  const a = window.__ZBNX.audio;
  return {
    peak: window.__peak,
    hooked: window.__dbg.hooked,
    ctxState: a._ctx ? a._ctx.state : null,
    sampleRate: a._ctx ? a._ctx.sampleRate : null,
    currentId: a.currentId,
    trackGains: a._trackGains ? a._trackGains.map(g => +g.gain.value.toFixed(3)) : null,
    volumes: a.tracks.map(t => +t.volume.toFixed(3)),
    paused: a.tracks.map(t => t.paused),
    bgmVolume: window.__ZBNX.settings.bgmVolume,
    bgmOn: window.__ZBNX.settings.bgmOn,
    gain: a._gain()
  };
});
console.log(JSON.stringify(info, null, 2));

// 再切几首，看切换瞬间（交叉淡变叠加）的峰值
for (const id of ['city', 'tense', 'relax', 'room']) {
  await page.evaluate((mid) => { window.__peak = 0; window.__ZBNX.audio.play(mid); }, id);
  await sleep(1400);
  const p = await page.evaluate(() => window.__peak);
  console.log(`switch -> ${id}  peak=${p.toFixed(3)} (${(20 * Math.log10(p || 1e-6)).toFixed(1)} dBFS)`);
}

await browser.close();
