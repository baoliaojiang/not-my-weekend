"""用 SoundFont 采样音源渲染乐句，替代纯波表合成。

本机（以及大多数被墙环境）拿不到 AI 音乐模型权重，但 npm registry 可达，
上面有完整的 GeneralUser GS 音色库（128 个 GM 音色，全部是真实乐器录音）。
这条路能拿到的东西和"合成器"完全不是一个量级：
  · 钢琴是弹钢琴的录音，有击弦噪声、共鸣、力度分层
  · 弦乐是拉的，有揉弦和弓噪
  · 长笛/单簧管/吉他/贝斯/鼓组同理

用法：
  from sf2_synth import SoundFont
  sf = SoundFont('tools/soundfonts/GeneralUser.sf2')
  buf = sf.render(notes, dur, sr=44100)

notes 是一个列表，每项 (program, key, velocity, start, dur)。
program 是 GM 音色号：0 大钢琴 / 24 尼龙吉他 / 48 弦乐合奏 / 89 pad ...
"""
import os

import numpy as np

SR = 44100


def _decode_raw(raw, width):
    """SF2 的采样数据是 16 位 signed little-endian 单声道"""
    if width == 16 or width == 0:
        arr = np.frombuffer(raw[:len(raw) // 2 * 2], dtype='<i2').astype(np.float32) / 32768.0
    elif width == 24:
        b = np.frombuffer(raw[:len(raw) // 3 * 3], dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = (b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        arr = v.astype(np.float32) / float(1 << 23)
    elif width == 8:
        arr = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        arr = np.frombuffer(raw[:len(raw) // 2 * 2], dtype='<i2').astype(np.float32) / 32768.0
    return arr


def _resample(x, ratio):
    """变速播放。ratio > 1 = 升调变短。线性插值够用：
    GM 音色每个八度有多个采样点，实际变调通常不超过 ±3 个半音。"""
    if abs(ratio - 1.0) < 1e-4:
        return x
    n_out = max(1, int(len(x) / ratio))
    pos = np.arange(n_out, dtype=np.float64) * ratio
    idx = np.floor(pos).astype(np.int64)
    idx = np.clip(idx, 0, len(x) - 2)
    frac = (pos - idx).astype(np.float32)
    return x[idx] * (1 - frac) + x[idx + 1] * frac


class SoundFont:
    def __init__(self, path, sr=SR):
        from sf2utils.sf2parse import Sf2File
        self.sr = sr
        # sf2utils 是惰性读采样数据的，文件一关就拿不到了。
        # 音色库解出来的 PCM 总共几十 MB，一次性读进内存最省事。
        self._fh = open(path, 'rb')
        self.sf = Sf2File(self._fh)
        for smp in self.sf.samples:
            try:
                _ = smp.raw_sample_data
            except Exception:
                pass
        self.by_preset = {}
        for p in self.sf.presets:
            bank = getattr(p, 'bank', None)
            prog = getattr(p, 'preset', None)
            if bank is None or prog is None:
                continue  # 末尾的哨兵 preset 没有这两个字段
            self.by_preset.setdefault((bank, prog), p)
        self._raw = {}

    def _zones(self, program, bank=0):
        """展平成 (instrument_zone, sample) 列表，附带 preset 层的滤波增益"""
        key = (bank, program)
        if key in self._raw:
            return self._raw[key]
        preset = self.by_preset.get(key)
        if preset is None:
            # 找不到就退回钢琴，至少不会静音
            preset = self.by_preset.get((0, 0))
        out = []
        if preset is not None:
            for pb in getattr(preset, 'bags', []):
                inst = getattr(pb, 'instrument', None)
                if inst is None:
                    continue
                for iz in getattr(inst, 'bags', []):
                    smp = getattr(iz, 'sample', None)
                    if smp is None or not getattr(smp, 'raw_sample_data', None):
                        continue
                    out.append((iz, smp))
        self._raw[key] = out
        return out

    def _sample(self, smp):
        """解码并缓存，避免同一采样重复解包"""
        sid = id(smp)
        cache = self.__dict__.setdefault('_deco', {})
        if sid in cache:
            return cache[sid]
        arr = _decode_raw(smp.raw_sample_data, getattr(smp, 'sample_width', 16))
        # 去掉首尾可能的直流偏移
        if len(arr) > 32:
            arr = arr - float(np.mean(arr[:16]))
        cache[sid] = arr
        return arr

    def render_note(self, program, key, vel=90, dur=1.0, bank=0, gain=1.0):
        """渲染单个音，返回 float32 单声道数组（长度 = dur + 释放尾巴）"""
        zones = self._zones(program, bank)
        if not zones:
            return np.zeros(0, np.float32)

        pieces = []
        for iz, smp in zones:
            kr = getattr(iz, 'key_range', None) or (0, 127)
            vr = getattr(iz, 'velocity_range', None) or (0, 127)
            if not (kr[0] <= key <= kr[1]):
                continue
            if not (vr[0] <= vel <= vr[1]):
                continue
            pieces.append((iz, smp))
        if not pieces:
            return np.zeros(0, np.float32)

        # 力度区间可能重叠，按区间宽度分配，避免同一音叠两遍变响
        weight = 1.0 / len(pieces)
        total = None
        for iz, smp in pieces:
            buf = self._voice(iz, smp, key, vel, dur, gain * weight)
            if buf is None or not len(buf):
                continue
            total = buf if total is None else _mix(total, buf)
        return total if total is not None else np.zeros(0, np.float32)

    def _voice(self, iz, smp, key, vel, dur, gain):
        data = self._sample(smp)
        if len(data) < 64:
            return None

        base = getattr(iz, 'base_note', None)
        if base is None:
            base = getattr(smp, 'DEFAULT_PITCH', 60)
        tune = (getattr(iz, 'fine_tuning', 0) or 0) / 100.0
        tune += (getattr(iz, 'tuning', 0) or 0) / 100.0
        semi = (key - base) + tune
        ratio = 2.0 ** (semi / 12.0)

        # ---- 循环点 ----
        ls = getattr(iz, 'cooked_loop_start', 0) or 0
        le = getattr(iz, 'cooked_loop_end', 0) or 0
        loop = getattr(iz, 'sample_loop', False) and le > ls + 64 and le <= len(data)
        ls_o = int(ls / ratio)
        le_o = int(le / ratio)

        # ---- 时长：需要覆盖 dur，靠循环撑长；不循环就原样变速 ----
        attack = max(getattr(iz, 'volume_envelope_attack', 0.002) or 0.002, 0.001)
        decay = getattr(iz, 'volume_envelope_decay', 0.3) or 0.3
        sustain = getattr(iz, 'volume_envelope_sustain', 1.0)
        sustain = 1.0 if sustain is None else max(0.0, min(1.0, float(sustain)))
        release = max(getattr(iz, 'volume_envelope_release', 0.25) or 0.25, 0.02)
        hold = getattr(iz, 'volume_envelope_hold', 0.0) or 0.0

        body = int((dur + attack + decay + release + 0.05) * self.sr)
        src = _resample(data, ratio)

        if loop and le_o > ls_o + 16:
            head = src[:ls_o]
            tail = src[ls_o:le_o]
            if len(tail) < 16:
                return None
            if len(head) >= body:
                # 采样本身已经比需要的长，直接截断（钢琴这类就是这样）
                src = src[:body]
            else:
                need = body - len(head)
                reps = int(np.ceil(need / len(tail))) + 1
                src = np.concatenate([head, np.tile(tail, reps)])
        if len(src) < body:
            src = np.pad(src, (0, body - len(src)))

        # ---- 音量包络 ----
        env = np.ones(body, np.float32)
        ai = int(attack * self.sr)
        di = int(decay * self.sr)
        hi = int(hold * self.sr)
        ri = int(release * self.sr)
        if ai > 0:
            env[:ai] = np.linspace(0, 1, ai) ** 0.75
        seg = ai + hi
        if di > 0 and seg + di < body:
            env[seg:seg + di] = np.linspace(1, sustain, di)
        after = seg + di
        rstart = body - ri
        if after < body:
            env[after:max(rstart, after)] = sustain
        if ri > 0 and rstart < body:
            env[rstart:] = np.linspace(env[rstart - 1] if rstart > 0 else sustain, 0, body - rstart)

        # ---- 力度 → 音量与亮度 ----
        v = max(1, min(127, vel)) / 127.0
        amp = gain * (v ** 1.6)
        out = src[:body] * env * amp

        # 弱奏稍微压一点高频，模拟轻触键的手感
        if v < 0.55:
            out = _onepole_lp(out, 0.25 + v * 1.4)

        # 声像
        pan = (getattr(iz, 'pan', 0) or 0) / 500.0
        return _stereoise(out, pan)

    def render(self, notes, total_dur, sr=None, reverb_wet=0.35, tail=2.5):
        """notes: [(program, key, velocity, start_sec, dur_sec), ...]"""
        sr = sr or self.sr
        n = int((total_dur + tail) * sr)
        L = np.zeros(n, np.float32)
        R = np.zeros(n, np.float32)
        for note in notes:
            program, key, vel, start, dur = note[:5]
            gain = note[5] if len(note) > 5 else 1.0
            buf = self.render_note(program, key, vel, dur, gain=gain)
            if buf is None or not len(buf):
                continue
            s = int(start * sr)
            e = min(n, s + len(buf))
            if e <= s:
                continue
            seg = buf[:e - s]
            L[s:e] += seg[:, 0]
            R[s:e] += seg[:, 1]
        if reverb_wet > 0:
            L = _reverb(L, reverb_wet)
            R = _reverb(R, reverb_wet, seed=17)
        return L, R


# ---------- 信号工具 ----------

def _mix(a, b):
    n = max(len(a), len(b))
    shape = a.shape[1:] if a.ndim > 1 else ()
    out = np.zeros((n,) + shape, np.float32)
    out[:len(a)] += a
    out[:len(b)] += b
    return out


def _stereoise(mono, pan):
    """返回 (N,2)，pan ∈ [-1,1]。用能量守恒的等效定律。"""
    pan = max(-1.0, min(1.0, pan))
    gl = np.sqrt(0.5 * (1.0 - pan))
    gr = np.sqrt(0.5 * (1.0 + pan))
    return np.stack([mono * gl, mono * gr], axis=1)


def _onepole_lp(x, k):
    """单极低通。用 lfilter 做，纯 numpy 循环在整曲上要跑几分钟。"""
    if k >= 0.99:
        return x
    from scipy.signal import lfilter
    return lfilter([k], [1.0, k - 1.0], x).astype(np.float32)


def _reverb(x, wet=0.3, seed=3):
    """Schroeder 混响：4 个并联梳状 + 2 级全通。比干声有空间感，够用。
    全部用 lfilter 实现（纯循环版本在 90 秒的曲子上要跑好几分钟）。"""
    from scipy.signal import lfilter

    rng = np.random.default_rng(seed)
    sr = SR
    n = len(x)
    acc = np.zeros(n, np.float32)

    delays = [(0.0297, 0.76), (0.0371, 0.73), (0.0411, 0.71), (0.0437, 0.69)]
    for delay, fb in delays:
        d = int(delay * sr * (0.9 + 0.2 * rng.random()))
        a = np.zeros(d + 1)
        a[0] = 1.0
        a[d] = -fb
        acc += lfilter([1.0], a, x).astype(np.float32)
    acc /= len(delays)

    for delay, g in [(0.005, 0.7), (0.0017, 0.7)]:
        d = int(delay * sr)
        b = np.zeros(d + 1)
        b[0] = -g
        b[d] = 1.0
        a = np.zeros(d + 1)
        a[0] = 1.0
        a[d] = -g
        acc = lfilter(b, a, acc).astype(np.float32)

    return x * (1 - wet) + acc * wet


def master(L, R, sr=SR, air=1.0):
    """母带 EQ。不做这一步，音色再好也是"糊在毯子里"的：
    实测原始渲染有 85% 的能量挤在 40–500Hz，2kHz 以上只剩 1%，
    听起来就是低频轰、人声/旋律发闷。

    处理：把 60Hz 以下整段砍掉（游戏耳机/手机外放根本还原不出来，
          只会变成"一直在嗡"的噪音）→ 压掉 120–400Hz 的浑浊区
          → 抬 3kHz 清晰度 → 抬 9kHz 空气感。
          频响起伏用平滑插值，避免硬拐点产生铃声。"""
    n = len(L)
    if n < 1024:
        return L, R
    f = np.fft.rfftfreq(n, 1.0 / sr)

    # (频率, dB) —— 频率用对数坐标插值，更接近耳朵的感知。
    # 最低那几个点是刻意陡的：低于 60Hz 的东西对 BGM 只有副作用。
    # 高频那一段以前是 +3dB / +2.4 / +2.2，配 GM 的电钢和爵士吉他
    # 出来就是"炸"——镲片味、齿音、发尖。现在整条高频只做很浅的提亮，
    # 15kHz 以上反而收掉（手机外放还原不出来，只会变成刺耳的毛刺）。
    pts = [(16, -96), (22, -60), (30, -40), (40, -28),
           (50, -18), (62, -9.5), (78, -4.2), (95, -2.2),
           (120, -2.0), (160, -2.8), (200, -3.2), (280, -4.0),
           (380, -2.8), (520, -1.6), (900, 0.2), (2000, 0.8),
           (3200, 1.2), (5200, 0.8), (9000, 0.4), (14000, -1.6),
           (20000, -8.0)]
    pf = np.array([p[0] for p in pts], dtype=np.float64)
    pg = np.array([p[1] for p in pts], dtype=np.float64)
    gdb = np.interp(np.log10(np.maximum(f, 16)), np.log10(pf), pg)
    gdb *= air

    # 再平滑一次，抹掉插值折角。用滑窗平均（O(n)），
    # 别用 np.convolve——核长上万个点，直接卷积会把一首曲子拖到几分钟
    from scipy.ndimage import uniform_filter1d
    k = int(np.clip(len(gdb) // 400, 3, 255)) | 1
    gdb = uniform_filter1d(gdb, size=k, mode='nearest')

    g = (10.0 ** (gdb / 20.0)).astype(np.float32)

    out = []
    for ch in (L, R):
        # 先去掉直流分量：SF2 采样里常带一点偏置，留着会让低频更"轰"
        c = ch - np.mean(ch, dtype=np.float64)
        X = np.fft.rfft(c)
        out.append(np.fft.irfft(X * g, n).astype(np.float32))
    return _soft_limit(out[0]), _soft_limit(out[1])


def _soft_limit(x, knee=0.72):
    """软限幅：超过 knee 的部分用 tanh 压弯，而不是硬削。

    和弦一密、力度一高，峰值就会冲到 0dBFS 以上；以前只靠整首拉低音量
    来避让，结果是"一会儿很轻一会儿很响"。这里先把尖峰压弯，
    剩下的动态再交给归一化。
    """
    a = np.abs(x)
    over = a > knee
    if not np.any(over):
        return x
    y = x.copy()
    span = 1.0 - knee
    y[over] = np.sign(x[over]) * (knee + span * np.tanh((a[over] - knee) / span))
    return y.astype(np.float32)


def fold_loop(L, R, loop_sec, sr=SR):
    """把结尾多渲染出来的那段尾巴叠回开头，做成能无缝循环的 60 秒。

    BGM 是一件无限循环的事：小节走完最后一下，本该直接接回第一小节。
    但直接截断的话，最后那个和弦的残响、混响的尾巴会被硬切掉，
    接缝处就是"咔"的一声；而让 audio.loop 去循环一首"结束在静音"的
    曲子，中间又会空出一段。所以多渲染几秒尾巴，再按时间把它混回开头。
    """
    n = int(round(loop_sec * sr))
    if len(L) <= n:
        return L, R
    extra = len(L) - n
    fade = np.linspace(1.0, 0.0, extra, dtype=np.float32) ** 1.35
    L = L.copy(); R = R.copy()
    L[:extra] += L[n:] * fade
    R[:extra] += R[n:] * fade
    return L[:n], R[:n]


def normalize_stereo(L, R, rms_db=-17.0, peak=0.94):
    """按 RMS 归一，同时保证峰值不爆。"""
    rms = np.sqrt((np.mean(L ** 2) + np.mean(R ** 2)) * 0.5) + 1e-9
    target = 10 ** (rms_db / 20.0)
    g = target / rms
    pk = max(np.max(np.abs(L)), np.max(np.abs(R))) + 1e-9
    g = min(g, peak / pk)
    return L * g, R * g
