"""立绘后期：白底转透明 + 裁边。

用泛洪填充从四边出发，只抠"从边界能连到的白"，
所以白衬衫、白校服这些被封在人物内部的白不会被误伤。

用法：
  python tools/sprite_cut.py <输入图> <输出png>
  python tools/sprite_cut.py <输入图> <输出png> --preview
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def cutout(src, dst, preview=False):
    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    rgb = a[:, :, :3].astype(np.int16)
    h, w = rgb.shape[:2]
    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    # 候选背景：很亮且几乎无色
    bgish = (mn >= 236) & ((mx - mn) <= 20)

    vis = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bgish[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bgish[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and bgish[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))

    alpha = np.full((h, w), 255, np.uint8)
    alpha[vis] = 0
    # 半像素羽化，边缘不留白边
    am = np.array(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8)))
    a[:, :, 3] = am
    bbox = Image.fromarray(alpha).getbbox()
    out = Image.fromarray(a).crop(bbox)
    out.save(dst)
    print(f'{dst}  {out.size[0]}x{out.size[1]}')
    if preview:
        bg = Image.new('RGB', out.size, (70, 74, 84))
        bg.paste(out, (0, 0), out)
        bg.save(f'preview_{dst.split("/")[-1]}')
    return out


if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    cutout(args[0], args[1], '--preview' in sys.argv)
