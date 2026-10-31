import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('console:'+m.text());});
const wait = ms => new Promise(r=>setTimeout(r,ms));
await p.setViewport({width:1080,height:517,isMobile:true,hasTouch:true,deviceScaleFactor:1});
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/build/www/index.html',{waitUntil:'networkidle2'});
await wait(900);
const cls = await p.evaluate(()=>document.body.className);
await p.evaluate(()=>document.querySelector('[data-act="settings"]').click()); await wait(500);
const set = await p.evaluate(()=>({
  preview: !!document.querySelector('#pvText'),
  scaleRange: !!document.querySelector('#dlgScaleRange'),
  scaleNum: !!document.querySelector('#dlgScaleNum'),
  presets: document.querySelectorAll('[data-preset]').length,
  keyType: (document.querySelector('#aiKey')||{}).type,
  temp: !!document.querySelector('#aiTemp'),
  maxTok: !!document.querySelector('#aiMaxTokens'),
  timeout: !!document.querySelector('#aiTimeout'),
  sysPrompt: !!document.querySelector('#aiSystem'),
  help: document.querySelectorAll('details.ai-help').length,
  groups: document.querySelectorAll('.set-group-t').length
}));
await p.evaluate(()=>document.querySelector('#panelClose').click()); await wait(300);
await p.evaluate(()=>document.querySelector('[data-act="changelog"]').click()); await wait(400);
const ver = await p.evaluate(()=>document.body.innerText.slice(0,120).replace(/\s+/g,' '));
console.log('body class:', cls);
console.log('settings:', JSON.stringify(set));
console.log('changelog head:', ver.slice(0,80));
console.log('errors:', errs.length?errs:'(none)');
await b.close();
