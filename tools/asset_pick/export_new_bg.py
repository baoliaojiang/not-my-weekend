import UnityPy, io, os, json
from PIL import Image, ImageEnhance

base = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
proj = r'D:/workbuddy/2026-10-23-16-33-10'
idx = json.load(open(os.path.join(proj, 'tools/asset_pick/bgall/index.json')))
idx = {int(k): v for k, v in idx.items()}

picks = {0: 'shop_new', 431: 'office', 1: 'classroom', 438: 'corridor'}
os.makedirs(os.path.join(proj, 'tools/asset_pick/oldbg'), exist_ok=True)

for i, tag in picks.items():
    name = idx[i]
    p = os.path.join(base, f'plottexturebg_{name}.assetbundle')
    env = UnityPy.load(io.BytesIO(open(p, 'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            img = obj.read().image
            if not img:
                continue
            img = img.convert('RGB')
            if img.width > 1920:
                img = img.resize((1920, round(img.height * 1920 / img.width)), Image.LANCZOS)
            elif img.width < 1280:
                s = 1280 / img.width
                img = img.resize((1280, round(img.height * s)), Image.LANCZOS)
            out = os.path.join(proj, f'tools/asset_pick/oldbg/{tag}_{name}.jpg')
            img.save(out, quality=90)
            print('OK', i, name, img.size, out)
            break
