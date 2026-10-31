# -*- coding: utf-8 -*-
"""
《不属于我的周末》【初见测试】PV 渲染脚本
输出：1920x1080 / 30fps / 56s / H.264
素材：全部取自项目内既有文件，不修改原文件
字体：MiSans（正文） + 钉钉进步体（标题/大字/数字）
"""
import os, sys, math, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = r"D:/workbuddy/2026-10-23-16-33-10"
PV   = os.path.join(ROOT, "pv", "初见测试")
FDIR = os.path.join(PV, "03-渲染源", "fonts")
OUT  = os.path.join(PV, "02-成片")

W, H = 1920, 1080
FPS  = 30
DUR  = 56.0
N    = int(DUR * FPS)

# 字体
F_REG  = os.path.join(FDIR, "MiSans-Regular.ttf")
F_SEMI = os.path.join(FDIR, "MiSans-Semibold.ttf")
F_TITLE= os.path.join(FDIR, "DingTalkJinBuTi-full.ttf")

# 色板（取自 styles/main.css 深色主题）
BG    = (0x15, 0x1A, 0x24)
WARM  = (0xF3, 0xF0, 0xE7)
GOLD  = (0xE8, 0xDC, 0xC4)
CORAL = (0xE0, 0x9B, 0x8C)
BLUE  = (0x8F, 0xA8, 0xC0)

