import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, p === '/' ? '/index.html' : p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 360, isMobile: true, hasTouch: true });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => { document.querySelector('[data-act="new"]').click(); });
await new Promise(r => setTimeout(r, 200));
await page.evaluate(() => { document.querySelector('#disclaimerOk').click(); });
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => window.__ZBNX.ui.showChoices('测试', [{ text: '选项 A' }, { text: '选项 B' }], () => {}));
await new Promise(r => setTimeout(r, 400));

const info = await page.evaluate(() => {
  const layer = document.querySelector('#choiceLayer');
  const box = document.querySelector('#choiceBox');
  const cs = getComputedStyle(box);
  const lcs = getComputedStyle(layer);
  return {
    layerRect: layer.getBoundingClientRect().toJSON(),
    boxRect: box.getBoundingClientRect().toJSON(),
    boxStyle: { display: cs.display, height: cs.height, margin: cs.margin, alignSelf: cs.alignSelf, flex: cs.flex, maxHeight: cs.maxHeight, overflow: cs.overflow },
    layerStyle: { display: lcs.display, alignItems: lcs.alignItems, padding: lcs.padding, height: lcs.height },
    innerHTML: box.innerHTML.slice(0, 120)
  };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: ROOT + '/tools/shots-regress/dbg-choice.png' });
await browser.close();
server.close();
