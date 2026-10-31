import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text());});
await p.setViewport({width:1280,height:820});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(900);
await p.evaluate(()=>document.querySelector('[data-act="new"]').click()); await wait(300);
await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();}); await wait(250);
await p.evaluate(()=>{const d=document.querySelector('#disclaimerOk'); d&&d.click();}); await wait(700);

const seen=new Set();
for(let i=0;i<150;i++){
  const id = await p.evaluate(()=>{ try{ return window.__ZBNX.audio.currentId||null }catch(e){ return null } });
  if(id) seen.add(id);
  await p.evaluate(()=>{const s=document.querySelector('#stage'); s&&s.click();});
  await wait(45);
}
console.log('剧情推进中实际播放:', [...seen].join(' '));
console.log('errors:', errs.length? errs.slice(0,4) : 'none');
await b.close();
