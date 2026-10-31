/* =========================================================
   启动序列
   ---------------------------------------------------------
   顺序照主机游戏的习惯排：
     1 黑屏（留白，让眼睛适应）
     2 作者标识（B 站主页 / GitHub）
     3 游戏标识
     4 健康游戏忠告
     5 光敏性癫痫警告（请在游戏前详阅）
     6 检查资源更新
     7 淡出 → 主界面

   两条规矩写在这里，不写在别处：
     · 忠告与警告各占一屏，不会被"跳过"一次全跳掉；
     · 其余屏点击即快进。

   每屏本身只做淡入淡出，不做位移动画——开场要稳，不要花。
   ========================================================= */

import { CONFIG } from '../config/game.js';

const AUTHOR = {
  name: '爆料酱',
  // 从 B 站主页链接里取的空间号，这里直接写完整地址
  bilibili: 'https://space.bilibili.com/525298385',
  // 由 main.js 在启动时按 CONFIG 覆盖；先留空，没配就整行不显示
  github: ''
};

export const BOOT_SCREENS = [
  {
    key: 'blank',
    hold: 700,
    html: ''
  },
  {
    key: 'author',
    hold: 1900,
    html: `<div class="boot-author">
      <span class="boot-avatar"></span>
      <p class="boot-author-n">爆料酱</p>
      <a class="boot-ids boot-link" id="bootBili" target="_blank" rel="noopener noreferrer">bilibili · 525298385</a>
      <a class="boot-ids is-dim boot-link" id="bootGit" target="_blank" rel="noopener noreferrer"></a>
    </div>`
  },
  {
    key: 'logo',
    hold: 2000,
    html: `<div class="boot-logo">
      <img class="boot-logo-ico" src="assets/ui/app-icon.png" alt="" />
      <svg class="logo-game" viewBox="0 0 660 240" role="img" aria-label="不属于我的周末">
        <defs>
          <radialGradient id="gz" cx="50%" cy="40%" r="52%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity=".09"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx="330" cy="108" rx="330" ry="104" fill="url(#gz)"/>

        <!-- 主标：粗体 + 极轻微上扬，像印刷体被风带起一点 -->
        <g transform="rotate(-1.6 330 106)">
          <text x="330" y="118" class="logo-game-t">不属于我的周末</text>
        </g>

        <!-- 地平线：一条细线横穿，两端渐隐 -->
        <path d="M92 148h476" stroke="currentColor" stroke-width=".9" opacity=".34"/>

        <!-- 天际线：几段教学楼轮廓，只有剪影，不画细节 -->
        <g fill="currentColor" opacity=".2">
          <rect x="150" y="120" width="62" height="28"/>
          <rect x="216" y="106" width="34" height="42"/>
          <rect x="256" y="126" width="76" height="22"/>
          <rect x="338" y="112" width="44" height="36"/>
          <rect x="388" y="128" width="92" height="20"/>
          <rect x="486" y="118" width="30" height="30"/>
        </g>
        <!-- 几个亮着的窗 -->
        <g fill="currentColor" opacity=".5">
          <rect x="230" y="116" width="5" height="5"/>
          <rect x="352" y="122" width="5" height="5"/>
          <rect x="366" y="122" width="5" height="5"/>
        </g>

        <!-- 英文副标 -->
        <text x="330" y="180" class="logo-game-sub">THE WEEKEND THAT IS NOT MINE</text>
      </svg>
      <p class="boot-sub">关于我的学校周末要上课这件事</p>
      <p class="boot-ver" id="bootVer"></p>
    </div>`
  },
  {
    key: 'health',
    hold: 4200,
    required: true,
    html: `<div class="boot-health">
      <h2 class="boot-h2">健康游戏忠告</h2>
      <ul class="boot-health-list">
        <li>抵制不良游戏，拒绝盗版游戏。</li>
        <li>注意自我保护，谨防受骗上当。</li>
        <li>适度游戏益脑，沉迷游戏伤身。</li>
        <li>合理安排时间，享受健康生活。</li>
      </ul>
      <p class="boot-foot">建议 12 周岁以上用户使用。请合理安排游戏时间。</p>
    </div>`
  },
  {
    key: 'warning',
    hold: 5200,
    required: true,
    html: `<div class="boot-warn">
      <h2 class="boot-h2">警告：请在游戏前详阅</h2>
      <p class="boot-warn-t">
        当暴露在特定光影图案或闪光亮光下时，有极少数人群可能会引发癫痫。
        甚至连不具有癫痫病史的人，也可能在进行电子游戏时，出现类似癫痫症状。
        如果您或您的家人曾出现过癫痫症状，请在游玩本游戏之前咨询您的医生。
      </p>
      <p class="boot-warn-t">
        如果您在游玩本游戏时出现视力模糊、头晕、失去意识、方向混乱、
        不自觉肌肉痉挛、眼抽搐或麻木等症状，请立即中止游戏及时就医，
        并且请您再次进行本游戏之前咨询您的医生。
      </p>
      <p class="boot-foot">
        本作含闪烁与快速切换的画面（如闪回、故障效果），可在「设置 · 界面动画」中关闭动效。
      </p>
    </div>`
  },
  {
    key: 'notice',
    hold: 5600,
    required: true,
    html: `<div class="boot-notice">
      <h2 class="boot-h2">适龄提示与说明</h2>
      <p class="boot-age">12+</p>
      <p class="boot-notice-t">
        本作建议 <b>12 周岁以上</b>用户使用。内容为校园日常与轻度社会议题的剧情探讨，
        不含血腥暴力、恐怖惊悚、色情低俗内容，也不含任何现实中的违法犯罪引导。
      </p>
      <p class="boot-notice-t">
        本作是<b>个人制作的非商业 Demo</b>，免费提供，不对外发售；
        全部立绘、背景与音乐均为自制，不使用任何第三方素材。
      </p>
      <p class="boot-notice-t">
        故事中的学校、人物、组织与事件均为虚构，请勿与现实对号入座。
        游戏内一切关于程序、投诉与政策的描写仅用于叙事，<b>不构成法律意见</b>。
      </p>
      <p class="boot-foot">
        存档会自动保存（每 30 秒与每次章节结束），也可以在菜单里手动存进 1—8 号槽位。
        觉得画面晃动或闪烁不适，请在「设置 · 界面动画」里关闭动效。
      </p>
    </div>`
  },
  {
    key: 'update',
    hold: 0,          // 等检查完再走，见 boot.js 的 onEnter
    html: `<div class="boot-upd">
      <div class="boot-card">
        <div class="boot-card-top">
          <span class="boot-card-kicker">RESOURCE CHECK</span>
          <span class="boot-card-ver" id="bootUpdMeta"></span>
        </div>
        <h2 class="boot-card-h">检查更新</h2>
        <p class="boot-card-t" id="bootUpdText">正在获取版本信息…</p>
        <div class="boot-upd-bar"><i id="bootUpdBar"></i></div>
        <div class="boot-upd-list" id="bootUpdList" hidden></div>
        <div class="boot-upd-actions" id="bootUpdActions" hidden></div>
        <p class="boot-card-f" id="bootUpdFoot">资源更新不会影响你的存档</p>
      </div>
    </div>`
  },
  {
    key: 'shader',
    hold: 0,          // 由 prepareRuntime 决定何时走
    html: `<div class="boot-upd">
      <div class="boot-card">
        <div class="boot-card-top">
          <span class="boot-card-kicker">PREPARING</span>
          <span class="boot-card-ver" id="bootShadePct">0%</span>
        </div>
        <h2 class="boot-card-h">正在编译着色器</h2>
        <p class="boot-card-t" id="bootShadeText">正在准备运行环境…</p>
        <div class="boot-upd-bar"><i id="bootShadeBar"></i></div>
        <p class="boot-card-f">首次启动会慢一些，之后不用再等</p>
      </div>
    </div>`
  }
];

