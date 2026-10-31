import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8094,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8094/',{waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle0'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(800);
await page.evaluate(()=>document.querySelector('[data-act="new"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#disclaimerOk')?.click());
await wait(600);
for(let i=0;i<12;i++){
  await page.mouse.click(550,640); await wait(80);
  const st=await page.evaluate(()=>({
    dlg:document.querySelector('#dlgText')?.textContent.slice(0,24),
    choices:document.querySelectorAll('#choices .choice-item').length,
    card:!document.querySelector('#storyCard')?.hidden,
    typing:document.body.className
  }));
  console.log(i, JSON.stringify(st));
}
const th=await page.evaluate(()=>{
  const raw=localStorage.getItem('zbnx.state.v2');
  if(!raw) return 'no state key';
  const s=JSON.parse(raw);
  return {threads:Object.keys(s.threads||{}), seen:(s.seen||[]).length};
});
console.log('state:', JSON.stringify(th));
await b.close(); server.close();
