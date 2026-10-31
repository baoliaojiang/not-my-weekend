# 把主1.zip 里的表情图整理成游戏可用的素材：
# 去掉近白背景（从四角 flood fill，衣服上的白被描边挡住不会误伤）、
# 裁到内容边界、统一缩到 256 见方，另从主1.png 裁一张圆形头像。
from PIL import Image, ImageDraw
import os

SRC = r'D:\workbuddy\2026-10-23-16-33-10\build\mint'
OUT = r'D:\workbuddy\2026-10-23-16-33-10\assets\ai'
os.makedirs(OUT, exist_ok=True)

MAP = {
    '主1.png': 'main',
    '坐.png': 'sit',
    '坐 (2).png': 'sit2',
    '？.png': 'question',
    '抱抱.png': 'hug',
    '俯身.png': 'bow',
    '害羞1.png': 'shy',
    '哼.png': 'hum',
    '开心.png': 'happy',
    '上班.png': 'work',
    '伸手.png': 'reach',
    '收到.png': 'ok',
    '提裙.png': 'skirt',
    '贴贴.png': 'close',
    '晚安.png': 'night',
    '谢谢.png': 'thanks',
}


def cutout(path, work=720):
    im = Image.open(path)
    im.info.pop('icc_profile', None)
    im = im.convert('RGBA').resize((work, work), Image.LANCZOS)
    # 四角各铺一次，把与角落连通的近白区域变成全透明
    for xy in [(0, 0), (work - 1, 0), (0, work - 1), (work - 1, work - 1)]:
        try:
            ImageDraw.floodfill(im, xy, (0, 0, 0, 0), thresh=26)
        except Exception as e:
            print('  floodfill skip', xy, e)
    return im


for src, name in MAP.items():
    p = os.path.join(SRC, src)
    if not os.path.exists(p):
        print('missing', src)
        continue
    im = cutout(p)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    # 保持方形：补透明边
    w, h = im.size
    side = max(w, h)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((256, 256), Image.LANCZOS)
    canvas.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(name, canvas.size, os.path.getsize(os.path.join(OUT, f'{name}.png')) // 1024, 'KB')

# ---- 头像：从主1.png 取头部，圆形裁切 ----
av = Image.open(os.path.join(SRC, '主1.png'))
av.info.pop('icc_profile', None)
av = av.convert('RGBA')
W, H = av.size
# 头部大致在上方 2%~44%，横向居中取 40% 宽
box = (int(W * 0.31), int(H * 0.015), int(W * 0.69), int(H * 0.395))
head = av.crop(box).resize((256, 256), Image.LANCZOS)
mask = Image.new('L', (256, 256), 0)
ImageDraw.Draw(mask).ellipse((0, 0, 255, 255), fill=255)
head.putalpha(mask)
head.save(os.path.join(OUT, 'avatar.png'), optimize=True)
print('avatar', head.size, os.path.getsize(os.path.join(OUT, 'avatar.png')) // 1024, 'KB')
