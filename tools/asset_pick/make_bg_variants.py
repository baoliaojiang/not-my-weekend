from PIL import Image, ImageEnhance
import os

BG = r'D:/workbuddy/2026-10-23-16-33-10/assets/backgrounds'

def grade(src, dst, tint, tint_alpha, brightness, contrast=1.02, saturation=1.0):
    im = Image.open(os.path.join(BG, src)).convert('RGB')
    im = ImageEnhance.Brightness(im).enhance(brightness)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    im = ImageEnhance.Color(im).enhance(saturation)
    overlay = Image.new('RGB', im.size, tint)
    im = Image.blend(im, overlay, tint_alpha)
    im.save(os.path.join(BG, dst), 'JPEG', quality=86, optimize=True)
    print('ok', dst, im.size, f'{os.path.getsize(os.path.join(BG, dst))/1024:.0f}KB')

WARM = (255, 150, 80)      # 黄昏
NIGHT = (24, 34, 78)       # 夜
EARLY = (255, 236, 214)    # 清晨微暖

# 教室：黄昏 / 夜
grade('bg_classroom.jpg', 'bg_classroom_dusk.jpg',  WARM,  0.20, 0.86, 1.03, 1.05)
grade('bg_classroom.jpg', 'bg_classroom_night.jpg', NIGHT, 0.42, 0.52, 1.06, 0.85)

# 走廊：清晨 / 夜
grade('bg_corridor.jpg', 'bg_corridor_dawn.jpg',   EARLY, 0.12, 1.04, 1.0, 0.98)
grade('bg_corridor.jpg', 'bg_corridor_night.jpg',  NIGHT, 0.44, 0.50, 1.06, 0.82)

# 校门：黄昏 / 夜
grade('bg_gate.jpg', 'bg_gate_dusk.jpg',  WARM,  0.24, 0.84, 1.03, 1.06)
grade('bg_gate.jpg', 'bg_gate_night.jpg', NIGHT, 0.46, 0.46, 1.05, 0.80)

# 小卖部：夜（放学后还开着的那一盏灯）
grade('bg_shop.jpg', 'bg_shop_night.jpg', NIGHT, 0.38, 0.58, 1.04, 0.92)

# 空教室：黄昏（放学后留下来的那种空）
grade('bg_commons.jpg', 'bg_commons_dusk.jpg', WARM, 0.18, 0.80, 1.03, 1.02)

# 街道：白天的街
grade('bg_street_dusk.jpg', 'bg_street_day.jpg', EARLY, 0.10, 1.10, 1.0, 1.0)
