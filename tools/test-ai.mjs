/* =========================================================
   AI 接入层测试
   ---------------------------------------------------------
   起一个「OpenAI 兼容」的模拟服务（跨域，带 CORS 头），
   在真实浏览器里跑 AIManager，验证：
     · /models 拉取与排序
     · 三步诊断（配置 / 模型列表 / 对话）
     · 旧模型名自动迁移（deepseek-chat → deepseek-flash）
     · 401 / 400 Model Not Exist 的可读报错
     · 思考模式：开启时正文为空 → 明确报错；关闭时不带思考
     · Base URL 只写主机名时自动补 /v1
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra ? '→ ' + extra : ''); }
};

/* ---------------- 模拟接口服务 ---------------- */
const seen = [];   // 记录收到的请求体，用来断言参数
const CHAT_MODELS = ['deepseek-flash', 'deepseek-pro'];
const api = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
  if (req.method === 'OPTIONS') { res.writeHead(200, cors); return res.end(); }
  const url = new URL(req.url, 'http://x');
  const auth = req.headers.authorization || '';
  const keyOk = auth === 'Bearer sk-good';

  if (url.pathname === '/v1/models' && req.method === 'GET') {
    if (!keyOk) { res.writeHead(401, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Authentication Fails' } })); }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [
      { id: 'text-embedding-3-small' }, { id: 'deepseek-flash' }, { id: 'deepseek-pro' }, { id: 'whisper-1' }
    ] }));
  }

  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) { /* ignore */ }
      seen.push(body);
      if (!keyOk) {
        res.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Authentication Fails, Your api key is invalid' } }));
      }
      if (!CHAT_MODELS.includes(body.model)) {
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: `Model Not Exist: ${body.model}`, type: 'invalid_request_error' } }));
      }
      const thinkingOn = body.thinking && body.thinking.type === 'enabled';
      // 模拟“思考吃光 max_tokens”：开了思考且额度小，正文为空
      const starved = thinkingOn && Number(body.max_tokens) < 600;
      const content = starved ? '' : '在的';
      if (body.stream) {
        res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
    });
    return;
  }
  res.writeHead(404, cors); res.end('not found');
});

/* ---------------- 静态服务 ---------------- */
const web = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const listen = (s) => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const apiPort = await listen(api);
const webPort = await listen(web);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(`http://127.0.0.1:${webPort}/index.html`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 600));

const setAI = (cfg) => page.evaluate((cfg) => {
  const NX = window.__ZBNX;
  NX.settings.ai = Object.assign({ preset: 'custom', baseUrl: '', apiKey: '', model: '', thinking: 'off', temperature: 0.6, maxTokens: 420 }, cfg);
  NX.ui.ai.setSettings(NX.settings);
  NX.ui.ai.history = [];
}, cfg);

const apiBase = `http://127.0.0.1:${apiPort}/v1`;

console.log('\n[1] 拉取模型列表');
await setAI({ baseUrl: apiBase, apiKey: 'sk-good', model: 'deepseek-flash' });
let r = await page.evaluate(() => window.__ZBNX.ui.ai.listModels());
ok('/models 成功', r.ok === true, r.error || '');
ok('返回 4 个模型', r.models.length === 4, JSON.stringify(r.models));
ok('对话模型排在 embedding 前', r.models[0] === 'deepseek-flash', JSON.stringify(r.models));
ok('包含 deepseek-flash', r.models.includes('deepseek-flash'));

console.log('\n[2] 三步诊断（全通）');
r = await page.evaluate(() => window.__ZBNX.ui.ai.diagnose());
ok('整体 ok', r.ok === true, JSON.stringify(r.steps && r.steps.map(s => s.name + ':' + s.ok)));
ok('三步齐全', r.steps.length === 3, String(r.steps.length));
ok('三步全过', r.steps.every(s => s.ok), JSON.stringify(r.steps.filter(s => !s.ok)));
ok('第 3 步拿到正文「在的」', /在的/.test(r.steps[2].detail), r.steps[2].detail);

console.log('\n[3] 旧模型名自动迁移');
const mig = await page.evaluate(() => {
  const NX = window.__ZBNX;
  NX.settings.ai.model = 'deepseek-chat';
  NX.ui.ai.setSettings(NX.settings);
  const e = NX.ui.ai.effective();
  return { model: e.model, upgraded: NX.ui.ai.modelUpgraded };
});
ok('deepseek-chat → deepseek-flash', mig.model === 'deepseek-flash', mig.model);
ok('记录了迁移信息', mig.upgraded && mig.upgraded.from === 'deepseek-chat');

console.log('\n[4] 只写主机名时自动补 /v1');
const v1 = await page.evaluate((base) => {
  const NX = window.__ZBNX;
  NX.settings.ai.baseUrl = base;
  NX.ui.ai.setSettings(NX.settings);
  return NX.ui.ai.effective().baseUrl;
}, `http://127.0.0.1:${apiPort}`);
ok('末尾补成 /v1', /\/v1$/.test(v1), v1);
r = await page.evaluate(() => window.__ZBNX.ui.ai.listModels());
ok('补完能拉到模型', r.ok === true, r.error || '');

