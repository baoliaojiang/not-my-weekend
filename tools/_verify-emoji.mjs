/* 验证 emoji 小图：图片能加载、尺寸正常、和正文基线对齐 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text()); });

await p.setViewport({ width: 1280, height: 860 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
await wait(900);

// 配一个假 key，让输入框可用；回复里塞满 emoji
await p.evaluate(() => {
  const s = window.__ZBNX.settings;
  s.ai = { ...s.ai, on: true, baseUrl: 'https://example.test/v1', model: 'mock-chat', apiKey: 'sk-test', searchMode: false };
  window.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '好呀 😊 我刚泡了杯茶 ☕，窗外在下雨 🌧️，你看这个 🌿 是不是很像你说的那种绿。\n第二行也来一个 ✨ 和 🫠。' } }] })
  });
});

await p.evaluate(() => document.querySelector('#aiFab').click());
await wait(600);
await p.evaluate(() => {
  const box = document.querySelector('.ai-compose textarea, .ai-compose input, #aiInput');
  box.value = '随便说点什么';
  box.dispatchEvent(new Event('input', { bubbles: true }));
  const send = document.querySelector('#aiSend, .ai-send');
  send.click();
});
await wait(1500);

const info = await p.evaluate(() => {
  const imgs = [...document.querySelectorAll('.ai-bub img.emo')];
  const one = imgs[0];
  const bub = document.querySelector('.ai-bub');
  return {
    count: imgs.length,
    loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    naturalW: one ? one.naturalWidth : 0,
    box: one ? [Math.round(one.getBoundingClientRect().width), Math.round(one.getBoundingClientRect().height)] : null,
    bubH: bub ? Math.round(bub.getBoundingClientRect().height) : 0,
    srcs: [...new Set(imgs.map((i) => i.getAttribute('src')))],
    html: bub ? bub.innerHTML.slice(0, 260) : ''
  };
});
console.log('emoji:', JSON.stringify(info, null, 1));

const el = await p.$('.ai-bub');
if (el) await el.screenshot({ path: 'build/_emoji-bub.png' });
console.log('errors:', errs.length ? errs : 'none');
await b.close();
