import soundfile as sf, os, numpy as np

src = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/music2'
dst = r'D:/workbuddy/2026-10-23-16-33-10/assets/music'
os.makedirs(dst, exist_ok=True)

m = {
    'plot_bgm_calm_01': 'calm2',
    'plot_relax_1': 'relax',
    'plot_bgm_citylife_01': 'city',
    'plot_bgm_business': 'office',
    'room_day02': 'room',
    'plot_bgm_theatre': 'hall',
    'sunsettinseltown': 'sunset',
    'shanghaitan': 'night_street',
    'plot_bgm_risingplayer': 'hope',
    'psychodetective': 'tense',
}
total = 0
for s, o in m.items():
    p = os.path.join(src, s + '.wav')
    if not os.path.exists(p):
        print('MISS', s); continue
    data, sr = sf.read(p, dtype='float32')
    # 2 秒淡出，避免循环接缝处爆音
    n = min(int(sr * 2.0), len(data))
    if n > 0:
        fade = np.linspace(1, 0.0, n, dtype='float32')[:, None]
        data[-n:] = data[-n:] * fade
    out = os.path.join(dst, o + '.mp3')
    sf.write(out, data, sr, format='MP3', subtype='MPEG_LAYER_III')
    sz = os.path.getsize(out); total += sz
    print(f'{o}.mp3 {sz/1048576:.2f}MB')
print('total %.1f MB' % (total / 1048576))
