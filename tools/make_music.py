"""自制背景音乐：用加法合成写 16 段氛围循环。

为什么不用现成专辑：原来那批曲子是《璀璨星途》的原声，只作占位。
现在改成自己合成的原创段落，没有版权问题，也能按剧情情绪调音色。

思路很朴素：
  · 一层低频 pad（长音，撑住和声）
  · 一层琶音（分解和弦，提供流动感）
  · 一层点缀（稀疏的高音，避免单调）
  · 简单混响（延迟抽头叠加，不引第三方库）

输出 wav，再用 ffmpeg 转 mp3。

用法：
  python tools/make_music.py            # 全部重做
  python tools/make_music.py calm rain  # 只做指定几首
"""
import math
import os
import subprocess
import sys
import wave

import numpy as np

SR = 44100
OUT_DIR = 'assets/music'

# ---------- 基础工具 ----------

def midi_to_freq(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


def adsr(n, a, d, s, r, sr=SR):
    """包络：起音 / 衰减 / 保持 / 释放，长度不足时自动截断"""
    env = np.ones(n, np.float32)
    ai = min(int(a * sr), n)
    di = min(int(d * sr), max(n - ai, 0))
    ri = min(int(r * sr), max(n - ai - di, 0))
    if ai:
        env[:ai] = np.linspace(0, 1, ai) ** 1.4
    if di:
        env[ai:ai + di] = np.linspace(1, s, di)
    hold_end = n - ri
    if hold_end > ai + di:
        env[ai + di:hold_end] = s
    if ri:
        env[hold_end:] = np.linspace(s, 0, n - hold_end) ** 1.2
    return env


def voice(freq, dur, amp=0.2, kind='sine', a=0.02, d=0.5, s=0.6, r=0.9,
          detune=0.0, sr=SR):
    """单个音。kind 决定泛音配比，detune 给一点厚度。"""
    n = int(dur * sr)
    if n <= 0:
        return np.zeros(0, np.float32)
    t = np.arange(n, dtype=np.float32) / sr
    f = freq * (1.0 + detune)
    if kind == 'sine':
        w = np.sin(2 * np.pi * f * t)
    elif kind == 'tri':
        w = 2 * np.abs(2 * ((f * t) % 1.0) - 1) - 1
    elif kind == 'bell':
        w = (np.sin(2 * np.pi * f * t) * 1.0
             + np.sin(2 * np.pi * f * 2 * t) * 0.28
             + np.sin(2 * np.pi * f * 3.01 * t) * 0.12)
        w = w / 1.4
    elif kind == 'soft':      # 柔和的锯齿近似：叠几个奇次泛音
        w = (np.sin(2 * np.pi * f * t) * 1.0
             + np.sin(2 * np.pi * f * 3 * t) * 0.16
             + np.sin(2 * np.pi * f * 5 * t) * 0.07)
        w = w / 1.2
    else:
        w = np.sin(2 * np.pi * f * t)
    return (w * adsr(n, a, d, s, r, sr) * amp).astype(np.float32)


def piano(freq, dur, amp=0.2, vel=0.85):
    """加性合成钢琴。
    三件事决定了它像不像琴：
      · 非谐分音 fk = f*k*sqrt(1+B*k^2)（B 是琴弦刚度）
      · 高次分音衰减更快（敲下去那一瞬间亮，很快只剩基频）
      · 起音处一小段噪声，模拟琴槌打在弦上
    """
    n = int((dur + 1.4) * SR)
    if n <= 0:
        return np.zeros(1, np.float32)
    t = np.arange(n) / SR
    out = np.zeros(n, np.float32)
    B = 0.0004
    for k in range(1, 9):
        fk = freq * k * math.sqrt(1.0 + B * k * k)
        if fk > SR * 0.45:
            break
        amp_k = 1.0 / (k ** 1.15)
        decay = 2.0 + 1.4 * k
        env_k = np.exp(-t * decay / (dur * 0.9 + 0.35))
        out += (np.sin(2 * np.pi * fk * t + 0.35 * k) * amp_k * env_k).astype(np.float32)
    # 锤击噪声：极短，只为了给起音一点"毛边"
    rng = np.random.default_rng(int(freq) % 9973)
    click = (rng.standard_normal(n).astype(np.float32) * np.exp(-t * 120) * 0.05)
    env = adsr(n, 0.003, 0.4, 0.20, 1.1)
    return ((out + click) * env * amp * vel).astype(np.float32)


def add(buf, sig, at):
    """把 sig 叠加到 buf 的 at 秒处（越界自动截断）"""
    i = int(at * SR)
    if i >= len(buf) or i < 0:
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n]


