import UnityPy, io, os, contextlib, wave

base = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/music2'
os.makedirs(out, exist_ok=True)

cands = [
    'plot_bgm_calm_01', 'plot_relax_1', 'plot_bgm_citylife_01', 'plot_bgm_business',
    'room_day02', 'plot_bgm_theatre', 'sunsettinseltown', 'shanghaitan',
    'plot_bgm_risingplayer', 'psychodetective', 'gongting', 'plot_bgm_funny_02',
    'plot_bgm_keepyoung', 'relationship'
]
for c in cands:
    p = os.path.join(base, f'audios_dsgcprefabs_interface_music_m_{c}.assetbundle')
    if not os.path.exists(p):
        print('MISS', c); continue
    env = UnityPy.load(io.BytesIO(open(p, 'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name == 'AudioClip':
            a = obj.read()
            for nm, data in a.samples.items():
                fn = os.path.join(out, f'{c}.wav')
                open(fn, 'wb').write(data)
                try:
                    with contextlib.closing(wave.open(fn)) as w:
                        dur = w.getnframes() / w.getframerate()
                        print(f'{c}: {len(data)/1048576:.2f}MB {dur:.1f}s {w.getframerate()}Hz {w.getnchannels()}ch')
                except Exception as e:
                    print(c, 'wavinfo fail', e)
            break
print('done')
