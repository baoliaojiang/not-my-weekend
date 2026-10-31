import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--mute-audio']});
const p=await b.newPage(); const wait=ms=>new Promise(r=>setTimeout(r,ms));
await p.setViewport({width:1280,height:860});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
// 等到出现 logo 屏
let seen=false;
for(let i=0;i<25;i++){
  await wait(500);
  const has=await p.evaluate(()=>!!document.querySelector('.boot-logo-ico'));
  if(has){ seen=true; await wait(600); break; }
  await p.evaluate(()=>{const s=document.querySelector('#bootStage'); s&&s.click();});
}
const ico=await p.evaluate(()=>{const e=document.querySelector('.boot-logo-ico');return e?{w:e.naturalWidth,r:Math.round(e.getBoundingClientRect().width)}:null;});
console.log('logo 屏出现:',seen,'圆标:',JSON.stringify(ico));
if(seen) await p.screenshot({path:'build/_g1-logo.png'});
// 关于本作
await p.evaluate(()=>window.__ZBNX.ui.openAbout());
await wait(700);
const about=await p.evaluate(()=>{
  const box=document.querySelector('.about-links');
  const txt=document.body.textContent||'';
  return {links:box?box.querySelectorAll('.about-link').length:0, home:box&&box.dataset.home, bili:box&&box.dataset.bili, music:/Kevin MacLeod/.test(txt)};
});
console.log('关于:',JSON.stringify(about));
await p.screenshot({path:'build/_g2-about.png'});
await b.close();
