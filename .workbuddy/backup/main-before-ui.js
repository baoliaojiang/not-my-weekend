/* =========================================================
   入口：装配各模块，管理标题 → 章节 → 总结 → 章节 的循环
   ========================================================= */

import { CONFIG } from './config/game.js';
import { createState, hydrate, serialize, resetAP } from './core/state.js';
import * as store from './core/store.js';
import { AudioManager } from './core/audio.js';
import { Stage } from './core/stage.js';
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
const audio = new AudioManager(settings);
const stage = new Stage(root, settings);
let engine = null;
let ui = null;

/* ---------------- 存档 API（供 UI 调用） ----------------
   主线与支线各用一套槽位：scope 决定读写哪一组键，
   这样在支线里存档不会把主线进度顶掉，读支线存档也不会带坏主线状态。 */
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
  },

  resetRead() { store.resetRead(); },

  backToTitle() {
    engine.stopAllModes();
    ui.closeAll();
    showTitle();
  }
};

/* ---------------- 装配 ---------------- */
ui = new UI({ root, state, settings, audio, saveAPI });
engine = new Engine({
  state, stage, audio, ui, settings,
  onChapterEnd: handleChapterEnd
});
ui.engine = engine;

/* ---------------- 画面方向 ----------------
   screenMode: auto 跟随设备 / portrait / landscape 强制排版。
   只切排版（立绘尺寸与位置、对话框形态），不改设备的物理方向锁。 */
function applyScreenMode() {
  const mode = settings.screenMode || 'auto';
  const portrait = mode === 'portrait' || (mode === 'auto' && window.innerHeight > window.innerWidth);
  document.body.classList.toggle('is-portrait', portrait);
  document.body.classList.toggle('is-landscape', !portrait);
  // 手机上竖屏时把可用高度交给 CSS 的 dvh，避免地址栏吃掉一截
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
ui.onScreenModeChange = applyScreenMode;
applyScreenMode();
window.addEventListener('resize', applyScreenMode);
window.addEventListener('orientationchange', () => setTimeout(applyScreenMode, 120));

function applyState(next) {
  Object.keys(state).forEach(k => { delete state[k]; });
  Object.assign(state, next);
  ui.state = state;
}

/* ---------------- 界面切换 ---------------- */
function showTitle() {
  document.body.classList.add('is-title');
  titleScreen.hidden = false;
  root.hidden = true;
  audio.play('title');
  refreshTitleNote();
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
  if (latest) {
    const d = latest.data;
    note.textContent = `上次进度：${d.chapterTitle || ''} · ${d.dayLabel || ''}`;
    btnContinue.disabled = false;
  } else {
    note.textContent = store.storageAvailable() ? '' : '当前环境无法保存进度，仍可正常游玩。';
    btnContinue.disabled = true;
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

/* ---------------- 标题交互 ---------------- */
titleScreen.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  audio.unlock();
  audio.sfx('click');
  const act = btn.dataset.act;

  if (act === 'new') {
    disclaimer.hidden = false;
  }
  if (act === 'side') {
    openSideHub();
  }
  if (act === 'continue') {
    const latest = store.latestSlot();
    if (latest) saveAPI.load(latest.slot, 'main');
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

document.querySelector('#disclaimerOk').addEventListener('click', () => {
  disclaimer.hidden = true;
  // 全新开始
  applyState(createState());
  startChapter(CONFIG.chapterOrder[0]);
});

/* ---------------- HUD 按钮 ---------------- */
root.querySelector('#btnPhone').addEventListener('click', () => {
  engine.pause();
  ui.openPhone('list', null);
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
  backToTitle() { return saveAPI.backToTitle(); }
};

/* ---------------- 系统返回键（Android WebView 调用） ----------------
   返回 'handled' 表示网页已经处理掉这次返回；返回 'exit' 交给外壳退出。 */
window.__ZB_back = () => {
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
  console.warn('[周日不返校] 当前环境 localStorage 不可用，存档将只保留在内存中。');
}
