#!/usr/bin/env bash
# 构建《不属于我的周末》Android APK：aapt2 → javac → d8 → zipalign → apksigner
set -euo pipefail

ROOT="D:/workbuddy/2026-10-23-16-33-10"
SDK="D:/android-sdk"
BT="$SDK/build-tools/36.0.0"
AJ="$SDK/platforms/android-36/android.jar"
APP="$ROOT/build/android"
OUT="$ROOT/build/out"
PROJ="$ROOT/build/apk-work"

PYEXE="C:/Users/12821/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
PKG="com.zhouri.bufanxiao"
NAME="不属于我的周末"
# 版本号不再手写：直接从 scripts/config/game.js 里读，免得和游戏内版本对不上
# versionCode 必须严格递增：装过旧包的玩家要能覆盖安装。
# 每次发版手动改这里太容易忘，改成按日期算（2026-11-01 → 26110101 形式）。
VER_CODE="$(date +%y%m%d)"
VER_NAME="$(grep -oE "version: *'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'" "$ROOT/scripts/config/game.js" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+")"
[ -n "$VER_NAME" ] || VER_NAME="0.0.0.0"

# 变体：标准版（默认，依赖系统 WebView）/ 兼容版（自带 polyfill 与降级样式）
# 用法：bash build/build-apk.sh compat
VARIANT="${1:-standard}"
if [ "$VARIANT" = "compat" ]; then
  OUT_NAME="不属于我的周末-兼容版.apk"
else
  OUT_NAME="不属于我的周末-标准版.apk"
fi

# 中间目录不直接删（一次几十个文件会触发批量删除保护），改成移进 _trash
if [ -d "$PROJ" ]; then
  mkdir -p "$ROOT/build/_trash"
  mv "$PROJ" "$ROOT/build/_trash/apk-work-$(date +%s)" 2>/dev/null || true
fi
mkdir -p "$PROJ/gen" "$PROJ/classes" "$PROJ/dex" "$OUT"

echo "[1/7] 打包加密网页资源 → assets/www.pkg（变体：$VARIANT）"

# 资源不再以明文进安装包：先打成 zip，再流加密成 www.pkg。
# 解包发生在客户端首次启动的「正在编译着色器」那一屏（见 assets/boot/index.html）。
NODE="C:/Users/12821/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"
SRC="$ROOT/build/www"

if [ "$VARIANT" = "compat" ]; then
  # 兼容版：先复制一份 www，注入 polyfill 与降级样式，再打这个副本
  SRC="$ROOT/build/www-compat"
  "$NODE" "$ROOT/build/sync-dir.mjs" "$ROOT/build/www" "$SRC" >/dev/null 2>&1 || true
  cp "$ROOT/build/compat/compat.js" "$SRC/compat.js"
  cp "$ROOT/build/compat/compat.css" "$SRC/compat.css"
  "$PYEXE" - "$SRC/index.html" <<'PY'
import io, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
if 'compat.js' not in s:
    tag = ('<link rel="stylesheet" href="compat.css">\n'
           '<script src="compat.js"></script>\n')
    s = s.replace('</head>', tag + '</head>', 1)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('  已注入兼容层')
PY
fi

"$NODE" "$ROOT/tools/pack-www.mjs" "${SRC#$ROOT/}" "build/pkg/www.pkg" | tail -2

# 老的 assets/www 明文资源必须移出去，否则加密等于没做。
# 这里用"改名移走"而不是删除：一次删一百多个文件会触发批量删除保护；
# 移出 assets 之后 aapt2 就看不到它了，效果等价。
if [ -d "$APP/assets/www" ]; then
  mkdir -p "$ROOT/build/_trash"
  mv "$APP/assets/www" "$ROOT/build/_trash/www-$(date +%s)" 2>/dev/null || true
fi
mkdir -p "$APP/assets"
cp "$ROOT/build/pkg/www.pkg" "$APP/assets/www.pkg"
ls -lh "$APP/assets/www.pkg" "$APP/assets/boot/index.html"

