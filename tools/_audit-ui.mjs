/* 聊天界面 + 人物面板 + 手机桌面 视觉自查 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--mute-audio', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });

const VIEWS = [
  { n: 'p393', w: 393, h: 852, portrait: true, mobile: true },
  { n: 'l844', w: 844, h: 390, portrait: false, mobile: true }
];

for (const v of VIEWS) {
  await p.setViewport({ width: v.w, height: v.h, isMobile: v.mobile, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2' });
  await p.waitForFunction('!!window.__ZBNX', { timeout: 20000 });
  await p.evaluate(() => { const s = document.querySelector('#bootSeq'); if (s) s.style.display = 'none'; });
  await p.evaluate((por) => {
    document.body.classList.toggle('is-portrait', por);
    const s = window.__ZBNX.settings;
    s.ai = { ...s.ai, on: true, baseUrl: 'https://example.test/v1', model: 'mock-chat', apiKey: 'sk-test', searchMode: false };
    window.fetch = async () => ({
      ok: true, json: async () => ({
        choices: [{ message: { content: '我在。想问剧情、人物，还是卡在哪一步了？\n慢慢说，不用一次讲完。' } }]
      })
    });
  }, v.portrait);
  await wait(400);
  await p.evaluate(() => window.__ZBNX.ui.openAssistant());
  await wait(500);
  await p.evaluate(() => {
    const i = document.querySelector('#aiInput');
    i.value = '你好';
    i.dispatchEvent(new Event('input'));
    document.querySelector('#aiSend').click();
  });
  await wait(900);
  await p.screenshot({ path: path.join(ROOT, 'build', `_chat-${v.n}.png`) });

  // 人物面板
  await p.evaluate(() => {
    window.__ZBNX.ui.closeAll();
    const st = window.__ZBNX.state;
    ['met_shen', 'met_zhou', 'met_chen'].forEach(f => { st.flags[f] = true; });
    window.__ZBNX.ui.openCharacters();
  });
  await wait(600);
  await p.screenshot({ path: path.join(ROOT, 'build', `_chars-${v.n}.png`) });

  // 手机桌面
  await p.evaluate(() => { window.__ZBNX.ui.closeAll(); window.__ZBNX.ui.openPhone('home', null); });
  await wait(700);
  await p.screenshot({ path: path.join(ROOT, 'build', `_phone-${v.n}.png`) });

  // 浏览器（原「政务」图标）
  const opened = await p.evaluate(() => {
    const b = document.querySelector('[data-app="browser"]');
    if (!b) return false;
    b.click();
    return true;
  });
  await wait(600);
  await p.screenshot({ path: path.join(ROOT, 'build', `_browser-${v.n}.png`) });
  if (opened) {
    const notFound = await p.evaluate(() => {
      const i = document.querySelector('#brInput');
      if (!i) return 'noinput';
      i.value = 'www.baidu.com';
      document.querySelector('#brForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      return document.querySelector('.br-off') ? 'ok' : 'no-off';
    });
    await wait(400);
    await p.screenshot({ path: path.join(ROOT, 'build', `_browser404-${v.n}.png`) });
    if (notFound !== 'ok') console.log('  浏览器 404 页异常:', notFound);
  }

  // 标题页横屏
  await p.evaluate(() => {
    window.__ZBNX.ui.closeAll();
    window.__ZBNX.backToTitle();
    const q = document.querySelector('#titleQuit');
    if (q) q.hidden = false;   // 网页端本来不显示，这里强制显示看位置
  });
  await wait(900);
  const quitRect = await p.evaluate(() => {
    const q = document.querySelector('#titleQuit');
    if (!q) return null;
    const r = q.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight };
  });
  console.log('  退出按钮', v.n, JSON.stringify(quitRect));
  await p.screenshot({ path: path.join(ROOT, 'build', `_title-${v.n}.png`) });
}

if (errs.length) console.log('JS 错误:', [...new Set(errs)].slice(0, 6));
await b.close();
console.log('done');
