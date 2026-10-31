import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--mute-audio']});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
for (const [name,w,h] of [['land',1280,860],['port',430,880]]) {
  const p=await b.newPage();
  await p.setViewport({width:w,height:h});
  await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
  for(let i=0;i<30;i++){
    await wait(400);
    if(await p.evaluate(()=>!!document.querySelector('.boot-logo-ico'))){ await wait(1100); break; }
    await p.evaluate(()=>{const s=document.querySelector('#bootStage'); s&&s.click();});
  }
  await p.screenshot({path:`build/_logo-${name}.png`});
  const r=await p.evaluate(()=>{const e=document.querySelector('.boot-logo-ico');if(!e)return null;const b=e.getBoundingClientRect();return {w:Math.round(b.width),y:Math.round(b.y)};});
  console.log(name, JSON.stringify(r));
  await p.close();
}
await b.close();
