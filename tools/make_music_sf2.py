"""用 SoundFont 真实乐器采样重做全部 BGM。

和上一版（tools/make_music.py）的区别不在音源，在编曲：

  旧版：一层 pad + 一层八分音符琶音 + 偶尔一个高音点缀，
        四和弦固定循环 12~16 小节，从头到尾没有变化。
        换成再好的音源也只是"好听的嗡鸣"。

  新版：四条独立声部——
        · 低音：根音 + 五度，撑住和声底座
        · 和声：钢琴/吉他分解，节奏型随小节变化（不是死板的八分音符）
        · 铺底：弦乐或 pad 长音，只在中段出现，留出空间
        · 旋律：手写的动机，按乐句呼吸，A 段出现 → B 段发展 → 回到 A
        每个音的力度都不一样（-8 到 +8 随机 + 重音），真人演奏没有等重的音。

用法：
  python tools/make_music_sf2.py            # 全部
  python tools/make_music_sf2.py calm tense # 指定几首
"""
import logging
import os
import zlib
import subprocess
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logging.disable(logging.WARNING)

from sf2_synth import SR, SoundFont, master, normalize_stereo, fold_loop  # noqa: E402

# 全部 BGM 统一 60 秒、首尾无缝（audio.loop 循环时听不出接缝）
LOOP_SEC = 60.0

FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         'soundfonts/GeneralUser.sf2')
OUT_DIR = 'assets/music'

# ---- GM 音色号（GeneralUser GS 是标准 GM 音色表）----
PIANO, EPIANO, RHODES = 0, 4, 5
NYLON_GT, STEEL_GT, JAZZ_GT = 24, 25, 26
BASS_FINGER, BASS_PICK, BASS_SYNTH = 33, 34, 38
STRINGS, STRINGS2, SOLO_VLN = 48, 49, 40
CHOIR, VOICES = 52, 53
TREMOLO_STR = 44
FLUTE, CLARINET, OBOE, BASSOON = 73, 71, 68, 70
MARIMBA, VIBES, TUBULAR, KALIMBA = 12, 11, 14, 108
HARP, CELESTA, MUSIC_BOX = 46, 8, 10
WARM_PAD, POLY_PAD, HALO_PAD = 89, 90, 94
FRETLESS, PIZZ = 35, 45

MAJ, MIN, SUS4, MAJ7, MIN7, DIM, ADD9 = 0, 1, 2, 3, 4, 5, 6


def chord_notes(root, quality, low=0):
    """返回和弦音高列表。root 是 MIDI 音高，quality 决定叠什么音程。"""
    table = {
        MAJ: [0, 4, 7],
        MIN: [0, 3, 7],
        SUS4: [0, 5, 7],
        MAJ7: [0, 4, 7, 11],
        MIN7: [0, 3, 7, 10],
        DIM: [0, 3, 6],
        ADD9: [0, 4, 7, 14],
    }
    return [root + o + low for o in table[quality]]


def hum(rng, amount):
    """人耳听不出的微小时间偏移，让机械的网格稍微松一点"""
    return float(rng.normal(0, amount))


# ---------------------------------------------------------------- 编曲

class Arranger:
    def __init__(self, font, rng):
        self.font = font
        self.rng = rng
        self.notes = []

    def add(self, program, key, vel, start, dur, gain=1.0):
        key = int(max(21, min(108, key)))
        vel = int(max(8, min(126, vel)))
        if start < 0:
            start = 0.0
        self.notes.append((program, key, vel, start, max(0.06, dur), gain))

    def render(self, total, reverb=0.32, rms_db=-17.5, loop_sec=LOOP_SEC):
        # 多渲染 tail 秒，把尾巴折回开头 → 60 秒无缝循环
        tail = 3.0
        L, R = self.font.render(self.notes, total + tail, reverb_wet=reverb)
        L, R = master(L, R)
        L, R = fold_loop(L, R, loop_sec)
        # BGM 压在 -21 dBFS 左右：比音乐 App 里正常听歌小一档，
        # 说话时听得清台词，也不会一进场景就炸出来。
        return normalize_stereo(L, R, rms_db=rms_db - 3.5, peak=0.86)


