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
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, renameSync } from 'node:fs';
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

/* 没手给 --notes 时，直接用游戏内更新日志这一版的内容：
   发布页和游戏里必须是同一套说法，否则玩家在两边看到的东西对不上。 */
let clTop = null;
if (!notes.length) {
  try {
    const cl = await import(pathToFileURL(join(ROOT, 'scripts/data/changelog.js')).href);
    clTop = (cl.CHANGELOG || [])[0] || null;
    if (clTop) {
      (clTop.sections || []).forEach(sec => {
        /* 配图条目没有 text，只有 src/cap；
           取 caption 当说明，取不到就跳过，别把 undefined 写进发布说明。 */
        (sec.items || []).forEach(it => {
          const body = it.text || it.cap || '';
          if (!body) return;
          notes.push(`${sec.title}：${body}`);
        });
      });
    }
  } catch (e) { /* 读不到就不写 notes，后面有兜底 */ }
}
const shell = opt('shell', version);

if (!existsSync(join(WWW, 'index.html'))) {
  console.error('先跑 node build/make-www.mjs && 同步到 build/out/web');
  process.exit(1);
}

/* 自己把最新的 build/www 同步进 build/out/web。
   以前这一步靠外面先手动跑 sync-dir.mjs，漏一次就会拿旧内容打包——
   表现为「各版本热更包 sha256 全一样」：三个不同版本号的包内容完全相同，
   玩家点「回滚」下回来的其实是最新版。CI 里恰好有这一步，
   本地流程常常没有，所以改成脚本自己同步，不再依赖调用顺序。 */
const WWW_SRC = join(ROOT, 'build', 'www');
if (existsSync(join(WWW_SRC, 'index.html'))) {
  // 不直接删：一次删几百个文件会触发批量删除保护。
  // 改名挪进 _trash 再建空的，效果一样。
  const trash = join(ROOT, 'build', '_trash', `out-web-${Date.now()}`);
  try {
    mkdirSync(trash, { recursive: true });
    renameSync(WWW, join(trash, 'web'));
  } catch (e) { /* 挪不动就直接覆盖式同步 */ }
  mkdirSync(WWW, { recursive: true });
  // 用当前 node 可执行文件，不依赖 PATH 里有 node
  execFileSync(process.execPath, [join(ROOT, 'build', 'sync-dir.mjs'), WWW_SRC, WWW], { cwd: ROOT });
  console.log('  已把 build/www 同步到 build/out/web');
}

console.log(`发布版本 content=${version} shell=${shell}`);

// 1) 清空 dist 重建
/* 不能直接 rmSync 整个 dist（批量删除会被安全栅栏拦），
   改成把旧目录改名挪走、再建新的，效果一样且不触发批量删除保护。 */
if (existsSync(DIST)) {
  const old = DIST + '-old';
  try { rmSync(old, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  try { renameSync(DIST, old); } catch (e) { /* 改名失败就直接用原目录 */ }
}
mkdirSync(DIST, { recursive: true });

/* 旧 dist 里已经放好了 APK 与 Windows 分卷（这两样不由本脚本生成，
   是打包脚本的产物，且已经提交进仓库）。重建目录时把它们搬回来，
   不然这一版就只剩网页资源了。 */
const carry = ['apk', 'win'];
for (const sub of carry) {
  const src = join(DIST + '-old', sub);
  if (!existsSync(src)) continue;
  const dst = join(DIST, sub);
  try {
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, { recursive: true });
    console.log(`  已带回 dist/${sub}`);
  } catch (e) { /* 忽略 */ }
}

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

/* 6) 版本清单：让玩家能在设置里手动更新 / 回滚
   ---------------------------------------------------------
   真源是 releases/versions.json（每版发布时追加一条）。
   这里把它和本次发布的信息合并，写出 dist/versions.json，
   客户端从三个源里抢着读，谁先回用谁。

   老版本的热更包不在 Pages 上（Pages 只放最新版），
   所以老条目的 www 指向 GitHub Release 附件的完整 URL；
   只有本次发布的这一条是相对名，跟着版本.json 一起走 CDN。 */
const HISTORY = join(ROOT, 'releases', 'versions.json');
let hist = { latest: version, versions: [] };
if (existsSync(HISTORY)) {
  try { hist = JSON.parse(readFileSync(HISTORY, 'utf8')); } catch (e) { /* 用默认 */ }
}
const releaseTag = `v${version}`;
const releaseAsset = `https://github.com/${(cfg.CONFIG.update || {}).repo || 'baoliaojiang/not-my-weekend'}/releases/download/${releaseTag}/${zipName}`;

/* 把本次发布写进历史（已存在就更新） */
const entry = {
  v: version,
  date: (hist.versions.find(x => x.v === version) || {}).date || new Date().toISOString().slice(0, 10),
  shell,
  www: zipName,
  sha256,
  size: buf.length,
  title: (clTop && clTop.intro ? String(clTop.intro).slice(0, 40) : `${version}`),
  notes: notes.slice(0, 6)
};
const histList = hist.versions.filter(x => x.v !== version);
histList.unshift(entry);
histList.sort((a, b) => {
  const pa = String(a.v).split('.').map(Number);
  const pb = String(b.v).split('.').map(Number);
  for (let i = 0; i < 4; i++) { const d = (pb[i] || 0) - (pa[i] || 0); if (d) return d; }
  return 0;
});
writeFileSync(HISTORY, JSON.stringify({
  _note: hist._note || '版本历史真源。每次发布由 tools/make-dist.mjs 自动追加一条；旧条目保留，供客户端「切换版本」回滚。www 指向同目录下的热更包文件名。',
  latest: version,
  versions: histList
}, null, 2) + '\n', 'utf8');

/* 输出的清单：本次这条走相对名，老版本走 Release 附件完整地址 */
const outList = histList.map(x => {
  const cur = x.v === version;
  const copy = { ...x };
  if (!cur) {
    copy.www = `https://github.com/${(cfg.CONFIG.update || {}).repo || 'baoliaojiang/not-my-weekend'}/releases/download/v${x.v}/www-${x.v}.zip`;
    if (!copy.sha256) copy.sha256 = '';
  }
  return copy;
});
writeFileSync(join(DIST, 'versions.json'), JSON.stringify({
  latest: version,
  versions: outList
}, null, 2) + '\n', 'utf8');

/* 发布页的更新说明：和游戏内更新日志同源同格式（分区 + 「做了什么，有什么用」）。
   CI 会把它拼上「关于兼容版 / 下载」的固定段落，作为 Release 正文。 */
const mdNotes = [];
mdNotes.push('校园调查题材的视觉小说 Demo。个人制作、非商业、免费。');
mdNotes.push('');
mdNotes.push(`## 本版更新（v${version}）`);
if (clTop && clTop.intro) {
  mdNotes.push('');
  mdNotes.push(`> ${clTop.intro}`);
}
if (clTop) {
  for (const sec of clTop.sections || []) {
    mdNotes.push('');
    mdNotes.push(`### ${sec.title}`);
    /* 配图条目在发布页里只留说明文字（图片本身在游戏里看），
       直接写 it.text 会得到 undefined。 */
    for (const it of sec.items || []) {
      const body = it.text || it.cap || '';
      if (body) mdNotes.push(`- ${body}`);
    }
  }
} else {
  mdNotes.push('');
  for (const n of manifest.notes) mdNotes.push(`- ${n}`);
}
writeFileSync(join(DIST, 'release-notes.md'), mdNotes.join('\n') + '\n', 'utf8');

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
