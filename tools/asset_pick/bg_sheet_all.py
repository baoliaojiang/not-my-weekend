from PIL import Image, ImageDraw, ImageFont
import json, os

BASE = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgall'
OUT = r'D:/workbuddy/2026-10-23-16-33-10/tools/asset_pick/bgsheets'
os.makedirs(OUT, exist_ok=True)

index = json.load(open(os.path.join(BASE, 'index.json')))
items = sorted(index.items(), key=lambda kv: int(kv[0]))

COLS, ROWS = 10, 10
CW, CH = 190, 118
PER = COLS * ROWS

try:
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 13)
except Exception:
    font = ImageFont.load_default()

for page in range((len(items) + PER - 1) // PER):
    chunk = items[page * PER:(page + 1) * PER]
    sheet = Image.new('RGB', (CW * COLS, CH * ROWS), (18, 18, 20))
    draw = ImageDraw.Draw(sheet)
    for k, (i, bgid) in enumerate(chunk):
        col, row = k % COLS, k // COLS
        x, y = col * CW, row * CH
        p = os.path.join(BASE, f'{int(i):04d}.jpg')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            im.thumbnail((CW - 6, CH - 18), Image.LANCZOS)
            sheet.paste(im, (x + 3, y + 2))
        draw.text((x + 4, y + CH - 16), f'{i}#{bgid}', fill=(240, 235, 160), font=font)
    out = os.path.join(OUT, f'page{page}.jpg')
    sheet.save(out, 'JPEG', quality=80, optimize=True)
    print('saved', out, f'{os.path.getsize(out)/1024:.0f}KB', len(chunk))
