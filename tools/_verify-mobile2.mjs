import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({ width:390, height:844, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
const wait = ms => new Promise(r=>setTimeout(r,ms));
await wait(800);
await p.screenshot({path:'build/v-20-m-title.png'});
await p.evaluate(()=>document.querySelector('[data-act="new"]').click()); await wait(350);
await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();}); await wait(300);
await p.evaluate(()=>document.querySelector('#disclaimerOk').click()); await wait(800);
let ch=0;
for (let i=0;i<120;i++){
  const picked = await p.evaluate(()=>{ const o=document.querySelector('#choiceBox .choice-item'); if(o){o.click(); return true;} const s=document.querySelector('#stage'); s&&s.click(); return false; });
  if (picked) ch++;
  await wait(50);
}
console.log('choices', ch);
await p.screenshot({path:'build/v-21-m-game.png'});
await p.evaluate(()=>window.__ZBNX.save(0)); await wait(200);
await p.evaluate(()=>window.__ZBNX.backToTitle()); await wait(600);
await p.evaluate(()=>document.querySelector('[data-act="continue"]').click()); await wait(500);
await p.screenshot({path:'build/v-22-m-continue.png'});
await p.evaluate(()=>{const c=document.querySelector('[data-ch]'); c&&c.click();}); await wait(500);
await p.screenshot({path:'build/v-24-m-timeline.png'});
const m = await p.evaluate(()=>({
  docW: document.documentElement.scrollWidth, cliW: document.documentElement.clientWidth,
  bodyOverflow: document.body.scrollHeight - innerHeight,
  barOn: !!document.querySelector('.tlx-bar.on'),
  kids: document.querySelectorAll('.tlx-kid').length
}));
console.log('mobile:', JSON.stringify(m));
console.log('errors:', errs.length?errs:'(none)');
await b.close();
