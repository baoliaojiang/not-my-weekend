import soundfile as sf, os, numpy as np
src=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/music'
dst=r'D:/workbuddy/2026-10-23-16-33-10/assets/music'
os.makedirs(dst, exist_ok=True)
m={'normalsociety':'title_normalsociety','plot_bgm_richang_01':'daily_richang','plot_bgm_calm_02':'calm','plot_bgm_silent_01':'silent','plot_bgm_girlfortherain':'rain','bluedaydream':'daydream'}
for s,o in m.items():
    p=os.path.join(src,s+'.wav')
    if not os.path.exists(p): print('MISS',s); continue
    data, sr = sf.read(p, dtype='float32')
    out=os.path.join(dst,o+'.ogg')
    sf.write(out, data, sr, format='OGG', subtype='VORBIS')
    print(f'{o}.ogg {os.path.getsize(out)/1048576:.2f}MB')
