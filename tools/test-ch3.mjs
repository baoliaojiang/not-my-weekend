/* 第三章「正式反映」路线：验证 govform 能真的填、真的提交、真的拿到受理号 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';

const OUT = 'D:/workbuddy/2026-10-23-16-33-10/tools/shots/ch3gov';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errors = [];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 810 });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:5199/index.html', { waitUntil: 'networkidle2' });
await sleep(600);
await page.evaluate(() => document.querySelector('[data-act="new"]').click());
await sleep(250);
await page.evaluate(() => document.querySelector('#disclaimerOk').click());
await sleep(900);

// 直接跳到第三章
await page.evaluate(() => window.__ZBNX.go('ch3'));
await sleep(800);

// 直接跳到「正式反映」这一支的起点，绕开前面的材料面板
const jumped = await page.evaluate(() => {
  const e = window.__ZBNX.engine;
  const idx = e.findLabel('route_formal');
  if (idx == null || !e.frames.length) return 'no-label';
  const f = e.frames[e.frames.length - 1];
  f.i = idx;
  e.run();
  return 'ok:' + idx;
});
console.log('跳转 route_formal:', jumped);
await sleep(400);

const stateOf = () => page.evaluate(() => {
  const vis = (id) => { const e = document.querySelector(id); return e && !e.hidden; };
  if (vis('#hubLayer')) return 'hub';
  if (vis('#choiceLayer')) return 'choice';
  if (vis('#panelLayer')) return 'panel';
  return 'dlg';
});

let hit = null;
const trace = [];
for (let i = 0; i < 400; i++) {
  const s = await stateOf();
  if (trace[trace.length - 1] !== s) trace.push(s);
  if (s === 'hub') {
    await page.evaluate(() => document.querySelector('#hubLeave').click());
    await sleep(500);
    continue;
  }
  if (s === 'choice') {
    const label = await page.evaluate(() => {
      const b = document.querySelector('#choiceBox .choice-item');
      const t = b ? b.textContent.trim() : '';
      if (b) b.click();
      return t;
    });
    hit = label;
    await sleep(600);
    if (/正式|交上去/.test(label)) continue;
    continue;
  }
  if (s === 'panel') {
    const isForm = await page.evaluate(() => !!document.querySelector('#govForm'));
    if (isForm) break;
    await page.evaluate(() => {
      const close = document.querySelector('#panelClose');
      if (close && close.offsetParent !== null) { close.click(); return; }
      const btn = document.querySelector('.panel-foot button');
      if (btn) { btn.click(); return; }
      window.__ZBNX.ui.closePanel();
    });
    await sleep(320);
    continue;
  }
  await page.evaluate(() => {
    const d = document.querySelector('#dialogue');
    if (d && !d.hidden) d.click(); else document.querySelector('#stage').click();
  });
  await sleep(90);
}
console.log('选择过的选项（最后一次）:', hit);
console.log('状态轨迹:', trace.join(' -> '));
await page.screenshot({ path: `${OUT}/01-form.png` });

const hasForm = await page.evaluate(() => !!document.querySelector('#govForm'));
console.log('表单已打开:', hasForm);

if (hasForm) {
  const filled = await page.evaluate(() => {
    // 选一个类型
    const chip = document.querySelector('#gvType .gov-chip');
    if (chip) chip.click();
    const desc = document.querySelector('#gvDesc');
    desc.value = '学校要求学生在周日到校参加所谓的学业支持活动，由班主任在班会上逐人核对，未交回执的学生被单独叫去办公室说明原因。年级组还要求各班上报未参加学生名单。这与通知里写的自愿参加不一致。';
    desc.dispatchEvent(new Event('input', { bubbles: true }));
    const amt = document.querySelector('#gvAmount');
    if (amt) { amt.value = '0'; amt.dispatchEvent(new Event('input', { bubbles: true })); }
    const p = document.querySelector('#gvPromise');
    p.checked = true; p.dispatchEvent(new Event('change', { bubbles: true }));
    // 算术验证码
    const q = document.querySelector('#gvCodeQ').textContent.trim();
    const m = q.match(/(\d+)\s*\+\s*(\d+)/);
    const ans = m ? String(+m[1] + +m[2]) : '';
    const code = document.querySelector('#gvCode');
    code.value = ans; code.dispatchEvent(new Event('input', { bubbles: true }));
    return { q, ans, len: desc.value.length };
  });
  console.log('填写完成:', JSON.stringify(filled));
  await page.screenshot({ path: `${OUT}/02-filled.png` });

  await page.evaluate(() => document.querySelector('#gvSubmit').click());
  await sleep(900);
  await page.screenshot({ path: `${OUT}/03-receipt.png` });

  const gov = await page.evaluate(() => window.__ZBNX.state.gov);
  console.log('state.gov =', JSON.stringify(gov, null, 2));

  // 点「查看办理进度」
  const hasProg = await page.evaluate(() => !!document.querySelector('#gvProgress'));
  console.log('有受理回执页:', hasProg);
  if (hasProg) {
    await page.evaluate(() => document.querySelector('#gvProgress').click());
    await sleep(700);
    await page.screenshot({ path: `${OUT}/04-progress.png` });
    console.log('进度页节点数:', await page.evaluate(() => document.querySelectorAll('.gov-node').length));
    await page.evaluate(() => document.querySelector('#gvOk')?.click());
    await sleep(500);
  }
  // 继续推进几屏，确认回到剧情
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const d = document.querySelector('#dialogue');
      if (d && !d.hidden) d.click(); else document.querySelector('#stage').click();
    });
    await sleep(120);
  }
  await page.screenshot({ path: `${OUT}/05-after.png` });
  console.log('回到剧情后仍在:', await stateOf(), '当前 flag knows_12345 =',
    await page.evaluate(() => !!(window.__ZBNX.state.flags || {}).knows_12345));
  const gov2 = await page.evaluate(() => window.__ZBNX.state.gov);
  console.log('走完全部页面后的 state.gov =', JSON.stringify(gov2, null, 2));
}

console.log('\n--- errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
