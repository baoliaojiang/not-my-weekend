"""把素材转成 WebP 并改写源码里的引用，用来压安装包体积。

为什么：
  安装包 60MB+ 里，图片占了将近一半，而 PNG 存照片级插画非常浪费。
  实测一张 448×1012 的立绘：PNG 600KB → WebP q88 只有 60KB，肉眼看不出差别。
  WebP 在 Chrome / Android WebView / Electron 里都原生支持，不需要 polyfill。

做法：
  1. 逐目录转码（立绘/背景/表情/头像/图标），保留 alpha；
  2. 记下每张图的 旧路径 → 新路径；
  3. 在 scripts/、index.html、styles/ 里做**精确字符串**替换，
     不做模糊匹配，避免误伤（比如 .png 出现在文案里）。

保留 PNG 的：assets/ui/app-icon.png（桌面/安卓图标，系统侧要 png）。

用法：
  python tools/optimize-assets.py --dry    # 只报体积，不写文件
  python tools/optimize-assets.py          # 真转
"""
import io
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry' in sys.argv

# 目录 → (格式, 质量, 最长边上限)
PLAN = {
    'assets/characters': ('WEBP', 88, 1400),
    'assets/backgrounds': ('WEBP', 84, 1920),
    'assets/faces': ('WEBP', 86, 512),
    'assets/emoji': ('WEBP', 90, 96),
    'assets/icons': ('WEBP', 90, 256),
    'assets/ai': ('WEBP', 88, 640),
    'assets/ui': ('WEBP', 88, 1024),
}
KEEP = {'assets/ui/app-icon.png', 'assets/ui/app-icon.webp'}
TEXT_EXT = ('.js', '.html', '.css', '.json', '.mjs')


def convert(path, fmt, quality, max_side):
    im = Image.open(path)
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if has_alpha else 'RGB')
    w, h = im.size
    if max(w, h) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    out = os.path.splitext(path)[0] + '.webp'
    if DRY:
        b = io.BytesIO()
        im.save(b, fmt, quality=quality, method=6)
        return out, b.tell()
    im.save(out, fmt, quality=quality, method=6)
    return out, os.path.getsize(out)


def main():
    before = after = 0
    pairs = []
    for d, (fmt, q, ms) in PLAN.items():
        absd = os.path.join(ROOT, d)
        if not os.path.isdir(absd):
            continue
        for dirpath, _, files in os.walk(absd):
            for fn in files:
                if not fn.lower().endswith(('.png', '.jpg', '.jpeg')):
                    continue
                p = os.path.join(dirpath, fn)
                rel = os.path.relpath(p, ROOT).replace('\\', '/')
                if rel in KEEP:
                    continue
                old = os.path.getsize(p)
                try:
                    outp, newsize = convert(p, fmt, q, ms)
                except Exception as e:
                    print('✗', rel, e)
                    continue
                before += old
                after += newsize
                relout = os.path.relpath(outp, ROOT).replace('\\', '/')
                pairs.append((rel, relout))
                if not DRY:
                    os.remove(p)
    print(f'{len(pairs)} 张  {before/1024/1024:.1f}MB → {after/1024/1024:.1f}MB '
          f'(省 {(before-after)/1024/1024:.1f}MB, {100*(before-after)/max(before,1):.0f}%)')
    if DRY:
        return

    # 改写引用：只用完整路径做替换，命中数会打印出来核对
    files = []
    for base in ('scripts', 'styles'):
        for dp, _, fs in os.walk(os.path.join(ROOT, base)):
            files += [os.path.join(dp, f) for f in fs if f.endswith(TEXT_EXT)]
    files.append(os.path.join(ROOT, 'index.html'))
    hits = 0
    for f in files:
        s = io.open(f, encoding='utf-8').read()
        orig = s
        for old, new in pairs:
            if old in s:
                s = s.replace(old, new)
        if s != orig:
            io.open(f, 'w', encoding='utf-8').write(s)
            hits += 1
    print(f'改写 {hits} 个文件')

    # 剩下的 png/jpg 引用要报出来，说明可能是漏网的（或被 KEEP 的）
    left = set()
    for f in files:
        s = io.open(f, encoding='utf-8').read()
        for m in re.finditer(r'assets/[A-Za-z0-9_\-/]+\.(?:png|jpe?g)', s):
            left.add(m.group(0))
    if left:
        print('仍引用位图的路径：')
        for x in sorted(left):
            print('  ', x, '(存在)' if os.path.exists(os.path.join(ROOT, x)) else '(不存在!)')


if __name__ == '__main__':
    main()
