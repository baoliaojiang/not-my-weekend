import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--mute-audio']});
const p=await b.newPage();
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,400));
const rows=await p.evaluate(async()=>{
  const names=['broadcast','calm','calm2','canteen','city','classroom','daily','daydream','exam','goodbye','hall','home','hope','memory','morning','night_street','office','playground','rain','relax','room','silent','sunset','tense'];
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  const out=[];
  for(const n of names){
    const ab=await ctx.decodeAudioData(await (await fetch(`assets/music/${n}.mp3`)).arrayBuffer());
    const d=ab.getChannelData(0), sr=ab.sampleRate;
    const hop=Math.floor(sr*0.01); const env=[];
    for(let i=0;i+hop<d.length;i+=hop){let s=0;for(let j=0;j<hop;j++){const v=d[i+j];s+=v*v;}env.push(Math.sqrt(s/hop));}
    // 起音包络：正向差分
    const flux=env.map((v,i)=>Math.max(0,v-(env[i-1]||0)));
    // 自相关估 BPM（60-180）
    let best=0,bestLag=0;
    for(let lag=Math.round(60/2/0.01); lag<=Math.round(60/0.6/0.01); lag++){
      let s=0; for(let i=lag;i<flux.length;i++) s+=flux[i]*flux[i-lag];
      if(s>best){best=s;bestLag=lag;}
    }
    const bpm = bestLag? +(60/(bestLag*0.01)).toFixed(0) : 0;
    // 动态范围：RMS 的 10/90 分位
    const sorted=[...env].sort((a,b)=>a-b);
    const p10=sorted[Math.floor(sorted.length*0.1)], p90=sorted[Math.floor(sorted.length*0.9)];
    const dr=+(20*Math.log10((p90||1e-6)/(p10||1e-6))).toFixed(1);
    // 起音密度：每秒超过阈值峰数
    const mean=flux.reduce((a,b)=>a+b,0)/flux.length;
    const thr=mean*2.2; let peaks=0;
    for(let i=1;i<flux.length-1;i++) if(flux[i]>thr && flux[i]>=flux[i+1] && flux[i]>flux[i-1]) peaks++;
    out.push({n,bpm,dynRange:dr,notesPerSec:+(peaks/(d.length/sr)).toFixed(1)});
  }
  return out;
});
console.table(rows);
await b.close();
