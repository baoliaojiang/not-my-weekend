from PIL import Image
import os, io, UnityPy
SRC=r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
BG=r'D:/workbuddy/2026-10-23-16-33-10/assets/backgrounds'
for name,b in {'bg_shop':'plottexturebg_100002.assetbundle','bg_commons':'plottexturebg_100003.assetbundle'}.items():
    env=UnityPy.load(io.BytesIO(open(os.path.join(SRC,b),'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name=='Texture2D':
            img=obj.read().image
            if img:
                img=img.convert('RGB')
                if img.width>1600:
                    img=img.resize((1600,int(img.height*1600/img.width)), Image.LANCZOS)
                img.save(os.path.join(BG,name+'.jpg'),'JPEG',quality=86,optimize=True)
                print(name,img.size)
            break
