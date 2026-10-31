import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8092,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8092/',{waitUntil:'networkidle0'});
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
    {thread:'class', from:'林小满', text:'明天记得带调查表', me:false, day:'九月二日'}
  ];
  localStorage.setItem(key, JSON.stringify(raw));
});
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('[data-menu="title"]')?.click());
await wait(600);
await page.evaluate(()=>document.querySelector('[data-act="continue"]').click());
await wait(500);
await page.evaluate(()=>document.querySelector('#contResume')?.click());
await wait(700);
await page.evaluate(()=>document.querySelector('#btnPhone')?.click());
await wait(400);
await page.evaluate(()=>document.querySelector('[data-app="chat"]').click());
await wait(400);
// 列表页 → 返回 → 应到桌面
await page.evaluate(()=>document.querySelector('.wx-back').click());
await wait(400);
console.log('列表返回后到桌面:', await page.evaluate(()=>!!document.querySelector('.mos')));
// 桌面 → 微信 → 会话 → 返回 → 列表 → 返回 → 桌面（完整链路）
await page.evaluate(()=>document.querySelector('[data-app="chat"]').click());
await wait(350);
await page.evaluate(()=>document.querySelector('[data-thread]').click());
await wait(350);
await page.evaluate(()=>document.querySelector('.wx-back').click());
await wait(350);
const atList=await page.evaluate(()=>document.querySelectorAll('.wx-item').length>0);
await page.evaluate(()=>document.querySelector('.wx-back').click());
await wait(350);
const atHome=await page.evaluate(()=>!!document.querySelector('.mos'));
console.log('完整链路 会话→列表→桌面:', atList && atHome);
// 剧情手机的「看完了」：桌面也应有该按钮（_phoneOnClose 存在时）——用 openPhone 从剧情进
// 这里直接检查普通打开（无剧情回调）时桌面没有多余按钮
await page.evaluate(()=>document.querySelector('[data-app="chat"]').click());
await wait(350);
const noDone=await page.evaluate(()=>!document.querySelector('#phoneDone'));
console.log('自由打开无「看完了」按钮:', noDone);
await page.screenshot({path:path.join(ROOT,'build','_v4-06-wxnav.png')});
await b.close(); server.close();
