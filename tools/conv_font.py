import zipfile, os, io
from fontTools.ttLib import TTFont
z=zipfile.ZipFile(r'D:/workbuddy/2026-10-23-16-33-10/tools/MiSans.zip')
out=r'D:/workbuddy/2026-10-23-16-33-10/assets/fonts'
os.makedirs(out,exist_ok=True)
want={'MiSans-Regular.ttf':'MiSans-Regular.woff2','MiSans-Medium.ttf':'MiSans-Medium.woff2','MiSans-Semibold.ttf':'MiSans-Semibold.woff2','MiSans-Light.ttf':'MiSans-Light.woff2'}
for n in z.namelist():
    base=os.path.basename(n)
    if base in want and not n.startswith('__MACOSX'):
        data=z.read(n)
        f=TTFont(io.BytesIO(data))
        p=os.path.join(out,want[base])
        f.flavor='woff2'
        f.save(p)
        print(base,'->',want[base], f'{os.path.getsize(p)/1048576:.2f}MB')
