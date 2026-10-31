import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({width:1280,height:800});
p.on('pageerror', e=>console.log('ERR', e.message));
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,700));
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,300));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,900));

const snap = () => p.evaluate(()=>{
  const e = window.__ZBNX.engine;
  return {
    txt: (document.querySelector('#dlgText')||{}).textContent.slice(0,24),
    i: (e.frames[0]||{}).i,
    cur: (e.current||{}).t,
    typing: e.typing, waiting: e.waiting, paused: e.paused, blocked: e.blocked,
    skipActive: e.skipActive, skipAll: e.skipAll,
    panel: !document.querySelector('#panelLayer').hidden,
    dlgHidden: document.querySelector('#dialogue').hidden,
    skipPrompt: !document.querySelector('#skipPrompt').hidden,
    frames: e.frames.length
  };
});

let last='', stuck=0;
for(let i=0;i<900;i++){
  await p.evaluate(()=>{
    const o=document.querySelectorAll('#choiceBox .choice-item');
    if(o.length){o[0].click();return;}
    const s=document.querySelector('#sumNext');
    if(s && s.offsetParent!==null){ s.click(); return; }
    document.querySelector('#stage').click();
  });
  await new Promise(r=>setTimeout(r,40));
  const info = await snap();
  if(info.txt===last) stuck++; else { stuck=0; last=info.txt; }
  if(i%30===0) console.log(i, JSON.stringify(info));
  if(stuck>40){ console.log('STUCK at tap',i, JSON.stringify(info,null,1)); break; }
}
await b.close();
