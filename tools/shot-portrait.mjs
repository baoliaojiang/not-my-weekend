import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.setViewport({width:390, height:844, deviceScaleFactor:2, isMobile:true, hasTouch:true});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,900));
const t = await p.evaluate(()=>({cls:document.body.className, w:innerWidth, h:innerHeight,
  scrollH:document.documentElement.scrollHeight,
  overflowX:document.documentElement.scrollWidth > innerWidth}));
console.log('标题页', JSON.stringify(t));
await p.screenshot({path:'build/portrait-title.png', fullPage:true});

await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,300));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,1200));
for(let i=0;i<6;i++){ await p.evaluate(()=>document.querySelector('#stage').click()); await new Promise(r=>setTimeout(r,180)); }
const g = await p.evaluate(()=>({cls:document.body.className, txt:document.querySelector('#dlgText').textContent.slice(0,20),
  dlgH: document.querySelector('#dialogue').getBoundingClientRect().height,
  overflowX: document.documentElement.scrollWidth > innerWidth,
  spriteW: (document.querySelector('.sprite.on')||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width }));
console.log('游戏内', JSON.stringify(g));
await p.screenshot({path:'build/portrait-game.png'});
console.log('errors:', errs.length?errs:'(none)');
await b.close();
