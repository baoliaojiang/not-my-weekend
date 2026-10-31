import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });

await p.setViewport({ width: 1280, height: 860 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
await wait(900);

// 先看更新日志标签
await p.evaluate(() => document.querySelector('[data-act="changelog"]').click());
await wait(500);
const tags = await p.evaluate(() => [...document.querySelectorAll('.clog-item .k')].slice(0, 4).map(el => {
  const r = el.getBoundingClientRect();
  return { t: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
}));
console.log('changelog tags:', JSON.stringify(tags));
await p.screenshot({ path: 'build/_v2-01-changelog.png' });
await p.evaluate(() => document.querySelector('#panelClose').click()); await wait(300);

// 配置假接口
await p.evaluate(() => {
  const s = window.__ZBNX.settings;
  s.ai = { ...s.ai, on: true, baseUrl: 'https://example.test/v1', model: 'mock-chat', apiKey: 'sk-test' };
  window.fetch = async (url, opt) => {
    if (String(url).includes('/chat/completions')) {
      const body = JSON.parse(opt.body);
      window.__lastReq = body;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '测试回复：' + body.messages[body.messages.length - 1].content.slice(0, 10) } }] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
});
await p.evaluate(() => window.__ZBNX.ui.openAssistant());
await wait(500);
await p.screenshot({ path: 'build/_v2-02-chat.png' });

// 发一条
await p.evaluate(() => {
  const i = document.querySelector('#aiInput'); i.value = '第一段对话：这游戏讲什么？';
  document.querySelector('#aiSend').click();
});
await wait(800);

// 新建会话
await p.evaluate(() => document.querySelector('#aiNewBtn').click());
await wait(300);
await p.evaluate(() => {
  const i = document.querySelector('#aiInput'); i.value = '第二段对话：沈予安是谁？';
  document.querySelector('#aiSend').click();
});
await wait(800);

const state = await p.evaluate(() => {
  const raw = localStorage.getItem('zbnx.ai.chats.v1');
  const arr = raw ? JSON.parse(raw) : [];
  return { chats: arr.length, titles: arr.map(c => c.title), curRows: document.querySelectorAll('.ai-msg-row').length };
});
console.log('after 2 chats:', JSON.stringify(state));

// 会话列表
await p.evaluate(() => document.querySelector('#aiSessBtn').click());
await wait(300);
const sess = await p.evaluate(() => ({
  visible: !document.querySelector('#aiSessions').hidden,
  rows: document.querySelectorAll('.ai-sess').length,
  first: (document.querySelector('.ai-sess-t') || {}).textContent
}));
console.log('sessions:', JSON.stringify(sess));
await p.screenshot({ path: 'build/_v2-03-sessions.png' });

// 切回第一段
await p.evaluate(() => {
  const rows = document.querySelectorAll('.ai-sess');
  rows[rows.length - 1].click();
});
await wait(300);
const afterSwitch = await p.evaluate(() => ({
  rows: document.querySelectorAll('.ai-msg-row').length,
  last: (document.querySelectorAll('.ai-bub')[document.querySelectorAll('.ai-bub').length - 1] || {}).textContent
}));
console.log('switched:', JSON.stringify(afterSwitch));

// 表情
await p.evaluate(() => document.querySelector('#aiStickerBtn').click());
await wait(300);
const st = await p.evaluate(() => ({
  stickers: document.querySelectorAll('.ai-st').length,
  visible: !document.querySelector('#aiStickers').hidden
}));
console.log('stickers:', JSON.stringify(st));
await p.screenshot({ path: 'build/_v2-04-stickers.png' });
await p.evaluate(() => document.querySelectorAll('.ai-st')[0].click());
await wait(800);
const afterSticker = await p.evaluate(() => {
  const imgs = [...document.querySelectorAll('.ai-bub img')];
  return { imgs: imgs.length, src: imgs.length ? imgs[imgs.length - 1].getAttribute('src') : null,
    lastUserMsg: (window.__lastReq.messages[window.__lastReq.messages.length - 1] || {}).content };
});
console.log('sticker sent:', JSON.stringify(afterSticker));
await p.screenshot({ path: 'build/_v2-05-sticker-msg.png' });

// 刷新后会话是否还在
await p.reload({ waitUntil: 'networkidle2' });
await wait(800);
const persisted = await p.evaluate(() => {
  const raw = localStorage.getItem('zbnx.ai.chats.v1');
  return raw ? JSON.parse(raw).length : 0;
});
console.log('persisted chats after reload:', persisted);

// 竖屏
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await wait(500);
await p.evaluate(() => window.__ZBNX.ui.openAssistant()); await wait(400);
await p.screenshot({ path: 'build/_v2-06-portrait.png' });
const pr = await p.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  logH: Math.round(document.querySelector('#aiLog').getBoundingClientRect().height)
}));
console.log('portrait:', JSON.stringify(pr));
console.log('errors:', errs.length ? errs : '(none)');
await b.close();
