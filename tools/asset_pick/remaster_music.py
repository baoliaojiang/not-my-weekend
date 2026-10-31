"""用 ffmpeg 重新编码 assets/music 全部曲目。

问题诊断结论：
  · 旧文件峰值 -5~-11 dBFS、无削波 —— 不是文件层面被削顶
  · 但全部是 22.05kHz / 约 88kbps VBR / 动态范围仅 ~17dB 的手游压缩音源，
    这类音源在手机扬声器、蓝牙耳机、以及浏览器重采样后极易被听成“糊、闷、炸”
  · 旧导出还把峰值压到 -4dB 再做 tanh 软限幅，叠加了两层非线性处理

新方案：
  · 输出 44.1kHz / 192kbps CBR —— 避开播放器对 22.05k 的劣质重采样
  · loudnorm 统一到 -17 LUFS / 真峰值 -1.5 dBTP —— 响度一致且绝不削顶
  · 只做一次线性淡入淡出，去掉多余的限幅器
"""
import os
import json
import glob
import shutil
import subprocess
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = r'D:/workbuddy/2026-10-23-16-33-10'
SRC = os.path.join(ROOT, 'assets', 'music')
BAK = os.path.join(ROOT, 'tools', 'asset_pick', 'music_old')
os.makedirs(BAK, exist_ok=True)

# 源 wav 映射（用于获得最高质量母版）；缺失的曲目直接用现有 mp3 二次编码
WAVS = {
    'title_normalsociety': 'tools/asset_pick/music/normalsociety.wav',
    'daily_richang': 'tools/asset_pick/music/plot_bgm_richang_01.wav',
    'calm': 'tools/asset_pick/music/plot_bgm_calm_02.wav',
    'silent': 'tools/asset_pick/music/plot_bgm_silent_01.wav',
    'rain': 'tools/asset_pick/music/plot_bgm_girlfortherain.wav',
    'daydream': 'tools/asset_pick/music/bluedaydream.wav',
    'calm2': 'tools/asset_pick/music2/plot_bgm_calm_01.wav',
    'relax': 'tools/asset_pick/music2/plot_relax_1.wav',
    'city': 'tools/asset_pick/music2/plot_bgm_citylife_01.wav',
    'office': 'tools/asset_pick/music2/plot_bgm_business.wav',
    'room': 'tools/asset_pick/music2/room_day02.wav',
    'hall': 'tools/asset_pick/music2/plot_bgm_theatre.wav',
    'sunset': 'tools/asset_pick/music2/sunsettinseltown.wav',
    'night_street': 'tools/asset_pick/music2/shanghaitan.wav',
    'hope': 'tools/asset_pick/music2/plot_bgm_risingplayer.wav',
    'tense': 'tools/asset_pick/music2/psychodetective.wav',
}


def duration(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if 'Duration:' in line:
            t = line.split('Duration:')[1].split(',')[0].strip()
            h, m, s = t.split(':')
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


for mp3 in sorted(glob.glob(os.path.join(SRC, '*.mp3'))):
    name = os.path.splitext(os.path.basename(mp3))[0]
    wav = os.path.join(ROOT, WAVS[name]) if name in WAVS else None
    src = wav if (wav and os.path.exists(wav)) else mp3
    kind = 'wav' if src == wav else 'mp3'

    # 备份一次
    bak = os.path.join(BAK, name + '.mp3')
    if not os.path.exists(bak):
        shutil.copy2(mp3, bak)

    dur = duration(src)
    fade_out = max(0.0, dur - 1.2)
    af = (
        'loudnorm=I=-17:TP=-1.5:LRA=11,'
        f'afade=t=in:st=0:d=0.9,afade=t=out:st={fade_out:.2f}:d=1.2'
    )
    tmp = mp3 + '.tmp.mp3'
    cmd = [FF, '-hide_banner', '-v', 'error', '-y', '-i', src,
           '-af', af, '-ar', '44100', '-ac', '2',
           '-c:a', 'libmp3lame', '-b:a', '192k', tmp]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f'FAIL {name} [{kind}] {r.stderr.strip()[:160]}')
        if os.path.exists(tmp):
            os.remove(tmp)
        continue
    os.replace(tmp, mp3)
    sz = os.path.getsize(mp3) / 1048576
    print(f'{name:24s} [{kind}] {dur:6.1f}s -> {sz:5.2f}MB')
print('done')
