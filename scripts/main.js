/* =========================================================
   入口：装配各模块，管理标题 → 章节 → 总结 → 章节 的循环
   ========================================================= */

import { CONFIG } from './config/game.js';
import { setProtagonist } from './config/assets.js';
import { createState, hydrate, serialize, resetAP } from './core/state.js';
import * as store from './core/store.js';
import { AudioManager } from './core/audio.js';
import { Stage } from './core/stage.js';
import { checkUpdate, applyContentUpdate, shouldAutoCheck, markChecked } from './core/update.js';
import { runBootSequence } from './ui/boot.js';
import { UI } from './ui/screens.js';
import { Engine } from './core/vn.js';

import ch0 from './data/ch0.js';
import ch1 from './data/ch1.js';
import ch2 from './data/ch2.js';
import ch3 from './data/ch3.js';
import ch4 from './data/ch4.js';
import ch5 from './data/ch5.js';
import ch6 from './data/ch6.js';
import side1 from './data/side1.js';
import side2 from './data/side2.js';
import side3 from './data/side3.js';
import side4 from './data/side4.js';
import side5 from './data/side5.js';
import { SIDES, getSide, sideHubUnlocked } from './data/sides.js';

const CHAPTERS = { ch0, ch1, ch2, ch3, ch4, ch5, ch6, side1, side2, side3, side4, side5 };
const SIDE_IDS = new Set(SIDES.map(s => s.id));

/* 支线结局的名字（用于路口的"上次结果"与通关记录） */
const SIDE_ENDING_INFO = {
  side_coin: { name: '一元钱', kind: '隐藏结果', hidden: true },
  side_clear: { name: '查明', kind: '查明' },
  side_partial: { name: '部分查明', kind: '部分' },
  side_procedural: { name: '只有程序进展', kind: '程序' },
  side_dispute: { name: '陷入争议', kind: '争议' },
  // 支线二《直饮水》
  side_filter: { name: '最后一杯', kind: '隐藏结果', hidden: true },
  side_clear2: { name: '换了新的', kind: '查明' },
  side_partial2: { name: '换了新的，但记录还是空的', kind: '部分' },
  side_procedural2: { name: '流程走完了', kind: '程序' },
  side_dispute2: { name: '三个人在传', kind: '争议' },
  // 支线三《第八节课》
  side_eighth: { name: '那节课从课表上消失了', kind: '隐藏结果', hidden: true },
  side_clear3: { name: '四页', kind: '查明' },
  side_partial3: { name: '贴在走廊上了', kind: '部分' },
  side_procedural3: { name: '六个「已要求」', kind: '程序' },
  side_dispute3: { name: '个别班级', kind: '争议' },
  // 支线四《水卡》
  side5_water_clarity: { name: '那一杯接满了', kind: '查明' },
  side5_water_record: { name: '记录只有一行', kind: '部分' },
  side5_water_stop: { name: '两张卡', kind: '程序' },
  // 支线五《远足盒饭》
  side6_lunch_clarity: { name: '饭盒还是温的', kind: '查明' },
  side6_lunch_reply: { name: '一直没打开', kind: '部分' },
  side6_lunch_stop: { name: '盖上那道瘪痕', kind: '程序' }
};

const root = document.querySelector('#game');
const titleScreen = document.querySelector('#titleScreen');
const disclaimer = document.querySelector('#disclaimer');

let state = createState();
const settings = store.loadSettings();

/* 安卓端默认锁横屏。
   之前 manifest 写的是 sensor（跟随设备），加上网页侧只切 CSS 排版，
   结果就是手机上拿着竖着就永远竖屏——玩家在设置里选了「横屏」也不管用。
   现在：安卓外壳下若玩家从未手动设过方向，默认就用横屏；
   一旦自己选过（存进存档），就一直尊重玩家的选择。 */
const NATIVE_ANDROID = !!(window.ZBApp && typeof window.ZBApp.setOrientation === 'function');
if (NATIVE_ANDROID) {
  const raw = store.rawSettings();
  if (!Object.prototype.hasOwnProperty.call(raw, 'screenMode')) {
    settings.screenMode = 'landscape';
  }
}

// 主角性别要先落到资源表里，后面所有立绘请求都按它分流
setProtagonist(settings.protagonist);

const audio = new AudioManager(settings);
const stage = new Stage(root, settings);
let engine = null;
let ui = null;

/* ---------------- 存档 API（供 UI 调用） ----------------
   主线与支线各用一套槽位：scope 决定读写哪一组键，
   这样在支线里存档不会把主线进度顶掉，读支线存档也不会带坏主线状态。 */
// 一键清档之后置 true：在下一局真正开始之前，任何自动存档都不许写回磁盘
let wipeGuard = false;

