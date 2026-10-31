import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.setViewport({width:1280,height:820,deviceScaleFactor:1});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,800));

const night = await p.evaluate(()=>document.body.className);
console.log('body:', night);

for (const act of ['settings','changelog','about']) {
  await p.evaluate(a=>document.querySelector(`[data-act="${a}"]`).click(), act);
  await new Promise(r=>setTimeout(r,450));
  await p.screenshot({path:`build/pn-${act}.png`});
  const st = await p.evaluate(()=>{
    const bd=document.querySelector('.panel-body'); const bg=getComputedStyle(document.querySelector('.panel')).backgroundColor;
    const fg=getComputedStyle(bd).color;
    return {bg, fg, sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth};
  });
  console.log(act, JSON.stringify(st));
  await p.evaluate(()=>{ const c=document.querySelector('#panelClose'); c&&c.click(); });
  await new Promise(r=>setTimeout(r,350));
}
console.log('errors:', errs.length?errs:'(none)');
await b.close();
