"""背景时段变体：把同一张底图调成黄昏 / 夜里 / 清晨。

为什么不用 AI 再画一遍：同一个场景换个时间，重画会连建筑结构都变，
玩家会觉得"这根本不是同一间教室"。用色彩映射做，构图 100% 一致。

用法：
  python tools/bg_tone.py <源图> <输出图> dusk|night|dawn
"""
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def apply_tone(src, dst, mode):
    im = Image.open(src).convert('RGB')
    a = np.array(im).astype(np.float32) / 255.0
    h, w = a.shape[:2]

    # 从上到下的渐变权重：天空受影响最重，地面最轻
    yy = np.linspace(0, 1, h)[:, None]
    sky = (1.0 - yy) ** 1.4          # 顶部接近 1

    if mode == 'dusk':
        # 黄昏：整体压暗、抬高红/橙、天空加暖
        tint = np.array([1.16, 0.92, 0.78], np.float32)
        a *= tint
        a *= (0.86 - 0.10 * (1 - sky))[..., None]
        glow = np.array([1.25, 0.72, 0.42], np.float32)
        a = a * (1 - 0.28 * sky[..., None]) + glow * (0.28 * sky[..., None]) * a
    elif mode == 'night':
        # 夜里：压暗、整体偏蓝、对比度略降
        tint = np.array([0.52, 0.62, 0.92], np.float32)
        a *= tint
        a *= 0.72
        a = np.power(np.clip(a, 0, 1), 1.12)
    elif mode == 'dawn':
        # 清晨：提亮、偏冷青、低饱和
        tint = np.array([0.94, 1.02, 1.10], np.float32)
        a *= tint
        a = a * 0.55 + 0.48 * (a ** 0.72)
        a = 0.5 + (a - 0.5) * 0.86
    else:
        raise SystemExit('mode 只能是 dusk / night / dawn')

    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    if mode == 'night':
        out = ImageEnhance.Contrast(out).enhance(0.92)
        # 夜里加一点柔光，路灯/窗户别死黑
        blur = out.filter(ImageFilter.GaussianBlur(6))
        out = Image.blend(out, blur, 0.18)
    out.save(dst, quality=92)
    print(f'{dst}  {mode}')


if __name__ == '__main__':
    apply_tone(sys.argv[1], sys.argv[2], sys.argv[3])
