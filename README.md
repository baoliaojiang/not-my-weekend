# 不属于我的周末

> 关于我的学校周末要上课这件事

一款校园调查题材的视觉小说（Demo）。当所有人都说一件事是自愿的，一个人是否真的拥有说不的自由。

- 作者：ZhouRi · [B 站主页](https://space.bilibili.com/525298385)
- 类型：文字冒险 / 校园日常 / 剧情解谜
- 适龄：建议 12 周岁以上
- 当前版本：**v0.6.1**

---

## 这是什么

一款**个人制作的非商业 Demo**：高一那年的九月，学校发了一张写着「自愿」的申请表，故事从这里开始。玩家通过观察、聊天、记录和查证，慢慢弄清一张表格背后到底发生了什么。

- 主线 7 章（序章 + 六章）+ 5 条支线，八类结局
- 行动点调查、课堂小测、手机私聊／群聊、材料收集、可填写的政务投诉表单、12345 逐句通话
- **全部素材自制**：14 张角色立绘、28 张场景背景、16 段背景音乐，均由本项目生成，不使用任何第三方素材

## 直接玩

| 平台 | 产物 |
| --- | --- |
| 网页版 | 见仓库 GitHub Pages 地址（免安装） |
| Windows | Release 里的便携版压缩包，解压后运行 `不属于我的周末.exe` |
| Android | Release 里的 `不属于我的周末.apk`（minSdk 21 / targetSdk 34，横屏全屏） |

存档保存在本地（网页版在浏览器 localStorage，客户端在应用数据目录），覆盖安装不会丢。

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

发版：推一个 `v*` 标签 → GitHub Actions 构建网页产物 → 部署 Pages → 上传热更包与 `version.json` 到 Release。

> 首次使用前，把 `scripts/config/game.js` 里 `update.baseUrl` 的 `OWNER/REPO` 换成自己的仓库。

## 声明

- 本作是**个人非商业 Demo**，免费提供，不对外发售，不用于任何商业用途。
- 故事中的学校、人物、组织、地名与事件均为虚构，如有雷同纯属巧合，请勿与现实对号入座。
- 涉及就学安排、家校沟通与程序性表达的情节仅为叙事与思辨之用，**不构成任何法律意见**。
- 全部立绘、背景图像为本项目自制生成，背景音乐与音效为程序合成。
- 本作含闪烁与快速切换的画面（如闪回、故障效果），如感不适可在「设置 · 界面动画」中关闭动效。

## 许可

代码以 MIT 许可开源，可自由学习与修改。
剧本、角色设定与美术素材版权归作者所有，转载或商业使用前请先联系。
