import UnityPy, io, os, sys
base=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/preview2'
os.makedirs(out, exist_ok=True)
prefix=sys.argv[1]
for name in sys.argv[2:]:
    p=os.path.join(base,f'{prefix}{name}.assetbundle')
    if not os.path.exists(p): print('MISS',name); continue
    try:
        env=UnityPy.load(io.BytesIO(open(p,'rb').read()[128:]))
        n=0
        for obj in env.objects:
            if obj.type.name=='Texture2D':
                t=obj.read()
                img=t.image
                if img is None: continue
                fn=os.path.join(out,f'{name}_{n}_{t.m_Width}x{t.m_Height}.png')
                img.save(fn); n+=1
        print('OK',name,n)
    except Exception as e:
        print('ERR',name,repr(e)[:100])
