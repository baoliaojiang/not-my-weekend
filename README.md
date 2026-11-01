# 不属于我的周末

> 关于我的学校周末要上课这件事

一款个人制作的非商业 Demo，校园调查题材的视觉小说。当所有人都说一件事是自愿的，一个人是否真的拥有说不的自由。

- 作者：爆料酱 · [B 站主页](https://space.bilibili.com/525298385)
- 类型：文字冒险 / 校园日常 / 剧情解谜
- 适龄：建议 12 周岁以上
- 当前版本：**v0.6.7.0**（最后更新：2026-11-01）

---

## 关于这个项目（先说清楚）

- **这是一个人的业余项目，过程中有 AI 与智能体参与**：剧情梳理、代码、美术与音频的产出都借助了 AI 工具，最后由我统稿和调整。它不是一支团队的作品，也不假装是。
- **剧情只打磨过序章**：序章反复改了很多轮，节奏、对白和演出都还算经得起看；其余章节目前是**初稿**，能完整走完但不代表最终质量，玩法与分支也还不齐全。
- **现在能玩的是骨架，不是成品**。你会遇到衔接生硬、线索不足、某些玩法只有一两个例子这类问题，都属于「还没做完」，欢迎直接提。

## 这是什么

一款**个人制作的非商业 Demo**：高一那年的九月，学校发了一张写着「自愿」的申请表，故事从这里开始。玩家通过观察、聊天、记录和查证，慢慢弄清一张表格背后到底发生了什么。

- 主线 7 章（序章 + 六章）+ 5 条支线，八类结局
- 行动点调查、课堂小测、手机私聊／群聊、材料收集、可填写的政务投诉表单、12345 逐句通话
- 打电话给薄荷或剧情里的任何角色，AI 按各自的人设跟你聊（需自行填写 AI 接口配置）
- **立绘与背景自制**：14 张角色立绘、28 张场景背景，均由本项目生成；**场景配乐为 CC BY 4.0 授权的第三方曲目**（见下方「音乐来源与授权」），标题曲由 AI 音乐模型生成
- 手机界面里的图标与字体是例外，见下方「手机图标与字体」一节

## 直接玩

| 平台 | 产物 |
| --- | --- |
| 网页版 | 见仓库 GitHub Pages 地址（免安装） |
| Windows | Release 里的便携版压缩包，解压后运行 `不属于我的周末.exe` |
| Android | Release 里的 `不属于我的周末-标准版.apk` / `-兼容版.apk`（minSdk 21 / targetSdk 34，横屏全屏） |

存档保存在本地（网页版在浏览器 localStorage，客户端在应用数据目录），覆盖安装不会丢。

## 两个 Android 安装包怎么选

| 包 | 适用 | 差异 |
|---|---|---|
| `不属于我的周末-标准版.apk` | 绝大多数设备 | 用系统 WebView，体积小、启动快 |
| `不属于我的周末-兼容版.apk` | 系统 WebView 内核较旧（Chrome 60–80 区间）的设备 | 内置 polyfill 与降级样式：补上 `closest`/`replaceAll`/`Element.animate` 等缺失 API，关掉毛玻璃与背景推镜，布局不依赖 `:has()` |

先装标准版；如果出现版式错乱、动画不动、面板点不开，再换兼容版。两者存档互通。

**关于"兼容版"要先说清楚**：它**没有内嵌任何浏览器内核**。Android 的 WebView 是系统组件，无法随安装包分发（强行塞进去也不会被加载）。兼容版只解决"布局错乱 / API 缺失"这一层问题。如果设备内核真的老到跑不动（启动时会自动检测到），游戏会弹出提示，并提供「用系统浏览器打开网页版」的入口——网页版由你已安装的 Chrome/Edge 渲染，往往比系统 WebView 还新，能救回一批老机器。真救不了的，提示里会建议你去更新「Android System WebView」或「Chrome」。

## 资源是加密的

APK 与 EXE 里**没有明文的网页资源**。网页内容（剧情、立绘、背景、音乐）打成一个加密包 `www.pkg`，安装包里只剩：

- `assets/www.pkg` —— 加密包本身；
- `assets/boot/index.html` —— 一张几 KB 的过渡页。

首次启动时，客户端在「正在编译着色器」这一步把它解密并解到应用私有目录，之后每启动直接用解好的资源；装新版本（versionCode 变化）才会重新解一次。网页版（GitHub Pages）无法离线解密，仍是明文——它本来就是公开演示。

加密只用于避免"解压安装包就能拿走全部剧情与素材"，不是防逆向。真要逆向的人拦不住，这一点不装作能拦。

## 操作

| 操作 | 说明 |
| --- | --- |
| 点击 / 空格 | 推进对话 |
| Ctrl | 按住快进已读内容 |
| A | 自动播放 |
| 顶栏「手机」 | 游戏内手机：校园通 / 便笺 / 相册 / 计算器 / 聊天 |
| Esc | 菜单 |

## 章节

| # | 章节 | 内容 |
| --- | --- | --- |
| 0 | 序章 · 九月一日 | 开学典礼、领取学习终端、校园通通知、建便笺三栏 |
| 1 | 第一章 · 自愿报名 | 申请表、班会、调查行动 |
| 2 | 第二章 · 自愿签字的人 | 知情确认书、家长群接龙、办公室谈话 |
| 3 | 第三章 · 已收悉 | 收表、服务大厅提交工单、取得回执 |
| 4 | 第四章 · 没有人想成为第一个 | 公告栏、回收统计、立场三选 |
| 5 | 第五章 · 公开的秘密 | 考勤空白、执行链、逐层追问 |
| 6 | 第六章 · 周六之后 | 家长会与结局判定 |

每章结束都有**章节总结**：已经确认的事、还没有答案的事。

支线：《一元口罩》《直饮水》《第八节课》《值日表》《录音》，各自独立存档，不影响主线。

## 技术栈

纯前端，没有框架，也没有后端。

- **渲染**：原生 HTML / CSS / ES Modules
- **音乐**：`tools/make_music.py` 用 numpy 加法合成，ffmpeg 转 mp3
- **图像**：`tools/sprite_cut.py`（泛洪去白底）、`tools/bg_tone.py`（场景昼夜调色）
- **Windows**：Electron 便携包
- **Android**：纯 Java WebView 壳（无 Gradle，aapt2 + d8 + apksigner 直接构建）
- **更新**：自建资源热更新（`scripts/core/update.js` + 各端原生下载器）

## 目录结构

```
scripts/            游戏逻辑
  config/           配置与素材表（assets.js 是素材单一真源）
  core/             引擎：剧情推进、舞台、音频、存档、热更新
  data/             剧本、材料、人物、聊天、更新日志
  ui/               界面：面板、手机（MintOS）、启动序列、政务表单
styles/main.css     全部样式（单文件，按区块注释分组）
assets/             立绘 / 背景 / 音乐 / 音效 / 字体 / 图标
build/              三端构建脚本与 Android 壳源码
tools/              素材生成、核验、剧本转换等工具
```

## 自己构建

需要 Node.js 22+；Android 端另外需要 JDK 与 Android SDK（build-tools 36）。

```bash
node build/make-www.mjs                 # 网页产物 → build/www
node tools/make-dist.mjs --notes "改动" # 发布包 → dist/（含 version.json 与热更 zip）
bash build/build-apk.sh                 # APK → build/out/不属于我的周末.apk
bash build/build-exe.sh                 # EXE → build/out/exe/不属于我的周末/
node tools/audit-assets-v060.mjs        # 素材核验：引用完整性、音量、旧素材残留
```

重新生成素材：

```bash
python tools/make_music.py                                       # 16 段 BGM
python tools/sprite_cut.py 原图.png assets/characters/xxx.png    # 立绘去白底
python tools/bg_tone.py 底图.jpg 输出.jpg dusk                   # 场景调色
```

## 版本与热更新

版本号写在 `scripts/config/game.js` 的 `CONFIG.version`，是唯一真源，构建时同步到 APK 与 EXE。

发布分两条线：

- **content**（网页资源：剧情、立绘、背景、音乐、界面）→ 可热更新，玩家不必重装
- **shell**（客户端程序：Java 壳、Electron 运行时）→ 必须重新安装

`version.json` 同时给出 `content` / `shell` / `shellMin`。客户端读到 `shell < shellMin` 时会明确提示去下载新安装包，不会假装能热更。

**更新前会先问你。** 启动时如果查到新的网页资源，「检查更新」那一屏会列出本次改了哪几条、包有多大，然后给两个按钮：「立即更新」和「下次再说」。不点就一直停在这一屏，不会偷偷下载、也不会自己重载。

下载源按 jsDelivr → GitHub Pages → raw.githubusercontent 的顺序试，哪个先回来用哪个（国内访问 raw 经常不通，所以不把它放在第一位）。

发布页：[Releases](https://github.com/baoliaojiang/not-my-weekend/releases/latest)

发版：推一个 `v*` 标签 → GitHub Actions 构建网页产物 → 部署 Pages → 上传热更包与 `version.json` 到 Release。

> 首次使用前，把 `scripts/config/game.js` 里 `update.baseUrl` 的 `OWNER/REPO` 换成自己的仓库。


## 反馈问题

两种都行，按你方便：

1. **提 Issue**：[新建 Issue](https://github.com/baoliaojiang/not-my-weekend/issues/new) —— 适合能描述清楚的问题。建议附上游戏里导出的日志（设置 → 导出当前日志），一句话顶十句猜。
2. **填问卷**：在游戏主界面右下角点「反馈问题」，或用系统浏览器打开 [问卷](https://wj.qq.com/s2/28441084/m5z9) —— 适合不方便用 GitHub 的情况，可以带截图。

日志里只有版本、设备、启动流程与报错（含资源解包是否成功），不含任何个人信息；导出位置在系统的「下载」文件夹。

## 声明

- 本作是**个人制作的非商业 Demo**，目前免费提供，不对外发售。
- 故事中的学校、人物、组织、地名与事件均为虚构，如有雷同纯属巧合，请勿与现实对号入座。
- 涉及就学安排、家校沟通与程序性表达的情节仅为叙事与思辨之用，**不构成任何法律意见**。
- 全部角色立绘与场景背景由 **AI 生成**；**主题曲由 AI 音乐模型生成**，其余 22 段场景音乐与界面音效由**程序合成**（SoundFont 采样回放、卷积混响、确定性力度起伏）。这些内容均为本项目自制。
- 手机界面里的**图标**来自小米**澎湃 OS 4 默认图标集**，**字体**为 MiSans 与钉钉进步体（详见下一节）。它们是本作唯一使用的第三方图形资源，版权归各自权利人，本项目仅在虚构手机界面中作示意性使用。
- 本作含闪烁与快速切换的画面（如闪回、故障效果），如感不适可在「设置 · 界面动画」中关闭动效。

## 手机图标与字体

游戏里的手机（MintOS 4）是虚构系统，但界面外观照着真实系统来做，所以用了两套现成的图形资源，这里说明来源与用途：

| 资源 | 来源 | 用途 | 权利 |
|---|---|---|---|
| 桌面与应用图标（约 21 枚：薄聊、校园通、浏览器、相机、时钟、天气、相册、音乐、应用商店、游戏中心、文件管理、设置、更新、关于等） | **小米澎湃 OS 4（HyperOS 4）默认图标集**，由作者从自己的设备上取用 | 仅作为虚构手机 MintOS 4 的桌面图标 | 版权归小米科技有限责任公司，本项目不主张任何权利 |
| MiSans | 小米开源字体（OFL） | 全局正文字体 | 依 OFL 授权使用 |
| 钉钉进步体（DingTalk JinBuTi） | 钉钉（中国）信息技术有限公司，官方声明永久免费商用 | 仅用于标题级文字：手机栏目名、版本号、章节名、歌名、跳过摘要卡 | 依钉钉官方的免费商用声明使用，字体文件版权归钉钉 |

几点说明：

- 以上资源仅出现在「手机」这个虚构界面里，是**为了让玩家一眼认出这是一台真实的手机**，不代表与小米或钉钉有任何关联、合作或背书。
- 如果权利人认为使用方式不妥，通过 [B 站私信](https://space.bilibili.com/525298385) 告知，会立刻替换掉。
- 本项目不提供、也不再分发这些图标与字体的原始资源包。

## 许可

本项目采用**分层许可**，完整条款见 [LICENSE](LICENSE)：

| 范围 | 允许 |
|---|---|
| **引擎代码**（`scripts/core`、`scripts/ui`、`build/`、`tools/`） | 学习、修改、非商业复用与再分发；需保留署名与原仓库链接，不得用于商业用途 |
| **故事与素材**（`scripts/data/` 的剧情文本、`assets/` 的立绘 / 背景 / 音乐 / 音效、作品名称与标识） | 保留所有权利。未经许可不得复制、转载、改编、二次创作或商用 |
| **第三方图形**（`assets/icons/` 的澎湃 OS 4 图标、`assets/fonts/` 的 MiSans 与钉钉进步体） | 不属于本项目，版权归小米 / 钉钉；按各自授权条款使用，不随本项目的分层许可转授 |

一句话：**引擎可以拿去学，故事和画面不能拿走。**
需要授权（同人作品、视频搬运等）请通过 B 站私信联系。

## 音乐来源与授权

场景配乐（24 段中的 23 段）来自 **Kevin MacLeod**（[incompetech.com](https://incompetech.com)），
以 **Creative Commons: By Attribution 4.0**（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）授权使用。
该授权**允许商业使用**，条件是保留署名——本节的曲目清单即为署名。

每首曲子都按场景挑过：慢钢琴给安静与沉默、明亮吉他给清晨、Bossa 给食堂、低音弦乐给绷紧的段落。
进游戏前统一做了三件事：截取中段 64 秒、首尾 2 秒交叉淡化（循环无接缝）、
RMS 归一到 −21 dBFS 并把真峰值压到 −3 dBFS 以下。**没有改动原曲的编曲与演奏。**

标题曲 `title.mp3` 由 AI 音乐模型生成，不属于上述授权范围。

| 场景 | 曲目 | 原作者 | 授权 |
|---|---|---|---|
| `daily` | Daily Beetle | Kevin MacLeod | CC BY 4.0 |
| `morning` | Clear Air | Kevin MacLeod | CC BY 4.0 |
| `classroom` | Almost New | Kevin MacLeod | CC BY 4.0 |
| `calm` | Avec Soin | Kevin MacLeod | CC BY 4.0 |
| `calm2` | Facile | Kevin MacLeod | CC BY 4.0 |
| `silent` | Blue Paint | Kevin MacLeod | CC BY 4.0 |
| `room` | Continue Life | Kevin MacLeod | CC BY 4.0 |
| `playground` | Cheery Monday | Kevin MacLeod | CC BY 4.0 |
| `canteen` | BossaBossa | Kevin MacLeod | CC BY 4.0 |
| `relax` | Clear Waters | Kevin MacLeod | CC BY 4.0 |
| `city` | Clean Soul | Kevin MacLeod | CC BY 4.0 |
| `night_street` | Comfortable Mystery | Kevin MacLeod | CC BY 4.0 |
| `office` | Bittersweet | Kevin MacLeod | CC BY 4.0 |
| `hall` | Dreams Become Real | Kevin MacLeod | CC BY 4.0 |
| `sunset` | Aretes | Kevin MacLeod | CC BY 4.0 |
| `hope` | Eternal Hope | Kevin MacLeod | CC BY 4.0 |
| `tense` | Dark Times | Kevin MacLeod | CC BY 4.0 |
| `exam` | Colorless Aura | Kevin MacLeod | CC BY 4.0 |
| `memory` | Danse Morialta | Kevin MacLeod | CC BY 4.0 |
| `goodbye` | At Rest | Kevin MacLeod | CC BY 4.0 |
| `daydream` | Dream Culture | Kevin MacLeod | CC BY 4.0 |
| `rain` | Calmant | Kevin MacLeod | CC BY 4.0 |
| `broadcast` | Eastminster | Kevin MacLeod | CC BY 4.0 |

> 商用前请自行核对上游条款的最新版本；若后续替换曲目，请同步更新本节清单。
