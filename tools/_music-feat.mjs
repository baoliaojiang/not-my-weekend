import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,500));
const rows = await p.evaluate(async () => {
  const names = ['broadcast','calm','calm2','canteen','city','classroom','daily','daydream','exam','goodbye','hall','home','hope','memory','morning','night_street','office','playground','rain','relax','room','silent','sunset','tense'];
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const out = [];
  for (const n of names) {
    const ab = await ctx.decodeAudioData(await (await fetch(`assets/music/${n}.mp3`)).arrayBuffer());
    const d = ab.getChannelData(0);
    const sr = ab.sampleRate;
    let sum=0, zc=0, peak=0;
    for (let i=1;i<d.length;i++){ sum+=d[i]*d[i]; if((d[i]>=0)!==(d[i-1]>=0))zc++; if(Math.abs(d[i])>peak)peak=Math.abs(d[i]); }
    const rms=Math.sqrt(sum/d.length);
    // 30 帧 512 点朴素 DFT，取频谱质心
    const N=512, frames=30, step=Math.floor((d.length-N)/frames);
    let cenAcc=0, cenN=0, flatAcc=0;
    for(let f=0;f<frames;f++){
      const off=f*step, re=new Float32Array(N), im=new Float32Array(N);
      for(let i=0;i<N;i++) re[i]=d[off+i]*(0.5-0.5*Math.cos(2*Math.PI*i/(N-1)));
      let num=0, den=0;
      for(let k=1;k<N/2;k++){
        let rr=0,ii=0;
        for(let i=0;i<N;i++){ const a=2*Math.PI*k*i/N; rr+=re[i]*Math.cos(a); ii-=re[i]*Math.sin(a); }
        const mag=Math.hypot(rr,ii);
        num+=mag*(k*sr/N); den+=mag;
      }
      if(den>0){ cenAcc+=num/den; cenN++; flatAcc+=den/(N/2); }
    }
    // 能量包络起伏 → 粗略节奏感（起音密度）
    const hop=Math.floor(sr*0.02); let prev=0, onsets=0, env=[];
    for(let i=0;i+hop<d.length;i+=hop){ let s=0; for(let j=0;j<hop;j++){const v=d[i+j]; s+=v*v;} env.push(Math.sqrt(s/hop)); }
    for(const e of env){ if(e-prev>0.012) onsets++; prev=e; }
    out.push({ n, sec:+(ab.duration.toFixed(0)), rmsDb:+(20*Math.log10(rms)).toFixed(1), zcr:+(zc/(d.length/sr)).toFixed(0), centroid:+(cenN?cenAcc/cenN:0).toFixed(0), onsetPerSec:+(onsets/ab.duration).toFixed(1) });
  }
  return out;
});
console.table(rows);
await b.close();
