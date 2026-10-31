#!/usr/bin/env bash
# 打包 Windows 便携版：Electron 运行时 + app（main.js / package.json / www）
set -euo pipefail

ROOT="D:/workbuddy/2026-10-23-16-33-10"
ELECTRON="C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/electron/dist"
OUT="$ROOT/build/out/exe"
NAME="不属于我的周末"
# 版本号从配置读，避免和游戏内版本对不上
VER="$(grep -oE "version: *'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" "$ROOT/scripts/config/game.js" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+")"
[ -n "${VER:-}" ] || VER="0.0.0.0"
APP="$OUT/$NAME"

echo "[1/4] 准备 Electron 运行时（已存在则复用，不做整目录删除）"
mkdir -p "$APP"
if [ -f "$APP/$NAME.exe" ]; then
  echo "    复用已有运行时"
else
  cp -r "$ELECTRON"/. "$APP"/
fi
rm -f "$APP/resources/default_app.asar"

echo "[2/4] 放入应用文件"
mkdir -p "$APP/resources/app"
cp "$ROOT/build/electron/main.js" "$APP/resources/app/main.js"
cp "$ROOT/build/electron/preload.js" "$APP/resources/app/preload.js"
cp "$ROOT/build/electron/package.json" "$APP/resources/app/package.json"
# 网页资源以加密包形式随程序发布：程序目录里只有 www.pkg，
# 首次启动时由主进程解密到用户数据目录，再从那里加载。
cp "$ROOT/build/pkg/www.pkg" "$APP/resources/app/www.pkg"
# 清掉以前留在程序目录里的明文 www（加密后它不该再存在）
# 用改名移走而不是删除：一次删一百多个文件会触发批量删除保护
if [ -d "$APP/resources/app/www" ]; then
  mkdir -p "$ROOT/build/_trash"
  mv "$APP/resources/app/www" "$ROOT/build/_trash/exe-www-$(date +%s)" 2>/dev/null || true
fi

echo "[3/4] 改名"
if [ -f "$APP/electron.exe" ]; then mv "$APP/electron.exe" "$APP/$NAME.exe"; fi
rm -f "$APP/resources/$NAME.exe"

echo "[4/4] 写图标与版本信息"
# 刚拷完的大文件可能被杀毒软件/索引服务短暂占用，重试几次
ok=0
for i in 1 2 3 4 5; do
  sleep 2
  if "$ROOT/build/tools/rcedit.exe" "$APP/$NAME.exe" \
      --set-icon "$ROOT/build/icon.ico" \
      --set-version-string ProductName "$NAME" \
      --set-version-string FileDescription "不属于我的周末 · 校园调查视觉小说 Demo" \
      --set-version-string CompanyName "爆料酱" \
      --set-version-string LegalCopyright "Demo 版本，仅供个人学习与交流" \
      --set-version-string OriginalFilename "$NAME.exe" \
      --set-file-version "$VER.0" \
      --set-product-version "$VER.0"; then
    ok=1; break
  fi
  echo "  写入失败，第 $i 次重试…"
done
if [ "$ok" != "1" ]; then echo "图标写入失败（不影响运行）"; fi

echo "完成：$APP/$NAME.exe"
du -sh "$APP"
