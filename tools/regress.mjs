/* 回归测试：聊天逐条发送 / 退出重进选项还在 / 后台停音乐 / AI 助手 / 移动端选项位置 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const OUT = ROOT + '/tools/shots-regress';
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
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
const fails = [];
const ok = (cond, msg) => { if (cond) console.log('  ✓', msg); else { fails.push(msg); console.log('  ✗', msg); } };

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = (fn, ...a) => page.evaluate(fn, ...a);

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(400);
await ev(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await ev(() => {
  document.querySelector('#disclaimerOk').click();
  window.__ZBNX.settings.textSpeed = 'instant';
});
await sleep(500);


/* 若已经回到标题页，重新进入游戏（测试过程中的状态兜底） */
async function ensureInGame() {
  const onTitle = await ev(() => !document.querySelector('#titleScreen').hidden);
  if (!onTitle) return;
  const hasSave = await ev(() => {
    const b = document.querySelector('[data-act="continue"]');
    return b && !b.disabled;
  });
  if (hasSave) {
    await ev(() => document.querySelector('[data-act="continue"]').click());
    await sleep(900);
  } else {
    await ev(() => document.querySelector('[data-act="new"]').click());
    await sleep(200);
    await ev(() => document.querySelector('#disclaimerOk').click());
    await sleep(600);
  }
  await ev(() => { window.__ZBNX.settings.textSpeed = 'instant'; });
}

/* ---------- 走到第一个聊天回复 ---------- */
async function walkToChat(max = 1500) {
  for (let i = 0; i < max; i++) {
    const s = await ev(() => ({
      panel: !document.querySelector('#panelLayer').hidden,
      reply: !!document.querySelector('.wx-reply [data-reply]'),
      choice: !document.querySelector('#choiceLayer').hidden,
      dlg: !document.querySelector('#dialogue').hidden,
      // 面板类型：新材料面板有「收下」按钮，其余面板右上角可关
      matTake: !!document.querySelector('#matTake'),
      chatCont: !!document.querySelector('#chatContinueBtn'),
      closeBtn: !!document.querySelector('#panelClose')
    }));
    if (s.panel && s.reply) return true;
    if (s.choice) {
      await ev(() => document.querySelector('#choiceBox .choice-item').click());
      await sleep(120);
      continue;
    }
    // 面板挡着的时候，先把面板收掉，否则点 stage 收不到
    if (s.panel) {
      if (s.matTake) await ev(() => document.querySelector('#matTake')?.click());
      else if (s.chatCont) await ev(() => document.querySelector('#chatContinueBtn')?.click());
      else if (s.closeBtn) await ev(() => document.querySelector('#panelClose')?.click());
      await sleep(120);
      continue;
    }
    if (s.dlg) await ev(() => document.querySelector('#dialogue').click());
    else await ev(() => document.querySelector('#stage').click());
    await sleep(90);
  }
  return false;
}

console.log('\n[1] 聊天逐条发送');
const reached = await walkToChat();
ok(reached, '走到第一处聊天回复');
await page.screenshot({ path: `${OUT}/1-chat-options.png` });

const before = await ev(() => window.__ZBNX.state.chats.length);
await ev(() => document.querySelector('.wx-reply [data-reply]').click());
await sleep(250);
const mineNow = await ev(() => ({
  mine: !!document.querySelector('#phoneBody .wx-row.me'),
  typing: !!document.querySelector('#chatTyping'),
  panelOpen: !document.querySelector('#panelLayer').hidden
}));
ok(mineNow.panelOpen, '选完之后面板没有立刻关闭');
ok(mineNow.mine, '我方消息立即上屏');

await sleep(500);
const typingSeen = await ev(() => !!document.querySelector('#chatTyping'));
ok(typingSeen, '对方回复前出现「正在输入」');