const saveAPI = {
  /** 当前所在的存档域：主线 / 某条支线 */
  current() {
    if (!engine || !engine.chapter) return { scope: 'main' };
    const id = engine.chapter.id;
    if (SIDE_IDS.has(id)) return { scope: 'side', sideId: id, sideName: engine.chapter.name };
    return { scope: 'main' };
  },

  isSide(id) { return SIDE_IDS.has(id); },

  list(scope = 'main', sideId = null) {
    if (scope === 'side') return sideId ? store.listSideSlots(sideId) : [];
    return store.listSlots();
  },

  save(slot = 0, scope = null, sideId = null) {
    const cur = saveAPI.current();
    const sc = scope || cur.scope;
    const sid = sideId || cur.sideId || null;
    if (wipeGuard) return false;   // 刚清完档，等下一局真的开始再写
    if (!engine || !engine.chapter) return false;
    if (sc === 'side' && !sid) return false;
    const ch = engine.chapter;
    const log = state.log || [];
    const last = log.length ? log[log.length - 1] : null;
    const payload = {
      v: 1,
      ts: Date.now(),
      chapterId: ch.id,
      chapterTitle: sc === 'side' ? `支线 · ${ch.name}` : `${ch.title} ${ch.name}`,
      dayLabel: state.dayLabel,
      index: state.index,
      // 记录整条帧栈：调查行动 / 中段事件执行中也能精确回到原处
      frames: (engine.snapshot && engine.snapshot().frames) || [{ key: 'main', i: state.index }],
      preview: last ? `${last.who ? last.who + '：' : ''}${last.text}`.slice(0, 26) : '',
      // 场景快照：背景 / 在场立绘 / 当前音乐。
      // 只存文字状态的话，读档进来 bg 层是空的（存档点常落在没有 bg 节点的段落中间），
      // 表现就是"读档和继续游戏先黑屏一下，甚至一直黑着"。
      scene: {
        ...(stage.snapshotScene ? stage.snapshotScene() : {}),
        music: audio.currentId || null
      },
      state: serialize(state)
    };
    return sc === 'side' ? store.writeSideSlot(sid, slot, payload) : store.writeSlot(slot, payload);
  },

  load(slot, scope = null, sideId = null) {
    const cur = saveAPI.current();
    const sc = scope || cur.scope;
    const sid = sideId || cur.sideId || null;
    const data = sc === 'side'
      ? (sid ? store.readSideSlot(sid, slot) : null)
      : store.readSlot(slot);
    if (!data) { ui.toast('这个存档位是空的'); return; }
    const ch = CHAPTERS[data.chapterId];
    if (!ch) { ui.toast('存档中的章节不存在'); return; }
    // 支线读档前先清干净这条支线的材料与标记，再按存档重建
    if (SIDE_IDS.has(ch.id)) resetSideState(ch.id);
    applyState(hydrate(data.state));
    showGame();
    // 先把场景铺回去再跑节点：否则存档点后面没有 bg 节点时会一直黑着
    if (data.scene && stage.restoreScene) {
      stage.restoreScene(data.scene);
      if (data.scene.music) audio.play(data.scene.music);
    } else if (stage.restoreScene) {
      // 旧存档（没有 scene 字段）兜底：回扫存档点之前最后一个 bg 节点
      let bgId = null;
      for (let i = Math.min(data.index || 0, ch.nodes.length - 1); i >= 0; i--) {
        const n = ch.nodes[i];
        if (n && n.t === 'bg' && n.id) { bgId = n.id; break; }
      }
      stage.restoreScene({ bg: bgId, sprites: [] });
    }
    ui.toast('读取成功', 1600);
    engine.loadChapter(ch, data.index || 0, data.frames ? { frames: data.frames } : null);
  },

  /** 从支线路口直接进一条支线（新的一局） */
  enterSide(id) {
    if (!getSide(id)) return;
    startChapter(id, { autoSave: false });
  },

  saveSettings() {
    store.saveSettings(settings);
    audio.setSettings(settings);
    applyNightMode();
    applyGlassMode();
    applyReading();
  },
  // 设置页「恢复默认」用：只重置设置，不动存档与已读记录
  resetSettings() {
    const defaults = CONFIG.defaultSettings;
    Object.keys(settings).forEach(k => { delete settings[k]; });
    Object.assign(settings, JSON.parse(JSON.stringify(defaults)));
    store.saveSettings(settings);
    audio.setSettings(settings);
    applyNightMode();
    applyGlassMode();
    applyReading();
    applyScreenMode();
    return settings;
  },
  getDefaultSettings() { return JSON.parse(JSON.stringify(CONFIG.defaultSettings)); },

  resetRead() { store.resetRead(); },

  /** 一键清档：存档、支线存档、已读、进度、AI 会话全删；设置与 Key 保留 */
  wipeAll() {
    const n = store.wipeAllData();
    // 清完把写档的闸门关上：引擎还记着当前章节，页面切后台（pagehide）
    // 会再写一份自动存档，「刚清完又有档了」就是这么来的。
    // 下一次真的开一局时在 startChapter 里重新打开。
    wipeGuard = true;
    return n;
  },

  backToTitle() {
    engine.stopAllModes();
    ui.closeAll();
    showTitle();
  }
};

/* ---------------- 装配 ---------------- */
ui = new UI({ root, state, settings, audio, saveAPI });
ui.stage = stage;   // 设置里换主角立绘、关掉主角显示都要直接动舞台
engine = new Engine({
  state, stage, audio, ui, settings,
  onChapterEnd: handleChapterEnd
});
ui.engine = engine;

/* ---------------- 画面方向 ----------------
   screenMode: auto 跟随设备 / portrait 强制排版 / landscape 强制排版。
   只切排版（立绘尺寸与位置、对话框形态），不改设备的物理方向锁。

   判断优先用 screen.orientation：它由系统给出，旋转瞬间就是对的。
   安卓 WebView 在 Activity 自行处理 configChanges 时，窗内宽高会晚一拍
   （甚至停在旧值），只按 innerWidth/innerHeight 判断会切错排版，
   表现成横屏却套着竖屏规则——立绘被放大、只露下半身。 */
/* 读当前布局视口尺寸。
   只用来兜底与统计，不拿去写死高度——部分 WebView（微信 X5、旧版安卓）
   旋转后读到的 innerHeight 停在旋转前的值，用它排版会把页面撑坏。 */
function viewportNow() {
  const de = document.documentElement || {};
  return {
    w: (de.clientWidth || window.innerWidth || 0),
    h: (de.clientHeight || window.innerHeight || 0)
  };
}

/* 方向和样式共用同一个真源：CSS 的 (orientation:portrait) 怎么判，这里就怎么判。
   之前用 innerWidth/innerHeight 判断，在微信 X5 / 部分安卓 WebView 里旋转后会
   停在旧值，于是横屏画面套上了竖屏规则——立绘被按宽度放大、底边抬到对话框上沿，
   看上去人整个被顶到画外；对话框也涨到半屏高。媒体查询跟的是实际布局，
   不会再和画面分叉。 */
function isPortraitNow() {
  if (window.matchMedia) {
    return window.matchMedia('(orientation: portrait)').matches;
  }
  const { w, h } = viewportNow();
  return h >= w;
}

function isTouchDevice() {
  return (navigator.maxTouchPoints > 0)
    || !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
}

function applyScreenMode() {
  const mode = settings.screenMode || 'auto';
  const { w, h } = viewportNow();
  if (h > 0 && w > 0) {
    document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
  }
  // 竖屏排版只对触屏设备开放：电脑上窗口拉得再窄也不切成竖屏，
  // 设置里也不提供这一项，避免"选了没反应"。
  const portrait = isTouchDevice()
    && (mode === 'portrait' || (mode === 'auto' && isPortraitNow()));
  document.body.classList.toggle('is-portrait', portrait);
  document.body.classList.toggle('is-landscape', !portrait);
  syncNativeOrientation(mode);
}

/* 安卓端：把「画面方向」设置真正下发到系统，锁住物理屏幕方向。
   之前网页侧只切 CSS 排版，物理方向完全由 manifest 的 sensor 决定，
   于是选了「横屏」但设备竖着拿就还是竖屏——设置等于没生效。
   这里通过 MainActivity 注入的 ZBApp.setOrientation 下发指令：
     portrait  → 锁竖屏
     landscape → 锁横屏
     auto      → 跟随设备
   网页与桌面端没有这个桥，函数会自然空转。 */
let _lastNativeOrient = null;
function syncNativeOrientation(mode) {
  const bridge = window.ZBApp;
  if (!bridge || typeof bridge.setOrientation !== 'function') return;
  const want = mode === 'portrait' ? 'portrait'
    : mode === 'landscape' ? 'landscape'
      : 'auto';
  if (want === _lastNativeOrient) return;
  _lastNativeOrient = want;
  try { bridge.setOrientation(want); } catch (e) { /* 忽略 */ }
}

