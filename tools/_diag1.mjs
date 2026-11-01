import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--mute-audio','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
const wait = ms => new Promise(r=>setTimeout(r,ms));
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:1280, height:760});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
await wait(600);
// 跳过启动
await p.evaluate(()=>{ const s=document.querySelector('#bootSeq'); if(s){s.hidden=true;s.style.display='none';} });
await wait(200);
await p.evaluate(()=>document.querySelector('[data-act="new"]')?.click()); await wait(300);
await p.evaluate(()=>document.querySelector('[data-cfm="ok"]')?.click()); await wait(250);
await p.evaluate(()=>document.querySelector('#disclaimerOk')?.click()); await wait(500);
await p.evaluate(()=>{ const t=document.querySelector('#titleScreen'); if(t) t.style.display='none'; });
await wait(400);
for(let i=0;i<4;i++){ await p.evaluate(()=>document.querySelector('#stage')?.click()); await wait(150); }

// 1) HUD 展开
const hudBefore = await p.evaluate(()=>{
  const hud=document.querySelector('#hud'), nav=document.querySelector('#hudNav');
  const r=nav.getBoundingClientRect();
  return { cls:hud.className, navW:Math.round(r.width), navH:Math.round(r.height),
    btn:(()=>{const b=document.querySelector('.hbtn'); const q=b.getBoundingClientRect(); const cs=getComputedStyle(b); return {w:Math.round(q.width),h:Math.round(q.height),fs:cs.fontSize,disp:cs.display};})(),
    hudW:Math.round(hud.getBoundingClientRect().width) };
});
console.log('HUD 收起:', JSON.stringify(hudBefore));
await p.evaluate(()=>document.querySelector('#hudToggle')?.click()); await wait(500);
const hudAfter = await p.evaluate(()=>{
  const nav=document.querySelector('#hudNav'); const r=nav.getBoundingClientRect();
  const bs=[...document.querySelectorAll('.hbtn')].map(b=>{const q=b.getBoundingClientRect();return Math.round(q.width)+'x'+Math.round(q.height);});
  return { navW:Math.round(r.width), navH:Math.round(r.height), btns:bs, hudCls:document.querySelector('#hud').className };
});
console.log('HUD 展开:', JSON.stringify(hudAfter));
await p.screenshot({path:'build/_d1-hud.png'});

// 2) 打开手机 → 设置
await p.evaluate(()=>window.__ZBNX.ui.openPhone('home',null)); await wait(700);
await p.screenshot({path:'build/_d2-phone.png'});
const apps = await p.evaluate(()=>[...document.querySelectorAll('.mos-app')].map(a=>a.dataset.app+':'+(a.textContent||'').trim().slice(0,6)));
console.log('桌面应用:', JSON.stringify(apps));
console.log('errors:', errs.slice(0,4));
await b.close();
