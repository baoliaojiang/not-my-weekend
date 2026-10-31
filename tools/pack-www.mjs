/* =========================================================
   把网页资源打成加密包
   ---------------------------------------------------------
   目的：APK 与 EXE 里不再直接躺着一堆 .js / .png / .mp3，
   别人解开安装包只能看到一个 www.pkg，看不到剧情文本和素材原图。

   做法（刻意选了"三层语言都能手写一致"的方案）：
     1 先把 www 打成 zip（只在内存里，不落盘）
     2 用 SHA-256 计数器流加密（keystream = sha256(KEY || counter)）
        —— 和 AES 比不强，但它只是防"随手扒包"，不是防有备而来的逆向；
        重点是 Java / Node 两侧各二十行就能写得完全一致，不留移植 bug。
     3 包结构：[ZBW1][uint32 版本][uint32 原文长度][32B 原文 sha256][密文]

   产物：build/pkg/www.pkg
   ========================================================= */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

const ROOT = 'D:/workbuddy/2026-10-23-16-33-10';
const WWW = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, 'build/www');
const OUT_PKG = process.argv[3] ? join(ROOT, process.argv[3]) : join(ROOT, 'build/pkg/www.pkg');
const OUT_DIR = dirname(OUT_PKG);
const TMP_ZIP = join(ROOT, '.tmp-pkg-www.zip');

/* 密钥：改这里必须同步改 MainActivity.java 与 electron/main.js 的 KEY */
const KEY = 'zb-weekend-2026-mint-os-4-key-32b';

function keystreamBlock(i) {
  const buf = Buffer.alloc(KEY.length + 4);
  buf.write(KEY, 0, 'utf8');
  buf.writeUInt32BE(i >>> 0, KEY.length);
  return createHash('sha256').update(buf).digest();
}

function crypt(data) {
  const out = Buffer.allocUnsafe(data.length);
  const blocks = Math.ceil(data.length / 32);
  for (let i = 0; i < blocks; i++) {
    const ks = keystreamBlock(i);
    const off = i * 32;
    const n = Math.min(32, data.length - off);
    for (let j = 0; j < n; j++) out[off + j] = data[off + j] ^ ks[j];
  }
  return out;
}

/* 打 zip：Windows 用自带 bsdtar，Linux/CI 用 zip 命令 */
if (existsSync(TMP_ZIP)) rmSync(TMP_ZIP, { force: true });
if (process.platform === 'win32') {
  execFileSync('tar', ['-a', '-c', '-f', '.tmp-pkg-www.zip', '-C', relative(ROOT, WWW), '.'],
    { cwd: ROOT, windowsHide: true });
} else {
  execFileSync('zip', ['-r', '-q', TMP_ZIP, '.'], { cwd: WWW });
}

const plain = readFileSync(TMP_ZIP);
const cipher = crypt(plain);
const digest = createHash('sha256').update(plain).digest();

const head = Buffer.alloc(4 + 4 + 4 + 32);
head.write('ZBW1', 0, 'ascii');
head.writeUInt32LE(1, 4);
head.writeUInt32LE(plain.length, 8);
digest.copy(head, 12);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PKG, Buffer.concat([head, cipher]));
rmSync(TMP_ZIP, { force: true });

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`www.pkg 已生成：${mb(plain.length)} 原文 → ${mb(cipher.length + head.length)} 包`);
console.log('sha256(原文) =', digest.toString('hex'));