/* 旋转后视口尺寸往往不是一帧就稳定：安卓上要等布局重排、WebView 重新量一次。
   这里用 rAF 合并同一帧里的多次触发，再在 260ms 后补算一次收尾。
   visualViewport 的 resize 在地址栏收放时也会来一串，合并掉不会抖。 */
let _screenRaf = 0;
let _screenTimer = null;
function scheduleScreenMode() {
  if (_screenRaf) return;
  _screenRaf = requestAnimationFrame(() => {
    _screenRaf = 0;
    applyScreenMode();
    clearTimeout(_screenTimer);
    _screenTimer = setTimeout(applyScreenMode, 260);
  });
}
ui.onScreenModeChange = applyScreenMode;
applyScreenMode();

/* ---------------- 阅读观感 ----------------
   字号倍率只乘在对话正文上（--dlg-base × --dlg-scale），
   界面其它字号不跟着涨，免得一调大整个面板就散架。
   动效开关加一个 body class，样式里统一把过渡压到近零。 */
function applyReading() {
  const raw = Number(settings.dlgScale);
  const scale = Number.isFinite(raw) ? Math.min(1.6, Math.max(0.8, raw)) : 1;
  document.documentElement.style.setProperty('--dlg-scale', String(scale));
  document.body.classList.toggle('motion-off', settings.motion === 'reduced');
}
applyReading();

/* ---------------- 黑暗模式 ----------------
   只管弹窗外壳（设置、历史、材料、人物、存档、关于…）。
   手机模拟器和政务平台是拟真界面，样式里已经把它们钉死为浅色。 */
function applyNightMode() {
  const on = settings.nightMode !== false;
  document.body.classList.toggle('night', on);
  document.documentElement.style.colorScheme = on ? 'dark' : 'light';
}
applyNightMode();

/* ---------------- 通透模式（Beta） ----------------
   全局液态玻璃。开关单独一层 class，和黑暗模式互不冲突：
   深色底上是暗玻璃，浅色底上是亮玻璃。默认关闭。 */
function applyGlassMode() {
  const on = settings.glassMode === true;
  document.body.classList.toggle('glass', on);
  // 玻璃面很吃重绘，开的时候顺手把立绘的合成层提示打开，减少掉帧
  const stageEl = document.querySelector('.sprite-layer');
  if (stageEl) stageEl.style.willChange = on ? 'transform' : '';
}
applyGlassMode();

/* ---------------- 软键盘避让 ----------------
   安卓壳（MainActivity）会把软键盘高度通过 window.__ZB_ime(px) 报上来；
   浏览器 / 桌面端没有这个桥，用 visualViewport 的高度差自己算。
   键盘弹起时给 <html> 写 --kb，样式据此把输入区顶到键盘上沿，
   顺便给 body 加 .kb-open，面板可以整体上移而不是被键盘压住一半。 */
let _kbHeight = 0;
function applyKeyboardInset(h) {
  const kb = Math.max(0, Math.round(h || 0));
  _kbHeight = kb;
  document.documentElement.style.setProperty('--kb', `${kb}px`);
  document.body.classList.toggle('kb-open', kb > 90);
}
window.__ZB_ime = (h) => { applyKeyboardInset(h); };

function keyboardHeightFromViewport() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const winH = window.innerHeight || document.documentElement.clientHeight || 0;
  const hidden = winH - (vv.height + vv.offsetTop);
  return hidden > 40 ? Math.round(hidden) : 0;
}
if (window.visualViewport && window.visualViewport.addEventListener) {
  window.visualViewport.addEventListener('resize', () => {
    if (_kbHeight && !window.ZBApp) return;      // 原生报了数就别覆盖
    applyKeyboardInset(keyboardHeightFromViewport());
  });
  window.visualViewport.addEventListener('scroll', () => {
    if (_kbHeight && !window.ZBApp) return;
    applyKeyboardInset(keyboardHeightFromViewport());
  });
}
/* 拿到焦点的元素在输入框里时，键盘一定会弹；失焦后延时收键盘高度 */
document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
    setTimeout(() => {
      if (!window.ZBApp) applyKeyboardInset(keyboardHeightFromViewport());
    }, 280);
  }
});
document.addEventListener('focusout', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) {
    setTimeout(() => {
      if (!window.ZBApp) applyKeyboardInset(keyboardHeightFromViewport());
    }, 260);
  }
});

window.addEventListener('resize', scheduleScreenMode);
window.addEventListener('orientationchange', scheduleScreenMode);
if (window.visualViewport && window.visualViewport.addEventListener) {
  window.visualViewport.addEventListener('resize', scheduleScreenMode);
}
if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
  window.screen.orientation.addEventListener('change', scheduleScreenMode);
}

function applyState(next) {
  Object.keys(state).forEach(k => { delete state[k]; });
  Object.assign(state, next);
  ui.state = state;
}

/* 启动序列是否还在跑（标题页据此决定要不要播音乐与入场） */
let _booting = true;

/* ---------------- 界面切换 ---------------- */
function showTitle() {
  document.body.classList.add('is-title');
  titleScreen.hidden = false;
  root.hidden = true;
  refreshTitleNote();
  // 启动序列还在跑的时候，标题页只是先铺在底下：
  // 不播音乐、不播入场，免得在黑屏下面先演一遍。
  if (_booting) return;
  audio.play('title');
  playTitleIntro();
}

/* 标题页入场：把 staged 摘掉再装回去，从游戏里回到标题时也能重播一次。
   中间读一次 offsetWidth 是为了强制重排，否则同名 class 加了也不会重启动画。 */
function playTitleIntro() {
  titleScreen.classList.remove('staged');
  void titleScreen.offsetWidth;
  titleScreen.classList.add('staged');
}

function showGame() {
  document.body.classList.remove('is-title');
  titleScreen.hidden = true;
  root.hidden = false;
}

function refreshTitleNote() {
  const latest = store.latestSlot();
  const note = document.querySelector('#titleSaveNote');
  const btnContinue = titleScreen.querySelector('[data-act="continue"]');
  const contDesc = btnContinue && btnContinue.querySelector('.tcard-d');
  if (latest) {
    const d = latest.data;
    note.textContent = `上次进度：${d.chapterTitle || ''} · ${d.dayLabel || ''}`;
    btnContinue.disabled = false;
    if (contDesc) contDesc.textContent = `${d.chapterTitle || '上次进度'} · ${d.dayLabel || ''}`;
  } else {
    note.textContent = store.storageAvailable() ? '' : '当前环境无法保存进度，仍可正常游玩。';
    // 「继续游戏」里还有时间轴，没存档也要能点进去看
    btnContinue.disabled = false;
    if (contDesc) contDesc.textContent = '还没有进度 · 可查看时间轴';
  }
  refreshTitleSide();
}

