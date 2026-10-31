/* 设置里的 AI 接口：面板能不能开、值能不能存、关掉后能不能沿用 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { spawn } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:5199/index.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const web = spawn('python', ['-m', 'http.server', '5199', '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
await sleep(1200);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(400);

let pass = 0, fail = 0;
const check = (ok, name, extra = '') => { ok ? (pass++, console.log(`✓ ${name}`)) : (fail++, console.log(`✗ ${name}${extra ? '：' + extra : ''}`)); };

await page.evaluate(() => window.__ZBNX.ui.openSettings());
await sleep(300);
const has = await page.evaluate(() => ({
  toggle: !!document.querySelector('#aiToggle'),
  base: !!document.querySelector('#aiBase'),
  model: !!document.querySelector('#aiModel'),
  key: !!document.querySelector('#aiKey'),
  test: !!document.querySelector('#aiTest'),
  off: document.querySelector('#aiFields')?.classList.contains('is-off')
}));
check(has.toggle && has.base && has.model && has.key && has.test, '设置里有 AI 接口入口', JSON.stringify(has));
check(has.off, '默认关闭时输入区是灰的');

await page.evaluate(() => {
  document.querySelector('#aiToggle').click();
  const set = (sel, v) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  set('#aiBase', 'https://example.invalid/v1');
  set('#aiModel', 'test-model');
  set('#aiKey', 'sk-test');
});
await sleep(200);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zbnx.settings')).ai);
check(saved && saved.on === true && saved.model === 'test-model' && saved.baseUrl === 'https://example.invalid/v1',
  'AI 设置写进本地存储', JSON.stringify(saved));

/* 测试连接会去连一个不存在的域名，必须快速失败、给出失败提示，且不抛异常 */
await page.evaluate(() => document.querySelector('#aiTest').click());
await sleep(2500);
const msg = await page.evaluate(() => document.querySelector('#aiTestMsg').textContent);
check(/失败|连接/.test(msg), '测试连接给出结果文案', msg);

/* 关掉之后，剧情里走政务答复也不应该报错（直接看内置文案） */
await page.evaluate(() => { window.__ZBNX.ui.closePanel(); window.__ZBNX.go('side1'); });
await sleep(400);
const fallback = await page.evaluate(() => {
  const ch = window.__ZBNX.chapters.side1;
  const i = ch.nodes.findIndex(n => n.t === 'govprogress');
  window.__ZBNX.engine.loadChapter(ch, i);
  return i;
});
await sleep(9000);
const panel = await page.evaluate(() => ({
  open: !document.querySelector('#panelLayer').hidden,
  reply: document.querySelectorAll('#govReply p').length,
  tag: !!document.querySelector('.gov-ai-tag')
}));
check(panel.open && panel.reply >= 3, 'AI 不可用时答复回落到内置文案', JSON.stringify(panel));
check(!panel.tag, '回落时不会标成"模型生成"');

check(errors.length === 0, '无 JS 报错', errors.slice(0, 3).join(' | '));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close(); web.kill();