// 等这一轮播完
for (let i = 0; i < 40; i++) {
  const c = await ev(() => ({
    cont: !!document.querySelector('#chatContinueBtn'),
    reply: !!document.querySelector('.wx-reply [data-reply]')
  }));
  if (c.cont || c.reply) break;
  await sleep(250);
}
const after = await ev(() => ({
  n: window.__ZBNX.state.chats.length,
  cont: !!document.querySelector('#chatContinueBtn'),
  reply: !!document.querySelector('.wx-reply [data-reply]')
}));
ok(after.n > before, '对方消息已追加到会话里');
ok(after.cont || after.reply, '播完后停在面板里等玩家（继续按钮 / 下一轮选项）');
await page.screenshot({ path: `${OUT}/2-chat-after.png` });

console.log('\n[2] 聊天中途存档 → 读档后选项还在');
// 若当前是「继续」按钮，就先推进到下一处回复；否则直接在选项处存档
if (after.cont) {
  await ev(() => document.querySelector('#chatContinueBtn').click());
  await sleep(300);
  await walkToChat();
}
const savedAt = await ev(() => {
  const s = window.__ZBNX.state;
  return { i: s.index, ch: s.chapterId, hasReply: !!document.querySelector('.wx-reply [data-reply]') };
});
ok(savedAt.hasReply, '存档时正处在聊天选项上');
/* 停在聊天选项上时，手机面板是锁住的（不能让玩家把题目收走），
   所以这里照真实路径走：先存档，再从菜单回标题。
   回标题这一段直接调菜单里同一个接口，不做无意义的点按钮绕路。 */
await ev(() => window.__ZBNX.ui.openSaves('save'));
await sleep(300);
await ev(() => document.querySelector('[data-slot="1"]').click());
await sleep(300);

// 回到标题再读档，模拟“退出去重进”
await ev(() => window.__ZBNX.saveAPI.backToTitle());
await sleep(600);
ok(await ev(() => !document.querySelector('#titleScreen').hidden), '回到标题');

await ev(() => {
  const api = window.__ZBNX;
  api.ui.openSaves('load');
});
await sleep(300);
await ev(() => document.querySelector('[data-slot="1"]').click());
await sleep(900);

const reloaded = await ev(() => ({
  panel: !document.querySelector('#panelLayer').hidden,
  reply: !!document.querySelector('.wx-reply [data-reply]'),
  chatMsgs: document.querySelectorAll('#phoneBody .wx-row').length,
  blocked: window.__ZBNX.engine.blocked
}));
ok(reloaded.panel, '读档后手机面板重新出现');
ok(reloaded.reply, '读档后聊天选项重新出现（不再是空白）');
await page.screenshot({ path: `${OUT}/3-reload-chat.png` });

// 选项能点吗
await ev(() => document.querySelector('.wx-reply [data-reply]').click());
await sleep(400);
ok(await ev(() => !document.querySelector('#panelLayer').hidden), '读档后选项点击有效');

console.log('\n[3] 选项界面存档入口');
await ensureInGame();
// 推进到普通选项
for (let i = 0; i < 200; i++) {
  const s = await ev(() => ({
    choice: !document.querySelector('#choiceLayer').hidden,
    panel: !document.querySelector('#panelLayer').hidden,
    cont: !!document.querySelector('#chatContinueBtn'),
    reply: !!document.querySelector('.wx-reply [data-reply]'),
    dlg: !document.querySelector('#dialogue').hidden
  }));
  if (s.choice) break;
  if (s.panel) {
    if (s.reply) { await ev(() => document.querySelector('.wx-reply [data-reply]').click()); await sleep(300); continue; }
    if (s.cont) { await ev(() => document.querySelector('#chatContinueBtn').click()); await sleep(250); continue; }
    if (await ev(() => !!document.querySelector('#matTake'))) { await ev(() => document.querySelector('#matTake')?.click()); await sleep(200); continue; }
    await ev(() => document.querySelector('#panelClose').click());
    await sleep(200);
    continue;
  }
  if (s.dlg) await ev(() => document.querySelector('#dialogue').click());
  else await ev(() => document.querySelector('#stage').click());
  await sleep(80);
}
ok(await ev(() => !!document.querySelector('#choiceSave')), '选项层有存档按钮');
await ev(() => document.querySelector('#choiceSave').click());
await sleep(400);
ok(await ev(() => !document.querySelector('#panelLayer').hidden), '选项处能打开存档面板');
await page.screenshot({ path: `${OUT}/4-save-at-choice.png` });
await ev(() => document.querySelector('#panelClose').click());
await sleep(200);