/* 首页「支线」按钮：只写「支线」两个字，不剧透里面是哪一条。
   锁着的时候按钮本身置灰不可点；能进的时候点开是路口页，里面才列条目。 */
function refreshTitleSide() {
  const btn = titleScreen.querySelector('[data-act="side"]');
  if (!btn) return;
  const unlocked = sideHubUnlocked(store.loadProgress());
  const open = SIDES.filter(s => s.available);
  btn.classList.toggle('is-locked', !unlocked);
  // 名字不进按钮，只放到无障碍标签和悬停提示里
  const hint = unlocked
    ? `支线路口 · ${open.length} 条可进入`
    : '完成序章后解锁';
  btn.title = hint;
  btn.setAttribute('aria-label', hint);
  btn.disabled = !unlocked;
}

/* 打开支线路口（首页入口） */
function openSideHub() {
  const progress = store.loadProgress();
  const unlocked = sideHubUnlocked(progress);
  ui.openSideHub({
    unlocked,
    progress,
    onGo: (id) => saveAPI.enterSide(id),
    onLoad: () => ui.openSideSavesPicker({ progress, onGo: (id) => saveAPI.enterSide(id) })
  });
}

/* ---------------- 章节流程 ---------------- */
/* 每条支线自己带一套材料与标记，重玩时必须清干净：
   否则第二次进支线会继承上一次的批次结论，直接跳到隐藏结局。 */
const SIDE_MATS = {
  side1: ['M023', 'M024', 'M025', 'M026', 'M027', 'M028', 'M029', 'M030', 'M031', 'M032', 'M033', 'M034', 'M035', 'M036'],
  side2: ['M043', 'M044', 'M045', 'M046', 'M047', 'M048', 'M049', 'M050', 'M051', 'M052', 'M053', 'M054'],
  side3: ['M055', 'M056', 'M057', 'M058', 'M059', 'M060', 'M061', 'M062', 'M063', 'M064', 'M065', 'M066'],
  side4: ['M201'],
  side5: ['M309']
};
const SIDE_CLEAN_FLAGS = {
  // 注意：支线一的标记前缀是 s1_，支线二是 s2_，都不是 side_。
  // 早先这里写成 ['side_']，一个都清不到，重玩时会继承上一局的批次与渠道结论，
  // 于是"明明没查批次"也会被判成查明。加前缀时务必和剧本里实际的 key 对齐。
  side1: ['s1_'],
  side2: ['s2_'],
  side3: ['s3_'],
  side4: ['s5_'],
  side5: ['s6_']
};

function resetSideState(sideId = 'side1') {
  const mats = new Set(SIDE_MATS[sideId] || []);
  const prefixes = SIDE_CLEAN_FLAGS[sideId] || ['side_'];
  state.materials = state.materials.filter(m => !mats.has(m));
  Object.keys(state.flags).forEach(k => { if (prefixes.some(p => k.startsWith(p))) delete state.flags[k]; });
  const ch = CHAPTERS[sideId];
  if (ch) (ch.hubActions || []).forEach(a => { delete state.visits[a.id]; });
  if (sideId === 'side1') state.chats = state.chats.filter(c => c.thread !== 'parents');
  if (sideId === 'side2') state.chats = state.chats.filter(c => c.thread !== 'parents');
  // 这一局自己提交过的政务反映，也要跟着重来，
  // 否则第二局会拿到上一局的受理编号（编号是对的，但它不是这一局的）
  if (sideId === 'side1' && state.gov && state.gov.kind === 'mask') state.gov = null;
  if (sideId === 'side2' && state.gov && state.gov.kind === 'water') state.gov = null;
  if (sideId === 'side3' && state.gov && state.gov.kind === 'eighth') state.gov = null;
  if (state.ending && String(state.ending).startsWith('side_')) state.ending = null;
}

function startChapter(id, { autoSave = true } = {}) {
  const ch = CHAPTERS[id];
  if (!ch) { showTitle(); return; }
  wipeGuard = false;   // 真的开了一局，写档恢复正常
  const isSide = SIDE_IDS.has(id);
  if (isSide) resetSideState(id);
  state.chapterId = id;
  state.index = 0;
  state.hubActive = !!ch.hubActions;
  // 序章之后的所有章节都意味着序章已经走完 → 支线路口解锁
  if (!isSide && id !== 'ch0') state.flags.side_unlocked = true;
  // 凡是有调查中枢的章节，进入时都要把行动点补满；
  // 只对 ch1 重置会导致中断后重进 ch2 时行动点是上一次剩下的（甚至为 0，直接跳过所有调查）。
  if (ch.hubActions) resetAP(state, ch.apMax || CONFIG.actionPoints);
  // 新开一局前把上一局残留的立绘清掉（背景会由本章第一个 bg 节点覆盖）
  if (stage.restoreScene) stage.restoreScene({ sprites: [] });
  showGame();
  engine.loadChapter(ch, 0);
  // 支线不写主线自动存档位，避免把主线进度顶掉
  if (autoSave && !isSide) saveAPI.save(0);
}

function nextChapterId(currentId) {
  const order = CONFIG.chapterOrder;
  const i = order.indexOf(currentId);
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}

function handleChapterEnd(chapter, st) {
  const isSide = SIDE_IDS.has(chapter.id);
  const before = store.loadProgress();
  const firstCh0 = chapter.id === 'ch0' && !(before.chapters || []).includes('ch0');

  if (isSide) {
    const info = SIDE_ENDING_INFO[st.ending] || {};
    store.markSideDone(chapter.id, {
      ending: st.ending || null,
      endingName: info.name || null,
      kind: info.kind || null,
      hidden: !!info.hidden
    });
  } else {
    saveAPI.save(0);
    store.markChapterDone(chapter.id);
    if (chapter.id !== 'ch0') state.flags.side_unlocked = true;
  }

  const next = isSide ? null : nextChapterId(chapter.id);

  // 章节总结（数据来自章节文件，引擎不关心内容）
  ui.openSummary(
    chapter.summary || { title: '章节结束' },
    () => {
      if (next) {
        const nextCh = CHAPTERS[next];
        state.chapterId = next;
        state.index = 0;
        state.hubActive = !!nextCh.hubActions;
        state.dayLabel = nextCh.dayLabel;
        resetAP(state, nextCh.apMax || CONFIG.actionPoints);
        engine.loadChapter(nextCh, 0);
        saveAPI.save(0);
        // 主线里只做提示，不放入口：支线在首页
        if (firstCh0) {
          setTimeout(() => ui.toast('支线已开启。回首页，从「支线」进入。', 4600), 800);
        }
      } else if (isSide) {
        const info = SIDE_ENDING_INFO[st.ending] || {};
        ui.toast(`支线结束 · ${info.name || '已记录'}。记录已存入支线路口。`, 4200);
        showTitle();
      } else {
        ui.toast('全篇到此结束。可以在「关于本作」里查看结局条件。', 4200);
        showTitle();
      }
    },
    next ? `进入${CHAPTERS[next].title}` : (isSide ? '返回首页' : '返回标题')
  );
}

