/* =========================================================
   剧情播放引擎
   ---------------------------------------------------------
   设计要点：
   · 剧情数据（data/ch*.js）与引擎完全分离，引擎只认节点类型；
   · 跳过以"节点"为单位推进，跳过时仍然会执行所有副作用
     （材料、标记、人物状态、聊天、选项记录、场景状态）；
   · 跳过遇到 选项 / 调查 / 聊天回复 一律停下，绝不代为选择；
   · 自动播放、文字速度、整句快显、历史记录都在这一层实现；
   · 已读以"章节#帧#节点"为键，跨存档共享。
   ========================================================= */

import { CONFIG } from '../config/game.js';
import { isRead, markRead, flushRead } from './store.js';
import {
  addMaterial, setFlag, getFlag, addStat, recordChoice, spendAP
} from './state.js';
import { CHARACTERS } from '../data/characters.js';
import { aiComplete, buildGovPrompt, toParagraphs, aiConfigured, AI_SYSTEM } from './ai.js';

export class Engine {
  constructor(ctx) {
    this.ctx = ctx;              // { state, stage, audio, ui, settings, onChapterEnd }
    this.chapter = null;
    this.frames = [];
    this.labels = new Map();

    this.skipActive = false;
    this.skipAll = false;
    this.autoActive = false;
    this.typing = false;
    this.waiting = false;
    this.typeTimer = null;
    this._typeRaf = null;
    this.autoTimer = null;
    this.stepTimer = null;
    this.current = null;
    this.pendingKey = null;
    this.paused = false;         // 面板打开时暂停推进
    this.blocked = false;        // 交互界面中（调查/聊天/选项）

    this._bindInput();
  }

