/* 验证「继续游戏 → 章节 → 真的能进去」以及场景跳转
   用法：node tools/_verify-continue.mjs */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(8098, '127.0.0.1', r));

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 760 });
page.on('pageerror', e => console.log('!! pageerror', e.message));
const wait = (ms) => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:8098/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await wait(900);

// 开一局
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await wait(500);
await page.evaluate(() => document.querySelector('#disclaimerOk')?.click());
await wait(700);

// 往前点 60 次，攒出几个已读场景
for (let i = 0; i < 60; i++) {
  await page.mouse.click(550, 640);
  await wait(45);
}
const midState = await page.evaluate(() => ({
  readCount: JSON.parse(localStorage.getItem('zbnx.read') || '[]').length,
  ch: document.querySelector('#hudChapter')?.textContent,
  dlg: document.querySelector('#dlgText')?.textContent?.slice(0, 20)
}));
console.log('推进中：', JSON.stringify(midState));

// 回标题：菜单 → 回到标题
await page.evaluate(() => document.querySelector('#btnMenu')?.click());
await wait(320);
await page.evaluate(() => document.querySelector('[data-menu="title"]')?.click());
await wait(700);
console.log('在标题页：', await page.evaluate(() => !document.querySelector('#titleScreen').hidden));

// 继续游戏 → 章节
await page.evaluate(() => document.querySelector('[data-act="continue"]').click());
await wait(450);
const list = await page.evaluate(() => ({
  cards: [...document.querySelectorAll('[data-ch]')].map(b => b.textContent.replace(/\s+/g, ' ').trim().slice(0, 26))
}));
console.log('章节列表：', JSON.stringify(list));

await page.evaluate(() => document.querySelector('[data-ch]').click());
await wait(400);
const detail = await page.evaluate(() => {
  const enter = document.querySelector('[data-enter]');
  const jumps = [...document.querySelectorAll('[data-jump]')];
  return {
    hasEnter: !!enter,
    enterLabel: enter && enter.textContent.trim(),
    jumpCount: jumps.length,
    jumps: jumps.slice(0, 4).map(j => ({ at: j.dataset.jump, place: j.querySelector('.tlx-place')?.textContent.trim() })),
    cursor: jumps[0] && getComputedStyle(jumps[0]).cursor
  };
});
console.log('章节详情：', JSON.stringify(detail));
await page.screenshot({ path: path.join(ROOT, 'build', '_v3-07-continue.png') });

// 点第三个场景，应该从那里接上
const target = await page.evaluate(() => {
  const j = document.querySelectorAll('[data-jump]')[2] || document.querySelector('[data-jump]');
  return j ? { at: Number(j.dataset.jump), place: j.querySelector('.tlx-place')?.textContent.trim() } : null;
});
await page.evaluate(() => { (document.querySelectorAll('[data-jump]')[2] || document.querySelector('[data-jump]')).click(); });
await wait(900);
const afterJump = await page.evaluate(() => ({
  gameShown: !document.querySelector('#game').hidden,
  panelHidden: document.querySelector('#panelLayer').hidden,
  chapter: document.querySelector('#hudChapter')?.textContent,
  text: document.querySelector('#dlgText')?.textContent?.slice(0, 30),
  toast: document.querySelector('#toast')?.textContent
}));
console.log('点了', JSON.stringify(target), '之后：', JSON.stringify(afterJump));
await page.screenshot({ path: path.join(ROOT, 'build', '_v3-08-jumped.png') });

// 再回标题，用按钮「从这一章开头重玩」
await page.evaluate(() => document.querySelector('#btnMenu')?.click());
await wait(320);
await page.evaluate(() => document.querySelector('[data-menu="title"]')?.click());
await wait(600);
await page.evaluate(() => document.querySelector('[data-act="continue"]').click());
await wait(400);
await page.evaluate(() => document.querySelector('[data-ch]').click());
await wait(300);
await page.evaluate(() => document.querySelector('[data-enter]').click());
await wait(900);
const afterEnter = await page.evaluate(() => ({
  gameShown: !document.querySelector('#game').hidden,
  panelHidden: document.querySelector('#panelLayer').hidden,
  text: document.querySelector('#dlgText')?.textContent?.slice(0, 30),
  index: JSON.parse(localStorage.getItem('zbnx.save.0') || '{}').index
}));
console.log('从头重玩：', JSON.stringify(afterEnter));

// 三连确认清档：点「清档」应依次出现 3 个确认框，第三次才真清
await page.evaluate(() => document.querySelector('#btnMenu')?.click());
await wait(320);
await page.evaluate(() => document.querySelector('[data-menu="settings"]')?.click() || document.querySelector('[data-menu="setting"]')?.click());
await wait(400);
const hasWipe = await page.evaluate(() => !!document.querySelector('#wipeAll'));
console.log('设置里有清档按钮：', hasWipe);
if (hasWipe) {
  const before = await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('zbnx.') === 0).length);
  const titles = [];
  await page.evaluate(() => document.querySelector('#wipeAll').click());
  await wait(260);
  for (let i = 0; i < 3; i++) {
    titles.push(await page.evaluate(() => document.querySelector('#cfmTitle')?.textContent));
    if (i < 2) { await page.evaluate(() => document.querySelector('[data-cfm="ok"]').click()); await wait(240); }
  }
  await page.screenshot({ path: path.join(ROOT, 'build', '_v3-09-wipe3.png') });
  await page.evaluate(() => document.querySelector('[data-cfm="ok"]').click());
  await wait(700);
  const after = await page.evaluate(() => ({
    keys: Object.keys(localStorage).filter(k => k.indexOf('zbnx.') === 0),
    onTitle: !document.querySelector('#titleScreen').hidden
  }));
  console.log('三遍确认标题：', JSON.stringify(titles));
  console.log('清档前 key 数', before, '→ 之后剩下：', JSON.stringify(after));
  await page.screenshot({ path: path.join(ROOT, 'build', '_v3-10-wiped.png') });
}

/* AI 预设数量与填充 */
await page.evaluate(() => document.querySelector('[data-act="settings"]')?.click());
await wait(420);
const presets = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.ai-chip')];
  return { count: chips.length, names: chips.map(c => c.textContent.trim()) };
});
console.log('AI 预设：', JSON.stringify(presets));
await page.evaluate(() => {
  const chip = [...document.querySelectorAll('.ai-chip')].find(c => c.textContent.includes('豆包'));
  chip.click();
});
await wait(250);
console.log('点豆包后：', JSON.stringify(await page.evaluate(() => ({
  base: document.querySelector('#aiBase')?.value,
  model: document.querySelector('#aiModel')?.value,
  tip: document.querySelector('#aiTestMsg')?.textContent
}))));
await page.evaluate(() => { const d = [...document.querySelectorAll('#panelBody details')].find(x => x.textContent.includes('API Key')); if (d) d.open = true; });
await wait(200);
await page.evaluate(() => document.querySelector('#aiPresets').scrollIntoView({ block: 'center' }));
await wait(150);
await page.screenshot({ path: path.join(ROOT, 'build', '_v3-11-presets.png') });

await browser.close();
server.close();
