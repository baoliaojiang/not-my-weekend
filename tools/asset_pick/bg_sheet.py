import UnityPy, io, os, glob
from PIL import Image, ImageDraw
base=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgprev'
os.makedirs(out, exist_ok=True)
files=sorted(glob.glob(os.path.join(base,'plottexturebg_*.assetbundle')))
print('total',len(files))
# sample evenly
step=max(1,len(files)//40)
pick=files[::step][:40]
thumbs=[]
for f in pick:
    name=os.path.basename(f).replace('plottexturebg_','').replace('.assetbundle','')
    try:
        env=UnityPy.load(io.BytesIO(open(f,'rb').read()[128:]))
        img=None
        for obj in env.objects:
            if obj.type.name=='Texture2D':
                t=obj.read()
                img=t.image
                if img: break
        if img is None: continue
        img=img.convert('RGB')
        th=img.copy(); th.thumbnail((320,180))
        thumbs.append((name,th,img.size))
    except Exception as e:
        print('ERR',name,repr(e)[:60])
print('exported',len(thumbs))
cols,rows=4,5
for s in range(0,len(thumbs),cols*rows):
    chunk=thumbs[s:s+cols*rows]
    sheet=Image.new('RGB',(cols*320, rows*200),(20,20,20))
    d=ImageDraw.Draw(sheet)
    for i,(name,th,sz) in enumerate(chunk):
        x=(i%cols)*320; y=(i//cols)*200
        sheet.paste(th,(x,y+18))
        d.text((x+4,y+3), f'{name} {sz[0]}x{sz[1]}', fill=(255,255,255))
    p=os.path.join(out,f'sheet_{s//(cols*rows)}.png')
    sheet.save(p); print('sheet',p)
