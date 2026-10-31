const { app, BrowserWindow, Menu, shell, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const https = require('node:https');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

// 启动诊断：只有设了 ZB_LOG=<文件路径> 才会写，正常游玩不产生任何文件
const BOOT_LOG = process.env.ZB_LOG;
const boot = (m) => {
  if (!BOOT_LOG) return;
  try { fs.appendFileSync(BOOT_LOG, `${new Date().toISOString().slice(11, 19)} ${m}\n`); } catch (e) { /* ignore */ }
};
boot('main.js loaded');

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

const WWW = hotWww() || BUNDLED_WWW;
boot(`www dir: ${WWW}`);

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
    icon: path.join(__dirname, 'www/assets/app-icon.png'),
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
    return { ok: true };
  } catch (err) {
    try { fs.rmSync(zip, { force: true }); } catch (e) { /* 忽略 */ }
    try { fs.rmSync(next, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
    return { ok: false, reason: 'exception' };
  }
});

app.whenReady().then(() => {
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
