"""用「夜景街道 + 角色大头」合成应用图标：正方形、可安全裁切"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

ROOT = r'D:/workbuddy/2026-10-23-16-33-10'
CHAR = os.path.join(ROOT, 'assets/characters/classmate_zheng.png')
BG = os.path.join(ROOT, 'assets/backgrounds/bg_street_night.jpg')
RES = os.path.join(ROOT, 'build/android/res')
OUT = os.path.join(ROOT, 'build')

S = 1024  # 母版尺寸


def square_bg(size):
    bg = Image.open(BG).convert('RGB')
    w, h = bg.size
    # 1:1 居中裁切（原图很宽，取人中偏右的区域，避开左侧空荡）
    side = min(w, h)
    cx = int(w * 0.54)
    left = max(0, min(w - side, cx - side // 2))
    top = max(0, (h - side) // 2)
    bg = bg.crop((left, top, left + side, top + side))
    bg = bg.resize((size, size), Image.LANCZOS)
    bg = bg.filter(ImageFilter.GaussianBlur(radius=size * 0.006))
    bg = ImageEnhance.Brightness(bg).enhance(0.72)
    bg = ImageEnhance.Color(bg).enhance(1.12)

    # 冷调压暗 + 四周暗角，让角色浮出来
    tint = Image.new('RGB', (size, size), (18, 22, 38))
    bg = Image.blend(bg, tint, 0.28)

    vign = Image.new('L', (size, size), 0)
    dv = ImageDraw.Draw(vign)
    dv.ellipse([-size * 0.18, -size * 0.18, size * 1.18, size * 1.18], fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(size * 0.12))
    black = Image.new('RGB', (size, size), (6, 8, 12))
    bg = Image.composite(bg, black, vign)
    return bg


def char_layer(size):
    ch = Image.open(CHAR).convert('RGBA')
    a = ch.split()[-1]
    bbox = a.getbbox()
    # 取头部方框：以人物整体宽度为基准，向上取一个方形区域
    top = bbox[1]
    height = int(ch.height * 0.55)
    face_cx = (bbox[0] + bbox[2]) // 2 + int(ch.width * 0.02)
    half = height // 2
    left = max(0, min(ch.width - 2 * half, face_cx - half))
    crop = ch.crop((left, top, left + 2 * half, top + height))
    crop = crop.resize((size, size), Image.LANCZOS)
    return crop


size = S
canvas = square_bg(size)
layer = char_layer(int(size * 0.88))
# 角色贴底，头顶与两侧留出夜景
canvas.paste(layer, (int((size - layer.width) / 2), size - layer.height + int(size * 0.02)), layer)

# 底部轻微压暗，避免小尺寸下胸口发白
shade = Image.new('L', (size, size), 0)
ds = ImageDraw.Draw(shade)
ds.rectangle([0, int(size * 0.72), size, size], fill=90)
shade = shade.filter(ImageFilter.GaussianBlur(size * 0.08))
canvas = Image.composite(ImageEnhance.Brightness(canvas).enhance(0.55), canvas, shade)

canvas.convert('RGB').save(os.path.join(OUT, 'icon-1024.png'))

SIZES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for dpi, px in SIZES.items():
    d = os.path.join(RES, f'mipmap-{dpi}')
    os.makedirs(d, exist_ok=True)
    canvas.resize((px, px), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
    print('icon', dpi, px)

canvas.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'))
canvas.resize((256, 256), Image.LANCZOS).save(
    os.path.join(OUT, 'icon.ico'),
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('done')