/* ---------------- 继续游戏 / 时间轴 ----------------
   两级结构：
     一级——走过哪几章（章卡片）
     二级——该章内部的横向时间轴（按地点切换切场景）+ 分支（选择点）
   时间轴只画"已经发生过"的部分：从第一章开始，一直画到最新存档所在的章节，
   再往后一律不出现——章节名、地点名都不露，免得提前剧透。 */

/** 把一章的节点流切成「场景」（按 bg.place 变化）并收集选择点 */
function scanChapterScenes(ch) {
  const nodes = ch.nodes || [];
  const seen = (i) => store.isRead(`${ch.id}#${i}`);
  const scenes = [];
  let cur = null;

  nodes.forEach((n, i) => {
    if (n.t === 'bg' && n.place) {
      if (!cur || cur.place !== n.place) {
        cur = { place: n.place, at: i, read: false, branches: [] };
        scenes.push(cur);
      }
    }
    if (n.t === 'choice') {
      if (!cur) {
        cur = { place: '', at: i, read: false, branches: [] };
        scenes.push(cur);
      }
      cur.branches.push({
        at: i,
        read: seen(i),
        prompt: n.prompt || '怎么选？',
        options: (n.options || []).map(o => o.text || o.label || '').filter(Boolean)
      });
    }
  });

  scenes.forEach(s => {
    s.read = seen(s.at);
    s.reached = s.read || s.branches.some(b => b.read);
    // 节点下标要留下来：时间轴上的场景可以点进去从那里接着走，
    // 所以它得能被 engine.loadChapter 用上。名字改成 nodeAt，免得和界面上的序号混。
    s.nodeAt = s.at;
    delete s.at;
  });
  return scenes;
}

/** 一章的分支汇总（只在真正走过去之后才露出选项文字） */
function summarizeBranches(scenes) {
  const all = [];
  scenes.forEach(s => s.branches.forEach(b => all.push(b)));
  return all;
}

function buildChapterTimeline() {
  const progress = store.loadProgress();
  const latest = store.latestSlot();
  const curId = latest ? latest.data.chapterId : null;
  const out = [];

  for (const id of CONFIG.chapterOrder) {
    const meta = CHAPTERS[id];
    if (!meta) continue;
    const done = progress.chapters.includes(id);
    const current = id === curId && !done;
    if (!done && !current) break;

    const scenes = scanChapterScenes(meta);
    const branches = summarizeBranches(scenes);
    // 只保留走到过的那一段；最后补一个"未知"尾巴由界面画
    let cut = -1;
    scenes.forEach((s, i) => { if (s.reached || s.read) cut = i; });
    const shown = cut >= 0 ? scenes.slice(0, cut + 1) : scenes.slice(0, 0);

    out.push({
      id,
      title: meta.title || meta.name || id,
      name: meta.name || '',
      dayLabel: meta.dayLabel || '',
      state: done ? 'done' : 'current',
      scenes: shown.map(s => ({
        place: s.place || '未命名的场景',
        read: s.read,
        nodeAt: s.nodeAt,
        branches: s.branches.filter(b => b.read).map(b => ({
          prompt: b.prompt,
          options: b.options
        }))
      })),
      sceneTotal: scenes.length,
      branchCount: branches.filter(b => b.read).length,
      branchTotal: branches.length
    });
  }
  return out;
}

function buildSideTimeline() {
  const progress = store.loadProgress();
  return SIDES
    .filter(s => progress.sides && progress.sides[s.id])
    .map(s => {
      const p = progress.sides[s.id];
      return { id: s.id, title: s.name || '支线', count: p.count || 0, lastName: p.lastName || '' };
    });
}

function openContinuePage() {
  const latest = store.latestSlot();
  const d = latest ? latest.data : null;
  ui.openContinue({
    hasSave: !!latest,
    resumeLabel: d ? `${d.chapterTitle || '上次进度'} · ${d.dayLabel || ''}` : '',
    chapters: buildChapterTimeline(),
    sides: buildSideTimeline(),
    onResume: () => {
      const l = store.latestSlot();
      if (l) saveAPI.load(l.slot, 'main');
    },
    // 时间轴里的支线可以直接点进去重走一遍
    onSide: (id) => {
      const side = getSide(id);
      if (!side) return;
      ui.closeAll();
      saveAPI.enterSide(id);
      showGame();
    },
    // 时间轴里的章节：从头重玩，或从某个场景接着走。
    // 这一页的用处就是回去看别的分支和结局，所以必须真的能进得去。
    onChapter: (chId, nodeAt = 0, label = '') => {
      const ch = CHAPTERS[chId];
      if (!ch) return;
      const from = Math.max(0, Math.min(Number(nodeAt) || 0, (ch.nodes || []).length - 1));
      ui.closeAll();
      // 先不写自动存档：万一从中间接上就崩了，别把原来那份存档一起顶掉
      startChapter(chId, { autoSave: false });
      if (from > 0) engine.loadChapter(ch, from);
      // 站定了再写一份，之后「继续游戏」回到的就是这里
      if (!SIDE_IDS.has(chId)) saveAPI.save(0);
      if (from > 0) ui.toast(label ? `已从「${label}」接上` : '已接上，往后照原样走', 1800);
      showGame();
    }
  });
}

/* ---------------- 标题交互 ---------------- */
titleScreen.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  audio.unlock();
  audio.sfx('click');
  const act = btn.dataset.act;

  if (act === 'new') {
    requestNewGame();
  }
  if (act === 'side') {
    openSideHub();
  }
  if (act === 'continue') {
    openContinuePage();
  }
  if (act === 'load') {
    ui.openSaves('load', { scope: 'main' });
  }
  if (act === 'settings') {
    ui.openSettings();
  }
  if (act === 'changelog') {
    ui.openChangelog();
  }
  if (act === 'about') {
    ui.openAbout();
  }
});

/* 标题页右下角的助手入口：和菜单分开，随时能点 */
const aiFab = document.querySelector('#aiFab');
if (aiFab) aiFab.addEventListener('click', () => {
  audio.unlock();
  audio.sfx('click');
  ui.openAssistant();
});