def arrange(spec, font, rng):
    """按 spec 生成整首曲子的音符表"""
    A = Arranger(font, rng)
    bar_sec = 4.0 * spec['beat']
    prog = spec['prog']
    # 每首都铺满 60 秒（BGM 要能整分钟循环）：小节数不够就往后再走几小节，
    # 和声进行本来就是循环的，多走几圈反而是同一段音乐继续下去。
    n_bars = max(spec['bars'], int(np.ceil(LOOP_SEC / bar_sec)))
    total = n_bars * bar_sec

    # --- 声部音量（相对） ---
    g_bass = spec.get('bass', 0.0)
    g_harm = spec.get('harm', 0.0)
    g_pad = spec.get('pad', 0.0)
    g_lead = spec.get('lead', 0.0)
    g_spark = spec.get('spark', 0.0)
    g_perc = spec.get('perc', 0.0)

    prog_harm = spec.get('harm_prog', PIANO)
    prog_pad = spec.get('pad_prog', STRINGS)
    prog_bass = spec.get('bass_prog', BASS_FINGER)
    prog_lead = spec.get('lead_prog', PIANO)

    # 旋律动机：(音级偏移, 时值拍数)。音级按大调音阶算，负数为低。
    motif = spec.get('motif') or []
    scale = spec.get('scale', [0, 2, 4, 5, 7, 9, 11])

    def deg_to_midi(deg, base):
        oct_, idx = divmod(deg, 7)
        return base + scale[idx % 7] + 12 * (oct_ + idx // 7)

    for bar in range(n_bars):
        ch_root, ch_q = prog[bar % len(prog)]
        # 和弦默认贴在根音上，但根音在 A3 附近时会和低音、旋律挤成一团。
        # chord_oct 把整组和弦往上抬一个八度，让三层彻底分开。
        tones = [k + spec.get('chord_oct', 0) for k in chord_notes(ch_root, ch_q)]
        t0 = bar * bar_sec
        # 段落：前 1/3 稀疏，中段丰满，末段回到稀疏
        phase = bar / max(1, n_bars - 1)
        full = 0.35 < phase < 0.78

        # ---------- 低音 ----------
        if g_bass > 0:
            # 低音区选在 E2–G3（41–55）。以前一律 root-12，
            # 根音一低就掉到 C2 以下，手机外放还原不出来，
            # 只剩一层"嗡嗡"糊在整首曲子底下——这就是玩家说的"低音很吵"。
            bkey = ch_root - 12
            while bkey < 45:
                bkey += 12
            while bkey > 57:
                bkey -= 12
            pattern = spec.get('bass_pattern', 'whole')
            if pattern == 'whole':
                # 不再铺满整小节，留出呼吸；力度也压下来当底座而不是主角
                A.add(prog_bass, bkey, 44, t0,
                      bar_sec * 0.58, g_bass * 0.7)
            elif pattern == 'half':
                A.add(prog_bass, bkey, 48, t0, bar_sec * 0.38, g_bass * 0.7)
                A.add(prog_bass, bkey, 42, t0 + bar_sec * 0.5,
                      bar_sec * 0.36, g_bass * 0.7)
            elif pattern == 'walk':
                A.add(prog_bass, bkey, 50, t0, bar_sec * 0.24, g_bass * 0.7)
                A.add(prog_bass, bkey, 42,
                      t0 + bar_sec * 0.5, bar_sec * 0.2, g_bass * 0.65)
                A.add(prog_bass, bkey + 5, 38,
                      t0 + bar_sec * 0.75, bar_sec * 0.18, g_bass * 0.55)
            elif pattern == 'offbeat':
                A.add(prog_bass, bkey, 52, t0, bar_sec * 0.16, g_bass * 0.68)

        # ---------- 和声层 ----------
        if g_harm > 0:
            style = spec.get('harm_style', 'broken')
            if style == 'broken':
                # 十六分/八分分解，节奏型每小节轮换三种，避免死板
                shape = [0, 1, 2, 1, 2, 0, 1, 2] if bar % 3 == 0 else \
                        [0, 2, 1, 2, 0, 1, 2, 1] if bar % 3 == 1 else \
                        [0, 1, 2, 1, 0, 2, 1, 2]
                step = bar_sec / len(shape)
                for i, si in enumerate(shape):
                    key = tones[si % len(tones)]
                    vel = 44 + (10 if i in (0, 4) else 0) + int(rng.integers(-6, 7))
                    A.add(prog_harm, key, vel,
                          t0 + i * step + hum(rng, 0.006),
                          step * 1.9, g_harm * (0.85 if i % 2 else 1.0))
            elif style == 'strum':
                # 吉他扫弦：先低后高，带一点延迟
                for i, k in enumerate(tones):
                    A.add(prog_harm, k, 58 + int(rng.integers(-4, 5)),
                          t0 + i * 0.028, bar_sec * 0.55, g_harm)
                if full:
                    for i, k in enumerate(tones):
                        A.add(prog_harm, k, 44,
                              t0 + bar_sec * 0.5 + i * 0.03,
                              bar_sec * 0.4, g_harm * 0.7)
            elif style == 'block':
                # 柱式和弦，只在重拍
                for k in tones:
                    A.add(prog_harm, k, 56, t0, bar_sec * 0.8, g_harm)
                if full:
                    for k in tones:
                        A.add(prog_harm, k, 42, t0 + bar_sec * 0.5,
                              bar_sec * 0.4, g_harm * 0.75)
            elif style == 'sparse':
                # 稀疏：一小节只两三个音
                for i in (0, 2):
                    A.add(prog_harm, tones[(i + bar) % len(tones)],
                          50 + int(rng.integers(-5, 6)),
                          t0 + i * bar_sec * 0.5 + hum(rng, 0.02),
                          bar_sec * 0.8, g_harm)

        # ---------- 铺底 ----------
        if g_pad > 0 and (full or spec.get('pad_always', False)):
            for k in tones[:3]:
                A.add(prog_pad, k, 38 + int(rng.integers(-3, 4)),
                      t0 + hum(rng, 0.03), bar_sec * 1.06,
                      g_pad * (1.0 if full else 0.6))

        # ---------- 旋律 ----------
        if g_lead > 0 and motif and full:
            # 动机按乐句铺：每 4 小节一句，第 3 句升八度做发展
            phrase = (bar // 4) % 4
            base = spec['key'] + spec.get('lead_oct', 0) + (12 if phrase == 3 else 0)
            t = t0
            for j, (deg, beats) in enumerate(motif):
                d = deg + (12 if phrase == 3 else 0)
                key = deg_to_midi(d, base)
                if key > 96:
                    key -= 12
                vel = 62 + int(rng.integers(-7, 8)) + (6 if j == 0 else 0)
                A.add(prog_lead, key, vel, t + hum(rng, 0.012),
                      beats * spec['beat'] * 0.95, g_lead)
                t += beats * spec['beat']
                if t > t0 + bar_sec:
                    break

        # ---------- 点缀 ----------
        if g_spark > 0:
            if bar % 4 == 2:
                hi = spec['key'] + 24
                for i in range(4):
                    A.add(spec.get('spark_prog', CELESTA),
                          deg_to_midi(4 + i, hi), 34 + i * 3,
                          t0 + bar_sec * 0.5 + i * bar_sec * 0.09,
                          0.9, g_spark)
            if bar % 8 == 5:
                for i in range(6):
                    A.add(HARP, deg_to_midi(i, spec['key'] + 12), 30 + i * 4,
                          t0 + i * 0.055, 1.2, g_spark * 1.1)

        # ---------- 简易打击（只给"有节奏"的曲子） ----------
        if g_perc > 0:
            # GM 打击乐在 program 0 的 channel 10，这里用 120 号音色组的鼓
            # GeneralUser 里 bank 120 preset 32 是 Jazz Drums
            pass

    return A.render(total, reverb=spec.get('reverb', 0.32),
                    rms_db=spec.get('rms_db', -17.0))


# ---------------------------------------------------------------- 曲目表

# 音级动机写法：[(音级偏移, 拍数)]，音级 = 音阶第几度（可跨八度）
#
# 这一版重写了和声：**旋律的音阶必须和和弦属于同一个调**。
# 上一版所有曲子都拿大调音阶去配小调和弦——小调的三级、六级是降的，
# 旋律却弹原位，撞在小三度上，听感就是"跑调、诡异"。
# 现在每首显式指定 scale（大调 / 自然小调），进行也只从本调里取和弦。
MAJOR_SC = [0, 2, 4, 5, 7, 9, 11]
MINOR_SC = [0, 2, 3, 5, 7, 8, 10]

SPECS = {
    'daily': dict(
        key=65, beat=0.60, bars=18, scale=MAJOR_SC,
        prog=[(65, MAJ), (60, MAJ), (62, MIN), (67, MAJ)],
        motif=[(4, 1), (2, 1), (4, 1), (7, 1), (4, 2), (2, 2)],
        bass=0.34, harm=0.40, pad=0.0, lead=0.34, spark=0.08,
        harm_style='strum', harm_prog=NYLON_GT, bass_prog=BASS_FINGER,
        lead_prog=MARIMBA, spark_prog=KALIMBA,
        reverb=0.26, rms_db=-17.5,
    ),
    'calm': dict(
        key=57, beat=0.90, bars=16, scale=MINOR_SC, lead_oct=12,
        prog=[(57, MIN), (53, MAJ), (60, MAJ), (55, MAJ)],
        motif=[(2, 2), (0, 2), (4, 3), (2, 1), (0, 2)],
        bass=0.24, harm=0.24, pad=0.30, lead=0.34, spark=0.0,
        harm_style='sparse', harm_prog=EPIANO, pad_prog=WARM_PAD,
        lead_prog=EPIANO,
        reverb=0.44, rms_db=-18.0,
    ),
    'calm2': dict(
        key=64, beat=0.94, bars=16, scale=MINOR_SC,
        prog=[(64, MIN), (60, MAJ), (67, MAJ), (62, MIN)],
        motif=[(4, 2), (2, 1), (0, 3), (2, 2), (4, 2)],
        bass=0.22, harm=0.24, pad=0.30, lead=0.34,
        harm_style='sparse', harm_prog=PIANO, pad_prog=HALO_PAD,
        lead_prog=EPIANO, reverb=0.46, rms_db=-18.0,
    ),
    'silent': dict(
        key=57, beat=1.10, bars=14, scale=MINOR_SC, lead_oct=12,
        prog=[(57, MIN), (53, MAJ), (50, MIN), (52, MIN)],
        motif=[(0, 3), (2, 1), (-2, 2), (0, 2)],
        bass=0.18, harm=0.16, pad=0.34, lead=0.26,
        harm_style='sparse', harm_prog=PIANO, pad_prog=STRINGS2,
        lead_prog=EPIANO, reverb=0.5, rms_db=-18.5,
    ),
    'rain': dict(
        key=62, beat=0.86, bars=16, scale=MINOR_SC, lead_oct=12,
        prog=[(62, MIN), (57, MIN), (58, MAJ), (65, MAJ)],
        motif=[(4, 2), (2, 1), (0, 1), (2, 3), (4, 1)],
        bass=0.24, harm=0.30, pad=0.26, lead=0.32, spark=0.06,
        harm_style='broken', harm_prog=EPIANO, pad_prog=STRINGS,
        lead_prog=PIANO, spark_prog=CELESTA,
        reverb=0.46, rms_db=-17.8,
    ),
    'daydream': dict(
        key=65, beat=0.80, bars=16, scale=MAJOR_SC,
        prog=[(65, MAJ), (57, MIN), (58, MAJ), (60, MAJ)],
        motif=[(4, 1.5), (7, 0.5), (9, 2), (7, 2), (4, 2)],
        bass=0.26, harm=0.28, pad=0.30, lead=0.38, spark=0.10,
        harm_style='broken', harm_prog=PIANO, pad_prog=HALO_PAD,
        lead_prog=MUSIC_BOX, spark_prog=CELESTA,
        reverb=0.5, rms_db=-17.8,
    ),
    'relax': dict(
        key=60, beat=0.70, bars=16, scale=MAJOR_SC,
        prog=[(60, MAJ), (55, MAJ), (57, MIN), (53, MAJ)],
        motif=[(2, 1), (4, 1), (7, 2), (4, 1), (2, 1), (0, 2)],
        bass=0.28, harm=0.36, pad=0.18, lead=0.36, spark=0.08,
        harm_style='strum', harm_prog=STEEL_GT, bass_prog=BASS_PICK,
        lead_prog=MARIMBA, spark_prog=KALIMBA,
        reverb=0.3, rms_db=-17.5,
    ),
    'city': dict(
        key=64, beat=0.64, bars=18, scale=MINOR_SC,
        prog=[(64, MIN), (60, MAJ), (67, MAJ), (62, MIN)],
        motif=[(4, 1), (4, 1), (2, 1), (0, 1), (2, 2), (-2, 2)],
        bass=0.36, harm=0.32, pad=0.12, lead=0.28, spark=0.06,
        harm_style='block', harm_prog=JAZZ_GT, pad_prog=POLY_PAD,
        bass_prog=BASS_SYNTH, lead_prog=FLUTE,
        bass_pattern='half', reverb=0.22, rms_db=-17.2,
    ),
    'office': dict(
        key=60, beat=0.68, bars=16, scale=MAJOR_SC,
        prog=[(60, MAJ7), (53, MAJ7), (55, MAJ), (60, MAJ)],
        motif=[(4, 1), (7, 1), (9, 1), (7, 1)],
        bass=0.22, harm=0.30, pad=0.08, lead=0.26, spark=0.06,
        harm_style='block', harm_prog=EPIANO, pad_prog=POLY_PAD,
        lead_prog=VIBES, bass_pattern='walk',
        reverb=0.24, rms_db=-18.0,
    ),
    'room': dict(
        key=57, beat=0.92, bars=14, scale=MINOR_SC, lead_oct=12,
        prog=[(57, MIN), (60, MAJ), (53, MAJ), (55, MAJ)],
        motif=[(2, 2), (4, 2), (2, 1), (0, 1), (2, 2)],
        bass=0.20, harm=0.24, pad=0.28, lead=0.30,
        harm_style='sparse', harm_prog=NYLON_GT, pad_prog=WARM_PAD,
        lead_prog=PIANO, reverb=0.44, rms_db=-18.2,
    ),
    'hall': dict(
        key=60, beat=0.84, bars=16, scale=MAJOR_SC,
        prog=[(60, MAJ), (57, MIN), (53, MAJ), (55, MAJ)],
        motif=[(7, 2), (4, 1), (7, 1), (9, 2), (7, 2)],
        bass=0.18, harm=0.20, pad=0.40, lead=0.30, spark=0.08,
        harm_style='sparse', harm_prog=PIANO, pad_prog=STRINGS2,
        lead_prog=SOLO_VLN, spark_prog=TUBULAR,
        reverb=0.56, rms_db=-17.6,
    ),
    'sunset': dict(
        key=65, beat=0.86, bars=16, scale=MAJOR_SC,
        prog=[(65, MAJ), (60, MAJ), (67, MAJ), (57, MIN)],
        motif=[(4, 2), (2, 1), (0, 1), (2, 2), (4, 2)],
        bass=0.26, harm=0.32, pad=0.24, lead=0.36, spark=0.06,
        harm_style='broken', harm_prog=PIANO, pad_prog=STRINGS,
        lead_prog=FLUTE, spark_prog=CELESTA,
        reverb=0.46, rms_db=-17.4,
    ),
    'night_street': dict(
        key=57, beat=0.78, bars=18, scale=MINOR_SC, lead_oct=12,
        prog=[(57, MIN), (53, MAJ), (50, MIN), (52, MIN)],
        motif=[(2, 1.5), (0, 0.5), (-2, 2), (0, 1), (2, 3)],
        bass=0.30, harm=0.28, pad=0.24, lead=0.32, spark=0.05,
        harm_style='broken', harm_prog=EPIANO, pad_prog=WARM_PAD,
        bass_prog=BASS_FINGER, lead_prog=EPIANO,
        reverb=0.44, rms_db=-17.4,
    ),
    'hope': dict(
        key=60, beat=0.72, bars=18, scale=MAJOR_SC,
        prog=[(60, MAJ), (67, MAJ), (57, MIN), (65, MAJ)],
        motif=[(4, 1), (7, 1), (9, 1), (11, 1), (9, 2), (7, 2)],
        bass=0.30, harm=0.36, pad=0.26, lead=0.42, spark=0.10,
        harm_style='broken', harm_prog=PIANO, pad_prog=STRINGS,
        lead_prog=FLUTE, spark_prog=CELESTA,
        reverb=0.4, rms_db=-17.0,
    ),
    'tense': dict(
        key=50, beat=0.60, bars=16, scale=MINOR_SC, lead_oct=12,
        prog=[(50, MIN), (58, MAJ), (55, MIN), (57, MIN)],
        motif=[(0, 0.5), (1, 0.5), (0, 0.5), (-1, 1.5)],
        bass=0.34, harm=0.22, pad=0.26, lead=0.24, spark=0.0,
        harm_style='block', harm_prog=PIANO, pad_prog=TREMOLO_STR,
        lead_prog=CLARINET, bass_pattern='offbeat',
        reverb=0.34, rms_db=-17.2,
    ),

    # ---- 下面这些是这一轮补的：原来只有 15 首，场景不够用 ----
    'morning': dict(
        key=67, beat=0.72, bars=16, scale=MAJOR_SC,
        prog=[(67, MAJ), (60, MAJ), (62, MIN), (65, MAJ)],
        motif=[(4, 1), (7, 1), (4, 2), (2, 1), (4, 3)],
        bass=0.26, harm=0.32, pad=0.22, lead=0.36, spark=0.10,
        harm_style='strum', harm_prog=STEEL_GT, bass_prog=BASS_PICK,
        lead_prog=FLUTE, spark_prog=CELESTA,
        reverb=0.38, rms_db=-17.6,
    ),
    'classroom': dict(
        key=60, beat=0.76, bars=16, scale=MAJOR_SC,
        prog=[(60, MAJ), (57, MIN), (53, MAJ), (55, MAJ)],
        motif=[(2, 1), (4, 1), (2, 1), (0, 1), (2, 2)],
        bass=0.20, harm=0.34, pad=0.10, lead=0.30, spark=0.06,
        harm_style='broken', harm_prog=PIANO, pad_prog=STRINGS,
        lead_prog=VIBES, spark_prog=MARIMBA,
        reverb=0.34, rms_db=-17.8,
    ),
    'canteen': dict(
        key=62, beat=0.62, bars=18, scale=MAJOR_SC,
        prog=[(62, MAJ), (67, MAJ), (60, MAJ), (65, MAJ)],
        motif=[(4, 1), (2, 1), (4, 1), (7, 2), (4, 1)],
        bass=0.30, harm=0.34, pad=0.0, lead=0.32, spark=0.10,
        harm_style='strum', harm_prog=STEEL_GT, bass_prog=BASS_PICK,
        lead_prog=MARIMBA, spark_prog=KALIMBA,
        bass_pattern='half', reverb=0.28, rms_db=-17.4,
    ),
    'playground': dict(
        key=65, beat=0.56, bars=20, scale=MAJOR_SC,
        prog=[(65, MAJ), (60, MAJ), (62, MIN), (67, MAJ)],
        motif=[(4, 1), (4, 1), (7, 1), (4, 1), (2, 2), (4, 2)],
        bass=0.34, harm=0.36, pad=0.12, lead=0.36, spark=0.10,
        harm_style='strum', harm_prog=STEEL_GT, bass_prog=BASS_PICK,
        lead_prog=FLUTE, spark_prog=KALIMBA,
        bass_pattern='half', reverb=0.26, rms_db=-17.2,
    ),
    'exam': dict(
        key=57, beat=0.66, bars=16, scale=MINOR_SC, lead_oct=12,
        prog=[(57, MIN), (57, MIN), (53, MAJ), (57, MIN)],
        motif=[(0, 1), (3, 1), (2, 1), (0, 1)],
        bass=0.18, harm=0.22, pad=0.14, lead=0.22, spark=0.0,
        harm_style='block', harm_prog=EPIANO, pad_prog=STRINGS2,
        lead_prog=VIBES, reverb=0.3, rms_db=-18.2,
    ),
    'broadcast': dict(
        key=60, beat=0.82, bars=16, scale=MAJOR_SC,
        prog=[(60, MAJ), (65, MAJ), (57, MIN), (55, MAJ)],
        motif=[(7, 1), (4, 1), (2, 2), (4, 1), (7, 1)],
        bass=0.18, harm=0.18, pad=0.34, lead=0.30, spark=0.06,
        harm_style='sparse', harm_prog=PIANO, pad_prog=STRINGS2,
        lead_prog=VIBES, spark_prog=TUBULAR,
        reverb=0.58, rms_db=-17.8,
    ),
    'goodbye': dict(
        key=57, beat=1.00, bars=14, scale=MINOR_SC, lead_oct=12,
        prog=[(57, MIN), (53, MAJ), (60, MAJ), (55, MAJ)],
        motif=[(4, 2), (2, 1), (0, 3), (-2, 2), (0, 2)],
        bass=0.20, harm=0.22, pad=0.34, lead=0.32,
        harm_style='sparse', harm_prog=PIANO, pad_prog=STRINGS,
        lead_prog=SOLO_VLN, reverb=0.56, rms_db=-18.0,
    ),
    'memory': dict(
        key=65, beat=0.90, bars=16, scale=MAJOR_SC,
        prog=[(65, MAJ), (57, MIN), (58, MAJ), (60, MAJ)],
        motif=[(4, 2), (7, 1), (4, 1), (2, 2), (0, 2)],
        bass=0.18, harm=0.20, pad=0.30, lead=0.32, spark=0.08,
        harm_style='sparse', harm_prog=PIANO, pad_prog=HALO_PAD,
        lead_prog=MUSIC_BOX, spark_prog=CELESTA,
        reverb=0.54, rms_db=-18.0,
    ),
    'home': dict(
        key=60, beat=0.84, bars=16, scale=MAJOR_SC,
        prog=[(60, MAJ), (57, MIN), (53, MAJ), (55, MAJ)],
        motif=[(4, 1), (2, 1), (0, 2), (2, 1), (4, 1)],
        bass=0.22, harm=0.30, pad=0.22, lead=0.32,
        harm_style='strum', harm_prog=NYLON_GT, bass_prog=BASS_FINGER,
        lead_prog=PIANO, reverb=0.40, rms_db=-17.8,
    ),
}

# title.mp3 是用积分生成的 AI 主题曲，固定保留，不参与本地渲染
SKIP = {'title'}


def write_mp3(L, R, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    wav = os.path.join('/tmp', name + '.wav')
    mp3 = os.path.join(OUT_DIR, name + '.mp3')
    sf.write(wav, np.stack([L, R], axis=1), SR, subtype='PCM_16')
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', wav,
                    '-codec:a', 'libmp3lame', '-b:a', '192k',
                    '-ar', '44100', mp3], check=True)
    os.remove(wav)
    return mp3


def main():
    want = sys.argv[1:] or list(SPECS.keys())
    font = SoundFont(FONT_PATH)
    for name in want:
        spec = SPECS.get(name)
        if not spec:
            print('  未知曲目', name)
            continue
        print('- 渲染', name, flush=True)
        rng = np.random.default_rng(zlib.crc32(name.encode()) % (2 ** 31))
        L, R = arrange(spec, font, rng)
        p = write_mp3(L, R, name)
        print('  ->', p, round(len(L) / SR, 1), 'sec', flush=True)


if __name__ == '__main__':
    main()
