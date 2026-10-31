import UnityPy, io, os, sys, wave, contextlib
base=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/music'
os.makedirs(out, exist_ok=True)
cands=['normalsociety','login','bluedaydream','plot_bgm_richang_01','plot_bgm_calm_01','plot_bgm_calm_02','plot_bgm_silent_01','plot_bgm_sad_1','plot_bgm_girlfortherain','plot_bgm_lanruo','plot_bgm_citylife_01','plot_bgm_keepyoung','relationship','room_day']
for c in cands:
    p=os.path.join(base,f'audios_dsgcprefabs_interface_music_m_{c}.assetbundle')
    if not os.path.exists(p):
        print('MISS',c); continue
    env=UnityPy.load(io.BytesIO(open(p,'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name=='AudioClip':
            a=obj.read()
            for nm,data in a.samples.items():
                fn=os.path.join(out,f'{c}.wav')
                open(fn,'wb').write(data)
                try:
                    with contextlib.closing(wave.open(fn)) as w:
                        dur=w.getnframes()/w.getframerate()
                        print(f'{c}: {len(data)/1048576:.2f}MB {dur:.1f}s {w.getframerate()}Hz {w.getnchannels()}ch')
                except Exception as e:
                    print(c,'wavinfo fail',e)
            break