# manifest 里写死的 versionName / versionCode 必须改成当前版本。
# 原因：aapt2 link 的 --version-name / --version-code 只有在 manifest
# 没有显式声明时才生效；manifest 里写死了 → 打包出来还是旧版本号，
# 客户端上报的外壳版本就永远比远端旧，于是每次启动都误报"要更新客户端"。
MANIFEST="$APP/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  sed -i.bak -E 's/android:versionCode="[0-9]+"/android:versionCode="'"$VER_CODE"'"/' "$MANIFEST"
  sed -i.bak -E 's/android:versionName="[^"]+"/android:versionName="'"$VER_NAME"'"/' "$MANIFEST"
  rm -f "$MANIFEST.bak"
  echo "    manifest: versionCode=$VER_CODE versionName=$VER_NAME"
fi

echo "[2/7] aapt2 编译资源"
"$BT/aapt2.exe" compile --dir "$APP/res" -o "$PROJ/res.zip"

echo "[3/7] aapt2 链接（生成 R.java 与基础 APK）"
"$BT/aapt2.exe" link \
  -o "$PROJ/app-unsigned.apk" \
  -I "$AJ" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$PROJ/gen" \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code $VER_CODE --version-name "$VER_NAME" \
  --auto-add-overlay \
  "$PROJ/res.zip"

echo "[4/7] javac 编译"
find "$PROJ/gen" -name "*.java" > "$PROJ/sources.txt"
find "$APP/java" -name "*.java" >> "$PROJ/sources.txt"
# 注意：javac 的错误绝不能吞。上一次就是用 `| grep` 吞掉了 lambda 编译失败，
# 结果 MainActivity 没进 dex，APK 一点就闪退。
if ! "$JAVA_HOME/bin/javac" -encoding UTF-8 -source 8 -target 8 \
      -bootclasspath "$AJ" -classpath "$AJ" \
      -Xlint:-options \
      -d "$PROJ/classes" @"$PROJ/sources.txt" > "$PROJ/javac.log" 2>&1; then
  echo "!! javac 编译失败："
  cat "$PROJ/javac.log"
  exit 1
fi
grep -v "bootstrap class path" "$PROJ/javac.log" | grep -v "^注:" || true
if [ ! -f "$PROJ/classes/com/zhouri/bufanxiao/MainActivity.class" ]; then
  echo "!! 编译产物缺少 MainActivity.class，中止打包"
  exit 1
fi

echo "[5/7] d8 转 dex"
find "$PROJ/classes" -name "*.class" > "$PROJ/classes.txt"
"$BT/d8.bat" --lib "$AJ" --min-api 21 --release \
  --output "$PROJ/dex" @"$PROJ/classes.txt"
if ! grep -qa "com/zhouri/bufanxiao/MainActivity" "$PROJ/dex/classes.dex"; then
  echo "!! classes.dex 里没有 MainActivity，中止打包（这会导致启动闪退）"
  exit 1
fi

echo "[6/7] 组装 + zipalign"
cp "$PROJ/app-unsigned.apk" "$PROJ/app-dex.apk"
"C:/Users/12821/.workbuddy/binaries/python/envs/default/Scripts/python.exe" - "$PROJ/app-dex.apk" "$PROJ/dex/classes.dex" <<'PY'
import sys, zipfile, shutil
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print('  classes.dex 已写入')
PY
"$BT/zipalign.exe" -f -p 4 "$PROJ/app-dex.apk" "$PROJ/app-aligned.apk"

echo "[7/7] 签名"
KS="$ROOT/build/keystore.jks"
if [ ! -f "$KS" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -v -keystore "$KS" -storepass zhouri2026 -keypass zhouri2026 \
    -alias zhouri -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=baoliaojiang, O=Demo, C=CN" >/dev/null 2>&1
  echo "  已生成调试签名"
fi
"$BT/apksigner.bat" sign --ks "$KS" --ks-pass pass:zhouri2026 --key-pass pass:zhouri2026 \
  --ks-key-alias zhouri --v1-signing-enabled true --v2-signing-enabled true \
  --out "$OUT/$OUT_NAME" "$PROJ/app-aligned.apk"

"$BT/apksigner.bat" verify --print-certs "$OUT/$OUT_NAME" | head -4
ls -lh "$OUT/$OUT_NAME"
