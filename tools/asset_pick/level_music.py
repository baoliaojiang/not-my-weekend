import soundfile as sf, os, numpy as np, glob
dst = r'D:/workbuddy/2026-10-23-16-33-10/assets/music'
TARGET_RMS = -25.0
PEAK_CAP = -2.0
for p in sorted(glob.glob(os.path.join(dst, '*.mp3'))):
    data, sr = sf.read(p, dtype='float32')
    if data.ndim == 1: data = np.stack([data, data], axis=1)
    rms = float(np.sqrt(np.mean(data ** 2))) or 1e-6
    peak = float(np.max(np.abs(data))) or 1e-6
    gain_db = TARGET_RMS - 20*np.log10(rms)
    # 别把峰值推过 PEAK_CAP
    max_gain = PEAK_CAP - 20*np.log10(peak)
    gain_db = min(gain_db, max_gain)
    data = data * (10 ** (gain_db/20))
    sf.write(p, data, sr, format='MP3', subtype='MPEG_LAYER_III')
    rms2 = float(np.sqrt(np.mean(data ** 2)))
    peak2 = float(np.max(np.abs(data)))
    print(f'{os.path.basename(p):26s} gain={gain_db:+.1f}dB peak={20*np.log10(peak2):.1f} rms={20*np.log10(rms2):.1f}')
