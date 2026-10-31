/* =========================================================
   全局可调配置
   ========================================================= */

export const CONFIG = {
  version: '0.6.1',

  // 存储键（改这里不会影响旧存档兼容性，但会各存一份）
  keys: {
    save: 'zbnx.save',
    settings: 'zbnx.settings',
    read: 'zbnx.read',
    // 跨存档的进度记录：哪些章打完过、哪些支线通过、支线最好结果
    progress: 'zbnx.progress'
  },

  // 手动存档位数量（不含自动存档）
  slots: 4,

  // 每日行动点上限（第一章；后续章节可各自覆盖）
  actionPoints: 4,

  // 每字显示间隔（毫秒）
  textSpeeds: [
    { id: 'slow',    label: '慢',   ms: 62 },
    { id: 'normal',  label: '标准', ms: 30 },
    { id: 'fast',    label: '快',   ms: 14 },
    { id: 'instant', label: '瞬显', ms: 0 }
  ],

  // 自动播放：整句显示完后的停顿（毫秒）
  autoDelay: 1250,
  // 跳过模式下每步的最小间隔（毫秒），保证特效/状态更新不被跳过
  skipInterval: 16,

  // 默认设置
  defaultSettings: {
    textSpeed: 'normal',
    autoSpeed: 1,
    bgmVolume: 0.55,
    sfxVolume: 0.5,
    bgmOn: true,
    skipUnreadAsk: true,
    showPlaceTag: true,
    // 对话字号倍率：0.9 小 / 1 标准 / 1.12 大 / 1.25 特大。
    // 乘在 --dlg-size 上，只影响对话正文，不改界面其它字号。
    dlgScale: 1,
    // 界面动效：full 正常 / reduced 只保留必要的淡入淡出。
    // 给晕动症玩家与低端机用，连立绘的位移、面板的滑入一起关掉。
    motion: 'full',
    // 黑暗模式：弹窗、设置、历史这些面板用深色底；关掉回到纸感浅色。
    // 手机模拟器与政务平台是拟真界面，两种模式下都保持浅色。
    nightMode: true,
    // 通透模式（Beta）：全局界面改成半透明 + 背板模糊的玻璃质感。
    // 默认关闭——它靠 backdrop-filter 实现，低端机和部分 WebView 会掉帧，
    // 文字对比度也会比实色底低一档，所以只作为可选效果提供。
    glassMode: false,
    // 画面方向：auto 跟随设备 / portrait 强制竖屏排版 / landscape 强制横屏排版
    // 只影响排版（立绘大小与位置、对话框形态），不改设备方向锁
    screenMode: 'auto',
    // 主角性别：'male' 男主 / 'female' 女主。只影响主角立绘与称谓，不影响剧情走向。
    // 首次开始游戏时由玩家选一次，之后可以在设置里随时切换。
    protagonist: 'male',
    // 主角说话时是否展示自己的立绘。第一人称也展示（《重写3》里就是这么演的），
    // 但有人会嫌"看着自己的后脑勺"出戏，所以给一个开关，默认开启。
    showPlayerSprite: true,
    // 可选 AI 接口：只用于生成政务/教育局答复的措辞。
    // 不填也能玩，所有答复都有内置文案；失败自动回退。
    ai: {
      on: false,
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      apiKey: '',
      temperature: 0.9,
      maxTokens: 1000,
      timeout: 8000,
      systemPrompt: '',
      // 薄荷聊天的自定义提示词：追加在薄荷人设与知识库之后，只影响 AI 助手对话
      chatPrompt: '',
      // AI 助手的搜索模式：打开后先把问题交给搜索接口（若填了地址），
      // 把结果拼进提示词再回答。不填地址时只是提示模型自己去联网。
      searchMode: false,
      searchApi: '',
      searchKey: ''
    }
  },

  /* ---------------------------------------------------------
     热更新配置
     ---------------------------------------------------------
     只更新"网页资源"（剧情、立绘、背景、音乐、界面）。
     APK 的 Java 外壳与 EXE 的 Electron 运行时不在热更范围内——
     改动它们必须让玩家重新装一次客户端，所以 version.json 里
     单独给出 shell / shellMin 两个版本号：
       shell      = 客户端外壳版本（当前安装包是哪个）
       shellMin   = 低于它就必须更新客户端，否则网页资源可能用不上
     网页资源与外壳是两条独立的版本线，代码里用 content 区分。

     baseUrl 留空时按当前站点相对路径取 ./version.json：
       · GitHub Pages 部署 → 自动指向 Pages 域名
       · APK / EXE 的本地资源 → 需要填成远端地址（下面给的默认值）
     */
  update: {
    enabled: true,
    // GitHub 仓库的 raw 地址；换成你自己的用户名/仓库名即可
    baseUrl: 'https://raw.githubusercontent.com/OWNER/REPO/main/dist/',
    // 检查超时与重试
    timeoutMs: 8000,
    retries: 2
  },

  chapterOrder: ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6']
};
