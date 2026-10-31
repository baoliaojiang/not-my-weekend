import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.setViewport({width:1057, height:493, deviceScaleFactor:2, isMobile:true, hasTouch:true});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,700));
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,250));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,1000));

// 一直点到有立绘
for (let i=0;i<120;i++){
  await p.evaluate(()=>{
    const o=document.querySelectorAll('#choiceBox .choice-item');
    if(o.length){o[0].click();return;}
    document.querySelector('#stage').click();
  });
  await new Promise(r=>setTimeout(r,60));
  const has = await p.evaluate(()=>!!document.querySelector('.sprite.on'));
  if (has && i > 3) break;
}

const dump = await p.evaluate(()=>{
  const out = {body: document.body.className, view:[innerWidth,innerHeight]};
  const els = [...document.querySelectorAll('#stage *')].filter(e=>{
    const r=e.getBoundingClientRect(); return r.width>60 && r.height>60;
  }).slice(0,14);
  out.boxes = els.map(e=>{
    const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
    return { cls:e.className||e.tagName, tag:e.tagName,
      x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height),
      bg:cs.backgroundColor, img:e.getAttribute&&e.getAttribute('src')||'' };
  });
  return out;
});
console.log(JSON.stringify(dump, null, 1));
await p.screenshot({path:'build/stage-1057.png'});
console.log('errors:', errs.length?errs:'(none)');
await b.close();