def reverb(buf, taps=((0.031, 0.32), (0.052, 0.24), (0.083, 0.18), (0.127, 0.12),
                      (0.191, 0.08)), wet=0.42):
    """抽头延迟混响：够用、够轻，不依赖 scipy 的卷积"""
    out = buf.copy()
    for delay, gain in taps:
        d = int(delay * SR)
        if d >= len(buf):
            continue
        out[d:] += buf[:-d] * gain
    return buf * (1 - wet) + out * wet


def lowpass(buf, cutoff=5200.0):
    """一阶低通，压掉合成波形的高频毛刺（用 lfilter，别用 Python 循环）"""
    from scipy.signal import lfilter
    a = math.exp(-2 * math.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], buf).astype(np.float32)


def air(buf, amount=0.16):
    """补一点空气感：把高通残差轻轻叠回去，避免整体发闷"""
    from scipy.signal import lfilter
    hp = lfilter([0.92, -0.92], [1, -0.94], buf)[2:].astype(np.float32)
    out = buf.copy()
    out[2:] += hp * amount
    return out


def normalize(buf, rms_db=-17.0, peak_db=-2.0):
    if not len(buf):
        return buf
    rms = math.sqrt(float(np.mean(buf ** 2)) + 1e-12)
    target = 10 ** (rms_db / 20)
    buf = buf * (target / rms)
    peak = float(np.max(np.abs(buf))) + 1e-9
    lim = 10 ** (peak_db / 20)
    if peak > lim:
        buf = buf * (lim / peak)
    fade = int(0.9 * SR)
    if len(buf) > 2 * fade:
        buf[:fade] *= np.linspace(0, 1, fade) ** 1.2
        buf[-fade:] *= np.linspace(1, 0, fade) ** 1.2
    return buf


def write_mp3(buf, name, bitrate='80k'):
    os.makedirs(OUT_DIR, exist_ok=True)
    wav_path = os.path.join(OUT_DIR, name + '.wav')
    mp3_path = os.path.join(OUT_DIR, name + '.mp3')
    data = np.clip(buf, -1, 1)
    stereo = np.stack([data, data], axis=1)
    pcm = (stereo * 32767).astype('<i2')
    with wave.open(wav_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    ff = _ffmpeg()
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', wav_path,
                    '-codec:a', 'libmp3lame', '-b:a', bitrate, mp3_path], check=True)
    os.remove(wav_path)
    print(f'  {name}.mp3  {os.path.getsize(mp3_path)//1024} KB')


_FF = None
def _ffmpeg():
    global _FF
    if _FF:
        return _FF
    import imageio_ffmpeg
    _FF = imageio_ffmpeg.get_ffmpeg_exe()
    return _FF


# ---------- 段落生成 ----------

# 和弦用 midi 音高写。全部走自然音阶，避免出现不协和的增四度。
CHORDS = {
    'C':  [48, 55, 60, 64, 67],
    'Am': [45, 52, 57, 60, 64],
    'F':  [41, 53, 57, 60, 65],
    'G':  [43, 50, 55, 59, 62],
    'Dm': [38, 50, 53, 57, 62],
    'Em': [40, 52, 55, 59, 64],
    'Bb': [46, 53, 58, 62, 65],
    'Eb': [39, 51, 55, 58, 63],
}


