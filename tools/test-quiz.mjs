/* 课堂小测（quiz）流程测试：
   跑第一章，推进到数学 quiz → 逐题作答 → 验证批改页、state.quizzes、flag、
   "再做一次"是否可用、继续后能否回到剧情。 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = 'tools/shots/quiz';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 800 });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });

await p.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(400);
await p.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(200);
await p.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(600);

await p.evaluate(() => window.__ZBNX.go('ch1'));
await sleep(900);

let quizShown = false;
let answered = 0;
for (let i = 0; i < 600; i++) {
  const s = await p.evaluate(() => {
    const panel = document.querySelector('#panelLayer');
    if (panel && !panel.hidden) {
      if (document.querySelector('.quiz')) return 'quiz';
      // 新手材料面板：要点「收下」
      const take = document.querySelector('#matTake');
      if (take) { take.click(); return 'mat'; }
      // 手机会话里的回复选项 / 继续按钮要真的点掉，否则面板锁着关不上
      const rep = document.querySelector('.wx-reply [data-reply]');
      if (rep) { rep.click(); return 'reply'; }
      const cont = document.querySelector('#chatContinueBtn');
      if (cont) { cont.click(); return 'continue'; }
      const close = document.querySelector('#panelClose');
      if (close && getComputedStyle(close).visibility !== 'hidden') {
        close.click();
        return 'panel';
      }
      return 'panel-locked';
    }
    if (!document.querySelector('#choiceLayer').hidden) {
      const b = document.querySelector('#choiceBox .choice-item');
      if (b) b.click();
      return 'choice';
    }
    if (!document.querySelector('#hubLayer')?.hidden) return 'hub';
    const dlg = document.querySelector('#dialogue');
    if (dlg && !dlg.hidden) { dlg.click(); return 'dlg'; }
    document.querySelector('#stage').click();
    return 'stage';
  });
  if (s === 'reply' || s === 'continue') answered++;
  if (s === 'quiz') { quizShown = true; break; }
  if (s === 'hub') break;
  if (s === 'panel-locked') {
    // 可能在等「正在输入」，等一会儿再看
    await sleep(400);
    const again = await p.evaluate(() => {
      const rep = document.querySelector('.wx-reply [data-reply]');
      if (rep) { rep.click(); return 'reply'; }
      const cont = document.querySelector('#chatContinueBtn');
      if (cont) { cont.click(); return 'continue'; }
      return 'still-locked';
    });
    if (again === 'still-locked') { console.log('面板锁死，无法推进'); break; }
    answered++;
  }  await sleep(50);
}
console.log('quiz 出现 =', quizShown, ' 聊天交互次数 =', answered);

if (quizShown) {
  await p.screenshot({ path: `${OUT}/01-quiz.png` });
  console.log('题目数 =', await p.evaluate(() => document.querySelectorAll('.qz').length));

  // 第一轮：只答第一题就点交卷 → 应被禁用
  await p.evaluate(() => document.querySelector('.qz-opt')?.click());
  await sleep(150);
  console.log('只答 1 题时交卷 disabled =',
    await p.evaluate(() => document.querySelector('#qzSubmit').disabled));

  // 全部选 A
  await p.evaluate(() => {
    document.querySelectorAll('.qz').forEach(qEl => {
      const first = qEl.querySelector('.qz-opt[data-o="0"]');
      if (first) first.click();
    });
  });
  await sleep(200);
  await p.evaluate(() => document.querySelector('#qzSubmit').click());
  await sleep(500);
  await p.screenshot({ path: `${OUT}/02-result.png` });
  console.log('交卷后（未点继续）quizzes =', await p.evaluate(() => JSON.stringify(window.__ZBNX.state.quizzes)),
    ' flag did_stat_quiz =', await p.evaluate(() => !!(window.__ZBNX.state.flags || {}).did_stat_quiz));

  // 再做一次：全部选最后一个选项
  const can = await p.evaluate(() => {
    const r = document.querySelector('#qzRetry');
    if (!r) return false;
    r.click();
    return true;
  });
  console.log('可以做"再做一次" =', can);
  await sleep(400);
  await p.evaluate(() => {
    document.querySelectorAll('.qz').forEach(qEl => {
      const bs = qEl.querySelectorAll('.qz-opt');
      if (bs.length) bs[bs.length - 1].click();
    });
  });
  await sleep(200);
  await p.evaluate(() => document.querySelector('#qzSubmit').click());
  await sleep(500);
  await p.screenshot({ path: `${OUT}/03-retry.png` });

  // 继续 → 回剧情，此时才写 state.quizzes
  await p.evaluate(() => document.querySelector('#qzOk')?.click());
  await sleep(600);
  console.log('第二轮 quizzes =', await p.evaluate(() => JSON.stringify(window.__ZBNX.state.quizzes)),
    ' flag did_stat_quiz =', await p.evaluate(() => !!(window.__ZBNX.state.flags || {}).did_stat_quiz));
  console.log('继续后面板关闭 =', await p.evaluate(() => document.querySelector('#panelLayer').hidden));
  console.log('回到剧情后 index =', await p.evaluate(() => window.__ZBNX.state.index));
}

await b.close();
console.log('DONE');
