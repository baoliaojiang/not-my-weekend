/* =========================================================
   舞台：背景 / 立绘 / 地点标签
   ---------------------------------------------------------
   素材缺失时的回退策略：
   · 背景 → 由地点名生成的渐变底 + 淡淡的文字，不出现破图
   · 立绘 → 虚线占位框，标明角色名
   ========================================================= */

import { assetUrl, assetLabel, hasAsset } from '../config/assets.js';

const paletteCache = new Map();

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  return h;
}

function gradientFor(key) {
  if (paletteCache.has(key)) return paletteCache.get(key);
  const h = hashString(key);
  const hue = h % 360;
  const css = `linear-gradient(160deg,
      hsl(${hue} 22% 26%) 0%,
      hsl(${(hue + 28) % 360} 18% 18%) 55%,
      hsl(${(hue + 58) % 360} 24% 12%) 100%)`;
  paletteCache.set(key, css);
  return css;
}

export class Stage {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.bgEls = [root.querySelector('#bgA'), root.querySelector('#bgB')];
    this.activeBg = 0;
    this.currentBg = null;
    this.spriteLayer = root.querySelector('#spriteLayer');
    this.placeTag = root.querySelector('#placeTag');
    this.sprites = new Map();
    this.slots = new Map();   // 角色 → 固定槽位（center/left/right）
    this.placeTimer = null;
    this.failedBgs = new Set();
    this.loadedBgs = new Set();
  }

  /* ---------------- 背景 ---------------- */
  setBackground(id, { force = false, sync = false } = {}) {
    if (!id) return;
    if (this.currentBg === id && !force) return;
    this.currentBg = id;

    const url = this.failedBgs.has(id) ? null : assetUrl('background', id);
    const nextIndex = this.activeBg === 0 ? 1 : 0;
    const next = this.bgEls[nextIndex];
    const prev = this.bgEls[this.activeBg];
    const label = assetLabel('background', id);

    const apply = () => {
      next.style.backgroundImage = `url("${url}")`;
      next.classList.add('on');
      prev.classList.remove('on');
      this.activeBg = nextIndex;
    };

    if (!url) {
      // 素材缺失 → 渐变占位
      this.failedBgs.add(id);
      next.style.backgroundImage = `${gradientFor(id)}`;
      next.dataset.placeholder = label;
      next.classList.add('on');
      prev.classList.remove('on');
      this.activeBg = nextIndex;
      return;
    }

    // 已经解码过的背景直接切换，省掉一次回图等待
    // sync：读档恢复场景时用，先铺上再说，不等 probe 回来（否则会有一下黑屏）
    if (sync || this.loadedBgs.has(url)) { this.loadedBgs.add(url); apply(); return; }

    const probe = new Image();
    probe.onload = () => { this.loadedBgs.add(url); apply(); };
    probe.onerror = () => {
      this.failedBgs.add(id);
      next.style.backgroundImage = `${gradientFor(id)}`;
      next.classList.add('on');
      prev.classList.remove('on');
      this.activeBg = nextIndex;
    };
    probe.src = url;
  }

  setPlace(text) {
    if (!text) return;
    if (!this.settings.showPlaceTag) { this.placeTag.hidden = true; return; }
    this.placeTag.textContent = text;
    this.placeTag.hidden = false;
    this.placeTag.style.animation = 'none';
    // 触发重播动画
    void this.placeTag.offsetWidth;
    this.placeTag.style.animation = '';
    clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => { this.placeTag.hidden = true; }, 2600);
  }

  /* ---------------- 立绘 ---------------- */
  /**
   * 显示立绘。
   *
   * 位置由「固定槽位」决定，不再按当前人数重排：
   *   每个角色第一次上场时占一个槽位（center → left → right），
   *   之后一直留在那个槽位上，中途下台再回来还是原来的位置。
   * 以前是每次 show/hide 都重新按在场人数排一遍，于是
   *   「A 说话 → B 说话 → A 说话」时三个人的左右位置会来回换，
   *   看上去就是立绘在跳。
   */
  showSprite(id, pos = 'center') {
    if (!id) return;
    /* 主角立绘：第一人称也上台（剧本里就是这么演的），
       但设置里关掉之后一律不上台。
       置 false 时还要顺手把人撤掉——否则关掉开关后
       画面上那个"我"会一直站在那儿，直到下次退场。 */
    if (id === 'lin' && this.settings && this.settings.showPlayerSprite === false) {
      if (this.sprites.has('lin')) this.hideSprite('lin');
      return;
    }
    let el = this.sprites.get(id);
    if (!el) {
      const url = assetUrl('sprite', id);
      // 没有立绘素材的角色（主角「我」、路人、老师…）不上台。
      // 以前会画一个虚线占位框，上面写着「某某（立绘缺失）」，
      // 那行字直接压在背景和别的立绘上，竖屏时尤其明显。
      if (!url) return;
      el = document.createElement('img');
      el.className = 'sprite';
      el.alt = assetLabel('sprite', id);
      el.dataset.id = id;
      el.src = url;
      el.onerror = () => {
        // 素材文件真的读不出来：换成没有文字的占位，别再糊一行字在画面上
        const box = this._placeholder(id);
        el.replaceWith(box);
        this.sprites.set(id, box);
        this.applySlots();
      };
      this.sprites.set(id, el);
      this.spriteLayer.appendChild(el);
    }
    if (!this.slots.has(id)) this.slots.set(id, this._pickSlot(id, pos));
    this.applySlots();
    requestAnimationFrame(() => el.classList.add('on'));
  }

  /** 给新角色分配一个空槽位；满了就沿用最近的空位（不再乱换位置） */
  _pickSlot(id, prefer) {
    const used = new Set(this.slots.values());
    // 主角优先左侧：身后是背景，右边留给正在说话的人，
    // 这样"我"在场时画面重心是稳的，不会跟对话者抢中间。
    if (id === 'lin') {
      for (const p of ['left', 'center', 'right']) {
        if (!used.has(p)) return p;
      }
      return 'left';
    }
    const order = prefer === 'left' || prefer === 'right'
      ? [prefer, 'center', 'left', 'right']
      : ['center', 'left', 'right'];
    for (const p of order) {
      if (!used.has(p)) return p;
    }
    return 'center';
  }

  /** 把槽位写回 DOM。只改 class，不做位移动画，避免"跳来跳去"。 */
  applySlots() {
    this.sprites.forEach((el, id) => {
      if (!el || !el.isConnected) return;
      const p = this.slots.get(id) || 'center';
      const cls = `pos-${p}`;
      if (el.classList.contains(cls)) return;
      el.classList.remove('pos-left', 'pos-right', 'pos-center');
      el.classList.add(cls);
    });
  }

  _placeholder(id) {
    const box = document.createElement('div');
    box.className = 'sprite missing';
    box.dataset.id = id;
    return box;
  }

  hideSprite(id) {
    const el = this.sprites.get(id);
    if (!el) return;
    // 先从表里摘掉，再延迟移除元素：否则退场动画那 360ms 里人数算多了，剩下的人不会回到中间
    this.sprites.delete(id);
    // 槽位不释放：同一个角色再上来时回到原位，不会换来换去
    el.classList.remove('on', 'speaking');
    setTimeout(() => { el.remove(); }, 360);
    this.applySlots();
  }

  /** 换了主角性别：把场上那个"我"换成另一套图（位置不变） */
  refreshPlayerSprite() {
    const el = this.sprites.get('lin');
    if (!el) return;
    const url = assetUrl('sprite', 'lin');
    if (!url) { this.hideSprite('lin'); return; }
    if (el.tagName === 'IMG') el.src = url;
  }

  hideAllSprites() {
    Array.from(this.sprites.keys()).forEach(id => this.hideSprite(id));
  }

  /** 当前说话人高亮；其他角色压暗 */
  setSpeaking(id) {
    this.sprites.forEach((el, key) => {
      el.classList.toggle('speaking', key === id);
    });
  }

  /* ---------------- 场景快照（读档用） ----------------
     读档只恢复文字状态是不够的：背景、立绘、音乐都在运行时 DOM 里，
     存档点往往落在一段没有 bg 节点的剧情中间，于是恢复后 bg 层是空的——
     这就是"读档 / 继续游戏进来先黑屏"的原因。
     存一份极简快照，读档时先按快照把舞台铺回去，再继续跑节点。 */
  snapshotScene() {
    const sprites = [];
    this.sprites.forEach((el, id) => { if (el && el.isConnected) sprites.push(id); });
    return { bg: this.currentBg, sprites };
  }

  restoreScene(scene) {
    if (!scene) return;
    // 立绘：全部清掉再按快照重建，避免残留上一局的人
    Array.from(this.sprites.keys()).forEach(id => {
      const el = this.sprites.get(id);
      if (el) el.remove();
    });
    this.sprites.clear();
    this.slots.clear();
    if (scene.bg) this.setBackground(scene.bg, { force: true, sync: true });
    (scene.sprites || []).forEach(id => this.showSprite(id));
  }
}