def build(spec):
    """按 spec 拼一段循环音乐"""
    bars = spec.get('bars', 16)
    beat = spec.get('beat', 0.75)      # 每拍秒数（80 BPM 左右）
    beats_per_bar = spec.get('beats_per_bar', 4)
    total = bars * beats_per_bar * beat
    buf = np.zeros(int(total * SR) + SR * 3, np.float32)

    prog = spec['prog']
    pad_kind = spec.get('pad_kind', 'soft')
    pad_amp = spec.get('pad_amp', 0.11)
    arp_kind = spec.get('arp_kind', 'piano')
    arp_amp = spec.get('arp_amp', 0.13)
    arp_div = spec.get('arp_div', 2)   # 每拍几个音
    sparkle = spec.get('sparkle', 0.0)
    bass_amp = spec.get('bass_amp', 0.12)

    for b in range(bars):
        name = prog[b % len(prog)]
        notes = CHORDS[name]
        bar_t = b * beats_per_bar * beat

        # pad：整小节长音，稍微提前收尾，避免拖到下一小节
        for j, m in enumerate(notes[1:]):
            v = voice(midi_to_freq(m), beats_per_bar * beat * 1.05,
                      amp=pad_amp * (1.0 - j * 0.10), kind=pad_kind,
                      a=0.5, d=1.2, s=0.72, r=1.6,
                      detune=0.0007 if j % 2 else -0.0007)
            add(buf, v, bar_t)

        # bass：根音，每两拍一次
        root = notes[0] - 12
        for k in range(0, beats_per_bar, 2):
            add(buf, voice(midi_to_freq(root), beat * 2.0, amp=bass_amp,
                           kind='sine', a=0.05, d=0.6, s=0.5, r=1.0),
                bar_t + k * beat)

        # 琶音：和弦音上行循环
        step = beat / arp_div
        seq = notes[2:] + notes[1:2]
        cnt = int(beats_per_bar * arp_div)
        for i in range(cnt):
            m = seq[i % len(seq)] + 12
            amp = arp_amp * (0.75 + 0.25 * ((i % 4) == 0))
            if arp_kind == 'piano':
                vel = 0.78 + 0.22 * (((i * 7 + b * 3) % 5) / 4.0)   # 确定的力度起伏，不用随机数
                add(buf, piano(midi_to_freq(m), step * 2.4, amp=amp, vel=vel),
                    bar_t + i * step + (0.004 if i % 2 else 0.0))
            else:
                add(buf, voice(midi_to_freq(m), step * 2.4, amp=amp, kind=arp_kind,
                               a=0.008, d=0.35, s=0.25, r=1.1),
                    bar_t + i * step)

        # 点缀：很稀疏的几个高音
        if sparkle > 0 and b % 4 == 2:
            m = notes[-1] + 24
            add(buf, voice(midi_to_freq(m), beat * 3.0, amp=sparkle,
                           kind='bell', a=0.01, d=1.0, s=0.1, r=2.0),
                bar_t + beat * 1.5)

    buf = buf[:int(total * SR)]
    buf = reverb(buf, wet=spec.get('wet', 0.44))
    buf = lowpass(buf, spec.get('cutoff', 6000))
    buf = air(buf, spec.get('air', 0.16))
    return normalize(buf, spec.get('rms_db', -17.0))


