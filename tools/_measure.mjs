import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
const sizes = [[1057,493],[872,393],[800,360],[640,360],[390,844],[360,640]];
for (const [w,h] of sizes) {
  await p.setViewport({width:w, height:h, deviceScaleFactor:1});
  await new Promise(r=>setTimeout(r,350));
  const m = await p.evaluate(()=>{
    const ts = document.querySelector('.title-screen');
    const inner = document.querySelector('.title-inner');
    const foot = document.querySelector('.title-footer');
    const ir = inner.getBoundingClientRect(), fr = foot.getBoundingClientRect();
    return {
      view: [innerWidth, innerHeight],
      tsScrollH: ts.scrollHeight, tsClientH: ts.clientHeight,
      docScrollW: document.documentElement.scrollWidth,
      innerH: Math.round(ir.height), innerW: Math.round(ir.width),
      footBottom: Math.round(fr.bottom),
      overflowY: ts.scrollHeight - ts.clientHeight,
      mainFS: getComputedStyle(document.querySelector('.title-main')).fontSize
    };
  });
  console.log(`${w}x${h}`, JSON.stringify(m));
}
await b.close();
