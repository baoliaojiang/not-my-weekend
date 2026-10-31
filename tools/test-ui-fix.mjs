/* =========================================================
   UI 回归：群消息可视化 / 材料弹窗 / 人物面板
   ---------------------------------------------------------
   1) 序章晚上那段群通知，应该真的把手机翻出来给玩家看
   2) 拿到材料时先弹详情，点「收下」才继续
   3) 从标题页直接进支线，人物里应该能看到已经出过场的人
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = path.join(ROOT, 'build', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };

const web = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const PORT = await new Promise(r => web.listen(0, '127.0.0.1', () => r(web.address().port)));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(400);
await page.evaluate(() => { const b = document.querySelector('#disclaimerOk'); if (b) b.click(); });
await sleep(200);

let pass = 0, fail = 0;
const check = (ok, label, extra = '') => {
  if (ok) { pass++; console.log(`✓ ${label}${extra ? '：' + extra : ''}`); }
  else { fail++; console.log(`✗ ${label}${extra ? '：' + extra : ''}`); }
};
const st = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    phone: !q('#panelLayer').hidden && !!q('#phoneBody'),
    phoneText: (q('#phoneBody') || {}).textContent || '',
    mat: !q('#panelLayer').hidden && !!q('#matTake'),
    panelTitle: (q('#panelTitle') || {}).textContent || '',
    blocked: window.__ZBNX.engine.blocked,
    text: (q('#dlgText') || {}).textContent || ''
  };
});
const clickDlg = () => page.evaluate(() => {
  // 有选项就先选第一个，有聊天回复就回第一条，避免卡在需要输入的地方
  const rep = document.querySelector('#phoneBody .wx-reply button[data-reply]');
  if (rep) { rep.click(); return; }
  const chat = document.querySelector('#chatContinueBtn');
  if (chat) { chat.click(); return; }
  const ch = document.querySelectorAll('#choiceLayer .choice-item');
  if (ch.length) { ch[0].click(); return; }
  const d = document.querySelector('#dialogue');
  if (d && !d.hidden) d.click(); else document.querySelector('#stage').click();
});

/* ---------- 1) 序章群消息 ---------- */
await page.evaluate(() => window.__ZBNX.go('ch0'));
await sleep(400);
let sawPhone = false, phoneText = '';
for (let i = 0; i < 400; i++) {
  const s = await st();
  if (s.phone) { sawPhone = true; phoneText = s.phoneText; break; }
  await clickDlg();
  await sleep(25);
}
check(sawPhone, '序章群消息自动打开手机');
check(phoneText.includes('自愿参加'), '群通知正文可见', phoneText.slice(0, 40).replace(/\s+/g, ''));
await page.screenshot({ path: path.join(OUT, 'u1-ch0-group.png') });

/* ---------- 2) 材料弹窗 ---------- */
await page.evaluate(() => {
  const ch = window.__ZBNX.chapters.side1;
  const i = ch.nodes.findIndex(n => n.t === 'mat');
  window.__ZBNX.go('side1', i);
});
await sleep(600);
let s = await st();
check(s.mat && s.panelTitle.includes('新拿到的材料'), '拿到材料时弹详情', `${s.panelTitle}`);
check(s.blocked, '弹窗期间剧情被拦住');
await page.screenshot({ path: path.join(OUT, 'u2-material.png') });
await page.click('#matTake');
await sleep(500);
s = await st();
check(!s.mat, '点「收下」后关闭弹窗');
check(!s.blocked, '收下后剧情恢复');

/* ---------- 3) 人物面板 ---------- */
await page.evaluate(() => {
  const ch = window.__ZBNX.chapters.side1;
  const i = ch.nodes.findIndex(n => n.t === 'show' && n.id === 'wu');
  window.__ZBNX.go('side1', i);
});
await sleep(500);
for (let i = 0; i < 4; i++) { await clickDlg(); await sleep(80); }
const chars = await page.evaluate(() => {
  window.__ZBNX.ui.openCharacters();
  return {
    title: (document.querySelector('#panelTitle') || {}).textContent || '',
    body: (document.querySelector('#panelBody') || {}).textContent || ''
  };
});
check(chars.body.includes('吴建国'), '支线里人物面板能看到吴建国', chars.title);
check(!chars.body.includes('还没有认识什么人'), '不再是空面板');
await page.screenshot({ path: path.join(OUT, 'u3-characters.png') });

check(errors.length === 0, '无 JS 报错', errors.slice(0, 2).join(' | '));
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
await browser.close();
web.close();
process.exit(fail ? 1 : 0);
