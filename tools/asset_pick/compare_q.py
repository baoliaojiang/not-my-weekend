"""对比源 wav 与导出 mp3，判断音质损失在哪。"""
import os
import numpy as np
import soundfile as sf

ROOT = r'D:/workbuddy/2026-10-23-16-33-10'
pairs = [
    ('tools/asset_pick/music/normalsociety.wav', 'assets/music/title_normalsociety.mp3'),
    ('tools/asset_pick/music2/plot_relax_1.wav', 'assets/music/relax.mp3'),
    ('tools/asset_pick/music2/psychodetective.wav', 'assets/music/tense.mp3'),
    ('tools/asset_pick/music/plot_bgm_calm_02.wav', 'assets/music/calm.mp3'),
]


def stats(x):
    peak = float(np.abs(x).max())
    clip = float(np.mean(np.abs(x) >= 0.999))
    # 高频能量占比（简单差分能量）
    d = np.diff(x.mean(axis=1))
    hf = float(np.sqrt(np.mean(d ** 2)) / (np.sqrt(np.mean(x.mean(axis=1) ** 2)) + 1e-9))
    return peak, clip, hf


for src, dst in pairs:
    a, sr1 = sf.read(os.path.join(ROOT, src), always_2d=True, dtype='float32')
    b, sr2 = sf.read(os.path.join(ROOT, dst), always_2d=True, dtype='float32')
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    pa, ca, ha = stats(a)
    pb, cb, hb = stats(b)
    # 对齐后的误差（mp3 有编码延迟，用互相关找最佳偏移）
    ch = a.mean(axis=1)
    bh = b.mean(axis=1)
    seg = min(len(ch), sr1 * 8)
    best, bestlag = -9, 0
    for lag in range(0, 3000):
        s2 = bh[lag:lag + seg]
        if len(s2) < seg:
            break
        c = float(np.corrcoef(ch[:seg], s2)[0, 1])
        if c > best:
            best, bestlag = c, lag
    print(f'{os.path.basename(dst):26s} lag={bestlag:4d} corr={best:.4f} '
          f'src peak={pa:.3f} hf={ha:.3f} | mp3 peak={pb:.3f} hf={hb:.3f} clip%={cb*100:.3f}')
