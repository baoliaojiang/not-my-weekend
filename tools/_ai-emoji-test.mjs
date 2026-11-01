/* 复现「问薄荷发带 emoji 的消息就崩」 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build', '_aiemoji');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const errs = [];
page.on('response', r => { if (r.status() >= 400) errs.push('[http' + r.status() + '] ' + r.url()); });
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));

/* 拦 fetch：一律返回 429 */
await page.evaluateOnNewDocument(() => {
  window.__calls = [];
  const of = window.fetch;
  window.fetch = function (u, o) {
    window.__calls.push({ url: String(u), body: o && o.body ? String(o.body) : '' });
    return Promise.resolve(new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
      status: 429, headers: { 'Content-Type': 'application/json' }
    }));
  };
});

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

/* 填好 AI 配置（只填地址与模型，不需要真 Key） */
await page.evaluate(() => {
  const ui = window.__ZBNX.ui;
  ui.settings.ai = { ...(ui.settings.ai || {}), on: true, baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: 'sk-test' };
  ui.openAssistant();
});
await wait(900);

async function send(text, tag) {
  await page.evaluate((t) => {
    const inp = document.querySelector('#aiInput');
    inp.value = t;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await page.evaluate(() => document.querySelector('#aiSend').click());
  await wait(2500);
  const state = await page.evaluate(() => {
    const log = document.querySelector('#aiLog');
    return {
      html: log ? log.innerHTML.slice(0, 900) : '(no log)',
      count: document.querySelectorAll('#aiLog .ai-msg-row').length
    };
  });
  console.log('\n===== ' + tag + ' =====');
  console.log('  行数: ' + state.count);
  console.log('  HTML: ' + state.html.replace(/\n/g, " "));
  await page.screenshot({ path: path.join(OUT, tag + '.png'), type: 'png' });
}

await send('今天天气不错', 'plain');
await send('今天天气不错 😀', 'emoji');

const calls = await page.evaluate(() => window.__calls);
console.log('\n===== fetch 调用 =====');
calls.forEach(c => console.log('  ' + c.url + '\n    body: ' + c.body.slice(0, 300)));

console.log('\n===== 控制台错误 =====');
errs.forEach(e => console.log('  ' + e));
if (!errs.length) console.log('  （无）');

await browser.close();
