import subprocess, os, sys
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = r'D:/workbuddy/2026-10-23-16-33-10'
OUT = os.path.join(ROOT, 'tools', 'shots', 'audio')
os.makedirs(OUT, exist_ok=True)

jobs = [
    ('assets/music/relax.mp3', 'spec_relax'),
    ('assets/music/calm.mp3', 'spec_calm'),
    ('assets/music/tense.mp3', 'spec_tense'),
    ('tools/asset_pick/music2/plot_relax_1.wav', 'spec_relax_src'),
]
for src, name in jobs:
    dst = os.path.join(OUT, name + '.png')
    cmd = [FF, '-hide_banner', '-v', 'error', '-y', '-i', os.path.join(ROOT, src),
           '-lavfi', 'showspectrumpic=s=900x420:mode=combined:scale=log:fscale=log:legend=1',
           dst]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(name, r.returncode, r.stderr.strip()[:200])
