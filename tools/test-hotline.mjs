/* 12345 通话面板的退出路径测试
   直接从章节数据里抠出 hotline 节点配置，丢给 ui.openHotline 跑一遍，
   看"挂断"能不能正常关掉面板、把结果回调出去。
   （全章节卡死探测里 ch5/side2 都在这个面板停下，需要确认是面板本身卡住，
     还是探测器不认识某些按钮。） */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(800);
await page.evaluate(() => document.querySelector('[data-act="new"]')?.click());
await sleep(400);
await page.evaluate(() => document.querySelector('#disclaimerOk')?.click());
await sleep(400);

/* 找 hotline 节点 */
const found = await page.evaluate(() => {
  const scan = (nodes, where) => {
    for (const n of nodes || []) if (n && n.t === 'hotline') return { cfg: n, where };
    return null;
  };
  for (const [cid, ch] of Object.entries(window.__ZBNX.chapters)) {
    let r = scan(ch.nodes, cid + ':nodes');
    if (r) return r;
    for (const a of ch.hubActions || []) {
      r = scan(a.script, cid + ':hub:' + a.id);
      if (r) return r;
    }
  }
  return null;
});
if (!found) { console.log('没找到 hotline 节点'); await browser.close(); process.exit(1); }
console.log('hotline 节点位置:', found.where, ' steps:', found.cfg.steps.length);

/* 跑面板 */
await page.evaluate((cfg) => {
  window.__hotResult = 'pending';
  window.__ZBNX.ui.openHotline(cfg, (res) => { window.__hotResult = JSON.stringify(res); });
}, found.cfg);

await sleep(1500);

let clicks = 0, lastKind = '';
const trace = [];
for (let i = 0; i < 120; i++) {
  const st = await page.evaluate(() => {
    const panelOpen = !document.querySelector('#panelLayer').hidden;
    const btns = [...document.querySelectorAll('#hotFoot button')].map(b => ({
      cls: b.className, text: b.textContent.trim().slice(0, 14), disabled: b.disabled
    }));
    return { panelOpen, btns, result: window.__hotResult, msgs: document.querySelectorAll('#hotBody .hot-msg').length };
  });
  trace.push({ i, open: st.panelOpen, n: st.btns.length, nMsg: st.msgs, btn: st.btns[0]?.text || '' });
  if (!st.panelOpen) { console.log('面板已关闭，回调结果:', st.result); break; }
  if (!st.btns.length) { console.log('!! 没有可用按钮，卡住。最近轨迹:'); console.log(trace.slice(-8)); break; }
  const b = st.btns.find(x => !x.disabled);
  if (!b) { console.log('!! 按钮全部 disabled，卡住'); break; }
  const kind = b.cls.includes('hot-opt') ? 'opt' : 'btn';
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('#hotFoot button')].find(x => !x.disabled);
    if (el) el.click();
  });
  clicks++; lastKind = kind;
  await sleep(90);
}

const fin = await page.evaluate(() => ({
  result: window.__hotResult,
  panelHidden: document.querySelector('#panelLayer').hidden,
  footHTML: document.querySelector('#hotFoot').innerHTML.slice(0, 200),
  msgs: document.querySelectorAll('#hotBody .hot-msg').length,
  locked: window.__ZBNX.ui._lockClose,
  done: window.__ZBNX.ui._govDone
}));
console.log('点击次数:', clicks, ' 最后类型:', lastKind);
console.log('结束状态:', JSON.stringify(fin, null, 1));
console.log('JS 错误:', errors.length ? errors : '(none)');
await browser.close();
