import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.setViewport({width:1280,height:820});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,700));

// 模拟原生外壳存在
const r1 = await p.evaluate(()=>{
  window.ZBApp = { exit(){ window.__exited = true; } };
  const q = document.querySelector('#titleQuit');
  q.hidden = false;
  q.click();
  return { hidden: q.hidden, exited: !!window.__exited };
});
console.log('标题页退出:', JSON.stringify(r1));

// 菜单里的退出项
await p.evaluate(()=>document.querySelector('[data-act="new"]').click());
await new Promise(r=>setTimeout(r,250));
await p.evaluate(()=>document.querySelector('#disclaimerOk').click());
await new Promise(r=>setTimeout(r,900));
await p.evaluate(()=>document.querySelector('#btnMenu').click());
await new Promise(r=>setTimeout(r,350));
const r2 = await p.evaluate(()=>{
  const q = document.querySelector('[data-menu="quit"]');
  return { exists: !!q, text: q && q.textContent.trim() };
});
console.log('菜单退出项:', JSON.stringify(r2));
await p.screenshot({path:'build/pn-menu.png'});
console.log('errors:', errs.length?errs:'(none)');
await b.close();
