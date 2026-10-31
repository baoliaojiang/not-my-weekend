#!/usr/bin/env bash
# 打包 Windows 便携版 + 发布压缩包
# ---------------------------------------------------------
# 两个目录，别搞混：
#   build/out/exe/<名称>/            —— 发布用。每次重新生成，清档后再压成 zip。
#   build/out/exe (用户玩的…)/<…>/    —— 用户自己那份。只做覆盖更新，不删、不压。
#
# 「清档」在这里指：发布目录里不允许残留任何存档 / 用户数据
# （www 下若有 *.save、data/、userdata/ 之类，压包前一律删掉）。
# 用户那份一律不碰存档。
set -euo pipefail

ROOT="D:/workbuddy/2026-10-23-16-33-10"
OUT="$ROOT/build/out"
NAME="不属于我的周末"
VER="$(grep -oE "version: *'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" "$ROOT/scripts/config/game.js" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+")"
[ -n "$VER" ] || VER="0.0.0.0"
CLEAN="$OUT/exe/$NAME"
ZIP="$OUT/$NAME-v$VER-win.zip"

echo "== 0/5 生成网页产物 =="
node "$ROOT/build/make-www.mjs"

echo "== 1/5 打干净版 exe =="
bash "$ROOT/build/build-exe.sh"

echo "== 1.5/5 精简运行时：只留中文与英文语言包 =="
# Electron 默认带 55 种语言，locales 占 39MB，实际只用到 zh-CN / en-US
KEEP_LANGS=" zh-CN zh-TW en-US en-GB "
for f in "$CLEAN/locales"/*.pak; do
  [ -e "$f" ] || continue
  b="$(basename "$f" .pak)"
  case "$KEEP_LANGS" in
    *" $b "*) ;;
    *) rm -f "$f" ;;
  esac
done
# Chromium 的授权全文 9MB：内容必须带，但没必要明文占体积，压成 .gz 并在旁边留一句说明
if [ -f "$CLEAN/LICENSES.chromium.html" ]; then
  gzip -9 -f "$CLEAN/LICENSES.chromium.html" || true
  printf '%s\n' 'Chromium 的授权与第三方声明见 LICENSES.chromium.html.gz（gzip 压缩，解压后为原始 HTML）。' > "$CLEAN/LICENSES-README.txt"
fi
echo "    精简后大小：$(du -sh "$CLEAN" | cut -f1)"

echo "== 2/5 清档：发布目录里不许带用户数据 =="
# www 是纯静态资源，正常不会有存档；这里是兜底，防止哪天把调试存档带进去。
find "$CLEAN/resources/app" -maxdepth 3 \
  \( -name '*.save' -o -name 'zbnx.save*' -o -name 'save*.json' \) -print -delete 2>/dev/null || true
for d in "$CLEAN/resources/app/data" "$CLEAN/resources/app/userdata" "$CLEAN/data"; do
  if [ -d "$d" ]; then echo "    删掉 $d"; rm -rf "$d"; fi
done
echo "    干净版大小：$(du -sh "$CLEAN" | cut -f1)"

echo "== 3/5 更新用户自己那份（只覆盖，不删除，不清档） =="
USER_ROOT=""
for d in "$OUT"/exe\ \(*; do [ -d "$d" ] && USER_ROOT="$d"; done
if [ -z "$USER_ROOT" ]; then
  echo "    没找到用户目录，跳过"
else
  USER_APP="$(find "$USER_ROOT" -maxdepth 1 -mindepth 1 -type d | head -1)"
  echo "    用户目录：$USER_APP"
  mkdir -p "$USER_APP/resources/app"
  cp "$ROOT/build/electron/main.js" "$USER_APP/resources/app/main.js"
  cp "$ROOT/build/electron/package.json" "$USER_APP/resources/app/package.json"
  node "$ROOT/build/sync-dir.mjs" "$ROOT/build/www" "$USER_APP/resources/app/www"
  # exe 名字保持用户原来那个，只更新版本信息——桌面快捷方式不会失效
  UEXE="$(find "$USER_APP" -maxdepth 1 -name '*.exe' | head -1)"
  if [ -n "$UEXE" ]; then
    for i in 1 2 3; do
      sleep 2
      if "$ROOT/build/tools/rcedit.exe" "$UEXE" \
          --set-icon "$ROOT/build/icon.ico" \
          --set-version-string ProductName "$NAME" \
          --set-version-string FileDescription "不属于我的周末 · 校园调查视觉小说 Demo" \
          --set-file-version "$VER.0" --set-product-version "$VER.0"; then
        break
      fi
      echo "    第 $i 次写入失败，重试…"
    done
    echo "    已更新：$UEXE"
  fi
fi

echo "== 4/5 压包（只压干净版） =="
rm -f "$ZIP"
powershell -NoProfile -Command "Compress-Archive -Path '$CLEAN' -DestinationPath '$ZIP' -CompressionLevel Optimal"
echo "    $ZIP  $(du -sh "$ZIP" | cut -f1)"

echo "== 5/5 结果 =="
ls -lh "$OUT"/*.zip
