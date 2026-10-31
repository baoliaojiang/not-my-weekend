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

const AUTHOR = {
  name: 'ZhouRi',
  // 从 B 站主页链接里取的空间号，这里直接写完整地址
  bilibili: 'https://space.bilibili.com/525298385',
  github: 'https://github.com/OWNER/REPO'
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
      <span class="boot-rule"></span>
      <p class="boot-author-n">${AUTHOR.name}</p>
      <span class="boot-rule"></span>
      <p class="boot-by">A ONE-PERSON PROJECT</p>
    </div>`
  },
  {
    key: 'logo',
    hold: 2000,
    html: `<div class="boot-logo">
      <h1 class="boot-title">不属于我的周末</h1>
      <span class="boot-rule boot-rule-wide"></span>
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
      <p class="boot-upd-t" id="bootUpdText">正在检查资源更新…</p>
      <div class="boot-upd-bar"><i id="bootUpdBar"></i></div>
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
export function runBootSequence({ root, version, checkUpdate, onDone }) {
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
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-out');
      onDone && onDone();
    }, 620);
  };

  /** 显示第 n 屏；hold=0 的屏由 onEnter 自己决定何时 next */
  function show(n) {
    if (finished) return;
    if (n >= BOOT_SCREENS.length) { finish(); return; }
    i = n;
    const sc = BOOT_SCREENS[n];
    stage.innerHTML = sc.html;
    stage.className = 'boot-stage show-' + sc.key;
    if (bar) bar.style.width = `${((n + 1) / BOOT_SCREENS.length) * 100}%`;

    // 版本号填进去
    const verEl = stage.querySelector('#bootVer');
    if (verEl) verEl.textContent = 'v' + version;

    if (skipBtn) skipBtn.hidden = false;

    if (sc.hold > 0) {
      clear();
      timer = setTimeout(() => show(n + 1), sc.hold);
    }
    if (sc.key === 'update') onUpdateScreen();
  }

  /** 更新检查屏：真正去查，查完给一句结果，停 1.2 秒再进主界面 */
  async function onUpdateScreen() {
    const text = stage.querySelector('#bootUpdText');
    const ubar = stage.querySelector('#bootUpdBar');
    waiting = true;
    if (ubar) ubar.style.width = '30%';
    let msg = '资源已是最新';
    try {
      if (typeof checkUpdate === 'function') {
        if (ubar) ubar.style.width = '65%';
        updateResult = await checkUpdate();
        const k = updateResult && updateResult.kind;
        if (k === 'content' || k === 'both') {
          msg = `发现新版本 v${updateResult.content}，已准备下载`;
        } else if (k === 'shell') {
          msg = '客户端需要更新，进游戏后会提示';
        }
      }
    } catch (e) {
      msg = '网络不通，先离线游玩';
    }
    if (ubar) ubar.style.width = '100%';
    if (text) text.textContent = msg;
    waiting = false;
    clear();
    timer = setTimeout(() => show(i + 1), 1200);
  }

  /* 不再支持"点一下就走下一屏"：
     随手一点就把健康忠告和光敏警告划过去，等于没提示。
     要跳过只能用右下角那个显式的「跳过」按钮。 */
  if (skipBtn) skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    finish();
  });

  root.hidden = false;
  show(0);

  // 返回句柄：外部（比如测试）可以主动结束
  return { finish, get result() { return updateResult; } };
}
