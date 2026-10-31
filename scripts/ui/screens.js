/* =========================================================
   UI 层：面板、手机、选项、调查中枢、章节总结、存档界面
   ---------------------------------------------------------
   只负责渲染与交互，不直接改动主线流程；
   流程推进通过回调交回 Engine。
   ========================================================= */

import { CONFIG } from '../config/game.js';
import { assetUrl, setProtagonist, faceUrl, MUSIC } from '../config/assets.js';
import { dumpLog } from '../core/log.js';
import { MATERIALS, MATERIAL_STATUS, getMaterial } from '../data/materials.js';
import { CHARACTERS, getCharacter, charNowLine, charNotes } from '../data/characters.js';
import { THREADS, THREAD_KINDS, threadMessages, threadPreview, threadKind } from '../data/chats.js';
import { CHANGELOG } from '../data/changelog.js';
import { SIDES } from '../data/sides.js';
import { complaintHTML, bindComplaint, receiptHTML, progressHTML, bindProgress, buildCaseProgress, typeText, hotlineHTML, bindHotline } from './gov.js';
import { quizHTML, bindQuiz, quizResultHTML } from './quiz.js';
import { aiComplete, aiListModels, aiChat, webSearch } from '../core/ai.js';
import {
  MINT_APPS, campusHTML, campusNoticeHTML, campusNoticeDetail,
  campusServiceHTML, campusConsultHTML, campusReceiptHTML, campusAttendHTML,
  noteHTML, bindNote, galleryHTML, galleryDetailHTML, chainHTML,
  calcHTML, bindCalc, browserHTML, bindBrowser
} from './mintos.js';
import {
  settingsAppHTML, bindSettingsApp, updateAppHTML, bindUpdateApp,
  aboutAppHTML, contactsAppHTML, contactDetailHTML, backupAppHTML,
  readingAppHTML, changelogAppHTML, DEVICE,
  storeAppHTML, bindStore, cameraAppHTML, bindCamera, clockAppHTML, bindClock,
  weatherAppHTML, musicAppHTML, filesAppHTML, bindFiles
} from './mintapps.js';
import { buildAssistantSystem, assistantGreeting } from '../data/assistant.js';
import { gameCenterHTML, g2048HTML, bind2048, mineHTML, bindMine } from './mintgames.js';
import { dialAppHTML, bindDial, dialPersonas } from './mintdial.js';
import { emojiHTML, EMOJI_ALL } from './emoji.js';
import { describeTrust, describePressure, STANCE_TEXT } from '../core/state.js';

const $ = (sel, root = document) => root.querySelector(sel);

/* 助手头像里的那颗星：纯路径，不依赖任何图标文件 */
const AI_STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.2c.42 0 .78.28.9.68l1.55 4.9a4.2 4.2 0 0 0 2.68 2.68l4.9 1.55c.4.12.68.48.68.9s-.28.78-.68.9l-4.9 1.55a4.2 4.2 0 0 0-2.68 2.68l-1.55 4.9a.94.94 0 0 1-1.8 0l-1.55-4.9a4.2 4.2 0 0 0-2.68-2.68l-4.9-1.55a.94.94 0 0 1 0-1.8l4.9-1.55A4.2 4.2 0 0 0 9.55 7.8l1.55-4.9c.12-.4.48-.68.9-.68Z"
    fill="#fff"/>
