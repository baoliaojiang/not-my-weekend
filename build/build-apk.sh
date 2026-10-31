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
VER_CODE="18"
VER_NAME="0.6.2"

# 变体：标准版（默认，依赖系统 WebView）/ 兼容版（自带 polyfill 与降级样式）
# 用法：bash build/build-apk.sh compat
VARIANT="${1:-standard}"
if [ "$VARIANT" = "compat" ]; then
  OUT_NAME="不属于我的周末-兼容版.apk"
else
  OUT_NAME="不属于我的周末-标准版.apk"
fi

rm -rf "$PROJ"
mkdir -p "$PROJ/gen" "$PROJ/classes" "$PROJ/dex" "$OUT"

echo "[1/7] 同步网页资源到 assets/www（变体：$VARIANT）"
# 产物文件名固定（index.html / bundle.js），直接覆盖即可；
# 不再 rm -rf 整个 assets 目录——那会一次删 50 个文件，容易触发批量删除保护。
mkdir -p "$APP/assets/www"
cp -r "$ROOT/build/www/." "$APP/assets/www/"

# 兼容版：把 polyfill 与降级样式塞进资源，并在 index.html 里引上。
# 标准版不引——多一个 <script> 就多一次解析，没必要。
if [ "$VARIANT" != "compat" ]; then
  # 上一次可能是兼容版，残留的 compat.* 会让 index.html 里还留着引用
  rm -f "$APP/assets/www/compat.js" "$APP/assets/www/compat.css"
fi
if [ "$VARIANT" = "compat" ]; then
  cp "$ROOT/build/compat/compat.js" "$APP/assets/www/compat.js"
  cp "$ROOT/build/compat/compat.css" "$APP/assets/www/compat.css"
  "$PYEXE" - "$APP/assets/www/index.html" <<'PY'
import io, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
if 'compat.js' not in s:
    tag = ('<link rel="stylesheet" href="compat.css">\n'
           '<script src="compat.js"></script>\n')
    s = s.replace('</head>', tag + '</head>', 1)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print('  已注入兼容层')
else:
    print('  兼容层已存在')
PY
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
    -dname "CN=ZhouRi, O=Demo, C=CN" >/dev/null 2>&1
  echo "  已生成调试签名"
fi
"$BT/apksigner.bat" sign --ks "$KS" --ks-pass pass:zhouri2026 --key-pass pass:zhouri2026 \
  --ks-key-alias zhouri --v1-signing-enabled true --v2-signing-enabled true \
  --out "$OUT/$OUT_NAME" "$PROJ/app-aligned.apk"

"$BT/apksigner.bat" verify --print-certs "$OUT/$OUT_NAME" | head -4
ls -lh "$OUT/$OUT_NAME"
