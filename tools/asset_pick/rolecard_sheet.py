from PIL import Image, ImageDraw
import os, io, UnityPy

SRC = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
OUT = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/rolecard_sheet.jpg'

names = sorted(
    f[len('rolecards_rolecard_'):-len('.assetbundle')]
    for f in os.listdir(SRC)
    if f.startswith('rolecards_rolecard_') and f.endswith('.assetbundle')
)

def load(bundle):
    env = UnityPy.load(io.BytesIO(open(os.path.join(SRC, bundle), 'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            t = obj.read()
            if t.image:
                return t.image
    return None

CELL_W, CELL_H = 150, 240
COLS = 10
rows = (len(names) + COLS - 1) // COLS
sheet = Image.new('RGB', (CELL_W * COLS, CELL_H * rows), (24, 24, 28))
draw = ImageDraw.Draw(sheet)

for i, n in enumerate(names):
    img = load(f'rolecards_rolecard_{n}.assetbundle')
    x = (i % COLS) * CELL_W
    y = (i // COLS) * CELL_H
    if img:
        im = img.convert('RGB')
        im.thumbnail((CELL_W - 8, CELL_H - 24), Image.LANCZOS)
        sheet.paste(im, (x + (CELL_W - im.width) // 2, y + 4))
    draw.text((x + 4, y + CELL_H - 18), n, fill=(235, 235, 235))

sheet.save(OUT, 'JPEG', quality=82, optimize=True)
print('saved', OUT, sheet.size, f'{os.path.getsize(OUT)/1024:.0f}KB')
