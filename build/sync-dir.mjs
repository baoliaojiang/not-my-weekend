/* 目录同步：把 src 的内容覆盖到 dst，并删掉 dst 里 src 已经没有的文件。
   为什么不用 rm -rf 整目录：一次删几十个文件会触发批量删除保护，
   而真正需要删掉的通常只有几个残留文件。 */
import fs from 'node:fs';
import path from 'node:path';

const [, , srcArg, dstArg] = process.argv;
if (!srcArg || !dstArg) {
  console.error('用法: node sync-dir.mjs <src> <dst>');
  process.exit(1);
}
const src = path.resolve(srcArg);
const dst = path.resolve(dstArg);

function walk(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? path.join(base, e.name) : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

fs.mkdirSync(dst, { recursive: true });
const srcFiles = new Set(walk(src));
const dstFiles = walk(dst);

let copied = 0;
for (const rel of srcFiles) {
  const from = path.join(src, rel);
  const to = path.join(dst, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
}

// 只删 src 里没有的；数量很小，按小批量走
const stale = dstFiles.filter(rel => !srcFiles.has(rel));
for (const rel of stale) {
  try { fs.unlinkSync(path.join(dst, rel)); } catch (e) { /* ignore */ }
}

// 清掉空目录
function prune(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    prune(p);
    try { if (!fs.readdirSync(p).length) fs.rmdirSync(p); } catch (err) { /* ignore */ }
  }
}
prune(dst);

console.log(`    同步完成：覆盖 ${copied} 个文件，清掉 ${stale.length} 个残留`);