_fc = {}
def F(path, size):
    k = (path, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(path, size)
    return _fc[k]

def col(c, a):
    return (c[0], c[1], c[2], max(0, min(255, int(a * 255))))

def ease_out(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3

def ease_io(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def rng(t, t0, t1):
    """在 [t0,t1] 上的归一化进度"""
    if t1 <= t0: return 1.0
    return max(0.0, min(1.0, (t - t0) / (t1 - t0)))

def layer():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def stamp(base, lay, alpha=1.0):
    if alpha <= 0.002:
        return
    if alpha < 0.998:
        lay = lay.copy()
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    base.alpha_composite(lay)

def tracked(dr, x, y, s, font, fill, tracking=0, align="l"):
    total = sum(font.getlength(c) for c in s) + tracking * max(0, len(s) - 1)
    if align == "c": x -= total / 2.0
    elif align == "r": x -= total
    for c in s:
        dr.text((x, y), c, font=font, fill=fill, anchor="ls")
        x += font.getlength(c) + tracking
    return total

def tracked_w(font, s, tracking=0):
    return sum(font.getlength(c) for c in s) + tracking * max(0, len(s) - 1)

def rich(dr, x, y, parts, font, tracking=0, align="c"):
    widths = [tracked_w(font, t, tracking) for t, _ in parts]
    total = sum(widths) + tracking * max(0, len(parts) - 1)
    if align == "c": x -= total / 2.0
    elif align == "r": x -= total
    for (t, c), _w in zip(parts, widths):
        for ch in t:
            dr.text((x, y), ch, font=font, fill=c, anchor="ls")
            x += font.getlength(ch) + tracking
        x += tracking
    return total

# ---------- 素材 ----------
def cover(path, w=W, h=H):
    im = Image.open(path).convert("RGB")
    r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

def kb(img, t, z0=1.0, z1=1.03, ox=0.0, oy=0.0):
    z = z0 + (z1 - z0) * t
    cw, ch = int(W / z), int(H / z)
    cx = (W - cw) / 2 + ox * t
    cy = (H - ch) / 2 + oy * t
    cx = max(0, min(W - cw, cx)); cy = max(0, min(H - ch, cy))
    return img.crop((int(cx), int(cy), int(cx) + cw, int(cy) + ch)).resize((W, H), Image.BICUBIC)

def dim(img, k=0.85):
    return ImageEnhance.Brightness(img).enhance(k)

def bottom_fade(img, h=420, strength=200):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(lay)
    for i in range(h):
        a = int(strength * (i / h) ** 2)
        dr.line([(0, H - h + i), (W, H - h + i)], fill=(6, 8, 12, a))
    base = img.convert("RGBA")
    base.alpha_composite(lay)
    return base

def blur_bg(path, opacity=0.08, sat=0.18):
    im = cover(path)
    im = im.filter(ImageFilter.GaussianBlur(40))
    im = ImageEnhance.Color(im).enhance(sat)
    base = Image.new("RGBA", (W, H), BG + (255,))
    lay = im.convert("RGBA")
    lay.putalpha(int(255 * opacity))
    base.alpha_composite(lay)
    return base

# ---------- HUD ----------
def hud(base, t):
    lay = layer()
    dr = ImageDraw.Draw(lay)
    ap = ease_out(rng(t, 0.0, 0.7))
    c = col(WARM, 0.16 * ap)
    L = 30
    for (x, y, dx, dy) in [(44, 44, 1, 1), (W - 44, 44, -1, 1), (44, H - 44, 1, -1), (W - 44, H - 44, -1, -1)]:
        dr.line([(x, y), (x + L * dx, y)], fill=c, width=2)
        dr.line([(x, y), (x, y + L * dy)], fill=c, width=2)
    f1 = F(F_REG, 21)
    tracked(dr, 100, 62, "NOT MY WEEKEND  //  PROLOGUE", f1, col(WARM, 0.42 * ap), 5.2, "l")
    f2 = F(F_REG, 20)
    tracked(dr, W - 100, 62, "%02d / %d" % (min(int(t), int(DUR)), int(DUR)), f2, col(WARM, 0.24 * ap), 4.0, "r")
    stamp(base, lay)

# ---------- 场景 ----------
S01 = (0.0, 3.0)
S02 = (3.0, 7.5)
S03 = (7.5, 11.5)
CARDS = [(11.5, 16.5), (16.5, 21.5), (21.5, 26.5), (26.5, 31.5)]
S08 = (31.5, 43.5)
S09 = (43.5, 49.5)
S10 = (49.5, 56.0)

bg_bedroom  = cover(os.path.join(ROOT, "assets/backgrounds/bg_bedroom.webp"))
bg_bedroom  = ImageEnhance.Color(bg_bedroom).enhance(0.88)
bg_bedroom  = dim(bg_bedroom, 0.92)
bg_city     = cover(os.path.join(ROOT, "assets/backgrounds/bg_city_night.webp"))
bg_city     = dim(bg_city, 0.86)

CARD_DATA = [
    dict(num="01", en="ONE SHEET",      big="一张表",   desc="通知上写着两个字：自愿。",
         bgs=["bg_classroom_dusk.webp"], num_a=0.16),
    dict(num="02", en="ONE PEN",        big="一支笔",   desc="有人替别人签了名。",
         bgs=["bg_corridor_dusk.webp"], num_a=0.14),
    dict(num="03", en="ONE RECEIPT",    big="一份回执", desc="工单提交了，答复是「已收悉」。",
         bgs=["bg_corridor_dawn.webp"], num_a=0.12),
    dict(num="04", en="ONE EMPTY SEAT", big="一个空位", desc="全勤名单上，空着一格。",
         bgs=["bg_classroom_night.webp"], num_a=0.09),
]
for d in CARD_DATA:
    d["base"] = blur_bg(os.path.join(ROOT, "assets/backgrounds", d["bgs"][0]))

SHOTS = [
    (os.path.join(ROOT, "assets/backgrounds/bg_corridor_dusk.webp"), "观察。"),
    (os.path.join(ROOT, "assets/backgrounds/bg_classroom_night.webp"), "记录。"),
    (os.path.join(ROOT, "tools/shots/09-phone.png"), "求证。"),
    (os.path.join(ROOT, "assets/backgrounds/bg_gate_night.webp"), "以及，一次不太顺利的通话。"),
]
SHOT_IMGS = []
for p, _s in SHOTS:
    if p.endswith("09-phone.png"):
        im = cover(p)
        # 手机截图：缩到 78% 居中，四周黑场，像"看着一块屏幕"
        sw, sh = int(W * 0.78), int(H * 0.78)
        small = im.resize((sw, sh), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), (8, 9, 13))
        canvas.paste(small, ((W - sw) // 2, (H - sh) // 2))
        SHOT_IMGS.append(canvas)
    else:
        SHOT_IMGS.append(cover(p))

def s01(base, t, lt):
    a = ease_out(rng(lt, 0.35, 1.6))
    lay = layer(); dr = ImageDraw.Draw(lay)
    f = F(F_REG, 24)
    tracked(dr, W / 2, H / 2 + 8, "09.01  /  07:40", f, col(WARM, 0.34 * a), 9.0, "c")
    stamp(base, lay)
    return base

def s02(base, t, lt):
    base.alpha_composite(kb(bg_bedroom, lt / 4.5, 1.0, 1.045).convert("RGBA"))
    base = bottom_fade(base)
    # 07:40
    a1 = ease_out(rng(lt, 0.7, 1.5))
    lay = layer(); dr = ImageDraw.Draw(lay)
    tracked(dr, W - 110, H - 130, "07:40", F(F_REG, 46), col(GOLD, 0.80 * a1), 8.0, "r")
    tracked(dr, W - 110, H - 92, "SEP. 01", F(F_REG, 15), col(WARM, 0.34 * a1), 5.0, "r")
    stamp(base, lay)
    # 主字幕
    a2 = ease_out(rng(lt, 1.5, 2.4))
    lay = layer(); dr = ImageDraw.Draw(lay)
    tracked(dr, W / 2, H - 210, "九月一日，早上七点四十。", F(F_REG, 52), col(WARM, 0.94 * a2), 2.0, "c")
    stamp(base, lay)
    # 出场淡出
    out = 1 - ease_io(rng(lt, 4.0, 4.5))
    if out < 1:
        black = Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - out))))
        base.alpha_composite(black)
    return base

