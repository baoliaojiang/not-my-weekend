/* 真实流程里跑一遍 ch5 的 12345 通话（走中枢行动，不是在空页面上单测）
   目的：确认"打完电话之后剧情会不会继续"，以及卡住时到底是哪一层挡着。 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 820 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(700);
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'networkidle2' });
await sleep(600);
await page.evaluate(() => document.querySelector('[data-act="new"]')?.click());
await sleep(300);
await page.evaluate(() => document.querySelector('#disclaimerOk')?.click());
await sleep(300);

const info = await page.evaluate(() => {
  const ch = window.__ZBNX.chapters.ch5;
  const hubIdx = ch.nodes.findIndex(n => n.t === 'hub');
  const hi = ch.hubActions.findIndex(a => a.id === 'hotline');
  return { hubIdx, hi, total: ch.nodes.length, ids: ch.hubActions.map(a => a.id) };
});
console.log('ch5 hub 节点 index:', info.hubIdx, ' hotline 行动序号:', info.hi);
console.log('行动列表:', JSON.stringify(info.ids));

/* 跳到 hub 节点 */
await page.evaluate((idx) => {
  const ch = window.__ZBNX.chapters.ch5;
  window.__ZBNX.state.ap = 9;
  window.__ZBNX.engine.loadChapter(ch, idx);
}, info.hubIdx);
await sleep(900);

const hub = await page.evaluate(() => ({
  open: !document.querySelector('#hubLayer').hidden,
  ap: window.__ZBNX.state.ap,
  blocked: window.__ZBNX.engine.blocked,
  nCards: document.querySelectorAll('#hubGrid .hub-card').length,
  cards: [...document.querySelectorAll('#hubGrid .hub-card')].map(b => b.textContent.trim().replace(/\s+/g, ' ').slice(0, 24))
}));
console.log('中枢已开:', hub.open, ' 卡片:', JSON.stringify(hub.cards));

/* 点「打一个 12345」 */
await page.evaluate(() => {
  const card = [...document.querySelectorAll('#hubLayer .hub-card')]
    .find(b => /12345/.test(b.textContent));
  if (card) card.click();
});
await sleep(1600);

let clicks = 0;
const trace = [];
let sawHot = false;
let stall = 0;
for (let i = 0; i < 400; i++) {
  const st = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const vis = el => el && !el.hidden && el.offsetParent !== null;
    const footBtns = [...document.querySelectorAll('#hotFoot button')].map(b => ({ t: b.textContent.trim(), d: b.disabled }));
    return {
      panel: !q('#panelLayer').hidden,
      panelTitle: q('#panelTitle')?.textContent || '',
      hot: footBtns,
      mat: vis(q('#matTake')),
      chat: vis(q('#chatContinueBtn')),
      choice: !q('#choiceLayer').hidden,
      hub: !q('#hubLayer').hidden,
      dlgHidden: q('#dialogue')?.hidden,
      dlgText: (q('#dialogueText')?.textContent || '').slice(0, 20),
      blocked: window.__ZBNX.engine.blocked,
      idx: window.__ZBNX.state.index,
      frame: window.__ZBNX.engine.frame()?.key || ''
    };
  });
  if (st.panel && /通话/.test(st.panelTitle)) sawHot = true;
  trace.push({ i, panel: st.panel, title: st.panelTitle, blocked: st.blocked, idx: st.idx, btn: st.hot[0]?.t || '', dlg: st.dlgText.slice(0, 10) });

  let acted = '';
  if (st.mat) { await page.evaluate(() => document.querySelector('#matTake').click()); acted = 'mat'; }
  else if (st.chat) { await page.evaluate(() => document.querySelector('#chatContinueBtn').click()); acted = 'chat'; }
  else if (st.choice) { console.log('   (走到选项，停止)'); break; }
  else if (st.hub) { console.log('   (回到中枢，停在行动结束后)'); break; }
  else if (st.panel && st.hot.length) {
    const can = st.hot.find(b => !b.d);
    if (!can) { await sleep(450); acted = 'wait'; }
    if (can) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('#hotFoot button')].find(x => !x.disabled);
        if (b) b.click();
      });
      acted = 'hot:' + can.t;
    }
  }
  else if (st.panel) {
    await page.evaluate(() => document.querySelector('#panelClose')?.click());
    acted = 'panel-close';
  }
  else if (st.dlgHidden === false) { await page.evaluate(() => document.querySelector('#dialogue')?.click()); acted = 'dlg'; }
  else { await page.evaluate(() => document.querySelector('#stage')?.click()); acted = 'stage'; }

  if (!acted) { if (++stall >= 3) { console.log('!! 无可用操作，卡住'); break; } }
  else { stall = 0; clicks++; }
  await sleep(110);
}
console.log('跑到过通话面板:', sawHot);

const fin = await page.evaluate(() => {
  const q = s => document.querySelector(s);
  return {
    panel: !q('#panelLayer').hidden,
    panelTitle: q('#panelTitle')?.textContent || '',
    hotFoot: q('#hotFoot')?.innerHTML.replace(/\s+/g, ' ').slice(0, 160) || '',
    hotMsgs: document.querySelectorAll('#hotBody .hot-msg').length,
    blocked: window.__ZBNX.engine.blocked,
    idx: window.__ZBNX.state.index,
    dlg: (q('#dialogueText')?.textContent || '').slice(0, 40),
    matOpen: !!(q('#matTake') && q('#matTake').offsetParent),
    frameKey: window.__ZBNX.engine.frame()?.key || '',
    frameI: window.__ZBNX.engine.frame()?.i,
    nodeType: (() => { const f = window.__ZBNX.engine.frame(); const n = f && f.nodes[f.i]; return n ? n.t + ':' + (n.id || n.text || '').slice(0, 20) : ''; })(),
    nodesAround: (() => { const f = window.__ZBNX.engine.frame(); if (!f) return []; return f.nodes.slice(Math.max(0, f.i - 2), f.i + 3).map(n => n.t + '|' + String(n.id || n.text || n.label || '').slice(0, 18)); })(),
    chatOpen: !document.querySelector('#chatPanel')?.hidden,
    flags: Object.keys(window.__ZBNX.state.flags || {}).filter(k => k.startsWith('hot_')),
    mats: (window.__ZBNX.state.materials || []).length
  };
});
console.log('点击次数:', clicks);
console.log('结束状态:', JSON.stringify(fin, null, 1));
console.log('最后 6 步:', JSON.stringify(trace.slice(-6)));
console.log('JS 错误:', errors.length ? errors : '(none)');
await browser.close();
