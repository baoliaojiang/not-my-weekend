"""立绘修复：把「抠图漏下来的不透明白块」清掉。

问题现象
--------
AI 出图是白底。抠图后，本该是背景的白色区域有时并没有变成透明，
而是留成了 **alpha=255 的纯白色块**，卡在头发缝隙、衣领旁边等地方。
在游戏里贴到教室背景上，就变成「一缕白头发」。

判定
----
真正残留的背景白有很明显的特征：
  1. 颜色几乎是纯白（三通道都 >= 240，色度接近 0）；
  2. 不透明（alpha >= 200）；
  3. 它的边界几乎全部贴着 **头发色**（低亮度、低饱和的深色）；
     而白衬衫、白纸这些正常白色物件，边界挨着的是皮肤（偏粉）、
     藏青西装（偏蓝），色度都明显更高。

所以：白色连通块 + 边界一圈「发色」像素占比高 → 判为背景残留，
把这些像素的 alpha 归零，露出真正的背景。

用法
----
  python tools/sprite_fix_white.py assets/characters            # 整个目录
  python tools/sprite_fix_white.py assets/characters/x.webp --out y.webp
  python tools/sprite_fix_white.py assets/characters --dry      # 只报告不写
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, label

MIN_SIZE = 30          # 小于此尺寸的白色块不处理（眼睛高光之类）
WHITE_LOW = 240        # 白色通道下限
WHITE_CHROMA = 22      # 白色最大色度
HAIR_LUM = 115         # 发色亮度上限
HAIR_CHROMA = 30       # 发色色度上限
RING = 3               # 边界采样环宽度


def _is_white(rgb, alpha):
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    return (alpha >= 200) & (rgb.min(axis=2) >= WHITE_LOW) & (chroma <= WHITE_CHROMA)


def _is_hair(rgb, alpha):
    lum = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    return (alpha >= 200) & (lum < HAIR_LUM) & (chroma < HAIR_CHROMA)


def fix_array(arr, verbose=False):
    """输入输出都是 float32 的 HxWx4（0-255）。返回 (arr, 处理掉的像素数)"""
    rgb = arr[..., :3]
    al = arr[..., 3]

    white = _is_white(rgb, al)
    hair = _is_hair(rgb, al)
    if not white.any() or not hair.any():
        return arr, 0

    lb, n = label(white)
    if n == 0:
        return arr, 0

    sizes = np.bincount(lb.ravel())
    kill = np.zeros_like(white)
    killed = 0
    for i in range(1, n + 1):
        if sizes[i] < MIN_SIZE:
            continue
        comp = lb == i
        ring = binary_dilation(comp, np.ones((3, 3), bool), iterations=RING) & ~comp
        if not ring.any():
            continue
        # 边界上「发色」像素的占比
        ratio = float((ring & hair).sum()) / float(ring.sum())
        if ratio >= 0.45:
            kill |= comp
            killed += int(sizes[i])
            if verbose:
                ys, xs = np.where(comp)
                print('    残留白块 %6d px  边界发色占比 %.0f%%  @ (%d,%d)'
                      % (sizes[i], ratio * 100, ys.min(), xs.min()))

    if killed:
        arr[..., 3] = np.where(kill, 0.0, al)
    return arr, killed


def fix_file(src, dst=None, verbose=False):
    im = Image.open(src).convert('RGBA')
    arr = np.array(im).astype(np.float32)
    arr, killed = fix_array(arr, verbose=verbose)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
    save_to = dst or src
    if save_to.lower().endswith('.webp'):
        out.save(save_to, 'WEBP', quality=100, method=6)
    else:
        out.save(save_to, optimize=True)
    return killed


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    target = args[0]
    dry = '--dry' in args
    dst = None
    if '--out' in args:
        dst = args[args.index('--out') + 1]

    if os.path.isdir(target):
        files = [os.path.join(target, f) for f in sorted(os.listdir(target))
                 if f.lower().endswith(('.webp', '.png'))]
        total = 0
        for p in files:
            if dry:
                im = Image.open(p).convert('RGBA')
                arr = np.array(im).astype(np.float32)
                _, k = fix_array(arr, verbose=True)
                print('  %-24s 残留白块 %d px' % (os.path.basename(p), k))
            else:
                k = fix_file(p, verbose=True)
                print('  %-24s 清理 %d px' % (os.path.basename(p), k))
            total += k
        print('合计清理 %d px' % total)
    else:
        k = fix_file(target, dst, verbose=True)
        print('清理 %d px -> %s' % (k, dst or target))


if __name__ == '__main__':
    main()
