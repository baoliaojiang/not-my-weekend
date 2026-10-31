import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.setViewport({width:1280,height:820});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,600));
// 造一份"打到第三章"的进度
await p.evaluate(() => {
  localStorage.setItem('zbnx.progress', JSON.stringify({
    v:1, chapters:['ch0','ch1','ch2'],
    sides:{ side1:{count:2, last:'s1_a', lastName:'一块钱的收据', endings:{}}, side2:{count:1,last:'s2_b',lastName:'滤芯换过了'} }
  }));
  localStorage.setItem('zbnx.save.0', JSON.stringify({
    v:1, ts:Date.now(), chapterId:'ch3', chapterTitle:'第三章 已收悉', dayLabel:'九月十一日 · 周四',
    index:120, scope:'main', state:{}, frames:[]
  }));
});
await p.reload({waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,900));
await p.screenshot({path:'build/shot-title-withsave.png'});
await p.evaluate(()=>document.querySelector('[data-act="continue"]').click());
await new Promise(r=>setTimeout(r,500));
await p.screenshot({path:'build/shot-continue.png'});
console.log('errors:', errs.length?errs:'(none)');
await b.close();
