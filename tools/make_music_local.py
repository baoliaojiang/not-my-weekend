"""用本地小模型生成 BGM（替代程序合成器）。

背景：
  之前的 15 首 BGM 是 tools/make_music.py 用加性合成 + 五声音阶拼出来的，
  听感偏"电子琴"，用户要求换成模型生成的音乐。
  主题曲 title.mp3 是另一套流程（外部积分生成，2:30），这里不碰。

模型选型：MusicGen-small（Meta，约 300M 参数）
  · 本机没有独立显卡，只能 CPU 推理；small 是唯一在 CPU 上还能忍的尺寸
  · 一首 30 秒大约 3–6 分钟（核数不同会有出入），16 首属于"睡前跑一晚上"的量
  · 输出 32kHz 单声道，写 wav 后用 ffmpeg 转 mp3 并做响度统一

依赖（当前环境缺前三项，需先装）：
  pip install torch --index-url https://download.pytorch.org/whl/cpu
  pip install transformers scipy soundfile
  权重：facebook/musicgen-small（HuggingFace，约 1.2GB）

用法：
  python tools/make_music_local.py --all
  python tools/make_music_local.py --only daily,calm,rain --seconds 30
"""
import argparse
import os
import subprocess
import sys
import wave

# 每首曲子对应的提示词。原来那 15 首的情绪标签照搬，只换成英文描述，
# 因为 MusicGen 的文本编码器是英文训练的，中文提示基本无效。
TRACKS = {
    'daily':        'gentle slice-of-life anime soundtrack, soft piano and light strings, warm, everyday school morning, mellow, no drums',
    'calm':         'calm ambient piano, slow arpeggios, quiet room tone, contemplative, sparse, no percussion',
    'silent':       'very sparse minimal piano, long pauses, melancholic, near silence, soft room noise',
    'rain':         'rainy day ambience with soft piano, muted, humid air, gentle, no drums',
    'daydream':     'dreamy nostalgic piano, floating reverb, slow tempo, wistful school memories',
    'calm2':        'second calm piano piece, slightly warmer tone, unhurried, intimate',
    'relax':        'relieved gentle guitar and piano, light and airy, small smile, relaxed tempo',
    'city':         'quiet city evening, soft synth pad and electric piano, distant traffic, mellow',
    'office':       'neutral bureaucratic ambience, soft marimba and low pad, clinical but not cold',
    'room':         'small indoor room, soft piano and felt, intimate close sound, slow',
    'hall':         'school auditorium, reverberant empty hall, sparse piano notes, formal',
    'sunset':       'golden hour warm strings and piano, nostalgic, gentle swell, cinematic',
    'night_street': 'late night street, soft electric piano, distant streetlight hum, lonely but safe',
    'hope':         'quiet hopeful piano building slowly, determined, warm strings entry, uplifting',
    'tense':        'subtle tension, low sustained strings, sparse piano, uneasy, restrained, no drums'
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'music')


def synth_one(name, prompt, seconds, model, processor, torch, sample_rate):
    inputs = processor(text=[prompt], padding=True, return_tensors='pt')
    # CPU 上没必要更大；显存/内存都吃紧
    with torch.no_grad():
        audio = model.generate(**inputs, do_sample=True, guidance_scale=3.0,
                                max_new_tokens=int(seconds * 50))
    wav = audio[0, 0].numpy()
    path = os.path.join(OUT, name + '.wav')
    pcm = (wav * 32767).astype('int16')
    with wave.open(path, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(pcm.tobytes())
    return path


def to_mp3(wav_path):
    mp3 = wav_path[:-4] + '.mp3'
    # 和原来那批保持一致的响度：-17dB RMS 左右
    cmd = ['ffmpeg', '-y', '-i', wav_path,
           '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11',
           '-c:a', 'libmp3lame', '-q:a', '4', mp3]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return mp3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--seconds', type=int, default=30)
    ap.add_argument('--model', default='facebook/musicgen-small')
    ap.add_argument('--all', action='store_true')
    args = ap.parse_args()

    try:
        import torch
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
    except ImportError as e:
        print('缺少依赖：', e)
        print('先执行：pip install torch transformers scipy soundfile')
        sys.exit(1)

    names = list(TRACKS) if args.all else [x.strip() for x in args.only.split(',') if x.strip()]
    if not names:
        print('用 --all 或 --only daily,calm 指定要生成哪些')
        sys.exit(1)

    print('加载模型', args.model, '（首次会下载约 1.2GB 权重）')
    processor = AutoProcessor.from_pretrained(args.model)
    model = MusicgenForConditionalGeneration.from_pretrained(args.model)
    model.eval()
    sample_rate = model.config.audio_encoder.sampling_rate

    os.makedirs(OUT, exist_ok=True)
    for n in names:
        if n not in TRACKS:
            print('跳过未知曲目', n)
            continue
        print('生成', n, '…')
        wav = synth_one(n, TRACKS[n], args.seconds, model, processor, torch, sample_rate)
        # 没有 ffmpeg 就保留 wav，游戏里 <audio> 也能放
        try:
            mp3 = to_mp3(wav)
            print('  ->', mp3)
        except Exception:
            print('  ->', wav, '（转 mp3 失败，保留 wav）')


if __name__ == '__main__':
    main()
