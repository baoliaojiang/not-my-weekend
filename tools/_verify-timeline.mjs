import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({ width:1280, height:820 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,700));
const wait = ms => new Promise(r=>setTimeout(r,ms));
await p.evaluate(()=>document.querySelector('[data-act="new"]').click()); await wait(300);
await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();}); await wait(300);
await p.evaluate(()=>document.querySelector('#disclaimerOk').click()); await wait(800);
// 走很远：点舞台 + 遇到选项就选第一个
let choices = 0;
for (let i=0;i<220;i++) {
  const picked = await p.evaluate(()=>{
    const opt = document.querySelector('#choiceBox .choice-item');
    if (opt) { opt.click(); return true; }
    const s = document.querySelector('#stage'); s && s.click(); return false;
  });
  if (picked) choices++;
  await wait(55);
}
console.log('choices picked:', choices);
await p.evaluate(()=>window.__ZBNX.save(0)); await wait(200);
await p.screenshot({path:'build/v-10-game-deep.png'});
await p.evaluate(()=>window.__ZBNX.backToTitle()); await wait(600);
await p.evaluate(()=>document.querySelector('[data-act="continue"]').click()); await wait(450);
await p.evaluate(()=>{const c=document.querySelector('[data-ch]'); c&&c.click();}); await wait(500);
await p.screenshot({path:'build/v-11-timeline-branches.png'});
const info = await p.evaluate(()=>({
  nodes: document.querySelectorAll('.tlx-node').length,
  branches: document.querySelectorAll('.tlx-branch').length,
  opts: document.querySelectorAll('.tb-opt').length,
  scrollW: document.querySelector('#tlx').scrollWidth,
  clientW: document.querySelector('#tlx').clientWidth
}));
console.log('timeline:', JSON.stringify(info));
await p.evaluate(()=>{const c=document.querySelector('#panelClose'); c&&c.click();}); await wait(300);
// 关于本作
await p.evaluate(()=>document.querySelector('[data-act="about"]').click()); await wait(500);
await p.screenshot({path:'build/v-12-about.png', fullPage:false});
const lic = await p.evaluate(()=>document.querySelectorAll('.lic-list li').length);
console.log('lic items:', lic);
console.log('errors:', errs.length?errs:'(none)');
await b.close();