  /* ================= 输入 ================= */
  _bindInput() {
    const root = this.ctx.ui.root;
    const dlg = root.querySelector('#dialogue');
    const advance = (e) => {
      if (this.paused || this.blocked) return;
      if (e && e.target.closest('button')) return;
      this.onTap();
    };
    dlg.addEventListener('click', advance);
    root.querySelector('#stage').addEventListener('click', advance);
    // 卡板自己也是一块可以点的面（它盖在舞台上面，舞台收不到点击）
    const curtain = root.querySelector('#curtain');
    if (curtain) curtain.addEventListener('click', advance);

    root.querySelector('#btnAuto').addEventListener('click', () => this.toggleAuto());
    root.querySelector('#btnSkip').addEventListener('click', () => this.toggleSkip());
    root.querySelector('#btnLog').addEventListener('click', () => {
      this.ctx.ui.openLog(this.ctx.state.log || []);
    });

    document.addEventListener('keydown', (e) => {
      if (this.paused || this.blocked) return;
      if (document.querySelector('#panelLayer:not([hidden])')) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.onTap(); }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') { if (!e.repeat) this.toggleSkip(); }
      if (e.code === 'KeyA') this.toggleAuto();
      if (e.code === 'Escape') this.ctx.ui.toggleMenu();
    });
  }

  onTap() {
    // 音频初始化失败（无音频设备、Context 被策略拦住）不应该让人点不动
    try { this.ctx.audio.unlock(); } catch (e) { /* ignore */ }
    if (this.typing) { this.finishTyping(); return; }
    if (this.waiting) { this.advance(); return; }

    // 兜底：typing 与 waiting 同时为 false，但画面上还有一句话停在那里。
    // 成因通常是某次渲染中断（切后台、被面板顶掉、低端机掉帧把 rAF 掐了）
    // 把等待态弄丢了，于是 advance 的守卫直接 return，点击永远没反应——
    // 看起来就是"卡死在某一句话上"。这里强制往前推一格。
    if (this.paused || this.blocked) return;
    const ui = this.ctx.ui;
    if (ui && ui.root && ui.root.querySelector('#panelLayer:not([hidden])')) return;
    const el = ui && ui.root && ui.root.querySelector('#dlgText');
    if (!el || !el.textContent) return;
    const f = this.frame();
    if (!f || !f.nodes || f.i >= f.nodes.length - 1) return;
    this.advance(true);
  }

  /* ================= 章节 ================= */
  /**
   * @param {object} chapter
   * @param {number} startIndex 主干节点下标
   * @param {object|null} snap  存档里的帧栈快照（调查行动 / 中段事件进行中时才有）
   */
  loadChapter(chapter, startIndex = 0, snap = null) {
    // 读档/换章：先把上一次留下的交互态清干净。
    // 以前这里不复位，若在聊天或选项中途读档，blocked 会一直是 true，
    // 表现就是“选项弹不出来 / 弹出来点不动”。
    // 帧栈也要先清空：UI 收尾时任何漏网的回调都会 next()，
    // 此时若还挂着旧章节的帧，就会拿新读进来的状态去跑旧节点。
    this.frames = [];
    this.current = null;
    this.ctx.ui.closeAll();
    if (this.ctx.ui.hideChatContinue) this.ctx.ui.hideChatContinue();
    this._stopTyping();
    clearTimeout(this.stepTimer);
    clearTimeout(this.autoTimer);
    this.blocked = false;
    this.paused = false;
    this.typing = false;
    this.waiting = false;
    this.skipActive = false;
    this.skipAll = false;
    this.autoActive = false;
    // 换章/读档时把开场卡板收掉，否则它会盖在新画面上
    this._cardOpen = false;
    this._cardSeq = (this._cardSeq || 0) + 1;
    const cardEl = this.ctx.ui.root.querySelector('#curtain');
    if (cardEl) { cardEl.classList.remove('on'); cardEl.hidden = true; }
    const skipBtn = this.ctx.ui.root.querySelector('#btnSkip');
    if (skipBtn) skipBtn.classList.remove('active');
    const autoBtn = this.ctx.ui.root.querySelector('#btnAuto');
    if (autoBtn) autoBtn.classList.remove('active');

    this.chapter = chapter;
    this.labels.clear();
    chapter.nodes.forEach((n, i) => {
      if (n.t === 'label') this.labels.set(n.name, i);
    });
    this.frames = [{ nodes: chapter.nodes, i: startIndex, key: 'main', onDone: null }];
    this.ctx.state.chapterId = chapter.id;
    this.ctx.state.index = startIndex;
    this.ctx.state.dayLabel = chapter.dayLabel || this.ctx.state.dayLabel;

    /* 读档时如果当时正处在某个调查行动 / 中段事件里，把整条帧栈还原回去。
       只恢复主干游标是不够的——state.index 在子帧执行期间不会更新，
       于是读档会落回 hub 节点，行动点已经扣掉、行动却没做完，玩家会觉得“存档没生效”。 */
    const rebuilt = this.rebuildFrames(chapter, snap);
    if (rebuilt) {
      this.frames = rebuilt;
      this.blocked = false;
    }

    this.ctx.ui.setChapter(chapter);
    this.ctx.ui.setAP(this.ctx.state);
    if (chapter.music) this.ctx.audio.play(chapter.music);
    this.run();
  }

  /** 存档用：把当前帧栈（含行动 / 事件子帧）压成可序列化的快照 */
  snapshot() {
    return {
      frames: this.frames.map(f => ({ key: f.key || 'main', i: f.i }))
    };
  }

  /** 按 key 找回一段脚本：main → 章节节点；act:* → 调查行动；ev:* → 中段事件 */
  frameNodes(chapter, key) {
    if (!key || key === 'main') return chapter.nodes;
    const idx = key.indexOf(':');
    const kind = idx > 0 ? key.slice(0, idx) : '';
    const id = idx > 0 ? key.slice(idx + 1) : key;
    if (kind === 'act') {
      const a = (chapter.hubActions || []).find(x => x.id === id);
      return a ? (a.script || []) : null;
    }
    if (kind === 'ev') {
      const e = (chapter.hubEvents || []).find(x => x.id === id);
      return e ? (e.script || []) : null;
    }
    return null;
  }

  /** 子帧结束后的回调要和当初 push 时一致，否则行动做完不会回中枢 */
  frameDone(key) {
    if (!key || key === 'main') return null;
    if (key.indexOf('act:') === 0) return () => this.afterHubAction();
    if (key.indexOf('ev:') === 0) return () => this.reopenHub();
    return null;
  }

  rebuildFrames(chapter, snap) {
    if (!snap || !Array.isArray(snap.frames) || snap.frames.length < 2) return null;
    const out = [];
    for (const fr of snap.frames) {
      const nodes = this.frameNodes(chapter, fr.key);
      // 章节改版后老的行动 id 可能不存在：整体降级回主干，别把存档读崩
      if (!nodes) return null;
      const nf = this.makeFrame(nodes, fr.key, this.frameDone(fr.key));
      nf.i = Math.max(0, Math.min(Number(fr.i) || 0, Math.max(0, nodes.length - 1)));
      out.push(nf);
    }
    return out.length ? out : null;
  }

  restartCurrentChapter() {
    this.ctx.ui.closeAll();
    this.loadChapter(this.chapter, 0);
  }

  /* ================= 帧 ================= */
  frame() { return this.frames[this.frames.length - 1] || null; }

  nodeKey(frame, i) {
    const act = frame.key && frame.key !== 'main' ? `${frame.key}:` : '';
    return `${this.chapter.id}#${act}${i}`;
  }

  /** 查标签：先找当前帧的局部标签（调查行动内部的小分支），再找章节级标签 */
  findLabel(name) {
    const f = this.frame();
    if (f && f.locals && f.locals.has(name)) return f.locals.get(name);
    if (this.labels.has(name)) return this.labels.get(name);
    return undefined;
  }

  /** 为一段脚本（调查行动 / 事件）建帧，顺带收集它自己的 label */
  makeFrame(nodes, key, onDone) {
    const locals = new Map();
    (nodes || []).forEach((n, i) => {
      if (n.t === 'label') locals.set(n.name, i);
    });
    return { nodes: nodes || [], i: 0, key, onDone, locals };
  }

  run() {
    const f = this.frame();
    if (!f) return this.finishChapter();

    if (f.i >= f.nodes.length) return this.popFrame();

    const node = f.nodes[f.i];
    this.current = node;

    // 已读标记（文本与场景节点都记录，跳过时用来判断）
    const key = this.nodeKey(f, f.i);
    this.pendingKey = key;

    if (f.key === 'main') this.ctx.state.index = f.i;

    this.execNode(node, f, key);
  }

  execNode(node, f, key) {
    const { stage, audio, ui, state } = this.ctx;

    switch (node.t) {
      /* ---------- 场景 ---------- */
      case 'bg':
        stage.setBackground(node.id);
        if (node.place !== false) stage.setPlace(node.place || null);
        markRead(key);
        return this.next();

      case 'music':
        audio.play(node.id);
        markRead(key);
        return this.next();

      case 'sfx':
        audio.sfx(node.id);
        markRead(key);
        return this.next();

      case 'show': {
        // 出场即视为"认识"：人物面板不再依赖主线里那些 met_* 标记，
        // 否则从标题页直接进支线时，右上角「人物」会是一片空白。
        const c = CHARACTERS[node.id];
        if (c && c.metFlag && !state.flags[c.metFlag]) setFlag(state, c.metFlag);
        stage.showSprite(node.id, node.pos || 'center');
        // 标记为显式出场，旁白时不自动撤
        if (!this._explicitSprites) this._explicitSprites = new Set();
        this._explicitSprites.add(node.id);
        markRead(key);
        return this.next();
      }

      case 'hide':
        if (node.all) { stage.hideAllSprites(); if (this._explicitSprites) this._explicitSprites.clear(); }
        else {
          stage.hideSprite(node.id);
          if (this._explicitSprites) this._explicitSprites.delete(node.id);
        }
        markRead(key);
        return this.next();

      /* ---------- 文本 ---------- */
      case 'say': {
        const c = CHARACTERS[node.who];
        if (c && c.metFlag && !state.flags[c.metFlag]) setFlag(state, c.metFlag);
        // 自动管理立绘：说话的人不在场上就叫他上来（不算显式出场）
        if (node.who && !stage.sprites.has(node.who)) {
          stage.showSprite(node.who, node.pos || 'center');
        }
        return this.showText(node, key);
      }
      case 'narr':
        // 旁白时的退场判断：**看后面还有没有人要说话**。
        // 以前是"旁白 = 把没被 show 过的立绘全撤掉"，于是
        //   「沈予安说完 → 旁白一句 → 沈予安又说话」
        // 中间那一帧沈予安会先消失再出现，画面上一闪一闪，
        // 看上去就是立绘在跳来跳去。
        // 现在改成往前看：接下来（到换背景为止）还会说话的人留着，
        // 没人再说话了才撤。
        this._retireUnusedSprites(f);
        return this.showText(node, key);

      /* ---------- 开场卡板 ----------
         整屏黑底白字，不上对话框、不碰音乐。点了才往下走。 */
      case 'card': {
        markRead(key);
        return this.showCard(node);
      }

      /* ---------- 选项 ---------- */
      case 'choice':
        this.stopAllModes('需要你做出选择，已停止跳过与自动播放');
        return this.showChoice(node, f, key);

      /* ---------- 数据副作用 ---------- */
      case 'mat': {
        const added = addMaterial(state, node.id);
        if (!added) {
          markRead(key);
          if (this.shouldInstantStep()) return this.scheduleNext();
          return this.next();
        }
        const mat = ui.getMaterial(node.id);
        audio.sfx('notify');
        markRead(key);
        // 材料表里查不到：照样记账，但不要卡在一个开不出来的面板上
        if (!mat) return this.next();
        // 材料不是“静默入库”：先把内容摊在玩家面前，看完点「收下」再往下走
        this.stopAllModes();
        this.blocked = true;
        let released = false;
        ui.openMaterialDetail(node.id, () => {
          if (released) return;
          released = true;
          this.blocked = false;
          ui.toast(`已收入材料：${mat ? mat.title : node.id}`, 1800);
          this.next();
        });
        return;
      }

      case 'flag':
        setFlag(state, node.key, node.value === undefined ? true : node.value);
        markRead(key);
        return this.next();

      case 'stat': {
        addStat(state, node.who, {
          trust: node.trust, pressure: node.pressure, stance: node.stance
        });
        if (node.hint) ui.toast(node.hint);
        markRead(key);
        if (this.shouldInstantStep()) return this.scheduleNext();
        return this.next();
      }

      case 'note':
        if (!state.notes.includes(node.text)) state.notes.push(node.text);
        markRead(key);
        return this.next();

      /* ---------- 手机 / 聊天 ---------- */
      case 'chatmsg': {
        if (node.thread && node.text) {
          const msg = {
            thread: node.thread,
            from: node.from || '',
            text: node.text,
            me: !!node.me,
            day: state.dayLabel
          };
          state.chats.push(msg);
          audio.sfx('notify');
          // 聊天内容不该只是“记在后台”：第一条消息到达时就自动把手机翻出来，
          // 后面同会话的消息直接贴进面板；换会话则重渲染到新会话上。
          if (!ui.isPhoneOpen()) {
            this.stopAllModes('收到消息，已停止跳过与自动播放');
            this.blocked = true;
            ui.openPhone(node.thread, () => { this.blocked = false; });
          } else if (ui.phoneThread() === node.thread) {
            ui.appendChatMessage(msg);
          } else {
            ui.openPhone(node.thread, () => { this.blocked = false; });
          }
        }
        markRead(key);
        if (this.shouldInstantStep()) return this.scheduleNext();

        // 面板开着、且后面没有更多聊天内容：停在这里等玩家看完点「继续」
        if (ui.isPhoneOpen() && ui.phoneThread() === node.thread && !this.peekChatAhead(2)) {
          this.blocked = false;
          ui.showChatContinue(() => this.next());
          return;
        }
        return this.next();
      }

      case 'phone':
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        ui.openPhone(node.thread, () => {
          this.blocked = false;
          this.next();
        });
        return;

      case 'chatreply':
        this.stopAllModes('需要你回复消息');
        this.blocked = true;
        markRead(key);
        ui.openChatReply(node, (opt) => {
          if (opt.text) {
            state.chats.push({
              thread: node.thread, from: '我', text: opt.text, me: true, day: state.dayLabel
            });
          }
          (opt.msgs || []).forEach(m => {
            state.chats.push({
              thread: node.thread, from: m.from, text: m.text, me: !!m.me, day: state.dayLabel
            });
          });
          if (opt.effects) this.applyEffects(opt.effects);
          recordChoice(state, this.chapter.id, node.prompt || '聊天回复', opt.text || '');
          this.chatExchange(node, opt);
        });
        return;

      /* ---------- 课堂小测 ---------- */
      case 'quiz': {
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        ui.openQuiz(node, (res) => {
          this.blocked = false;
          if (res) {
            state.quizzes = state.quizzes || {};
            state.quizzes[node.id || 'quiz'] = { right: res.right, total: res.total };
            if (node.flag) setFlag(state, node.flag, true);
            if (res.right === res.total && node.perfect) setFlag(state, node.perfect, true);
            if (node.mat) {
              const added = addMaterial(state, node.mat);
              if (added) {
                const mat = ui.getMaterial(node.mat);
                ui.toast(`已收入材料：${mat ? mat.title : node.mat}`, 1800);
              }
            }
          }
          this.next();
        });
        return;
      }

      /* ---------- 调查中枢 ---------- */
      case 'hub':
        this.stopAllModes();
        return this.openHub(node);

      /* ---------- 政务服务平台：填写反映 ---------- */
      case 'govform': {
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        const f = this.frames[this.frames.length - 1];
        ui.openComplaintForm(node, (res) => {
          this.blocked = false;
          if (res && res.submitted) {
            const r = res.res || {};
            state.gov = {
              no: res.no,
              time: res.time,
              // 反映的是哪一类事项：学校活动 / 口罩（支线）。政务平台据此换答复口径。
              kind: node.kind || 'school',
              types: r.types || [],
              desc: r.desc || '',
              claims: r.claims || [],
              amount: r.amount || 0,
              evidence: !!r.evidence,
              replied: false
            };
            setFlag(state, 'gov_submitted');
            if (r.evidence) setFlag(state, 'gov_evidence');
            if ((r.claims || []).includes('refund')) setFlag(state, 'gov_claim_refund');
            if (node.mat) {
              const added = addMaterial(state, node.mat);
              if (added) {
                const mat = ui.getMaterial(node.mat);
                ui.toast(`已收入材料：${mat ? mat.title : node.mat}`, 1800);
              }
            }
            return this.next();
          }
          const target = node.closeGoto ? this.findLabel(node.closeGoto) : undefined;
          if (target !== undefined) { f.i = target; return this.run(); }
          return this.next();
        });
        return;
      }

      /* ---------- 12345 电话 ---------- */
      case 'hotline': {
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        ui.openHotline(node, (res) => {
          this.blocked = false;
          ((res && res.flags) || []).forEach(k => setFlag(state, k));
          if (node.flag) setFlag(state, node.flag, true);
          if (node.mat) {
            const added = addMaterial(state, node.mat);
            if (added) {
              const mat = ui.getMaterial(node.mat);
              ui.toast(`已收入材料：${mat ? mat.title : node.mat}`, 1800);
            }
          }
          this.next();
        });
        return;
      }

      /* ---------- 政务服务平台：查看办理答复 ---------- */
      case 'govprogress': {
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        if (state.gov) state.gov.replied = true;
        if (node.flag) setFlag(state, node.flag, true);
        this.openProgressNode(node, state);
        return;
      }

      /* ---------- 流程 ---------- */
      case 'label':
        return this.next();

      case 'goto': {
        const target = this.findLabel(node.label);
        if (target === undefined) { console.warn('[vn] 未找到标签', node.label); return this.next(); }
        f.i = target;
        return this.run();
      }

      case 'wait':
        markRead(key);
        setTimeout(() => this.next(), node.ms || 400);
        return;

      case 'unlock':
        if (node.id && !state.chaptersDone.includes(node.id)) state.chaptersDone.push(node.id);
        markRead(key);
        return this.next();

      case 'if': {
        // { t:'if', cond:(state, engine)=>bool, then:'labelA', else:'labelB' }
        // else 可省略：条件不成立就顺序往下走。
        // 注意这里要传 state，不能传 this.state —— Engine 上没有这个属性，
        // 传错会让所有 cond 抛异常，被 catch 成 false，于是每个 if 都走 else。
        let ok = false;
        try {
          ok = !!(node.cond && node.cond(state, this));
        } catch (e) {
          console.warn('[vn] if 判定出错', e);
        }
        const name = ok ? node.then : node.else;
        if (!name) return this.next();
        const target = this.findLabel(name);
        if (target === undefined) { console.warn('[vn] if 标签未找到', name); return this.next(); }
        markRead(key);
        f.i = target;
        return this.run();
      }

      /* ---------- 条件分支 ---------- */
      case 'branch': {
        let targetName = null;
        try {
          targetName = typeof node.decide === 'function'
            ? node.decide(state, this)
            : (node.to || null);
        } catch (e) {
          console.warn('[vn] branch 判定出错', e);
        }
        if (!targetName) return this.next();
        const label = (node.prefix || '') + targetName;
        const target = this.findLabel(label);
        if (target === undefined) {
          console.warn('[vn] 未找到分支标签', label);
          return this.next();
        }
        markRead(key);
        f.i = target;
        return this.run();
      }

      /* ---------- 结局标记 ---------- */
      case 'ending':
        state.ending = node.id || null;
        state.flags[`ending_${node.id}`] = true;
        markRead(key);
        return this.next();

      case 'end':
        markRead(key);
        flushRead();
        this.stopAllModes();
        return this.finishChapter();

      default:
        console.warn('[vn] 未知节点类型', node);
        return this.next();
    }
  }

  /* ---------------- 办理答复面板 ----------------
     govprogress 的 data 可以是函数（按当前存档现场拼一份），也可以是对象。
     节点上带 ai 字段时，答复正文优先交给模型写；模型没配、没网、超时
     都直接退回内置文案，流程一点不受影响。

     data 里各节点的 time / opinion / reply 是"骨架"，
     AI 只换 reply 这一段正文，编号、节点、时间一个都不动 —
     档案感靠骨架，措辞的差异靠模型。 */
  async openProgressNode(node, state) {
    const { ui } = this.ctx;
    let data = typeof node.data === 'function' ? node.data(state) : node.data;
    const chapter = this.chapter;

    if (node.ai && aiConfigured(this.ctx.settings)) {
      ui.toast('正在向平台请求答复…', 2600);
      const generated = await this.aiReply(node.ai, state);
      // 等模型的时候玩家可能已经读档/回标题，这一帧就不再属于当下了
      if (this.chapter !== chapter) return;
      if (generated) data = { ...data, reply: generated, ai: true };
    }

    ui.openGovProgress(data, () => {
      this.blocked = false;
      if (node.mat) {
        const added = addMaterial(state, node.mat);
        if (added) {
          const mat = ui.getMaterial(node.mat);
          ui.toast(`已收入材料：${mat ? mat.title : node.mat}`, 1800);
        }
      }
      this.next();
    });
  }

  async aiReply(briefSrc, state) {
    try {
      const brief = typeof briefSrc === 'function' ? briefSrc(state) : briefSrc;
      const text = await aiComplete({
        settings: this.ctx.settings,
        system: AI_SYSTEM,
        prompt: buildGovPrompt(brief.kind || 'bureau', brief.facts || brief)
      });
      const paras = toParagraphs(text);
      return paras.length >= 2 ? paras : null;
    } catch (e) {
      console.warn('[vn] 答复生成失败，使用内置文案', e);
      return null;
    }
  }

  /* ---------------- 聊天回合 ----------------
     选完之后不关面板：我方消息先落屏，对方按“正在输入”逐条到达。
     后面还有聊天内容就直接续下去；聊完了停下来等玩家点「继续」。 */
  async chatExchange(node, opt) {
    const { ui } = this.ctx;
    const msgs = (opt.msgs || []).map(m => ({ from: m.from || '对方', text: m.text, me: !!m.me }));
    await ui.playExchange({ myText: opt.text, msgs });

    this.blocked = false;
    if (this.peekChatAhead()) {
      this.next();
      return;
    }
    ui.showChatContinue(() => this.next());
  }

  /** 往后看几个节点，判断这段聊天是否还没结束 */
  peekChatAhead(limit = 4) {
    const f = this.frame();
    if (!f) return false;
    for (let k = 1; k <= limit; k++) {
      const n = f.nodes[f.i + k];
      if (!n) return false;
      if (n.t === 'chatmsg' || n.t === 'chatreply' || n.t === 'phone') return true;
      if (n.t === 'label' || n.t === 'flag' || n.t === 'stat' || n.t === 'note'
        || n.t === 'mat' || n.t === 'wait' || n.t === 'sfx') continue;
      return false;
    }
    return false;
  }

  applyEffects(list) {    const { state, ui } = this.ctx;
    (list || []).forEach(e => {
      if (e.mat) { if (addMaterial(state, e.mat)) ui.toast(`获得材料：${e.mat}`); }
      if (e.flag) setFlag(state, e.flag, e.value === undefined ? true : e.value);
      if (e.stat) addStat(state, e.stat, { trust: e.trust, pressure: e.pressure, stance: e.stance });
      if (e.note) state.notes.push(e.note);
    });
  }

  /* ---------------- 立绘退场 ----------------
     规则很简单：**后面还会说话的人先别撤**。
     往前看当前这一段脚本里接下来谁还会开口（say 节点）、
     谁还会被 show 出来，只要还有份，就留在台上；
     后面没人说话了，才把人撤下来。
     这样「A 说完 → 旁白 → A 又说」中间不会闪一下，
     立绘也就不会显得在跳来跳去。 */
  _retireUnusedSprites(f) {
    const { stage } = this.ctx;
    if (!stage || !stage.sprites || stage.sprites.size === 0) return;

    const upcoming = new Set();
    const nodes = (f && f.nodes) || [];
    const LIMIT = 80;   // 往前看这么多节点，足够覆盖一次对话
    let seen = 0;
    for (let i = f.i + 1; i < nodes.length && seen < LIMIT; i++) {
      const n = nodes[i];
      seen++;
      if (!n) continue;
      if (n.t === 'hide' && n.all) break;
      if (n.t === 'say' && n.who) upcoming.add(n.who);
      if (n.t === 'show' && n.id) upcoming.add(n.id);
    }

    const explicit = this._explicitSprites || new Set();
    Array.from(stage.sprites.keys()).forEach(id => {
      if (explicit.has(id)) return;          // 剧本显式出场的，一直留着
      if (upcoming.has(id)) return;          // 后面还有话要说，先别撤
      stage.hideSprite(id);
    });
  }

  /* ================= 文本 ================= */
  /* ================= 开场卡板 =================
     黑底白字，淡入；点一下淡出，然后交给下一个节点。
     两件事必须注意：
       1) 淡出要 640ms，这期间如果紧接着又是一张卡板，旧的那次隐藏不能把新的关掉
          —— 每次显示都换一个序号，定时器回来时序号不对就直接作废。
       2) 卡板期间要 waiting=true，否则 onTap 的守卫会认为「没有可推进的东西」，
          点上去没反应。 */
  showCard(node) {
    const { ui } = this.ctx;
    const el = ui.root.querySelector('#curtain');
    const txt = ui.root.querySelector('#curtainText');
    if (!el) return this.next();

    const dlg = ui.root.querySelector('#dialogue');
    if (dlg) dlg.hidden = true;

    this._cardSeq = (this._cardSeq || 0) + 1;
    this._cardOpen = true;
    if (txt) txt.textContent = node.text || '';
    el.hidden = false;
    void el.offsetWidth;          // 强制重排，保证每次都能重新淡入
    el.classList.add('on');

    this.waiting = true;
    this.typing = false;
    if (this.skipActive || this.autoActive) this.scheduleNext();
  }

  closeCard() {
    const el = this.ctx.ui.root.querySelector('#curtain');
    this._cardOpen = false;
    this._cardSeq = (this._cardSeq || 0) + 1;
    if (!el) return;
    const seq = this._cardSeq;
    el.classList.remove('on');
    setTimeout(() => {
      if (seq !== this._cardSeq) return;   // 这中间又开了一张卡板
      el.hidden = true;
    }, 640);
  }

  showText(node, key) {
    const { ui, stage, audio, state } = this.ctx;

    // 聊天段落结束、回到叙事时把手机收起来
    if (ui.isPhoneOpen && ui.isPhoneOpen()) ui.closePanel();

    const dlg = ui.root.querySelector('#dialogue');
    const nameEl = ui.root.querySelector('#dlgName');
    const textEl = ui.root.querySelector('#dlgText');

    const isNarr = node.t === 'narr';
    dlg.hidden = false;
    dlg.classList.toggle('narration', isNarr);
    /* 心声（整句被括号包住）单独标一层：
       独白和对白在排版上要能一眼分开，读起来才知道这句是说出口的还是心里的。 */
    const isInner = /^[（(].*[）)]$/.test(String(node.text || '').trim());
    dlg.classList.toggle('is-inner', !isNarr && isInner);
    dlg.classList.remove('waiting');

    nameEl.textContent = isNarr ? '' : (node.name || '');
    // 很多台词节点只写了 who（没重复写 sprite），以前这样会拿不到高亮对象，
    // 于是「谁在说话」完全没提示，画面上看起来就是同一个立绘一直在讲话。
    // 这里退一步用 who：who 就是立绘 id，舞台上没有这个人时自然不会高亮。
    stage.setSpeaking(isNarr ? null : (node.sprite || node.who || null));

    // 历史记录
    state.log = state.log || [];
    state.log.push({ who: isNarr ? '' : (node.name || ''), text: node.text });
    if (state.log.length > 240) state.log.splice(0, state.log.length - 240);

    const wasRead = isRead(key);
    markRead(key);
    const speed = this.speedMs();
    const instant = this.shouldInstantStep() || speed === 0;

    this.waiting = false;

    // 跳过模式遇到未读剧情：停下来询问（除非玩家已选择"跳过全部"）
    if (this.skipActive && !this.skipAll && !wasRead) {
      this.askSkipUnread(() => this.renderText(node, textEl, true));
      return;
    }

    this.renderText(node, textEl, instant);
  }

  renderText(node, textEl, instant) {
    if (instant) {
      textEl.textContent = node.text;
      this.typing = false;
      this.completeText(node);
      return;
    }
    this.typing = true;
    this.waiting = false;
    this.typeText(textEl, node.text, this.speedMs(), () => {
      this.typing = false;
      this.completeText(node);
    });
  }

  /** 按帧推进打字机：每帧只写一次 DOM，长段落也不会一卡一卡 */
  typeText(el, text, speed, done) {
    this._stopTyping();
    const step = Math.max(8, speed);
    let i = 0;
    let last = 0;
    el.textContent = '';
    const tick = (now) => {
      if (!last) last = now;
      const elapsed = now - last;
      if (elapsed >= step) {
        const n = Math.max(1, Math.floor(elapsed / step));
        i = Math.min(text.length, i + n);
        el.textContent = text.slice(0, i);
        last = now;
      }
      if (i >= text.length) {
        el.textContent = text;
        this._typeRaf = null;
        done();
        return;
      }
      this._typeRaf = requestAnimationFrame(tick);
    };
    this._typeRaf = requestAnimationFrame(tick);
  }

  _stopTyping() {
    if (this._typeRaf) cancelAnimationFrame(this._typeRaf);
    this._typeRaf = null;
    clearInterval(this.typeTimer);
    this.typeTimer = null;
  }

  finishTyping() {
    this._stopTyping();
    const el = this.ctx.ui.root.querySelector('#dlgText');
    if (this.current && this.current.text) el.textContent = this.current.text;
    this.typing = false;
    this.completeText(this.current);
  }

  completeText(node) {
    const dlg = this.ctx.ui.root.querySelector('#dialogue');
    dlg.classList.add('waiting');
    this.waiting = true;
    if (this.skipActive) return this.scheduleNext();
    if (this.autoActive) return this.scheduleNext();
  }

  speedMs() {
    const id = this.ctx.settings.textSpeed;
    const found = CONFIG.textSpeeds.find(s => s.id === id) || CONFIG.textSpeeds[1];
    return found.ms;
  }

  advance(force = false) {
    if (!force && !this.waiting && !this.typing) return;
    if (this._cardOpen) this.closeCard();   // 卡板：先淡出，再往下走
    clearTimeout(this.autoTimer);
    clearTimeout(this.stepTimer);
    this.waiting = false;
    this.typing = false;
    const f = this.frame();
    if (!f) return;
    f.i += 1;
    if (f.key === 'main') this.ctx.state.index = f.i;
    this.run();
  }

  next() {
    const f = this.frame();
    if (!f) return;
    f.i += 1;
    if (f.key === 'main') this.ctx.state.index = f.i;
    this.run();
  }

  scheduleNext() {
    clearTimeout(this.stepTimer);
    const delay = this.skipActive ? CONFIG.skipInterval : this.autoDelayMs();
    this.stepTimer = setTimeout(() => {
      if (this.paused || this.blocked) return;
      this.waiting = false;
      this.advance(true);
    }, delay);
  }

  autoDelayMs() {
    const base = CONFIG.autoDelay;
    const factor = (this.ctx.settings.autoSpeed && this.ctx.settings.autoSpeed > 0) || 1;
    return Math.round(base / factor);
  }

  /* ================= 暂停 / 恢复（面板打开时） ================= */
  pause() {
    this.paused = true;
    clearTimeout(this.stepTimer);
  }

  resume() {
    this.paused = false;
    if (this.waiting && (this.autoActive || this.skipActive)) this.scheduleNext();
  }

  /* ================= 跳过 / 自动 ================= */
  shouldInstantStep() {
    if (!this.skipActive) return false;
    if (this.skipAll) return true;
    // 只看当前待显示节点是否已读
    return this.pendingKey ? isRead(this.pendingKey) : false;
  }

  toggleSkip() {
    if (this.skipActive) { this.setSkip(false); return; }
    this.setAuto(false);
    this.setSkip(true);
    if (this.typing) this.finishTyping();
    else if (this.waiting) this.scheduleNext();
  }

  setSkip(on, all = false) {
    this.skipActive = on;
    this.skipAll = all;
    const btn = this.ctx.ui.root.querySelector('#btnSkip');
    if (btn) btn.classList.toggle('active', on);
    if (!on) { clearTimeout(this.stepTimer); }
    this.ctx.ui.toast(on ? (all ? '跳过中：包含未读剧情' : '跳过中：仅跳过已读剧情') : '已停止跳过', 1400);
  }

  toggleAuto() {
    if (this.autoActive) { this.setAuto(false); return; }
    this.setSkip(false);
    this.setAuto(true);
    if (this.waiting) this.scheduleNext();
  }

  setAuto(on) {
    this.autoActive = on;
    const btn = this.ctx.ui.root.querySelector('#btnAuto');
    if (btn) btn.classList.toggle('active', on);
    this.ctx.ui.toast(on ? '自动播放' : '已停止自动播放', 1200);
    if (!on) clearTimeout(this.stepTimer);
  }

  stopAllModes(msg) {
    const wasActive = this.skipActive || this.autoActive;
    clearTimeout(this.stepTimer);
    clearTimeout(this.autoTimer);
    if (this.skipActive) { this.skipActive = false; this.skipAll = false; const b = this.ctx.ui.root.querySelector('#btnSkip'); if (b) b.classList.remove('active'); }
    if (this.autoActive) { this.autoActive = false; const b = this.ctx.ui.root.querySelector('#btnAuto'); if (b) b.classList.remove('active'); }
    if (msg && wasActive) this.ctx.ui.toast(msg, 1800);
  }

  /** 跳过时遇到未读文本的询问 */
  askSkipUnread(onContinue) {
    const { ui, settings } = this.ctx;
    if (!settings.skipUnreadAsk) { this.skipAll = true; onContinue(); return; }
    this.paused = true;
    ui.askSkipUnread(
      () => { this.paused = false; this.skipAll = true; onContinue(); },
      () => { this.paused = false; this.setSkip(false); }
    );
  }

  /* ================= 选项 ================= */
  showChoice(node, f, key) {
    const { ui, state } = this.ctx;
    this.blocked = true;
    this.waiting = false;
    markRead(key);

    ui.showChoices(node.prompt, node.options, (opt, idx) => {
      this.blocked = false;
      this.ctx.state.choices.push({
        chapter: this.chapter.id,
        q: node.prompt || '',
        a: opt.text,
        ts: Date.now()
      });
      if (opt.effects) this.applyEffects(opt.effects);
      if (opt.flag) setFlag(state, opt.flag, true);

      if (opt.goto) {
        const target = this.findLabel(opt.goto);
        if (target !== undefined) { f.i = target; return this.run(); }
      }
      this.next();
    });
  }

  /* ================= 调查中枢 ================= */
  openHub(node) {
    const { ui, state } = this.ctx;
    const chapter = this.chapter;
    const actions = (chapter.hubActions || []).filter(a => {
      if (a.once && (state.visits[a.id] || 0) > 0) return false;
      if (typeof a.cond === 'function' && !a.cond(state, this)) return false;
      return true;
    });

    // 行动点用尽 → 自动结束
    if (state.ap <= 0) {
      state.hubActive = false;
      // 必须复位 blocked：否则此时若残留 true，后面放学那一段对话就点不动（卡死）
      this.blocked = false;
      ui.setAP(state);
      ui.toast('今天的行动点用完了。', 1600);
      return this.next();
    }

    this.blocked = true;
    state.hubActive = true;
    ui.setAP(state);
    ui.openHub({
      actions,
      state,
      onPick: (action) => {
        if (!spendAP(state, action.ap || 1)) { ui.toast('行动点不够了。'); return; }
        state.visits[action.id] = (state.visits[action.id] || 0) + 1;
        this.blocked = false;
        ui.closeHub();
        ui.setAP(state);
        this.frames.push(this.makeFrame(action.script || [], `act:${action.id}`,
          () => this.afterHubAction()));
        this.run();
      },
      onLeave: () => {
        this.blocked = false;
        state.hubActive = false;
        ui.closeHub();
        ui.setAP(state);
        this.next();
      }
    });
  }

  popFrame() {
    const f = this.frames.pop();
    if (!f) return this.finishChapter();
    if (f.onDone) return f.onDone();
    return this.run();
  }

  afterHubAction() {
    const { ui, state } = this.ctx;
    const events = this.chapter.hubEvents || [];
    ui.setAP(state);

    // 中段事件：按行动次数触发一次
    const done = Object.values(state.visits).reduce((a, b) => a + b, 0);
    const pending = events.find(ev => !getFlag(state, `ev_${this.chapter.id}_${ev.id}`)
      && done >= (ev.after || 0));

    if (pending) {
      setFlag(state, `ev_${this.chapter.id}_${pending.id}`, true);
      this.frames.push(this.makeFrame(pending.script || [], `ev:${pending.id}`,
        () => this.reopenHub()));
      return this.run();
    }
    this.reopenHub();
  }

  reopenHub() {
    const { state, ui } = this.ctx;
    ui.setAP(state);
    if (state.ap <= 0) {
      ui.toast('今天的时间用完了。', 1600);
      this.blocked = false;
      state.hubActive = false;
      ui.setAP(state);
      return this.next();
    }
    this.openHub({ t: 'hub' });
  }

  /* ================= 章节结束 ================= */
  finishChapter() {
    const { ui, state, onChapterEnd } = this.ctx;
    this.stopAllModes();
    this.ctx.ui.root.querySelector('#dialogue').hidden = true;
    flushRead();
    if (!state.chaptersDone.includes(this.chapter.id)) state.chaptersDone.push(this.chapter.id);
    if (typeof onChapterEnd === 'function') onChapterEnd(this.chapter, state);
  }
}
