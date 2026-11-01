/* 电话：验证所有剧情角色都能拨 + AI 真的按人设回话 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build', '_dialcheck');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

/* 假接口：返回一句带角色名字的话，看请求里的 system 提示词是不是那个人 */
await page.evaluateOnNewDocument(() => {
  window.__reqs = [];
  const of = window.fetch;
  window.fetch = function (u, o) {
    const body = o && o.body ? String(o.body) : '';
    window.__reqs.push(body);
    return Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: '（测试回复）' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
});

const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await wait(1500);
await page.evaluate(() => { const s = document.querySelector('#bootSkip'); if (s) s.click(); const b = document.querySelector('#bootSeq'); if (b) b.remove(); });
await wait(700);
await page.evaluate(() => { const n = document.querySelector('[data-act="new"]'); if (n) n.click(); });
await wait(800);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /覆盖/.test(x.textContent)); if (b) b.click(); });
await wait(600);
await page.evaluate(() => { const o = document.querySelector('#disclaimerOk'); if (o) o.click(); });
await wait(1800);

/* 配好 AI */
await page.evaluate(() => {
  const ui = window.__ZBNX.ui;
  ui.settings.ai = { ...(ui.settings.ai || {}), on: true, baseUrl: 'https://x.test/v1', model: 'm', apiKey: 'k' };
});

/* 打开电话 */
await page.evaluate(() => { window.__ZBNX.ui._renderPhoneHome(); });
await wait(1000);
await page.evaluate(() => { window.__ZBNX.ui._pushApp('dial'); });
await wait(1000);

const persons = await page.evaluate(() => {
  return [...document.querySelectorAll('[data-dial]')].map(b => ({
    id: b.dataset.dial,
    name: b.querySelector('.dl-pt b') ? b.querySelector('.dl-pt b').textContent : '',
    sub: b.querySelector('.dl-pt i') ? b.querySelector('.dl-pt i').textContent : '',
    unmet: b.classList.contains('is-unmet')
  }));
});
console.log('===== 电话里的人 (' + persons.length + ') =====');
persons.forEach(p => console.log(`  ${p.id.padEnd(8)} ${p.name.padEnd(6)} ${p.sub}${p.unmet ? '  [还没见过]' : ''}`));
await page.screenshot({ path: path.join(OUT, '01-dial-list.png'), type: 'png' });

/* 挑一个剧情角色打过去 */
const target = persons.find(p => p.id === 'chen') || persons.find(p => p.id !== 'mint');
console.log('\n===== 拨打 ' + target.name + ' =====');
await page.evaluate((id) => {
  const b = document.querySelector('[data-dial="' + id + '"]');
  if (b) b.click();
}, target.id);
await wait(2000);
await page.screenshot({ path: path.join(OUT, '02-call.png'), type: 'png' });

/* 说一句话 */
await page.evaluate(() => {
  const i = document.querySelector('#dlInput');
  if (i) { i.value = '老师，这个周日还要上课吗？'; i.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.evaluate(() => { const b = document.querySelector('#dlSend'); if (b) b.click(); });
await wait(2500);

const log = await page.evaluate(() => {
  const l = document.querySelector('#dlLog');
  return l ? l.textContent.replace(/\s+/g, ' ').slice(0, 400) : '(无)';
});
console.log('  通话记录: ' + log);

const reqs = await page.evaluate(() => window.__reqs);
console.log('\n===== 请求数: ' + reqs.length + ' =====');
reqs.slice(-1).forEach(r => {
  try {
    const j = JSON.parse(r);
    console.log('  system 前 260 字:\n    ' + j.messages[0].content.slice(0, 260).replace(/\n/g, '\n    '));
    console.log('  user: ' + JSON.stringify(j.messages[j.messages.length - 1]));
  } catch (e) { console.log('  (解析失败)'); }
});

console.log('\n页面错误:', errs.length ? errs.join('\n') : '（无）');
await browser.close();