def s03(base, t, lt):
    a1 = ease_out(rng(lt, 0.15, 1.05))
    a2 = ease_out(rng(lt, 0.55, 1.45))
    lay = layer(); dr = ImageDraw.Draw(lay)
    f = F(F_REG, 60)
    rich(dr, W / 2, H / 2 - 34, [("有些事写着「", col(WARM, 0.94 * a1)), ("自愿", col(GOLD, a1)), ("」，", col(WARM, 0.94 * a1))], f, 3.0)
    rich(dr, W / 2, H / 2 + 82, [("读起来像「", col(WARM, 0.94 * a2)), ("应该", col(GOLD, a2)), ("」。", col(WARM, 0.94 * a2))], f, 3.0)
    stamp(base, lay)
    out = 1 - ease_io(rng(lt, 3.4, 4.0))
    if out < 1:
        base.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - out)))))
    return base

def card(base, lt, d, idx):
    base.alpha_composite(d["base"].copy())
    # 巨型数字（纯描边）
    lay = layer(); dr = ImageDraw.Draw(lay)
    fn = F(F_TITLE, 430)
    dr.text((W - 30, 400), d["num"], font=fn, fill=(0, 0, 0, 0),
            stroke_width=3, stroke_fill=col(WARM, d["num_a"]), anchor="rs")
    # 英文小标
    a0 = ease_out(rng(lt, 0.25, 1.0))
    tracked(dr, W / 2, 405, d["en"], F(F_REG, 23), col(BLUE, 0.70 * a0), 9.0, "c")
    stamp(base, lay)
    # 超大字
    a1 = ease_out(rng(lt, 0.45, 1.35))
    lay = layer(); dr = ImageDraw.Draw(lay)
    dy = int((1 - a1) * 16)
    tracked(dr, W / 2, 640 + dy, d["big"], F(F_TITLE, 196), col(WARM, 0.97 * a1), 6.0, "c")
    stamp(base, lay)
    # 说明字幕
    a2 = ease_out(rng(lt, 1.15, 2.35))
    lay = layer(); dr = ImageDraw.Draw(lay)
    tracked(dr, W / 2, 755, d["desc"], F(F_REG, 40), col(WARM, 0.74 * a2), 1.5, "c")
    stamp(base, lay)
    # 底部四段进度
    segw, gap, n = 92, 16, 4
    total = segw * n + gap * (n - 1)
    x0 = W / 2 - total / 2
    lay = layer(); dr = ImageDraw.Draw(lay)
    for i in range(n):
        xx = x0 + i * (segw + gap)
        c = col(GOLD, 0.85) if i == idx else col(WARM, 0.13)
        dr.rectangle([xx, 950, xx + segw, 951], fill=c)
    stamp(base, lay)
    # 章节卡之间的 0.3s 黑场切
    if lt > 4.75:
        k = ease_io(rng(lt, 4.75, 5.0))
        base.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * k))))
    return base

def s08(base, t, lt):
    idx = min(3, int(lt // 3.0))
    lt2 = lt - idx * 3.0
    img = SHOT_IMGS[idx]
    base.alpha_composite(kb(img, lt2 / 3.0, 1.0, 1.035).convert("RGBA"))
    lay = layer(); dr = ImageDraw.Draw(lay)
    dr.rectangle([0, H - 300, W, H], fill=(6, 8, 12, 90))
    stamp(base, lay)
    a = ease_out(rng(lt2, 0.12, 0.62))
    lay = layer(); dr = ImageDraw.Draw(lay)
    txt = SHOTS[idx][1]
    tracked(dr, 100, H - 128, txt, F(F_SEMI, 44), col(WARM, 0.95 * a), 3.0, "l")
    tracked(dr, W - 100, H - 128, "0%d" % (idx + 1), F(F_REG, 22), col(GOLD, 0.5 * a), 5.0, "r")
    stamp(base, lay)
    # 段间 0.15s 黑场闪
    if lt2 > 2.82:
        k = ease_io(rng(lt2, 2.82, 3.0))
        base.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * k))))
    return base

