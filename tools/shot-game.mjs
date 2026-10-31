import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:1280,height:800});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,700));
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,250));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,1200));
for(let i=0;i<8;i++){ await p.evaluate(()=>document.querySelector('#stage').click()); await new Promise(r=>setTimeout(r,160)); }
await p.screenshot({path:'build/shot-game-hud.png'});
// 打开更新日志看一眼
await p.evaluate(()=>document.querySelector('#btnMenu').click());
await new Promise(r=>setTimeout(r,300));
await p.evaluate(()=>{ const b=[...document.querySelectorAll('[data-menu]')].find(x=>x.dataset.menu==='changelog'); b&&b.click(); });
await new Promise(r=>setTimeout(r,400));
await p.screenshot({path:'build/shot-changelog.png'});
console.log('errors:', errs.length?errs:'(none)');
await b.close();