/* 反馈问题：打开面板说明 + 跳转问卷（腾讯问卷） */
const FEEDBACK_URL = 'https://wj.qq.com/s2/28441084/m5z9';
const feedbackFab = document.querySelector('#feedbackFab');
if (feedbackFab) feedbackFab.addEventListener('click', () => {
  audio.unlock();
  audio.sfx('click');
  ui.openPanel({
    title: '反馈问题',
    narrow: true,
    body: `
      <p>《不属于我的周末》还在打磨中，遇到的任何问题都欢迎提给我。下面这份问卷分四类，
      挑最接近的一项填就行——<b>填错类别也没关系</b>，我照内容看。</p>

      <div class="fb-types">
        <div class="fb-type"><b>反馈 BUG</b><span>功能不正常、卡住、显示错乱、报错等</span></div>
        <div class="fb-type"><b>提建议</b><span>玩法、剧情、界面、体验上的改进想法</span></div>
        <div class="fb-type"><b>支线内容投稿</b><span>你想写的故事、想扩写的支线、想补充的设定</span></div>
        <div class="fb-type"><b>其他</b><span>上面都不太合适，或者只是想聊聊</span></div>
      </div>

      <p class="fb-need"><b>必填</b>：QQ 号（用回复你的，只有这一项是联系方式）</p>
      <p class="fb-need"><b>选填</b>：附件、邮箱、平台与版本号、你玩到哪儿了</p>

      <details class="fb-help">
        <summary>问卷里每一项是干什么的？</summary>
        <div class="fb-help-body">
          <ul>
            <li><b>反馈类型</b>——决定我优先看哪一堆反馈，也是后面几道追问要不要填的开关。</li>
            <li><b>QQ 号</b>——唯一的必填项。我用它回复你；实在不想留真号，填个你记得住的小号也行，我不追问。</li>
            <li><b>一句话概括</b>——一句话说清是什么事，60 字以内。看反馈列表时先扫的就是这一栏。</li>
            <li><b>详细描述</b>——最重要的。写清你当时在做什么、点哪里、看到什么、原本期望什么，我照着这个去复现。</li>
            <li><b>BUG 追问（能不能复现 / 影响多大）</b>——只填 BUG 时才需要。偶尔才出现的问题，写清楚大概多久出现一次，比写「偶现」有用得多。</li>
            <li><b>建议追问（想改什么 / 有多想要）</b>——写你脑子里的原话就行，不用讲究措辞；「有多想要」只是帮我排优先级。</li>
            <li><b>投稿追问（想写什么故事 / 多长）</b>——哪怕只有几句话我也能帮你展开。说清背景、人物、走向、想让人想想什么就行。</li>
            <li><b>平台 / 版本号</b>——填了我好确认是不是最新版的问题，尤其是界面显示类的。</li>
            <li><b>你玩到哪儿了</b>——卡关了就写卡在哪一步，我可以直接给你提示，不用另开一封邮件。</li>
            <li><b>附件</b>——BUG 反馈强烈建议附一张截图，能省掉好几轮来回描述。</li>
            <li><b>联系方式 / 还有什么想说的</b>——除了 QQ 号之外的联系方式，以及任何吐槽、夸夸、你觉得哪里别扭。</li>
          </ul>
        </div>
      </details>

      <p class="fb-tip">填完直接提交，答案会直接进到我的反馈表里。<b>小号可能会被陌生人搜到</b>，介意的话在最后一项里说明一下。</p>

      <p style="margin-top:16px"><button class="btn btn-primary" id="feedbackGo" type="button">去填写问卷 →</button></p>
      <p class="fb-tip-mini" id="feedbackHint"></p>
    `
  });

  /* 问卷一律交给系统浏览器：
     1) 游戏内 WebView 里上传附件在部分安卓机型上会被系统拦掉，
        换成自带浏览器就能正常选文件、拍照上传；
     2) 用户还能顺手截图、转发、收藏；
     3) 桌面端没有这个桥，退化成普通新标签页打开。 */
  const goBtn = document.querySelector('#feedbackGo');
  const hint = document.querySelector('#feedbackHint');
  if (hint) {
    hint.textContent = window.ZBApp && typeof window.ZBApp.openUrl === 'function'
      ? '会用系统自带浏览器打开（方便上传截图）。'
      : '将在新标签页打开。';
  }
  if (goBtn) goBtn.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    const bridge = window.ZBApp;
    if (bridge && typeof bridge.openUrl === 'function') {
      try { bridge.openUrl(FEEDBACK_URL); return; } catch (e) { /* 退回网页方式 */ }
    }
    window.open(FEEDBACK_URL, '_blank', 'noopener');
  });
});

/* 标题页左上角的适龄提示：点开说清楚它是什么、不是什么。
   放上面是为了第一眼就能看见；说不清楚反而会被当成资质，所以宁可多写两句。 */
const ageBadge = document.querySelector('#ageBadge');
if (ageBadge) ageBadge.addEventListener('click', () => {
  audio.unlock();
  audio.sfx('click');
  ui.openPanel({
    title: '🎮 游戏适龄提示',
    narrow: true,
    body: `
      <p>【适龄级别】<b> 12+</b>（建议十二周岁及以上用户使用）</p>
      <p>【游戏类型】 文字冒险 / 校园日常 / 剧情解谜</p>
      <p>【核心内容说明】<br>
      本作是一款以现代虚拟校园为背景的剧情向游戏。故事围绕学生面对学校制度安排时的日常生活、人际交往与个人选择展开。<br>
      游戏内容包含轻度校园竞争压力、群体社交氛围探讨，以及主角针对规则进行的非暴力的调查与记录。不包含血腥暴力、恐怖惊悚、色情低俗或任何现实中的违法犯罪引导。本作旨在通过虚构的剧情体验，引导玩家思考规则、尊重他人边界以及合理表达诉求。</p>
      <p>【温馨提示】本作故事及学校、人物均为虚构创作，请勿与现实对号入座。请合理安排游戏时间，享受健康生活。建议未成年人在家长的监护或指导下进行游戏。</p>`
  });
});

/* ---------------- 开始新游戏 ----------------
   自动存档（0 号位）只有一份，新开一局会把它顶掉，
   所以先问一句。手动存档位（1–8）不受影响，这一点也要说清楚。 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function requestNewGame() {
  const latest = store.latestSlot();
  if (!latest) { disclaimer.hidden = false; return; }

  const d = latest.data || {};
  const where = [d.chapterTitle, d.dayLabel].filter(Boolean).join(' · ') || '上次进度';
  ui.confirm({
    title: '已经有一份自动存档',
    text: `自动存档停在 <b>${esc(where)}</b>。<br>
           开始新游戏会<b class="cfm-warn">覆盖这份自动存档</b>，覆盖之后找不回来。<br>
           手动存进存档位（1–8）的进度不会被删，之后还能从「载入进度」回到那里。`,
    okLabel: '覆盖，重新开始',
    cancelLabel: '先不开始',
    danger: true,
    onOk: () => { disclaimer.hidden = false; }
  });
}

document.querySelector('#disclaimerOk').addEventListener('click', () => {
  disclaimer.hidden = true;
  pickProtagonist(() => {
    // 全新开始
    applyState(createState());
    startChapter(CONFIG.chapterOrder[0]);
  });
});

/* 开新档时选一次主角性别。
   只在"全新开始"时问；读档/继续游戏沿用设置里存着的那个，
   不会因为换了个存档就把人选换了。 */