/**
 * 跑完整的启动序列。
 * @param {object} opts
 *   root        容器元素
 *   version     当前网页资源版本
 *   checkUpdate 异步函数，返回 { kind, content, shell, shellMin, notes }
 *   onDone      全部结束后回调
 */
export function runBootSequence({ root, version, checkUpdate, applyUpdate, github, onDone }) {
  if (!root) { onDone && onDone(); return; }
  const stage = root.querySelector('#bootStage');
  const skipBtn = root.querySelector('#bootSkip');
  const bar = root.querySelector('#bootBar');

  let i = 0;
  let timer = null;
  let finished = false;
  let updateResult = null;
  let waiting = false;

  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

  const finish = () => {
    if (finished) return;
    finished = true;
    clear();
    root.classList.add('is-out');
    /* 标题页要在黑屏还半透明的时候就接上。
       以前是等 is-out 的 580ms 走完才 onDone：那时黑屏已经透明，
       标题页却还停在"未入场"状态，于是玩家先看到一帧空背景，
       紧接着 logo 与按钮才重新播一遍入场——观感就是「进主界面先闪一下」。
       现在让标题页在黑屏渐隐到一半时开始入场，两边交叉过渡。 */
    setTimeout(() => { onDone && onDone(); }, 240);
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-out');
    }, 640);
  };

  /* 显示第 n 屏。
     淡入淡出用 Web Animations 显式驱动，不靠 CSS 类切换：
     类切换依赖浏览器在同一帧里重算样式，实测经常被合并掉，看起来就是硬切。
     显式写死三段——淡出 700ms、全黑 450ms、淡入 900ms——节奏才稳定。 */
  async function show(n) {
    if (finished) return;
    if (n >= BOOT_SCREENS.length) { finish(); return; }
    i = n;
    const sc = BOOT_SCREENS[n];
    clear();

    // 第一屏之前没有内容，直接淡入
    if (n > 0) {
      try {
        await stage.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 700, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }
        ).finished;
      } catch (e) { /* 不支持就跳过 */ }
      if (finished) return;
    }

    stage.innerHTML = sc.html;
    stage.className = 'boot-stage show-' + sc.key;
    if (bar) bar.style.width = `${((n + 1) / BOOT_SCREENS.length) * 100}%`;

    const verEl = stage.querySelector('#bootVer');
    if (verEl) verEl.textContent = 'v' + version;
    // 署名页那两行：bilibili 与 GitHub，都能点，点了去主页
    const gitEl = stage.querySelector('#bootGit');
    if (gitEl) {
      gitEl.textContent = github || '';
      const owner = String(github || '').split('·').pop().trim().split('/')[0];
      if (owner) gitEl.href = `https://github.com/${owner}`;
      else gitEl.hidden = true;
    }
    const biliEl = stage.querySelector('#bootBili');
    if (biliEl && AUTHOR.bilibili) biliEl.href = AUTHOR.bilibili;
    // 这一屏本来就"点一下跳过"，链接触发的是跳转不该顺带翻页
    stage.querySelectorAll('.boot-link').forEach((a) => {
      a.addEventListener('click', (e) => { e.stopPropagation(); });
    });
    // 「检查更新」与「编译着色器」是实际要干活的屏，跳过会让游戏带着旧资源/未准备的环境启动
    if (skipBtn) skipBtn.hidden = (sc.key === 'update' || sc.key === 'shader');

    // 全黑停一小会儿，再淡入
    await new Promise((r) => setTimeout(r, n === 0 ? 0 : 450));
    if (finished) return;
    try {
      const anim = stage.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 900, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
      );
      anim.onfinish = () => { stage.style.opacity = '1'; };
      await anim.finished;
    } catch (e) { stage.style.opacity = '1'; }
    if (finished) return;

    if (sc.hold > 0) timer = setTimeout(() => show(n + 1), sc.hold);
    if (sc.key === 'update') onUpdateScreen();
    if (sc.key === 'shader') onShaderScreen();
  }

  /* 编译着色器屏。
     这一屏不是装饰动画：真做了四件事——等字体、预热首章背景、探 WebGL、探音频。
     每一步都套了超时，整屏还有 12 秒的总闸——
     任何一步卡住都只会让这一屏提前结束，绝不会停在那里不动。 */
  async function onShaderScreen() {
    const bar = stage.querySelector('#bootShadeBar');
    const pct = stage.querySelector('#bootShadePct');
    const text = stage.querySelector('#bootShadeText');
    let closed = false;

    const tick = (p, msg) => {
      if (closed) return;
      if (bar) bar.style.width = Math.max(4, Math.min(100, p)) + '%';
      if (pct) pct.textContent = Math.round(p) + '%';
      if (text && msg) text.textContent = msg;
    };

    /* 单步超时：超时就当它做完，不拖住整屏 */
    const withTimeout = (fn, ms) => Promise.race([
      Promise.resolve().then(fn).catch(() => {}),
      new Promise((r) => setTimeout(r, ms))
    ]);

    const steps = [
      [12, '正在载入字体…', () => {
        if (!document.fonts || !document.fonts.ready) return;
        return document.fonts.ready;
      }],
      [40, '正在预载场景…', () => Promise.all(
        ['bg_gate', 'bg_classroom', 'bg_corridor'].map((n) => new Promise((res) => {
          const img = new Image();
          img.onload = img.onerror = () => res();
          img.src = `assets/backgrounds/${n}.jpg`;
        }))
      )],
      [68, '正在检测渲染能力…', () => {
        try {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
          if (!gl) document.body.classList.add('no-webgl');
          // 预热一次 2D 绘制，让第一次真正画画面时不必再初始化上下文
          const c2 = document.createElement('canvas');
          c2.width = c2.height = 2;
          const g2 = c2.getContext('2d');
          if (g2) { g2.fillRect(0, 0, 1, 1); }
        } catch (e) { document.body.classList.add('no-webgl'); }
      }],
      [90, '正在初始化音频…', () => {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) { document.body.classList.add('no-webaudio'); return; }
          // 只创建再挂起：不在这时候出声，也不占用音频设备
          const ctx = new AC();
          if (ctx.state === 'running') ctx.suspend();
        } catch (e) { document.body.classList.add('no-webaudio'); }
      }]
    ];

    const go = async () => {
      let done = 0;
      for (const [p, msg, fn] of steps) {
        if (closed) return;
        tick(done === 0 ? 6 : (done / steps.length) * 88 + 4, msg);
        await withTimeout(fn, 2600);
        done++;
      }
      if (closed) return;
      tick(100, '准备完成');
      await new Promise((r) => setTimeout(r, 520));
      if (closed) return;
      leave();
    };

    const leave = () => {
      if (closed || finished) return;
      closed = true;
      clearTimeout(watchdog);
      clear();
      show(i + 1);
    };

    // 总闸：12 秒还没跑完，直接放行
    const watchdog = setTimeout(() => {
      if (closed) return;
      tick(100, '准备完成');
      setTimeout(leave, 320);
    }, 12000);

    go().catch(leave);
  }

  /** 更新检查屏：真正去查，查完给一句结果，停 1.2 秒再进主界面。
      外面还有一道 9 秒总闸：baseUrl 没配、网络卡住都不能让启动停在这里。 */
  async function onUpdateScreen() {
    const text = stage.querySelector('#bootUpdText');
    const ubar = stage.querySelector('#bootUpdBar');
    const meta = stage.querySelector('#bootUpdMeta');
    const orb = stage.querySelector('#bootOrb');
    waiting = true;
    let done = false;
    const bail = (msg) => {
      if (done) return;
      done = true;
      if (ubar) ubar.style.width = '100%';
      if (text) text.textContent = msg;
      waiting = false;
      clear();
      timer = setTimeout(() => show(i + 1), 900);
    };
    /* 三个源现在是并发竞速（单源 3.5s），正常最多 4 秒就有结果，
       这里留 6 秒兜底；以前是 9 秒，加上串行 18 秒的等待，
       离线玩家每次启动都要在这一屏干等，看着就像"一直超时"。 */
    const guard = setTimeout(() => bail('没联网，先离线游玩'), 6000);
    if (ubar) ubar.style.width = '30%';
    if (meta) meta.textContent = '当前版本 v' + version;
    let msg = '资源已是最新';
    try {
      if (typeof checkUpdate === 'function') {
        if (ubar) ubar.style.width = '65%';
        updateResult = await checkUpdate();
        const k = updateResult && updateResult.kind;
        if (k === 'content') {
          /* 如果外面那道总闸已经把玩家放行（比如网络卡了 6 秒），
             这时候再弹「发现新版本」会突然盖在编译着色器或主界面上。
             已经放行就静默放弃，下次启动再说。 */
          if (done) return;
          clearTimeout(guard);
          done = true;
          showContentOffer();
          return;
        } else if (k === 'both' || k === 'shell') {
          /* 包体更新热更覆盖不了：这里必须问玩家一句，
             并且给一个真的能走的出口——跳浏览器下载新安装包。
             以前只把文案改成"客户端需要更新"就放行了，
             玩家什么也做不了，等于白查。 */
          if (done) return;
          clearTimeout(guard);
          done = true;
          showShellOffer(k);
          return;
        }
      }
    } catch (e) {
      msg = '网络不通，先离线游玩';
    }
    clearTimeout(guard);
    if (done) return;
    done = true;
    if (ubar) ubar.style.width = '100%';
    if (text) text.textContent = msg;
    if (orb) orb.classList.add('is-done');
    waiting = false;
    clear();
    timer = setTimeout(() => show(i + 1), 1200);
  }

  /* 列清单 + 询问是否更新。
     这一步是"等玩家点"，所以不设自动推进；只有点了才继续。 */
  function showContentOffer() {
    const remote = (updateResult && updateResult.remote) || {};
    const text = stage.querySelector('#bootUpdText');
    const bar = stage.querySelector('#bootUpdBar');
    const list = stage.querySelector('#bootUpdList');
    const actions = stage.querySelector('#bootUpdActions');
    const foot = stage.querySelector('#bootUpdFoot');
    waiting = true;

    if (bar) bar.style.width = '100%';
    if (text) text.textContent = `发现新版本 v${updateResult.content}（当前 v${version}）`;

    const notes = String(remote.notes || '')
      .split('\n').map((x) => x.trim()).filter(Boolean);
    if (list) {
      if (notes.length) {
        list.innerHTML = notes.map((x) => `<p>· ${x}</p>`).join('');
      } else {
        list.innerHTML = '<p>· 本次更新包含剧情与素材调整</p>';
      }
      list.hidden = false;
    }
    if (foot) foot.textContent = `下载约 ${remote.size ? Math.round(remote.size / 1048576) + ' MB' : '几 MB'} · 不会影响存档`;

    /* 做成浮层弹窗：盖在启动页之上，只有"更新/下次再说"两个出口。
       玩家点掉之前不会继续启动，也就不会在不知情的情况下被换掉资源。 */
    const overlay = document.createElement('div');
    overlay.className = 'boot-modal';
    const noteHtml = notes.length
      ? notes.map((x) => `<li>${x}</li>`).join('')
      : '<li>本次更新包含剧情与素材调整</li>';
    overlay.innerHTML = `
      <div class="boot-modal-card">
        <p class="boot-modal-k">UPDATE AVAILABLE</p>
        <h3 class="boot-modal-h">有新版本 v${updateResult.content}</h3>
        <p class="boot-modal-p">当前 v${version}，这次改了什么：</p>
        <ul class="boot-modal-list">${noteHtml}</ul>
        <p class="boot-modal-meta">${remote.size ? '下载约 ' + Math.round(remote.size / 1048576) + ' MB · ' : ''}不会影响存档</p>
        <div class="boot-upd-actions">
          <button class="boot-btn" id="updLater" type="button">下次再说</button>
          <button class="boot-btn is-primary" id="updNow" type="button">立即更新</button>
        </div>
      </div>`;
    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));

    const later = overlay.querySelector('#updLater');
    const now = overlay.querySelector('#updNow');

    const closeOverlay = () => {
      overlay.classList.remove('on');
      setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 320);
    };

    if (later) later.addEventListener('click', (e) => {
      e.stopPropagation();
      waiting = false;
      closeOverlay();
      if (text) text.textContent = '已跳过本次更新';
      timer = setTimeout(() => show(i + 1), 520);
    });

    if (now) now.addEventListener('click', async (e) => {
      e.stopPropagation();
      now.disabled = true;
      later.disabled = true;
      now.textContent = '正在下载…';
      if (text) text.textContent = '正在下载新资源…';
      const res = typeof applyUpdate === 'function'
        ? await applyUpdate(remote)
        : { ok: false };
      if (res && res.ok) {
        closeOverlay();
        if (text) text.textContent = '已更新，正在重新载入…';
        try {
          if (!sessionStorage.getItem('zb_updated_once')) {
            sessionStorage.setItem('zb_updated_once', String(Date.now()));
            setTimeout(() => location.reload(), 1200);
            return;
          }
        } catch (err) { /* 隐私模式没有 sessionStorage，就不重载 */ }
        waiting = false;
        timer = setTimeout(() => show(i + 1), 800);
      } else {
        now.disabled = false;
        later.disabled = false;
        now.textContent = '重试';
        if (text) text.textContent = res && res.reason === 'no-shell'
          ? '网页版刷新页面即可拿到新版本'
          : '下载没成功（网络或存储问题），可以重试或稍后再来';
      }
    });
  }

  /* 包体更新：网页资源换不掉的那部分（Java 壳 / Electron 运行时）。
     玩家能做的只有去下载新安装包，所以这里直接给下载入口。 */
  function showShellOffer(kind) {
    const remote = (updateResult && updateResult.remote) || {};
    const text = stage.querySelector('#bootUpdText');
    const bar = stage.querySelector('#bootUpdBar');
    const orb = stage.querySelector('#bootOrb');
    waiting = true;
    if (bar) bar.style.width = '100%';
    if (orb) orb.classList.add('is-done');
    if (text) text.textContent = '这次要换安装包';

    const notes = String(remote.notes || '')
      .split('\n').map((x) => x.trim()).filter(Boolean);
    const noteHtml = notes.length
      ? notes.map((x) => `<li>${x}</li>`).join('')
      : '<li>客户端程序有更新，热更新覆盖不到这一部分</li>';

    const overlay = document.createElement('div');
    overlay.className = 'boot-modal';
    overlay.innerHTML = `
      <div class="boot-modal-card">
        <p class="boot-modal-k">CLIENT UPDATE</p>
        <h3 class="boot-modal-h">需要安装新版本</h3>
        <p class="boot-modal-p">${kind === 'both'
          ? '这次连客户端程序一起换了，网页热更新覆盖不到。'
          : '这次的改动在客户端程序里，必须换安装包。'}</p>
        <ul class="boot-modal-list">${noteHtml}</ul>
        <p class="boot-modal-meta">存档在本地，换安装包不会丢 · 也可以先继续玩旧版本</p>
        <div class="boot-upd-actions">
          <button class="boot-btn" id="shellLater" type="button">先继续玩</button>
          <button class="boot-btn is-primary" id="shellGo" type="button">去下载</button>
        </div>
      </div>`;
    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('on'));

    const closeOverlay = () => {
      overlay.classList.remove('on');
      setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 320);
    };

    const later = overlay.querySelector('#shellLater');
    const go = overlay.querySelector('#shellGo');

    if (later) later.addEventListener('click', (e) => {
      e.stopPropagation();
      waiting = false;
      closeOverlay();
      if (text) text.textContent = '继续使用当前版本';
      timer = setTimeout(() => show(i + 1), 520);
    });

    if (go) go.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = (CONFIG.update && CONFIG.update.releaseUrl) || '';
      if (!url) return;
      // 外壳里有桥就走桥，没有就开新标签页
      try {
        const bridge = window.ZBApp || window.zbApp;
        if (bridge && typeof bridge.openUrl === 'function') { bridge.openUrl(url); }
        else if (window.zbShell && typeof window.zbShell.openExternal === 'function') { window.zbShell.openExternal(url); }
        else window.open(url, '_blank', 'noopener');
      } catch (err) {
        try { window.open(url, '_blank', 'noopener'); } catch (e2) { /* 打不开就算了 */ }
      }
      if (text) text.textContent = '已跳转到下载页（没跳过去的话，去发布页手动下载）';
    });
  }

  /* 不再支持"点一下就走下一屏"：
     随手一点就把健康忠告和光敏警告划过去，等于没提示。
     要跳过只能用右下角那个显式的「跳过」按钮。

     「跳过」的含义是"跳过前面这些说明"，不是"跳过整个启动"。
     以前这里直接 finish()，于是点一下就把检查更新和编译着色器
     一起绕过去了——那两屏是要真干活的，绕过去等于带着旧资源进游戏。
     现在最多跳到「检查更新」那一屏，后面的必须自己走完。 */
  const MUST_STOP_KEY = 'update';
  if (skipBtn) skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const cur = BOOT_SCREENS[i];
    // 双保险：就算按钮被别的方式点到，这两屏也不响应
    if (cur && (cur.key === 'update' || cur.key === 'shader')) return;
    const mustIdx = BOOT_SCREENS.findIndex((s) => s.key === MUST_STOP_KEY);
    if (mustIdx > i) {
      clear();
      show(mustIdx);
      return;
    }
    finish();
  });

  root.hidden = false;
  show(0);

  // 返回句柄：外部（比如测试）可以主动结束
  return { finish, get result() { return updateResult; } };
}
