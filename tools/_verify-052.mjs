import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8091,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
const errs=[];
page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8091/',{waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle0'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(900);
// 版本号：标题页不显示版本，等打开更新日志后再读（见下方 cl.ver）
// 更新日志 v0.5.3
await page.evaluate(()=>document.querySelector('[data-act="continue"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
// 直接从标题打开更新日志
await page.evaluate(()=>{ const b=document.querySelector('[data-menu="changelog"]')||[...document.querySelectorAll('[data-act]')].find(x=>/更新/.test(x.textContent)); b&&b.click(); });
await wait(200);
// 标题页没有 data-menu，得进游戏后用菜单。改走设置入口检查版本即可。
await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(200);
// 进游戏
await page.evaluate(()=>document.querySelector('[data-act="new"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#disclaimerOk')?.click());
await wait(600);
// 开场卡板应显示
console.log('开场卡板:', await page.evaluate(()=>{ const c=document.querySelector('#curtain'); return c && !c.hidden; }));
for(let i=0;i<4;i++){ await page.mouse.click(550,640); await wait(250); }
// 菜单→更新日志
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('[data-menu="changelog"]')?.click());
await wait(500);
const cl=await page.evaluate(()=>{
  const h=document.querySelector('#panelBody')?.textContent||'';
  const ver=h.match(/v0\.\d+\.\d+/)?.[0]||'?';
  return {ver, has052:h.includes('v0.5.3'), has051:h.includes('v0.5.1'), mint:h.includes('MintOS'), font:h.includes('钉钉进步体'), wipe:h.includes('一键清档')};
});
console.log('版本:', cl.ver);
console.log('更新日志:', JSON.stringify(cl));
await page.screenshot({path:path.join(ROOT,'build','_v5-01-clog.png')});
await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
// 关于页许可
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-menu="about"]')?.click());
await wait(500);
const lic=await page.evaluate(()=>{ const h=document.querySelector('#panelBody')?.textContent||''; return h.includes('钉钉进步体') && h.includes('永久免费商用'); });
console.log('关于页含钉钉进步体许可:', lic);
await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
// 设置→一键清档存在
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-menu="settings"]')?.click());
await wait(500);
const st=await page.evaluate(()=>({wipe:!!document.querySelector('#wipeAll'), presets:document.querySelectorAll('.ai-chip').length}));
console.log('设置:', JSON.stringify(st));
await page.screenshot({path:path.join(ROOT,'build','_v5-02-settings.png')});
console.log('JS 错误:', errs.length ? errs.slice(0,5) : '无');
await b.close(); server.close();