function pickProtagonist(then) {
  const cur = settings.protagonist === 'female' ? 'female' : 'male';
  ui.openPanel({
    title: '你是哪一位',
    narrow: true,
    // 这一步必须选完才能继续：关掉面板就没有 then()，
    // 游戏会停在标题页、点了开始也不动，玩家会以为卡死了。
    lockClose: true,
    body: `
      <p>故事里的「我」叫林知序。先定一下他/她长什么样——这只影响立绘，
      剧情、选项、结局都不分男女。</p>
      <div class="hero-pick">
        <button class="hero-card${cur === 'male' ? ' on' : ''}" data-pick="male" type="button">
          <span class="hero-face" style="background-image:url('assets/characters/lin_male.png')"></span>
          <span class="hero-name">男主</span>
          <span class="hero-desc">白衬衫、藏青长裤，肩上挎着帆布包。</span>
        </button>
        <button class="hero-card${cur === 'female' ? ' on' : ''}" data-pick="female" type="button">
          <span class="hero-face" style="background-image:url('assets/characters/lin_female.png')"></span>
          <span class="hero-name">女主</span>
          <span class="hero-desc">短袖衬衫配针织背心，百褶裙。</span>
        </button>
      </div>
      <p class="hero-note">选错了也没关系，之后在设置里的「主角性别」随时能改。</p>
      <button class="btn btn-primary hero-go" id="heroGo" type="button">就这样，开始</button>
    `
  });
  const box = ui.el.panelBody;
  box.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    audio.sfx('click');
    settings.protagonist = b.dataset.pick;
    setProtagonist(settings.protagonist);
    store.saveSettings(settings);
    box.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('on', x === b));
  }));
  const go = box.querySelector('#heroGo');
  if (go) go.addEventListener('click', () => {
    audio.sfx('select');
    ui.closePanel();
    then();
  });
}

/* ---------------- 启动序列 ----------------
   黑屏 → 作者 → 游戏标识 → 健康忠告 → 光敏警告 → 检查更新 → 主界面。
   放在这里跑（标题页已经铺好），序列淡出时主界面正好接着淡入。
   标题页的入场动画等序列结束再播，否则会在黑屏底下先演一遍。 */
function startBootSequence() {
  const root = document.querySelector('#bootSeq');
  if (!root) { playTitleIntro(); return; }
  // 序列期间先不播标题入场
  titleScreen.classList.remove('staged');
  runBootSequence({
    root,
    version: CONFIG.version,
    checkUpdate,
    onDone: () => {
      _booting = false;
      audio.play('title');
      playTitleIntro();
      // 序列里没查到的话，进标题后再补一次（有 6 小时节流，不会重复打扰）
      setTimeout(maybeCheckUpdate, 1200);
    }
  });
}

/* ---------------- 热更新 ----------------
   检查放在玩家第一次点击之后：WebAudio、focus、fetch 都可能被"未交互"策略挡住，
   启动瞬间就弹窗也容易和开场动画打架。
   两条线分开处理：
     · 网页资源有新版 → 直接热更（下载完提示"下次启动生效"）
     · 外壳版本低于 shellMin → 只能装新客户端，如实告诉玩家，不假装能热更 */
let _updateTask = null;
function maybeCheckUpdate() {
  if (_updateTask) return _updateTask;
  if (!shouldAutoCheck()) return null;
  _updateTask = (async () => {
    const r = await checkUpdate();
    markChecked();
    if (!r.ok || r.kind === 'none') return;
    showUpdateNotice(r);
  })().catch(() => { /* 网络问题一律静默 */ });
  return _updateTask;
}

function showUpdateNotice(r) {
  const remote = r.remote || {};
  const needShell = r.kind === 'shell' || r.kind === 'both';
  const hasContent = r.kind === 'content' || r.kind === 'both';
  const notes = (remote.notes ? String(remote.notes).split('\n').filter(Boolean) : [])
    .map(t => `<li>${t}</li>`).join('');

  const body = `
    <p>当前网页资源 <b>v${r.curContent}</b>，远端 <b>v${r.content}</b>；
       客户端外壳 <b>v${r.curShell}</b>${needShell ? `（需要至少 v${r.shellMin}）` : ''}。</p>
    ${hasContent ? '<p>新的剧情、立绘、背景或界面可以<strong>直接热更新</strong>，不用重装。</p>' : ''}
    ${needShell ? `<p class="up-warn"><b>这次还改了客户端程序本身</b>，热更新装不了这一部分——
        请到发布页下载新的安装包覆盖安装。存档在应用数据里，覆盖安装不会丢。</p>` : ''}
    ${notes ? `<div class="up-notes"><b>这次改了什么</b><ul>${notes}</ul></div>` : ''}
    <p class="up-meta">检查时间：${new Date().toLocaleString()}</p>
  `;

  const foot = hasContent
    ? '<button class="btn btn-ghost" id="upLater">以后再说</button>'
      + `<button class="btn btn-primary" id="upNow">${needShell ? '去下载新客户端' : '现在下载'}</button>`
    : '<button class="btn btn-primary" id="upNow">去下载新客户端</button>';

  ui.openPanel({ title: '有新版本', narrow: true, body, foot });
  const box = ui.el.panelBody;
  const pfoot = ui.el.panelFoot;

  const later = pfoot.querySelector('#upLater');
  if (later) later.addEventListener('click', () => { audio.sfx('click'); ui.closePanel(); });

  const now = pfoot.querySelector('#upNow');
  if (now) now.addEventListener('click', async () => {
    audio.sfx('click');
    now.disabled = true;
    now.textContent = '正在下载…';
    const res = await applyContentUpdate(remote);
    if (res && res.ok) {
      now.textContent = '已下载，重启后生效';
      if (box) {
        const tip = document.createElement('p');
        tip.className = 'up-warn';
        tip.innerHTML = '<b>下载完成。</b>关掉游戏再打开，新内容就会生效。';
        box.appendChild(tip);
      }
      setTimeout(() => { ui.closePanel(); }, 1600);
    } else if (res && res.reason === 'no-shell') {
      // 网页版没有外壳，刷新即可拿到新资源
      now.disabled = false;
      now.textContent = '刷新页面';
      now.onclick = () => location.reload();
      if (box) {
        const tip = document.createElement('p');
        tip.className = 'up-meta';
        tip.textContent = '网页版直接刷新页面就会加载最新版本。';
        box.appendChild(tip);
      }
    } else {
      now.disabled = false;
      now.textContent = '重试';
      if (box) {
        const tip = document.createElement('p');
        tip.className = 'up-warn';
        tip.textContent = '下载没有成功（网络或存储问题）。可以重试，或者在下次启动时再试。';
        box.appendChild(tip);
      }
    }
  });
}

