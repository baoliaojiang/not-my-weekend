/* =========================================================
   把 Windows 便携版 zip 切成 GitHub 能收的分卷，并生成合并脚本
   ---------------------------------------------------------
   GitHub Release 单个附件上限 100MB，便携版整包远超这个数，只能分卷。
   分卷用 90MiB（留出余量），命名 <原名>.zip.00 / .01 / …
   同时写一份 合并.bat —— 以前这份 bat 是手写的，版本号经常忘了改，
   下载下来照着旧版本号去找文件，合并直接失败。现在按实际分卷生成。

   用法：node tools/split-win.mjs <zip 路径> [输出目录]
   ========================================================= */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) {
  console.error('用法：node tools/split-win.mjs <zip 路径> [输出目录]');
  process.exit(1);
}
const OUT = process.argv[3] || join(process.cwd(), 'dist', 'win');
const CHUNK = 90 * 1024 * 1024;          // 90MiB
const ZIP_NAME = basename(SRC);

/* 旧分卷清理：只删本目录里同前缀的分卷，不碰别的东西 */
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) {
  if (/\.zip\.\d\d$/.test(f) || f === '合并.bat') rmSync(join(OUT, f), { force: true });
}

const buf = readFileSync(SRC);
const n = Math.ceil(buf.length / CHUNK);
const parts = [];
for (let i = 0; i < n; i++) {
  const name = `${ZIP_NAME}.${String(i).padStart(2, '0')}`;
  writeFileSync(join(OUT, name), buf.subarray(i * CHUNK, (i + 1) * CHUNK));
  parts.push(name);
}

/* 合并脚本：copy /b 按顺序拼接。文件名带中文，所以先切 UTF-8 代码页。
   用 %~dp0 定位自身目录，用户双击时不会因为「当前目录」不对而找不到分卷。 */
const bat = [
  '@echo off',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  `echo 正在合并分卷（共 ${n} 段）...`,
  `copy /b ${parts.map(p => `"${p}"`).join('+')} "${ZIP_NAME}" >nul`,
  'if exist "' + ZIP_NAME + '" (',
  `  echo 合并完成：${ZIP_NAME}`,
  '  echo 右键该 zip 选「全部解压」，运行里面的 exe 即可。',
  ') else (',
  '  echo 合并失败，请确认分卷文件都在同一目录。',
  ')',
  'pause',
  ''
].join('\r\n');
writeFileSync(join(OUT, '合并.bat'), bat, 'utf8');

const sha = createHash('sha256').update(buf).digest('hex');
console.log(`原包 ${ZIP_NAME}  ${(buf.length / 1048576).toFixed(1)} MB`);
parts.forEach((p, i) => {
  const size = (i < n - 1 ? CHUNK : buf.length - i * CHUNK) / 1048576;
  console.log(`  ${p}  ${size.toFixed(1)} MB`);
});
console.log(`  合并.bat  ${n} 段`);
console.log(`sha256 ${sha}`);
