# 按场景的时间语义重新分配背景
# 只改 bg 节点的 id，不动 place 文案（place 是给玩家看的地点标签，本来就该保留"晚自习"这些字）
import re, os, sys

ROOT = r'D:/workbuddy/2026-10-23-16-33-10/scripts/data'
FILES = ['ch0.js','ch1.js','ch2.js','ch3.js','ch4.js','ch5.js','ch6.js','side1.js','side2.js']

# place 精确匹配 → 新背景 id
RULES = {
    # 晚自习：夜
    '晚自习 · 第一节 19:00-19:50': 'classroomNight',
    '晚自习 · 课间 19:50-20:00': 'classroomNight',
    '晚自习 · 第二、三节 20:00-21:50': 'classroomNight',
    '初三（2）班 · 晚自习后': 'classroomNight',
    # 放学后 / 放学前：黄昏
    '初三（2）班 · 放学后': 'classroomDusk',
    '初三（2）班 · 放学前的二十分钟': 'classroomDusk',
    '初三（2）班 · 放学前': 'classroomDusk',
    '教室 · 放学后': 'classroomDusk',
    # 校门口傍晚
    '校门口 · 傍晚': 'gateDusk',
    '校门口 · 傍晚六点二十': 'gateDusk',
    '校门口 · 放学后': 'gateDusk',
    # 走廊
    '教学楼走廊 · 放学后': 'corridorDusk',
    '教学楼二楼走廊 · 21:50': 'corridorNight',
    # 早读 / 清晨：走廊清晨
    '教学楼走廊 · 第二天': 'corridorDawn',
}

changed = 0
for fn in FILES:
    p = os.path.join(ROOT, fn)
    src = open(p, encoding='utf-8').read()
    out = src
    for place, newid in RULES.items():
        # 匹配 { t: 'bg', id: 'xxx', place: 'PLACE' }（id 与 place 顺序可能有别，这里按 place 定位后改同一行的 id）
        pat = re.compile(r"(\{ t: 'bg', id: ')([A-Za-z]+)(', place: '" + re.escape(place) + r"')")
        def rep(m):
            global changed
            if m.group(2) == newid:
                return m.group(0)
            changed += 1
            return m.group(1) + newid + m.group(3)
        out = pat.sub(rep, out)
    if out != src:
        open(p, 'w', encoding='utf-8').write(out)
        print('updated', fn)

print('替换总数', changed)
