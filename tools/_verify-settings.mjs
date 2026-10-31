import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const b = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--allow-file-access-from-files', '--mute-audio']
});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console:' + m.text()); });
const wait = ms => new Promise(r => setTimeout(r, ms));

await p.setViewport({ width: 1280, height: 860 });
await p.goto('file:///D:/workbuddy/2026-10-23-16-33-10/index.html', { waitUntil: 'networkidle2' });
await wait(900);

await p.evaluate(() => document.querySelector('[data-act="settings"]').click());
await wait(500);
await p.screenshot({ path: 'build/_set-01-top.png' });

// 字号：滑块 → 变量 & 试读
const before = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dlg-scale'));
await p.evaluate(() => {
  const r = document.querySelector('#dlgScaleRange');
  r.value = '135';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(250);
const after = await p.evaluate(() => ({
  scale: getComputedStyle(document.documentElement).getPropertyValue('--dlg-scale'),
  pvFont: getComputedStyle(document.querySelector('#pvText')).fontSize,
  num: document.querySelector('#dlgScaleNum').value
}));
console.log('scale:', before.trim(), '->', JSON.stringify(after));

// 试读
await p.evaluate(() => document.querySelector('#pvPlay').click());
await wait(260);
const typed = await p.evaluate(() => document.querySelector('#pvText').textContent);
console.log('typing preview len:', typed.length);

// 预设
await p.evaluate(() => document.querySelector('[data-preset="agnes"]').click());
await wait(200);
const preset = await p.evaluate(() => ({
  base: document.querySelector('#aiBase').value,
  model: document.querySelector('#aiModel').value,
  msg: document.querySelector('#aiTestMsg').textContent
}));
console.log('preset agnes:', JSON.stringify(preset));

// Key 明文
const keyType = await p.evaluate(() => document.querySelector('#aiKey').type);
console.log('apikey input type:', keyType);

// 帮助折叠
const helpCount = await p.evaluate(() => document.querySelectorAll('details.ai-help').length);
console.log('help blocks:', helpCount);
await p.evaluate(() => { const d = document.querySelectorAll('details.ai-help')[0]; if (d) d.open = true; });
await wait(300);
await p.evaluate(() => { const bd = document.querySelector('.panel-body'); bd.scrollTop = 900; });
await wait(300);
await p.screenshot({ path: 'build/_set-02-help.png' });

await p.evaluate(() => { const bd = document.querySelector('.panel-body'); bd.scrollTop = bd.scrollHeight; });
await wait(300);
await p.screenshot({ path: 'build/_set-03-bottom.png' });

// 恢复默认 → 确认框
await p.evaluate(() => document.querySelector('#resetSettings').click());
await wait(400);
const cfm = await p.evaluate(() => !!document.querySelector('#confirmMask'));
await p.screenshot({ path: 'build/_set-04-confirm.png' });
await p.evaluate(() => { const c = document.querySelector('[data-cfm="cancel"]'); c && c.click(); });
await wait(300);
console.log('confirm shown:', cfm);

// 竖屏下的设置
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await wait(600);
await p.evaluate(() => { const c = document.querySelector('#panelClose'); c && c.click(); });
await wait(300);
await p.evaluate(() => document.querySelector('[data-act="settings"]').click());
await wait(500);
await p.screenshot({ path: 'build/_set-05-portrait.png' });
const pr = await p.evaluate(() => ({
  cls: document.body.className,
  panelH: Math.round(document.querySelector('.panel').getBoundingClientRect().height),
  vh: innerHeight
}));
console.log('portrait:', JSON.stringify(pr));
console.log('errors:', errs.length ? errs : '(none)');
await b.close();
