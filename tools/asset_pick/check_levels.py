"""检测 assets/music 下所有 mp3 的电平与削波情况。"""
import os, glob
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MDIR = os.path.join(ROOT, 'assets', 'music')

def db(x):
    return 20 * np.log10(max(x, 1e-9))

print(f"{'file':28s} {'sr':>6s} {'ch':>2s} {'dur':>6s} {'peak':>7s} {'rms':>7s} {'clip%':>6s} {'>0.99%':>7s}")
for p in sorted(glob.glob(os.path.join(MDIR, '*.mp3'))):
    data, sr = sf.read(p, always_2d=True)
    n, ch = data.shape
    dur = n / sr
    peak = float(np.abs(data).max())
    rms = float(np.sqrt(np.mean(data.astype(np.float64) ** 2)))
    # 削波：连续两次采样都接近满刻度
    flat = data.reshape(-1)
    clip = int(np.sum(np.abs(flat) >= 0.9999))
    hi = int(np.sum(np.abs(flat) > 0.99))
    print(f"{os.path.basename(p):28s} {sr:6d} {ch:2d} {dur:6.1f} {db(peak):7.1f} {db(rms):7.1f} "
          f"{100*clip/len(flat):6.2f} {100*hi/len(flat):7.2f}")
