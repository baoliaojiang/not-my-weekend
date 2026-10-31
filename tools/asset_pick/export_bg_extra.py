import UnityPy, io, os
from PIL import Image

base = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
dst = r'D:/workbuddy/2026-10-23-16-33-10/assets/backgrounds'
os.makedirs(dst, exist_ok=True)

# 索引 -> 语义名（人工挑选：都是原作里的室内/街道/厅堂图）
picks = {
    '100002': 'bg_home_living',   # 客厅 / 家中
    '100009': 'bg_street_dusk',   # 傍晚街道
    '100023': 'bg_bedroom',       # 卧室
    '100051': 'bg_hallway_end',   # 走廊尽头
    '100058': 'bg_town_day',      # 白天街区
    '100060': 'bg_auditorium',    # 礼堂 / 舞台
    '100044': 'bg_sky_dusk',      # 天空 / 黄昏
    '100021': 'bg_studio',        # 排练厅 / 活动室
}

for mid, name in picks.items():
    p = os.path.join(base, f'plottexturebg_{mid}.assetbundle')
    if not os.path.exists(p):
        print('MISS', mid); continue
    env = UnityPy.load(io.BytesIO(open(p, 'rb').read()[128:]))
    best = None
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            try:
                img = obj.read().image
            except Exception as e:
                continue
            if not img:
                continue
            if img.width < 600:
                continue
            if best is None or img.width * img.height > best.width * best.height:
                best = img
    if best is None:
        print('NOIMG', mid); continue
    out = os.path.join(dst, name + '.jpg')
    best.convert('RGB').save(out, quality=86)
    print(name, best.width, best.height, f'{os.path.getsize(out)/1048576:.2f}MB')
print('done')