</svg>`;

/* 是否触屏设备：决定设置里给不给「竖屏」这一项。
   电脑端窗口再窄也不该切成竖屏排版，那是给手机用的。 */
const TOUCH = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  || (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer:coarse)').matches);

export class UI {
  constructor({ root, state, settings, audio, saveAPI }) {
    this.root = root;
    this.state = state;
    this.settings = settings;
    this.audio = audio;
    this.saveAPI = saveAPI;
    this.engine = null;

    this.el = {
      chapter: $('#hudChapter'),
      day: $('#hudDay'),
      apBar: $('#apBar'),
      apDots: $('#apDots'),
      apText: $('#apText'),
      dialogue: $('#dialogue'),
      dlgName: $('#dlgName'),
      dlgText: $('#dlgText'),
      choiceLayer: $('#choiceLayer'),
      choiceBox: $('#choiceBox'),
      hubLayer: $('#hubLayer'),
      hubGrid: $('#hubGrid'),
      hubSub: $('#hubSub'),
      panelLayer: $('#panelLayer'),
      panelTitle: $('#panelTitle'),
      panelBody: $('#panelBody'),
      panelFoot: $('#panelFoot'),
      toast: $('#toast'),
      skipPrompt: $('#skipPrompt')
    };

    this._bindStatic();
  }

  _bindStatic() {
    $('#panelClose').addEventListener('click', () => { if (!this._lockClose) this.closePanel(); });

    // 点空白处关闭：只在「按下和抬起都落在遮罩本身」时才算数。
    // 以前只要 click 冒到遮罩就关，手指从面板里滑到外面松手、或者
    // 想拖动面板内容却点到了边上一小块，都会把面板关掉。
    let downOnLayer = false;
    this.el.panelLayer.addEventListener('pointerdown', (e) => {
      downOnLayer = (e.target === this.el.panelLayer);
    });
    this.el.panelLayer.addEventListener('click', (e) => {
      const fromLayer = downOnLayer;
      downOnLayer = false;
      if (!fromLayer || e.target !== this.el.panelLayer) return;
      if (this._lockClose) return;
      // 触屏上干脆不认这一下：遮罩本来就窄，误触代价太大，让人点 X 关。
      if (TOUCH) return;
      this.closePanel();
    });

    $('#skipStop').addEventListener('click', () => { this.el.skipPrompt.hidden = true; this._skipCb && this._skipCb(false); });
    $('#skipGo').addEventListener('click', () => { this.el.skipPrompt.hidden = true; this._skipCb && this._skipCb(true); });
  }

  /* ================= 通用确认框 =================
     挂在 body 上，所以标题界面、游戏里都能用。
     只认按钮，不认遮罩点击——这类弹窗问的都是「会丢东西」的事，
     不能因为点偏一下就当成确认或取消。 */
  confirm({ title, text, okLabel = '继续', cancelLabel = '取消', danger = false, enter = true, onOk, onCancel }) {
    this.closeConfirm();
    const mask = document.createElement('div');
    mask.className = 'confirm-mask';
    mask.id = 'confirmMask';
    mask.innerHTML = `
      <div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="cfmTitle">
        <h3 id="cfmTitle">${escapeHtml(title || '确认')}</h3>
        <div class="confirm-text">${text || ''}</div>
        <div class="confirm-actions">
          <button class="btn btn-ghost" type="button" data-cfm="cancel">${escapeHtml(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-cfm="ok">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('in'));

    const done = (ok) => {
      this.closeConfirm();
      if (ok && typeof onOk === 'function') onOk();
      if (!ok && typeof onCancel === 'function') onCancel();
    };
    mask.querySelector('[data-cfm="ok"]').addEventListener('click', () => { this.audio.sfx('select'); done(true); });
    mask.querySelector('[data-cfm="cancel"]').addEventListener('click', () => { this.audio.sfx('click'); done(false); });
    this._confirmKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
      // enter:false 的弹窗（清档这类）只认鼠标/触屏点按钮，按住回车不会一路清下去
      if (e.key === 'Enter' && enter) { e.preventDefault(); done(true); }
    };
    document.addEventListener('keydown', this._confirmKey);
    setTimeout(() => { const b = mask.querySelector('[data-cfm="ok"]'); if (b) b.focus({ preventScroll: true }); }, 40);
  }

  closeConfirm() {
    const m = document.getElementById('confirmMask');
    if (m) m.remove();
    if (this._confirmKey) { document.removeEventListener('keydown', this._confirmKey); this._confirmKey = null; }
  }

  /* ================= 基础 ================= */
  setChapter(ch) {
    this.el.chapter.textContent = ch.title || '';
    this.el.day.textContent = ch.dayLabel || '';
  }

  setAP(state) {
    this.state = state;
    const max = state.apMax || CONFIG.actionPoints;
    this.el.apBar.hidden = !state.hubActive;
    if (!state.hubActive) return;
    this.el.apDots.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const d = document.createElement('span');
      d.className = 'ap-dot' + (i < state.ap ? ' full' : '');
      this.el.apDots.appendChild(d);
    }
    this.el.apText.textContent = `剩余 ${state.ap} / ${max}`;
  }

  toast(msg, ms = 2200) {
    const t = this.el.toast;
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  getMaterial(id) { return getMaterial(id); }

  /* ================= 选项 ================= */
  showChoices(prompt, options, cb) {
    const layer = this.el.choiceLayer;
    const box = this.el.choiceBox;
    box.innerHTML = '';
    if (prompt) {
      const p = document.createElement('div');
      p.className = 'choice-prompt';
      p.textContent = prompt;
      box.appendChild(p);
    }
    options.forEach((opt, i) => {
      if (typeof opt.cond === 'function' && !opt.cond(this.state)) return;
      const b = document.createElement('button');
      b.className = 'choice-item';
      b.innerHTML = `<span class="idx">${String(i + 1).padStart(2, '0')}</span>${opt.text}`;
      b.addEventListener('click', () => {
        this.audio.sfx('select');
        // 若此刻存/读档面板正开着，先收起来再推进
        if (!this.el.panelLayer.hidden) this.closePanel();
        layer.hidden = true;
        // 选完立刻把按钮清掉：留着会在 DOM 里堆一串不可见的旧选项，
        // 键盘/测试脚本按选择器抓到的就是这些死按钮，点了没反应像卡死。
        box.innerHTML = '';
        cb(opt, i);
      });
      box.appendChild(b);
    });
    layer.hidden = false;
  }

  /* ================= 调查中枢 ================= */
  openHub({ actions, state, onPick, onLeave }) {
    this.state = state;
    const grid = this.el.hubGrid;
    grid.innerHTML = '';
    this.el.hubSub.textContent = `剩余行动点 ${state.ap}。每进行一项调查消耗 1 点。`;
    this.el.hubLayer.hidden = false;

    actions.forEach(a => {
      const done = (state.visits[a.id] || 0) > 0;
      const disabled = done && a.once;
      const b = document.createElement('button');
      b.className = 'hub-card' + (done ? ' done' : '');
      b.disabled = disabled;
      b.innerHTML = `
        <span class="hk">${a.tag || '调查'}</span>
        <span class="hn">${a.title}</span>
        <span class="hd">${a.desc || ''}</span>`;
      b.addEventListener('click', () => { this.audio.sfx('select'); onPick(a); });
      grid.appendChild(b);
    });

    if (!actions.length) {
      grid.innerHTML = '<div class="hub-card" style="grid-column:1/-1"><span class="hd">今天想做的事都做完了。</span></div>';
    }

    $('#hubLeave').onclick = () => { this.audio.sfx('click'); onLeave(); };
  }

  closeHub() { this.el.hubLayer.hidden = true; }

  /* ================= 通用面板 ================= */
  openPanel({ title, body, foot, narrow = false, wide = false, phone = false, hot = false, lockClose = false, onClose = null }) {
    this.el.panelTitle.textContent = title || '';
    this.el.panelBody.innerHTML = body || '';
    if (foot) {
      this.el.panelFoot.hidden = false;
      this.el.panelFoot.innerHTML = foot;
    } else {
      this.el.panelFoot.hidden = true;
      this.el.panelFoot.innerHTML = '';
    }
    $('.panel', this.el.panelLayer).classList.toggle('panel-narrow', !!narrow);
    $('.panel', this.el.panelLayer).classList.toggle('panel-wide', !!wide);
    $('.panel', this.el.panelLayer).classList.toggle('panel-hot', !!hot);
    $('.panel', this.el.panelLayer).classList.toggle('panel-phone', !!phone);
    // 换成非手机面板（材料、人物、设置…）时必须清掉会话记忆，
    // 否则旧会话会被当成还开着，后面到达的聊天消息会贴进看不见的节点里。
    if (!phone) this._phoneThread = null;
    // 需要玩家回复时，不允许用 X 或空白处关掉面板（否则流程会卡住）
    this._lockClose = !!lockClose;
    $('#panelClose').style.visibility = lockClose ? 'hidden' : '';
    this.el.panelLayer.hidden = false;
    this.el.panelBody.scrollTop = 0;
    this._panelOnClose = onClose;
    if (this.engine) this.engine.pause();
    this._panelAnim('in');
  }

  /* 面板进出场 ---------------------------------------------------------
     进：淡入 + 轻微上浮放大（.28s）。出：反向，170ms 后真的 hidden。
     两个坑要避开：
       1) 同名 class 直接加不会重播动画，必须先摘掉再强制重排；
       2) 关面板用延时，如果这期间又开了新面板，那条定时器不能把新面板藏掉，
          所以用一个自增序号，序号变了就作废。 */
  _panelAnim(mode) {
    const layer = this.el.panelLayer;
    clearTimeout(this._panelTimer);
    this._panelSeq = (this._panelSeq || 0) + 1;
    layer.classList.remove('anim-in', 'anim-out');
    if (mode === 'in') {
      void layer.offsetWidth;
      layer.classList.add('anim-in');
      return;
    }
    const seq = this._panelSeq;
    layer.classList.add('anim-out');
    this._panelTimer = setTimeout(() => {
      if (seq !== this._panelSeq) return;
      layer.hidden = true;
      layer.classList.remove('anim-out');
    }, 170);
  }

  closePanel() {
    if (this.el.panelLayer.hidden) return;
    // 还欠玩家一个回复：这时候把手机收起来会让剧情永远停在这一句，
    // 所以直接把面板放回去，等玩家真的选完。
    if (this._awaitReply) {
      this.el.panelLayer.hidden = false;
      if (this._lockClose) $('#panelClose').style.visibility = 'hidden';
      return;
    }
    // 关掉手机等同于「这场对话看完了」，用它来推进，避免流程卡死
    const continueCb = this._chatContinueCb;
    this._chatContinueCb = null;
    // hidden 交给 _panelAnim 延时处理，其余状态立刻复位，
    // 免得这 170ms 里 isPhoneOpen() 这类判断拿到错的结果
    this._phoneThread = null;
    this._panelAnim('out');
    this._lockClose = false;
    $('#panelClose').style.visibility = '';
    // 底部按钮区要一起清掉：否则「收下」「交卷」这类按钮会留在 DOM 里，
    // 自动化脚本会一直点到旧按钮上，剧情就再也推不动了。
    this.el.panelFoot.hidden = true;
    this.el.panelFoot.innerHTML = '';
    const cb = this._panelOnClose;
    this._panelOnClose = null;
    if (this.engine) this.engine.resume();
    if (cb) cb();
    if (continueCb) continueCb();
  }

  closeAll() {
    // 读档/换章时清场：这里不能触发「继续」，否则会替玩家把剧情往下推。
    // 注意顺序：必须先断掉面板的收尾回调再关面板。
    // closePanel() 本身会执行 _panelOnClose——政务表单、材料详情这些面板的回调
    // 都会推剧情；读档时若让它跑起来，剧情会往前跳一格，正好把接下来的选项跳掉，
    // 表现就是「存档时明明有选项，再进来选项没了」。
    this._chatContinueCb = null;
    this._phoneOnClose = null;   // 同上：别让手机面板的收尾回调在读档时把剧情推走
    this._panelOnClose = null;
    this._awaitReply = false;
    this._lockClose = false;
    this.hideChatContinue();
    clearTimeout(this._replyTimer);
    this.closePanel();
    this.closeHub();
    this.el.choiceLayer.hidden = true;
    this.el.choiceBox.innerHTML = '';
    this.el.dialogue.hidden = true;
    this.el.skipPrompt.hidden = true;
  }

  /* ================= 历史记录 ================= */
  openLog(log) {
    const lines = (log || []).map(l => `
      <div class="log-line${l.who ? '' : ' log-nar'}">
        ${l.who ? `<div class="log-who">${l.who}</div>` : ''}
        <div class="log-text">${escapeHtml(l.text)}</div>
      </div>`).join('');
    this.openPanel({
      title: '对话历史',
      body: lines || '<p>还没有任何记录。</p>'
    });
    this.el.panelBody.scrollTop = this.el.panelBody.scrollHeight;
  }

  /* ================= 材料 ================= */
  openMaterials() {
    const ids = this.state.materials;
    const cards = ids.map(id => {
      const m = MATERIALS[id];
      if (!m) return '';
      const st = MATERIAL_STATUS[m.status] || { label: m.status, cls: '' };
      return `<button class="mat-card" data-mat="${id}">
        <span class="mc-top">
          <span class="mc-title">${m.title}</span>
          <span class="tag ${st.cls}">${st.label}</span>
        </span>
        <span class="mc-src">${m.type} · ${m.source} · ${m.time}</span>
      </button>`;
    }).join('');

    this.openPanel({
      title: `材料 · ${ids.length}`,
      body: ids.length
        ? `<div class="mat-grid">${cards}</div>
           <p style="margin-top:16px;font-size:.76rem;color:#6b7280;line-height:1.8">
           材料只记录你实际看到、听到、拿到的东西。核实状态不使用可信度百分比。</p>`
        : '<p>还没有收集到任何材料。</p>'
    });

    this.el.panelBody.querySelectorAll('[data-mat]').forEach(btn => {
      btn.addEventListener('click', () => this.openMaterialDetail(btn.dataset.mat));
    });
  }

  /* onClose 传了就是“刚拿到的新材料”：锁定面板，点「收下」才继续剧情 */
  openMaterialDetail(id, onClose) {
    const m = MATERIALS[id];
    const fresh = typeof onClose === 'function';
    if (!m) {
      // 材料表里没有这一条：不能把面板开成空白还锁着，
      // 否则剧情会永远停在一个看不见的等待上。直接放行。
      if (fresh) onClose();
      return;
    }
    const st = MATERIAL_STATUS[m.status] || { label: m.status, cls: '' };
    const list = (arr) => {
      const items = Array.isArray(arr) ? arr : [];
      if (!items.length) return '<p class="mat-none">— 暂无 —</p>';
      return `<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
    };
    this.openPanel({
      title: fresh ? '新拿到的材料' : '材料详情',
      lockClose: fresh,
      onClose: fresh ? onClose : null,
      foot: fresh ? `<button class="btn btn-primary" id="matTake">收下，放进材料夹</button>` : '',
      body: `<div class="mat-detail">
        ${fresh ? `<div class="kv" style="color:#8a6a2f">— 刚拿到，还没有归到别处 —</div>` : ''}
        <h3>${m.title}</h3>
        <div class="kv">${m.type} · 来源：${m.source} · 获取时间：${m.time}</div>
        <span class="tag ${st.cls}">${st.label}</span>

        <div class="block">
          <div class="block-t">内容</div>
          <div class="quote">${formatMaterialContent(m.content)}</div>
        </div>

        <div class="block">
          <div class="block-t">能说明什么</div>
          ${list(m.proves)}
        </div>

        <div class="block">
          <div class="block-t">不能证明什么</div>
          ${list(m.cannot)}
        </div>

        <div class="block">
          <div class="block-t">还需要核实的问题</div>
          ${list(m.questions)}
        </div>
      </div>`
    });
    if (fresh) {
      const btn = this.el.panelFoot.querySelector('#matTake');
      if (btn) btn.addEventListener('click', () => this.closePanel());
    }
  }

  /* ================= 人物 ================= */
  openCharacters() {
    const all = Object.values(CHARACTERS);
    const items = all.filter(c => this.state.flags[c.metFlag]);
    const nowLine = charNowLine(this.state);
    const html = items.map(c => {
      const st = this.state.stats[c.id] || {};
      const tags = [];
      if (c.stateKeys.includes('trust')) tags.push(`<span class="tag plain">${describeTrust(st.trust || 0)}</span>`);
      if (c.stateKeys.includes('pressure')) tags.push(`<span class="tag cross">${describePressure(st.pressure || 0)}</span>`);
      if (c.stateKeys.includes('stance')) tags.push(`<span class="tag ${st.stance === 'resist' ? 'doubt' : ''}">${STANCE_TEXT[st.stance] || '看不出来'}</span>`);
      // 头像用从立绘上裁下来的正脸（assets/faces），不再拿整张立绘放大取上沿
      const face = c.sprite ? faceUrl(c.sprite) : null;
      const notes = charNotes(c, this.state);
      return `<div class="char-item">
        <div class="char-face" style="${face ? `background-image:url('${face}')` : ''}"></div>
        <div class="char-info">
          <div class="char-name">${c.name}</div>
          <div class="char-role">${c.role}</div>
          <div class="char-desc">${c.intro}</div>
          <div class="char-now">${nowLine}</div>
          <div class="char-state">${tags.join('')}</div>
          ${notes.length ? `<div class="char-notes">${notes.map(n => `<span>· ${n}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    this.openPanel({
      title: `人物 · ${items.length}/${all.length}`,
      body: items.length ? `<div class="char-list">${html}</div>
        <p style="margin-top:14px;font-size:.74rem;color:#6b7280;line-height:1.8">
        这里只写你观察到的状态。人的态度不是数值，也不会因为数值高就一定告诉你什么。<br>
        还没见过面的人不会出现在这里——见过、说过话，才会记上。</p>`
        : `<p>还没有认识什么人。</p>
           <p style="font-size:.8rem;color:#6b7280;line-height:1.9">
           见过面、或者跟你说过话的人，会自动记到这里。<br>
           每个人只显示你观察到的态度，不显示数值。</p>`
    });
  }

  /* ================= 手机 =================
     设计要点：
     · 一条会话的整个来回都在同一块面板里完成，选完不会把面板关掉；
     · 我方消息立即出现，对方消息按"正在输入 → 气泡"的节奏逐条到达；
     · 一轮聊完不会自己往下跑，要玩家点「继续」；
     · 面板停在哪条会话记在 _phoneThread，用来判断"下一轮是不是还在这条会话"。
     · 顶栏「手机」按钮进来的是桌面（MintOS 4 那种图标网格），
       剧情里的 phone 节点仍然直接进会话列表——剧本说什么就看什么。 */
  openPhone(thread, onClose) {
    this._phoneOnClose = onClose || null;
    this._phoneThread = null;
    this._renderPhone(thread || 'list', null);
    if (this.engine) this.engine.pause();
  }

  /* 手机面板的收尾：把它当作"这一屏看完了"，把控制权还给剧情。
     以前这里只把回调存进 _phoneOnClose 就没人再读它，
     结果剧本里只要出现一个 phone 节点，玩家点 × 关掉手机之后
     引擎的 blocked 永远是 true，怎么点都没反应（ch2「看家长群里的接龙」就是这么卡住的）。 */
  _phoneDone() {
    if (this._awaitReply) return;   // 还在等玩家回复，别把这一屏当成"看完了"
    const cb = this._phoneOnClose;
    this._phoneOnClose = null;
    if (cb) cb();
  }

  isPhoneOpen() { return !this.el.panelLayer.hidden && !!this._phoneThread; }

  phoneThread() { return this._phoneThread; }

  openChatReply(node, cb) {
    // 已经停在这条会话上：不重建面板，等玩家读完上一条再出新选项
    if (this.isPhoneOpen() && this._phoneThread === node.thread) {
      this._lockClose = true;
      $('#panelClose').style.visibility = 'hidden';
      this._queueReplyOptions(node, cb, 780);
      return;
    }
    this._renderPhone(node.thread, { node, cb });
  }

  _queueReplyOptions(node, cb, delay) {
    // 这段时间手机一收起来，回复选项就落在看不见的地方，剧情永远等在那儿
    this._awaitReply = true;
    // 从「看看手机」切到「等你回一句」时，上一屏的「放下手机」按钮必须收掉：
    // 留着它，玩家会点到一个已经不成立的收尾口，剧情就停在这儿了。
    this.el.panelFoot.hidden = true;
    this.el.panelFoot.innerHTML = '';
    this.hideChatContinue();
    this.showTyping();
    clearTimeout(this._replyTimer);
    this._replyTimer = setTimeout(() => {
      this.hideTyping();
      this._renderReplyOptions(node, cb);
    }, delay);
  }

  _renderReplyOptions(node, cb) {
    const body = $('#phoneBody');
    if (!body) return;
    const old = body.querySelector('.wx-reply');
    if (old) old.remove();

    const box = document.createElement('div');
    box.className = 'wx-reply';
    box.innerHTML = `
      ${node.prompt ? `<div class="wx-reply-tip">${escapeHtml(node.prompt)}</div>` : ''}
      ${node.options.map((o, i) => `<button data-reply="${i}">${escapeHtml(o.text)}</button>`).join('')}`;
    body.appendChild(box);

    box.querySelectorAll('[data-reply]').forEach(b => {
      b.addEventListener('click', () => {
        const opt = node.options[Number(b.dataset.reply)];
        this.audio.sfx('select');
        box.remove();
        this._awaitReply = false;
        // 选完之后仍然锁住面板，直到这一轮消息播完
        this._lockClose = true;
        cb(opt);
      });
    });
    body.scrollTop = body.scrollHeight;
  }

  /** 往当前会话里追加一条消息 */
  appendChatMessage(m) {
    const body = $('#phoneBody');
    if (!body) return;
    const empty = body.querySelector('.wx-empty');
    if (empty) empty.remove();

    const me = !!(m.me || m.from === '我');
    const el = document.createElement('div');
    // 只有「既没有发送者、也不是我方」的消息才是系统提示。
    // 我方消息（me:true）常常不带 from —— 早先这里判在 from 之前，
    // 结果自己发出去的话被渲染成居中的灰色系统行，而不是右侧的气泡。
    if (!m.from && !me) {
      el.className = 'wx-sys';
      el.innerHTML = `<span>${escapeHtml(m.text)}</span>`;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
      return;
    }
    const spr = m.spriteOf ? assetUrl('sprite', m.spriteOf) : null;
    const av = spr
      ? `<span class="wx-av" style="background-image:url('${spr}')"></span>`
      : `<span class="wx-av wx-av-t">${escapeHtml((me ? '我' : m.from || '·').slice(0, 1))}</span>`;
    const th = this._phoneThread ? THREADS[this._phoneThread] : null;
    // 表情包是一条独立的图消息，不套气泡（正文 emoji 才跟着字走）
    const bub = m.sticker
      ? `<div class="wx-sticker" role="img" aria-label="表情">${emojiHTML(m.text)}</div>`
      : `<div class="wx-bub">${emojiHTML(m.text)}</div>`;
    el.className = 'wx-row' + (me ? ' me' : '');
    el.innerHTML = me
      ? bub + av
      : av + `<div class="wx-bubwrap">${(th && th.group) ? `<div class="wx-nick">${escapeHtml(m.from)}</div>` : ''}${bub}</div>`;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  showTyping() {
    const body = $('#phoneBody');
    if (!body || $('#chatTyping')) return;
    const t = document.createElement('div');
    t.id = 'chatTyping';
    t.className = 'wx-row';
    t.innerHTML = '<span class="wx-av wx-av-t">·</span><div class="wx-bub wx-typing"><span class="typing-dots"><i></i><i></i><i></i></span></div>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
  }

  hideTyping() {
    const t = $('#chatTyping');
    if (t) t.remove();
  }

  /** 播放一整次消息交换：我方一句 → 对方逐条（带输入中） */
  async playExchange({ myText, msgs }) {
    if (myText) {
      this.appendChatMessage({ text: myText, me: true });
      this.audio.sfx('page');
      await sleep(360);
    }
    const list = msgs || [];
    for (const m of list) {
      this.showTyping();
      // 按字数给一点"打字时间"，但不超过 1.1 秒
      await sleep(Math.min(1100, 420 + String(m.text || '').length * 36));
      this.hideTyping();
      this.appendChatMessage({ from: m.from || '对方', text: m.text, me: m.me });
      this.audio.sfx('notify');
      await sleep(200);
    }
    return list.length;
  }

  /** 一轮聊完：解锁面板，给出「继续」按钮，玩家点了才往下走 */
  showChatContinue(onNext, label = '继续') {
    this._lockClose = false;
    $('#panelClose').style.visibility = '';
    const body = $('#phoneBody');
    if (!body) { onNext(); return; }
    this.hideChatContinue();

    const box = document.createElement('div');
    box.className = 'wx-continue';
    box.innerHTML = `<button id="chatContinueBtn">${label}</button>`;
    body.appendChild(box);
    body.scrollTop = body.scrollHeight;

    const go = () => {
      this.hideChatContinue();
      this._chatContinueCb = null;
      onNext();
    };
    this._chatContinueCb = go;
    box.querySelector('#chatContinueBtn').addEventListener('click', () => {
      this.audio.sfx('click');
      go();
    });
  }

  hideChatContinue() {
    const b = document.querySelector('.wx-continue');
    if (b) b.remove();
  }

  /** 外面（引擎）用：面板上还有没有没点掉的「继续」 */
  hasChatContinue() { return !!this._chatContinueCb; }

  clickChatContinue() {
    if (this._chatContinueCb) this._chatContinueCb();
  }

  /* iOS 那套状态栏：左边时间，右边信号 / WiFi / 电池。
     信号是四根从矮到高的圆角竖条，WiFi 是三条同心弧，
     电池是描边圆角矩形 + 内部电量块——都不是色块占位。 */
  _mosStatusBar(hhmm, solid) {
    return `<div class="mos-bar${solid ? ' mos-bar-solid' : ''}">
      <span class="mos-time" id="mosTime">${hhmm || ''}</span>
      <span class="mos-sys">
        <svg class="mos-sig" viewBox="0 0 18 12" aria-hidden="true">
          <rect x="0"  y="8" width="3" height="4" rx="1"/>
          <rect x="5"  y="5.7" width="3" height="6.3" rx="1"/>
          <rect x="10" y="3.2" width="3" height="8.8" rx="1"/>
          <rect x="15" y="0.8" width="3" height="11.2" rx="1"/>
        </svg>
        <svg class="mos-wifi" viewBox="0 0 16 12" aria-hidden="true">
          <path d="M1 4.3a10.4 10.4 0 0 1 14 0"/>
          <path d="M3.6 7.1a6.6 6.6 0 0 1 8.8 0"/>
          <path d="M6.2 9.8a2.8 2.8 0 0 1 3.6 0"/>
        </svg>
        <span class="mos-bat" aria-label="电量"><i></i></span>
        <button class="mos-exit" type="button" data-mos-exit="1" aria-label="退出手机，回到剧情">×</button>
      </span>
    </div>`;
  }

  /* ---------------- 桌面（MintOS 4） ----------------
     仿小米澎湃 OS 的桌面：状态栏 + 大时钟 + 图标网格 + 底部 dock。
     图标用 assets/icons/hyperos 那套（OS 4 的默认图标集），
     微信和浏览器这两个没有现成图标的，用同色系圆角方块 + 白线描出来，
     混在一排里看不出是两种来源。
     这一屏的作用是把顶栏那些入口（政务、材料、人物、存档、设置…）
     收进手机里：从手机也能一路点过去，不必再回顶栏找。 */
  _renderPhoneHome() {
    this._phoneThread = null;
    this.hideChatContinue();
    this._mintStack = [];

    const ico = (id) => `assets/icons/hyperos/${id}.png`;
    const apps = MINT_APPS;

    const grid = apps.map(a => `
      <button class="mos-app" type="button" data-app="${a.id}">
        <span class="mos-ico">${a.badge ? `<i class="mos-badge">${a.badge}</i>` : ''}<img src="${ico(a.icon)}" alt="" loading="lazy" /></span>
        <span class="mos-name">${a.name}</span>
      </button>`).join('');


    /* 时间不再是写死的 7:40：读系统时间，跟真机一致；
       日期那行仍然是剧情日期（九月一日 · 周一），
       两者一个走"这台设备"，一个走"这个故事"。 */
    const now = new Date();
    const hhmm = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const storyDay = (this.el.day && this.el.day.textContent.trim()) || '九月一日 · 周一';

    const html = `<div class="mos">
      ${this._mosStatusBar(hhmm)}
      <div class="mos-wall">
        <p class="mos-clock" id="mosClock">${hhmm}</p>
        <p class="mos-date">${storyDay}</p>
      </div>
      <div class="mos-grid">${grid}</div>
      <p class="mos-note">Mint Note 11SE · MintOS 4</p>
    </div>`;

    // 从剧情点进来的手机也要能「看完了」收尾：退到桌面不能把续接回调弄丢，
    // 否则玩家从桌面关掉手机后剧情永远停在这一句。
    const canDone = !!this._phoneOnClose;
    this.openPanel({
      title: '手机',
      body: html,
      phone: true,
      foot: canDone ? '<button class="btn btn-primary" id="phoneDone">看完了，放下手机</button>' : '',
      onClose: canDone ? () => this._phoneDone() : null
    });
    if (canDone) {
      const doneBtn = $('#phoneDone', this.el.panelFoot);
      if (doneBtn) doneBtn.addEventListener('click', () => this.closePanel());
    }
    const body = this.el.panelBody;
    /* 老 WebView 不支持 :has()，用它来做面板布局会直接失效，
       所以这里给面板挂一个显式 class，CSS 两边都写。 */
    body.classList.add('mos-host');
    /* 分钟跳一下，别让桌面上的时间停在打开的那一刻 */
    clearInterval(this._mosTimer);
    this._mosTimer = setInterval(() => {
      const t = document.querySelector('#mosTime');
      if (!t || !t.isConnected) { clearInterval(this._mosTimer); return; }
      const d = new Date();
      const s = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      t.textContent = s;
      const c = document.querySelector('#mosClock');
      if (c) c.textContent = s;
    }, 20000);
    body.querySelectorAll('[data-app]').forEach(b => {
      b.addEventListener('click', () => this._phoneApp(b.dataset.app, b.dataset.label));
    });
    /* 手机是个全屏面板、还没有标题栏，不给一个「退出」人就会困在桌面里。
       桌面状态栏和应用页导航栏各留一个 ×，点了直接回到剧情。 */
    if (!body._mosExitBound) {
      body._mosExitBound = true;
      body.addEventListener('click', (e) => {
        const hit = e.target.closest && e.target.closest('[data-mos-exit]');
        if (!hit) return;
        e.preventDefault();
        this.audio.sfx('page');
        this.closePanel();
      });
    }
  }

  /* ---------------- 手机里的子页面 ----------------
     手机是一个"套娃"结构：桌面 → 应用 → 应用里的二级页。
     每一层都自己画顶栏（左上角返回），返回时回到上一层，
     而不是把整个面板换掉——换了面板手机外壳就没了。 */
  _mintPush(html, title, onBind, badge) {
    const stack = this._mintStack || (this._mintStack = []);
    stack.push({ html, title, badge: badge || '' });
    this._mintRender();
    if (onBind) onBind(this.el.panelBody);
  }
  _mintBack() {
    const stack = this._mintStack || (this._mintStack = []);
    stack.pop();
    if (!stack.length) { this._renderPhoneHome(); return; }
    this._mintRender();
  }
  _mintRender() {
    const stack = this._mintStack || [];
    const top = stack[stack.length - 1];
    if (!top) return;
    this.el.panelTitle.innerHTML = escapeHtml(top.title || '手机')
      + (top.badge ? `<span class="mos-beta">${escapeHtml(top.badge)}</span>` : '');
    this.el.panelBody.classList.add('mos-host');
    const d0 = new Date();
    const nm = `${d0.getHours()}:${String(d0.getMinutes()).padStart(2, '0')}`;
    this.el.panelBody.innerHTML = `<div class="mos-appview">
      ${this._mosStatusBar(nm, true)}
      <div class="mos-nav">
        <button class="mos-back" type="button" data-mint-back="1" aria-label="返回">‹</button>
        <span class="mos-nav-t">${escapeHtml(top.title || '')}${top.badge ? `<span class="mos-beta">${escapeHtml(top.badge)}</span>` : ''}</span>
      </div>
      <div class="mos-view">${top.html}</div>
    </div>`;
    this.el.panelBody.scrollTop = 0;
    this.el.panelBody.querySelectorAll('[data-mint-back]').forEach(b => {
      b.addEventListener('click', () => { this.audio.sfx('page'); this._mintBack(); });
    });
  }

  /* 桌面图标点下去之后去哪个页面 */
  _phoneApp(id, label) {
    this.audio.sfx('click');
    const go = {
      chat: () => this._renderPhone('list', null),
      ai: () => { this._mintBack(); this.openAssistant(); },
      browser: () => this._mintPush(browserHTML(this.state), '浏览器', (box) => {
        bindBrowser(box, (key) => {
          if (key === 'gov') { this._mintBack(); this.openGovHome(); return; }
          if (key === 'campus') { this._mintBack(); this._mintPush(campusHTML(this.state), '校园通', (b) => this._bindCampus(b)); return; }
          this.toast('教育局的网站只有一页目录，和一个打不通的监督电话', 2400);
        });
      }),
      gov: () => this.openGovHome(),
      /* 下面这几个以前都是"关掉手机、弹游戏自己的面板"，
         现在全部留在手机里：它们本身就是 App。 */
      people: () => this._pushApp('contacts'),
      save: () => this._pushApp('backup'),
      settings: () => this._pushApp('settings'),
      changelog: () => this._pushApp('update'),
      about: () => this._pushApp('about'),
      timeline: () => this._pushApp('reading'),
      campus: () => this._mintPush(campusHTML(this.state), '校园通', (box) => this._bindCampus(box)),
      note: () => this._mintPush(noteHTML(this.state), '便笺', (box) => {
        bindNote(box, this.state, () => {
          const st = this._mintStack[this._mintStack.length - 1];
          if (st) { st.html = noteHTML(this.state); this._mintRender(); }
        });
      }),
      gallery: () => this._mintPush(galleryHTML(), '相册', (box) => {
        box.querySelectorAll('[data-album]').forEach(b => b.addEventListener('click', () => {
          this.audio.sfx('page');
          this._mintPush(galleryDetailHTML(Number(b.dataset.album)), '照片');
        }));
      }),
      chain: () => this._mintPush(chainHTML(this.state), '家长群接龙'),
      calc: () => this._mintPush(calcHTML(), '计算器', (box) => bindCalc(box)),
      dial: () => this._pushApp('dial'),
      store: () => this._pushApp('store'),
      games: () => this._pushApp('games'),
      camera: () => this._pushApp('camera'),
      clock: () => this._pushApp('clock'),
      weather: () => this._pushApp('weather'),
      music: () => this._pushApp('music'),
      files: () => this._pushApp('files')
    }[id];
    if (go) { go(); return; }
    this.toast(`${label || '这个'}在 Demo 里还没有做`, 1800);
  }

  /* ---------------- 手机里的独立应用 ----------------
     每个 App 只有一个 html + 一个 bind，push 进手机自己的页面栈，
     导航栏、返回、右上角退出都由手机外壳提供。 */
  _pushApp(id) {
    const conf = this._appConf(id);
    if (!conf) { this.toast('这个应用还没装', 1600); return; }
    this._mintPush(conf.html, conf.title, (box) => {
      if (conf.bind) conf.bind(box);
      this._bindAppNav(box);
    }, conf.badge);
  }

  _appConf(id) {
    const ver = (typeof CONFIG !== 'undefined' && CONFIG.version) || '0.6.3.0';
    const open = (app) => this._pushApp(app);

    if (id === 'settings') {
      return {
        title: '设置',
        html: settingsAppHTML(this.settings, { version: ver }),
        bind: (box) => bindSettingsApp(
          box, this.settings,
          () => this.saveAPI && this.saveAPI.saveSettings && this.saveAPI.saveSettings(),
          () => { if (typeof this.applySettings === 'function') this.applySettings(); }
        )
      };
    }

    if (id === 'update') {
      return {
        title: '软件更新',
        html: updateAppHTML({ version: ver }),
        bind: (box) => bindUpdateApp(box, {
          check: async () => {
            try {
              const m = await import('../core/update.js');
              return await m.checkUpdate();
            } catch (e) { return null; }
          }
        })
      };
    }

    if (id === 'log') {
      return { title: '更新日志', html: changelogAppHTML() };
    }

    if (id === 'about') {
      return { title: '关于手机', html: aboutAppHTML({ version: ver }) };
    }

    if (id === 'contacts') {
      return {
        title: '通讯录',
        html: contactsAppHTML(this.state, CHARACTERS),
        bind: (box) => {
          box.querySelectorAll('[data-contact]').forEach(b => b.addEventListener('click', () => {
            const c = CHARACTERS[b.dataset.contact];
            if (!c) return;
            this.audio.sfx('page');
            this._mintPush(contactDetailHTML(c, this.state), c.name, (b2) => this._bindAppNav(b2));
          }));
        }
      };
    }

    if (id === 'backup') {
      const raw = (this.saveAPI && this.saveAPI.list) ? this.saveAPI.list('main') : [];
      const slots = raw.map(sl => ({
        index: sl.slot,
        data: sl.data,
        time: sl.data ? fmtTime(sl.data.ts) : '',
        title: sl.data ? sl.data.chapterTitle : '',
        day: sl.data ? sl.data.dayLabel : ''
      })).filter(sl => sl.index > 0 || sl.data);
      return {
        title: '备份与恢复',
        html: backupAppHTML(slots),
        bind: (box) => {
          box.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => {
            const slot = Number(b.dataset.restore);
            this.closePanel();
            this.saveAPI.load(slot, 'main');
          }));
        }
      };
    }

    if (id === 'reading') {
      const chapters = Array.isArray(this.chapters) ? this.chapters : [];
      let progress = { chapters: [] };
      try { progress = this.saveAPI.loadProgress ? this.saveAPI.loadProgress() : progress; } catch (e) { /* 没存档就当空的 */ }
      return { title: '阅读记录', html: readingAppHTML(chapters, progress) };
    }

    if (id === 'store') {
      // 商店里列的是"已安装"：点一下就真的打开那个应用
      return {
        title: '应用商店',
        html: storeAppHTML(MINT_APPS),
        bind: (box) => {
          bindStore(box);
          box.querySelectorAll('[data-open-app]').forEach(b => b.addEventListener('click', () => {
            this.audio.sfx('click');
            this._mintBack();
            this._phoneApp(b.dataset.openApp, '');
          }));
        }
      };
    }

    if (id === 'games') {
      return {
        title: '游戏中心',
        html: gameCenterHTML(),
        bind: (box) => {
          box.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', () => {
            this.audio.sfx('click');
            this._pushApp(b.dataset.game);
          }));
        }
      };
    }

    if (id === 'g2048') {
      return { title: '2048', html: g2048HTML(), bind: (box) => bind2048(box) };
    }

    if (id === 'mine') {
      return { title: '扫雷', html: mineHTML(), bind: (box) => bindMine(box) };
    }

    if (id === 'camera') {
      let bg = null;
      try {
        const sc = this.stage && this.stage.snapshotScene ? this.stage.snapshotScene() : null;
        if (sc && sc.bg) bg = assetUrl('background', sc.bg);
      } catch (e) { /* 没有场景就用默认取景 */ }
      return { title: '相机', html: cameraAppHTML(bg), bind: (box) => bindCamera(box) };
    }

    if (id === 'clock') {
      return { title: '时钟', html: clockAppHTML(), bind: (box) => bindClock(box) };
    }

    if (id === 'weather') {
      return { title: '天气', html: weatherAppHTML() };
    }

    if (id === 'music') {
      const tracks = Object.keys(MUSIC).filter(k => k !== 'title').map(k => ({ id: k, label: MUSIC[k].label }));
      return {
        title: '音乐',
        html: musicAppHTML(tracks, this.audio && this.audio.currentId),
        bind: (box) => this._bindMusic(box, tracks)
      };
    }

    if (id === 'files') {
      return { title: '文件管理', html: filesAppHTML(), bind: (box) => bindFiles(box) };
    }

    if (id === 'dial') {
      const personas = dialPersonas(this.state, CHARACTERS);
      return {
        title: '电话',
        badge: 'beta',
        html: dialAppHTML(personas),
        bind: (box) => bindDial(box, {
          personas,
          ai: this._dialAI(),
          onExit: () => {}
        })
      };
    }

    if (id === 'saves') { open('backup'); return null; }
    return null;
  }

  /* 音乐播放器：真的切 BGM。关掉手机回剧情时，音乐照旧在放。 */
  _bindMusic(box, tracks) {
    const title = box.querySelector('#muTitle');
    const sub = box.querySelector('#muSub');
    const main = box.querySelector('#muToggle');
    const paint = () => {
      const cur = (tracks.find(t => t.id === (this.audio && this.audio.currentId)) || null);
      if (title) title.textContent = cur ? cur.label : '未在播放';
      if (sub) sub.textContent = cur ? '正在播放' : '未在播放';
      if (main) main.textContent = cur ? '❚❚' : '▶';
      box.querySelectorAll('[data-track]').forEach(r => {
        r.classList.toggle('is-on', !!cur && r.dataset.track === cur.id);
      });
    };
    const index = () => tracks.findIndex(t => t.id === (this.audio && this.audio.currentId));
    box.querySelectorAll('[data-track]').forEach(r => r.addEventListener('click', () => {
      this.audio.sfx('click');
      this.audio.play(r.dataset.track, { restart: true });
      paint();
    }));
    box.querySelectorAll('[data-mu]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.mu;
      const i = index();
      if (act === 'toggle') {
        if (i >= 0) { this.audio.stop(); paint(); }
        else { this.audio.play(tracks[0].id, { restart: true }); paint(); }
      } else if (act === 'next') {
        const n = tracks[(i + 1 + tracks.length) % tracks.length];
        this.audio.play(n.id, { restart: true }); paint();
      } else if (act === 'prev') {
        const n = tracks[(i - 1 + tracks.length) % tracks.length];
        this.audio.play(n.id, { restart: true }); paint();
      }
    }));
  }

  /* 设置里的「软件更新 / 关于手机」、更新里的「更新日志」都是往深一层 push */
  _bindAppNav(box) {
    box.querySelectorAll('[data-go-app]').forEach(b => {
      if (b._appNavBound) return;
      b._appNavBound = true;
      b.addEventListener('click', () => {
        this.audio.sfx('page');
        this._pushApp(b.dataset.goApp);
      });
    });
  }

  /* 校园通的二级页 */
  _bindCampus(box) {
    box.querySelectorAll('[data-cp]').forEach(b => b.addEventListener('click', () => {
      this.audio.sfx('page');
      const id = b.dataset.cp;
      if (id === 'notice') {
        this._mintPush(campusNoticeHTML(), '通知公告', (b2) => {
          b2.querySelectorAll('[data-notice]').forEach(n => n.addEventListener('click', () => {
            this.audio.sfx('page');
            this._mintPush(campusNoticeDetail(n.dataset.notice), '通知');
          }));
        });
      } else if (id === 'service') {
        this._mintPush(campusServiceHTML(this.state), '服务大厅', (b2) => {
          b2.querySelectorAll('[data-scat]').forEach(c => c.addEventListener('click', () => {
            this.audio.sfx('page');
            const k = c.dataset.scat;
            if (k === 'mine') { this.toast('工单状态：已收悉 · 五个工作日内答复', 2600); return; }
            if (k === '咨询建议') {
              this._mintPush(campusConsultHTML(), '咨询建议', (b3) => {
                const btn = b3.querySelector('#cpcSubmit');
                if (btn) btn.addEventListener('click', () => {
                  const body = (b3.querySelector('#cpcBody').value || '').trim();
                  if (!body) { this.toast('还没写内容', 1800); return; }
                  const agree = b3.querySelector('#cpcAgree');
                  if (!agree || !agree.checked) { this.toast('要先勾选《服务大厅使用须知》', 2000); return; }
                  const d = new Date();
                  const p = (n) => String(n).padStart(2, '0');
                  const time = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
                  const no = `W-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
                  this.audio.sfx('ok');
                  this.state.gov = { ...(this.state.gov || {}), no, time, replied: false };
                  const st = this._mintStack[this._mintStack.length - 1];
                  if (st) { st.html = campusReceiptHTML(no, time); st.title = '提交结果'; this._mintRender(); }
                });
              });
            } else {
              this.toast(`${k}：Demo 里只做了咨询建议这一条`, 2200);
            }
          }));
        });
      } else if (id === 'attend' || id === 'afterschool') {
        this._mintPush(campusAttendHTML(this.state), '我的考勤');
      } else {
        this.toast(`${b.textContent.trim()}：Demo 里还没有做`, 2000);
      }
    }));
  }

  _renderPhone(thread, reply) {
    if (thread === 'home') return this._renderPhoneHome();
    const isList = thread === 'list';
    const th = THREADS[thread];
    const headTitle = isList ? '微信' : (th ? th.name : '');
    const kind = isList ? null : threadKind(thread);
    this._phoneThread = isList ? null : thread;
    this.hideChatContinue();

    /* 群和群不是一回事：头像、标题右边的标签、顶栏底色都按 kind 分开，
       一眼能看出这条是"有老师的群"还是"没老师的群"。 */
    const avatarOf = (name, sprite, isGroup, tone) => {
      if (isGroup) return `<span class="wx-av wx-av-grid is-${tone || 'class'}">${'<i></i>'.repeat(4)}</span>`;
      const img = sprite ? assetUrl('sprite', sprite) : null;
      return img
        ? `<span class="wx-av" style="background-image:url('${img}')"></span>`
        : `<span class="wx-av wx-av-t">${escapeHtml((name || '·').slice(0, 1))}</span>`;
    };

    // “九月十二日 周五” → “9/12”；当天则只显示时间
    const miniDay = (raw) => {
      if (!raw) return '';
      const s = String(raw);
      const m = s.match(/^([一二三四五六七八九十]+)月([一二三四五六七八九十]+)日/);
      if (!m) return s;
      const cn = (t) => {
        const d = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
        if (t === '十') return 10;
        if (t.length === 1) return d[t] || 0;
        if (t[0] === '十') return 10 + (d[t[1]] || 0);
        if (t[1] === '十') return (d[t[0]] || 0) * 10;
        return (d[t[0]] || 0) * 10 + (d[t[2]] || 0);
      };
      return `${cn(m[1])}/${cn(m[2])}`;
    };

    let bodyHTML = '';
    if (isList) {
      const threads = Object.values(THREADS).filter(t => threadMessages(this.state, t.id).length > 0);
      const last = threads.slice().sort((a, b) => {
        const la = threadMessages(this.state, a.id).slice(-1)[0] || {};
        const lb = threadMessages(this.state, b.id).slice(-1)[0] || {};
        return (lb.ts || 0) - (la.ts || 0);
      })[0];
      bodyHTML = threads.length
        ? threads.map(t => {
            const list = threadMessages(this.state, t.id);
            const lastMsg = list[list.length - 1] || {};
            const prev = lastMsg.me ? `我：${lastMsg.text}` : (lastMsg.from ? `${lastMsg.from}：${lastMsg.text}` : lastMsg.text);
            const time = lastMsg.time || miniDay(lastMsg.day);
            const unread = t === last && !lastMsg.me;
            const k = threadKind(t.id);
            return `<button class="wx-item k-${k.tone}" data-thread="${t.id}">
              ${avatarOf(t.name, t.avatar, t.group, k.tone)}
              <span class="wx-main">
                <span class="wx-name">${escapeHtml(t.name)}${t.kind !== 'dm' ? `<em class="wx-kind">${k.label}</em>` : ''}</span>
                <span class="wx-prev">${escapeHtml(prev || '')}</span>
              </span>
              <span class="wx-side">
                <span class="wx-time-mini">${escapeHtml(time)}</span>
                ${unread ? '<span class="wx-dot"></span>' : ''}
              </span>
            </button>`;
          }).join('')
        : '<div class="wx-empty">暂时没有消息。<br>群里的通知会在晚上发出来。</div>';
    } else {
      const msgs = threadMessages(this.state, thread);
      let lastDay = null;
      let prevFrom = null;
      bodyHTML = msgs.map(m => {
        let dayDiv = '';
        if (m.day && m.day !== lastDay) {
          dayDiv = `<div class="wx-time">${escapeHtml(m.day)}</div>`;
          lastDay = m.day;
          prevFrom = null;
        }
        const isMe = !!(m.me || m.from === '我');
        if (!m.from && !isMe) {
          prevFrom = null;
          return `${dayDiv}<div class="wx-sys"><span>${escapeHtml(m.text)}</span></div>`;
        }
        const me = isMe;
        // 微信里连续同一个人发消息，昵称只在第一条上出现
        const showNick = !me && th && th.group && m.from !== prevFrom;
        prevFrom = me ? '__me__' : m.from;
        const inner = m.sticker
          ? `<div class="wx-sticker" role="img" aria-label="表情">${emojiHTML(m.text)}</div>`
          : `<div class="wx-bub">${emojiHTML(m.text)}</div>`;
        const av = me
          ? avatarOf('我', null)
          : avatarOf(m.from, m.spriteOf || null);
        return `${dayDiv}<div class="wx-row ${me ? 'me' : ''}">
          ${me ? inner + av : av + `<div class="wx-bubwrap">${showNick ? `<div class="wx-nick">${escapeHtml(m.from)}</div>` : ''}${inner}</div>`}
        </div>`;
      }).join('') || '<div class="wx-empty">这里还没有对话。</div>';
    }

    const tone = isList ? '' : ` k-${kind.tone}`;
    const subline = !isList && th && th.sub ? `<span class="wx-sub">${escapeHtml(th.sub)}</span>` : '';
    const badge = !isList && th && th.kind !== 'dm' ? `<em class="wx-kind">${kind.label}</em>` : '';
    const html = `<div class="wx${tone}">
      <div class="wx-top">
        <button class="wx-back" data-back="1" aria-label="返回">${isList ? '⌂' : '‹'}</button>
        <span class="wx-headmain">
          <span class="wx-title">${escapeHtml(headTitle)}</span>
          ${subline}${badge}
        </span>
        <span class="wx-act">${isList ? '＋' : '⋯'}</span>
      </div>
      <div class="wx-body${isList ? ' is-list' : ''}" id="phoneBody">${bodyHTML}</div>
      ${isList ? '' : `<div class="wx-inputbar">
        <button class="wx-ico wx-emoji-btn" id="wxEmojiBtn" type="button" aria-label="表情" title="表情">☺</button>
        <span class="wx-input">发送消息…</span>
        <span class="wx-ico">＋</span>
      </div>
      <div class="wx-emoji-sheet" id="wxEmojiSheet" hidden></div>`}
    </div>`;

    /* 只有一个"看看手机"的节点（不是等玩家回复）时，给一个明确的收尾口：
       底部按钮 + 右上角 × 都算「看完了」，不能只是关掉面板把剧情丢在半路。 */
    const canDone = !reply && !!this._phoneOnClose;
    this.openPanel({
      title: '手机',
      body: html,
      phone: true,
      lockClose: !!reply,
      foot: canDone ? '<button class="btn btn-primary" id="phoneDone">看完了，放下手机</button>' : '',
      onClose: canDone ? () => this._phoneDone() : null
    });
    if (canDone) {
      const doneBtn = $('#phoneDone', this.el.panelFoot);
      if (doneBtn) doneBtn.addEventListener('click', () => this.closePanel());
    }

    const bodyEl = $('#phoneBody');
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;

    this.el.panelBody.querySelectorAll('[data-thread]').forEach(b => {
      b.addEventListener('click', () => { this.audio.sfx('page'); this._renderPhone(b.dataset.thread, null); });
    });
    const back = this.el.panelBody.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => {
      // 还欠一句回复就走开，选项会落在看不见的地方，剧情永远等在那儿
      if (this._awaitReply) { this.toast('先回一句再走', 1500); return; }
      this.audio.sfx('page');
      // 列表页的返回键回手机桌面，会话页的返回键回列表
      this._renderPhone(isList ? 'home' : 'list', null);
    });

    /* 表情面板：只在会话页出现。选一张就作为「贴纸」单独发出去——
       和正文里跟字走的 emoji 是一套图，但形态不同：这里不套气泡。 */
    const emoBtn = this.el.panelBody.querySelector('#wxEmojiBtn');
    const emoSheet = this.el.panelBody.querySelector('#wxEmojiSheet');
    if (emoBtn && emoSheet) {
      emoSheet.innerHTML = EMOJI_ALL
        .map((c) => `<button class="wx-emoji-item" type="button" data-emo="${c}" aria-label="${c}">${emojiHTML(c)}</button>`)
        .join('');
      emoBtn.addEventListener('click', () => {
        this.audio.sfx('page');
        emoSheet.hidden = !emoSheet.hidden;
        if (!emoSheet.hidden) {
          emoSheet.scrollIntoView({ block: 'end' });
          const b = $('#phoneBody');
          if (b) b.scrollTop = b.scrollHeight;
        }
      });
      emoSheet.querySelectorAll('[data-emo]').forEach((b) => {
        b.addEventListener('click', () => {
          const ch = b.dataset.emo;
          const msg = {
            thread,
            from: '',
            text: ch,
            me: true,
            sticker: true,
            day: this.state.dayLabel,
            time: ''
          };
          this.state.chats.push(msg);
          this.audio.sfx('select');
          emoSheet.hidden = true;
          this.appendChatMessage(msg);
        });
      });
    }

    if (reply) {
      // 首次进入也留一点时间让人看到最后一条消息再出选项
      this._queueReplyOptions(reply.node, reply.cb, 420);
    }
  }

  /* ================= 政务投诉表单 =================
     注意：这个方法名必须与 vn.js 里 `case 'govform'` 的调用一致。
     曾经这里的方法头被误写成 openQuiz，导致
       ① openComplaintForm 不存在 → 走到填表节点直接抛异常、剧情卡死
       ② 课堂小测调到了表单逻辑，题目根本出不来
     */
  openComplaintForm(cfg, cb) {
    cfg = cfg || {};
    const done = (res) => {
      this._panelOnClose = null;
      this._lockClose = false;
      $('#panelClose').style.visibility = '';
      this.el.panelLayer.hidden = true;
      this.el.panelFoot.hidden = true;
      this.el.panelFoot.innerHTML = '';
      if (this.engine) this.engine.resume();
      cb(res);
    };
    this._govDone = false;

    this.openPanel({
      title: cfg.unit || '市政务服务平台',
      body: complaintHTML(this.state, cfg),
      lockClose: !!cfg.lockClose,
      onClose: () => done({ submitted: false }),
      wide: true
    });
    const box = this.el.panelBody;
    bindComplaint(box, this.state, (res) => {
      if (!res.submitted) { this.audio.sfx('click'); done({ submitted: false }); return; }
      this.audio.sfx('ok');
      const time = cfg.time || '2025-09-18 21:34';
      const no = makeCaseNo(time);
      const unit = cfg.unit || '市教育局';
      this._lastGov = { no, time, res };
      // 提交的那一刻就写进 state.gov：否则玩家在回执页直接退出 / 读档，
      // 顶栏「政务」会一直显示"还没有提交过反映"（曾经就是这样）。
      this.state.gov = {
        no,
        time,
        types: res.types || [],
        desc: res.desc || '',
        claims: res.claims || [],
        amount: res.amount || 0,
        evidence: !!res.evidence,
        replied: false
      };
      // 提交之后关掉面板，也算「已经提交过了」，不能退回成“关掉页面”
      this._panelOnClose = () => done({ submitted: true, ...this._lastGov, res });
      this.el.panelTitle.textContent = `${unit} · 提交结果`;
      box.innerHTML = receiptHTML({
        no, time,
        unit,
        typeText: res.types.map(k => ({ fee: '违规收费', force: '变相强制', time: '作息与减负', other: '其他' }[k] || k)).join('、'),
        note: cfg.note || ''
      });
      const go = box.querySelector('#gvProgress');
      if (go) go.addEventListener('click', () => {
        this.audio.sfx('page');
        const data = typeof cfg.progress === 'function' ? cfg.progress(no, time) : cfg.progress;
        this._renderGovProgress(data, () => done({ submitted: true, ...this._lastGov, res }), false);
      });
      const back = box.querySelector('#gvBack');
      if (back) back.addEventListener('click', () => done({ submitted: true, ...this._lastGov, res }));
    });
  }

  /* ================= 课堂小测 =================
     剧情里的"上课"不再是旁白：真的发卷子、真的做选择，
     交卷后逐题批改。分数写进 state.quizzes，供后面剧情引用。 */
  openQuiz(cfg, cb) {
    cfg = cfg || {};
    const total = (cfg.questions || []).length;
    const done = (res) => {
      this._panelOnClose = null;
      this._lockClose = false;
      $('#panelClose').style.visibility = '';
      this.el.panelLayer.hidden = true;
      this.el.panelFoot.hidden = true;
      this.el.panelFoot.innerHTML = '';
      if (this.engine) this.engine.resume();
      cb(res);
    };

    const ask = () => {
      this.openPanel({
        title: cfg.title || '随堂测',
        body: quizHTML(cfg),
        wide: true,
        onClose: () => done({ right: 0, total, skipped: true })
      });
      const box = this.el.panelBody;
      bindQuiz(box, cfg, (answers) => {
        this.audio.sfx('page');
        const right = answers.filter((a, i) => a === ((cfg.questions || [])[i] || {}).answer).length;
        box.innerHTML = quizResultHTML(cfg, answers);
        box.scrollTop = 0;
        this.el.panelFoot.hidden = false;
        this.el.panelFoot.innerHTML = `
          <button class="btn" id="qzAgain" type="button">再做一次</button>
          <button class="btn btn-primary" id="qzNext" type="button">继续</button>`;
        this.el.panelFoot.querySelector('#qzAgain').addEventListener('click', () => {
          this.audio.sfx('click');
          this.el.panelFoot.hidden = true;
          this.el.panelFoot.innerHTML = '';
          ask();
        });
        this.el.panelFoot.querySelector('#qzNext').addEventListener('click', () => {
          this.audio.sfx('click');
          done({ right, total });
        });
      });
    };
    ask();
  }

  /* 单独的进度查询页（不经过表单，直接给答复） */
  openGovProgress(data, cb) {
    this._govDone = false;
    /* 收尾统一走这里。
       注意 onClose 一定要挂在 openPanel 上：这个面板右上角有 ×，
       玩家点 × 关掉时如果只关闭面板、不回调，vn 里的 blocked 就永远是 true，
       后面怎么点都没反应（玩家反馈的"剧情容易卡住"就是从这里来的）。
       用 × 关掉，按"已看过"处理，不算逃课。 */
    const finish = (act) => {
      if (this._govDone) return;
      this._govDone = true;
      this._panelOnClose = null;
      this._lockClose = false;
      $('#panelClose').style.visibility = '';
      this.el.panelLayer.hidden = true;
      this.el.panelFoot.hidden = true;
      this.el.panelFoot.innerHTML = '';
      if (this.engine) this.engine.resume();
      if (cb) cb(act);
    };
    this.openPanel({
      title: '市政务服务平台 · 进度查询',
      body: progressHTML(data || {})
        + (data && data.ai
          ? '<p class="gov-ai-tag">本页答复正文由模型现场生成，措辞每次可能不同；受理编号、办理节点与时间按剧情固定。</p>'
          : ''),
      wide: true,
      onClose: () => finish('closed')
    });
    bindProgress(this.el.panelBody, data || {}, null, finish);
  }

  _renderGovProgress(data, cb) {
    if (!data) return cb && cb();
    this.el.panelBody.innerHTML = progressHTML(data);
    bindProgress(this.el.panelBody, data, null, (act) => cb && cb(act));
  }

  /* 12345 电话：整段通话在面板里逐条进行，玩家要选择说什么 */
  openHotline(cfg, cb) {
    this._govDone = false;
    this.openPanel({
      title: cfg.callTitle || '通话中',
      body: hotlineHTML(cfg),
      hot: true,
      lockClose: true,
      onClose: () => {}
    });
    bindHotline(this.el.panelBody, cfg.steps || [], (res) => {
      if (this._govDone) return;
      this._govDone = true;
      this._panelOnClose = null;
      this._lockClose = false;
      this.el.panelLayer.hidden = true;
      this.el.panelFoot.hidden = true;
      this.el.panelFoot.innerHTML = '';
      if (this.engine) this.engine.resume();
      if (cb) cb(res);
    });
  }

  /* 顶栏「政务」：查看自己提交过的反映与答复（纯查看，不推进剧情） */
  openGovHome() {
    const gov = this.state.gov;
    const wasPaused = this.engine && this.engine.paused;

    if (!gov) {
      this.openPanel({
        title: '市政务服务平台',
        body: `<div class="gov">
          <div class="gov-top">
            <div class="gov-brand"><span class="gov-seal">政务</span><span class="gov-brand-t">市政务服务平台</span></div>
            <span class="gov-crumb">我的 / 我的反映</span>
          </div>
          <div class="gov-done" style="text-align:left;padding:22px 20px">
            <h3 style="letter-spacing:.1em">还没有提交过反映</h3>
            <p class="gov-sub" style="margin-top:8px">平台只在你自己填过表、按下提交之后，才会留下记录。</p>
            <p class="gov-note">如果你已经在剧情里提交过，却看到这一页，说明那次你最后关掉了页面。</p>
          </div>
        </div>`
      });
      return;
    }

    const data = buildCaseProgress(gov);
    const status = gov.replied ? '已办结' : '办理中';
    this.openPanel({
      title: '市政务服务平台',
      body: `<div class="gov">
        <div class="gov-top">
          <div class="gov-brand"><span class="gov-seal">政务</span><span class="gov-brand-t">市政务服务平台</span></div>
          <span class="gov-crumb">我的 / 我的反映</span>
        </div>
        <div class="gov-progress">
          <h3 class="gov-h">我的反映</h3>
          <p class="gov-sub">共 1 条</p>
          <button class="gov-case" id="govCase">
            <span class="gov-case-t">${escapeHtml(gov.kind === 'mask' ? '反映学校保健室向学生提供过期口罩并收费' : '反映学校周日学业支持活动组织方式问题')}</span>
            <span class="gov-case-m">${escapeHtml(gov.no)} · ${escapeHtml(gov.time)} · ${escapeHtml(typeText(gov.types))}</span>
            <span class="gov-badge">${status}</span>
          </button>
          <p class="gov-note">点开可以看办理流程的每个节点，以及承办单位写在节点上的意见。</p>
        </div>
      </div>`
    });
    const btn = this.el.panelBody.querySelector('#govCase');
    if (btn) btn.addEventListener('click', () => {
      this.audio.sfx('page');
      this.openGovProgress(data, null);
    });
    if (!wasPaused && this.engine) this.engine.resume();
  }


  /* ================= AI 助手「薄荷」 =================
     两个入口：标题页右下角的悬浮胶囊、游戏内顶栏的圆头像。
     会话模型照 C 端的习惯做：左边一个列表，能新建、切换、删；
     对话存在本机，关掉面板、退出游戏再回来都还在。
     没配置接口时不假装能用，直接把「去哪儿填」摆出来。 */
  openAssistant() {
    const ai = this.settings.ai || {};
    const configured = !!(ai.baseUrl && ai.model);
    this._aiLoad();

    const status = configured
      ? `已接入 ${escapeHtml(ai.model)}${ai.apiKey ? '' : ' · 未填 Key'}`
      : '还没有配置接口';

    const body = configured
      ? `
        <div class="ai-chat">
          <div class="ai-chat-head">
            <button class="ai-hbtn" id="aiSessBtn" type="button" title="对话列表" aria-label="对话列表"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="1.6" y="3.4" width="12.8" height="1.5" rx=".75" fill="currentColor"/><rect x="1.6" y="7.25" width="12.8" height="1.5" rx=".75" fill="currentColor"/><rect x="1.6" y="11.1" width="12.8" height="1.5" rx=".75" fill="currentColor"/></svg></button>
            <span class="ai-avatar"></span>
            <div class="ac-h-main">
              <b id="acTitle">薄荷</b>
              <i id="acStatus">${status} · 搜索${ai.searchMode ? '开' : '关'}</i>
            </div>
            <button class="ai-hbtn" id="aiNewBtn" type="button" title="新建对话" aria-label="新建对话"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="7.2" y="2.4" width="1.6" height="11.2" rx=".8" fill="currentColor"/><rect x="2.4" y="7.2" width="11.2" height="1.6" rx=".8" fill="currentColor"/></svg></button>
          </div>
          <div class="ai-pane">
            <div class="ai-log" id="aiLog"></div>
            <div class="ai-sessions" id="aiSessions" hidden></div>
          </div>
          <div class="ai-stickers" id="aiStickers" hidden></div>
          <div class="ai-compose">
            <button class="ai-mini" id="aiStickerBtn" type="button" title="表情" aria-label="表情"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5.9" cy="6.6" r=".85" fill="currentColor"/><circle cx="10.1" cy="6.6" r=".85" fill="currentColor"/><path d="M5.4 9.6c.7 1.1 1.6 1.65 2.6 1.65s1.9-.55 2.6-1.65" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
            <button class="ai-mini ${ai.searchMode ? 'on' : ''}" id="aiSearchBtn" type="button" title="搜索模式" aria-label="搜索模式">网</button>
            <textarea id="aiInput" rows="1" placeholder="和薄荷说点什么…"></textarea>
            <button class="btn btn-primary" id="aiSend" type="button">发送</button>
          </div>
          <p class="ai-compose-tip" id="aiComposeTip">
            薄荷是本作为 AI 助手起的名字，与本作虚构的「薄荷中学」无关，也不指向任何现实中的人、组织或产品。回复由 AI 生成，不代表本作立场，也不构成任何法律意见；AI 可能出错，具体内容请注意辨别。涉及事实与政策的部分，请以官方发布为准。
          </p>
        </div>`
      : `
        <div class="ai-empty">
          <b>薄荷还没有接上大脑。</b>
          <p style="margin-top:6px">这个助手需要你自己提供一个 AI 接口，才能说话。填好之后随时可以回来找它。</p>
          <ol>
            <li>打开设置，找到「AI 接口（可选）」。</li>
            <li>接口地址与模型名可以直接点预设，DeepSeek、Agnes（有免费模型）、智谱、通义都能用。</li>
            <li>把拿到的 API Key 粘进去，点「测试连接」看到成功，再回来。</li>
          </ol>
          <button class="btn btn-primary" id="aiToSettings" type="button">去设置里填</button>
          <p class="ai-compose-tip" style="margin-top:12px">
            薄荷是本作为 AI 助手起的名字，与本作虚构的「薄荷中学」无关，也不指向任何现实中的人、组织或产品。本作不构成任何法律意见。
          </p>
        </div>`;

    this.openPanel({ title: '薄荷 · AI 助手', body });
    // 老内核没有 :has()，用显式 class 撑住「面板不滚、聊天区自己滚」的布局
    this.el.panelBody.classList.add('ai-host');

    const toSet = $('#aiToSettings', this.el.panelBody);
    if (toSet) toSet.addEventListener('click', () => {
      this.audio.sfx('click');
      this.openSettings();
    });

    if (!configured) return;

    /* ---- 顶部：列表 / 新建 ---- */
    const sessBtn = $('#aiSessBtn', this.el.panelBody);
    if (sessBtn) sessBtn.addEventListener('click', () => {
      const box = $('#aiSessions', this.el.panelBody);
      const open = box.hidden;
      box.hidden = !open;
      sessBtn.classList.toggle('on', open);
      if (open) this._renderSessions();
      this.audio.sfx('click');
    });
    const newBtn = $('#aiNewBtn', this.el.panelBody);
    if (newBtn) newBtn.addEventListener('click', () => {
      this._aiNew();
      this.audio.sfx('select');
    });

    /* ---- 输入区 ---- */
    const input = $('#aiInput', this.el.panelBody);
    const sendBtn = $('#aiSend', this.el.panelBody);
    if (sendBtn) sendBtn.addEventListener('click', () => this._aiSend());
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        this._aiSend();
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(104, input.scrollHeight)}px`;
      });
      /* 软键盘弹起后把输入框滚进可视区。
         横屏时可视高度只剩两三百像素，输入框很容易被键盘盖住——
         表现就是"点了没反应、打不了字"。这里主动滚一次。 */
      input.addEventListener('focus', () => {
        const keep = () => {
          if (!input.isConnected) return;
          const box = input.closest('.panel-body') || input.parentElement;
          if (box && box.scrollHeight > box.clientHeight) {
            const y = input.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom;
            if (y > 0) box.scrollTop += y + 12;
          }
          if (input.scrollIntoView) {
            try { input.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 老浏览器忽略 */ }
          }
        };
        setTimeout(keep, 260);
        setTimeout(keep, 620);
      });
      if (!TOUCH) setTimeout(() => input.focus(), 120);
    }

    /* 免责声明平时收成一行，点开看全文 */
    const tipEl = $('#aiComposeTip', this.el.panelBody);
    if (tipEl && !tipEl._bound) {
      tipEl._bound = true;
      tipEl.title = tipEl.textContent.trim();
      tipEl.addEventListener('click', () => tipEl.classList.toggle('open'));
    }

    const searchBtn = $('#aiSearchBtn', this.el.panelBody);
    if (searchBtn) searchBtn.addEventListener('click', () => {
      const on = !!(this.settings.ai && this.settings.ai.searchMode);
      this.settings.ai = { ...(this.settings.ai || {}), searchMode: !on };
      this.saveAPI.saveSettings();
      searchBtn.classList.toggle('on', !on);
      const st = $('#acStatus', this.el.panelBody);
      const cur = this.settings.ai;
      if (st) st.textContent = `已接入 ${cur.model}${cur.apiKey ? '' : ' · 未填 Key'} · 搜索${!on ? '开' : '关'}`;
      this.audio.sfx('click');
      const tip = $('#aiComposeTip', this.el.panelBody);
      if (tip) {
        tip.textContent = !on
          ? '搜索模式已开：设置里填了搜索接口的话，会先把查到的资料交给薄荷；没填就只靠模型自己判断。部分接口支持联网，可能额外计费。'
          : '薄荷是本作为 AI 助手起的名字，与本作虚构的「薄荷中学」无关，也不指向任何现实中的人、组织或产品。回复由 AI 生成，不代表本作立场，也不构成任何法律意见；AI 可能出错，具体内容请注意辨别。涉及事实与政策的部分，请以官方发布为准。';
      }
    });

    /* ---- 表情面板 ---- */
    const stBtn = $('#aiStickerBtn', this.el.panelBody);
    const stBox = $('#aiStickers', this.el.panelBody);
    if (stBox) {
      stBox.innerHTML = AI_STICKERS.map(s =>
        `<button class="ai-st" type="button" data-st="${s.id}" title="${escapeHtml(s.label)}">
           <img src="${aiArt(s.id)}" alt="${escapeHtml(s.label)}" loading="lazy" />
         </button>`).join('');
      stBox.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-st]');
        if (!b) return;
        const s = AI_STICKERS.find(x => x.id === b.dataset.st);
        if (!s) return;
        stBox.hidden = true;
        if (stBtn) stBtn.classList.remove('on');
        this._aiSendSticker(s);
      });
    }
    if (stBtn && stBox) stBtn.addEventListener('click', () => {
      stBox.hidden = !stBox.hidden;
      stBtn.classList.toggle('on', !stBox.hidden);
      this.audio.sfx('click');
    });

    this._renderAI();
  }

  /* ---------------- 会话存取 ---------------- */
  _aiLoad() {
    if (this._ai) return;
    let chats = [];
    try {
      const raw = window.localStorage && localStorage.getItem(AI_CHATS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) chats = arr.filter(c => c && Array.isArray(c.msgs));
      }
    } catch (e) { /* 存不了就只在内存里 */ }
    if (!chats.length) chats = [this._aiBlankChat()];
    chats.sort((a, b) => (b.at || 0) - (a.at || 0));
    this._ai = { chats, cur: chats[0].id, busy: false, showSessions: false };
  }

  _aiBlankChat() {
    return {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: '新的对话',
      msgs: [],
      at: Date.now()
    };
  }

  _aiSave() {
    const st = this._ai;
    if (!st) return;
    try {
      // 只留最近 30 段对话、每段 80 条，别把本地存储塞爆
      const slim = st.chats.slice(0, 30).map(c => ({
        id: c.id, title: c.title, at: c.at,
        msgs: c.msgs.slice(-80).map(m => ({ role: m.role, content: m.content, img: m.img || '', err: !!m.err }))
      }));
      localStorage.setItem(AI_CHATS_KEY, JSON.stringify(slim));
    } catch (e) { /* 忽略：存不下不影响当前会话 */ }
  }

  _aiCur() {
    const st = this._ai;
    return st.chats.find(c => c.id === st.cur) || st.chats[0];
  }

  _aiNew() {
    const st = this._ai;
    const fresh = this._aiBlankChat();
    const ai = this.settings.ai || {};
    fresh.msgs.push({
      role: 'assistant',
      content: assistantGreeting({ configured: true, searchMode: !!ai.searchMode })
    });
    st.chats.unshift(fresh);
    st.cur = fresh.id;
    this._aiSave();
    const box = $('#aiSessions', this.el.panelBody);
    if (box) box.hidden = true;
    const sb = $('#aiSessBtn', this.el.panelBody);
    if (sb) sb.classList.remove('on');
    this._renderAI();
  }

  _aiSwitch(id) {
    const st = this._ai;
    if (!st.chats.some(c => c.id === id)) return;
    st.cur = id;
    const box = $('#aiSessions', this.el.panelBody);
    if (box) box.hidden = true;
    const sb = $('#aiSessBtn', this.el.panelBody);
    if (sb) sb.classList.remove('on');
    this.audio.sfx('click');
    this._renderAI();
  }

  _aiDelete(id) {
    const st = this._ai;
    const target = st.chats.find(c => c.id === id);
    if (!target) return;
    this.confirm({
      title: '删除这段对话',
      text: `「${escapeHtml(target.title)}」里的消息会一起删掉，之后找不回来。`,
      okLabel: '删除',
      danger: true,
      onOk: () => {
        st.chats = st.chats.filter(c => c.id !== id);
        if (!st.chats.length) st.chats.push(this._aiBlankChat());
        if (!st.chats.some(c => c.id === st.cur)) st.cur = st.chats[0].id;
        this._aiSave();
        this._renderSessions();
        this._renderAI(true);
      }
    });
  }

  /* ---------------- 渲染 ---------------- */
  _renderSessions() {
    const box = $('#aiSessions', this.el.panelBody);
    if (!box) return;
    const st = this._ai;
    const list = st.chats.map(c => {
      const last = c.msgs[c.msgs.length - 1];
      const desc = !last ? '还没有消息'
        : last.img ? '[表情]'
          : String(last.content || '').replace(/\s+/g, ' ').slice(0, 26);
      return `<div class="ai-sess ${c.id === st.cur ? 'on' : ''}" data-sid="${c.id}" role="button" tabindex="0">
        <span class="ai-sess-main">
          <span class="ai-sess-t">${escapeHtml(c.title)}</span>
          <span class="ai-sess-d">${escapeHtml(relTime(c.at))} · ${escapeHtml(desc)}</span>
        </span>
        <button class="ai-sess-del" data-del="${c.id}" type="button" title="删除">×</button>
      </div>`;
    }).join('');
    box.innerHTML = list || '<p class="ai-sess-empty">还没有对话。</p>';
    box.onclick = (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); this._aiDelete(del.dataset.del); return; }
      const row = e.target.closest('[data-sid]');
      if (row) this._aiSwitch(row.dataset.sid);
    };
  }

  _renderAI(keepScroll) {
    const st = this._ai;
    if (!st) return;
    const cur = this._aiCur();
    const titleEl = $('#acTitle', this.el.panelBody);
    if (titleEl) titleEl.textContent = '薄荷';

    const log = $('#aiLog', this.el.panelBody);
    if (log) {
      if (!cur.msgs.length) {
        const ai = this.settings.ai || {};
        cur.msgs.push({
          role: 'assistant',
          content: assistantGreeting({ configured: true, searchMode: !!ai.searchMode })
        });
      }
      const rows = cur.msgs.map((m) => {
        const me = m.role === 'user';
        const img = m.img ? `<img src="${m.img}" alt="">` : '';
        // 发的是表情就只显示图，文字留给模型看，不重复摆在脸上
        const text = (m.content && !m.img) ? emojiHTML(m.content) : '';
        const cls = `ai-bub${m.err ? ' is-err' : ''}${m.img ? ' has-img' : ''}`;
        return `<div class="ai-msg-row${me ? ' me' : ''}">
          ${me ? '' : '<span class="ai-avatar"></span>'}
          <div class="${cls}">${img}${text}</div>
        </div>`;
      }).join('');
      const typing = st.busy
        ? `<div class="ai-msg-row"><span class="ai-avatar"></span>
             <div class="ai-bub"><span class="ai-typing"><i></i><i></i><i></i></span></div></div>`
        : '';
      log.innerHTML = rows + typing;
      if (!keepScroll || !this._aiScrollLock) log.scrollTop = log.scrollHeight;
    }

    if (st.showSessions) this._renderSessions();
    const input = $('#aiInput', this.el.panelBody);
    if (input && !TOUCH && document.activeElement !== input && !st.busy) input.focus();
  }

  /* ---------------- 发送 ---------------- */
  async _aiSend() {
    const st = this._ai;
    if (!st || st.busy) return;
    const input = $('#aiInput', this.el.panelBody);
    const text = ((input && input.value) || '').trim();
    if (!text) return;
    if (text.length > 800) { this.toast('一次说这么多薄荷记不住，拆开说会好一点', 2000); return; }
    input.value = '';
    input.style.height = 'auto';
    this._aiStickerBtnOff();
    await this._aiAsk({ role: 'user', content: text });
  }

  _aiStickerBtnOff() {
    const box = $('#aiStickers', this.el.panelBody);
    const btn = $('#aiStickerBtn', this.el.panelBody);
    if (box) box.hidden = true;
    if (btn) btn.classList.remove('on');
  }

  async _aiSendSticker(s) {
    const st = this._ai;
    if (!st || st.busy) return;
    this.audio.sfx('select');
    await this._aiAsk({ role: 'user', content: `[发了一个表情：${s.label}]`, img: aiArt(s.id) });
  }

  async _aiAsk(payload) {
    const st = this._ai;
    const cur = this._aiCur();
    cur.msgs.push(payload);
    if (cur.title === '新的对话' && payload.role === 'user' && !payload.img) {
      cur.title = payload.content.replace(/\s+/g, ' ').slice(0, 16) || '新的对话';
    }
    cur.at = Date.now();
    st.busy = true;
    this._aiSave();
    this._renderAI();

    const searchMode = !!(this.settings.ai && this.settings.ai.searchMode);
    let searchText = '';
    if (searchMode && payload.content) {
      const r = await webSearch({ settings: this.settings, query: payload.content });
      if (r.ok) searchText = r.text;
    }

    // 现场快照：不只是"进度"，而是玩家这一秒在干什么
    const liveCtx = this._liveSnapshot();

    const system = buildAssistantSystem({
      searchMode,
      searchUsable: !!searchText,
      live: liveCtx,
      custom: (this.settings.ai && this.settings.ai.chatPrompt) || ''
    });
    const history = cur.msgs
      .filter(m => m.content)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));
    if (searchText && history.length) {
      const last = history[history.length - 1];
      last.content = `${last.content}\n\n【检索到的资料】\n${searchText}\n\n（以上是检索结果，可能不完整也不一定准确，不确定就直说。）`;
    }

    const out = await aiChat({ settings: this.settings, system, messages: history });
    st.busy = false;
    if (out.ok) {
      cur.msgs.push({ role: 'assistant', content: out.text });
    } else {
      cur.msgs.push({
        role: 'assistant',
        content: `（薄荷这边没接通：${out.error}）\n可以到设置里点一次「测试连接」，看看是地址、Key 还是跨域的问题。`,
        err: true
      });
    }
    cur.at = Date.now();
    this._aiSave();
    this._renderAI();
  }

  /* ================= 设置 =================
     分组：阅读 / 声音 / 界面 / AI 接口 / 数据。
     阅读组带一个试读框：改字号和速度当场就能看见效果，不用回游戏里试。 */
  openSettings() {
    const s = this.settings;
    const ai = s.ai || {};
    const speedSeg = CONFIG.textSpeeds.map(x =>
      `<button data-speed="${x.id}" class="${s.textSpeed === x.id ? 'on' : ''}">${x.label}</button>`).join('');
    const scalePct = Math.round((s.dlgScale || 1) * 100);
    const pvLine = '早自习的铃刚响过，走廊里还飘着食堂的味道。';

    // 常用服务的地址与默认模型；点一下就填好，Key 仍要自己去后台拿。
    // 顺序按「国内能直接用 → 要自己搭 → 需要特殊网络」排，前面几个是主流选择。
    // 模型名各家都在变，填错时「拉取列表」能直接看到账号实际能用哪些。
    const presets = [
      { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat',
        tip: '按量付费，充一块钱能用很久。' },
      { id: 'agnes', name: 'Agnes（免费）', base: 'https://apihub.agnes-ai.cn/v1', model: 'agnes-3.0-flash',
        tip: '免费模型有频率限制（据 2026 年 10 月 31 日的情况）。' },
      { id: 'doubao', name: '豆包', base: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1.5-pro-32k',
        tip: '火山方舟的模型名也可以填控制台里那个 ep- 开头的接入点 ID。' },
      { id: 'wenxin', name: '文心', base: 'https://qianfan.baidubce.com/v2', model: 'ernie-4.5-turbo-32k',
        tip: '百度千帆 v2 兼容 OpenAI 协议，模型名以控制台里列出的为准。' },
      { id: 'zhipu', name: '智谱', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash',
        tip: 'glm-4-flash 这个档位有免费额度。' },
      { id: 'moonshot', name: 'Moonshot', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k',
        tip: 'Kimi 的开放平台，长文本模型按 token 计费。' },
      { id: 'qwen', name: '通义', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus',
        tip: '阿里云百炼的「兼容模式」地址，新用户有免费额度。' },
      { id: 'hunyuan', name: '混元', base: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-turbos-latest',
        tip: '腾讯混元，地址里的 v1 不要漏。' },
      { id: 'spark', name: '星火', base: 'https://spark-api-open.xf-yun.com/v1', model: 'generalv3.5',
        tip: '科大讯飞星火，注意这里用的是「OpenAI 兼容」那个地址。' },
      { id: 'silicon', name: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct',
        tip: '聚合了不少开源模型，带几个免费的小模型。' },
      { id: 'ollama', name: '本地 Ollama', base: 'http://localhost:11434/v1', model: 'qwen2.5:7b',
        tip: '本机跑，不用 Key（随便填一个非空字符串即可），要先 ollama serve。' },
      { id: 'openai', name: 'GPT（OpenAI）', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini',
        tip: '需要能直接访问的网络，以及一张能扣外币的卡。' },
      { id: 'claude', name: 'Claude', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5',
        tip: 'Anthropic 也提供 OpenAI 兼容端点，Base URL 填这个就行；同样需要能访问的网络。' },
      { id: 'gemini', name: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash',
        tip: 'Google 的兼容端点，路径末尾要带 /openai。' }
    ];

    const body = `
      <h4 class="set-group-t">阅读</h4>

      <div class="pv-box">
        <span class="pv-name">试读</span>
        <p class="pv-text" id="pvText">${pvLine}</p>
        <div class="pv-bar">
          <button class="btn btn-sm" id="pvPlay" type="button">按当前速度试读</button>
          <span class="pv-meta" id="pvMeta"></span>
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">文字显示速度</div>
        <div class="setting-hint">点击对话框可立即显示整句。改完点一下上面的试读，当场听（看）效果。</div></div>
        <div class="seg" id="speedSeg">${speedSeg}</div>
      </div>

      <div class="setting">
        <div><div class="setting-label">对话字号</div>
        <div class="setting-hint">拖滑块或直接改数字，上面的试读会同步变。只影响对话正文，界面其它字号不动。</div></div>
        <div class="setting-ctl range-row">
          <input type="range" id="dlgScaleRange" min="80" max="160" step="1" value="${scalePct}" />
          <input class="num-in" id="dlgScaleNum" type="number" min="80" max="160" step="1" value="${scalePct}" />
          <span class="range-val" style="min-width:12px">%</span>
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">自动播放速度</div>
        <div class="setting-hint">整句显示之后的停顿时间。</div></div>
        <div class="setting-ctl">
          <input type="range" id="autoSpeed" min="0.5" max="2.5" step="0.25" value="${s.autoSpeed}" />
          <span id="autoSpeedVal" style="font-size:.78rem;color:var(--ink-3);width:38px">${s.autoSpeed}x</span>
        </div>
      </div>

      <h4 class="set-group-t">声音</h4>

      <div class="setting">
        <div><div class="setting-label">音乐</div>
        <div class="setting-hint">切换场景时不会重头播放同一首曲子。</div></div>
        <div class="setting-ctl">
          <button class="toggle ${s.bgmOn ? 'on' : ''}" id="bgmToggle" aria-label="音乐开关"></button>
          <input type="range" id="bgmVol" min="0" max="1" step="0.05" value="${s.bgmVolume}" />
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">音效</div></div>
        <div class="setting-ctl">
          <input type="range" id="sfxVol" min="0" max="1" step="0.05" value="${s.sfxVolume}" />
        </div>
      </div>

      <h4 class="set-group-t">界面</h4>

      <div class="setting">
        <div><div class="setting-label">黑暗模式</div>
        <div class="setting-hint">弹窗、设置、历史这些界面用深色底，和主界面一致。关掉回到纸感的浅色；手机模拟器与政务平台不受影响。</div></div>
        <button class="toggle ${s.nightMode !== false ? 'on' : ''}" id="nightToggle"></button>
      </div>

      <div class="setting">
        <div><div class="setting-label">通透模式<span class="beta-tag">Beta</span></div>
        <div class="setting-hint">全局界面改成半透明模糊的玻璃质感，能看见背后的画面。默认关闭：这是测试功能，低端机和部分 WebView 会掉帧，文字对比度也会比实色底低一档，看不清就关掉它。</div></div>
        <button class="toggle ${s.glassMode ? 'on' : ''}" id="glassToggle"></button>
      </div>

      <div class="setting">
        <div><div class="setting-label">界面动画</div>
        <div class="setting-hint">默认开启。打开时弹窗淡入上浮、菜单与选项依次浮起、对话框从下往上推、立绘说话时轻轻抬一下；关掉只留淡入淡出，立绘也不动。晕动症或很旧的机器可以关。</div></div>
        <button class="toggle ${s.motion !== 'reduced' ? 'on' : ''}" id="motionToggle"></button>
      </div>

      <div class="setting">
        <div><div class="setting-label">画面方向</div>
        <div class="setting-hint">${TOUCH ? '手机上会真的锁住屏幕方向：默认横屏，选了就不会因为你怎么拿而变回去。竖屏时立绘更紧凑，说话的人立在最前面、位置更高。' : '电脑端只有横屏排版；竖屏是为手机准备的，窗口再窄也不会切成竖屏。'}</div></div>
        <div class="seg" id="screenSeg">
          ${(TOUCH ? [['auto', '跟随设备'], ['portrait', '竖屏'], ['landscape', '横屏']] : [['auto', '跟随窗口'], ['landscape', '横屏']]).map(([k, label]) =>
            `<button data-screen="${k}" class="${(s.screenMode || 'auto') === k ? 'on' : ''}">${label}</button>`).join('')}
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">主角性别</div>
        <div class="setting-hint">只换主角立绘，剧情与选项不变。中途随时可以改，改了场上那个「我」会立刻换一套图。</div></div>
        <div class="seg" id="heroSeg">
          ${[['male', '男主'], ['female', '女主']].map(([k, label]) =>
            `<button data-hero="${k}" class="${(s.protagonist === 'female' ? 'female' : 'male') === k ? 'on' : ''}">${label}</button>`).join('')}
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">显示主角立绘</div>
        <div class="setting-hint">第一人称也把「我」画出来。关掉之后，主角说话时不再上台，画面里只剩别人。</div></div>
        <button class="toggle ${s.showPlayerSprite !== false ? 'on' : ''}" id="heroSpriteToggle"></button>
      </div>

      <div class="setting">
        <div><div class="setting-label">显示地点标签</div></div>
        <button class="toggle ${s.showPlaceTag ? 'on' : ''}" id="placeToggle"></button>
      </div>

      <div class="setting">
        <div><div class="setting-label">跳过前先看本节摘要</div>
        <div class="setting-hint">关闭后，按「跳过」直接跳到本节的选择处，不再弹摘要。</div></div>
        <button class="toggle ${s.skipUnreadAsk ? 'on' : ''}" id="skipAskToggle"></button>
      </div>

      <details class="ai-help">
        <summary>界面效果怎么选（通透、动画、画面方向）</summary>
        <div class="ai-help-body">
          <h4>通透模式（Beta）</h4>
          <p>把弹窗、设置这些面板改成半透明模糊的玻璃质感，能透出背后的游戏画面。好看，但有两个代价：</p>
          <ul>
            <li><b>性能</b>：模糊效果靠 GPU 算，低端机和部分 WebView 上会掉帧。卡就关。</li>
            <li><b>可读性</b>：文字浮在模糊底上，对比度比实色底低一档。看不清就关，别硬撑。</li>
          </ul>
          <p>不影响手机模拟器和政务平台——那两处走的是拟真界面，通透模式管不到它们。</p>
          <h4>界面动画</h4>
          <p>控制弹窗淡入上浮、菜单逐项浮起、立绘说话时轻抬等细节动效。关掉只留最基础的淡入淡出。</p>
          <p>两种情况建议关：一是晕动症（快速位移引起不适），二是机器很旧（动画掉帧比没动画更难受）。其余情况开着体验更好。</p>
          <h4>画面方向</h4>
          <ul>
            <li><b>跟随设备 / 跟随窗口</b>：手机竖着拿就用竖屏排版，横过来自动切横屏；电脑窗口拉宽拉窄自动适配。</li>
            <li><b>竖屏</b>：立绘更紧凑，说话的人立在最前面、位置更高。适合单手玩手机。</li>
            <li><b>横屏</b>：画面更宽，立绘排得开。适合平板和电脑。</li>
          </ul>
          <p>手机（APK）上这一栏<b>会真的锁住屏幕方向</b>——选了横屏，屏幕就转过去，不会因为你怎么拿而变回去。电脑上只改排版，不会去动窗口方向。</p>
          <div class="ai-help-note">
            <b>一句话</b>：手机版默认是横屏；想竖着单手玩就切「竖屏」，想跟着手机转就切「跟随设备」。电脑用「跟随窗口」基本不用管。通透和动画看着办，不舒服就关。
          </div>
        </div>
      </details>

      <h4 class="set-group-t">AI 接口（可选）</h4>

      <div class="setting">
        <div><div class="setting-label">启用 AI 接口</div>
        <div class="setting-hint">两处会用到：一是首页/顶栏的 AI 助手「薄荷」，二是政务服务平台里的办理答复。不开就用内置答复，助手也会提示你去配置。剧情、判定、结局一条都不依赖它。</div></div>
        <button class="toggle ${ai.on ? 'on' : ''}" id="aiToggle"></button>
      </div>

      <details class="ai-help">
        <summary>怎么弄到一个 API Key（DeepSeek 几块钱，Agnes 有免费模型）</summary>
        <div class="ai-help-body">
          <h4>一、DeepSeek（按量付费，充一块钱能用很久）</h4>
          <ol>
            <li>打开 <code>platform.deepseek.com</code>，用手机号注册。</li>
            <li>左侧「API keys」→「创建 API key」，名字随便填，复制那串 <code>sk-</code> 开头的字符（只显示一次，关掉就看不到了）。</li>
            <li>「充值」里充 <span class="ai-price">¥1</span> 就够用很久。本作只在生成政务答复时调一次，几百字一条，单次成本不到一分钱。</li>
            <li>回到这里：地址 <code>https://api.deepseek.com/v1</code>，模型 <code>deepseek-chat</code>，把 Key 粘进来，点「测试连接」。</li>
          </ol>
          <h4>二、Agnes（自带免费模型，不用充钱）</h4>
          <ol>
            <li>打开 <code>apihub.agnes-ai.cn</code> 注册，在控制台里创建 API Key。</li>
            <li>据作者在 2026 年 10 月 31 日看到的情况，<code>agnes-2.5-flash</code> 与 <code>agnes-3.0-flash</code> 属于免费模型。</li>
            <li>地址填 <code>https://apihub.agnes-ai.cn/v1</code>，模型可以点「拉取列表」从返回的名单里挑。</li>
            <li>免费额度一般带频率限制，慢一点、偶尔失败都正常；失败时本作会自动换回内置答复，不会卡住流程。</li>
          </ol>
          <h4>三、其它兼容 OpenAI 协议的服务</h4>
          <p>上面那一排预设覆盖了：DeepSeek、Agnes、豆包（火山方舟）、文心（百度千帆）、智谱、Moonshot、通义、混元、星火、硅基流动、本地 Ollama，以及海外的 GPT、Claude、Gemini。点一下就会填好地址和常用模型名，Key 仍然要你自己去各家后台拿。</p>
          <p>海外的三家（GPT / Claude / Gemini）需要能直接访问对应域名的网络，还得有一张能扣外币的卡；国内网络下基本连不上，这时候换回上面任意一家国内的就行。</p>
          <p>模型名各家都在改。填完点「拉取列表」，会把账号实际能用的模型列出来，比记名字可靠得多。</p>
          <div class="ai-help-note">
            <b>说明</b>：这里只是把「去哪儿注册、填什么」写清楚，省得你到处找，不构成任何推荐或担保。价格、免费政策、模型名字都可能随时调整，以各家官网为准；免费模型也可能某天开始收费。<br>
            <b>关于 Key</b>：Key 只存在这台设备的本地存档里，本作不会把它上传到任何服务器；但凡是含 Key 的截图、录屏，发出去之前请先打码。公用电脑上用完，记得点下面的「清空 AI 配置」。
          </div>
        </div>
      </details>

      <details class="ai-help">
        <summary>连不上怎么办 · 常见报错对照</summary>
        <div class="ai-help-body">
          <h4>常见报错对照</h4>
          <dl class="ai-err-list">
            <dt>鉴权失败（401）</dt>
            <dd>Key 错了、过期了，或者复制时多了空格/换行。重新复制一遍 Key，确认是 <code>sk-</code> 开头的完整一串。</dd>
            <dt>接口不存在（404）</dt>
            <dd>接口地址少了 <code>/v1</code>，或者多写了路径。只填到 <code>/v1</code> 为止，不要带 <code>/chat/completions</code>。</dd>
            <dt>模型不可用 / Model Not Exist（400）</dt>
            <dd>模型名过时或拼错了。点「拉取列表」，从账号实际能用的模型里挑一个。</dd>
            <dt>余额不足（402）</dt>
            <dd>账户没钱了。充值，或者换一家服务商。</dd>
            <dt>请求过于频繁（429）</dt>
            <dd>被限流了。等一会儿再试，免费额度尤其容易触发。</dd>
            <dt>无法连接到接口地址</dt>
            <dd>网络不通、域名拼错，或者（安卓端）App 版本太旧没有联网权限。先确认浏览器能打开该域名。</dd>
            <dt>测试成功但回答是空的</dt>
            <dd>多为「思考模式」把输出额度吃光了。到高级参数里关掉思考模式，或者把最大回复长度调大。</dd>
            <dt>请求超时</dt>
            <dd>网络太慢或模型排队。换更快的模型，或者换个网络环境。</dd>
          </dl>
          <h4>没有 Key 会怎样</h4>
          <p>不会怎样，游戏照常玩。这是设计上的硬约束：</p>
          <ul>
            <li><b>薄荷（AI 助手）</b>：不接大脑，它会告诉你去设置里配接口，但不会假装能聊天。</li>
            <li><b>政务答复 / 办理答复</b>：走内置公文稿，内容完整，只是措辞不会随你的提示词变。</li>
            <li><b>接口报错、超时、401</b>：弹出提示（带具体原因），正文自动退回内置稿，不卡流程。</li>
            <li><b>剧情、选择、判定、结局</b>：完全不依赖 AI，离线也能从头玩到结局。</li>
          </ul>
          <div class="ai-help-note">
            <b>说明</b>：以上报错对照整理自常见故障排查经验，实际报错文案以你用的服务商为准。改了配置还是不通，点一次「测试连接」，报错信息里通常写了具体原因。
          </div>
        </div>
      </details>

      <p class="ai-off-tip" id="aiOffTip"${ai.on ? ' hidden' : ''}>AI 接口现在是关闭的。下面这些可以先填好，再把上面的开关打开才会生效。</p>

      <div class="setting-col" id="aiFields">
        <div class="ai-chips" id="aiPresets">
          ${presets.map(p => `<button class="ai-chip" type="button" data-preset="${p.id}">${p.name}</button>`).join('')}
        </div>
        <label>接口地址<input class="ai-input" id="aiBase" spellcheck="false"
          value="${escapeHtml(ai.baseUrl || '')}" placeholder="https://api.deepseek.com/v1"></label>
        <label>模型
          <span class="ai-model-row">
            <input class="ai-input" id="aiModel" spellcheck="false"
              value="${escapeHtml(ai.model || '')}" placeholder="deepseek-chat">
            <button class="btn btn-sm" id="aiFetchModels" type="button">拉取列表</button>
          </span>
        </label>
        <div class="ai-model-box" id="aiModelBox" hidden>
          <div class="ai-model-bar">
            <input class="ai-input ai-model-filter" id="aiModelFilter" spellcheck="false" placeholder="按名字筛选…">
            <span class="ai-model-count" id="aiModelCount"></span>
          </div>
          <div class="ai-model-list" id="aiModelList"></div>
          <p class="ai-model-tip" id="aiModelTip"></p>
        </div>
        <label>API Key
          <input class="ai-input" id="aiKey" type="text" spellcheck="false" autocomplete="off"
            value="${escapeHtml(ai.apiKey || '')}" placeholder="sk-…">
        </label>
        <p class="ai-msg" id="aiKeyWarn">Key 现在是明文显示的，方便核对有没有粘错。截图、录屏、共享屏幕前请先遮住这一行。</p>
        <div class="setting" style="margin-top:12px">
          <div><div class="setting-label">搜索模式（AI 助手用）</div>
          <div class="setting-hint">打开后，助手会先把问题交给搜索接口，把查到的资料一起交给模型再回答。<br>
          这需要接口本身支持联网，或者你在这里填一个搜索服务，可能产生额外费用；两者都没有时，助手会照实说自己查不到。</div></div>
          <button class="toggle ${ai.searchMode ? 'on' : ''}" id="aiSearchToggle"></button>
        </div>
        <label style="display:block;margin-top:10px;font-size:.78rem;color:var(--ink-2)">搜索接口地址（可选，用 {q} 占位查询词）
          <input class="ai-input" id="aiSearchApi" spellcheck="false"
            value="${escapeHtml(ai.searchApi || '')}" placeholder="https://example.com/search?q={q}">
        </label>
        <label style="display:block;margin-top:10px;font-size:.78rem;color:var(--ink-2)">搜索接口 Key（可选）
          <input class="ai-input" id="aiSearchKey" type="text" spellcheck="false" autocomplete="off"
            value="${escapeHtml(ai.searchKey || '')}" placeholder="留空则不带鉴权头">
        </label>
        <p class="ai-help-note" style="margin-top:10px">地址里写 <code>{q}</code>，发出去时会被替换成查询词；接口返回 JSON 时，薄荷会自己挑 answer / summary / results 里像正文的那一段。不填地址，搜索模式就只让模型自己判断要不要联网。</p>
        <details class="ai-help">
          <summary>高级参数（温度、长度、超时、自定义提示词）</summary>
          <div class="ai-help-body">
            <div class="setting">
              <div><div class="setting-label">温度</div>
              <div class="setting-hint">越高措辞越发散，越低越像固定模板。答复类建议 0.7–1.0。</div></div>
              <div class="setting-ctl range-row">
                <input type="range" id="aiTemp" min="0" max="1.5" step="0.05" value="${Number(ai.temperature ?? 0.9)}" />
                <span class="range-val" id="aiTempVal">${Number(ai.temperature ?? 0.9).toFixed(2)}</span>
              </div>
            </div>
            <div class="setting">
              <div><div class="setting-label">最大回复长度</div>
              <div class="setting-hint">单位是 token。答复一般 4–6 段，800 就够；太长只会让模型啰嗦。</div></div>
              <div class="setting-ctl">
                <input class="num-in" id="aiMaxTokens" type="number" min="128" max="4096" step="64" value="${Number(ai.maxTokens || 1000)}" />
              </div>
            </div>
            <div class="setting">
              <div><div class="setting-label">请求超时</div>
              <div class="setting-hint">超过这个时间没回就放弃并换内置答复，避免卡住对话框。</div></div>
              <div class="setting-ctl">
                <input class="num-in" id="aiTimeout" type="number" min="3000" max="60000" step="1000" value="${Number(ai.timeout || 8000)}" />
                <span class="range-val" style="min-width:20px">ms</span>
              </div>
            </div>
            <label style="display:block;margin-top:10px;font-size:.78rem;color:var(--ink-2)">剧情口吻提示词（政务答复等剧情文本生成用）
              <textarea class="ai-area" id="aiSystem" spellcheck="false"
                placeholder="例如：语气更冷淡一点，少用「我们高度重视」这类套话。">${escapeHtml(ai.systemPrompt || '')}</textarea>
            </label>
            <p class="ai-warn">
              <b>注意</b>：这一栏只影响政务答复等剧情文本的措辞风格，不改薄荷聊天的说话方式。
              留空时按内置公文提示走；写重了容易跟剧情的调子打架，改坏了清空即可回到原样。
            </p>
            <label style="display:block;margin-top:14px;font-size:.78rem;color:var(--ink-2)">薄荷自定义提示词（追加在薄荷人设与知识库之后）
              <textarea class="ai-area" id="aiChatPrompt" spellcheck="false"
                placeholder="例如：语气更冷淡一点，少用波浪号和颜文字。">${escapeHtml(ai.chatPrompt || '')}</textarea>
            </label>
            <p class="ai-warn">
              <b>注意</b>：这一栏只影响薄荷聊天，追加在它的人设与内置知识库之后。
              写重了容易和本作的调子打架，比如要求它「不要提剧情」会变得像客服，要求它扮演别的角色会说出跟设定对不上的内容。
              拿不准就留空；改坏了清空即可回到原样。内置知识库（教育政策与合法反映渠道）不可修改。
            </p>
          </div>
        </details>
        <div class="ai-actions">
          <button class="btn btn-sm" id="aiTest">测试连接</button>
          <button class="btn btn-sm" id="aiClear">清空 AI 配置</button>
          <span class="ai-msg" id="aiTestMsg">答复正文会由这个接口生成，其余内容不受影响。</span>
        </div>
      </div>

      <h4 class="set-group-t">数据</h4>

      <details class="ai-help">
        <summary>清档 / 恢复默认 / 清除已读，有什么区别</summary>
        <div class="ai-help-body">
          <h4>三个操作各自管什么</h4>
          <dl class="ai-err-list">
            <dt>清除已读记录</dt>
            <dd>只清「哪些剧情看过」的标记。清完之后所有剧情重新标为未读，方便重新走一遍看选项。<b>不动存档、不动设置</b>。</dd>
            <dt>恢复默认设置</dt>
            <dd>把字号、音量、深色模式、画面方向这些设置项改回出厂值。<b>不动存档、不动已读记录、不动 API Key</b>。改乱了设置又不想重来，用这个。</dd>
            <dt>一键清档</dt>
            <dd>回到来之前从没玩过的状态。删掉：自动存档、全部手动存档、支线存档、已读记录、章节与支线进度、AI 会话记录。<b>不删</b>：设置项、API Key。<b>删了找不回来</b>，没有回收站。</dd>
          </dl>
          <h4>清档前先想想</h4>
          <ul>
            <li>只是想改回设置？→ 用「恢复默认设置」，不够再手动调。</li>
            <li>只是想重看某段剧情？→ 用「清除已读记录」，或者从章节选择里重走。</li>
            <li>真想从头再来？→ 「一键清档」，但会连过三次确认才会真的清，中途任何一次取消都算没发生。</li>
          </ul>
          <div class="ai-help-note">
            <b>注意</b>：清档不删 API Key 和设置项。如果连这些也想清掉，先用「恢复默认设置」，再手动去 AI 区点「清空 AI 配置」。
          </div>
        </div>
      </details>

      <h4 class="set-group-t">存档与设置</h4>

      <div class="setting">
        <div><div class="setting-label">导出存档 / 设置</div>
        <div class="setting-hint">导出成一个 <code>.json</code> 文件，可以备份、换设备继续玩。浏览器会存到「下载」文件夹。</div></div>
        <div class="setting-ctl io-row">
          <button class="btn btn-sm" id="exportSaves">导出存档</button>
          <button class="btn btn-sm" id="exportSettings">导出设置</button>
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">导出当前日志</div>
        <div class="setting-hint">一份纯文本的运行记录：版本、设备、启动流程、报错。遇到问题时导出来，连同截图一起提交，比口头描述准得多。不含任何个人信息。</div></div>
        <div class="setting-ctl io-row">
          <button class="btn btn-sm" id="exportLog">导出日志</button>
        </div>
      </div>

      <div class="setting">
        <div><div class="setting-label">导入存档 / 设置</div>
        <div class="setting-hint">选择之前导出的文件。导入存档会覆盖同名槽位，导入设置会立即生效。</div></div>
        <div class="setting-ctl io-row">
          <button class="btn btn-sm" id="importSaves">导入存档</button>
          <button class="btn btn-sm" id="importSettings">导入设置</button>
        </div>
        <input type="file" id="importFile" accept="application/json,.json" hidden />
      </div>

      <div class="setting">
        <div><div class="setting-label">已读剧情</div>
        <div class="setting-hint">清除后，所有剧情都会被视为未读（不影响存档）。</div></div>
        <button class="btn btn-sm" id="resetRead">清除已读记录</button>
      </div>

      <div class="setting">
        <div><div class="setting-label">恢复默认设置</div>
        <div class="setting-hint">把所有设置项改回出厂值，存档、已读记录、AI 的 Key 之外的进度都不动。</div></div>
        <button class="btn btn-sm" id="resetSettings">恢复默认</button>
      </div>

      <div class="setting setting-danger">
        <div><div class="setting-label">一键清档</div>
        <div class="setting-hint">把自动存档、1–${CONFIG.slots} 号手动存档、支线存档、已读记录、章节与支线进度、AI 会话记录全部删掉，回到从没玩过的状态。<b>清掉之后找不回来</b>，也没有回收站。设置项与 API Key 不受影响。<br>点下去要连过三次确认才会真的清，中途任何一次取消都算没发生。</div></div>
        <button class="btn btn-sm btn-danger" id="wipeAll">清档</button>
      </div>

    `;

    this.openPanel({ title: '设置', body });

    /* ---- 试读：字号与速度都在这一句上试 ---- */
    const pvText = $('#pvText', this.el.panelBody);
    const pvMeta = $('#pvMeta', this.el.panelBody);
    const speedMeta = () => {
      const sp = CONFIG.textSpeeds.find(x => x.id === this.settings.textSpeed) || CONFIG.textSpeeds[1];
      if (pvMeta) pvMeta.textContent = sp.ms === 0 ? '瞬显 · 不打字' : `${sp.ms}ms / 字`;
    };
    speedMeta();
    const playPreview = () => {
      if (!pvText) return;
      clearInterval(this._pvTimer);
      const sp = CONFIG.textSpeeds.find(x => x.id === this.settings.textSpeed) || CONFIG.textSpeeds[1];
      if (sp.ms === 0) { pvText.textContent = pvLine; return; }
      pvText.textContent = '';
      let i = 0;
      this._pvTimer = setInterval(() => {
        if (!pvText.isConnected) { clearInterval(this._pvTimer); return; }
        i += 1;
        pvText.textContent = pvLine.slice(0, i);
        if (i >= pvLine.length) clearInterval(this._pvTimer);
      }, sp.ms);
    };
    const pvBtn = $('#pvPlay', this.el.panelBody);
    if (pvBtn) pvBtn.addEventListener('click', () => { this.audio.sfx('click'); playPreview(); });

    $('#speedSeg', this.el.panelBody).addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]');
      if (!b) return;
      this.settings.textSpeed = b.dataset.speed;
      this.saveAPI.saveSettings();
      this.el.panelBody.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
      this.audio.sfx('click');
      speedMeta();
      playPreview();
    });

    /* ---- 字号：滑块与数字框互相跟随，改完立刻生效 ---- */
    const setScale = (pct) => {
      const v = Math.min(160, Math.max(80, Math.round(Number(pct) || 100)));
      this.settings.dlgScale = v / 100;
      this.saveAPI.saveSettings();
      const r = $('#dlgScaleRange', this.el.panelBody);
      const n = $('#dlgScaleNum', this.el.panelBody);
      if (r && Number(r.value) !== v) r.value = String(v);
      if (n && Number(n.value) !== v) n.value = String(v);
      return v;
    };
    const rangeEl = $('#dlgScaleRange', this.el.panelBody);
    if (rangeEl) rangeEl.addEventListener('input', (e) => setScale(e.target.value));
    const numEl = $('#dlgScaleNum', this.el.panelBody);
    if (numEl) {
      numEl.addEventListener('change', (e) => { e.target.value = String(setScale(e.target.value)); });
      numEl.addEventListener('blur', (e) => { e.target.value = String(setScale(e.target.value)); });
    }

    $('#autoSpeed', this.el.panelBody).addEventListener('input', (e) => {
      this.settings.autoSpeed = Number(e.target.value);
      $('#autoSpeedVal', this.el.panelBody).textContent = `${this.settings.autoSpeed}x`;
      this.saveAPI.saveSettings();
    });

    $('#bgmToggle', this.el.panelBody).addEventListener('click', (e) => {
      this.settings.bgmOn = !this.settings.bgmOn;
      e.currentTarget.classList.toggle('on', this.settings.bgmOn);
      this.saveAPI.saveSettings();
    });

    $('#bgmVol', this.el.panelBody).addEventListener('input', (e) => {
      this.settings.bgmVolume = Number(e.target.value);
      this.saveAPI.saveSettings();
    });

    $('#sfxVol', this.el.panelBody).addEventListener('input', (e) => {
      this.settings.sfxVolume = Number(e.target.value);
      this.saveAPI.saveSettings();
      this.audio.sfx('click');
    });

    $('#skipAskToggle', this.el.panelBody).addEventListener('click', (e) => {
      this.settings.skipUnreadAsk = !this.settings.skipUnreadAsk;
      e.currentTarget.classList.toggle('on', this.settings.skipUnreadAsk);
      this.saveAPI.saveSettings();
    });

    $('#nightToggle', this.el.panelBody).addEventListener('click', (e) => {
      this.settings.nightMode = !(this.settings.nightMode !== false);
      e.currentTarget.classList.toggle('on', this.settings.nightMode);
      this.saveAPI.saveSettings();
    });

    /* 主角性别：换立绘 + 让舞台把场上那个「我」换一套图 */
    const heroSeg = $('#heroSeg', this.el.panelBody);
    if (heroSeg) heroSeg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hero]');
      if (!b) return;
      this.settings.protagonist = b.dataset.hero;
      setProtagonist(this.settings.protagonist);
      this.saveAPI.saveSettings();
      heroSeg.querySelectorAll('[data-hero]').forEach(x => x.classList.toggle('on', x === b));
      if (this.stage && this.stage.refreshPlayerSprite) this.stage.refreshPlayerSprite();
      this.audio.sfx('click');
      this.toast(this.settings.protagonist === 'female' ? '已切换到女主立绘' : '已切换到男主立绘', 1600);
    });

    /* 主角立绘显示开关：关掉要顺手把人撤下台，不然他/她会一直站着 */
    const heroSpriteBtn = $('#heroSpriteToggle', this.el.panelBody);
    if (heroSpriteBtn) heroSpriteBtn.addEventListener('click', (e) => {
      this.settings.showPlayerSprite = this.settings.showPlayerSprite === false;
      e.currentTarget.classList.toggle('on', this.settings.showPlayerSprite);
      this.saveAPI.saveSettings();
      if (this.stage) {
        if (!this.settings.showPlayerSprite) this.stage.hideSprite('lin');
        else this.stage.refreshPlayerSprite();
      }
      this.audio.sfx('click');
    });

    $('#placeToggle', this.el.panelBody).addEventListener('click', (e) => {
      this.settings.showPlaceTag = !this.settings.showPlaceTag;
      e.currentTarget.classList.toggle('on', this.settings.showPlaceTag);
      this.saveAPI.saveSettings();
    });

    const motionBtn = $('#motionToggle', this.el.panelBody);
    if (motionBtn) motionBtn.addEventListener('click', (e) => {
      const turningOn = this.settings.motion === 'reduced';
      this.settings.motion = turningOn ? 'full' : 'reduced';
      e.currentTarget.classList.toggle('on', turningOn);
      document.body.classList.toggle('motion-off', !turningOn);
      this.saveAPI.saveSettings();
      this.audio.sfx('click');
      if (!turningOn) this.toast('界面动画已关闭', 1600);
    });

    // 通透模式（Beta）：只切 class，具体玻璃效果全在样式里
    const glassBtn = $('#glassToggle', this.el.panelBody);
    if (glassBtn) glassBtn.addEventListener('click', (e) => {
      this.settings.glassMode = !this.settings.glassMode;
      e.currentTarget.classList.toggle('on', this.settings.glassMode);
      this.saveAPI.saveSettings();
      this.audio.sfx('click');
      if (this.settings.glassMode) this.toast('通透模式已开启 · Beta，卡顿就关掉它', 2600);
    });

    const screenSeg = $('#screenSeg', this.el.panelBody);
    if (screenSeg) screenSeg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-screen]');
      if (!b) return;
      this.settings.screenMode = b.dataset.screen;
      this.saveAPI.saveSettings();
      screenSeg.querySelectorAll('[data-screen]').forEach(x => x.classList.toggle('on', x === b));
      this.audio.sfx('click');
      if (typeof this.onScreenModeChange === 'function') this.onScreenModeChange();
    });

    /* ---- 存档 / 设置 的导入导出 ----
       APK 与 EXE 里都是同一套 localStorage，所以直接用"扫一遍键值对"的方式导出，
       既不用给每个槽位写单独的序列化，也不会漏掉新加的键。
       网页端没有文件系统，走浏览器下载；客户端同样是下载到系统默认下载目录，
       再在文件管理器里挪到 Download 就好。 */
    const IO_PREFIX_SAVE = ['zb_slot', 'zb_side', 'zb_progress', 'zb_read'];
    const IO_PREFIX_SET = ['zb_settings', 'zb_ai'];

    const dumpKeys = (prefixes) => {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (prefixes.some(p => k.startsWith(p))) out[k] = localStorage.getItem(k);
        }
      } catch (e) { /* 存不了就导空 */ }
      return out;
    };

    /* 导出：文本先交给客户端写「下载」目录，网页端走浏览器下载。
       APK 里 WebView 没有下载监听器，<a download> 点了没反应——
       所以客户端那边专门开了一个 saveText 桥。 */
    const saveText = (text, name, mime) => {
      // 1 原生桥（APK）
      try {
        if (window.ZBApp && typeof window.ZBApp.saveText === 'function') {
          const where = window.ZBApp.saveText(name, text);
          if (where) { this.toast('已保存到 ' + where, 3000); return true; }
        }
      } catch (e) { /* 落到浏览器下载 */ }
      // 2 浏览器下载（网页版 / EXE）
      try {
        const blob = new Blob([text], { type: mime || 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        this.toast('已导出：' + name, 2600);
        return true;
      } catch (e) {
        this.toast('导出失败：这个环境不允许下载文件', 2800);
        return false;
      }
    };
    const download = (obj, name) => saveText(JSON.stringify(obj, null, 2), name, 'application/json');

    const stamp = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    };

    const exportSaves = $('#exportSaves', this.el.panelBody);
    if (exportSaves) exportSaves.addEventListener('click', () => {
      audio.sfx('click');
      download({ v: 1, kind: 'saves', at: Date.now(), keys: dumpKeys(IO_PREFIX_SAVE) },
        `不属于我的周末-存档-${stamp()}.json`);
    });
    const exportSettings = $('#exportSettings', this.el.panelBody);
    if (exportSettings) exportSettings.addEventListener('click', () => {
      audio.sfx('click');
      download({ v: 1, kind: 'settings', at: Date.now(), keys: dumpKeys(IO_PREFIX_SET) },
        `不属于我的周末-设置-${stamp()}.json`);
    });

    const exportLogBtn = $('#exportLog', this.el.panelBody);
    if (exportLogBtn) exportLogBtn.addEventListener('click', () => {
      audio.sfx('click');
      const text = dumpLog();
      saveText(text, `不属于我的周末-日志-${stamp()}.txt`, 'text/plain');
    });

    const fileInput = $('#importFile', this.el.panelBody);
    let importKind = 'saves';
    const pickFile = (kind) => {
      importKind = kind;
      if (!fileInput) { this.toast('这个环境不支持选择文件', 2400); return; }
      fileInput.value = '';
      fileInput.click();
    };
    const importSaves = $('#importSaves', this.el.panelBody);
    if (importSaves) importSaves.addEventListener('click', () => { audio.sfx('click'); pickFile('saves'); });
    const importSettings = $('#importSettings', this.el.panelBody);
    if (importSettings) importSettings.addEventListener('click', () => { audio.sfx('click'); pickFile('settings'); });

    if (fileInput) fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        let data = null;
        try { data = JSON.parse(String(reader.result)); } catch (e) { data = null; }
        if (!data || !data.keys || typeof data.keys !== 'object') {
          this.toast('文件读不出来，可能不是本作导出的存档', 3000);
          return;
        }
        if (data.kind && data.kind !== importKind) {
          this.toast(`这是「${data.kind === 'settings' ? '设置' : '存档'}」文件，当前要导入的是「${importKind === 'settings' ? '设置' : '存档'}」`, 3200);
          return;
        }
        let n = 0;
        try {
          Object.keys(data.keys).forEach(k => {
            // 只接受本作自己的键，避免把别的东西写进存储
            if (!/^zb_/.test(k)) return;
            localStorage.setItem(k, data.keys[k]);
            n++;
          });
        } catch (e) { /* 写不进就报下面那句 */ }
        if (!n) { this.toast('文件里没有可导入的内容', 2600); return; }
        audio.sfx('ok');
        this.toast(`已导入 ${n} 项，正在重新载入…`, 1800);
        setTimeout(() => location.reload(), 900);
      };
      reader.onerror = () => this.toast('读取文件失败', 2400);
      reader.readAsText(f);
    });

    $('#resetRead', this.el.panelBody).addEventListener('click', () => {
      this.saveAPI.resetRead();
      this.toast('已清除已读记录');
    });

    /* ---- 恢复默认设置：问一次，别让人手滑把调好的设置清掉 ---- */
    const resetSet = $('#resetSettings', this.el.panelBody);
    if (resetSet) resetSet.addEventListener('click', () => {
      this.confirm({
        title: '恢复默认设置',
        text: '所有设置项会回到出厂值：字号、速度、音量、黑暗模式、画面方向、AI 接口配置（含 Key）都会清掉。<br>存档、已读记录、剧情进度不受影响。',
        okLabel: '恢复默认',
        danger: true,
        onOk: () => {
          if (typeof this.saveAPI.resetSettings === 'function') this.saveAPI.resetSettings();
          // 重画面板，让控件回到默认位置
          this.openSettings();
          this.toast('设置已恢复默认');
        }
      });
    });

    /* ---- 一键清档：三遍确认 ------------------------------------------
       清档是不可逆的，所以不给「一步到位」的机会：
         第一遍说清会删哪些东西；
         第二遍说清删了就没了、没有回收站；
         第三遍才出现那个真正动手的按钮。
       三遍都不认回车，只认点按钮——按住回车一路清干净这种事不该发生。
       清完直接把这一局停掉回到标题页：留在游戏里的话，
       引擎下一次自动存档会立刻写回一份新档，「清档」就白清了。 */
    const wipeBtn = $('#wipeAll', this.el.panelBody);
    if (wipeBtn) wipeBtn.addEventListener('click', () => {
      this.audio.sfx('click');
      const finalStep = () => this.confirm({
        title: '清档（3 / 3）· 最后确认',
        text: `点下这个按钮，上面的东西就真的没了。<br>
              清完会直接回到标题页，从没玩过那样。<br><br>
              <b>还留着的东西</b>：设置项、AI 的地址与 Key。` +
              `<br>如果你连这些也想清掉，用上面的「恢复默认设置」。`,
        okLabel: '确认清档',
        cancelLabel: '不清了',
        danger: true,
        enter: false,
        onOk: () => {
          const n = typeof this.saveAPI.wipeAll === 'function' ? this.saveAPI.wipeAll() : 0;
          // 先回标题页再提示：面板会被一起收掉，toast 挂在最上层
          this.saveAPI.backToTitle();
          this.toast(n ? `已清档 · 删掉 ${n} 项记录` : '已清档', 2400);
        }
      });
      const secondStep = () => this.confirm({
        title: '清档（2 / 3）· 后果',
        text: `清掉之后<b>找不回来</b>：没有回收站，没有备份，也没有「撤销」。<br>
              手滑清掉又重新玩一遍，是唯一的办法。<br><br>
              如果只是想重新走一遍某一条支线，不用清档——支线有自己的存档位，<br>
              想换个名字重开，可以用「开始新游戏」。`,
        okLabel: '我知道了，继续',
        cancelLabel: '取消',
        danger: true,
        enter: false,
        onOk: finalStep
      });
      const firstStep = () => this.confirm({
        title: '清档（1 / 3）· 会删掉什么',
        text: `这会删掉：<br>
              · 自动存档，以及 1–${CONFIG.slots} 号全部手动存档<br>
              · 每条支线自己的存档<br>
              · 已读记录、章节进度与支线成绩<br>
              · 薄荷的会话记录<br><br>
              设置项、AI 的地址与 Key <b>不会</b>被删。`,
        okLabel: '继续',
        cancelLabel: '算了',
        enter: false,
        onOk: secondStep
      });
      firstStep();
    });

    /* ---- AI 接口 ---- */
    const collectAI = () => {
      ['#aiBase|baseUrl', '#aiModel|model', '#aiKey|apiKey'].forEach(pair => {
        const [sel, key] = pair.split('|');
        const el = $(sel, this.el.panelBody);
        if (el) this.settings.ai = { ...(this.settings.ai || {}), [key]: el.value.trim() };
      });
      const sys = $('#aiSystem', this.el.panelBody);
      if (sys) this.settings.ai = { ...(this.settings.ai || {}), systemPrompt: sys.value.trim() };
      const chat = $('#aiChatPrompt', this.el.panelBody);
      if (chat) this.settings.ai = { ...(this.settings.ai || {}), chatPrompt: chat.value.trim() };
      const temp = $('#aiTemp', this.el.panelBody);
      if (temp) this.settings.ai = { ...(this.settings.ai || {}), temperature: Number(temp.value) };
      const mt = $('#aiMaxTokens', this.el.panelBody);
      if (mt) this.settings.ai = { ...(this.settings.ai || {}), maxTokens: Number(mt.value) };
      const to = $('#aiTimeout', this.el.panelBody);
      if (to) this.settings.ai = { ...(this.settings.ai || {}), timeout: Number(to.value) };
      this.saveAPI.saveSettings();
    };

    const aiToggle = $('#aiToggle', this.el.panelBody);
    if (aiToggle) aiToggle.addEventListener('click', (e) => {
      this.settings.ai = { ...(this.settings.ai || {}), on: !(this.settings.ai && this.settings.ai.on) };
      e.currentTarget.classList.toggle('on', this.settings.ai.on);
      this.saveAPI.saveSettings();
      const fields = $('#aiFields', this.el.panelBody);
      if (fields) fields.classList.toggle('is-off', !this.settings.ai.on);
      const offTip = $('#aiOffTip', this.el.panelBody);
      if (offTip) offTip.hidden = !!this.settings.ai.on;
    });
    const aiFields = $('#aiFields', this.el.panelBody);
    if (aiFields && !(this.settings.ai && this.settings.ai.on)) aiFields.classList.add('is-off');

    // 预设：一次填好地址与模型名，并闪一下输入框，避免"点了没反应"的错觉
    const presetBox = $('#aiPresets', this.el.panelBody);
    if (presetBox) presetBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const p = presets.find(x => x.id === b.dataset.preset);
      if (!p) return;
      const baseEl = $('#aiBase', this.el.panelBody);
      const modelEl = $('#aiModel', this.el.panelBody);
      if (baseEl) { baseEl.value = p.base; baseEl.classList.remove('flash'); void baseEl.offsetWidth; baseEl.classList.add('flash'); }
      if (modelEl) { modelEl.value = p.model; modelEl.classList.remove('flash'); void modelEl.offsetWidth; modelEl.classList.add('flash'); }
      this.settings.ai = { ...(this.settings.ai || {}), baseUrl: p.base, model: p.model };
      this.saveAPI.saveSettings();
      presetBox.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
      const tip = $('#aiTestMsg', this.el.panelBody);
      if (tip) {
        tip.textContent = `已填好 ${p.name} 的地址与模型${p.tip ? '（' + p.tip + '）' : ''}，接着填 API Key 就能测试。`;
        tip.className = 'ai-msg ok';
      }
      this.audio.sfx('click');
    });

    const bindAI = (id, key) => {
      const el = $(id, this.el.panelBody);
      if (!el) return;
      el.addEventListener('change', () => {
        this.settings.ai = { ...(this.settings.ai || {}), [key]: el.value.trim() };
        this.saveAPI.saveSettings();
      });
    };
    bindAI('#aiBase', 'baseUrl');
    bindAI('#aiModel', 'model');
    bindAI('#aiKey', 'apiKey');

    const tempEl = $('#aiTemp', this.el.panelBody);
    if (tempEl) tempEl.addEventListener('input', () => {
      const v = Number(tempEl.value);
      const label = $('#aiTempVal', this.el.panelBody);
      if (label) label.textContent = v.toFixed(2);
      this.settings.ai = { ...(this.settings.ai || {}), temperature: v };
      this.saveAPI.saveSettings();
    });
    const searchToggle = $('#aiSearchToggle', this.el.panelBody);
    if (searchToggle) searchToggle.addEventListener('click', (e) => {
      const on = !(this.settings.ai && this.settings.ai.searchMode);
      this.settings.ai = { ...(this.settings.ai || {}), searchMode: on };
      e.currentTarget.classList.toggle('on', on);
      this.saveAPI.saveSettings();
      this.audio.sfx('click');
    });
    ['#aiSearchApi|searchApi', '#aiSearchKey|searchKey'].forEach(pair => {
      const [sel, key] = pair.split('|');
      const el = $(sel, this.el.panelBody);
      if (!el) return;
      el.addEventListener('change', () => {
        this.settings.ai = { ...(this.settings.ai || {}), [key]: el.value.trim() };
        this.saveAPI.saveSettings();
      });
    });

    ['#aiMaxTokens|maxTokens', '#aiTimeout|timeout', '#aiSystem|systemPrompt', '#aiChatPrompt|chatPrompt'].forEach(pair => {
      const [sel, key] = pair.split('|');
      const el = $(sel, this.el.panelBody);
      if (!el) return;
      el.addEventListener('change', () => {
        const val = (key === 'systemPrompt' || key === 'chatPrompt') ? el.value.trim() : Number(el.value);
        this.settings.ai = { ...(this.settings.ai || {}), [key]: val };
        this.saveAPI.saveSettings();
      });
    });

    /* ---- 拉取模型列表 ---- */
    const fetchBtn = $('#aiFetchModels', this.el.panelBody);
    if (fetchBtn) fetchBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      collectAI();

      const box = $('#aiModelBox', this.el.panelBody);
      const list = $('#aiModelList', this.el.panelBody);
      const count = $('#aiModelCount', this.el.panelBody);
      const tip = $('#aiModelTip', this.el.panelBody);
      box.hidden = false;
      list.innerHTML = '';
      count.textContent = '';
      tip.textContent = '正在读取模型列表…';
      tip.className = 'ai-model-tip';
      fetchBtn.disabled = true;

      const r = await aiListModels({ settings: this.settings });
      fetchBtn.disabled = false;

      if (!r.ok) {
        tip.textContent = r.error;
        tip.className = 'ai-model-tip bad';
        return;
      }
      if (!r.count) {
        tip.textContent = '接口通了，但这个地址没有返回任何模型。可以直接在输入框里手填模型名。';
        tip.className = 'ai-model-tip bad';
        return;
      }

      const modelInput = $('#aiModel', this.el.panelBody);
      const cur = (modelInput && modelInput.value) || '';
      count.textContent = `${r.count} 个`;
      tip.textContent = '点一个，会自动填进上面的模型输入框。';
      tip.className = 'ai-model-tip';

      const render = (kw) => {
        const k = (kw || '').trim().toLowerCase();
        const items = r.list.filter(m => !k || m.id.toLowerCase().indexOf(k) >= 0);
        list.innerHTML = items.length
          ? items.map(m => `<button class="ai-model-item${m.id === cur ? ' on' : ''}" type="button" data-model="${escapeHtml(m.id)}">
               <span class="amm-id">${escapeHtml(m.id)}</span>
               ${m.owned ? `<span class="amm-own">${escapeHtml(m.owned)}</span>` : ''}
             </button>`).join('')
          : '<p class="ai-model-empty">没有匹配的模型。</p>';
        count.textContent = k ? `${items.length} / ${r.count}` : `${r.count} 个`;
      };
      render('');

      list.onclick = (ev) => {
        const b = ev.target.closest('[data-model]');
        if (!b) return;
        const id = b.dataset.model;
        const input = $('#aiModel', this.el.panelBody);
        if (!input) return;
        // 既改 DOM 也改设置：只改一边的话，切走再回来就会退回旧名字
        input.value = id;
        input.classList.remove('flash');
        void input.offsetWidth;
        input.classList.add('flash');
        // 列表在下面，填完把视线带回去，不然看起来像「点了没反应」
        if (typeof input.scrollIntoView === 'function') {
          input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        this.settings.ai = { ...(this.settings.ai || {}), model: id };
        this.saveAPI.saveSettings();
        list.querySelectorAll('[data-model]').forEach(x => x.classList.toggle('on', x === b));
        tip.textContent = `已填入模型 ${id}`;
        tip.className = 'ai-model-tip ok';
        this.audio.sfx('click');
      };

      const filter = $('#aiModelFilter', this.el.panelBody);
      if (filter) {
        filter.oninput = () => render(filter.value);
        filter.onkeydown = (ev) => {
          if (ev.key !== 'Enter') return;
          ev.preventDefault();
          const first = list.querySelector('[data-model]');
          if (first) first.click();
        };
      }
    });

    const aiTest = $('#aiTest', this.el.panelBody);
    if (aiTest) aiTest.addEventListener('click', async () => {
      const msg = $('#aiTestMsg', this.el.panelBody);
      collectAI();
      if (msg) { msg.textContent = '正在连接…'; msg.className = 'ai-msg'; }
      const t0 = Date.now();
      const out = await aiComplete({
        settings: { ai: { ...(this.settings.ai || {}), on: true } },
        system: '你是一个测试助手。只回四个字。',
        prompt: '请只回复：连接成功',
        timeout: 15000
      });
      const ms = Date.now() - t0;
      if (msg) {
        if (out) { msg.textContent = `连接成功 · ${ms}ms · 返回「${out.slice(0, 16)}」`; msg.className = 'ai-msg ok'; }
        else { msg.textContent = `连接失败（${ms}ms）：检查地址、Key 与网络；浏览器环境还要求接口允许跨域。不填也能正常游玩。`; msg.className = 'ai-msg bad'; }
      }
    });

    const aiClear = $('#aiClear', this.el.panelBody);
    if (aiClear) aiClear.addEventListener('click', () => {
      this.confirm({
        title: '清空 AI 配置',
        text: '接口地址、模型名、API Key、剧情口吻与薄荷自定义提示词都会被清掉，AI 开关一并关闭。<br>存档与剧情进度不受影响，之后随时可以再填。',
        okLabel: '清空',
        danger: true,
        onOk: () => {
          this.settings.ai = JSON.parse(JSON.stringify(CONFIG.defaultSettings.ai || {}));
          this.saveAPI.saveSettings();
          this.openSettings();
          this.toast('AI 配置已清空');
        }
      });
    });

  }

  /* ================= 继续游戏 / 时间轴 =================
     两级：
       一级——先选第几章（章卡片，只列走过的）
       二级——该章的横向时间轴 + 分支（选择点）
     时间轴是"回看"，不是"预告"：没走到的地点、没做过的选择一律不出现。 */
  openContinue({ hasSave, resumeLabel, chapters, sides, onResume, onSide, onChapter }) {
    this._cont = { hasSave, resumeLabel, chapters: chapters || [], sides: sides || [], onResume, onSide, onChapter, chId: null };
    this.openPanel({ title: '继续游戏', narrow: true, body: '' });
    this._renderContinue();
  }

  /** 重画面板主体（一级 / 二级共用同一个面板，不重新弹） */
  _renderContinue() {
    const st = this._cont;
    if (!st) return;
    const body = this.el.panelBody;
    const chapter = st.chId ? st.chapters.find(c => c.id === st.chId) : null;
    body.innerHTML = chapter ? this._continueChapterHtml(chapter) : this._continueListHtml();
    this._bindContinue(chapter);
  }

  _continueListHtml() {
    const st = this._cont;
    const chapters = st.chapters;
    const doneCount = chapters.filter(c => c.state === 'done').length;

    const head = st.hasSave
      ? `<button class="cont-resume" id="contResume">
           <span class="cr-ico"><img src="assets/icons/hyperos/continue.webp" alt="" loading="lazy" /></span>
           <span class="cr-txt">
             <b>回到上次的位置</b>
             <i>${escapeHtml(st.resumeLabel || '上次进度')}</i>
           </span>
           <span class="cr-go" aria-hidden="true">›</span>
         </button>`
      : `<div class="cont-empty">
           <p>还没有可以继续的进度。</p>
           <p class="cont-empty-sub">从标题页选「开始游戏」，从序章走起。</p>
         </div>`;

    const cards = chapters.length
      ? chapters.map((c, i) => {
          const walked = c.scenes.length;
          const meta = [
            walked ? `走过 ${walked} 个场景` : '刚开始',
            c.branchCount ? `${c.branchCount} 个选择点` : ''
          ].filter(Boolean).join(' · ');
          return `
            <button class="cont-ch" type="button" data-ch="${escapeHtml(c.id)}">
              <span class="cc-no">${String(i + 1).padStart(2, '0')}</span>
              <span class="cc-main">
                <span class="cc-title">${escapeHtml(c.title)}${c.name ? ` · ${escapeHtml(c.name)}` : ''}</span>
                <span class="cc-meta">${escapeHtml(c.dayLabel || '')}${c.dayLabel ? ' · ' : ''}${meta}</span>
              </span>
              <span class="cc-state ${c.state === 'done' ? 'is-done' : 'is-now'}">${c.state === 'done' ? '已通关' : '进行中'}</span>
              <span class="cc-go" aria-hidden="true">›</span>
            </button>`;
        }).join('')
      : `<div class="cont-empty"><p>还没有走过任何一章。</p>
         <p class="cont-empty-sub">走完一章，这里就会出现它的时间轴。</p></div>`;

    const sideHtml = st.sides.length ? `
      <h4 class="tl-sec">支线 <span class="tl-count">点一条可以再走一遍</span></h4>
      <div class="cont-sides">
        ${st.sides.map(s => `
          <button class="cont-side" type="button" data-side="${escapeHtml(s.id)}">
            <span class="cs-name">${escapeHtml(s.title)}</span>
            <span class="cs-meta">${s.count ? `走过 ${s.count} 次 · ${escapeHtml(s.lastName || '已记录')}` : '走过一次'}</span>
            <span class="cs-go" aria-hidden="true">›</span>
          </button>`).join('')}
      </div>` : '';

    return `
      ${head}
      <h4 class="tl-sec">章节 <span class="tl-count">已通关 ${doneCount} 章 · 点一章看它自己的时间轴</span></h4>
      <div class="cont-chapters">${cards}</div>
      ${sideHtml}
      <p class="tl-note">这里只记录已经发生的事；还没走到的章节与选择，都不会提前显示。</p>`;
  }

  _continueChapterHtml(ch) {
    const scenes = ch.scenes;
    // 每个场景都带 nodeAt（剧本里的节点下标），点它就能从那里接着走。
    // 这一页的用途本来就是「回去看别的分支和结局」，只能看不能进等于没用。
    const nodes = scenes.length
      ? scenes.map((s, i) => `
          <li class="tlx-node ${s.branches.length ? 'has-branch' : ''} is-${s.read ? 'seen' : 'part'} is-jump"
              ${Number.isFinite(s.nodeAt) ? `data-jump="${s.nodeAt}" role="button" tabindex="0" aria-label="从第 ${i + 1} 个场景继续"` : ''}>
            <span class="tlx-dot" aria-hidden="true"></span>
            <span class="tlx-idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="tlx-place">${escapeHtml(s.place)}</span>
            <span class="tlx-tag">${s.read ? '走过' : '到过边缘'}</span>
            ${s.branches.length ? `
            <ul class="tlx-kids">
              ${s.branches.map(b => `
                <li class="tlx-kid">
                  <span class="tk-q">${escapeHtml(b.prompt)}</span>
                  <span class="tk-opts">
                    ${b.options.map(o => `<i class="tk-opt">${escapeHtml(o)}</i>`).join('')}
                  </span>
                </li>`).join('')}
            </ul>` : ''}
          </li>`).join('')
      : `<li class="tlx-empty">这一章还没有走出一个完整的场景。</li>`;

    return `
      <div class="cont-crumb">
        <button class="crumb-back" type="button" data-back="1">‹ 全部章节</button>
        <span class="crumb-now">${escapeHtml(ch.title)}${ch.name ? ` · ${escapeHtml(ch.name)}` : ''}</span>
      </div>

      <div class="cont-enter">
        <button class="btn btn-primary cont-enter-btn" type="button" data-enter="0">从这一章开头重玩</button>
        <span class="cont-enter-hint">已读记录会留着，选项可以重选；想换一种走法就从头再来一遍。</span>
      </div>

      <h4 class="tl-sec">时间轴 <span class="tl-count">${escapeHtml(ch.dayLabel || '')}${
        ch.dayLabel ? ' · ' : ''}走过 ${scenes.length} 个场景 · ${ch.branchCount} 个选择点</span></h4>
      <div class="tlx" id="tlx">
        <ol class="tlx-track">
          ${nodes}
          <li class="tlx-node is-future">
            <span class="tlx-dot" aria-hidden="true"></span>
            <span class="tlx-place">后面的事，走到那里才知道</span>
          </li>
        </ol>
      </div>
      <div class="tlx-bar" id="tlxBar" role="scrollbar" aria-label="时间轴位置">
        <span class="tlx-thumb" id="tlxThumb"></span>
      </div>

      <p class="tl-note">点任意一个场景，就从那里接着走——之前的选择不用重做。拖动下面的滑块，或按住时间轴左右拖，可以看后面的场景。</p>`;
  }

  _bindContinue(chapter) {
    const body = this.el.panelBody;
    // 上一次渲染挂的窗口监听要先摘掉，不然切章几次会叠一堆
    if (this._tlxResize) { window.removeEventListener('resize', this._tlxResize); this._tlxResize = null; }

    const resume = $('#contResume', body);
    if (resume) resume.addEventListener('click', () => {
      this.audio.sfx('select');
      this.closePanel();
      this._cont.onResume();
    });

    // 一级：点章卡片进二级
    body.querySelectorAll('[data-ch]').forEach(b => {
      b.addEventListener('click', () => {
        this.audio.sfx('select');
        this._cont.chId = b.dataset.ch;
        this._renderContinue();
        body.scrollTop = 0;
      });
    });

    // 二级：返回一级
    body.querySelectorAll('[data-back]').forEach(b => {
      b.addEventListener('click', () => {
        this.audio.sfx('click');
        this._cont.chId = null;
        this._renderContinue();
        body.scrollTop = 0;
      });
    });

    // 支线：直接从路口再走一遍
    body.querySelectorAll('[data-side]').forEach(b => {
      b.addEventListener('click', () => {
        this.audio.sfx('select');
        const id = b.dataset.side;
        const fn = this._cont.onSide;
        this.closePanel();
        if (typeof fn === 'function') fn(id);
      });
    });

    // 进章节：从开头，或点时间轴上的某个场景从那里接上
    const enterChapter = (nodeAt = 0, label = '') => {
      const fn = this._cont.onChapter;
      if (typeof fn !== 'function' || !this._cont.chId) return;
      const chId = this._cont.chId;
      this.closePanel();
      fn(chId, nodeAt, label);
    };
    body.querySelectorAll('[data-enter]').forEach(b => {
      b.addEventListener('click', () => { this.audio.sfx('select'); enterChapter(0); });
    });
    body.querySelectorAll('[data-jump]').forEach(b => {
      const placeEl = b.querySelector('.tlx-place');
      const label = placeEl ? placeEl.textContent.trim() : '';
      const goFrom = () => {
        this.audio.sfx('select');
        enterChapter(Number(b.dataset.jump) || 0, label);
      };
      b.addEventListener('click', goFrom);
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goFrom(); }
      });
    });

    // 横向时间轴：滚轮换成横滑，另配一条可见的拖动条
    const tlx = $('#tlx', body);
    if (tlx) {
      tlx.addEventListener('wheel', (e) => {
        if (!e.deltaY) return;
        if (tlx.scrollWidth <= tlx.clientWidth) return;
        e.preventDefault();
        tlx.scrollLeft += e.deltaY;
      }, { passive: false });

      const bar = $('#tlxBar', body);
      const thumb = $('#tlxThumb', body);
      if (bar && thumb) {
        const sync = () => {
          const max = tlx.scrollWidth - tlx.clientWidth;
          if (max <= 6) { bar.classList.remove('on'); return; }
          bar.classList.add('on');
          const trackW = bar.clientWidth;
          const w = Math.max(36, Math.round(trackW * tlx.clientWidth / tlx.scrollWidth));
          const x = (tlx.scrollLeft / max) * (trackW - w);
          thumb.style.width = `${w}px`;
          thumb.style.transform = `translateX(${x}px)`;
        };
        this._tlxSync = sync;
        tlx.addEventListener('scroll', sync);
        this._tlxResize = sync;
        window.addEventListener('resize', sync);

        // 拖动滑块
        let dragging = false, startX = 0, startLeft = 0;
        thumb.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          dragging = true; startX = e.clientX; startLeft = tlx.scrollLeft;
          thumb.classList.add('grab');
          try { thumb.setPointerCapture(e.pointerId); } catch (err) { /* 老 WebView 没有就算了 */ }
        });
        thumb.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          const max = tlx.scrollWidth - tlx.clientWidth;
          const travel = Math.max(1, bar.clientWidth - thumb.offsetWidth);
          tlx.scrollLeft = startLeft + (e.clientX - startX) * (max / travel);
        });
        const stop = () => { dragging = false; thumb.classList.remove('grab'); };
        thumb.addEventListener('pointerup', stop);
        thumb.addEventListener('pointercancel', stop);

        // 点轨道直接跳过去
        bar.addEventListener('pointerdown', (e) => {
          if (e.target === thumb) return;
          const r = bar.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          tlx.scrollLeft = ratio * (tlx.scrollWidth - tlx.clientWidth);
        });

        // 打开时把镜头对准最后走过的那个场景：
        // 直接滚到最右会切出半个卡片，反而看不出自己在哪。
        requestAnimationFrame(() => {
          const walked = tlx.querySelectorAll('.tlx-node:not(.is-future)');
          const last = walked[walked.length - 1];
          const max = Math.max(0, tlx.scrollWidth - tlx.clientWidth);
          tlx.scrollLeft = last ? Math.min(max, Math.max(0, last.offsetLeft - 10)) : max;
          sync();
        });
      }
    }

    if (chapter) {
      const h = $('.crumb-now', body);
      if (h) h.setAttribute('title', chapter.title);
    }
  }

  /* ================= 更新日志 ================= */
  openChangelog() {
    const TAG = { fix: '修复', new: '新增', opt: '优化', note: '提示' };
    const html = CHANGELOG.map(v => `
      <section class="clog-ver">
        <header class="clog-ver-head">
          <h3>${v.version}</h3>
          <time>${v.date}</time>
        </header>
        ${v.intro ? `<p class="clog-intro">${v.intro}</p>` : ''}
        ${v.sections.map(sec => `
          <div class="clog-sec">
            <h4 class="clog-sec-t">${sec.title}</h4>
            ${sec.items.map(it => `
              <div class="clog-item">
                <span class="k ${it.type}">${TAG[it.type] || ''}</span>
                <span class="clog-text">${it.text}</span>
              </div>`).join('')}
          </div>`).join('')}
        ${v.note ? `<p class="clog-note">${v.note}</p>` : ''}
      </section>`).join('');

    this.openPanel({
      title: '更新日志',
      body: `<div class="clog">${html}</div>`
    });
  }

  /* ================= 游戏内菜单 ================= */
  toggleMenu() {
    if (!this.el.panelLayer.hidden) { this.closePanel(); return; }
    const cur = this.saveAPI.current ? this.saveAPI.current() : { scope: 'main' };
    const inSide = cur.scope === 'side';
    const body = `
      <div class="menu-list">
        <button class="btn" data-menu="save">保存进度</button>
        <button class="btn" data-menu="load">读取存档</button>
        <button class="btn" data-menu="settings">设置</button>
        <button class="btn" data-menu="materials">材料（${this.state.materials.length}）</button>
        <button class="btn" data-menu="characters">人物</button>
        <button class="btn" data-menu="changelog">更新日志</button>
        <button class="btn" data-menu="about">关于本作</button>
        <button class="btn" data-menu="title">回到标题</button>
        <button class="btn btn-ghost" data-menu="quit">退出游戏</button>
      </div>
      <p style="margin-top:16px;font-size:.74rem;color:#6b7280;line-height:1.8">
      ${inSide
        ? '当前在支线里，存档写入支线自己的位置，不会改动主线进度。'
        : '当前章节会自动存档。手动存档共 ' + CONFIG.slots + ' 个位置。'}</p>
      ${(!inSide && this.state.flags && this.state.flags.side_unlocked)
        ? '<p class="menu-hint">支线已开启。回首页，从「支线」进入。</p>' : ''}`;

    this.openPanel({ title: inSide ? '菜单 · 支线' : '菜单', body, narrow: true });

    this.el.panelBody.querySelectorAll('[data-menu]').forEach(b => {
      b.addEventListener('click', () => {
        const m = b.dataset.menu;
        if (m === 'save' || m === 'load') { this.closePanel(); this.openSaves(m, cur); }
        if (m === 'settings') { this.closePanel(); this.openSettings(); }
        if (m === 'materials') { this.closePanel(); this.openMaterials(); }
        if (m === 'characters') { this.closePanel(); this.openCharacters(); }
        if (m === 'changelog') { this.closePanel(); this.openChangelog(); }
        if (m === 'about') { this.closePanel(); this.openAbout(); }
        if (m === 'title') { this.closePanel(); this.saveAPI.backToTitle(); }
        if (m === 'quit') { this.closePanel(); this.saveAPI.exitApp(); }
      });
    });
  }

  /* ================= 存档 / 读档 =================
     主线与支线各用一套槽位，互不影响：
     在支线里点「存档」写的是这条支线自己的槽，不会把主线进度顶掉。 */
  openSaves(mode = 'save', opts = {}) {
    const scope = opts.scope || 'main';
    const sideId = opts.sideId || null;
    const sideName = opts.sideName || '';
    const isSide = scope === 'side';
    const slots = this.saveAPI.list(scope, sideId);
    const modeWord = mode === 'save' ? '保存' : '读取';
    let confirmSlot = -1;

    const rows = slots.map(s => {
      const d = s.data;
      const no = s.auto ? '自动' : `0${s.slot}`;
      const title = d ? (d.chapterTitle || '未命名') : '空存档位';
      const meta = d
        ? `${d.dayLabel || ''}　${fmtTime(d.ts)}${d.preview ? '　' + d.preview : ''}`
        : (s.auto ? '进入章节时会自动写入' : '还没有用过这个位置');
      return `<button class="slot${d ? '' : ' empty'}" data-slot="${s.slot}" data-has="${d ? 1 : 0}">
        <span class="slot-no">${no}</span>
        <span class="slot-main">
          <span class="slot-title">${escapeHtml(title)}</span>
          <span class="slot-meta">${escapeHtml(meta)}</span>
        </span>
        <span class="slot-act">${modeWord}</span>
      </button>`;
    }).join('');

    const head = isSide
      ? `<p class="sv-note">这一页是「${escapeHtml(sideName || sideId || '支线')}」的专用存档位，与主线的存档分开保存。</p>`
      : `<p class="sv-note">主线存档。自动存档写在 0 号位，手动存档共 ${CONFIG.slots} 个。</p>`;

    this.openPanel({
      title: isSide ? `支线存档 · ${sideName || ''}` : (mode === 'save' ? '保存进度' : '读取存档'),
      body: `${head}<div class="slot-list">${rows}</div>`,
      foot: mode === 'load' && isSide
        ? `<button class="btn btn-ghost" id="svEnter">从头开始这一条</button>`
        : ''
    });

    const jump = (slot) => {
      if (mode === 'save') {
        if (!this.saveAPI.save(slot, scope, sideId)) { this.toast('当前没有可保存的进度'); return; }
        this.toast('已保存');
        this.closePanel();
        this.openSaves(mode, opts);
      } else {
        this.closePanel();
        this.saveAPI.load(slot, scope, sideId);
      }
    };

    this.el.panelBody.querySelectorAll('[data-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.sfx('select');
        const slot = Number(btn.dataset.slot);
        const has = btn.dataset.has === '1';
        if (mode === 'load') {
          if (!has) { this.toast('这个位置是空的'); return; }
          jump(slot);
          return;
        }
        // 覆盖已有存档要再点一次，避免误触
        if (has && confirmSlot !== slot) {
          confirmSlot = slot;
          const act = btn.querySelector('.slot-act');
          if (act) act.textContent = '再点确认';
          btn.classList.add('confirm');
          return;
        }
        jump(slot);
      });
    });

    const enter = $('#svEnter', this.el.panelBody);
    if (enter) enter.addEventListener('click', () => { this.closePanel(); this.saveAPI.enterSide(sideId); });
  }

  /* ================= 支线路口 =================
     首页「支线」入口。序章通关后解锁，之后随时可以回来选一条进去。 */
  openSideHub({ unlocked, progress, onGo, onLoad, onNew }) {
    this._onSideGo = onGo || (() => {});
    this._sideProgress = progress || {};
    const cards = SIDES.map(s => {
      const rec = (progress && progress.sides && progress.sides[s.id]) || null;
      const playable = unlocked && s.available;
      const stateText = !s.available ? '制作中'
        : !unlocked ? '锁定'
        : rec ? '已通过' : '可进入';
      const meta = [s.dayLabel, `约 ${s.minutes} 分钟`].filter(Boolean).join('　·　');
      const recLine = rec
        ? `<span class="sh-rec">第 ${rec.count} 次进入　最近一次：${escapeHtml(rec.lastName || '—')}${rec.hidden ? '（隐藏）' : ''}</span>`
        : '';
      return `<button class="sh-card${playable ? '' : ' locked'}${rec ? ' done' : ''}" data-side="${s.id}" ${playable ? '' : 'disabled'}>
        <span class="sh-no">${s.no}</span>
        <span class="sh-main">
          <span class="sh-name">${escapeHtml(s.name)}<em class="sh-tag">${escapeHtml(s.tag || '')}</em></span>
          <span class="sh-desc">${escapeHtml(s.desc)}</span>
          <span class="sh-meta">${escapeHtml(meta)}${s.points ? '　·　' + escapeHtml(s.points.join(' / ')) : ''}</span>
          ${recLine}
        </span>
        <span class="sh-state">${stateText}</span>
      </button>`;
    }).join('');

    const locked = !unlocked;
    const body = `
      <div class="side-hub">
        <p class="sh-lead">序章之后，主线之外。</p>
        <p class="sh-sub">这些事和周日没有直接关系，但它们问的是同一个问题：一件小事出了问题，谁该认真对待它。</p>
        <div class="sh-list">${cards}</div>
        ${locked ? '<p class="sh-lock">完成序章之后，这里的路才会打开。</p>' : '<p class="sh-lock">支线各自独立存档，进去之后不会改动主线进度。</p>'}
      </div>`;

    const foot = unlocked
      ? `<button class="btn btn-ghost" id="shSaves">支线存档</button>`
      : '';

    this.openPanel({ title: '支线路口', body, foot, wide: true });

    this.el.panelBody.querySelectorAll('[data-side]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) { this.toast('这一条还没有做好'); return; }
        this.audio.sfx('select');
        const side = SIDES.find(s => s.id === btn.dataset.side);
        if (side) this.openSideDetail(side);
      });
    });

    const sv = $('#shSaves', this.el.panelFoot);
    if (sv) sv.addEventListener('click', () => {
      this.closePanel();
      if (onLoad) onLoad();
    });
  }

  /* 支线存档入口：先选一条支线，再进它自己的槽位页 */
  openSideSavesPicker({ progress, onGo }) {
    const rows = SIDES.filter(s => s.available).map(s => {
      const rec = (progress && progress.sides && progress.sides[s.id]) || null;
      return `<button class="slot" data-pick="${s.id}">
        <span class="slot-no">${s.no}</span>
        <span class="slot-main">
          <span class="slot-title">${escapeHtml(s.name)}</span>
          <span class="slot-meta">${escapeHtml(s.dayLabel || '')}　${rec ? `进入过 ${rec.count} 次` : '还没有存档'}</span>
        </span>
        <span class="slot-act">打开</span>
      </button>`;
    }).join('');
    this.openPanel({
      title: '支线存档',
      body: `<p class="sv-note">每条支线有自己的存档位，与主线分开。</p><div class="slot-list">${rows}</div>`
    });
    this.el.panelBody.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const side = SIDES.find(s => s.id === btn.dataset.pick);
        this.closePanel();
        this.openSaves('load', { scope: 'side', sideId: side.id, sideName: side.name });
      });
    });
    this._onSideGo = onGo || this._onSideGo;
  }

  /* 支线详情：进去，或者读这条支线自己的存档 */
  openSideDetail(side) {
    const rec = (this._sideProgress && this._sideProgress[side.id]) || null;
    const body = `
      <div class="sh-detail">
        <div class="sh-detail-head">
          <span class="sh-no">${side.no}</span>
          <div>
            <h3>${escapeHtml(side.name)}</h3>
            <p class="sh-detail-meta">${escapeHtml(side.dayLabel || '')}　·　约 ${side.minutes} 分钟${side.endings ? `　·　${side.endings} 种结果` : ''}</p>
          </div>
        </div>
        <p class="sh-detail-desc">${escapeHtml(side.desc)}</p>
        ${side.points ? `<ul class="sh-points">${side.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
        ${rec ? `<p class="sh-detail-rec">进入过 ${rec.count} 次，最近一次结果：${escapeHtml(rec.lastName || '—')}</p>` : '<p class="sh-detail-rec">还没有走过这一条。</p>'}
      </div>`;
    this.openPanel({
      title: '支线 · ' + side.name,
      body,
      foot: `<button class="btn btn-ghost" id="sdSave">读取支线存档</button>
             <button class="btn btn-primary" id="sdGo">进入</button>`
    });
    $('#sdGo', this.el.panelFoot).addEventListener('click', () => { this.closePanel(); this._onSideGo(side.id); });
    $('#sdSave', this.el.panelFoot).addEventListener('click', () => {
      this.closePanel();
      this.openSaves('load', { scope: 'side', sideId: side.id, sideName: side.name });
    });
  }

  /* ================= 关于 / 素材说明 ================= */
  openAbout() {
    const repo = (CONFIG.update && CONFIG.update.repo) || 'baoliaojiang/not-my-weekend';
    const home = `https://github.com/${repo.split('/')[0]}`;
    const bili = 'https://space.bilibili.com/525298385';
    this.openPanel({
      title: '关于本作',
      body: `
        <div class="about-head">
          <img class="about-logo" src="assets/icons/hyperos/play.webp" alt="" loading="lazy" />
          <div>
            <p class="about-title"><strong>《不属于我的周末》</strong></p>
            <p class="about-sub">关于我的学校周末要上课这件事</p>
          </div>
        </div>
        <p>版本 ${CONFIG.version}</p>

        <div class="about-links" data-home="${home}" data-bili="${bili}">
          <button class="about-link" type="button" data-open="bili">
            <span class="about-link-k">Bilibili</span>
            <span class="about-link-v">爆料酱 · 525298385</span>
          </button>
          <button class="about-link" type="button" data-open="home">
            <span class="about-link-k">GitHub</span>
            <span class="about-link-v">${repo.split('/')[0]}</span>
          </button>
        </div>

        <p><strong>界面</strong><br>
        图标取自 <strong>HyperOS 4</strong> 的默认图标集，卡片列表与深色渐变的排布参考了那套系统的视觉语言。
        这只是取了一套现成的图标素材，本作并不绑定任何手机系统，桌面端、网页端与移动端都可以运行。</p>

        <p><strong>音乐</strong><br>
        场景配乐来自 <strong>Kevin MacLeod</strong>（incompetech.com），
        以 <strong>CC BY 4.0</strong> 授权使用，可商用，需署名；本作按授权在曲目清单里逐首标注了原曲名。
        标题曲为 AI 音乐模型生成。全部曲目均经过统一响度与循环点处理，未改动原曲编曲。</p>

        <p>本作为 Demo 版本，仅供个人学习与技术交流，不用于任何商业用途，亦不对外发售。本作的学校、人物、组织、地名与事件均为虚构，与现实无关。游戏流程不构成法律意见。</p>

        <p><strong>关于跳过</strong><br>
        跳过只推进对话与叙事节点；遇到选项、调查、聊天回复时一定会停下，不会替你做选择。</p>
      `
    });

    /* 一键跳主页：网页里开新标签，Electron 交给系统浏览器，安卓交给 ZBApp */
    const open = (url) => {
      try {
        if (window.ZBApp && typeof window.ZBApp.openUrl === 'function') window.ZBApp.openUrl(url);
        else if (window.zbShell && typeof window.zbShell.openExternal === 'function') window.zbShell.openExternal(url);
        else window.open(url, '_blank', 'noopener');
      } catch (e) { /* 打不开就算了，别把面板搞崩 */ }
    };
    this.el.panelBody.querySelectorAll('[data-open]').forEach((b) => {
      b.addEventListener('click', () => {
        const wrap = b.closest('.about-links');
        open(b.dataset.open === 'bili' ? wrap.dataset.bili : wrap.dataset.home);
      });
    });
  }

  /* ================= 章节总结 ================= */
  openSummary(summary, onNext, nextLabel) {
    const known = (summary.known || []).map(x => `<li>${x}</li>`).join('');
    const unknown = (summary.unknown || []).map(x => `<li>${x}</li>`).join('');
    const body = `<div class="summary">
      <h2>${summary.title || '章节结束'}</h2>
      <div class="sum-sub">${summary.subtitle || ''}</div>
      ${summary.quote ? `<div class="quote" style="font-family:var(--serif);font-size:.94rem;line-height:1.9;background:#ebe6da;padding:14px 16px;border:1px solid rgba(30,34,40,.14)">${summary.quote}</div>` : ''}
      ${known ? `<div class="block"><div class="block-t">已经确认的事</div><ul class="known">${known}</ul></div>` : ''}
      ${unknown ? `<div class="block"><div class="block-t">还没有答案的事</div><ul class="unknown">${unknown}</ul></div>` : ''}
    </div>`;

    this.openPanel({
      title: '章节总结',
      body,
      lockClose: true,
      foot: `<button class="btn btn-ghost" id="sumTitle">保存并返回标题页</button>
             <button class="btn btn-primary" id="sumNext">${nextLabel || '前往'}</button>`
    });

    $('#sumTitle', this.el.panelFoot).addEventListener('click', () => {
      this.closePanel();
      if (typeof this.saveAPI.save === 'function') this.saveAPI.save(0);
      this.saveAPI.backToTitle();
    });
    $('#sumNext', this.el.panelFoot).addEventListener('click', () => { this.closePanel(); onNext(); });
  }

  /* ---------------- 电话里的"对面那个人" ----------------
     配了 Key 就交给模型按人设演；没配就返回空字符串，
     让 mintdial 内部退回写死的几句，至少不是一段沉默。 */
  _dialAI() {
    const cfg = this.settings && this.settings.ai;
    const configured = !!(cfg && cfg.enabled !== false && cfg.baseUrl && cfg.apiKey);
    return {
      configured,
      ask: async (persona, msgs) => {
        if (!configured) return '';
        try {
          const out = await aiChat({
            settings: this.settings,
            system: persona.system,
            messages: (msgs || []).map(m => ({ role: m.role, content: m.content }))
          });
          return out && out.ok ? String(out.text || '').trim() : '';
        } catch (e) { return ''; }
      }
    };
  }

  /* ================= 给「薄荷」看的现场快照 =================
     薄荷要能回答"我现在在干嘛""这是哪""刚才谁说那句话"，
     就得把这一秒的状态原样交给它：章节、场景、在场的立绘、
     屏幕上那一句、开着的面板/手机应用、材料与人物关系、
     最近做过的选择。都是只读，不改任何状态。 */
  _liveSnapshot() {
    const L = [];
    const st = this.state || {};
    const eng = this.engine;
    const CH = { ch0: '序章·九月一日', ch1: '第一章', ch2: '第二章', ch3: '第三章', ch4: '第四章', ch5: '第五章', ch6: '第六章' };
    const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };

    // ---- 版本与存档 ----
    L.push(`游戏版本：v${CONFIG.version}`);
    const ch = eng && eng.chapter;
    const chName = ch ? `${ch.title || ''}${ch.name ? ' · ' + ch.name : ''}` : (CH[st.chapterId] || st.chapterId || '未知');
    L.push(`当前章节：${chName}（id: ${st.chapterId || '?'}）`);
    L.push(`剧情内日期：${st.dayLabel || '未知'}`);

    // ---- 剧情进度 ----
    const f = safe(() => eng.frame(), null);
    if (f && f.nodes) {
      const pct = Math.round((f.i / Math.max(1, f.nodes.length)) * 100);
      L.push(`本章进度：第 ${f.i + 1} / ${f.nodes.length} 个节点（约 ${pct}%）`);
    }
    const cur = eng && eng.current;
    if (cur) {
      const typeMap = {
        say: '正在播放一句对白', narr: '正在播放旁白', choice: '停在选项上等玩家选',
        mat: '正在弹出材料', hub: '正在调查中枢选行动', chatreply: '正在手机上选回复',
        quiz: '正在做课堂小测', phone: '正在看手机', card: '正在看开场卡板',
        ask: '正在等玩家做设定', govform: '正在填政务表单', hotline: '正在打 12345'
      };
      L.push(`此刻：${typeMap[cur.t] || ('节点类型 ' + cur.t)}`);
      if (cur.text) L.push(`屏幕上这一句（${cur.t === 'narr' ? '旁白' : (cur.name || cur.who || '某人')}）：${String(cur.text).slice(0, 120)}`);
    }

    // ---- 场景与立绘 ----
    const sc = safe(() => (this.stage && this.stage.snapshotScene ? this.stage.snapshotScene() : null), null);
    if (sc) {
      if (sc.bg) L.push(`当前场景：${sc.bg}${sc.place ? '（' + sc.place + '）' : ''}`);
    }
    const onStage = safe(() => {
      const out = [];
      if (this.stage && this.stage.sprites) {
        this.stage.sprites.forEach((v, k) => {
          const c = CHARACTERS[k] || CHARACTERS[v && v.id];
          out.push(c ? c.name : k);
        });
      }
      return out;
    }, []);
    if (onStage.length) L.push(`台上立绘：${onStage.join('、')}`);

    // ---- 玩家此刻开着的界面 ----
    const uiState = [];
    if (this.isPhoneOpen && this.isPhoneOpen()) {
      const top = (this._mintStack && this._mintStack.length) ? this._mintStack[this._mintStack.length - 1] : null;
      const appName = this._phoneApp || (top && top.title) || '桌面';
      uiState.push(`手机开着（在「${appName}」）`);
    }
    if (this._panelOpen) uiState.push('一个游戏面板开着');
    if (this._hubActive || st.hubActive) uiState.push('在调查中枢');
    L.push(`界面状态：${uiState.length ? uiState.join('，') : '在剧情画面里'}`);

    // ---- 主角 ----
    const mc = safe(() => (st.flags && st.flags.mc_gender) || (st.flags && st.flags.gender) || null, null);
    if (mc) L.push(`主角性别设定：${mc === 'male' ? '男' : mc === 'female' ? '女' : mc}`);

    // ---- 材料 ----
    const mats = st.materials || [];
    if (mats.length) {
      const titles = mats.slice(-5).map(id => {
        const m = getMaterial(id);
        return m ? m.title : id;
      });
      L.push(`已持有材料 ${mats.length} 份：${titles.join('；')}${mats.length > 5 ? '…' : ''}`);
    } else {
      L.push('已持有材料：0 份');
    }

    // ---- 已通关 ----
    const done = (st.chaptersDone || []).map(id => CH[id] || id);
    L.push(`已通关章节：${done.length ? done.join('、') : '（还没通关任何一章）'}`);

    // ---- 人物关系（定性，不给数字） ----
    const rel = safe(() => {
      const out = [];
      Object.keys(st.stats || {}).forEach(k => {
        const c = CHARACTERS[k];
        const v = st.stats[k];
        if (!c) return;
        const t = v.trust >= 60 ? '比较信任你' : v.trust >= 40 ? '还在观望' : '不太信任你';
        const p = v.pressure >= 65 ? '压力很大' : v.pressure >= 40 ? '有些压力' : '没什么压力';
        out.push(`${c.name}（${t}，${p}）`);
      });
      return out;
    }, []);
    if (rel.length) L.push(`人物关系：${rel.join('；')}`);

    // ---- 最近的选择 ----
    const chs = (st.choices || []).slice(-4).map(c => `「${c.q}」→ ${c.a}`);
    if (chs.length) L.push(`最近的选择：${chs.join('；')}`);

    // ---- 小测成绩 ----
    const qz = Object.keys(st.quizzes || {});
    if (qz.length) {
      L.push(`课堂小测：${qz.map(k => `${k} ${st.quizzes[k].right}/${st.quizzes[k].total}`).join('，')}`);
    }

    // ---- 最近几句台词 ----
    const recent = (st.log || []).slice(-6).map(m => `${m.who || '旁白'}：${String(m.text).slice(0, 60)}`);
    if (recent.length) L.push(`最近六句台词：\n${recent.join('\n')}`);

    // ---- 关键旗标（只挑几个可读的） ----
    const flags = Object.keys(st.flags || {}).filter(k => st.flags[k] === true && !k.startsWith('ending_'));
    if (flags.length) L.push(`已触发的关键标记（共 ${flags.length} 个）：${flags.slice(0, 12).join('、')}${flags.length > 12 ? '…' : ''}`);

    return L.join('\n');
  }

  /* ================= 跳过确认 =================
     跳之前先把这一节摊开：讲到哪里了、要点是什么、谁在场。
     玩家看着摘要按「跳到本节末」，心里有底。 */
  askSkipConfirm(info, onGo, onStop) {
    const c = info || {};
    const box = this.el.skipPrompt;

    const chEl = box.querySelector('#skipChapter');
    if (chEl) chEl.textContent = c.chapter || '本节';

    const subEl = box.querySelector('#skipSub');
    if (subEl) {
      subEl.textContent = c.sub || '';
      subEl.hidden = !c.sub;
    }

    const ptEl = box.querySelector('#skipPoints');
    if (ptEl) {
      const pts = Array.isArray(c.points) ? c.points : [];
      ptEl.innerHTML = pts.map(t => `<li>${escapeHtml(t)}</li>`).join('');
      ptEl.hidden = !pts.length;
    }

    const castEl = box.querySelector('#skipCast');
    if (castEl) {
      const cast = Array.isArray(c.cast) ? c.cast : [];
      castEl.innerHTML = cast.map(p => {
        const src = faceUrl(p.id);
        const style = src ? ` style="background-image:url('${src}')"` : '';
        return `<span class="skip-face"><i${style}></i><b>${escapeHtml(p.name || '')}</b></span>`;
      }).join('');
      castEl.hidden = !cast.length;
      const t = box.querySelector('.skip-cast-t');
      if (t) t.hidden = !cast.length;
    }

    box.hidden = false;
    this._skipCb = (go) => { this._skipCb = null; box.hidden = true; go ? onGo() : onStop(); };
  }
}

