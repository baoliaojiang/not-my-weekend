# -*- coding: utf-8 -*-
"""重新合成 UI 音效。
原则：
· 不用噪声冲击、不用方波边沿，全部是平滑正弦叠加；
· 起音至少 6ms 渐变，收尾走指数衰减，听感是"轻点一下"而不是"磕一下"；
· 峰值统一压到 0.30 上下，避免在手机外放上炸耳朵。
"""
import math, struct, wave, os

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')

def env(i, n, attack, decay_tau):
    """前段线性渐入，后段指数衰减；不会出现 0→1 的瞬跳。"""
    a = max(1, int(attack * SR))
    if i < a:
        return i / a
    return math.exp(-(i - a) / (decay_tau * SR))

def tone(freq, dur, attack=0.008, decay=0.10, amp=0.5, harm=(1.0, 0.18, 0.06)):
    n = int(dur * SR)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        s = 0.0
        for k, w in enumerate(harm, start=1):
            s += w * math.sin(2 * math.pi * freq * k * t)
        out[i] = s * env(i, n, attack, decay) * amp
    return out

def glide(f0, f1, dur, attack=0.008, decay=0.09, amp=0.5, harm=(1.0, 0.14)):
    n = int(dur * SR)
    out = [0.0] * n
    ph = 0.0
    for i in range(n):
        t = i / SR
        f = f0 + (f1 - f0) * (i / max(1, n - 1))
        ph += 2 * math.pi * f / SR
        s = 0.0
        for k, w in enumerate(harm, start=1):
            s += w * math.sin(ph * k)
        out[i] = s * env(i, n, attack, decay) * amp
    return out

def mix(*layers):
    n = max(len(x) for x in layers)
    out = [0.0] * n
    for lay, off in layers:
        pass
    return out

def overlay(base, extra, offset=0):
    n = max(len(base), len(extra) + offset)
    out = base + [0.0] * (n - len(base))
    for i, v in enumerate(extra):
        out[i + offset] += v
    return out

def lowpass(x, cutoff=6500.0):
    """一阶低通：削掉高频毛刺，让音色柔一点。"""
    rc = 1.0 / (2 * math.pi * cutoff)
    dt = 1.0 / SR
    a = dt / (rc + dt)
    y = 0.0
    out = []
    for v in x:
        y += a * (v - y)
        out.append(y)
    return out

def fade_tail(x, ms=12):
    n = int(ms / 1000 * SR)
    n = min(n, len(x))
    for i in range(n):
        x[len(x) - 1 - i] *= i / n
    return x

def write(name, data, peak=0.30):
    m = max(abs(v) for v in data) or 1.0
    g = peak / m
    frames = bytearray()
    for v in data:
        s = int(max(-1.0, min(1.0, v * g)) * 32767)
        frames += struct.pack('<h', s)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(bytes(frames))
    print('write', name, '%.3fs' % (len(data) / SR))

# 点击：一个很短的柔和小点，不敲
click = tone(1180, 0.055, attack=0.007, decay=0.020, amp=0.6, harm=(1.0, 0.10, 0.0))
write('click.wav', fade_tail(lowpass(click, 5200), 8), peak=0.20)

# 翻页：两声轻微的下行，像纸滑过去
p1 = tone(760, 0.10, attack=0.010, decay=0.045, amp=0.5, harm=(1.0, 0.12))
p2 = tone(560, 0.16, attack=0.012, decay=0.070, amp=0.45, harm=(1.0, 0.10))
write('page.wav', fade_tail(lowpass(overlay(p1, p2, int(0.055 * SR)), 4200), 18), peak=0.26)

# 选中：上行的两音，确认感
s1 = tone(880, 0.09, attack=0.008, decay=0.040, amp=0.5, harm=(1.0, 0.12))
s2 = tone(1320, 0.18, attack=0.010, decay=0.080, amp=0.42, harm=(1.0, 0.10))
write('select.wav', fade_tail(lowpass(overlay(s1, s2, int(0.050 * SR)), 5000), 16), peak=0.27)

# 通知：三个温和的音，像远处的一声铃，不带冲击
n1 = tone(659, 0.34, attack=0.012, decay=0.150, amp=0.42, harm=(1.0, 0.16, 0.05))
n2 = tone(988, 0.42, attack=0.014, decay=0.190, amp=0.34, harm=(1.0, 0.14, 0.04))
n3 = tone(1319, 0.30, attack=0.016, decay=0.130, amp=0.20, harm=(1.0, 0.10))
seq = overlay(n1, n2, int(0.085 * SR))
seq = overlay(seq, n3, int(0.170 * SR))
write('notify.wav', fade_tail(lowpass(seq, 4600), 26), peak=0.28)

print('done')
