import os, glob
from PIL import Image, ImageDraw, ImageFont

dirs = [r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgfull',
        r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgfull2']
out = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/candidates.png'

files = []
for d in dirs:
    files += sorted(glob.glob(os.path.join(d, '*.png')))
files.sort()

try:
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
except Exception:
    font = ImageFont.load_default()

cols, cell_w, cell_h = 5, 360, 230
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (20, 20, 22))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    im.thumbnail((cell_w - 8, cell_h - 34))
    x = (i % cols) * cell_w
    y = (i // cols) * cell_h
    sheet.paste(im, (x + 4, y + 28))
    d.text((x + 5, y + 4), f'#{i} ' + os.path.basename(f)[3:].replace('.png', ''), fill=(255, 230, 90), font=font)
sheet.save(out)
print('files', len(files), 'sheet', sheet.size)
for i, f in enumerate(files):
    print(i, os.path.basename(f))