/* ---------------- 工具 ---------------- */
function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function makeCaseNo(timeStr) {
  // 编号里的日期要用剧情内时间，不能取运行时的系统日期，
  // 否则 2025 年 9 月的案子会拿到 2026 年的受理号
  let y, m, d;
  const hit = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(timeStr || ''));
  if (hit) { y = +hit[1]; m = +hit[2]; d = +hit[3]; }
  else {
    const now = new Date();
    y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate();
  }
  const p = (n) => String(n).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `SZ${y}${p(m)}${p(d)}${seq}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** 往元素里逐字写入，用于 AI 回答的呈现 */
async function typeInto(el, text, step = 2, speed = 16) {
  if (!el) return;
  const chars = Array.from(String(text || ''));
  el.textContent = '';
  for (let i = 0; i < chars.length; i += step) {
    el.textContent = chars.slice(0, i + step).join('');
    await sleep(speed);
  }
  el.textContent = chars.join('');
}

/* ---- AI 助手：常量与本机时间 ---- */
const AI_CHATS_KEY = 'zbnx.ai.chats.v1';
const AI_STICKERS = [
  { id: 'happy', label: '开心' },
  { id: 'hug', label: '抱抱' },
  { id: 'ok', label: '收到' },
  { id: 'thanks', label: '谢谢' },
  { id: 'shy', label: '害羞' },
  { id: 'hum', label: '哼' },
  { id: 'question', label: '疑惑' },
  { id: 'sit', label: '坐下' },
  { id: 'sit2', label: '坐好' },
  { id: 'bow', label: '俯身' },
  { id: 'work', label: '上班' },
  { id: 'reach', label: '伸手' },
  { id: 'skirt', label: '提裙' },
  { id: 'close', label: '贴贴' },
  { id: 'night', label: '晚安' },
  { id: 'main', label: '薄荷' }
];
const aiArt = (id) => `assets/ai/${id}.png`;

/** 会话列表里的相对时间 */
function relTime(ts) {
  const t = Number(ts) || 0;
  const d = new Date(t || Date.now());
  const diff = Date.now() - t;
  if (t && diff < 60e3) return '刚刚';
  if (t && diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (!t || new Date().toDateString() === d.toDateString()) return hm;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 材料正文排版：
   以前是一整段 <br> 拼到底，遇到"同一件事、两条渠道、两种答复"这种结构
   就会看成重复内容（曾经被当成 bug 反馈过）。
   这里支持两种轻量标记：
     【标题】 → 段标题
     空行     → 段间距
   其余按行原样输出。 */
function formatMaterialContent(text) {
  const lines = String(text == null ? '' : text).split('\n');
  const out = [];
  for (const raw of lines) {
    const t = String(raw).trim();
    if (!t) { out.push('<div class="mat-gap"></div>'); continue; }
    const m = t.match(/^【(.+)】$/);
    if (m) out.push(`<div class="mat-sec">${escapeHtml(m[1])}</div>`);
    else out.push(`<div class="mat-line">${escapeHtml(raw)}</div>`);
  }
  return out.join('');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
