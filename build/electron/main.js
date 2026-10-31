const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const https = require('node:https');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const os = require('node:os');
const { execFile } = require('node:child_process');

// 启动诊断：只有设了 ZB_LOG=<文件路径> 才会写，正常游玩不产生任何文件
const BOOT_LOG = process.env.ZB_LOG;
const boot = (m) => {
  if (!BOOT_LOG) return;
  try { fs.appendFileSync(BOOT_LOG, `${new Date().toISOString().slice(11, 19)} ${m}\n`); } catch (e) { /* ignore */ }
};
boot('main.js loaded');

/* =========================================================
   随程序发布的是加密包 www.pkg，不是明文目录。
   ---------------------------------------------------------
   启动顺序：
     1 程序目录里有 www.pkg → 解密到用户数据目录（首次或版本变化时）
     2 热更新过的 www（userData/www + ":hot" 标记）优先
     3 都没有 → 开发环境下的明文 www 目录
   解密算法必须与 tools/pack-www.mjs、MainActivity.java 完全一致：
     keystream = sha256(KEY || uint32BE(counter))，逐字节 XOR。
   ========================================================= */
const PKG_KEY = 'zb-weekend-2026-mint-os-4-key-32b';

function pkgCrypt(data) {
  const out = Buffer.allocUnsafe(data.length);
  const blocks = Math.ceil(data.length / 32);
  const seed = Buffer.alloc(PKG_KEY.length + 4);
  seed.write(PKG_KEY, 0, 'utf8');
  for (let i = 0; i < blocks; i++) {
    seed.writeUInt32BE(i >>> 0, PKG_KEY.length);
    const ks = crypto.createHash('sha256').update(seed).digest();
    const off = i * 32;
    const n = Math.min(32, data.length - off);
    for (let j = 0; j < n; j++) out[off + j] = data[off + j] ^ ks[j];
  }
  return out;
}

function unpackBundled() {
  try {
    const pkgPath = path.join(__dirname, 'www.pkg');
    if (!fs.existsSync(pkgPath)) return;            // 开发模式：直接用 www 目录

    const ud = app.getPath('userData');
    const stampPath = path.join(ud, 'www.stamp');
    const want = app.getVersion();                   // 版本变了就重新解
    let stamp = '';
    try { stamp = fs.readFileSync(stampPath, 'utf8').trim(); } catch (e) { /* 首次 */ }

    const live = path.join(ud, 'www', 'index.html');
    if (fs.existsSync(live) && stamp.startsWith(want)) return;   // 已经解过

    const raw = fs.readFileSync(pkgPath);
    if (raw.length < 44 || raw.slice(0, 4).toString('ascii') !== 'ZBW1') {
      boot('www.pkg 格式不对，跳过解包');
      return;
    }
    const plainLen = raw.readUInt32LE(8);
    const wantHash = raw.slice(12, 44);
    const plain = pkgCrypt(raw.slice(44));

    if (plain.length !== plainLen) { boot('www.pkg 长度不符，跳过解包'); return; }
    const got = crypto.createHash('sha256').update(plain).digest();
    if (!got.equals(wantHash)) { boot('www.pkg 校验失败，跳过解包'); return; }

    // 写临时 zip，用系统自带 tar 解压（Windows 10 1803+ / macOS 都支持 zip）
    const tmpZip = path.join(app.getPath('temp'), 'zb-www-boot.zip');
    fs.writeFileSync(tmpZip, plain);
    const next = path.join(ud, 'www_boot');
    fs.rmSync(next, { recursive: true, force: true });
    fs.mkdirSync(next, { recursive: true });
    require('node:child_process').execFileSync('tar', ['-xf', tmpZip, '-C', next], { windowsHide: true });
    fs.rmSync(tmpZip, { force: true });

    if (!fs.existsSync(path.join(next, 'index.html'))) {
      fs.rmSync(next, { recursive: true, force: true });
      boot('解出来的包没有 index.html');
      return;
    }
    const cur = path.join(ud, 'www');
    fs.rmSync(cur, { recursive: true, force: true });
    fs.renameSync(next, cur);
    fs.writeFileSync(stampPath, want);
    boot('已解包随包资源 → ' + cur);
  } catch (e) {
    boot('解包失败：' + (e && e.message));
  }
}

/* 网页资源目录：热更过的优先，否则用安装包自带的。
   热更目录放在 userData 下——那里不会随覆盖安装被清掉，也不会被系统当程序目录锁权限。
   任何一步判断失败都退回内置目录，玩家不会因为一次坏下载开不了游戏。 */
const BUNDLED_WWW = fs.existsSync(path.join(__dirname, 'www'))
  ? path.join(__dirname, 'www')
  : path.join(__dirname, '..', 'www');

function hotWww() {
  try {
    const dir = path.join(app.getPath('userData'), 'www');
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  } catch (e) { /* userData 取不到就退回内置 */ }
  return null;
}

/* 资源目录在解包之后才能定，所以这里用 let。
   顺序：whenReady → 解包（首次或版本变化）→ 选目录 → 建窗口。 */
let WWW = BUNDLED_WWW;