console.log('\n[5] Key 错误 → 可读的 401');
await setAI({ baseUrl: apiBase, apiKey: 'sk-bad', model: 'deepseek-flash' });
r = await page.evaluate(() => window.__ZBNX.ui.ai.diagnose());
ok('诊断失败', r.ok === false);
ok('第 2 步报 401', /401/.test(r.steps[1].detail), r.steps[1].detail);
ok('第 3 步报鉴权失败', /鉴权失败|401/.test(r.steps[2].detail), r.steps[2].detail);

console.log('\n[6] 模型名不存在 → 可读的 400');
await setAI({ baseUrl: apiBase, apiKey: 'sk-good', model: 'deepseek-v9-ultra' });
r = await page.evaluate(() => window.__ZBNX.ui.ai.diagnose());
const chatStep = r.steps[2] || {};
ok('诊断失败', r.ok === false);
ok('错误里点明模型不可用', /模型不可用|Model Not Exist/.test(chatStep.detail || ''), chatStep.detail);
ok('给出换模型的修复建议', /拉取/.test(chatStep.fix || ''), chatStep.fix);

console.log('\n[7] 思考模式');
seen.length = 0;
await setAI({ baseUrl: apiBase, apiKey: 'sk-good', model: 'deepseek-flash', thinking: 'on' });
r = await page.evaluate(() => window.__ZBNX.ui.ai.diagnose());
const onBody = seen.find(b => b.messages);
ok('开启时请求带 thinking.enabled', !!(onBody && onBody.thinking && onBody.thinking.type === 'enabled'), JSON.stringify(onBody && onBody.thinking));
ok('正文为空时给出明确报错', r.ok === false && /正文为空/.test(r.steps[2].detail || ''), r.steps[2] && r.steps[2].detail);

seen.length = 0;
await setAI({ baseUrl: apiBase, apiKey: 'sk-good', model: 'deepseek-flash', thinking: 'off' });
r = await page.evaluate(() => window.__ZBNX.ui.ai.diagnose());
const offBody = seen.find(b => b.messages);
ok('关闭时请求带 thinking.disabled', !!(offBody && offBody.thinking && offBody.thinking.type === 'disabled'), JSON.stringify(offBody && offBody.thinking));
ok('关闭时 max_tokens 提到 512 以上', Number(offBody.max_tokens) >= 512, String(offBody.max_tokens));
ok('关闭思考后诊断通过', r.ok === true, JSON.stringify(r.steps[2]));

console.log('\n[8] 流式成文（教育局答复路径）');
await setAI({ baseUrl: apiBase, apiKey: 'sk-good', model: 'deepseek-flash', thinking: 'off' });
const streamed = await page.evaluate(() => window.__ZBNX.ui.ai.compose('你是教育局', '写一份答复', { onDelta: () => {} }));
ok('流式返回正文', streamed === '在的', streamed);

console.log('\n[9] 设置面板 UI：拉取模型 + 诊断渲染');
await setAI({ baseUrl: apiBase, apiKey: 'sk-good', model: 'deepseek-chat' });
await page.evaluate(() => { window.__ZBNX.ui.openSettings(); window.__ZBNX.ui.openAISettings(); });
await new Promise(r => setTimeout(r, 400));
const modelValAfterOpen = await page.$eval('#aiModel', el => el.value);
ok('打开设置时旧模型名被就地改掉', modelValAfterOpen === 'deepseek-flash', modelValAfterOpen);

await page.click('#aiFetchModels');
await new Promise(r => setTimeout(r, 900));
const selInfo = await page.evaluate(() => {
  const sel = document.querySelector('#aiModelList');
  return { hidden: sel.hidden, count: sel.options.length, first: sel.options[0] && sel.options[0].value };
});
ok('下拉列表出现', selInfo.hidden === false);
ok('下拉里有 4 个模型', selInfo.count === 4, String(selInfo.count));
ok('第一个是对话模型', selInfo.first === 'deepseek-flash', selInfo.first);

// 选中第二个模型，确认能写回输入框
await page.evaluate(() => {
  const sel = document.querySelector('#aiModelList');
  sel.value = 'deepseek-pro';
  sel.dispatchEvent(new Event('change'));
});
const picked = await page.$eval('#aiModel', el => el.value);
ok('下拉选择写回模型输入框', picked === 'deepseek-pro', picked);

await page.click('#aiTest');
await page.waitForSelector('#aiDiag .ai-diag-row', { timeout: 15000 });
await new Promise(r => setTimeout(r, 500));
const diag = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#aiDiag .ai-diag-row')];
  return {
    count: rows.length,
    okCount: rows.filter(r => r.classList.contains('ok')).length,
    texts: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)),
    sum: (document.querySelector('#aiDiag .ai-diag-sum') || {}).textContent || ''
  };
});
ok('渲染出 3 行诊断', diag.count === 3, String(diag.count));
ok('3 行全部通过', diag.okCount === 3, JSON.stringify(diag.texts));
ok('底部有通过结论', /全部通过/.test(diag.sum), diag.sum);
await page.screenshot({ path: path.join(ROOT, 'tools/shots/ai-diag.png') });

console.log('\n[10] 页面无脚本错误');
ok('无 pageerror', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
api.close(); web.close();

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
