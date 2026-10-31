/* =========================================================
   把 Windows 便携版 zip 切成 GitHub 能收的分卷，并生成合并脚本
   ---------------------------------------------------------
   GitHub Release 单个附件上限 100MB，便携版整包远超这个数，只能分卷。

   两个坑，都在这里解决：
   1) 附件名必须用 ASCII。GitHub 上传时会把非 ASCII 文件名压成 slug
      （「不属于我的周末-v0.6.4.0-win.zip.00」变成「-v0.6.4.0-win.zip.00」，
      「合并.bat」直接变成「default.bat」），bat 里写死的中文名就对不上，
      copy 找不到文件。所以统一用 NotMyWeekend-<版本>-win.zip.NN。
   2) bat 不能手写。以前是手抄一份，版本号停在旧版，下载下来照着旧名字
      找分卷，必然合并不上。现在按实际分卷生成。

   用法：node tools/split-win.mjs <zip 路径> [输出目录]
   ========================================================= */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) {
  console.error('用法：node tools/split-win.mjs <zip 路径> [输出目录]');
  process.exit(1);
}
const ROOT = process.cwd();
const OUT = process.argv[3] || join(ROOT, 'dist', 'win');
const CHUNK = 90 * 1024 * 1024;          // 90MiB

const cfg = await import(pathToFileURL(join(ROOT, 'scripts/config/game.js')).href);
const VER = cfg.CONFIG.version;
const ZIP_NAME = `NotMyWeekend-${VER}-win.zip`;
const BAT_NAME = 'merge.bat';

/* 旧分卷清理：只删本目录里的分卷与合并脚本，不碰别的东西 */
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) {
  if (/\.zip\.\d\d$/.test(f) || f === 'merge.bat' || f === '合并.bat') rmSync(join(OUT, f), { force: true });
}

const buf = readFileSync(SRC);
const n = Math.ceil(buf.length / CHUNK);
const parts = [];
for (let i = 0; i < n; i++) {
  const name = `${ZIP_NAME}.${String(i).padStart(2, '0')}`;
  writeFileSync(join(OUT, name), buf.subarray(i * CHUNK, (i + 1) * CHUNK));
  parts.push(name);
}

/* 合并脚本：copy /b 按顺序拼接。用 %~dp0 定位自身目录，
   用户双击时不会因为「当前目录」不对而找不到分卷。
   文件名全是 ASCII，不需要切代码页，也不会被安全软件当成中文脚本拦。 */
const bat = [
  '@echo off',
  'cd /d "%~dp0"',
  `echo Merging ${n} part(s)...`,
  `copy /b ${parts.map(p => `"${p}"`).join('+')} "${ZIP_NAME}" >nul`,
  'if exist "' + ZIP_NAME + '" (',
  `  echo Done: ${ZIP_NAME}`,
  '  echo Right-click the zip and choose "Extract All", then run the exe inside.',
  ') else (',
  '  echo Failed: put this bat in the same folder as the .zip.00 files.',
  ')',
  'pause',
  ''
].join('\r\n');
writeFileSync(join(OUT, BAT_NAME), bat, 'utf8');

const sha = createHash('sha256').update(buf).digest('hex');
console.log(`原包 ${basename(SRC)}  ${(buf.length / 1048576).toFixed(1)} MB`);
parts.forEach((p, i) => {
  const size = (i < n - 1 ? CHUNK : buf.length - i * CHUNK) / 1048576;
  console.log(`  ${p}  ${size.toFixed(1)} MB`);
});
console.log(`  ${BAT_NAME}  ${n} 段`);
console.log(`sha256 ${sha}`);
