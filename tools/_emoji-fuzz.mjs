/* emoji 全面排查：各种 emoji 变体是否让页面报错 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await wait(1500);

const cases = [
  '普通 😀', 'ZWJ 👨‍👩‍👧‍👦', '国旗 🇨🇳', '肤色 👍🏽', '旗帜 🏳️‍🌈',
  '键帽 1️⃣', '变体 ❤️', 'ZWJ 序列 👩‍❤️‍💋‍👨', '组合 🧑‍🤝‍🧑',
  '单独变体符 \uFE0F', '代理对 \uD83D', '非法序列 \uD83Dx',
  '尾随 ZWJ \u200D', '标签 🏴󠁧󠁢󠁳󠁣󠁴󠁿'
];

const res = await page.evaluate(async (list) => {
  const m = await import('./bundle.js').catch(() => null);
  return null;
}, cases).catch(() => null);

/* bundle 打包后拿不到模块，直接用页面上已有的 emojiHTML：借 AI 面板的渲染路径测 */
await page.evaluate(() => { const s = document.querySelector('#bootSkip'); if (s) s.click(); const b = document.querySelector('#bootSeq'); if (b) b.remove(); });
await wait(600);
await page.evaluate(() => { const n = document.querySelector('[data-act="new"]'); if (n) n.click(); });
await wait(800);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /覆盖/.test(x.textContent)); if (b) b.click(); });
await wait(600);
await page.evaluate(() => { const o = document.querySelector('#disclaimerOk'); if (o) o.click(); });
await wait(1500);

await page.evaluate(() => {
  window.__ZBNX.ui.settings.ai = { ...(window.__ZBNX.ui.settings.ai || {}), on: true, baseUrl: 'https://x.test/v1', model: 'm', apiKey: 'k' };
  window.__ZBNX.ui.openAssistant();
});
await wait(800);

for (const c of cases) {
  const before = errs.length;
  const out = await page.evaluate((t) => {
    const ui = window.__ZBNX.ui;
    try {
      const cur = ui._aiCur();
      cur.msgs.push({ role: 'user', content: t });
      ui._renderAI();
      const log = document.querySelector('#aiLog');
      return { ok: true, html: log.innerHTML.length };
    } catch (e) {
      return { ok: false, err: e.message };
    }
  }, c);
  const newErrs = errs.slice(before);
  console.log(`${out.ok ? 'OK  ' : 'FAIL'} ${JSON.stringify(c)}  ${out.ok ? 'len=' + out.html : out.err}${newErrs.length ? '  ERR:' + newErrs.join(' | ') : ''}`);
}

/* 再测 hasEmoji 的状态 bug */
const he = await page.evaluate(async () => {
  const m = await import('./emoji.js');
  return [m.hasEmoji('hi 😀'), m.hasEmoji('hi 😀'), m.hasEmoji('hi 😀'), m.hasEmoji('plain')];
});
console.log('\nhasEmoji 连调四次:', JSON.stringify(he));

console.log('\n累计错误:', errs.length ? errs.join('\n') : '（无）');
await browser.close();
