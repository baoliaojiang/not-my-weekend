/* =========================================================
   卡死探针：把每一章自动点一遍，找出「怎么点都没反应」的位置
   ---------------------------------------------------------
   判定：连续 STALL 次操作后，帧游标（key + i）和章节 index 都没有变化，
        并且场上没有任何面板 / 选项 / 调查中枢 / 对话在等输入。
   用法：node tools/test-stuck.mjs [章节id...]
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const PORT = 5199;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const CHAPTERS = args.length ? args : ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'side1', 'side2', 'side3', 'side4', 'side5'];
const STALL = 26;
/* 面板里"正在打字/正在播一段对话"的时候，帧游标是不动的——
   这段时间属于正常等待，不能判定成卡死。
   聊天回合一播就是好几秒，所以面板/打字状态下把耐心放大。 */
const STALL_WAIT = 260;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--no-sandbox', '--mute-audio']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await sleep(500);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await page.evaluate(() => { document.querySelector('#disclaimerOk')?.click(); window.__ZBNX.settings.textSpeed = 'instant'; });
await sleep(600);

const probe = () => page.evaluate(() => {
  const NX = window.__ZBNX;
  const f = NX.engine.frames[NX.engine.frames.length - 1] || {};
  return {
    key: f.key || 'main',
    i: f.i,
    index: NX.state.index,
    blocked: NX.engine.blocked,
    typing: NX.engine.typing,
    panel: !document.querySelector('#panelLayer').hidden,
    panelTitle: document.querySelector('#panelTitle')?.textContent || '',
    choice: !document.querySelector('#choiceLayer').hidden,
    hub: !document.querySelector('#hubLayer').hidden,
    dlg: !document.querySelector('#dialogue').hidden,
    summary: !!document.querySelector('#sumNext'),
    text: (document.querySelector('#dlgText')?.textContent || '').slice(0, 60),
    ui: (() => { const u = NX.ui; return {
      phoneThread: u._phoneThread || null, phoneCb: !!u._phoneOnClose,
      lock: !!u._lockClose, panelCb: !!u._panelOnClose,
      replyNodes: document.querySelectorAll('.wx-reply [data-reply]').length,
      phoneDone: !!document.querySelector('#phoneDone'),
      bodyHead: (document.querySelector('#panelBody')?.textContent || '').replace(/\s+/g,' ').slice(-80)
    }; })()
  };
});

async function act() {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const p = q('#panelLayer');
    if (!p.hidden) {
      // 课堂小测：先把每题都选上，再交卷
      if (q('#qzSubmit')) {
        document.querySelectorAll('.qz-opt').forEach(b => { if (!b.classList.contains('on')) b.click(); });
        const s = q('#qzSubmit');
        if (s && !s.disabled) { s.click(); return 'quiz-submit'; }
        return 'quiz-answer';
      }
      if (q('#qzNext')) { q('#qzNext').click(); return 'quiz-next'; }
      if (q('#matTake')) { q('#matTake').click(); return 'mat-take'; }
      // 手机口袋版：看完了要按「放下手机」，否则剧情停在 phone 节点
      if (q('#phoneDone')) { q('#phoneDone').click(); return 'phone-done'; }
      if (q('#chatContinueBtn')) { q('#chatContinueBtn').click(); return 'chat-continue'; }
      const rep = q('.wx-reply [data-reply]');
      if (rep) { rep.click(); return 'chat-reply'; }
      // 政务进度页的正规出口是「我已看过」
      if (q('#gvOk')) { q('#gvOk').click(); return 'gov-ok'; }
      if (q('#sumNext')) { q('#sumNext').click(); return 'summary-next'; }
      const hotBtn = q('#hotFoot .hot-btn');
      if (hotBtn) {
        if (hotBtn.disabled) return 'hot-wait';   // 还在"接通中"，等计时器
        hotBtn.click(); return 'hot-continue';
      }
      const hotOpt = q('#hotFoot .hot-opt') || q('.hot-opt');
      if (hotOpt) { hotOpt.click(); return 'hot-opt'; }
      if (q('#gvSubmit')) { q('#panelClose').click(); return 'gov-close'; }
      if (q('#gvProgress')) { q('#gvBack')?.click() || q('#gvOk')?.click(); return 'gov-back'; }
      // 手机停在会话列表：点第一个会话进去
      const thread = q('#panelBody [data-thread]');
      if (thread) { thread.click(); return 'phone-thread'; }
      const close = q('#panelClose');
      if (close && getComputedStyle(close).visibility !== 'hidden') { close.click(); return 'panel-close'; }
      // 锁定的面板（等玩家回复）：直接点遮罩，等同"看完了"
      p.click();
      return 'panel-mask';
    }
    if (!q('#choiceLayer').hidden) { q('#choiceBox .choice-item')?.click(); return 'choice'; }
    if (!q('#hubLayer').hidden) {
      const a = q('.hub-card:not(.done):not([disabled])') || q('.hub-card');
      if (a) { a.click(); return 'hub-card'; }
      const leave = q('#hubLeave');
      if (leave) { leave.click(); return 'hub-leave'; }
      return 'hub-stuck';
    }
    const d = q('#dialogue');
    if (d && !d.hidden) { d.click(); return 'dialogue'; }
    q('#stage')?.click();
    return 'stage';
  });
}

let bad = 0;
for (const ch of CHAPTERS) {
  await page.evaluate((id) => window.__ZBNX.go(id), ch);
  await sleep(700);
  let last = null, stall = 0, steps = 0, lastAct = '';
  let done = false;
  const seen = [];
  for (let k = 0; k < 3200; k++) {
    const s = await probe();
    const sig = `${s.key}:${s.i}:${s.index}:${s.panel}:${s.choice}:${s.hub}`;
    if (sig === last) stall++; else { stall = 0; last = sig; }
    if (s.panel && (s.panelTitle === '本局结局' || s.panelTitle === '章节总结')) {
      console.log(`  ${ch} 跑完（${s.panelTitle}）`);
      done = true;
      break;
    }
    const lim = (s.panel || s.typing || s.hub) ? STALL_WAIT : STALL;
    if (stall >= lim) {
      console.log(`\n✗ ${ch} 卡住：${s.key}:${s.i}（index=${s.index}） blocked=${s.blocked} typing=${s.typing}`);
      console.log(`   面板=${s.panel}「${s.panelTitle}」 选项=${s.choice} 中枢=${s.hub} 对话=${s.dlg}`);
      console.log(`   最后动作=${lastAct} 正文=「${s.text}」`);
      console.log('   UI:', JSON.stringify(s.ui));
      console.log(`   最近动作: ${seen.slice(-8).join(' → ')}`);
      bad++;
      break;
    }
    const a = await act();
    if (a === 'hot-wait') { await sleep(420); stall = 0; continue; }
    lastAct = a;
    seen.push(a);
    if (seen.length > 40) seen.shift();
    if (a === 'panel-stuck' || a === 'hub-stuck') {
      console.log(`\n✗ ${ch} 面板/中枢无可用按钮：${s.panelTitle}（${a}）`);
      bad++;
      break;
    }
    steps++;
    await sleep(28);
  }
  if (!done) console.log(`  ${ch} 推进 ${steps} 步`);
}

console.log('\nJS 错误:', errors.length ? errors.slice(0, 5).join('\n') : '(none)');
console.log(`\n结果：${bad ? `发现 ${bad} 处卡死` : '未发现卡死'}`);
await browser.close();
process.exit(0);
