/* 复现二：聊天回复选项 / 调查中枢 存档后重进是否还在 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { spawn } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:5199/index.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const web = spawn('python', ['-m', 'http.server', '5199', '--bind', '127.0.0.1'], {
  cwd: process.cwd(), stdio: 'ignore'
});
await sleep(1200);

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,800']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

let pass = 0, fail = 0;
const check = (ok, name, extra = '') => {
  if (ok) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}${extra ? '：' + extra : ''}`); }
};
const snap = () => page.evaluate(() => ({
  choice: document.querySelectorAll('#choiceBox .choice-item').length,
  choiceLayer: !document.querySelector('#choiceLayer').hidden,
  hub: !document.querySelector('#hubLayer').hidden,
  hubCards: document.querySelectorAll('#hubGrid .hub-card').length,
  panel: !document.querySelector('#panelLayer').hidden,
  panelTitle: document.querySelector('#panelTitle').textContent,
  replyBtns: document.querySelectorAll('#panelBody .cr-opt, #panelBody .reply-opt, #panelFoot .cr-opt').length,
  awaitReply: !!window.__ZBNX.ui._awaitReply,
  blocked: window.__ZBNX.engine.blocked,
  ap: window.__ZBNX.state.ap,
  idx: window.__ZBNX.state.index,
  text: (document.querySelector('#dlgText').textContent || '').slice(0, 30)
}));

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('zbnx.settings', JSON.stringify({ textSpeed: 'instant' }));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(400);

/* ---------- 1. 调查中枢 ---------- */
const hubAt = await page.evaluate(() => {
  const out = [];
  for (const [id, ch] of Object.entries(window.__ZBNX.chapters)) {
    const i = (ch.nodes || []).findIndex(n => n.t === 'hub');
    if (i >= 0) out.push({ id, i });
  }
  return out;
});
console.log('中枢章节：', hubAt.map(t => `${t.id}@${t.i}`).join(', '));

for (const t of hubAt) {
  await page.evaluate(() => { window.location.reload(); });
  await sleep(700);
  await page.evaluate(({ id, i }) => {
    window.__ZBNX.go(id);
    window.__ZBNX.engine.loadChapter(window.__ZBNX.chapters[id], i);
  }, t);
  await sleep(500);
  const b = await snap();
  check(b.hub && b.hubCards > 0, `${t.id} 中枢弹出`, JSON.stringify(b));

  await page.evaluate(() => { window.__ZBNX.saveAPI.save(3, 'main'); });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(700);
  await page.evaluate(() => { window.__ZBNX.saveAPI.load(3, 'main'); });
  await sleep(800);
  const a = await snap();
  check(a.hub && a.hubCards > 0, `${t.id} 读档后中枢仍在`, JSON.stringify(a));
}

/* ---------- 2. 聊天回复选项 ---------- */
const crAt = await page.evaluate(() => {
  const out = [];
  for (const [id, ch] of Object.entries(window.__ZBNX.chapters)) {
    const i = (ch.nodes || []).findIndex(n => n.t === 'chatreply');
    if (i >= 0) out.push({ id, i });
  }
  return out;
});
console.log('聊天回复章节：', crAt.map(t => `${t.id}@${t.i}`).join(', '));

for (const t of crAt) {
  await page.evaluate(() => { window.location.reload(); });
  await sleep(700);
  await page.evaluate(({ id, i }) => {
    window.__ZBNX.go(id);
    window.__ZBNX.engine.loadChapter(window.__ZBNX.chapters[id], i);
  }, t);
  await sleep(900);
  const b = await snap();
  const bResp = await page.evaluate(() => document.querySelectorAll('#panelBody .wx-reply button[data-reply]').length);
  check(b.panel && bResp > 0, `${t.id} 聊天回复选项弹出`, `panel=${b.panel} 选项=${bResp} title=${b.panelTitle}`);

  await page.evaluate(() => { window.__ZBNX.saveAPI.save(4, 'main'); });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(700);
  await page.evaluate(() => { window.__ZBNX.saveAPI.load(4, 'main'); });
  await sleep(1000);
  const a = await snap();
  const aResp = await page.evaluate(() => document.querySelectorAll('#panelBody .wx-reply button[data-reply]').length);
  check(a.panel && aResp > 0, `${t.id} 读档后回复选项仍在`,
    `panel=${a.panel} 选项=${aResp} title=${a.panelTitle} await=${a.awaitReply} blocked=${a.blocked}`);
}

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.kill();
