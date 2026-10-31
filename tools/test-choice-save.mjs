/* 复现：选项挂在屏幕上时存档 → 刷新页面 → 继续游戏，选项是否还在 */
import { spawn } from 'node:child_process';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

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

/* 逐章找第一个真正的 choice 节点（在主干上） */
const targets = await page.evaluate(() => {
  const out = [];
  for (const [id, ch] of Object.entries(window.__ZBNX.chapters)) {
    const i = (ch.nodes || []).findIndex(n => n.t === 'choice'
      && (n.options || []).filter(o => !o.cond).length >= 2);
    if (i >= 0) out.push({ id, i, prompt: ch.nodes[i].prompt || '' });
  }
  return out;
});
console.log('候选章节：', targets.map(t => `${t.id}@${t.i}`).join(', '));

for (const t of targets) {
  await page.evaluate(() => { window.location.reload(); });
  await sleep(700);
  await page.evaluate(({ id, i }) => {
    window.__ZBNX.go(id);
    window.__ZBNX.engine.loadChapter(window.__ZBNX.chapters[id], i);
  }, t);
  await sleep(500);

  const before = await page.evaluate(() => ({
    layer: !document.querySelector('#choiceLayer').hidden,
    n: document.querySelectorAll('#choiceBox .choice-item').length,
    idx: window.__ZBNX.state.index
  }));
  check(before.layer && before.n >= 2, `${t.id} 选项正常弹出`, JSON.stringify(before));

  await page.evaluate(() => { window.__ZBNX.saveAPI.save(2, 'main'); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zbnx.save.2')));
  check(!!saved, `${t.id} 存档写入`, saved ? `index=${saved.index}` : '无');

  /* 刷新页面 = 退出重进 */
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(700);
  await page.evaluate(() => { window.__ZBNX.saveAPI.load(2, 'main'); });
  await sleep(700);

  const after = await page.evaluate(() => ({
    layer: !document.querySelector('#choiceLayer').hidden,
    n: document.querySelectorAll('#choiceBox .choice-item').length,
    idx: window.__ZBNX.state.index,
    empty: document.querySelector('#choiceBox').innerHTML.trim().length === 0,
    hub: !document.querySelector('#hubLayer').hidden,
    panel: !document.querySelector('#panelLayer').hidden
  }));
  check(after.layer && after.n >= 2, `${t.id} 读档后选项仍在`,
    `layer=${after.layer} 按钮=${after.n} idx=${after.idx} 空=${after.empty} hub=${after.hub} panel=${after.panel}`);
}

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.kill();
