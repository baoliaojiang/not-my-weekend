import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new',
  args:['--no-sandbox','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required','--mute-audio'] });
const p = await b.newPage();
const wait = ms => new Promise(r=>setTimeout(r,ms));
const errs=[], miss=[];
p.on('pageerror', e=>errs.push('PAGEERROR '+e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
p.on('requestfailed', r=>miss.push(r.url()));
p.on('response', r=>{ if(r.status()>=400) miss.push(r.status()+' '+r.url()); });
await p.setViewport({width:1280,height:860});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
await wait(700);

// 启动第一屏（作者）
await wait(1400);
const b1 = await p.evaluate(()=>{
  const bt = document.querySelector('#bootBili'), gh = document.querySelector('#bootGit');
  return { bili: bt && bt.href, git: gh && (gh.href||'(无)'), avatar: !!document.querySelector('.boot-avatar') };
});
await p.screenshot({path:'build/_f1-author.png'});
console.log('署名屏:', JSON.stringify(b1));

// 第二屏（标题 + 圆标）
for(let i=0;i<3;i++){ await p.evaluate(()=>{const s=document.querySelector('#bootStage'); s&&s.click();}); await wait(900); }
const b2 = await p.evaluate(()=>{
  const ico=document.querySelector('.boot-logo-ico');
  return { ico: !!ico, loaded: ico? ico.naturalWidth>0 : false, rect: ico? Math.round(ico.getBoundingClientRect().width):0 };
});
await p.screenshot({path:'build/_f2-logo.png'});
console.log('标题屏圆标:', JSON.stringify(b2));

// 进标题页
for(let i=0;i<12;i++){ const done=await p.evaluate(()=>!!document.querySelector('#bootSeq')?.hidden); if(done) break; await p.evaluate(()=>{const s=document.querySelector('#bootStage'); s&&s.click();}); await wait(600); }
await wait(800);

// 立绘 webp
const spr = await p.evaluate(async()=>{
  const img=new Image(); img.src='assets/characters/lin_zhixu.webp';
  await new Promise(r=>{img.onload=r;img.onerror=r;});
  return { w: img.naturalWidth, h: img.naturalHeight, ok: img.naturalWidth>0 };
});
console.log('立绘:', JSON.stringify(spr));

// 关于本作
await p.evaluate(()=>{ const b=[...document.querySelectorAll('[data-menu="about"]')][0]; b&&b.click(); });
await wait(600);
const about = await p.evaluate(()=>{
  const box=document.querySelector('.about-links');
  const music=/Kevin MacLeod/.test(document.querySelector('.panel-body, #panelBody')?.textContent||'');
  return { links: box? box.querySelectorAll('.about-link').length:0, home: box&&box.dataset.home, bili: box&&box.dataset.bili, music };
});
console.log('关于本作:', JSON.stringify(about));
await p.screenshot({path:'build/_f3-about.png'});

// 音乐全部可播
const ids=['broadcast','calm','calm2','canteen','city','classroom','daily','daydream','exam','goodbye','hall','home','hope','memory','morning','night_street','office','playground','rain','relax','room','silent','sunset','tense'];
const bad=[];
for(const id of ids){
  const ok = await p.evaluate(async (id)=>{ try{ window.__ZBNX.audio.play(id); await new Promise(r=>setTimeout(r,180)); return window.__ZBNX.audio.currentId===id; }catch(e){ return false; } }, id);
  if(!ok) bad.push(id);
}
console.log('音乐失败:', bad.length? bad.join(',') : '无');

console.log('资源缺失:', miss.length? [...new Set(miss)].slice(0,6) : '无');
console.log('报错:', errs.length? errs.slice(0,5) : '无');
await b.close();