def s09(base, t, lt):
    base.alpha_composite(kb(bg_city, lt / 6.0, 1.0, 1.05, 0, -10).convert("RGBA"))
    base = bottom_fade(base, 520, 170)
    a1 = ease_out(rng(lt, 0.5, 1.6))
    lay = layer(); dr = ImageDraw.Draw(lay)
    tracked(dr, W / 2, H / 2 - 40, "没有人说不。", F(F_REG, 50), col(WARM, 0.94 * a1), 6.0, "c")
    stamp(base, lay)
    a2 = ease_out(rng(lt, 1.9, 3.0))
    lay = layer(); dr = ImageDraw.Draw(lay)
    rich(dr, W / 2, H / 2 + 80, [("这一次，", col(WARM, 0.94 * a2)), ("从头", col(GOLD, a2)), ("问一遍。", col(WARM, 0.94 * a2))],
         F(F_REG, 50), 6.0)
    stamp(base, lay)
    out = 1 - ease_io(rng(lt, 5.4, 6.0))
    if out < 1:
        base.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - out)))))
    return base

def s10(base, t, lt):
    seq = [
        (0.15, "by", "A DEMO BY 爆料酱"),
        (0.40, "title", ""),
        (0.75, "sub", "关于我的学校周末要上课这件事"),
        (1.05, "line", ""),
        (1.30, "tag", "初见测试"),
        (1.85, "slogan", "愿你在签字之前，多问一句。"),
        (2.30, "plat", "网页  ·  Windows  ·  Android"),
        (2.55, "dis1", "本作为个人制作的非商业 Demo，剧情与人物均为虚构演绎，与任何真实学校、机构无关。"),
        (2.72, "dis2", "测试内容仍在打磨，不代表最终品质；画面与玩法可能调整。"),
    ]
    for t0, key, txt in seq:
        a = ease_out(rng(lt, t0, t0 + 0.75))
        if a <= 0.002:
            continue
        lay = layer(); dr = ImageDraw.Draw(lay)
        if key == "by":
            tracked(dr, W / 2, 240, txt, F(F_REG, 20), col(WARM, 0.40 * a), 6.5, "c")
        elif key == "title":
            tracked(dr, W / 2, 404, "不属于我的周末", F(F_TITLE, 152), col(WARM, 0.98 * a), 4.0, "c")
        elif key == "sub":
            tracked(dr, W / 2, 468, txt, F(F_REG, 32), col(WARM, 0.66 * a), 2.0, "c")
        elif key == "line":
            x0 = W / 2 - 160
            dr.rectangle([x0, 519, x0 + 320, 520], fill=col(GOLD, 0.38 * a))
        elif key == "tag":
            f = F(F_SEMI, 26)
            tw = tracked_w(f, txt, 6.0)
            bw, bh = tw + 64, 56
            bx, by = W / 2 - bw / 2, 552
            dr.rectangle([bx, by, bx + bw, by + bh], outline=col(GOLD, 0.55 * a), width=2)
            tracked(dr, W / 2, by + 39, txt, f, col(GOLD, 0.95 * a), 6.0, "c")
        elif key == "slogan":
            tracked(dr, W / 2, 700, txt, F(F_REG, 34), col(WARM, 0.86 * a), 3.0, "c")
        elif key == "plat":
            tracked(dr, W / 2, 768, txt, F(F_REG, 20), col(WARM, 0.44 * a), 4.0, "c")
        elif key == "dis1":
            tracked(dr, W / 2, 886, txt, F(F_REG, 17), col(WARM, 0.34 * a), 0.5, "c")
        elif key == "dis2":
            tracked(dr, W / 2, 916, txt, F(F_REG, 17), col(WARM, 0.34 * a), 0.5, "c")
        stamp(base, lay)
    out = 1 - ease_io(rng(lt, 5.7, 6.5))
    if out < 1:
        base.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * (1 - out)))))
    return base

def frame(t):
    base = Image.new("RGBA", (W, H), BG + (255,))
    if S01[0] <= t < S01[1]:
        s01(base, t, t - S01[0])
    elif S02[0] <= t < S02[1]:
        s02(base, t, t - S02[0])
    elif S03[0] <= t < S03[1]:
        s03(base, t, t - S03[0])
    elif CARDS[0][0] <= t < CARDS[-1][1]:
        for i, (a, b) in enumerate(CARDS):
            if a <= t < b:
                card(base, t - a, CARD_DATA[i], i)
                break
    elif S08[0] <= t < S08[1]:
        s08(base, t, t - S08[0])
    elif S09[0] <= t < S09[1]:
        s09(base, t, t - S09[0])
    else:
        s10(base, t, t - S10[0])
    if t < S10[0]:
        hud(base, t)
    return base.convert("RGB")

def main():
    ff = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
    dst = os.path.join(OUT, "PV-初见测试.mp4")
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", dst]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(N):
        t = i / FPS
        p.stdin.write(frame(t).tobytes())
        if i % 150 == 0:
            print("frame %d/%d  t=%.1fs" % (i, N, t), flush=True)
    p.stdin.close()
    p.wait()
    print("done ->", dst)

if __name__ == "__main__":
    main()
