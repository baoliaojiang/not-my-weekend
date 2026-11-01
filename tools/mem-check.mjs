/* =========================================================
   运行时内存测量
   ---------------------------------------------------------
   用户要求「打包前优化运存和内存（确保精度不变、无 bug）」，
   所以先量清楚：跑一遍典型流程（进游戏 → 切场景 → 开手机 → AI 对话），
   看 JS 堆和 DOM 节点数怎么涨。

   量到的数字写进 build/_mem.json，优化后再跑一次对比。
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--js-flags=--expose-gc']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await wait(1500);

async function mem(label) {
  const m = await page.evaluate(async () => {
    if (window.gc) { try { window.gc(); } catch (e) { /* 忽略 */ } }
    const perf = performance.memory ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
      total: Math.round(performance.memory.totalJSHeapSize / 1048576)
    } : null;
    return {
      nodes: document.getElementsByTagName('*').length,
      heap: perf,
      images: document.images.length,
      imgsLoaded: [...document.images].filter(i => i.complete && i.naturalWidth > 0).length
    };
  });
  console.log(`  ${label.padEnd(22)} DOM ${String(m.nodes).padStart(5)}  图 ${String(m.images).padStart(3)}（已载 ${m.imgsLoaded}）  堆 ${m.heap ? m.heap.used + 'MB / ' + m.heap.total + 'MB' : 'n/a'}`);
  return m;
}

console.log('\n内存测量');
await mem('启动后');

// 进序章
await page.evaluate(async () => {
  for (let i = 0; i < 14; i++) {
    const o = document.querySelector('#disclaimerOk'); if (o) o.click();
    const s = document.querySelector('#bootSkip'); if (s) s.click();
    const bs = document.querySelector('#bootSeq'); if (bs) bs.remove();
    await new Promise(r => setTimeout(r, 120));
  }
});
await wait(1500);
await mem('进序章');

/* 推剧情，推进到有立绘与背景的节点 */
for (let round = 0; round < 3; round++) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Space').catch(() => { });
    await page.evaluate(() => { const s = document.querySelector('#stage'); if (s) s.click(); });
    await wait(160);
  }
  await wait(600);
}
await mem('推进剧情后');

/* 反复开关手机（最容易积 DOM 的地方） */
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    const u = window.__ZBNX.ui;
    u._mintStack = [];
    u._renderPhoneHome();
  });
  await wait(400);
  await page.evaluate(() => {
    const u = window.__ZBNX.ui;
    u._phoneApp('campus', '校园通');
  });
  await wait(400);
}
await mem('反复开手机后');

/* 反复切换场景背景（图片缓存容易涨） */
for (let i = 0; i < 12; i++) {
  await page.evaluate((n) => {
    const st = window.__ZBNX.stage;
    st.setBackground('bg_classroom');
    st.setBackground('bg_gate');
    st.setBackground('bg_street_night');
  }, i);
  await wait(280);
}
await wait(600);
await mem('反复切背景后');

/* 反复开关各种面板 */
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => {
    const u = window.__ZBNX.ui;
    u.openChangelog(); u.closePanel();
    u.openMaterials(); u.closePanel();
    u.openCharacters(); u.closePanel();
  });
  await wait(300);
}
await wait(600);
await mem('反复开关面板后');

const out = { at: new Date().toISOString() };
const fin = await page.evaluate(() => ({ nodes: document.getElementsByTagName('*').length }));
out.finalNodes = fin.nodes;
fs.writeFileSync(path.join(ROOT, 'build', '_mem.json'), JSON.stringify(out, null, 2));

await browser.close();
console.log('\n最终 DOM 节点：' + fin.nodes);
