"""从 Kevin MacLeod 曲库（incompetech, CC BY 4.0）里给每个场景挑一首。

输入：build/_km.json（站点 pieces.json，1443 首，带 feel / 乐器 / bpm / 描述）
输出：build/_pick.json（场景 id → 曲目信息），以及候选清单供人工过目

挑选逻辑：
  · 每条场景给定「想要的 feel、乐器关键词、bpm 区间」
  · 打分 = feel 命中(权重最高) + 乐器命中 + bpm 落在区间的程度 + 长度够用
  · 同一首不会分配给两个场景（贪心去重），避免又出现"每首都差不多"
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'build', '_km.json')
OUT = os.path.join(ROOT, 'build', '_pick.json')

# feel: 期望的情绪标签（站点的 data-feel 词汇）
# inst: 想要听到的乐器关键词（小写，命中即加分）
# bpm:  (下限, 上限)
# note: 给人工看的挑选意图
SPEC = {
    'calm':        dict(feel=['Calming', 'Relaxed'], inst=['piano', 'strings'], bpm=(50, 82),
                        note='安静：慢钢琴，稀疏，不抢戏'),
    'calm2':       dict(feel=['Calming'], inst=['piano', 'cello', 'guitar'], bpm=(48, 78),
                        note='安静·二：更暖一点，室内感'),
    'silent':      dict(feel=['Somber', 'Calming'], inst=['piano'], bpm=(40, 70),
                        note='沉默：留白多，接近静止'),
    'room':        dict(feel=['Calming', 'Relaxed'], inst=['piano', 'guitar'], bpm=(55, 80),
                        note='室内：近距离的小房间'),
    'daily':       dict(feel=['Relaxed', 'Bright'], inst=['piano', 'glockenspiel', 'strings'], bpm=(78, 108),
                        note='日常：轻快但克制'),
    'morning':     dict(feel=['Bright', 'Uplifting'], inst=['piano', 'strings'], bpm=(85, 115),
                        note='清晨：明亮，起步感'),
    'classroom':   dict(feel=['Relaxed'], inst=['piano', 'strings'], bpm=(70, 95),
                        note='教室：中性，能长时间听'),
    'playground':  dict(feel=['Bouncy', 'Bright'], inst=['piano', 'drums', 'glockenspiel'], bpm=(100, 135),
                        note='操场：有动势，人群'),
    'canteen':     dict(feel=['Grooving', 'Bright'], inst=['bass', 'drums', 'guitar'], bpm=(95, 125),
                        note='食堂：嘈杂热闹'),
    'city':        dict(feel=['Relaxed'], inst=['synth', 'electric piano'], bpm=(70, 100),
                        note='城市：傍晚，远处车流'),
    'night_street':dict(feel=['Calming', 'Mysterious'], inst=['electric piano', 'synth'], bpm=(60, 90),
                        note='夜街：路灯，孤独但安全'),
    'office':      dict(feel=['Relaxed'], inst=['marimba', 'synth', 'piano'], bpm=(65, 95),
                        note='办事：公事公办的中性'),
    'hall':        dict(feel=['Somber', 'Calming'], inst=['strings', 'piano'], bpm=(50, 80),
                        note='礼堂：空旷混响'),
    'sunset':      dict(feel=['Uplifting', 'Calming'], inst=['strings', 'piano'], bpm=(60, 88),
                        note='黄昏：暖，微微上扬'),
    'hope':        dict(feel=['Uplifting'], inst=['piano', 'strings'], bpm=(75, 105),
                        note='往上走：逐渐有力'),
    'tense':       dict(feel=['Suspenseful', 'Unnerving'], inst=['strings', 'synth'], bpm=(60, 95),
                        note='绷紧：低压弦乐，克制'),
    'exam':        dict(feel=['Suspenseful', 'Somber'], inst=['piano', 'strings'], bpm=(50, 80),
                        note='考试：低气压，安静'),
    'memory':      dict(feel=['Somber', 'Calming'], inst=['piano', 'strings'], bpm=(55, 85),
                        note='回忆：旧事，慢'),
    'goodbye':     dict(feel=['Somber', 'Uplifting'], inst=['strings', 'piano'], bpm=(55, 85),
                        note='告别：结束感，不悲到底'),
    'daydream':    dict(feel=['Calming', 'Mystical'], inst=['piano', 'synth'], bpm=(55, 85),
                        note='白日梦：飘'),
    'relax':       dict(feel=['Relaxed', 'Bright'], inst=['guitar', 'piano'], bpm=(70, 100),
                        note='松一口气：轻，透气'),
    'rain':        dict(feel=['Calming', 'Somber'], inst=['piano', 'strings'], bpm=(50, 80),
                        note='雨前：潮湿，闷'),
    'broadcast':   dict(feel=['Calming', 'Mysterious'], inst=['piano', 'synth'], bpm=(50, 80),
                        note='广播：旧喇叭，远'),
}

# 明确避开：太吵、太像流行歌、明显不适合校园日常的标签
BAD_FEEL = {'Aggressive', 'Action', 'Epic', 'Intense', 'Humorous', 'Eerie', 'Driving'}


def parse_len(s):
    try:
        m, sec = s.split(':')[-2:], None
        mm, ss = int(m[0]), int(m[1])
        hh = 0
        parts = [int(x) for x in s.split(':')]
        if len(parts) == 3:
            hh, mm, ss = parts
        elif len(parts) == 2:
            mm, ss = parts
        return hh * 3600 + mm * 60 + ss
    except Exception:
        return 0


def score(p, spec):
    feels = [f.strip() for f in str(p.get('feel') or '').split(',') if f.strip()]
    if set(feels) & BAD_FEEL:
        return -99
    s = 0
    want = {f.lower() for f in spec['feel']}
    hit = len(want & {f.lower() for f in feels})
    s += hit * 40
    inst = str(p.get('instruments') or '').lower()
    s += sum(12 for k in spec['inst'] if k in inst)
    try:
        bpm = int(p.get('bpm') or 0)
    except Exception:
        bpm = 0
    lo, hi = spec['bpm']
    if lo <= bpm <= hi:
        s += 18
    elif bpm:
        s -= min(18, abs(bpm - (lo if bpm < lo else hi)) / 4)
    dur = parse_len(p.get('length') or '')
    if dur >= 120:
        s += 8
    elif dur >= 80:
        s += 4
    desc = str(p.get('description') or '').lower() + ' ' + str(p.get('title') or '').lower()
    for k in ('piano', 'ambient', 'gentle', 'soft', 'quiet', 'melanchol', 'wistful'):
        if k in desc:
            s += 3
    return s


def main():
    pieces = json.load(io.open(SRC, encoding='utf-8'))
    used = set()
    pick = {}
    for scene, spec in SPEC.items():
        ranked = sorted(((score(p, spec), p) for p in pieces), key=lambda x: -x[0])
        chosen = None
        for sc_, p in ranked:
            if sc_ <= 0:
                break
            key = p['filename']
            if key in used:
                continue
            chosen = (sc_, p)
            break
        if not chosen:
            print('✗ 没挑到:', scene)
            continue
        used.add(chosen[1]['filename'])
        pick[scene] = dict(score=chosen[0], title=chosen[1]['title'], file=chosen[1]['filename'],
                           feel=chosen[1]['feel'], bpm=chosen[1]['bpm'], length=chosen[1]['length'],
                           inst=chosen[1]['instruments'], isrc=chosen[1].get('isrc'), note=spec['note'])
        print(f"{scene:13s} {chosen[0]:5.0f}  {chosen[1]['title'][:34]:34s} {chosen[1]['feel'][:26]:26s} bpm={chosen[1]['bpm']:>3s} {chosen[1]['length']}")

    json.dump(pick, io.open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n写入', OUT, len(pick), '首')


if __name__ == '__main__':
    main()
