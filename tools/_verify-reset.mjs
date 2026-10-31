import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const wait = ms => new Promise(r=>setTimeout(r,ms));
await p.setViewport({width:1280,height:860});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await wait(800);
await p.evaluate(()=>document.querySelector('[data-act="settings"]').click()); await wait(400);
// 改几个值
await p.evaluate(()=>{
  const r=document.querySelector('#dlgScaleRange'); r.value='140'; r.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('[data-preset="local"]').click();
});
await wait(300);
const before = await p.evaluate(()=>({s:window.__ZBNX.settings.dlgScale, base:window.__ZBNX.settings.ai.baseUrl}));
await p.evaluate(()=>document.querySelector('#resetSettings').click()); await wait(300);
await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();}); await wait(600);
const after = await p.evaluate(()=>({s:window.__ZBNX.settings.dlgScale, base:window.__ZBNX.settings.ai.baseUrl, on:window.__ZBNX.settings.ai.on, night:window.__ZBNX.settings.nightMode}));
console.log('before', JSON.stringify(before));
console.log('after ', JSON.stringify(after));
await p.screenshot({path:'build/_set-06-ai.png'});
console.log('errors:', errs.length?errs:'(none)');
await b.close();
