/* =========================================================
   更新版本比较的单元测试
   ---------------------------------------------------------
   用户报过的 bug：已经是最新版本，还是弹"发现新版本"。
   根因有两处，这里各测一遍：
     1. Electron 的 package.json 版本落后于游戏版本 → 外壳被判"太旧"
     2. 版本相等 / 本地更新时仍被算成有更新
   ========================================================= */
import { compareVersion, parseVersion } from '../scripts/core/update.js';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fail = [];
const check = (c, m) => { if (!c) fail.push(m); };

// --- 版本解析 ---
check(parseVersion('0.6.4.0').join('.') === '0.6.4.0', 'parseVersion 应保留四段');
check(parseVersion('v0.6.4').join('.') === '0.6.4', 'parseVersion 应去掉 v');
check(parseVersion('').length >= 1, 'parseVersion 空输入不应崩');

// --- 大小比较 ---
check(compareVersion('0.6.4.0', '0.6.4.0') === 0, '相等版本应为 0');
check(compareVersion('0.6.4.0', '0.6.4') === 0, '少一段的相等版本应为 0');
check(compareVersion('0.6.5.0', '0.6.4.9') > 0, '更大的版本应 > 0');
check(compareVersion('0.6.4.0', '0.6.5.0') < 0, '更小的版本应 < 0');
check(compareVersion('1.0.0.0', '0.99.99.99') > 0, '按段比较，主版本优先');

// --- 外壳版本必须和游戏版本一致 ---
const game = fs.readFileSync(path.join(ROOT, 'scripts/config/game.js'), 'utf8');
const gv = (game.match(/version: *'([\d.]+)'/) || [])[1];
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/electron/package.json'), 'utf8'));
check(!!gv, 'game.js 里应能读出版本号');
check(pkg.version === gv, `Electron 外壳版本应等于游戏版本（${pkg.version} vs ${gv}）`);

// --- 模拟 checkUpdate 的判定（与 update.js 里的逻辑一致） ---
function judge(curContent, curShell, remote) {
  const shellMin = remote.shellMin || remote.shell || '0.0.0';
  const contentNewer = compareVersion(remote.content, curContent) > 0;
  const gate = compareVersion(shellMin, remote.shell || shellMin) > 0 ? (remote.shell || shellMin) : shellMin;
  const shellTooOld = compareVersion(curShell, gate) < 0;
  const localAhead = compareVersion(curContent, remote.content) > 0;
  const needContent = contentNewer && !localAhead;
  return needContent && shellTooOld ? 'both' : needContent ? 'content' : shellTooOld ? 'shell' : 'none';
}

const SAME = { content: '0.6.4.0', shell: '0.6.4.0', shellMin: '0.6.4.0' };
check(judge('0.6.4.0', '0.6.4.0', SAME) === 'none', '版本全相等时不应提示更新');
check(judge('0.6.4.0', '0.6.4.0', { ...SAME, content: '0.6.4.0' }) === 'none', 'content 相等不应提示');
check(judge('0.6.4.0', '0.6.4.0', { ...SAME, content: '0.6.5.0' }) === 'content', 'content 更新应提示 content');
check(judge('0.6.3.0', '0.6.3.0', SAME) === 'both', '客户端落后应提示 both');
check(judge('0.6.5.0', '0.6.5.0', SAME) === 'none', '本地比远端新时不应提示');
check(judge('0.6.4.0', '0.6.2.4', SAME) === 'shell', '外壳落后应提示 shell');

console.log('更新比较测试：', fail.length ? 'FAIL\n - ' + fail.join('\n - ') : '全部通过');
process.exit(fail.length ? 1 : 0);
