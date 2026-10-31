"""从立绘裁出「整个脸」的头像。

人物面板原来是把整张立绘当背景图放大 250% 取上半部分，
不同的立绘头顶位置不一样，结果有人被切掉刘海、有人只露半张脸。

这里改成：先在立绘上半部分找肤色像素（动画立绘的肤色很稳定），
用它们的重心定位脸，再按脸的宽度外扩一圈裁一个正方形——
刘海、耳朵、下巴、一点肩膀都在框里，缩放后大小也一致。
"""
import os
import numpy as np
from PIL import Image, ImageDraw

SRC = 'assets/characters'
OUT = 'assets/faces'

SPRITES = [f[:-4] for f in sorted(os.listdir(SRC)) if f.endswith('.png')]


def face_box(im):
    W, H = im.size
    a = np.array(im.convert('RGBA'))
    rgb = a[:, :, :3].astype(np.int16)
    alpha = a[:, :, 3]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    # 肤色：红分量高、比蓝绿都高，且不是纯白/纯黑
    skin = (r > 120) & (r - b > 18) & (r - g > 8) & (r < 252) & (alpha > 200)
    top = int(H * 0.34)
    region = skin[:top, :]
    ys, xs = np.where(region)
    if len(xs) < 200:
        # 兜底：整图 1/3 宽居中
        side = W * 0.36
        return (W / 2 - side / 2, H * 0.02, W / 2 + side / 2, H * 0.02 + side)
    # 去掉离群点：取中位数附近
    mx, my = np.median(xs), np.median(ys)
    keep = (np.abs(xs - mx) < W * 0.22) & (np.abs(ys - my) < H * 0.16)
    xs, ys = xs[keep], ys[keep]
    cx = float(np.median(xs))
    cy = float(np.median(ys))
    ow = float(xs.max() - xs.min())      # 脸的横向跨度（含两侧头发）
    oh = float(ys.max() - ys.min())
    side = max(ow * 1.95, oh * 2.05, W * 0.34)
    side = min(side, W * 0.98, H * 0.56)
    # 往上多留一点给刘海，往下留够下巴
    x0 = cx - side / 2
    y0 = cy - side * 0.62
    x0 = max(0, min(x0, W - side))
    y0 = max(0, min(y0, H - side))
    return (x0, y0, x0 + side, y0 + side)


def main():
    os.makedirs(OUT, exist_ok=True)
    tiles = []
    for name in SPRITES:
        im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
        box = face_box(im)
        crop = im.crop(tuple(int(round(v)) for v in box)).resize((320, 320), Image.LANCZOS)
        crop.save(os.path.join(OUT, name + '.png'))
        print(f'{name:16s} box={tuple(int(v) for v in box)}')
        tiles.append((name, crop))

    # 拼一张对照图，一次就能看出谁被切了
    cols, size = 5, 200
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * size, rows * (size + 22)), (28, 32, 38))
    d = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(tiles):
        x, y = (i % cols) * size, (i // cols) * (size + 22)
        sheet.paste(im.convert('RGB'), (x, y), im)
        d.text((x + 6, y + size + 4), name, fill=(220, 220, 220))
    sheet.save('build/_faces-sheet.png')


if __name__ == '__main__':
    main()
