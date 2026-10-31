import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
const p = await b.newPage();
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,600));
const out = await p.evaluate(async () => {
  const files = ['broadcast','calm','calm2','canteen','city','classroom','daily','daydream','exam','goodbye','hall','home','hope','memory','morning','night_street','office','playground','rain','relax','room','silent','sunset','tense','title'];
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const rows=[];
  for (const f of files) {
    try {
      const r = await fetch(`assets/music/${f}.mp3`);
      const buf = await r.arrayBuffer();
      const ab = await ctx.decodeAudioData(buf);
      const d = ab.getChannelData(0);
      let peak=0, sum=0, clip=0;
      for (let i=0;i<d.length;i++){ const v=Math.abs(d[i]); if(v>peak)peak=v; sum+=d[i]*d[i]; if(v>=0.999)clip++; }
      rows.push({ f, sec:+(ab.duration.toFixed(1)), peakDb:+(20*Math.log10(peak||1e-9)).toFixed(2), rmsDb:+(10*Math.log10(sum/d.length||1e-9)).toFixed(1), clipPct:+((clip/d.length)*100).toFixed(2) });
    } catch(e){ rows.push({f, err:e.message}); }
  }
  return rows;
});
const bad = out.filter(r=>r.err || r.peakDb > -0.3 || r.clipPct > 0.01);
console.table(out);
console.log('异常:', bad.length ? JSON.stringify(bad) : '无');
await b.close();
