from PIL import Image
import os, shutil, io, UnityPy

SRC=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
ROOT=r'D:/workbuddy/2026-10-23-16-33-10'
BG=os.path.join(ROOT,'assets','backgrounds')
CH=os.path.join(ROOT,'assets','characters')
os.makedirs(BG,exist_ok=True); os.makedirs(CH,exist_ok=True)

def load_tex(bundle):
    env=UnityPy.load(io.BytesIO(open(os.path.join(SRC,bundle),'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name=='Texture2D':
            t=obj.read()
            if t.image: return t.image
    return None

bgs={
 'bg_gate':'plottexturebg_100058.assetbundle',
 'bg_classroom':'plottexturebg_112003.assetbundle',
 'bg_clubroom':'plottexturebg_112004.assetbundle',
 'bg_street_night':'plottexturebg_100613.assetbundle',
 'bg_city_night':'plottexturebg_114025.assetbundle',
 'bg_corridor':'plottexturebg_112031.assetbundle',
}
for name,b in bgs.items():
    img=load_tex(b)
    if not img: print('MISS BG',name); continue
    img=img.convert('RGB')
    if img.width>1600:
        h=int(img.height*1600/img.width); img=img.resize((1600,h), Image.LANCZOS)
    out=os.path.join(BG,name+'.jpg')
    img.save(out,'JPEG',quality=86,optimize=True)
    print('BG',name,img.size, f'{os.path.getsize(out)/1024:.0f}KB')

chars={
 'shen_yuan':'rolecards_rolecard_liman.assetbundle',
 'zhou_yuqing':'rolecards_rolecard_tiffany.assetbundle',
 'teacher_chen':'rolecards_rolecard_huahuazi.assetbundle',
 'classmate_xu':'rolecards_rolecard_shasha.assetbundle',
 'classmate_zheng':'rolecards_rolecard_haomeng.assetbundle',
}
for name,b in chars.items():
    img=load_tex(b)
    if not img: print('MISS CH',name); continue
    img=img.convert('RGBA')
    if img.height>1400:
        w=int(img.width*1400/img.height); img=img.resize((w,1400), Image.LANCZOS)
    out=os.path.join(CH,name+'.png')
    img.save(out,'PNG',optimize=True)
    print('CH',name,img.size, f'{os.path.getsize(out)/1024:.0f}KB')
