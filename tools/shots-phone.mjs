/* 手机消息界面（微信风）截图验证 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const OUT = 'D:/workbuddy/2026-10-23-16-33-10/tools/shots/phone';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

const shot = async (name, clip) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  console.log('shot', name);
};

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(700);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(1200);

// 注入一批消息，模拟晚上的群聊
await page.evaluate(() => {
  const st = window.__ZBNX.state;
  st.chats = [
    { thread: 'class', from: '', text: '你已加入群聊', day: '九月十二日 周五' },
    { thread: 'class', from: '陈老师', text: '各位同学：本学期周日学业支持活动为自愿参加，有意参加的同学下周在班级报名表上登记。' },
    { thread: 'class', from: '陈老师', text: '不参加的同学不需要说明理由。' },
    { thread: 'class', from: '陈老师', text: '具体安排确定后会通知大家。', ts: 5 },
    { thread: 'class', from: '郑野', text: '收到', ts: 6 },
    { thread: 'class', from: '许小满', text: '收到', ts: 7 },
    { thread: 'class', from: '王梓', text: '收到', ts: 8 },
    { thread: 'class', from: '罗一舟', text: '老师，报名表明天早读发吗？', ts: 9 },
    { thread: 'class', from: '陈老师', text: '明天早读发。', ts: 10 },
    { thread: 'class', from: '我', text: '如果不去，会不会被记成「不配合」', me: true, ts: 11 },
    { thread: 'shen', from: '沈予安', text: '你报了吗？', day: '九月十二日 周五', ts: 12 },
    { thread: 'shen', from: '我', text: '还没。你呢？', me: true, ts: 13 },
    { thread: 'shen', from: '沈予安', text: '我也没。', ts: 14 },
    { thread: 'shen', from: '沈予安', text: '我妈已经问过我了。', ts: 15 },
    { thread: 'parents', from: '周予晴妈妈', text: '请问这个活动到几点结束？', day: '九月十二日 周五', ts: 16 },
    { thread: 'parents', from: '马文杰', text: '接龙是自愿的，大家配合一下。', ts: 17 }
  ];
});

await page.evaluate(() => window.__ZBNX.ui.openPhone('list'));
await sleep(600);
await shot('01-phone-list');

await page.evaluate(() => window.__ZBNX.ui.openPhone('class'));
await sleep(500);
await shot('02-phone-group');

// 群聊里点一下，看气泡与昵称
await page.evaluate(() => window.__ZBNX.ui.openPhone('shen'));
await sleep(500);
await shot('03-phone-dm');

// 回复选项
await page.evaluate(() => {
  window.__ZBNX.ui.openChatReply({
    thread: 'shen',
    options: [
      { text: '还没。你呢？' },
      { text: '还没想好。' },
      { text: '你不是不想去吗？' }
    ]
  }, () => {});
});
await sleep(1200);
await shot('04-phone-reply');

// 手机形态面板的完整截图（只截面板区域）
const box = await page.evaluate(() => {
  const p = document.querySelector('.panel');
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
if (box) await shot('05-phone-panel', box);

console.log('\n--- errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
