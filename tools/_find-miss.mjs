import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--mute-audio']});
const p=await b.newPage(); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const miss=[];
p.on('requestfailed',r=>miss.push(r.url()));
p.on('response',r=>{if(r.status()>=400)miss.push(r.status()+' '+r.url());});
await p.setViewport({width:1280,height:860});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
await wait(600);
for(let i=0;i<6;i++){ await p.evaluate(()=>document.querySelector('[data-act="new"]')?.click()); await wait(200);
  await p.evaluate(()=>document.querySelector('[data-cfm="ok"]')?.click()); await wait(200);
  await p.evaluate(()=>document.querySelector('#disclaimerOk')?.click()); await wait(300); }
await p.evaluate(()=>window.__ZBNX.ui.openPhone('home',null));
await wait(600);
const apps=['store','camera','clock','weather','music','files','settings','changelog','about','people','save','timeline'];
for(const a of apps){ await p.evaluate(a=>{document.querySelector(`.mos-app[data-app="${a}"], [data-app="${a}"]`)?.click();},a); await wait(500); }
await wait(800);
console.log([...new Set(miss)].join('\n')||'无缺失');
await b.close();
