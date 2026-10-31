import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
const sizes = [['land-1057x493',1057,493],['land-872x393',872,393],['land-640x360',640,360],['port-390x844',390,844],['port-360x640',360,640]];
for (const [name,w,h] of sizes) {
  await p.setViewport({width:w, height:h, deviceScaleFactor:2, isMobile:true, hasTouch:true});
  await new Promise(r=>setTimeout(r,400));
  await p.screenshot({path:`build/m-${name}.png`});
}
console.log('errors:', errs.length?errs:'(none)');
await b.close();
