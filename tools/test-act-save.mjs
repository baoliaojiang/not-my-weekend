/* 复现三：存档落在「调查行动内部的选项 / 政务表单 / 12345」时，重进是否还原 */
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

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('zbnx.settings', JSON.stringify({ textSpeed: 'instant' }));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(400);

/* 收集：章节 + 行动 id + 行动脚本里阻塞型节点的下标 */
const targets = await page.evaluate(() => {
  const out = [];
  for (const [id, ch] of Object.entries(window.__ZBNX.chapters)) {
    for (const a of (ch.hubActions || [])) {
      (a.script || []).forEach((n, i) => {
        if (['choice', 'govform', 'hotline', 'govprogress', 'quiz', 'chatreply'].includes(n.t)) {
          out.push({ id, act: a.id, kind: n.t, i });
        }
      });
    }
  }
  return out;
});
console.log('行动内阻塞节点：', targets.map(t => `${t.id}/${t.act}/${t.kind}@${t.i}`).join(', ') || '无');

for (const t of targets) {
  await page.evaluate(() => { window.location.reload(); });
  await sleep(700);
  const ok = await page.evaluate(({ id, act, i }) => {
    const eng = window.__ZBNX.engine;
    const ch = window.__ZBNX.chapters[id];
    const hubIdx = (ch.nodes || []).findIndex(n => n.t === 'hub');
    if (hubIdx < 0) return false;
    const a = (ch.hubActions || []).find(x => x.id === act);
    if (!a) return false;
    eng.loadChapter(ch, hubIdx);
    eng.frames.push(eng.makeFrame(a.script || [], `act:${act}`, () => eng.afterHubAction()));
    eng.frames[eng.frames.length - 1].i = i;
    eng.run();
    return true;
  }, t);
  if (!ok) { check(false, `${t.id}/${t.act}/${t.kind} 定位失败`); continue; }
  await sleep(600);

  const before = await page.evaluate(() => ({
    choice: document.querySelectorAll('#choiceBox .choice-item').length,
    hub: !document.querySelector('#hubLayer').hidden,
    panel: !document.querySelector('#panelLayer').hidden,
    title: document.querySelector('#panelTitle').textContent
  }));
  check(before.choice > 0 || before.panel, `${t.id}/${t.act}/${t.kind} 首次弹出`, JSON.stringify(before));

  await page.evaluate(() => { window.__ZBNX.saveAPI.save(3, 'main'); });

  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(700);
  await page.evaluate(() => { window.__ZBNX.saveAPI.load(3, 'main'); });
  await sleep(1200);

  const after = await page.evaluate(() => ({
    choice: document.querySelectorAll('#choiceBox .choice-item').length,
    hub: !document.querySelector('#hubLayer').hidden,
    panel: !document.querySelector('#panelLayer').hidden,
    title: document.querySelector('#panelTitle').textContent,
    depth: window.__ZBNX.engine.frames.length,
    frame: window.__ZBNX.engine.frame() && window.__ZBNX.engine.frame().key,
    idx: window.__ZBNX.engine.frame() && window.__ZBNX.engine.frame().i
  }));
  check(after.choice > 0 || after.panel, `${t.id}/${t.act}/${t.kind} 读档后仍在`, JSON.stringify(after));
}

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.kill();
