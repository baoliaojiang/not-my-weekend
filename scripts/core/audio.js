/* =========================================================
   音频管理
   ---------------------------------------------------------
   · 单曲循环播放；同一首不会被重复触发（切换场景不会重头播）
   · 两条音轨交叉淡入淡出
   · 音量与淡入走 Web Audio 的 GainNode：
     直接改 HTMLMediaElement.volume 会让波形每帧跳一个台阶，
     听感就是持续的沙沙声与爆音，这是之前“炸麦”的主要原因。
   · 主链上挂高通（去低频轰鸣）、低通（去 14kHz 以上的嘶声）
     与动态压缩，防止瞬态过载
   · 浏览器自动播放限制：未获得用户手势前只记录“待播放”
   ========================================================= */

import { assetUrl } from '../config/assets.js';

// 素材已在 tools/asset_pick/remaster_music.py 里统一重制：
// 44.1kHz / 192kbps / −17 LUFS / 真峰值 −1.5dBTP。
// 响度标准化之后母带本身就比以前响了约 7dB，这里相应把总增益压回来，
// 保证听感和以前相当（约 −34dB RMS 输出），同时不再需要任何限幅。
const BGM_TRIM = 0.34;
const SFX_TRIM = 0.55;

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.tracks = [this._makeTrack(), this._makeTrack()];
    this.active = 0;
    this.currentId = null;
    this.pendingId = null;
    this.unlocked = false;
    this.sfxPool = [];
    this.failed = new Set();

    this._ctx = null;
    this._bus = null;
    this._trackGains = null;
    this._graphTried = false;
    this._bgPaused = false;      // 切后台时是否由我们主动挂起过
    this._seq = 0;               // 切歌序号，用来作废过期的淡出回调

    window.addEventListener('pointerdown', () => this.unlock(), { once: true });
    window.addEventListener('keydown', () => this.unlock(), { once: true });
  }

  _makeTrack() {
    const el = new Audio();
    el.loop = true;
    /* preload 用 'metadata' 而不是 'auto'：
       'auto' 会在元素刚建好、还没开始播的时候就把整首歌拉下来，
       两条音轨就是两首曲子常驻内存。'metadata' 只取时长与基本信息，
       真正开始播时浏览器才会拉数据——省下的正是那部分。
       切歌本来就有 0.9s 交叉淡入，拉数据的时间被淡入盖住了，
       听感上没有区别。 */
    el.preload = 'metadata';
    el.volume = 0;
    return el;
  }

  /* ---------------- Web Audio 图 ---------------- */
  _buildGraph() {
    if (this._graphTried) return;
    this._graphTried = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 42;
      hp.Q.value = 0.7;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 16500;
      lp.Q.value = 0.5;

      // 只做“兜底保护”，不参与响度塑造：
      // 素材已经过 loudnorm + 峰限，threshold 放低会持续压缩动态，反而更闷更挤
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -8;
      comp.knee.value = 10;
      comp.ratio.value = 2;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;

      const master = ctx.createGain();
      master.gain.value = 1;

      hp.connect(lp);
      lp.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      this._ctx = ctx;
      this._bus = hp;

      // 只有上下文真的跑起来，才把媒体元素接进来：
      // 一旦创建了 MediaElementSource，元素就不再直连输出，所以必须确保 running。
      const attach = () => {
        try {
          this._trackGains = this.tracks.map(el => {
            const g = ctx.createGain();
            g.gain.value = 0;
            const src = ctx.createMediaElementSource(el);
            src.connect(g);
            g.connect(hp);
            return g;
          });
          // 交给 GainNode 控制后，元素自身音量固定为 1
          this.tracks.forEach(t => { t.volume = 1; });
          // 正在播放的音轨要立刻接上当前音量，否则切换控制链的瞬间会突然静音
          if (this.currentId && this.tracks[this.active] && !this.tracks[this.active].paused) {
            const g = this._trackGains[this.active];
            if (g) g.gain.setValueAtTime(this._gain(), ctx.currentTime);
          }
        } catch (e) {
          this._trackGains = null;
        }
      };

      if (ctx.state === 'running') attach();
      else ctx.resume().then(attach).catch(() => { this._ctx = null; this._bus = null; });
    } catch (e) {
      this._ctx = null;
      this._bus = null;
    }
  }

  _ensureRunning() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
  }

  unlock() {
    this.unlocked = true;
    this._buildGraph();
    this._ensureRunning();
    if (this.pendingId) {
      const id = this.pendingId;
      this.pendingId = null;
      // 之前那次播放失败时 currentId 已经被占用，这里清掉才能重新起播
      this.currentId = null;
      this.play(id);
    } else if (this.currentId) {
      const el = this.tracks[this.active];
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }

  /** 实际输出增益（用户音量 × 总衰减） */
  _gain() {
    if (!this.settings.bgmOn) return 0;
    const v = Number(this.settings.bgmVolume) || 0;
    return Math.max(0, Math.min(1, v * BGM_TRIM));
  }

  setSettings(s) {
    this.settings = s;
    if (!this.settings.bgmOn) {
      this.tracks.forEach((t, i) => this._setVolume(i, 0, 0.2));
      return;
    }
    if (this.currentId) this._setVolume(this.active, this._gain(), 0.25);
  }

  /** 设定某条音轨的音量；有 Web Audio 就走平滑 ramp，没有才退回元素音量 */
  _setVolume(index, value, seconds = 0.25) {
    const g = this._trackGains && this._trackGains[index];
    if (g && this._ctx) {
      const t = this._ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0001, value), t + seconds);
    } else {
      // 无 Web Audio 时的降级路径：直接设元素音量（会有一点台阶感）
      const el = this.tracks[index];
      if (el) el.volume = Math.max(0, Math.min(1, value));
    }
  }

  /** 播放音乐 id；同一 id 重复调用会被忽略 */
  play(id, { restart = false } = {}) {
    if (!id) return;
    if (this.currentId === id && !restart) return;
    const url = assetUrl('music', id);
    if (!url || this.failed.has(id)) return;

    this.currentId = id;
    this._buildGraph();
    this._ensureRunning();

    const token = ++this._seq;
    const fromIndex = this.active;
    const toIndex = this.active === 0 ? 1 : 0;
    const from = this.tracks[fromIndex];
    const to = this.tracks[toIndex];
    const targetVol = this._gain();

    to.src = url;
    to.onerror = () => { this.failed.add(id); };
    if (!this._trackGains) to.volume = 0;
    this.active = toIndex;

    // 先把所有非目标轨压到静音：连续快切时不会出现两首同时出声（叠音 → 过载）
    this.tracks.forEach((el, i) => {
      if (i !== toIndex) this._setVolume(i, 0, 0.4);
    });

    const crossFade = () => {
      if (this._trackGains && this._ctx) {
        const gFrom = this._trackGains[fromIndex];
        const gTo = this._trackGains[toIndex];
        const t = this._ctx.currentTime;
        const ms = 0.9;
        if (gFrom) {
          gFrom.gain.cancelScheduledValues(t);
          gFrom.gain.setValueAtTime(gFrom.gain.value, t);
          gFrom.gain.linearRampToValueAtTime(0.0001, t + ms);
        }
        if (gTo) {
          gTo.gain.cancelScheduledValues(t);
          gTo.gain.setValueAtTime(0.0001, t);
          gTo.gain.linearRampToValueAtTime(Math.max(0.0001, targetVol), t + ms);
        }
      } else {
        this._crossFade(from, to, targetVol, 900);
      }
      // 只有“该轨已经不是当前轨”时才允许停掉它，
      // 否则连续快切会把正在播的那条也 pause 掉（表现为音乐莫名消失）
      setTimeout(() => {
        if (from === this.tracks[this.active]) return;
        from.pause();
        from.removeAttribute('src');
      }, 960);
    };

    // 先乐观播放：Android WebView / Electron 允许自动播放时这里就会出声；
    // 被浏览器策略拦下则记成待播放，等第一次手势后由 unlock() 重新起播。
    const p = to.play();
    if (p && p.then) {
      p.then(() => {
        this.unlocked = true;
        if (this._seq !== token) return;
        crossFade();
      }).catch(() => {
        if (this._seq !== token) return;
        this.active = fromIndex;
        this.pendingId = id;
      });
    } else {
      crossFade();
    }
  }

  stop() {
    const idx = this.active;
    const el = this.tracks[idx];
    this._setVolume(idx, 0, 0.5);
    setTimeout(() => el.pause(), 520);
    this.currentId = null;
  }

  /* ---------------- 前后台切换 ----------------
     手机切到后台 / 锁屏 / 切到别的应用时必须真的停声，
     否则 WebView 里的 <audio> 会一直唱下去。 */
  suspendAll() {
    if (this._bgPaused) return;
    this._bgPaused = true;
    // 记住“本该在播”的那条轨：即使元素此刻是 pause 状态（自动播放被拦、切歌间隙），
    // 只要 currentId 还在，回来时也应该接着放。
    if (this.currentId) this._bgWasPlaying = this.active;
    this.tracks.forEach((el, i) => {
      if (el && !el.paused) {
        this._bgWasPlaying = i;
        try { el.pause(); } catch (e) { /* ignore */ }
      }
    });
    if (this._ctx && this._ctx.state === 'running') {
      try { this._ctx.suspend(); } catch (e) { /* ignore */ }
    }
    // 音效也一并停掉
    this.sfxPool.forEach(el => { try { el.pause(); } catch (e) { /* ignore */ } });
  }

  resumeAll() {
    if (!this._bgPaused) return;
    this._bgPaused = false;
    if (this._ctx && this._ctx.state === 'suspended') {
      const r = this._ctx.resume();
      if (r && r.catch) r.catch(() => {});
    }
    const idx = this._bgWasPlaying != null ? this._bgWasPlaying : (this.currentId ? this.active : null);
    this._bgWasPlaying = null;
    if (idx == null || !this.settings.bgmOn) return;
    const el = this.tracks[idx];
    // 目标轨没加载过（例如切歌途中被切后台）：按 currentId 重新起播
    if (!el || !el.src) {
      const id = this.currentId;
      if (id) { this.currentId = null; this.play(id, { restart: true }); }
      return;
    }
    this.active = idx;
    // 回到前台时补一次增益，避免 Web Audio 挂起后 gain 停在 0
    if (this._trackGains && this._trackGains[idx]) {
      this._setVolume(idx, this._gain(), 0.3);
    }
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  }

  isBgPaused() { return this._bgPaused; }

  /** 没有 Web Audio 时的降级交叉淡入（逐帧改元素音量） */
  _crossFade(from, to, target, ms, done) {
    const fromStart = from ? from.volume : 0;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const a = Math.cos(k * Math.PI / 2);
      const b = Math.sin(k * Math.PI / 2);
      if (from) from.volume = Math.max(0, Math.min(1, fromStart * a));
      to.volume = Math.max(0, Math.min(1, target * b));
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  sfx(id) {
    if (!this.settings.sfxVolume || this.settings.sfxVolume <= 0) return;
    const url = assetUrl('sfx', id);
    if (!url || this.failed.has(id)) return;
    const el = new Audio(url);
    el.volume = Math.max(0, Math.min(1, this.settings.sfxVolume * SFX_TRIM));
    el.onerror = () => this.failed.add(id);
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    this.sfxPool.push(el);
    /* 池子满了就把最旧的踢掉，并且断掉它的数据源：
       光 shift() 只是把元素从数组里挪走，元素本身还在解码器里占着地方，
       短音效不多，但长时间游玩累积起来是白占内存。 */
    while (this.sfxPool.length > 12) {
      const old = this.sfxPool.shift();
      if (!old) break;
      try { old.pause(); old.removeAttribute('src'); old.load(); } catch (e) { /* 忽略 */ }
    }
  }
}
