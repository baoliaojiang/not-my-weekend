import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8096,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
page.on('console',m=>console.log('LOG',m.type(),m.text()));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8096/',{waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle0'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(800);
await page.evaluate(()=>document.querySelector('[data-act="new"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#disclaimerOk')?.click());
await wait(600);
for(let i=0;i<6;i++){await page.mouse.click(550,640);await wait(60);}
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('[data-menu="settings"]')?.click());
await wait(400);
console.log('keys before', await page.evaluate(()=>Object.keys(localStorage)));
await page.evaluate(()=>document.querySelector('#wipeAll').click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-cfm="ok"]').click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-cfm="ok"]').click());
await wait(250);
const r = await page.evaluate(()=>{ try { document.querySelector('[data-cfm="ok"]').click(); return 'ok'; } catch(e){ return 'ERR '+e.message; } });
console.log('final click', r);
await wait(700);
console.log('after', await page.evaluate(()=>({
  keys:Object.keys(localStorage),
  titleHidden: document.querySelector('#titleScreen').hidden,
  gameHidden: document.querySelector('#game').hidden,
  body: document.body.className
})));
await b.close(); server.close();
