from PIL import Image
import os, io, UnityPy

SRC = r'C:/Users/12821/WorkBuddy/2026-10-09-16-09-02/work/apk_decoded/assets/Android/resab'
CH = r'D:/workbuddy/2026-10-23-16-33-10/assets/characters'

def load(name):
    b = f'rolecards_rolecard_{name}.assetbundle'
    env = UnityPy.load(io.BytesIO(open(os.path.join(SRC, b), 'rb').read()[128:]))
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            t = obj.read()
            if t.image:
                return t.image
    return None

jobs = {
    'wu_jianguo': 'xiaosong',   # 吴建国：眼镜衬衫 + 文件夹 + 手机
    'zhou_yi': 'lan',           # 周姨：金发戴帽，成年女性
}

for out, srcname in jobs.items():
    img = load(srcname).convert('RGBA')
    # 统计左侧第一列像素的 alpha，判断背景是否透明
    px = img.load()
    col = [px[0, y] for y in range(0, img.height, max(1, img.height // 40))]
    transparent = sum(1 for p in col if p[3] < 16)
    print(f'{srcname}: size={img.size} 左边缘透明像素 {transparent}/{len(col)}')
    if img.height > 1400:
        w = int(img.width * 1400 / img.height)
        img = img.resize((w, 1400), Image.LANCZOS)
    p = os.path.join(CH, out + '.png')
    img.save(p, 'PNG', optimize=True)
    print('  ->', out + '.png', img.size, f'{os.path.getsize(p)/1024:.0f}KB')
