import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.setViewport({width:390, height:844, deviceScaleFactor:2, isMobile:true, hasTouch:true});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,800));

// 标题页三个面板
for (const act of ['settings','changelog','about']) {
  await p.evaluate(a=>document.querySelector(`[data-act="${a}"]`).click(), act);
  await new Promise(r=>setTimeout(r,450));
  const m = await p.evaluate(()=>{
    const pl = document.querySelector('#panelLayer') || document.querySelector('.panel-layer');
    const box = document.querySelector('.panel') || document.querySelector('.panel-box');
    const r = box ? box.getBoundingClientRect() : null;
    return { open: pl ? !pl.hidden : null, w: r && Math.round(r.width), h: r && Math.round(r.height),
             overflowX: document.documentElement.scrollWidth > innerWidth };
  });
  console.log(act, JSON.stringify(m));
  await p.screenshot({path:`build/p-${act}.png`});
  await p.evaluate(()=>{ const c=document.querySelector('#panelClose'); c&&c.click(); });
  await new Promise(r=>setTimeout(r,350));
}

// 进游戏，打开菜单与时间轴
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,250));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,1100));
for(let i=0;i<4;i++){ await p.evaluate(()=>document.querySelector('#stage').click()); await new Promise(r=>setTimeout(r,150)); }
await p.evaluate(()=>document.querySelector('#btnMenu').click());
await new Promise(r=>setTimeout(r,400));
await p.screenshot({path:'build/p-menu.png'});
const menuOk = await p.evaluate(()=>{
  const items=[...document.querySelectorAll('[data-menu]')];
  return { n: items.length, overflowX: document.documentElement.scrollWidth > innerWidth,
           rects: items.map(i=>{const r=i.getBoundingClientRect(); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];}) };
});
console.log('menu', JSON.stringify(menuOk).slice(0,400));
console.log('errors:', errs.length?errs:'(none)');
await b.close();
