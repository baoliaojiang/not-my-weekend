/* =========================================================
   读档 / 继续游戏：场景是否恢复（黑屏回归测试）
   ---------------------------------------------------------
   背景：存档只存文字状态，读档进来 bg 层是空的，
        表现是黑屏。修复后存档带 scene 快照（bg / 立绘 / 音乐）。

   这个测试要确认三件事：
   1) 存档里确实写了 scene
   2) 回标题再读档，背景不是黑屏（有 .bg-layer.on 且 backgroundImage 非 none）
   3) 立绘也回来了

   运行：node tools/test-load-scene.mjs
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2'
};
const web = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const PORT = await new Promise(r => web.listen(0, '127.0.0.1', () => r(web.address().port)));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(400);

const fails = [];
const ok = (cond, msg) => { console.log(cond ? '  ✓' : '  ✗', msg); if (!cond) fails.push(msg); };

/* 场景状态：哪一层背景是亮着的、有没有图、立绘几个 */
const sceneState = () => page.evaluate(() => {
  const layers = [...document.querySelectorAll('.bg-layer')];
  const on = layers.find(el => el.classList.contains('on'));
  const sprites = [...document.querySelectorAll('#spriteLayer .sprite.on')].length;
  return {
    onIndex: layers.indexOf(on),
    bgImage: on ? getComputedStyle(on).backgroundImage : 'none',
    hasImage: !!(on && getComputedStyle(on).backgroundImage !== 'none' && getComputedStyle(on).backgroundImage.includes('url')),
    opacity: on ? getComputedStyle(on).opacity : '0',
    sprites,
    currentBg: window.__ZBNX.stage ? window.__ZBNX.stage.currentBg : null
  };
});

/* 推进：点对话 / 点舞台 / 处理面板 / 处理选项 */
async function advance(steps = 40) {
  for (let i = 0; i < steps; i++) {
    const s = await page.evaluate(() => ({
      panel: !document.querySelector('#panelLayer').hidden,
      matTake: !!document.querySelector('#matTake'),
      panelClose: !!document.querySelector('#panelClose'),
      choice: !document.querySelector('#choiceLayer').hidden,
      dlg: !document.querySelector('#dialogue').hidden
    }));
    if (s.panel) {
      if (s.matTake) await page.evaluate(() => document.querySelector('#matTake')?.click());
      else if (s.panelClose) await page.evaluate(() => document.querySelector('#panelClose')?.click());
      await sleep(120);
      continue;
    }
    if (s.choice) { await page.evaluate(() => document.querySelector('#choiceBox .choice-item')?.click()); await sleep(150); continue; }
    if (s.dlg) await page.evaluate(() => document.querySelector('#dialogue').click());
    else await page.evaluate(() => document.querySelector('#stage').click());
    await sleep(70);
  }
}

console.log('\n[1] 进游戏并推进到有背景的段落');
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await page.evaluate(() => {
  document.querySelector('#disclaimerOk')?.click();
  window.__ZBNX.settings.textSpeed = 'instant';
});
await sleep(600);
await advance(30);
const before = await sceneState();
console.log('  场景:', JSON.stringify(before));
ok(before.hasImage, '推进后背景有图（不是黑屏）');

console.log('\n[2] 存档并检查 scene 快照');
await page.evaluate(() => window.__ZBNX.save(1));
await sleep(300);
const saved = await page.evaluate(() => {
  const raw = localStorage.getItem("zbnx.save.1");
  return raw ? JSON.parse(raw) : null;
});
const scene = saved && saved.scene;
console.log('  存档 scene:', JSON.stringify(scene));
ok(!!scene, '存档里带 scene 字段');
ok(!!(scene && scene.bg), 'scene 里记了背景 id');

console.log('\n[3] 回标题 → 读档，检查是否黑屏');
await page.evaluate(() => window.__ZBNX.backToTitle());
await sleep(500);
await page.evaluate(() => window.__ZBNX.load(1));
await sleep(600);
const after = await sceneState();
console.log('  场景:', JSON.stringify(after));
ok(after.hasImage, '读档后背景有图（黑屏已修）');
ok(after.opacity === '1' || after.opacity === '', `读档后背景层可见（opacity=${after.opacity}）`);
ok(after.currentBg === (scene && scene.bg), '舞台记录的背景与存档一致');
if ((scene && scene.sprites || []).length) {
  ok(after.sprites >= 1, `读档后立绘恢复（${after.sprites} 个）`);
}

console.log('\n[4] 读档后还能继续推进');
await advance(12);
const moved = await page.evaluate(() => window.__ZBNX.state.index);
ok(moved > (saved.index || 0), `读档后能继续（${saved.index} → ${moved}）`);

await page.screenshot({ path: path.join(ROOT, 'tools/shots-regress/load-scene.png') });

console.log('\n--- 控制台错误 ---');
console.log(errors.length ? errors.slice(0, 5).join('\n') : '(none)');
console.log(`\n结果：${fails.length ? `失败 ${fails.length} 项\n - ${fails.join('\n - ')}` : '全部通过'}`);
await browser.close();
web.close();
process.exit(fails.length ? 1 : 0);
