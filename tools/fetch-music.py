"""抓取 Kevin MacLeod（incompetech.com, CC BY 4.0）的曲目，做成游戏用的循环 BGM。

为什么换掉自己合成的那批：
  程序合成 + SoundFont 出来的 24 首共用一套编曲模板，音色、密度、长度全都一样，
  听感上是"同一首换了调"，这就是"每首都差不多且难听"的根因。
  这里改用真实录音的授权曲库，按场景描述一首一首挑，来源可查、可商用。

处理链（不依赖 ffmpeg）：
  mp3 解码(miniaudio) → 取中段 64 秒 → 首尾 2 秒交叉淡化（循环无缝）
  → RMS 归一到 -21 dBFS、真峰值压到 -3 dBFS 以下 → lameenc 128kbps 输出

用法：
  python tools/fetch-music.py            # 按 build/_pick.json 全量
  python tools/fetch-music.py calm tense # 只处理指定几首
"""
import io
import json
import os
import sys
import urllib.parse
import urllib.request

import numpy as np
import lameenc
import miniaudio

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICK = os.path.join(ROOT, 'build', '_pick.json')
OUT_DIR = os.path.join(ROOT, 'assets', 'music')
CACHE = os.path.join(ROOT, 'build', '_kmcache')

BASE = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/'
LOOP_SEC = 64.0
XFADE_SEC = 2.0
RMS_TARGET = -21.0
PEAK_CEIL = -3.0


def download(fn):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, fn)
    if os.path.exists(path) and os.path.getsize(path) > 100_000:
        return path
    url = BASE + urllib.parse.quote(fn)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (zbgm-music-fetch)'})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    if len(data) < 50_000:
        raise RuntimeError(f'下载过短({len(data)}B)：{url}')
    with open(path, 'wb') as f:
        f.write(data)
    return path


def decode(path):
    dec = miniaudio.decode_file(path, output_format=miniaudio.SampleFormat.SIGNED16,
                               nchannels=2, sample_rate=44100)
    pcm = np.frombuffer(dec.samples, dtype=np.int16).astype(np.float32) / 32768.0
    return pcm.reshape(-1, 2), dec.sample_rate


def loopify(x, sr):
    """取中段并做首尾交叉淡化，得到可直接 loop 的片段"""
    n = int(LOOP_SEC * sr)
    xf = int(XFADE_SEC * sr)
    if len(x) < n + xf:
        # 太短就整段用，尾部补静音
        seg = np.zeros((n + xf, 2), dtype=np.float32)
        seg[:len(x)] = x
    else:
        start = min(int(len(x) * 0.25), len(x) - n - xf)
        start = max(0, start)
        seg = x[start:start + n + xf].copy()

    out = seg[:n].copy()
    ramp = np.linspace(0.0, 1.0, xf, dtype=np.float32)[:, None]
    out[:xf] = out[:xf] * ramp + seg[n:n + xf] * (1.0 - ramp)
    return out


def normalize(x):
    rms = float(np.sqrt(np.mean(x ** 2)) + 1e-9)
    gain = 10 ** (RMS_TARGET / 20.0) / rms
    x = x * gain
    peak = float(np.max(np.abs(x))) + 1e-9
    ceil = 10 ** (PEAK_CEIL / 20.0)
    if peak > ceil:
        x = x * (ceil / peak)
    return x


def encode_mp3(x, sr, out_path):
    pcm = np.clip(x, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype('<i2').tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(128)
    enc.set_in_sample_rate(sr)
    enc.set_channels(2)
    enc.set_quality(2)
    data = enc.encode(pcm) + enc.flush()
    with open(out_path, 'wb') as f:
        f.write(data)
    return len(data)


def main():
    pick = json.load(io.open(PICK, encoding='utf-8'))
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    names = only or list(pick)
    os.makedirs(OUT_DIR, exist_ok=True)
    ok = 0
    for name in names:
        info = pick.get(name)
        if not info:
            print('跳过未知场景', name)
            continue
        try:
            src = download(info['file'])
            pcm, sr = decode(src)
            y = normalize(loopify(pcm, sr))
            dst = os.path.join(OUT_DIR, name + '.mp3')
            size = encode_mp3(y, sr, dst)
            print(f'✓ {name:13s} ← {info["title"][:26]:26s} {len(pcm)/sr:6.1f}s → 64s  {size/1024:6.0f}KB')
            ok += 1
        except Exception as e:
            print(f'✗ {name:13s} {e}')
    print(f'\n完成 {ok}/{len(names)}')


if __name__ == '__main__':
    main()
