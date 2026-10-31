import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8098,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8098/',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,900));
const info=await page.evaluate(()=>{
  const t=document.querySelector('.title-main');
  const e=document.querySelector('.title-eyebrow');
  const s=document.querySelector('.title-sub');
  const r=t.getBoundingClientRect();
  return {
    main:{w:Math.round(r.width),h:Math.round(r.height),font:getComputedStyle(t).fontFamily.split(',')[0],lines:Math.round(r.height/parseFloat(getComputedStyle(t).lineHeight))},
    eyebrowFont:getComputedStyle(e).fontFamily.split(',')[0],
    subFont:getComputedStyle(s).fontFamily.split(',')[0],
    fontsLoaded:[...document.fonts].map(f=>f.family+':'+f.status)
  };
});
console.log(JSON.stringify(info,null,1));
await page.screenshot({path:path.join(ROOT,'build','_v4-01-title.png')});
// 手机竖屏
await page.setViewport({width:390,height:844});
await new Promise(r=>setTimeout(r,400));
const info2=await page.evaluate(()=>{
  const t=document.querySelector('.title-main');
  const r=t.getBoundingClientRect();
  return {w:Math.round(r.width),h:Math.round(r.height),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};
});
console.log('mobile', JSON.stringify(info2));
await page.screenshot({path:path.join(ROOT,'build','_v4-02-title-mobile.png')});
await b.close(); server.close();
