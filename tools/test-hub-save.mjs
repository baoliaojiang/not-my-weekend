/* =========================================================
   第二章日终 + 行动中存档 复现测试
   ---------------------------------------------------------
   1) 从第二章 hub 走到日终，看是否卡死（点不动、也不出总结）
   2) 在行动脚本执行中存档，再读档，看是否回到该行动里
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };

const web = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const PORT = await new Promise(r => web.listen(0, '127.0.0.1', () => r(web.address().port)));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 500));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const info = () => page.evaluate(() => {
  const NX = window.__ZBNX;
  const dlg = document.querySelector('#dialogue');
  return {
    index: NX.state.index,
    ap: NX.state.ap,
    alive: NX.state.alive,
    chapter: NX.state.chapterId,
    blocked: NX.engine.blocked,
    waiting: NX.engine.waiting,
    typing: NX.engine.typing,
    text: (document.querySelector('#dlgText') || {}).textContent || '',
    hub: !document.querySelector('#hubLayer').hidden,
    summary: !document.querySelector('#panelLayer').hidden && !!document.querySelector('#sumNext'),
    choice: !document.querySelector('#choiceLayer').hidden,
    panel: !document.querySelector('#panelLayer').hidden,
    title: !document.querySelector('#titleScreen').hidden,
    frames: NX.engine.frames.map(f => ({ key: f.key, i: f.i }))
  };
});

const clickDlg = () => page.evaluate(() => {
  const dlg = document.querySelector('#dialogue');
  if (dlg && !dlg.hidden) dlg.click();
  else document.querySelector('#stage').click();
});

/* 一直点到出现 hub / choice / summary / 标题 */
async function advanceUntilHub(max = 400) {
  for (let i = 0; i < max; i++) {
    const u = await info();
    if (u.hub || u.choice || u.summary || u.title) return u;
    await clickDlg();
    await sleep(45);
  }
  return await info();
}

console.log('\n[1] 进第二章，走到调查中枢');
await page.evaluate(() => window.__ZBNX.go('ch2'));
await sleep(400);
let u = await advanceUntilHub();
console.log('  到达:', u.hub ? 'hub' : u.choice ? 'choice' : u.summary ? 'summary' : '未到达',
  '| ap =', u.ap, '| blocked =', u.blocked, '| frames =', JSON.stringify(u.frames));

/* 用完行动点：直接点「结束今天的调查」 */
if (u.hub) {
  await page.click('#hubLeave');
  await sleep(300);
  const after = await info();
  console.log('  点「结束」后: blocked =', after.blocked, '| index =', after.index, '| frames =', JSON.stringify(after.frames));

  console.log('\n[2] 继续推进到章节结束');
  let stuck = null;
  let last = '';
  let same = 0;
  for (let i = 0; i < 500; i++) {
    const s = await info();
    if (s.summary || s.title) { console.log('  ✓ 到达', s.summary ? '章节总结' : '标题页', '（推进', i, '次）'); stuck = null; break; }
    if (s.choice) { await page.evaluate(() => document.querySelectorAll('#choiceBox .choice-item')[0].click()); await sleep(200); continue; }
    if (s.hub) { await page.click('#hubLeave'); await sleep(200); continue; }
    const sig = s.index + '|' + s.text + '|' + s.blocked + '|' + s.waiting;
    if (sig === last) same++; else { same = 0; last = sig; }
    if (same > 40) { stuck = s; break; }
    await clickDlg();
    await sleep(45);
  }
  if (stuck) {
    console.log('  ✗ 卡死：', JSON.stringify({ index: stuck.index, blocked: stuck.blocked, waiting: stuck.waiting, typing: stuck.typing, text: stuck.text.slice(0, 30), frames: stuck.frames }));
  }
}

console.log('\n[2b] 行动点用尽后自动结束');
await page.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.go('ch2'); });
await sleep(400);
u = await advanceUntilHub();
console.log('  [2b] 到达:', JSON.stringify({hub:u.hub, choice:u.choice, summary:u.summary, title:u.title, panel:u.panel, ap:u.ap, index:u.index}));
if (u.hub) {
  await page.evaluate(() => { window.__ZBNX.state.ap = 1; window.__ZBNX.ui.setAP(window.__ZBNX.state); });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#hubGrid .hub-card')].find(x => !x.disabled);
    b.click();
  });
  await sleep(400);
  let sawSummary = false;
  let same = 0, last = '';
  for (let i = 0; i < 400; i++) {
    const s = await info();
    if (s.summary) { sawSummary = true; console.log('  ✓ 用尽行动点后顺利到总结（推进', i, '次）'); break; }
    if (s.choice) { await page.evaluate(() => document.querySelectorAll('#choiceBox .choice-item')[0].click()); await sleep(150); continue; }
    if (s.hub) { await page.click('#hubLeave'); await sleep(150); continue; }
    const sig = s.index + '|' + s.text + '|' + s.blocked + '|' + s.waiting;
    if (sig === last) same++; else { same = 0; last = sig; }
    if (same > 40) { console.log('  ✗ 卡死在此处:', JSON.stringify({ index: s.index, blocked: s.blocked, waiting: s.waiting, typing: s.typing, text: s.text.slice(0, 30), ap: s.ap })); break; }
    await clickDlg(); await sleep(40);
  }
}

console.log('\n[3] 行动脚本中存档 → 读档');
// 重进第二章 hub，选一个行动，进入脚本后立刻存档
await page.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.go('ch2'); });
await sleep(400);
u = await advanceUntilHub();
console.log('  [3] 到达:', JSON.stringify({hub:u.hub, choice:u.choice, summary:u.summary, title:u.title, panel:u.panel, ap:u.ap, index:u.index}));
if (u.hub) {
  // 选中第一个可用行动
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#hubGrid .hub-card')].find(x => !x.disabled);
    b.click();
  });
  await sleep(500);
  // 推两句，保证确实在行动脚本里
  await clickDlg(); await sleep(150);
  await clickDlg(); await sleep(150);
  const inAct = await info();
  console.log('  行动中: frames =', JSON.stringify(inAct.frames), '| ap =', inAct.ap);
  const ok = await page.evaluate(() => window.__ZBNX.save(3));
  console.log('  存档返回:', ok);
  // 回到标题再读档
  await page.evaluate(() => window.__ZBNX.ui.saveAPI.backToTitle());
  await sleep(300);
  await page.evaluate(() => window.__ZBNX.load(3));
  await sleep(600);
  const restored = await info();
  console.log('  读档后: chapter =', restored.chapter, '| index =', restored.index,
    '| frames =', JSON.stringify(restored.frames), '| ap =', restored.ap,
    '| hub =', restored.hub, '| text =', restored.text.slice(0, 24));
  const inActAfter = restored.frames.length > 1;
  console.log(inActAfter ? '  ✓ 回到了行动脚本内部' : '  ✗ 落回了章节主干（行动被丢弃）');
}

console.log('\n页面错误:', errors.length ? errors.join(' | ') : '(none)');
await browser.close(); web.close();
