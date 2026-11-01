/* 校园通补全页面的功能验证 */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd(); const WWW = path.join(ROOT, 'build', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(WWW, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(8091, '127.0.0.1', r));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(x => fs.existsSync(x));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await b.newPage(); await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
await page.goto('http://127.0.0.1:8091/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' }); await wait(900);
await page.evaluate(() => document.querySelector('[data-act="new"]')?.click()); await wait(700);
await page.evaluate(() => document.querySelector('#disclaimerOk')?.click()); await wait(900);
for (let i = 0; i < 14; i++) {
  const done = await page.evaluate(() => { const bs = document.querySelector('#bootSeq'); if (!bs) return true; const btn = document.querySelector('#bootSkip'); if (btn && !btn.hidden) { btn.click(); return false; } bs.remove(); return true; });
  if (done) break; await wait(500);
}
await wait(1000);
await page.evaluate(() => { window.__toasts = []; const o = window.__ZBNX.ui.toast.bind(window.__ZBNX.ui); window.__ZBNX.ui.toast = (m, d) => { window.__toasts.push(String(m)); return o(m, d); }; });

const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

await page.evaluate(() => document.querySelector('#btnPhone')?.click()); await wait(800);
await page.evaluate(() => window.__ZBNX.ui._phoneApp('campus', '校园通')); await wait(700);

// 入口：五个都在
const entries = await page.evaluate(() => [...document.querySelectorAll('[data-cp]')].map(e => e.dataset.cp));
console.log('校园通入口:', entries.join(', '));
['notice', 'service', 'score', 'leave', 'timetable', 'attend', 'afterschool'].forEach(id => check(entries.includes(id), `缺少入口 ${id}`));

// 成绩查询
await page.evaluate(() => document.querySelector('[data-cp="score"]').click()); await wait(700);
let txt = await page.evaluate(() => document.querySelector('#panelBody').textContent);
check(/612/.test(txt), '成绩查询应显示总分');
check(/月考|期中/.test(txt), '成绩查询应显示考试名称');
await page.evaluate(() => document.querySelector('[data-score]')?.click()); await wait(700);
txt = await page.evaluate(() => document.querySelector('#panelBody').textContent);
check(/语文/.test(txt) && /物理/.test(txt), '成绩单应列出各科');
check(await page.evaluate(() => !!document.querySelector('#cpsdAppeal')), '成绩单应有复核按钮');
await page.evaluate(() => { window.__toasts = []; document.querySelector('#cpsdAppeal').click(); }); await wait(500);
check((await page.evaluate(() => window.__toasts)).some(t => /复核/.test(t)), '复核按钮应给出反馈');
const backToCampus = async () => {
  await page.evaluate(() => { const u = window.__ZBNX.ui; u._mintStack = []; u._mintPush(u._lastCampusHTML || '', '校园通'); });
};
// 直接重建校园通首页（栈层数不可靠，干脆重新渲染）
await page.evaluate(() => {
  const u = window.__ZBNX.ui;
  u._mintStack = [];
  u._renderPhoneHome();
});
await wait(600);
await page.evaluate(() => window.__ZBNX.ui._phoneApp('campus', '校园通')); await wait(700);

// 请假
await page.evaluate(() => document.querySelector('[data-cp="leave"]').click()); await wait(700);
check(await page.evaluate(() => !!document.querySelector('#cplSubmit')), '请假应有提交按钮');
await page.evaluate(() => { window.__toasts = []; document.querySelector('#cplSubmit').click(); }); await wait(500);
check((await page.evaluate(() => window.__toasts)).some(t => /家长|知情/.test(t)), '未勾选家长同意应拦截');
await page.evaluate(() => { document.querySelector('#cplBody').value = '去医院复查'; document.querySelector('#cplParent').checked = true; document.querySelector('#cplSubmit').click(); }); await wait(600);
txt = await page.evaluate(() => document.querySelector('#panelBody').textContent);
check(/请假已提交/.test(txt), '请假应提交成功并给出回执');
check(/待班主任审批/.test(txt), '回执应显示审批状态');

await page.evaluate(() => { const u = window.__ZBNX.ui; u._mintStack = []; u._renderPhoneHome(); }); await wait(600);
await page.evaluate(() => window.__ZBNX.ui._phoneApp('campus', '校园通')); await wait(700);
// 我的课表
await page.evaluate(() => document.querySelector('[data-cp="timetable"]').click()); await wait(700);
txt = await page.evaluate(() => document.querySelector('#panelBody').textContent);
check(/周一/.test(txt) && /课后服务/.test(txt), '课表应含星期与课后服务');
check(await page.evaluate(() => document.querySelectorAll('.cpt-cell').length >= 25), '课表格子数不足');

await page.evaluate(() => { const u = window.__ZBNX.ui; u._mintStack = []; u._renderPhoneHome(); }); await wait(600);
await page.evaluate(() => window.__ZBNX.ui._phoneApp('campus', '校园通')); await wait(700);
// 我的课后服务
await page.evaluate(() => document.querySelector('[data-cp="afterschool"]').click()); await wait(700);
txt = await page.evaluate(() => document.querySelector('#panelBody').textContent);
check(/已报名/.test(txt), '课后服务应显示报名状态');
check(/自愿/.test(txt), '课后服务应说明自愿原则');

await page.evaluate(() => { const u = window.__ZBNX.ui; u._mintStack = []; u._renderPhoneHome(); }); await wait(600);
await page.evaluate(() => window.__ZBNX.ui._phoneApp('campus', '校园通')); await wait(700);
// 我的考勤
await page.evaluate(() => document.querySelector('[data-cp="attend"]').click()); await wait(700);
txt = await page.evaluate(() => document.querySelector('#panelBody').textContent);
check(/签到/.test(txt), '考勤应有签到记录');

console.log('\n结果：', fail.length ? 'FAIL\n - ' + fail.join('\n - ') : '全部通过');
await b.close(); server.close();
process.exit(fail.length ? 1 : 0);