console.log('\n[4] 后台暂停音乐');
const bg = await ev(() => {
  window.__ZBNX.audio.play('calm');
  const id = window.__ZBNX.audio.currentId;
  window.__ZBNX.audio.suspendAll();
  const t = window.__ZBNX.audio.tracks[window.__ZBNX.audio.active];
  return { id, paused: t.paused, flag: window.__ZBNX.audio.isBgPaused() };
});
ok(!!bg.id, '音乐已开始播放');
ok(bg.flag, 'suspendAll 置位');
ok(bg.paused, '切后台后音轨真的暂停了');
await ev(() => window.__ZBNX.audio.resumeAll());
await sleep(200);
const resumed = await ev(() => ({
  paused: window.__ZBNX.audio.tracks[window.__ZBNX.audio.active].paused,
  flag: window.__ZBNX.audio.isBgPaused(),
  currentId: window.__ZBNX.audio.currentId,
  src: (window.__ZBNX.audio.tracks[window.__ZBNX.audio.active].src || '').slice(-24),
  ready: window.__ZBNX.audio.tracks[window.__ZBNX.audio.active].readyState,
  unlocked: window.__ZBNX.audio.unlocked
}));
console.log('  audio:', JSON.stringify(resumed));
ok(!resumed.flag && !resumed.paused, '回到前台后恢复播放');
ok(await ev(() => typeof window.__ZB_appPause === 'function' && typeof window.__ZB_appResume === 'function'),
  '外壳钩子 __ZB_appPause / __ZB_appResume 存在');

console.log('\n[5] 政务服务平台（我的反映）');
await ev(() => window.__ZBNX.ui.openGovHome());
await sleep(300);
ok(await ev(() => !document.querySelector('#panelLayer').hidden), '政务面板打开');
ok(await ev(() => /还没有提交过反映/.test(document.querySelector('#panelBody').innerText)),
  '未提交时显示空状态');
await page.screenshot({ path: `${OUT}/5-gov-home.png` });
await ev(() => window.__ZBNX.ui.closePanel());
await sleep(300);
ok(await ev(() => document.querySelector('#panelLayer').hidden), '政务面板可关闭');

console.log('\n[6] 移动端选项位置');
// 用一张干净的页面测，避免前面流程留下的状态干扰
const mp = await browser.newPage();
await mp.setViewport({ width: 800, height: 360, isMobile: true, hasTouch: true });
mp.on('pageerror', e => errors.push('PAGEERROR(m) ' + e.message));
await mp.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(400);
await mp.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await mp.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(600);
await mp.evaluate(() => window.__ZBNX.ui.showChoices('测试', [{ text: '选项 A' }, { text: '选项 B' }], () => {}));
await sleep(400);
const geo = await mp.evaluate(() => {
  const box = document.querySelector('#choiceBox').getBoundingClientRect();
  return { top: box.top, bottom: box.bottom, h: box.height, vh: window.innerHeight,
           gameHidden: document.querySelector('#game').hidden };
});
console.log('  geo:', JSON.stringify(geo));
const gapTop = geo.top;
const gapBottom = geo.vh - geo.bottom;
ok(gapTop > 0 && gapBottom > 0, `选项块完整落在屏幕内（上 ${gapTop.toFixed(0)}px / 下 ${gapBottom.toFixed(0)}px）`);
ok(Math.abs(gapTop - gapBottom) < geo.vh * 0.3, '选项大致垂直居中，不再贴顶');
await mp.screenshot({ path: `${OUT}/7-mobile-choice.png` });
await mp.close();

console.log('\n--- 控制台错误 ---');
console.log(errors.length ? errors.join('\n') : '(none)');
if (errors.length) fails.push('控制台有报错');

console.log('\n结果：', fails.length ? `失败 ${fails.length} 项` : '全部通过');
fails.forEach(f => console.log(' -', f));

await browser.close();
server.close();
