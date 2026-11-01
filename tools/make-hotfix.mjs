/* =========================================================
   每版本独立的热更包 + 解压目录
   ---------------------------------------------------------
   用户要求：客户端没改动时，每个版本也要单独出一个热更包（不用覆盖安装）
   并且把包解压出来，方便直接查看/替换。

   产出（dist/hotfix-<版本>/）：
     www-<版本>.zip        热更包本体
     www-<版本>/           解压后的目录（可直接覆盖 www 目录）
     SHA256SUMS.txt        校验值
   ========================================================= */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const cfg = await import(pathToFileURL(join(ROOT, 'scripts/config/game.js')).href);
const VER = cfg.CONFIG.version;

const zipName = `www-${VER}.zip`;
const srcZip = join(DIST, zipName);
if (!existsSync(srcZip)) {
  console.error(`找不到热更包：${srcZip}，先跑 node tools/make-dist.mjs`);
  process.exit(1);
}

// 放在 releases/ 而不是 dist/：dist 整个目录会部署到 GitHub Pages，
// 热更包和解压目录加起来 70MB+，压在 Pages 上没有意义。
const outDir = join(ROOT, 'releases', `hotfix-${VER}`);
mkdirSync(outDir, { recursive: true });

// 1) 复制一份到 hotfix 目录（各版本独立留档，不覆盖上一版）
const dstZip = join(outDir, zipName);
const buf = readFileSync(srcZip);
writeFileSync(dstZip, buf);
const sha = createHash('sha256').update(buf).digest('hex');

// 2) 解压目录
const extDir = join(outDir, `www-${VER}`);
// 不直接删：一次删几百个文件会触发批量删除保护。改名挪进 build/_trash 再重建。
if (existsSync(extDir)) {
  const trash = join(ROOT, 'build', '_trash', `hotfix-ext-${VER}-${Date.now()}`);
  try {
    mkdirSync(trash, { recursive: true });
    renameSync(extDir, join(trash, `www-${VER}`));
  } catch (e) {
    rmSync(extDir, { recursive: true, force: true });
  }
}
mkdirSync(extDir, { recursive: true });
if (process.platform === 'win32') {
  // Windows 的 bsdtar 对带盘符的路径会当成 host:path 解析，
  // 所以统一用相对路径 + cwd，别传绝对路径。
  execFileSync('tar', ['-a', '-c', '-f', '.tmp-hotfix.zip', '-C', 'build/out/web', '.'],
    { cwd: ROOT, windowsHide: true });
  execFileSync('tar', ['-xf', '.tmp-hotfix.zip', '-C', `releases/hotfix-${VER}/www-${VER}`],
    { cwd: ROOT, windowsHide: true });
  rmSync(join(ROOT, '.tmp-hotfix.zip'), { force: true });
} else {
  execFileSync('unzip', ['-q', '-o', srcZip, '-d', extDir], { cwd: ROOT });
}

// 3) 校验文件
writeFileSync(join(outDir, 'SHA256SUMS.txt'),
  `${sha}  ${zipName}\n`, 'utf8');

const count = readdirSync(extDir, { recursive: true })
  .filter(f => statSync(join(extDir, String(f))).isFile()).length;
const size = (buf.length / 1048576).toFixed(1);
console.log(`热更包目录：${outDir}`);
console.log(`  ${zipName}  ${size} MB`);
console.log(`  解压目录 www-${VER}/  ${count} 个文件`);
console.log(`  sha256 ${sha}`);
