/* 把网页打包成「可直接用 file:// 打开」的静态站点：ES Module 合并为单个传统脚本 */
import * as esbuild from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const OUT = path.join(ROOT, 'build/www');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1) 打包脚本
await esbuild.build({
  entryPoints: [path.join(ROOT, 'scripts/main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome100'],
  outfile: path.join(OUT, 'bundle.js'),
  charset: 'utf8',
  minify: false,
  legalComments: 'none'
});

// 2) 复制样式与素材
const copy = (from, to) => {
  const src = path.join(ROOT, from);
  const dst = path.join(OUT, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
};
copy('styles', 'styles');
copy('assets', 'assets');

// 应用图标（桌面版窗口图标用）
const icon = path.join(ROOT, 'build/icon-512.png');
if (fs.existsSync(icon)) {
  fs.copyFileSync(icon, path.join(OUT, 'assets/app-icon.png'));
}

// 3) 改写 index.html：模块脚本 → 传统脚本
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(
  /<script type="module" src="scripts\/main\.js"><\/script>/,
  '<script src="bundle.js"></script>'
);
html = html.replace('<html lang="zh-CN">', '<html lang="zh-CN" class="standalone">');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// 4) 离线环境提示（file:// 下 localStorage 可能不可用）
const patch = `
/* 打包版补丁：file:// 环境下给出存档提示 */
(function () {
  try { localStorage.setItem('__probe', '1'); localStorage.removeItem('__probe'); }
  catch (e) {
    console.warn('[周日不返校] 当前环境无法写入本地存档，进度只在本次运行内有效。');
  }
})();
`;
fs.appendFileSync(path.join(OUT, 'bundle.js'), patch);

const size = fs.readdirSync(OUT, { recursive: true })
  .map(f => path.join(OUT, String(f)))
  .filter(f => fs.statSync(f).isFile())
  .reduce((a, f) => a + fs.statSync(f).size, 0);

console.log('www 输出：', OUT);
console.log('文件数：', fs.readdirSync(OUT, { recursive: true }).length, '体积：', (size / 1048576).toFixed(1), 'MB');
