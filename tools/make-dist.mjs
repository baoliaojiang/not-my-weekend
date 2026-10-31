/* =========================================================
   生成发布包：dist/version.json + dist/www-<版本>.zip
   ---------------------------------------------------------
   产物结构（dist/ 整个推上 GitHub 即可，Pages 和热更都读它）：
     dist/index.html          网页版入口（= build/out/web 的内容）
     dist/assets/...          网页版资源
     dist/version.json        版本清单（含 content / shell / shellMin / sha256）
     dist/www-0.6.0.zip       热更包（内容同上，供 APK / EXE 下载）

   版本号来源：scripts/config/game.js 的 CONFIG.version —— 单一真源，
   不再各处手改。外壳版本默认与之一致；如果这次只改了网页资源、
   没动 Java/Electron，可以只升 content 而不升 shell。

   用法：
     node tools/make-dist.mjs                 # 常规发布
     node tools/make-dist.mjs --shell 0.6.0   # 指定外壳版本
     node tools/make-dist.mjs --notes "修了什么" --notes "还改了什么"
   ========================================================= */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const WWW = join(ROOT, 'build', 'out', 'web');

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const notes = [];
args.forEach((a, i) => { if (a === '--notes' && args[i + 1]) notes.push(args[i + 1]); });

// 版本单一真源
const cfg = await import(pathToFileURL(join(ROOT, 'scripts/config/game.js')).href);
const version = cfg.CONFIG.version;
const shell = opt('shell', version);

if (!existsSync(join(WWW, 'index.html'))) {
  console.error('先跑 node build/make-www.mjs && 同步到 build/out/web');
  process.exit(1);
}

console.log(`发布版本 content=${version} shell=${shell}`);

// 1) 清空 dist 重建
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 2) 网页版 = dist 根目录
cpSync(WWW, DIST, { recursive: true });
console.log('  网页版文件已就位');

// 3) 热更包：把 www 目录打成 zip（条目相对根，不含顶层 www/ 前缀）
const zipName = `www-${version}.zip`;
const zipPath = join(DIST, zipName);
const tmpZip = join(ROOT, '.tmp-www.zip');
rmSync(tmpZip, { force: true });
/* 打 zip：两个平台做法不一样，别写成一种。
     Windows：系统自带 tar(bsdtar)，加 -a 按扩展名决定格式，能直接写 zip。
     Linux/macOS：GNU tar 不支持写 zip，改用 zip 命令（CI 里先 apt-get install zip）。
   注意不要传带盘符的绝对路径给 tar —— 它会当 host:path 去解析远程主机，
   报 "Cannot connect to D:"。所以统一 cwd 到项目根、用相对路径 + -C。 */
rmSync(tmpZip, { force: true });
if (process.platform === 'win32') {
  execFileSync('tar', ['-a', '-c', '-f', '.tmp-www.zip', '-C', 'build/out/web', '.'],
    { cwd: ROOT, windowsHide: true });
} else {
  execFileSync('zip', ['-r', '-q', tmpZip, '.'], { cwd: WWW });
}
cpSync(tmpZip, zipPath);
rmSync(tmpZip, { force: true });

// 4) sha256
const buf = readFileSync(zipPath);
const sha256 = createHash('sha256').update(buf).digest('hex');

// 5) version.json
const manifest = {
  content: version,
  shell,
  shellMin: opt('shellMin', shell),
  www: `${opt('base', './')}${zipName}`.replace(/([^:])\/\//, '$1/'),
  sha256,
  size: buf.length,
  notes: notes.length ? notes : [
    `${version}：网页资源更新`
  ],
  releasedAt: new Date().toISOString()
};
writeFileSync(join(DIST, 'version.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// 6) 报告
const count = (d) => readdirSync(d, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? count(join(d, e.name)) : 1), 0);
const size = (d) => readdirSync(d, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0);

console.log(`  dist 文件 ${count(DIST)} 个，${(size(DIST) / 1048576).toFixed(1)} MB`);
console.log(`  热更包 ${zipName}  ${(buf.length / 1048576).toFixed(1)} MB`);
console.log(`  sha256 ${sha256.slice(0, 16)}…`);
console.log('\nversion.json:');
console.log(JSON.stringify(manifest, null, 2));
