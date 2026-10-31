import soundfile as sf, os, numpy as np

pairs = [
    # (源 wav, 输出 mp3)
    ('music', 'normalsociety', 'title_normalsociety'),
    ('music', 'plot_bgm_richang_01', 'daily_richang'),
    ('music', 'plot_bgm_calm_02', 'calm'),
    ('music', 'plot_bgm_silent_01', 'silent'),
    ('music', 'plot_bgm_girlfortherain', 'rain'),
    ('music', 'bluedaydream', 'daydream'),
    ('music2', 'plot_bgm_calm_01', 'calm2'),
    ('music2', 'plot_relax_1', 'relax'),
    ('music2', 'plot_bgm_citylife_01', 'city'),
    ('music2', 'plot_bgm_business', 'office'),
    ('music2', 'room_day02', 'room'),
    ('music2', 'plot_bgm_theatre', 'hall'),
    ('music2', 'sunsettinseltown', 'sunset'),
    ('music2', 'shanghaitan', 'night_street'),
    ('music2', 'plot_bgm_risingplayer', 'hope'),
    ('music2', 'psychodetective', 'tense'),
]
root = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick'
dst = r'D:/workbuddy/2026-10-23-16-33-10/assets/music'

TARGET_DB = -4.0   # 峰值统一到 -4 dBFS，留出余量，避免叠加音效时炸麦
LIMIT_DB = -1.0    # 绝对上限

for srcdir, name, out in pairs:
    p = os.path.join(root, srcdir, name + '.wav')
    if not os.path.exists(p):
        print('MISS', p); continue
    data, sr = sf.read(p, dtype='float32')
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    # 去直流
    data = data - data.mean(axis=0, keepdims=True)
    peak = float(np.max(np.abs(data))) or 1.0
    # 超过 0dBFS 的（本来就削顶的）先压平再提，避免把失真放大
    target = 10 ** (TARGET_DB / 20)
    if peak > target:
        data = data * (target / peak)
    # 软限幅：超过 LIMIT 的部分用 tanh 收一下
    limit = 10 ** (LIMIT_DB / 20)
    data = np.tanh(data / limit) * limit
    # 循环点淡入淡出（1.2 秒），防止接缝爆音
    n = min(int(sr * 1.2), len(data) // 4)
    if n > 0:
        f = np.linspace(0, 1, n, dtype='float32')[:, None]
        data[:n] *= f
        data[-n:] *= f[::-1]
    out_path = os.path.join(dst, out + '.mp3')
    sf.write(out_path, data, sr, format='MP3', subtype='MPEG_LAYER_III')
    rms = float(np.sqrt(np.mean(data ** 2)))
    print(f'{out}.mp3  {os.path.getsize(out_path)/1048576:.2f}MB  peak={20*np.log10(max(float(np.max(np.abs(data))),1e-6)):.1f}dB  rms={20*np.log10(max(rms,1e-6)):.1f}dB')
print('done')
