import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:'new', args:['--no-sandbox','--allow-file-access-from-files','--mute-audio'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({ width:1280, height:820 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html',{waitUntil:'networkidle2'});
const wait = ms => new Promise(r=>setTimeout(r,ms));
await wait(700);

const probe = () => {
  const out = []; const vw=innerWidth, vh=innerHeight;
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return;
    const r = el.getBoundingClientRect();
    if (r.width<6||r.height<6) return;
    const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    const rad = [cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius];
    const sharp = rad.every(v=>parseFloat(v)===0);
    const fullBleed = r.width>=vw-2 && r.height>=vh-2;
    if (filled && sharp && !fullBleed) {
      out.push({sel: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+((typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\s+/).join('.'):''), w:Math.round(r.width), h:Math.round(r.height), bg:cs.backgroundColor});
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body); return out;
};
const seen = new Map();
const collect = async (label) => {
  const list = await p.evaluate(probe);
  for (const it of list) if (!seen.has(it.sel)) seen.set(it.sel, {...it, where:[label]});
  console.log(`[${label}] ${list.length}`);
};

// 关于页滚到底看许可清单
await p.evaluate(()=>document.querySelector('[data-act="about"]').click()); await wait(400);
await collect('about');
await p.evaluate(()=>{const bd=document.querySelector('.panel-body'); bd.scrollTop=bd.scrollHeight;});
await wait(250);
await p.screenshot({path:'build/v-13-about-lic.png'});
await p.evaluate(()=>{const c=document.querySelector('#panelClose'); c&&c.click();}); await wait(300);

// 设置页（分段控件 / 开关 / 输入）
await p.evaluate(()=>document.querySelector('[data-act="settings"]').click()); await wait(400);
await collect('settings');
await p.evaluate(()=>{const c=document.querySelector('#panelClose'); c&&c.click();}); await wait(300);

// 进游戏，逐个打开 HUD 面板
await p.evaluate(()=>document.querySelector('[data-act="new"]').click()); await wait(250);
await p.evaluate(()=>{const c=document.querySelector('[data-cfm="ok"]'); c&&c.click();}); await wait(250);
await p.evaluate(()=>document.querySelector('#disclaimerOk').click()); await wait(800);
for(let i=0;i<14;i++){ await p.evaluate(()=>{const s=document.querySelector('#stage'); s&&s.click();}); await wait(60); }
await collect('game');
for (const [id,name] of [['btnMaterials','materials'],['btnCharacters','characters'],['btnLog','log'],['btnPhone','phone'],['btnGov','gov'],['btnMenu','menu']]) {
  await p.evaluate(x=>{const e=document.getElementById(x); e&&e.click();}, id);
  await wait(450);
  await collect(name);
  await p.screenshot({path:`build/v-14-${name}.png`});
  await p.evaluate(()=>{const c=document.querySelector('#panelClose'); if(c) c.click(); const m=document.querySelector('#menuLayer'); if(m) m.hidden=true;});
  await wait(300);
}
console.log('\n===== 仍是直角的实心块 =====');
const rows=[...seen.values()].sort((a,b)=>b.w*b.h-a.w*a.h);
for (const r of rows) console.log(`${r.w}x${r.h}\t${r.sel}\t${r.bg}\t@${r.where.join(',')}`);
console.log('\ntotal', rows.length, 'errors', errs.length?errs:'(none)');
await b.close();
