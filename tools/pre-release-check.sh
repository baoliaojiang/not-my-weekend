#!/usr/bin/env bash
# =========================================================
# 交付前检查：清档 → 密钥扫描 → 功能测试
# ---------------------------------------------------------
# 每次发版前跑一遍。任何一项不过就别提交、别发布。
#
#   bash tools/pre-release-check.sh
#
# 三件事：
#   1. 清档：源码与产物里不许残留玩家存档 / 本地设置 / 临时文件
#   2. 密钥扫描：源码、构建产物、git 历史里不许有真实 API key
#   3. 功能测试：跑一遍核心测试脚本
# =========================================================
set -uo pipefail

ROOT="D:/workbuddy/2026-10-23-16-33-10"
cd "$ROOT"

FAIL=0
say()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
ok()   { printf '  [OK] %s\n' "$1"; }
bad()  { printf '  [FAIL] %s\n' "$1"; FAIL=1; }

# ---------------------------------------------------------
say "1/3 清档"
# 源码树里的玩家数据（存档、设置、进度）
FOUND=$(find . -path ./node_modules -prune -o -path ./.git -prune -o -path ./build -prune -o -path ./dist -prune -o -path ./dist-old -prune -o -type f \
  \( -name 'zbnx.save*' -o -name 'zbnx.settings*' -o -name 'zbnx.progress*' -o -name 'zbnx.read*' -o -name '*.save' -o -name 'zb_mint_note_v1' \) -print 2>/dev/null)
if [ -z "$FOUND" ]; then ok "源码树没有玩家存档/设置残留"
else bad "源码树有残留："; echo "$FOUND" | sed 's/^/      /'; fi

# 配置里的 apiKey 必须为空
KEYVAL=$(grep -oE "apiKey: *'[^']*'" scripts/config/game.js | head -1 | sed "s/.*'\(.*\)'/\1/")
if [ -z "$KEYVAL" ]; then ok "game.js 里 apiKey 为空"
else bad "game.js 里 apiKey 不是空的：$KEYVAL"; fi

# 构建产物里不许有存档
if [ -d build/www ]; then
  FOUND2=$(find build/www -type f \( -name 'zbnx.*' -o -name '*.save' \) 2>/dev/null)
  if [ -z "$FOUND2" ]; then ok "build/www 没有存档残留"
  else bad "build/www 有残留："; echo "$FOUND2" | sed 's/^/      /'; fi
fi

# ---------------------------------------------------------
say "2/3 密钥扫描"
# 常见 key 形态：OpenAI/Anthropic、Google、GitHub token
PAT='sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}'
HIT=$(grep -rEn "$PAT" --include='*.js' --include='*.mjs' --include='*.json' --include='*.html' --include='*.css' --include='*.md' --include='*.java' --include='*.yml' --include='*.sh' \
  scripts/ styles/ build/electron build/android build/*.mjs build/*.sh tools/ index.html README.md .github/ 2>/dev/null \
  | grep -vE "sk-test|sk-test-|EXAMPLE|placeholder|your-key|YOUR_KEY|xxxx")
if [ -z "$HIT" ]; then ok "源码与构建脚本里没有真实 key"
else bad "发现疑似 key："; echo "$HIT" | head -20 | sed 's/^/      /'; fi

# git 历史里也扫一遍
HITHIST=$(git log -p --all 2>/dev/null | grep -E "^\+.*($PAT)" | grep -vE "sk-test|EXAMPLE|placeholder" | head -10)
if [ -z "$HITHIST" ]; then ok "git 历史里没有真实 key"
else bad "git 历史里发现疑似 key："; echo "$HITHIST" | sed 's/^/      /'; fi

# ---------------------------------------------------------
say "3/3 功能测试"
run() {
  printf '  → %s\n' "$1"
  if node "$2" >/tmp/zbnx-test.log 2>&1; then ok "$1 通过"
  else bad "$1 失败"; tail -25 /tmp/zbnx-test.log | sed 's/^/      /'; fi
}
run "更新版本比较"    tools/test-update.mjs
run "HUD 收起/展开"   tools/test-hud.mjs
run "校园通功能"      tools/test-campus.mjs
run "深浅色对比度"   tools/audit-contrast.mjs
run "手机功能点击"    tools/audit-mint.mjs
run "版本切换/回滚"   tools/test-versions.mjs
run "更新日志配图"    tools/test-clog-shots.mjs

# ---------------------------------------------------------
printf '\n'
if [ "$FAIL" = "0" ]; then
  printf '\033[32m全部通过，可以提交与发布。\033[0m\n'
else
  printf '\033[31m有检查项没过，先修再提交。\033[0m\n'
fi
exit $FAIL
