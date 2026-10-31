/* 全流程测试：序章 → 第一章 → 第二章（含聊天逐条发送、AI 助手、三处分支） */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const OUT = ROOT + '/tools/shots-flow';
fs.mkdirSync(OUT, { recursive: true });

/* 内置静态服务器，测试不再依赖外部 http-server */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml'
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
const st = () => page.evaluate(() => {
  const s = window.__ZBNX.state;
  return {
    chapter: s.chapterId, index: s.index, ap: s.ap, mats: s.materials.slice(),
    flags: { ...s.flags }, chats: s.chats.length, log: s.log.length,
    choices: s.choices.length, notes: s.notes.length
  };
});
const uiState = () => page.evaluate(() => ({
  choice: !document.querySelector('#choiceLayer').hidden,
  hub: !document.querySelector('#hubLayer').hidden,
  gov: !document.querySelector('#panelLayer').hidden && !!document.querySelector('.gov'),
  panel: !document.querySelector('#panelLayer').hidden,
  title: !document.querySelector('#titleScreen').hidden,
  summary: !!document.querySelector('#sumNext') && !document.querySelector('#panelLayer').hidden,
  dialogue: !document.querySelector('#dialogue').hidden,
  text: document.querySelector('#dlgText').textContent
}));

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(500);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(600);

async function clickDialogue() {
  await page.evaluate(() => {
    const dlg = document.querySelector('#dialogue');
    if (dlg && !dlg.hidden) dlg.click();
    else document.querySelector('#stage').click();
  });
}

let guard = 0;
let shots = 0;
let summarySeen = 0;
let hubVisits = 0;
let chatRounds = 0;
let aiOpened = 0;

while (guard++ < 3000) {
  const u = await uiState();

  if (u.title) break;

  if (u.summary) {
    summarySeen++;
    if (summarySeen === 1) { await page.screenshot({ path: `${OUT}/a-summary-ch0.png` }); await sleep(200); }
    await page.evaluate(() => document.querySelector('#sumNext').click());
    await sleep(700);
    continue;
  }

  if (u.choice) {
    const n = await page.evaluate(() => document.querySelectorAll('#choiceBox .choice-item').length);
    // 记录一次选项截图
    if (shots < 1) { await page.screenshot({ path: `${OUT}/b-choice.png` }); shots++; }
    // 轮流选不同项，覆盖分支
    const pick = (await page.evaluate(() => window.__ZBNX.state.choices.length)) % n;
    await page.evaluate((i) => document.querySelectorAll('#choiceBox .choice-item')[i].click(), pick);
    await sleep(350);
    continue;
  }

  if (u.hub) {
    hubVisits++;
    if (hubVisits === 1) await page.screenshot({ path: `${OUT}/c-hub.png` });
    const ap = (await st()).ap;
    if (hubVisits > 8) { // 兜底：离开
      await page.evaluate(() => document.querySelector('#hubLeave').click());
      await sleep(400);
      continue;
    }
    const picked = await page.evaluate(() => {
      const c = document.querySelectorAll('#hubGrid .hub-card:not([disabled])');
      if (!c.length) return false;
      c[0].click();
      return true;
    });
    if (!picked) {
      await page.evaluate(() => document.querySelector('#hubLeave').click());
      await sleep(400);
      continue;
    }
    await sleep(400);
    continue;
  }

  if (u.panel) {
    // 聊天面板的三种状态：等你选 / 正在收消息 / 等你点继续
    const c = await page.evaluate(() => ({
      reply: !!document.querySelector('.wx-reply [data-reply]'),
      typing: !!document.querySelector('#chatTyping'),
      cont: !!document.querySelector('#chatContinueBtn')
    }));

    if (c.reply) {
      chatRounds++;
      const msgsBefore = await page.evaluate(() => window.__ZBNX.state.chats.length);
      await page.evaluate(() => document.querySelector('.wx-reply [data-reply]').click());
      await sleep(450);
      // 选完之后立刻应该看到自己发出去的那条
      const mineSeen = await page.evaluate(() => !!document.querySelector('#phoneBody .wx-row.me'));
      if (!mineSeen) errors.push('CHAT 选完后没有立即显示我方消息');
      // 再等对方消息逐条到齐
      for (let k = 0; k < 24; k++) {
        const s2 = await page.evaluate(() => ({
          typing: !!document.querySelector('#chatTyping'),
          cont: !!document.querySelector('#chatContinueBtn'),
          reply: !!document.querySelector('.wx-reply [data-reply]'),
          n: window.__ZBNX.state.chats.length
        }));
        if (s2.reply || s2.cont) break;
        await sleep(250);
      }
      const msgsAfter = await page.evaluate(() => window.__ZBNX.state.chats.length);
      if (msgsAfter <= msgsBefore) errors.push('CHAT 选择后没有追加消息');
      continue;
    }

    if (c.typing) { await sleep(400); continue; }

    if (c.cont) {
      await page.evaluate(() => document.querySelector('#chatContinueBtn').click());
      await sleep(300);
      continue;
    }

    // 普通的存档 / 设置 等面板：直接关掉
    await page.evaluate(() => {
      const b = document.querySelector('#panelClose');
      if (b && b.style.visibility !== 'hidden') b.click();
    });
    await sleep(250);
    continue;
  }

  // AI 助手：问一句再结束
  if (u.ai) {
    aiOpened++;
    await page.evaluate(() => {
      const q = document.querySelector('[data-ask]');
      if (q) q.click();
    });
    await sleep(900);
    await page.evaluate(() => document.querySelector('#aiDone').click());
    await sleep(300);
    continue;
  }

  if (!u.dialogue) {
    // 可能处于等待或动画，轻点
    await clickDialogue();
    await sleep(160);
    continue;
  }

  await clickDialogue();
  await sleep(120);
}

const final = await st();
const finalUI = await uiState();
console.log('end state:', JSON.stringify(final, null, 1));
console.log('end ui:', JSON.stringify(finalUI));
console.log('summarySeen:', summarySeen, 'hubVisits:', hubVisits, 'chatRounds:', chatRounds, 'aiOpened:', aiOpened);
await page.screenshot({ path: `${OUT}/d-end.png` });
console.log('\nerrors:', errors.length ? errors.join('\n') : '(none)');
await browser.close();
server.close();
