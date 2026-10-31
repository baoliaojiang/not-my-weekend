/* =========================================================
   AI 公文的三种情况测试
   ---------------------------------------------------------
   1. 没配 Key（离线）：立刻显示内置稿，玩家点一下就能继续
   2. 配了 Key：由（模拟的）模型现写，流式写入对话框
   3. 接口连不上：不报错、不卡死，自动退回内置稿

   用法：node tools/test-bureau.mjs
   ========================================================= */

import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, p === '/' ? '/index.html' : p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

/* ---------- 模拟一个 OpenAI 兼容接口 ---------- */
const MOCK_TEXT = '您反映的情况已收悉。\n\n经了解，学校已就周日学业支持活动的报名统计工作作出说明，相关活动依据自愿原则开展。我局已提醒学校注意工作方法。\n\n感谢您对教育工作的关心与监督。';
let mockHits = 0;

const api = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => {
    mockHits++;
    let body = {};
    try { body = JSON.parse(raw); } catch { /* ignore */ }
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const chunks = MOCK_TEXT.match(/[\s\S]{1,12}/g) || [];
      let i = 0;
      const t = setInterval(() => {
        if (i >= chunks.length) {
          res.write('data: [DONE]\n\n');
          res.end();
          clearInterval(t);
          return;
        }
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: chunks[i++] } }] }) + '\n\n');
      }, 12);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: MOCK_TEXT } }] }));
  });
});
await new Promise(r => api.listen(0, '127.0.0.1', r));
const API_PORT = api.address().port;

/* ---------- 浏览器 ---------- */
const errors = [];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? '　' + extra : ''}`);
};

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(400);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(600);

const callReply = (fallback) => page.evaluate(async (fb) => {
  const { engine } = window.__ZBNX;
  // 先停掉主线推进，避免下一句盖掉公文
  engine.stopAllModes();
  engine.paused = true;
  engine.current = null;
  const node = {
    t: 'aireply', name: '区教育局 · 网上信访答复',
    prompt: '请写一份答复', fallback: fb
  };
  engine.current = node;
  await engine.showAIReply(node);
}, fallback);

const read = () => page.evaluate(() => {
  const dlg = document.querySelector('#dialogue');
  const t = document.querySelector('#dlgText').textContent;
  return {
    text: t,
    waiting: dlg.classList.contains('waiting'),
    generating: dlg.classList.contains('generating'),
    letters: (window.__ZBNX.state.letters || []).slice(-1)
  };
});

/* ---------- 1. 离线 ---------- */
await page.evaluate(() => {
  const s = window.__ZBNX.settings;
  s.ai = { preset: 'offline', baseUrl: '', apiKey: '', model: '', temperature: 0.6, maxTokens: 420 };
  window.__ZBNX.ui.ai.setSettings(s);
});
await callReply(['离线第一段。', '离线第二段。']);
await sleep(400);
let r = await read();
ok('离线：立刻显示内置稿', r.text.includes('离线第一段') && r.text.includes('离线第二段'), r.text.replace(/\n/g, ' / ').slice(0, 40));
ok('离线：等待玩家点击继续', r.waiting && !r.generating);
ok('离线：记录来源为 offline', r.letters[0] && r.letters[0].source === 'offline');

/* ---------- 2. 在线（模拟接口，流式） ---------- */
await page.evaluate((port) => {
  const s = window.__ZBNX.settings;
  s.ai = { preset: 'custom', baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'test-key', model: 'mock-model', temperature: 0.6, maxTokens: 420 };
  window.__ZBNX.ui.ai.setSettings(s);
}, API_PORT);
await callReply(['离线稿不该出现。']);
await sleep(1400);
r = await read();
ok('在线：接口被调用', mockHits > 0, `hits=${mockHits}`);
ok('在线：显示模型写的答复', r.text.includes('您反映的情况已收悉') && !r.text.includes('离线稿不该出现'), r.text.slice(0, 30));
ok('在线：记录来源为 api', r.letters[0] && r.letters[0].source === 'api');
ok('在线：生成完成后等待点击', r.waiting && !r.generating);

/* ---------- 3. 接口不可达 ---------- */
await page.evaluate(() => {
  const s = window.__ZBNX.settings;
  s.ai = { preset: 'custom', baseUrl: 'http://127.0.0.1:65500/v1', apiKey: 'x', model: 'm', temperature: 0.6, maxTokens: 420 };
  window.__ZBNX.ui.ai.setSettings(s);
});
await callReply(['接口挂了也要有这段话。']);
await sleep(1800);
r = await read();
ok('失败：退回内置稿', r.text.includes('接口挂了也要有这段话'), r.text.slice(0, 24));
ok('失败：没有卡在生成中', !r.generating && r.waiting);
ok('失败：来源记为 offline', r.letters[0] && r.letters[0].source === 'offline');

const failed = results.filter(x => !x.pass).length;
console.log(`\n结果：${results.length - failed}/${results.length} 通过`);
if (errors.length) console.log('页面错误：\n' + errors.join('\n'));
await browser.close();
server.close();
api.close();
process.exit(failed ? 1 : 0);
