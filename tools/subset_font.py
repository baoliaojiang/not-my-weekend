"""把 MiSans 子集化成只含项目用字 + GB2312 一级汉字的 woff2。
体积从 4MB 降到几百 KB，明显缩短移动端首次排版与解析时间。
源文件仍在 tools/MiSans.zip，可随时重建全量字体。
"""
import io, os, zipfile, glob
from fontTools import subset

ROOT = r'D:/workbuddy/2026-10-23-16-33-10'
ZIP = os.path.join(ROOT, 'tools', 'MiSans.zip')
OUT = os.path.join(ROOT, 'assets', 'fonts')

# 1) 收集项目里出现过的所有字符
chars = set()
for pat in ('scripts/**/*.js', 'index.html', 'styles/*.css', 'docs/*.md'):
    for f in glob.glob(os.path.join(ROOT, pat), recursive=True):
        try:
            chars |= set(open(f, encoding='utf-8').read())
        except Exception:
            pass

# 2) GB2312 一级汉字（3755 个，覆盖日常文本）
gb = set()
for b1 in range(0xB0, 0xD8):
    for b2 in range(0xA1, 0xFF):
        try:
            gb.add(bytes([b1, b2]).decode('gb2312'))
        except Exception:
            pass
chars |= gb

# 3) 基础 ASCII / 标点 / 全角符号
chars |= set(''.join(chr(c) for c in range(0x20, 0x7F)))
chars |= set('　、。，．；：？！“”‘’（）《》〈〉【】「」『』—…·～￥％＋－×÷＝')
chars |= set('0123456789ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ')
chars = {c for c in chars if c.strip() or c == ' '}

print('charset size:', len(chars))

want = {
    'MiSans-Regular.ttf': 'MiSans-Regular.woff2',
    'MiSans-Semibold.ttf': 'MiSans-Semibold.woff2',
}

z = zipfile.ZipFile(ZIP)
for n in z.namelist():
    base = os.path.basename(n)
    if base not in want or n.startswith('__MACOSX'):
        continue
    data = z.read(n)
    args = [
        os.path.join(ROOT, 'assets', 'fonts', base),
        '--flavor=woff2',
        '--layout-features=*',
        '--no-hinting',
        '--desubroutinize',
        '--drop-tables+=DSIG',
        f'--output-file={os.path.join(OUT, want[base])}',
    ]
    # 用内存中的源文件：先落到临时路径
    tmp = os.path.join(OUT, base)
    open(tmp, 'wb').write(data)
    args[0] = tmp
    font = subset.load_font(tmp, subset.Options())
    subsetter = subset.Subsetter(subset.Options(
        flavor='woff2', layout_features='*', hinting=False,
        desubroutinize=True, drop_tables=['DSIG']))
    subsetter.populate(unicodes=[ord(c) for c in chars])
    subsetter.subset(font)
    out = os.path.join(OUT, want[base])
    subset.save_font(font, out, subset.Options(flavor='woff2'))
    font.close()
    os.remove(tmp)
    print(base, '->', want[base], f'{os.path.getsize(out)/1024:.0f} KB')
