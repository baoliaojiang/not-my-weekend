import UnityPy, io, os, sys
from PIL import Image

base = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgfull2'
os.makedirs(out, exist_ok=True)

ids = ['110001', '110013', '110055', '110059', '110077', '110081',
       '100692', '100728', '100773', '110019']

for n in ids:
    p = os.path.join(base, f'plottexturebg_{n}.assetbundle')
    if not os.path.exists(p):
        print('MISS', n)
        continue
    try:
        env = UnityPy.load(io.BytesIO(open(p, 'rb').read()[128:]))
        done = False
        for obj in env.objects:
            if obj.type.name == 'Texture2D':
                img = obj.read().image
                if img:
                    img = img.convert('RGB')
                    dst = os.path.join(out, f'bg_{n}_{img.width}x{img.height}.png')
                    img.save(dst)
                    print('OK', n, img.width, img.height)
                    done = True
                break
        if not done:
            print('NOTEX', n)
    except Exception as e:
        print('ERR', n, e)
