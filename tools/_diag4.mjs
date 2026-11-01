import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const wait = ms => new Promise(r=>setTimeout(r,ms));
const p = await b.newPage();
await p.setViewport({width:1080, height:607});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await wait(600);
await p.evaluate(()=>{ const s=document.querySelector('#bootSeq'); if(s){s.hidden=true;s.style.display='none';} });
await wait(200);
await p.evaluate(()=>document.querySelector('[data-act="settings"]')?.click());
await wait(600);
const r = await p.evaluate(()=>{
  const g=(s)=>{const e=document.querySelector(s); if(!e) return null; const cs=getComputedStyle(e); const b=e.getBoundingClientRect();
    return {h:Math.round(b.height), top:Math.round(b.top), sh:e.scrollHeight, ch:e.clientHeight, ov:cs.overflowY, flex:cs.flex, mh:cs.minHeight};};
  const body=document.querySelector('.panel-body');
  let scrollOk=null;
  if(body){ const t=body.scrollTop; body.scrollTop=300; scrollOk={before:t, after:body.scrollTop}; body.scrollTop=t; }
  return { panel:g('.panel'), head:g('.panel-head'), body:g('.panel-body'), foot:g('.panel-foot'), scrollOk, night:document.body.className };
});
console.log(JSON.stringify(r,null,1));
await p.screenshot({path:'build/_d5-gameset.png'});
await b.close();
