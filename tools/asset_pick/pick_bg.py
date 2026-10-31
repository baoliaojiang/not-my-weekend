from PIL import Image
import os, io, sys, UnityPy

SRC = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
OUT = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgcand'
os.makedirs(OUT, exist_ok=True)

ids = sys.argv[1:]
for bgid in ids:
    b = f'plottexturebg_{bgid}.assetbundle'
    p = os.path.join(SRC, b)
    if not os.path.exists(p):
        print('MISS', bgid); continue
    env = UnityPy.load(io.BytesIO(open(p, 'rb').read()[128:]))
    img = None
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            t = obj.read()
            if t.image:
                img = t.image
                break
    if not img:
        print('NOIMG', bgid); continue
    im = img.convert('RGB')
    im.thumbnail((520, 300), Image.LANCZOS)
    out = os.path.join(OUT, f'{bgid}.jpg')
    im.save(out, 'JPEG', quality=86)
    print('ok', bgid, img.size)
