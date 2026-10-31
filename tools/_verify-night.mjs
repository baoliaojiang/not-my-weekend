import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.cwd();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('no');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(8099,'127.0.0.1',r));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x=>fs.existsSync(x));
const b=await puppeteer.launch({executablePath:EDGE,headless:'new',args:['--no-sandbox']});
const page=await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.setViewport({width:1100,height:760});
await page.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle0'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await wait(800);

// 开深色模式
await page.evaluate(()=>{ const s=JSON.parse(localStorage.getItem('zbnx.settings.v2')||'{}'); s.nightMode=true; localStorage.setItem('zbnx.settings.v2', JSON.stringify(s)); });
await page.reload({waitUntil:'networkidle0'});
await wait(800);
console.log('night on:', await page.evaluate(()=>document.body.classList.contains('night')));

// 对比度检测：遍历面板内可见文本节点，算前景/背景相对亮度差
const probe = async (label) => {
  const bad = await page.evaluate(() => {
    function lum(c){ const m=c.match(/\d+(\.\d+)?/g).map(Number); const f=v=>{v/=255; return v<=.03928? v/12.92 : Math.pow((v+.055)/1.055,2.4);}; return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]); }
    function bgOf(el){ let n=el; while(n && n!==document.documentElement){ const c=getComputedStyle(n).backgroundColor; const m=c.match(/\d+(\.\d+)?/g); if(m && (m.length<4 || Number(m[3])>0.5)) return c; n=n.parentElement; } return 'rgb(128,128,128)'; }
    const out=[];
    const root=document.querySelector('#panelBody')||document.querySelector('.panel')||document.body;
    root.querySelectorAll('*').forEach(el=>{
      if(!el.offsetParent && el.tagName!=='BODY') return;
      const t=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join('');
      if(!t) return;
      const cs=getComputedStyle(el);
      if(cs.opacity==='0'||cs.visibility==='hidden') return;
      const l1=lum(cs.color), l2=lum(bgOf(el));
      const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      if(ratio<2.2) out.push({t:t.slice(0,18), color:cs.color, bg:bgOf(el), ratio:+ratio.toFixed(2), cls:el.className.toString().slice(0,30)});
    });
    return out;
  });
  console.log(`\n== ${label} ==`);
  if(!bad.length) console.log('  ok');
  bad.slice(0,8).forEach(x=>console.log('  LOW', JSON.stringify(x)));
  return bad;
};

await probe('标题页');
await page.screenshot({path:path.join(ROOT,'build','_night-01-title.png')});

// 进游戏
await page.evaluate(()=>document.querySelector('[data-act="new"]').click());
await wait(400);
await page.evaluate(()=>document.querySelector('#disclaimerOk')?.click());
await wait(600);
await page.screenshot({path:path.join(ROOT,'build','_night-02-game.png')});

// 各面板
const opens = [
  ['设置', () => { document.querySelector('#btnMenu').click(); }],
];
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('[data-menu="settings"]')?.click());
await wait(500);
await probe('设置');
await page.screenshot({path:path.join(ROOT,'build','_night-03-settings.png')});

await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-menu="changelog"]')?.click());
await wait(500);
await probe('更新日志');
await page.screenshot({path:path.join(ROOT,'build','_night-04-changelog.png')});

await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-menu="about"]')?.click());
await wait(500);
await probe('关于本作');
await page.screenshot({path:path.join(ROOT,'build','_night-05-about.png')});

await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('#btnMenu')?.click());
await wait(250);
await page.evaluate(()=>document.querySelector('[data-menu="saves"]')?.click());
await wait(500);
await probe('存档');
await page.screenshot({path:path.join(ROOT,'build','_night-06-saves.png')});

await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('#btnPhone')?.click());
await wait(500);
await probe('手机');
await page.screenshot({path:path.join(ROOT,'build','_night-07-phone.png')});

await page.evaluate(()=>document.querySelector('#panelClose')?.click());
await wait(300);
await page.evaluate(()=>document.querySelector('#btnAI')?.click());
await wait(500);
await probe('AI 助手');
await page.screenshot({path:path.join(ROOT,'build','_night-08-ai.png')});

await b.close(); server.close();
