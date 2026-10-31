/* 音乐体检：逐个解码 assets/music/*.mp3，量峰值 / 有效值 / 削波占比 / 低频占比 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path'; import fs from 'node:fs';
const ROOT = process.cwd();
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox','--allow-file-access-from-files','--mute-audio','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
await p.waitForFunction('!!window.__ZBNX');
const files = fs.readdirSync(path.join(ROOT, 'assets/music')).filter(f => f.endsWith('.mp3'));
const out = await p.evaluate(async (files) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const res = [];
  for (const f of files) {
    const buf = await (await fetch('assets/music/' + f)).arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const ch0 = audio.getChannelData(0);
    let peak = 0, sum = 0, clip = 0;
    for (let i = 0; i < ch0.length; i++) {
      const v = Math.abs(ch0[i]);
      if (v > peak) peak = v;
      if (v > 0.989) clip++;
      sum += ch0[i] * ch0[i];
    }
    const rms = Math.sqrt(sum / ch0.length);
    // 低频占比：跑一遍 lowpass 80Hz 再算 rms
    const off = new OfflineAudioContext(1, ch0.length, audio.sampleRate);
    const src = off.createBufferSource();
    src.buffer = audio;
    const lp = off.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 80; lp.Q.value = 0.7;
    src.connect(lp); lp.connect(off.destination); src.start(0);
    const rendered = await off.startRendering();
    const lo = rendered.getChannelData(0);
    let lsum = 0;
    for (let i = 0; i < lo.length; i++) lsum += lo[i] * lo[i];
    const loRms = Math.sqrt(lsum / lo.length);
    res.push({
      f, dur: +audio.duration.toFixed(1),
      peakDb: +(20 * Math.log10(peak)).toFixed(2),
      rmsDb: +(20 * Math.log10(rms)).toFixed(2),
      clipPct: +(clip / ch0.length * 100).toFixed(3),
      lowShare: +(loRms / rms * 100).toFixed(1)
    });
  }
  return res;
}, files);
out.sort((a, x) => x.peakDb - a.peakDb);
console.log('file                  dur  peak   rms    clip%   low<80Hz');
for (const r of out) console.log(`${r.f.padEnd(20)} ${String(r.dur).padStart(5)} ${String(r.peakDb).padStart(6)} ${String(r.rmsDb).padStart(6)} ${String(r.clipPct).padStart(7)} ${String(r.lowShare).padStart(8)}`);
const worst = out.slice(0, 3);
console.log('\n最响三首:', worst.map(x => `${x.f} ${x.peakDb}dB/${x.rmsDb}dB`).join(' | '));
await b.close();
