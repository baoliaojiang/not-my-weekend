import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.setViewport({ width:1280, height:820 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,700));
const act = async a => { await p.evaluate(x=>{const e=document.querySelector(`[data-act="${x}"]`); e&&e.click();}, a); await new Promise(r=>setTimeout(r,450)); };
const shot = async n => p.screenshot({path:`build/r-${n}.png`});
const close = async () => { await p.evaluate(()=>{const c=document.querySelector('#panelClose'); c&&c.click();}); await new Promise(r=>setTimeout(r,300)); };
for (const a of ['settings','changelog']) { await act(a); await shot(a); await close(); }
await act('continue'); await shot('continue'); await close();
await p.evaluate(()=>{const d=document.querySelector('#disclaimerOk'); d&&d.click();});
await new Promise(r=>setTimeout(r,700));
await p.evaluate(()=>{ window.__ZBNX.go('ch0'); });
await new Promise(r=>setTimeout(r,900));
for(let i=0;i<14;i++){ await p.evaluate(()=>{ const s=document.querySelector('#stage'); s&&s.click(); }); await new Promise(r=>setTimeout(r,120)); }
await shot('game');
for (const btn of ['btnMaterials','btnCharacters','btnLog','btnPhone']) {
  await p.evaluate(id=>{const e=document.getElementById(id); e&&e.click();}, btn);
  await new Promise(r=>setTimeout(r,500));
  await shot(btn);
  await p.evaluate(()=>{const c=document.querySelector('#panelClose'); c&&c.click();});
  await new Promise(r=>setTimeout(r,300));
}
await b.close();
