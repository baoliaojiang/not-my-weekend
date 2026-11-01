"""立绘后期：去掉抠图留下的白边（white matte）。

为什么需要单独一步：
  AI 出图是白底，抠图时边缘那几个像素是「前景色 × alpha + 白色 × (1-alpha)」
  的混合结果。直接当 alpha 用，深色背景上就会看到一圈发白的描边——
  尤其在头发、裙摆这种细轮廓上最明显。

做法：
  对每个 0 < alpha < 250 的边缘像素，取它周围 radius 像素内
  **完全不透明像素的平均颜色**作为前景色替换掉原来的混色值，
  alpha 保持不变。
  这样边缘的颜色变成"人物身上那一块本来的颜色"，白边就消失了，
  同时抗锯齿的柔和过渡还在，不会变硬。

用法：
  python tools/sprite_edge_clean.py <图.png|webp> [--out 输出]
  python tools/sprite_edge_clean.py assets/characters            # 整个目录原地处理
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, uniform_filter

RADIUS = 4          # 取样半径（像素）
MIN_ALPHA = 6       # 比这更淡的算毛边，直接抹掉


def clean_array(arr, rim_rounds=3):
    """输入输出都是 float32 的 HxWx4，值域 0-255"""
    rgb = arr[..., :3]
    al = arr[..., 3]

    solid = (al >= 250).astype(np.float32)
    size = RADIUS * 2 + 1
    cover = uniform_filter(solid, size=size, mode='nearest')

    edge = (al > 0) & (al < 250)
    # 附近没有不透明像素（极细的发丝端头）就保留原色，别乱涂
    usable = edge & (cover > 2.0 / (size * size))

    # 只处理"偏白"的边缘像素。
    # 整条边缘全换会把人物的深色轮廓一起抹平（头发外缘变成一圈硬边），
    # 而真正难看的白边本来就是白的——按亮度筛一下，细节能留住。
    lum = rgb.mean(axis=2)
    whitish = (lum > 168) & (rgb.min(axis=2) > 105)
    usable = usable & whitish

    for c in range(3):
        num = uniform_filter(rgb[..., c] * solid, size=size, mode='nearest')
        est = num / np.maximum(cover, 1e-6)
        # 保留一点原来的明度：全换成平均色会让边缘发死
        mixed = est * 0.82 + rgb[..., c] * 0.18
        rgb[..., c] = np.where(usable, mixed, rgb[..., c])

    al = np.where(al < MIN_ALPHA, 0.0, al)

    # 有些图的外轮廓是一整圈"不透明的白"（alpha=255 的纯白描边），
    # 上面按 alpha 筛选的做法碰不到它，深色背景上就是一圈贴纸白边。
    # 这里从透明区往里剥：紧贴透明区的纯白像素原地透明化，重复几轮。
    # 白衬衫的袖口也会被削掉 1-2px，但比留一圈白边自然得多。
    for _ in range(max(0, rim_rounds)):
        transparent = al <= 2
        if not transparent.any():
            break
        grown = binary_dilation(transparent, structure=np.ones((3, 3), bool))
        rim = grown & ~transparent
        white_rim = rim & (lum > 224) & (rgb.max(axis=2) - rgb.min(axis=2) < 22)
        if not white_rim.any():
            break
        al = np.where(white_rim, 0.0, al)
        transparent = al <= 2
        # 每一轮都重算亮度，避免用旧值一路错下去
        lum = np.where(white_rim, 0.0, lum)

    arr[..., 3] = al
    return arr


def tint_white_rim(arr, band_px=5, sample=13):
    """把"紧贴透明区的不透明白"染成附近的前景深色。

    这批立绘的最外圈是「深色线 + 线内侧一圈纯白」，描边感很重，
    深色背景上看起来就是贴纸白边。上面按 alpha 做的那套碰不到
    alpha=255 的白，所以这里再补一步：距透明区 band_px 以内的白像素，
    用周围深色前景（发色/衣服/线稿）的平均色替换掉。
    白衬衫的袖口只会被压暗最外面两三像素，不影响观感，
    但整圈白边会消失。
    """
    rgb, al = arr[..., :3], arr[..., 3]
    lum = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)

    white = (al > 240) & (lum > 200) & (chroma < 26)
    transparent = al <= 2
    if not transparent.any() or not white.any():
        return arr

    near = binary_dilation(transparent, np.ones((3, 3), bool), iterations=band_px)
    band = white & near

    fg = (al > 240) & (lum < 170) & (chroma < 60)
    cover = uniform_filter(fg.astype(np.float32), size=sample, mode='nearest')
    ok = band & (cover > 1e-3)
    for c in range(3):
        num = uniform_filter(rgb[..., c] * fg, size=sample, mode='nearest')
        est = num / np.maximum(cover, 1e-6)
        # 掺一点原亮度，免得描边变成死黑
        rgb[..., c] = np.where(ok, est * 0.9 + rgb[..., c] * 0.1, rgb[..., c])

    arr[..., :3] = rgb
    return arr


def clean_file(src, dst=None):
    im = Image.open(src).convert('RGBA')
    arr = np.array(im).astype(np.float32)
    arr = clean_array(arr)
    arr = tint_white_rim(arr)
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
    save_to = dst or src
    if save_to.lower().endswith('.webp'):
        out.save(save_to, 'WEBP', quality=100, method=6)
    else:
        out.save(save_to, optimize=True)
    return out


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    target = args[0]
    dst = None
    if '--out' in args:
        dst = args[args.index('--out') + 1]

    if os.path.isdir(target):
        for f in sorted(os.listdir(target)):
            if f.lower().endswith(('.png', '.webp')):
                p = os.path.join(target, f)
                clean_file(p)
                print('cleaned', p)
    else:
        clean_file(target, dst)
        print('cleaned', dst or target)


if __name__ == '__main__':
    main()
