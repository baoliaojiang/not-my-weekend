import UnityPy, io, os, sys
base=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgfull'
os.makedirs(out, exist_ok=True)
for name in sys.argv[1:]:
    p=os.path.join(base,f'plottexturebg_{name}.assetbundle')
    if not os.path.exists(p): print('MISS',name); continue
    env=UnityPy.load(io.BytesIO(open(p,'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name=='Texture2D':
            t=obj.read(); img=t.image
            if img:
                fn=os.path.join(out,f'bg_{name}_{img.width}x{img.height}.png')
                img.save(fn); print('OK',name,img.size)
            break
