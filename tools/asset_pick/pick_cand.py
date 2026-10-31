from PIL import Image
import os, io, sys, UnityPy

SRC = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
OUT = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/cand'
os.makedirs(OUT, exist_ok=True)

names = sys.argv[1:]

def load(bundle):
    env = UnityPy.load(io.BytesIO(open(os.path.join(SRC, bundle), 'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            t = obj.read()
            if t.image:
                return t.image
    return None

for n in names:
    img = load(f'rolecards_rolecard_{n}.assetbundle')
    if not img:
        print('MISS', n); continue
    im = img.convert('RGB')
    im.thumbnail((420, 620), Image.LANCZOS)
    p = os.path.join(OUT, n + '.jpg')
    im.save(p, 'JPEG', quality=88)
    print('ok', n, img.size)
