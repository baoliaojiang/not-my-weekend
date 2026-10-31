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

const title = await p.evaluate(() => ({
  title: document.title,
  h1: document.querySelector('.title-main').textContent,
  eyebrow: document.querySelector('.title-eyebrow').textContent,
  fab: !!document.querySelector('#aiFab')
}));
console.log('title:', JSON.stringify(title));
await p.screenshot({ path: 'build/_ai-01-title.png' });

// 未配置状态
await p.evaluate(() => document.querySelector('#aiFab').click());
await wait(500);
const empty = await p.evaluate(() => ({
  panel: document.querySelector('#panelTitle').textContent,
  hasGuide: !!document.querySelector('.ai-empty'),
  decl: (document.querySelector('.ai-empty .ai-compose-tip') || {}).textContent
}));
console.log('unconfigured:', JSON.stringify(empty));
await p.screenshot({ path: 'build/_ai-02-empty.png' });

// 配置一个假接口，并用 stub 的 fetch 模拟回复
await p.evaluate(() => {
  const s = window.__ZBNX.settings;
  s.ai = { ...s.ai, on: true, baseUrl: 'https://example.test/v1', model: 'mock-chat', apiKey: 'sk-test', searchMode: false };
  window.__ZBNX.ui.closeAll();
  // 模拟接口
  window.fetch = async (url, opt) => {
    if (String(url).includes('/chat/completions')) {
      const body = JSON.parse(opt.body);
      const last = body.messages[body.messages.length - 1];
      window.__lastReq = body;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: `收到「${last.content.slice(0, 12)}」。这是测试回复。\n第二行。` } }] })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
});
await wait(200);
await p.evaluate(() => window.__ZBNX.ui.openAssistant());
await wait(500);

const chat = await p.evaluate(() => ({
  head: (document.querySelector('#acStatus') || {}).textContent,
  greeting: (document.querySelector('.ai-bub') || {}).textContent,
  decl: (document.querySelector('#aiComposeTip') || {}).textContent,
  search: document.querySelector('#acSearch').className
}));
console.log('chat:', JSON.stringify(chat));
await p.screenshot({ path: 'build/_ai-03-chat.png' });

// 发一条消息
await p.evaluate(() => {
  const i = document.querySelector('#aiInput');
  i.value = '这游戏讲什么？';
  document.querySelector('#aiSend').click();
});
await wait(900);
const after = await p.evaluate(() => ({
  rows: document.querySelectorAll('.ai-msg-row').length,
  last: document.querySelectorAll('.ai-bub')[document.querySelectorAll('.ai-bub').length - 1].textContent,
  roles: (window.__lastReq && window.__lastReq.messages || []).map(m => m.role),
  sysHead: (window.__lastReq && window.__lastReq.messages[0].content || '').slice(0, 30),
  sysSearch: (window.__lastReq && window.__lastReq.messages[0].content || '').includes('搜索模式：未开启')
}));
console.log('after send:', JSON.stringify(after));
await p.screenshot({ path: 'build/_ai-04-reply.png' });

// 搜索开关
await p.evaluate(() => document.querySelector('#acSearch').click());
await wait(300);
const s2 = await p.evaluate(() => ({
  cls: document.querySelector('#acSearch').className,
  status: document.querySelector('#acStatus').textContent,
  mode: window.__ZBNX.settings.ai.searchMode
}));
console.log('search toggle:', JSON.stringify(s2));

// 游戏内按钮
await p.evaluate(() => window.__ZBNX.ui.closeAll());
await wait(200);
await p.evaluate(() => document.querySelector('[data-act="new"]').click()); await wait(300);
await p.evaluate(() => { const c = document.querySelector('[data-cfm="ok"]'); c && c.click(); }); await wait(250);
await p.evaluate(() => document.querySelector('#disclaimerOk').click()); await wait(800);
const hud = await p.evaluate(() => {
  const el = document.querySelector('#btnAI');
  const r = el.getBoundingClientRect();
  return { exists: !!el, w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
});
console.log('hud button:', JSON.stringify(hud));
await p.screenshot({ path: 'build/_ai-05-hud.png' });
await p.evaluate(() => document.querySelector('#btnAI').click());
await wait(400);
const inGame = await p.evaluate(() => ({
  panel: document.querySelector('#panelTitle').textContent,
  rows: document.querySelectorAll('.ai-msg-row').length
}));
console.log('open from hud:', JSON.stringify(inGame));

// 竖屏
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await wait(500);
await p.evaluate(() => window.__ZBNX.ui.closeAll()); await wait(200);
await p.evaluate(() => window.__ZBNX.ui.openAssistant()); await wait(400);
await p.screenshot({ path: 'build/_ai-06-portrait.png' });
const pr = await p.evaluate(() => ({
  docW: document.documentElement.scrollWidth, cliW: document.documentElement.clientWidth,
  panelH: Math.round(document.querySelector('.panel').getBoundingClientRect().height)
}));
console.log('portrait:', JSON.stringify(pr));
console.log('errors:', errs.length ? errs : '(none)');
await b.close();
