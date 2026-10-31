import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8095,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8095/',{waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle0'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(800);
await page.evaluate(()=>document.querySelector('[data-act="new"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#disclaimerOk')?.click());
await wait(600);
for(let i=0;i<8;i++){ await page.mouse.click(550,640); await wait(60); }
// 直接往运行中的 state 注入消息（state.chats 在 state.js 里定义，引擎持有同一对象）
// 手段：写一份假自动存档，然后读档
await page.evaluate(()=>{
  const key='zbnx.save.0';
  const raw=JSON.parse(localStorage.getItem(key)||'null')||{};
  // 保存当前现场：用现有的 key 格式
  const st = raw.state && raw.state.chats !== undefined ? raw.state : null;
  return {hasSave:!!raw, keys:Object.keys(raw), hasChats:st ? Array.isArray(st.chats) : null};
}).then(r=>console.log('autosave:', JSON.stringify(r)));

// 通过 UI 走一遍存档（菜单→存档→写槽位 1）不行就直接构造
// 最稳的办法：调用 store 的写入口——但没有全局句柄。
// 改用：把消息注入已有自动存档的 state.chats，然后从继续游戏读入。
const injected = await page.evaluate(()=>{
  const key='zbnx.save.0';
  const raw=JSON.parse(localStorage.getItem(key)||'null');
  if(!raw || !raw.state) return 'no autosave';
  raw.state.chats = [
    {thread:'class', from:'林小满', text:'明天记得带调查表', me:false, day:'九月二日'},
    {thread:'class', from:'我', text:'好，收到', me:true, day:'九月二日'},
    {thread:'parents', from:'妈妈', text:'周末早点回来', me:false, day:'九月二日'}
  ];
  localStorage.setItem(key, JSON.stringify(raw));
  return 'ok';
});
console.log('注入消息:', injected);
// 不能 reload：pagehide 自动存档会把注入的数据冲掉。走菜单回标题再读档。
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('[data-menu="title"]')?.click());
await wait(600);
await page.evaluate(()=>document.querySelector('[data-act="continue"]').click());
await wait(500);
await page.evaluate(()=>{ document.querySelector('#contResume')?.click(); });
await wait(700);
const inGame=await page.evaluate(()=>!document.querySelector('#game').hidden);
console.log('读档进游戏:', inGame);
if(inGame){
  await page.evaluate(()=>document.querySelector('#btnPhone')?.click());
  await wait(500);
  console.log('手机桌面:', await page.evaluate(()=>!!document.querySelector('.mos')));
  await page.evaluate(()=>document.querySelector('[data-app="chat"]').click());
  await wait(400);
  const s2=await page.evaluate(()=>({
    items:document.querySelectorAll('.wx-item').length,
    backBtn:!!document.querySelector('.wx-back'),
    head:document.querySelector('.wx-title')?.textContent
  }));
  console.log('微信列表:', JSON.stringify(s2));
  await page.screenshot({path:path.join(ROOT,'build','_v4-03-wxlist.png')});
  if(s2.items>0){
    await page.evaluate(()=>document.querySelector('[data-thread]').click());
    await wait(400);
    const s3=await page.evaluate(()=>({bub:document.querySelectorAll('.wx-bub').length, backBtn:!!document.querySelector('.wx-back'), head:document.querySelector('.wx-title')?.textContent}));
    console.log('会话页:', JSON.stringify(s3));
    await page.screenshot({path:path.join(ROOT,'build','_v4-04-wxthread.png')});
    await page.evaluate(()=>document.querySelector('.wx-back').click());
    await wait(400);
    const s4=await page.evaluate(()=>({backList:document.querySelectorAll('.wx-item').length>0, head:document.querySelector('.wx-title')?.textContent}));
    console.log('点返回后:', JSON.stringify(s4));
    await page.screenshot({path:path.join(ROOT,'build','_v4-05-wxback.png')});
  }
}
await b.close(); server.close();