/* 启动序列里已经查过一次，这里不再额外触发；
   保留节流函数供序列 onDone 之后补查。 */

/* ---------------- HUD 按钮 ---------------- */
root.querySelector('#btnPhone').addEventListener('click', () => {
  engine.pause();
  ui.openPhone('home', null);   // 顶栏进来先看桌面，剧情里的 phone 节点仍然直接进会话
});
root.querySelector('#btnAI').addEventListener('click', () => {
  audio.sfx('click');
  engine.pause();
  ui.openAssistant();
});
root.querySelector('#btnMaterials').addEventListener('click', () => ui.openMaterials());
root.querySelector('#btnCharacters').addEventListener('click', () => ui.openCharacters());
root.querySelector('#btnMenu').addEventListener('click', () => ui.toggleMenu());

// 政务服务平台：查看自己提交过的反映与办理答复（不推进剧情）
root.querySelector('#btnGov').addEventListener('click', () => {
  audio.sfx('click');
  ui.openGovHome();
});

// 选项界面里的「存档 / 菜单」：选到一半也能保存
root.querySelector('#choiceSave').addEventListener('click', (e) => {
  e.stopPropagation();
  audio.sfx('click');
  ui.openSaves('save', saveAPI.current());
});
root.querySelector('#choiceMenu').addEventListener('click', (e) => {
  e.stopPropagation();
  audio.sfx('click');
  ui.toggleMenu();
});

/* ---------------- 自动存档（每 30 秒） ---------------- */
setInterval(() => {
  if (engine && engine.chapter && !root.hidden) saveAPI.save(0);
}, 30000);

/* ---------------- 页面可见性 / 前后台 ----------------
   切到后台必须：存档 + 停音乐。只靠 visibilitychange 在部分 WebView 里不触发，
   所以外壳（Android onPause / Electron blur）还会额外调用 __ZB_appPause。 */
function enterBackground() {
  if (engine && engine.chapter) saveAPI.save(0);
  audio.suspendAll();
  store.flushRead();
}

function leaveBackground() {
  audio.resumeAll();
  store.flushRead();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) enterBackground();
  else leaveBackground();
});

window.addEventListener('pagehide', enterBackground);
window.addEventListener('blur', () => { if (document.hidden) enterBackground(); });

window.__ZB_appPause = () => { enterBackground(); return 'paused'; };
window.__ZB_appResume = () => { leaveBackground(); return 'resumed'; };

/* ---------------- 启动 ---------------- */
showTitle();
store.flushRead();
// 标题页铺好之后再跑启动序列：序列淡出时主界面正好接着淡入
startBootSequence();

// 调试钩子（便于自动化测试与排查，不影响游戏逻辑）
window.__ZBNX = {
  get state() { return state; },
  get engine() { return engine; },
  get ui() { return ui; },
  get settings() { return settings; },
  get audio() { return audio; },
  get stage() { return stage; },
  get chapters() { return CHAPTERS; },
  get saveAPI() { return saveAPI; },
  go(id, index = 0) { startChapter(id); if (index) engine.loadChapter(CHAPTERS[id], index); },
  save(slot = 0) { return saveAPI.save(slot); },
  load(slot = 0) { return saveAPI.load(slot); },
  backToTitle() { return saveAPI.backToTitle(); },
  exitApp() { return exitApp(); }
};

/* ---------------- 退出 ----------------
   安卓外壳全屏沉浸，系统导航栏是藏起来的，只靠手势很难发现，
   所以在标题页与游戏菜单里都放了显式入口。
   ZBApp 是 MainActivity 注入的桥；Electron 直接 close；网页端只能提示。 */
function exitApp() {
  const native = !!(window.ZBApp && typeof window.ZBApp.exit === 'function');
  if (native) {
    try { window.ZBApp.exit(); return; } catch (e) { /* 落到下面 */ }
  }
  if (navigator.userAgent.indexOf('Electron') >= 0) {
    try { window.close(); return; } catch (e) { /* 落到下面 */ }
  }
  ui.toast('浏览器里直接关掉这个标签页就行', 2200);
}

/* 有没有"能退出的外壳"：决定标题页右上角那个按钮显不显示 */
const HAS_SHELL = !!(window.ZBApp) || navigator.userAgent.indexOf('Electron') >= 0;
{
  const q = document.querySelector('#titleQuit');
  if (q) {
    q.hidden = !HAS_SHELL;
    q.addEventListener('click', exitApp);
  }
}

/* ---------------- 系统返回键（Android WebView 调用） ----------------
   返回 'handled' 表示网页已经处理掉这次返回；返回 'exit' 交给外壳退出。 */
window.__ZB_back = () => {
  // 0) 确认框（覆盖存档这类问题，返回键等于「取消」）
  if (document.getElementById('confirmMask')) { ui.closeConfirm(); return 'handled'; }
  // 1) 免责声明
  if (!disclaimer.hidden) { disclaimer.hidden = true; return 'handled'; }
  // 2) 任何面板（设置在标题页打开时也在这一层）
  if (!ui.el.panelLayer.hidden) {
    // 聊天面板在等回复时不允许被返回键关掉，否则流程会卡死
    if (ui._lockClose) {
      ui.toast('请先回复这条消息', 1500);
      return 'handled';
    }
    ui.closePanel();
    return 'handled';
  }
  // 3) 跳过询问
  if (!ui.el.skipPrompt.hidden) {
    ui.el.skipPrompt.hidden = true;
    if (ui._skipCb) { const cb = ui._skipCb; ui._skipCb = null; cb(false); }
    return 'handled';
  }
  // 4) 调查中枢
  if (!ui.el.hubLayer.hidden) {
    ui.toast('请选择一项行动，或点击“结束今天的调查”');
    return 'handled';
  }
  // 5) 选项：必须选，不拦截
  if (!ui.el.choiceLayer.hidden) return 'handled';
  // 6) 标题页：交给外壳退出
  if (document.body.classList.contains('is-title')) return 'exit';
  // 7) 游戏中：打开菜单
  engine.stopAllModes();
  ui.toggleMenu();
  return 'handled';
};

// 开发提示
if (!store.storageAvailable()) {
  console.warn('[不属于我的周末] 当前环境 localStorage 不可用，存档将只保留在内存中。');
}
