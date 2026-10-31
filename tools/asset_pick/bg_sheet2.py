import UnityPy, io, os, glob
from PIL import Image, ImageDraw
base=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out=r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgprev2'
os.makedirs(out, exist_ok=True)
files=sorted(glob.glob(os.path.join(base,'plottexturebg_*.assetbundle')))
step=max(1,len(files)//120)
pick=files[::step]
print('sampling',len(pick),'step',step)
thumbs=[]
for f in pick:
    name=os.path.basename(f).replace('plottexturebg_','').replace('.assetbundle','')
    try:
        env=UnityPy.load(io.BytesIO(open(f,'rb').read()[128:]))
        for obj in env.objects:
            if obj.type.name=='Texture2D':
                t=obj.read(); img=t.image
                if img:
                    img=img.convert('RGB'); th=img.copy(); th.thumbnail((300,170))
                    thumbs.append((name,th))
                break
    except Exception: pass
print('got',len(thumbs))
cols,rows=6,4
for s in range(0,len(thumbs),cols*rows):
    chunk=thumbs[s:s+cols*rows]
    sheet=Image.new('RGB',(cols*300, rows*192),(15,15,15))
    d=ImageDraw.Draw(sheet)
    for i,(name,th) in enumerate(chunk):
        x=(i%cols)*300; y=(i//cols)*192
        sheet.paste(th,(x,y+18)); d.text((x+3,y+3),name,fill=(255,255,0))
    sheet.save(os.path.join(out,f's{s//(cols*rows)}.png'))
print('sheets done', (len(thumbs)+cols*rows-1)//(cols*rows))
