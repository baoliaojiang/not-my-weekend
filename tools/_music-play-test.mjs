import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,800));
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,300));
await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();});
await new Promise(r=>setTimeout(r,200));
await p.evaluate(()=>{const d=document.querySelector('#disclaimerOk'); d&&d.click();});
await new Promise(r=>setTimeout(r,600));
const res=[];
for(const id of ['broadcast','playground','morning','exam','home','memory','goodbye']){
  const r = await p.evaluate(async (id)=>{
    try{ window.__ZBNX.audio.play(id); await new Promise(x=>setTimeout(x,260));
      return { id, cur: window.__ZBNX.audio.currentId, ok: window.__ZBNX.audio.currentId===id, failed:[...window.__ZBNX.audio.failed] }; }
    catch(e){ return { id, err:e.message }; }
  }, id);
  res.push(r);
}
console.log(JSON.stringify(res,null,1));
console.log('errors:', errs.length?errs:'none');
await b.close();
