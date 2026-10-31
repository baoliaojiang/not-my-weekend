# -*- coding: utf-8 -*-
"""把钉钉进步体裁成标题区子集并转 woff2。

全量 TTF 有 2MB，标题区只用几十个字；裁完只有几 KB，
打出来的 APK / EXE 也不用为一款标题字体多背 2MB。

用法（改动标题文字后重跑一次）：
    python tools/_subset-jinbuti.py

来源：钉钉官方发布的「钉钉进步体」，永久免费商用。
官方渠道：page.dingtalk.com / iconfont.cn / fonts.alibabagroup.com
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'build' / '_font' / 'DingTalkJinBuTi-Regular.ttf'
OUT = ROOT / 'assets' / 'fonts' / 'DingTalkJinBuTi.woff2'

# 标题区（眉题、主标题、副标题）当前用到的全部字符。
# 以后标题文案改了，把新字加进来再跑一遍即可。
TEXT = (
    '不属于我的周末'
    '校园调查视觉小说 · 代号 遥遥领先'
    '关于我的学校周末要上课这件事'
    '退出游戏'
    '0123456789'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    'abcdefghijklmnopqrstuvwxyz'
    ' ··.,:;\'"()[]{}!?%/+-=—…《》、。，；：？！“”‘’（）'
)

def main():
    if not SRC.exists():
        sys.exit(f'缺源字体：{SRC}（先下载钉钉进步体 TTF 放到这个路径）')
    chars = sorted(set(TEXT))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    from fontTools import subset
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.desubroutinize = True
    opts.layout_features = ['*']
    font = subset.load_font(str(SRC), opts)
    s = subset.Subsetter(options=opts)
    s.populate(text=''.join(chars))
    s.subset(font)
    subset.save_font(font, str(OUT), opts)
    print(f'{len(chars)} 字 -> {OUT}  {OUT.stat().st_size / 1024:.1f} KB')

if __name__ == '__main__':
    main()
