import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--mute-audio']});
const p=await b.newPage(); const wait=ms=>new Promise(r=>setTimeout(r,ms));
await p.setViewport({width:1280,height:800});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
await wait(700);
await p.evaluate(()=>{document.querySelector('#bootSeq').hidden=true;document.querySelector('#bootSeq').style.display='none';});
await p.evaluate(()=>{document.querySelector('[data-act="new"]')?.click();}); await wait(300);
await p.evaluate(()=>{document.querySelector('[data-cfm="ok"]')?.click();}); await wait(250);
await p.evaluate(()=>{document.querySelector('#disclaimerOk')?.click();}); await wait(600);
await p.evaluate(()=>document.querySelector('#titleScreen').style.display='none');
for(let i=0;i<26;i++){ await p.evaluate(()=>document.querySelector('#stage')?.click()); await wait(120); }
await wait(600);
await p.screenshot({path:'build/_game-final.png'});
console.log('shot ok');
await b.close();
