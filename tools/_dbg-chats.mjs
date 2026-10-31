import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8093,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8093/',{waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle0'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(800);
await page.evaluate(()=>document.querySelector('[data-act="new"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#disclaimerOk')?.click());
await wait(600);
for(let i=0;i<8;i++){ await page.mouse.click(550,640); await wait(60); }
await page.evaluate(()=>{
  const key='zbnx.save.0';
  const raw=JSON.parse(localStorage.getItem(key)||'null');
  raw.state.chats = [
    {thread:'class', from:'林小满', text:'明天记得带调查表', me:false, day:'九月二日'},
    {thread:'parents', from:'妈妈', text:'周末早点回来', me:false, day:'九月二日'}
  ];
  localStorage.setItem(key, JSON.stringify(raw));
});
console.log('injected, save keys:', await page.evaluate(()=>Object.keys(localStorage)));
// 不能 reload：pagehide 会自动存档把注入的数据冲掉。走菜单回标题。
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('[data-menu="title"]')?.click());
await wait(600);
await page.evaluate(()=>document.querySelector('[data-act="continue"]').click());
await wait(500);
await page.evaluate(()=>document.querySelector('#contResume')?.click());
await wait(700);
console.log('inGame:', await page.evaluate(()=>!document.querySelector('#game').hidden));
// 检查 localStorage 现状与最新 slot
console.log('slots:', await page.evaluate(()=>{
  const out={};
  for(let i=0;i<=4;i++){ const r=localStorage.getItem('zbnx.save.'+i); if(r){ const d=JSON.parse(r); out[i]={ch:(d.state&&d.state.chats||[]).length, chapter:d.chapterId}; } }
  return out;
}));
await page.evaluate(()=>document.querySelector('#btnPhone')?.click());
await wait(400);
await page.evaluate(()=>document.querySelector('[data-app="chat"]').click());
await wait(400);
console.log('phone html has wx-item:', await page.evaluate(()=>document.querySelectorAll('.wx-item').length));
console.log('phone body snippet:', await page.evaluate(()=>document.querySelector('#panelBody')?.innerHTML.slice(0,300)));
await b.close(); server.close();
