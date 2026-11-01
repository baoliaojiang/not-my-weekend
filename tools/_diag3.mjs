import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--mute-audio','--autoplay-policy=no-user-gesture-required'] });
const wait = ms => new Promise(r=>setTimeout(r,ms));
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:1280, height:760});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await wait(600);
await p.evaluate(()=>{ const s=document.querySelector('#bootSeq'); if(s){s.hidden=true;s.style.display='none';} });
await p.evaluate(()=>document.querySelector('[data-act="new"]')?.click()); await wait(300);
await p.evaluate(()=>document.querySelector('[data-cfm="ok"]')?.click()); await wait(250);
await p.evaluate(()=>document.querySelector('#disclaimerOk')?.click()); await wait(400);
await p.evaluate(()=>{ const t=document.querySelector('#titleScreen'); if(t) t.style.display='none'; });
await wait(300);
await p.evaluate(()=>window.__ZBNX.ui.openPhone('home',null)); await wait(600);

const measure = async (label) => {
  const r = await p.evaluate(()=>{
    const pick=(s)=>{const e=document.querySelector(s); if(!e) return null; const cs=getComputedStyle(e); const b=e.getBoundingClientRect();
      return {h:Math.round(b.height), sh:e.scrollHeight, ch:e.clientHeight, ov:cs.overflowY, mh:cs.minHeight, flex:cs.flex};};
    return { body:pick('.panel-body.mos-host'), appview:pick('.mos-appview'), view:pick('.mos-view'), mos:pick('.mos'), panel:pick('.panel') };
  });
  console.log(label, JSON.stringify(r));
};

await p.evaluate(()=>{ [...document.querySelectorAll('.mos-app')].find(a=>a.dataset.app==='settings')?.click(); });
await wait(600);
await measure('设置页:');
await p.screenshot({path:'build/_d4-settings.png'});

// 试滚动
const scrolled = await p.evaluate(()=>{ const v=document.querySelector('.mos-view'); if(!v) return 'no-view'; const before=v.scrollTop; v.scrollTop=400; return {before, after:v.scrollTop, canScroll: v.scrollHeight>v.clientHeight}; });
console.log('滚动测试:', JSON.stringify(scrolled));
console.log('errors:', errs.slice(0,3));
await b.close();