# 16 段：分别是标题、日常、安静、沉默、雨前、白日梦……
SPECS = {
    'title_normalsociety': dict(prog=['C', 'Am', 'F', 'G'], bars=16, beat=0.78,
                                pad_amp=0.17, arp_amp=0.09, sparkle=0.05,
                                arp_kind='bell', wet=0.5),
    'daily_richang': dict(prog=['F', 'G', 'C', 'Am'], bars=16, beat=0.62,
                          pad_amp=0.13, arp_amp=0.12, arp_div=2, arp_kind='tri',
                          bass_amp=0.13, wet=0.32),
    'calm': dict(prog=['Am', 'F', 'C', 'G'], bars=12, beat=0.92,
                 pad_amp=0.18, arp_amp=0.06, arp_div=1, wet=0.56, cutoff=3800),
    'calm2': dict(prog=['Em', 'C', 'G', 'Dm'], bars=12, beat=0.95,
                  pad_amp=0.17, arp_amp=0.055, arp_div=1, wet=0.58, cutoff=3600),
    'silent': dict(prog=['Am', 'Em', 'Am', 'Em'], bars=10, beat=1.15,
                   pad_amp=0.2, arp_amp=0.03, arp_div=1, bass_amp=0.1,
                   wet=0.6, cutoff=2800),
    'rain': dict(prog=['Dm', 'Am', 'Bb', 'F'], bars=12, beat=0.88,
                 pad_amp=0.16, arp_amp=0.07, arp_kind='sine', wet=0.55,
                 cutoff=3200, sparkle=0.03),
    'daydream': dict(prog=['F', 'Am', 'Eb', 'Bb'], bars=14, beat=0.82,
                     pad_amp=0.15, arp_amp=0.1, sparkle=0.06, arp_kind='bell',
                     wet=0.6),
    'relax': dict(prog=['C', 'G', 'Am', 'F'], bars=12, beat=0.72,
                  pad_amp=0.12, arp_amp=0.11, arp_kind='bell', wet=0.36),
    'city': dict(prog=['Em', 'Dm', 'C', 'G'], bars=14, beat=0.66,
                 pad_amp=0.12, arp_amp=0.1, bass_amp=0.15, wet=0.3),
    'office': dict(prog=['C', 'F', 'G', 'C'], bars=12, beat=0.7,
                   pad_amp=0.1, arp_amp=0.07, arp_div=1, wet=0.26, cutoff=4200),
    'room': dict(prog=['Am', 'C', 'F', 'G'], bars=10, beat=0.9,
                 pad_amp=0.16, arp_amp=0.05, arp_div=1, wet=0.5, cutoff=3400),
    'hall': dict(prog=['C', 'Am', 'F', 'G'], bars=12, beat=0.84,
                 pad_amp=0.2, arp_amp=0.05, arp_div=1, wet=0.66, cutoff=4600),
    'sunset': dict(prog=['F', 'C', 'G', 'Am'], bars=12, beat=0.86,
                   pad_amp=0.16, arp_amp=0.08, sparkle=0.05, wet=0.5),
    'night_street': dict(prog=['Am', 'F', 'Dm', 'Em'], bars=14, beat=0.8,
                         pad_amp=0.17, arp_amp=0.07, bass_amp=0.14, wet=0.52,
                         cutoff=3200),
    'hope': dict(prog=['C', 'G', 'Am', 'F'], bars=14, beat=0.74,
                 pad_amp=0.16, arp_amp=0.12, sparkle=0.07, arp_kind='bell',
                 wet=0.46),
    'tense': dict(prog=['Dm', 'Eb', 'Dm', 'Am'], bars=12, beat=0.62,
                  pad_amp=0.19, arp_amp=0.06, arp_div=4, bass_amp=0.16,
                  wet=0.34, cutoff=3000),
}


# 输出文件名：前两首早年叫过别的名字，表里已统一成 title / daily
NAME_MAP = {'title_normalsociety': 'title', 'daily_richang': 'daily'}


def main():
    want = sys.argv[1:]
    names = want if want else list(SPECS.keys())
    print(f'合成 {len(names)} 段音乐…')
    for name in names:
        spec = SPECS.get(name)
        if not spec:
            print(f'  跳过未知曲目 {name}')
            continue
        print(f'- {name}')
        write_mp3(build(spec), NAME_MAP.get(name, name))


if __name__ == '__main__':
    main()
