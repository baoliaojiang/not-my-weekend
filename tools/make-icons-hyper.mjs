/* 用 Material Symbols Rounded（Google 官方图标库，OFL 授权）里的字形，
   配一层统一的「圆角方 + 渐变」底板，生成桌面图标。
   底板只是一层渐变，不再是手画的具体形状；图形本身来自真实图标库，
   所以薄聊/校园通/便笺/相册…… 不会各画各的。

   用法：node tools/make-icons-hyper.mjs
*/
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GLYPH_DIR = path.join(ROOT, 'build/_icons/package/rounded');
const OUT = path.join(ROOT, 'assets/icons/hyperos');

/* name: 输出文件名；glyph: Material Symbols 里的图标名；c1/c2: 底板渐变 */
const APPS = [
  { name: 'phone',     glyph: 'chat_bubble-fill',    c1: '#4AD295', c2: '#12A05F' }, // 薄聊
  { name: 'campus',    glyph: 'school-fill',         c1: '#63A8FF', c2: '#2F6BE4' }, // 校园通
  { name: 'mats',      glyph: 'sticky_note_2-fill',  c1: '#FFCB5C', c2: '#F09819' }, // 便笺
  { name: 'gallery',   glyph: 'photo_library-fill',  c1: '#C98CF0', c2: '#7B48D6' }, // 相册
  { name: 'chain',     glyph: 'list_alt-fill',       c1: '#4ED0D8', c2: '#188C9E' }, // 接龙
  { name: 'calc',      glyph: 'calculate-fill',      c1: '#8E99A8', c2: '#4E5866' }, // 计算器
  { name: 'browser',   glyph: 'public-fill',         c1: '#6FB8FF', c2: '#2563EB' }, // 浏览器
  { name: 'people',    glyph: 'group-fill',       c1: '#7FA8E8', c2: '#3D63C9' }, // 通讯录
  { name: 'timeline',  glyph: 'calendar_month-fill', c1: '#7BD389', c2: '#2E9E52' }, // 进度
  { name: 'save',      glyph: 'folder-fill',         c1: '#F2C36B', c2: '#C8871B' }, // 存档
  { name: 'settings',  glyph: 'settings-fill',       c1: '#A6AFBE', c2: '#5C6675' }, // 设置
  { name: 'changelog', glyph: 'system_update_alt-fill',  c1: '#A78BFA', c2: '#6D3CE8' }, // 更新
  { name: 'about',     glyph: 'info-fill',           c1: '#6ED0F5', c2: '#1E93C4' }, // 关于
  { name: 'play',      glyph: 'play_arrow-fill',     c1: '#5FD08A', c2: '#1F9B54' }, // 开始游戏
  { name: 'continue',  glyph: 'play_circle-fill',    c1: '#8FA7FF', c2: '#4356C8' }, // 继续游戏
  { name: 'side',      glyph: 'alt_route-fill',      c1: '#FFB36B', c2: '#D9701C' }, // 支线
  { name: 'govhub',    glyph: 'account_balance-fill', c1: '#94A8C4', c2: '#4A5F86' } // 政务（保留，浏览器里做快捷入口）
];

/* Material Symbols 的 viewBox 是 0 -960 960 960（y 轴向上为负），
   放进 512 的方盘里要自己算缩放和位移，占盘面 46%。 */
function gTransform(frac = 0.46) {
  const s = (512 * frac) / 960;
  const tx = 256 - 480 * s;
  const ty = 256 + 480 * s;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`;
}

function readGlyph(name) {
  const f = path.join(GLYPH_DIR, name + '.svg');
  if (!fs.existsSync(f)) throw new Error('缺图标：' + name);
  let s = fs.readFileSync(f, 'utf8');
  // 去掉外层 <svg ...> 只留 path，便于统一装进自己的 svg
  const inner = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return inner;
}

// 超椭圆（squircle）：澎湃/小米的图标底盘就是这种「方中带圆」
function squircle(cx, cy, r, n = 4.2, steps = 240) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    const x = cx + r * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n);
    const y = cy + r * Math.sign(st) * Math.pow(Math.abs(st), 2 / n);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}

const body = APPS.map((a, i) => {
  const g = readGlyph(a.glyph);
  const id = `g${i}`;
  return `<div class="tile" id="${a.name}" style="--c1:${a.c1};--c2:${a.c2}">
    <svg viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <linearGradient id="b${i}" x1="0" y1="0" x2="0.65" y2="1">
          <stop offset="0" stop-color="${a.c1}"/><stop offset="1" stop-color="${a.c2}"/>
        </linearGradient>
        <linearGradient id="h${i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
          <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${squircle(256, 256, 244)}" fill="url(#b${i})"/>
      <path d="${squircle(256, 256, 244)}" fill="url(#h${i})"/>
      <path d="${squircle(256, 256, 243)}" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="2"/>
      <g transform="${gTransform()}" fill="#fff" fill-opacity="0.96">${g}</g>
    </svg>
  </div>`;
}).join('\n');

const html = `<!doctype html><meta charset="utf-8">
<style>
  body{margin:0;background:transparent;}
  .tile{width:512px;height:512px;display:block;background:transparent}
  svg{display:block;filter:drop-shadow(0 6px 18px rgba(0,0,0,.18));}
</style>${body}`;

fs.writeFileSync(path.join(ROOT, 'build/_icons/sheet.html'), html);

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 560, height: 560, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto('file:///' + path.join(ROOT, 'build/_icons/sheet.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 400));

fs.mkdirSync(OUT, { recursive: true });
for (const a of APPS) {
  const el = await p.$('#' + a.name);
  await el.screenshot({ path: path.join(OUT, a.name + '.png'), omitBackground: true });
  console.log('✓', a.name, a.glyph);
}
await b.close();
