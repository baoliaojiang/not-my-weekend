import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const wait = ms => new Promise(r=>setTimeout(r,ms));
const run = async (w,h,tag,cls) => {
  const p = await b.newPage();
  await p.setViewport({ width:w, height:h, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
  await wait(700);
  await p.evaluate(()=>document.querySelector('[data-act="new"]').click()); await wait(300);
  await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();}); await wait(250);
  await p.evaluate(()=>document.querySelector('#disclaimerOk').click()); await wait(700);
  await p.evaluate(()=>{ window.__ZBNX.stage.showSprite('shen'); });
  await wait(500);
  const d = await p.evaluate(()=>{
    const r = el => { const b = el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),bottom:Math.round(b.bottom)}; };
    const sp = document.querySelector('#spriteLayer .sprite');
    return { cls: document.body.className, vw: innerWidth, vh: innerHeight,
      sprite: sp ? { ...r(sp), src:(sp.getAttribute('src')||'').split('/').pop() } : null };
  });
  await p.screenshot({ path:`build/_spr-${tag}.png` });
  console.log(tag, JSON.stringify(d));
  await p.close();
};
await run(1080,517,'1080x517');
await run(390,844,'390x844');
await b.close();
