# 第二批：把食堂 / 保健室 / 天台 / 回家的路 各自分开，
# 并把一直没用上的 hallwayEnd / streetDusk / skyDusk / shopNight 用起来
import re, os

ROOT = r'D:/workbuddy/2026-10-23-16-33-10/scripts/data'
FILES = ['ch0.js','ch1.js','ch2.js','ch3.js','ch4.js','ch5.js','ch6.js','side1.js','side2.js']

# place → 循环使用的背景（按出现次序轮换）
ROTATE = {
    '回家的路': ['streetDusk', 'streetNight', 'cityNight'],
}

# place → 固定背景
FIX = {
    '食堂 · 午休': 'canteen',
    '教学楼天台': 'skyDusk',
    '保健室': 'infirmary',
    '一层西侧 · 保健室': 'infirmary',
    '保健室门口 · 课间': 'hallwayEnd',
    '保健室门口 · 那天中午': 'hallwayEnd',
    '保健室门口 · 第二天': 'hallwayEnd',
    '保健室门口 · 大课间': 'hallwayEnd',
    '保健室门口 · 第四天课间': 'hallwayEnd',
    '保健室门口 · 午休': 'hallwayEnd',
    '保健室门口 · 当天中午': 'hallwayEnd',
    '小卖部 · 三天后': 'shopNight',
}

BG_RE = re.compile(r"\{ t: 'bg', id: '([A-Za-z]+)', place: '([^']*)' \}")

changed = 0
for fn in FILES:
    p = os.path.join(ROOT, fn)
    src = open(p, encoding='utf-8').read()
    seen = {}

    def rep(m):
        global changed
        old_id, place = m.group(1), m.group(2)
        new_id = None
        if place in FIX:
            new_id = FIX[place]
        elif place in ROTATE:
            lst = ROTATE[place]
            k = seen.get(place, 0)
            seen[place] = k + 1
            new_id = lst[k % len(lst)]
        if not new_id or new_id == old_id:
            return m.group(0)
        changed += 1
        return "{ t: 'bg', id: '%s', place: '%s' }" % (new_id, place)

    out = BG_RE.sub(rep, src)
    if out != src:
        open(p, 'w', encoding='utf-8').write(out)
        print('updated', fn)

print('替换总数', changed)