// 默认启用硬件加速（GPU 合成能明显减轻立绘/背景切换时的卡顿）；
// 少数受限机器上 GPU 进程起不来时，设 ZB_SAFE=1 退回软件渲染。
if (process.env.ZB_SAFE === '1') {
  app.disableHardwareAcceleration();
}
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// 单机游戏，音乐不需要用户手势就能播
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 纯本地离线应用，关闭渲染进程沙箱以兼容受限/精简系统（不加载任何远程内容）
if (process.env.ZB_SANDBOX !== '1') {
  app.commandLine.appendSwitch('no-sandbox');
}
const START = 'app://local/index.html';

// 用自定义协议提供本地文件，让 localStorage / 字体 / 音频按正常网页规则工作
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
]);

function mimeOf(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.woff2': 'font/woff2', '.woff': 'font/woff'
  }[ext] || 'application/octet-stream';
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#0B0D10',
    show: false,
    autoHideMenuBar: true,
    title: '不属于我的周末',
    icon: path.join(WWW, 'assets/app-icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);

  // 自动化截图（构建自检用）
  if (process.env.ZB_CAPTURE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(process.env.ZB_CAPTURE, img.toPNG());
          console.log('captured', process.env.ZB_CAPTURE);
        } catch (e) {
          console.error('capture failed', e);
        }
        app.exit(0);
      }, 2200);
    });
    setTimeout(() => { console.error('capture timeout'); app.exit(2); }, 20000);
  }

  win.webContents.on('did-fail-load', (_e, code, desc, url) => boot(`did-fail-load ${code} ${desc} ${url}`));
  win.webContents.on('did-finish-load', () => boot('did-finish-load'));
  win.loadURL(START);

  win.once('ready-to-show', () => {
    win.show();
    if (process.env.ZB_FULLSCREEN === '1') win.setFullScreen(true);
  });

  // F11 全屏 / Esc 退出全屏
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

}

/* =========================================================
   热更新（Electron 侧）
   ---------------------------------------------------------
   和 Android 一样只换网页资源：
     下载 zip → SHA-256 校验 → 解压到 userData/www_next → 删旧 → 改名
   解压用系统自带的 tar（Windows 10 1803+ / macOS / Linux 都有，
   且都能直接读 zip），不引第三方压缩库。
   ========================================================= */
ipcMain.on('zb:shell-version', (e) => {
  e.returnValue = app.getVersion();
});

function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too-many-redirects'));
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(downloadFile(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('http ' + res.statusCode)); }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(dest)));
      out.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('data', (d) => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

function runTar(zip, dest) {
  return new Promise((resolve, reject) => {
    execFile('tar', ['-xf', zip, '-C', dest], { windowsHide: true }, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

ipcMain.handle('zb:download', async (_e, remote) => {
  const url = remote && remote.www;
  if (!url) return { ok: false, reason: 'no-url' };
  const base = app.getPath('userData');
  const zip = path.join(app.getPath('temp'), 'zb-www-update.zip');
  const next = path.join(base, 'www_next');
  try {
    await downloadFile(url, zip);
    if (remote.sha256) {
      const got = await sha256File(zip);
      if (got.toLowerCase() !== String(remote.sha256).toLowerCase()) {
        fs.rmSync(zip, { force: true });
        return { ok: false, reason: 'sha-mismatch' };
      }
    }
    fs.rmSync(next, { recursive: true, force: true });
    fs.mkdirSync(next, { recursive: true });
    await runTar(zip, next);
    fs.rmSync(zip, { force: true });
    if (!fs.existsSync(path.join(next, 'index.html'))) {
      fs.rmSync(next, { recursive: true, force: true });
      return { ok: false, reason: 'no-index' };
    }
    const cur = path.join(base, 'www');
    fs.rmSync(cur, { recursive: true, force: true });
    fs.renameSync(next, cur);
    // 标记为热更内容：下次启动不再用随包资源覆盖它
    try { fs.writeFileSync(path.join(base, 'www.stamp'), app.getVersion() + ':hot'); } catch (e) { /* 忽略 */ }
    return { ok: true };
  } catch (err) {
    try { fs.rmSync(zip, { force: true }); } catch (e) { /* 忽略 */ }
    try { fs.rmSync(next, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
    return { ok: false, reason: 'exception' };
  }
});

app.whenReady().then(() => {
  // 先把随包资源解到用户目录，再决定从哪儿加载
  unpackBundled();
  WWW = hotWww() || BUNDLED_WWW;
  boot(`www dir: ${WWW}`);
  boot('app ready');
  try {
    protocol.handle('app', (request) => {
    const u = new URL(request.url);
    let rel = decodeURIComponent(u.pathname || '/');
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.join(WWW, rel);
    if (!file.startsWith(WWW)) return new Response('forbidden', { status: 403 });
    try {
      if (!fs.existsSync(file)) return new Response('not found', { status: 404 });
    } catch (e) {
      return new Response('error', { status: 500 });
    }
    return net.fetch(pathToFileURL(file).toString());
    });
    boot('protocol handled');
  } catch (e) {
    boot('protocol.handle failed: ' + (e && e.message));
  }

  try {
    createWindow();
    boot('window created');
  } catch (e) {
    boot('createWindow failed: ' + (e && e.message));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((e) => {
  boot('whenReady failed: ' + (e && e.message));
});

app.on('window-all-closed', () => {
  app.quit();
});
