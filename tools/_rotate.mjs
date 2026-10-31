import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
const state = () => p.evaluate(()=>({
  cls: document.body.className.replace('is-title','').trim(),
  w: innerWidth, h: innerHeight,
  vh: getComputedStyle(document.documentElement).getPropertyValue('--vh').trim(),
  overflowX: document.documentElement.scrollWidth > innerWidth
}));
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,800));
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,250));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,1000));
for(let i=0;i<4;i++){ await p.evaluate(()=>document.querySelector('#stage').click()); await new Promise(r=>setTimeout(r,150)); }
console.log('竖 390x844:', JSON.stringify(await state()));
await p.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await new Promise(r=>setTimeout(r,500));
console.log('横 844x390:', JSON.stringify(await state()));
await p.screenshot({path:'build/rot-landscape.png'});
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await new Promise(r=>setTimeout(r,500));
console.log('转回竖:', JSON.stringify(await state()));
console.log('errors:', errs.length?errs:'(none)');
await b.close();
