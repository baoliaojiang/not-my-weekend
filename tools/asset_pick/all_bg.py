import UnityPy, io, os, glob, json
from PIL import Image, ImageDraw, ImageFont

base = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
out = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgall'
os.makedirs(out, exist_ok=True)

files = sorted(glob.glob(os.path.join(base, 'plottexturebg_*.assetbundle')))
files = [f for f in files if '.manifest' not in f]
print('total', len(files))

thumbs = []
index = {}
for i, f in enumerate(files):
    name = os.path.basename(f).replace('plottexturebg_', '').replace('.assetbundle', '')
    tp = os.path.join(out, f'{i:04d}.jpg')
    if os.path.exists(tp):
        index[i] = name
        thumbs.append((i, tp))
        continue
    try:
        env = UnityPy.load(io.BytesIO(open(f, 'rb').read()[128:]))
        ok = False
        for obj in env.objects:
            if obj.type.name == 'Texture2D':
                img = obj.read().image
                if img and img.width >= 400:
                    img = img.convert('RGB')
                    img.thumbnail((320, 180))
                    img.save(tp, quality=82)
                    ok = True
                break
        if ok:
            index[i] = name
            thumbs.append((i, tp))
    except Exception:
        pass

json.dump(index, open(os.path.join(out, 'index.json'), 'w'), ensure_ascii=False)
print('thumbs', len(thumbs))

try:
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
except Exception:
    font = ImageFont.load_default()

cols, rows = 8, 6
cw, ch = 240, 168
per = cols * rows
for s in range(0, len(thumbs), per):
    chunk = thumbs[s:s + per]
    sheet = Image.new('RGB', (cols * cw, rows * ch), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    for k, (idx, p) in enumerate(chunk):
        im = Image.open(p).convert('RGB')
        im.thumbnail((cw - 8, ch - 32))
        x = (k % cols) * cw
        y = (k // cols) * ch
        sheet.paste(im, (x + 4, y + 26))
        d.text((x + 4, y + 3), str(idx), fill=(255, 230, 90), font=font)
    sheet.save(os.path.join(out, f'sheet_{s // per:02d}.jpg'), quality=86)
print('sheets', (len(thumbs) + per - 1) // per)
