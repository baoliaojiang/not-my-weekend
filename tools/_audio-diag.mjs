import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,500));
const rows = await p.evaluate(async () => {
  const names=['broadcast','calm','calm2','canteen','city','classroom','daily','daydream','exam','goodbye','hall','home','hope','memory','morning','night_street','office','playground','rain','relax','room','silent','sunset','tense'];
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  const out=[];
  for(const n of names){
    const ab=await ctx.decodeAudioData(await (await fetch(`assets/music/${n}.mp3`)).arrayBuffer());
    const d=ab.getChannelData(0), sr=ab.sampleRate;
    // 1) 循环接缝：末尾到开头的跳变
    const tail=d[d.length-1], head=d[0];
    let seam=Math.abs(tail-head);
    // 末尾 50ms / 开头 50ms 的均值，衡量电平是否连续
    const w=Math.floor(sr*0.05); let a=0,c=0;
    for(let i=0;i<w;i++){a+=Math.abs(d[d.length-1-i]); c+=Math.abs(d[i]);}
    // 2) 最大采样间跳变（爆音/咔嗒）
    let maxStep=0, stepAt=0;
    for(let i=1;i<d.length;i++){const s=Math.abs(d[i]-d[i-1]); if(s>maxStep){maxStep=s; stepAt=i/sr;}}
    // 3) DC 偏移
    let dc=0; for(let i=0;i<d.length;i+=7) dc+=d[i]; dc/=Math.ceil(d.length/7);
    // 4) 三分之一的能量分布：低频<200 / 中 200-2k / 高>2k，看是否刺耳
    const N=2048; let lo=0,mid=0,hi=0;
    for(let f=0;f<12;f++){
      const off=Math.floor((d.length-N)/12*f);
      for(let k=1;k<N/2;k++){
        let rr=0,ii=0;
        for(let i=0;i<N;i++){const a2=2*Math.PI*k*i/N; rr+=d[off+i]*Math.cos(a2); ii-=d[off+i]*Math.sin(a2);}
        const m2=rr*rr+ii*ii, hz=k*sr/N;
        if(hz<200)lo+=m2; else if(hz<2000)mid+=m2; else hi+=m2;
      }
    }
    const tot=lo+mid+hi||1;
    out.push({n, seam:+seam.toFixed(3), tailAbs:+(a/w).toFixed(3), headAbs:+(c/w).toFixed(3),
      maxStep:+maxStep.toFixed(3), stepAt:+stepAt.toFixed(1), dc:+(dc*1000).toFixed(1),
      lo:+(lo/tot*100).toFixed(0), mid:+(mid/tot*100).toFixed(0), hi:+(hi/tot*100).toFixed(0)});
  }
  return out;
});
console.table(rows);
await b.close();
