# AI 接口连不上的排查记录

> 版本：v0.2.1 ｜ 2026-10-24
> 这次把「配了 Key 还是连不上」这件事查到底了。原因是四个叠加在一起，任何一个都能让测试失败。

---

## 一、四个真实原因

### 1. 安卓包没有联网权限（最致命）

`build/android/AndroidManifest.xml` 里从来没写过 `INTERNET` 权限。

后果：App 能正常打开（本地资源不需要网络），但只要真的往外发请求，系统直接拒绝，浏览器层只会得到一个 `Failed to fetch`。**改模型名、换 Base URL、换 Key 全部无效**——因为它根本没出过手机。

已修复：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 2. 默认模型名已经停用

DeepSeek 于 2026-07-24 停用 `deepseek-chat` / `deepseek-reasoner`，现行模型名是：

| 名称 | 状态 | 说明 |
| --- | --- | --- |
| `deepseek-flash` | **现役** | V4.1 Flash，1M 上下文，支持思考模式 |
| `deepseek-v4-flash` | 兼容路由 | 请求会被路由到 V4.1 Flash |
| `deepseek-chat` | 已停用 | 旧名，现在会报错 |
| `deepseek-reasoner` | 已停用 | 旧名 |

还有一个更隐蔽的坑：**配置存在本机 localStorage 里，会盖住代码里的新默认值**。所以即使把代码里的 `deepseek-chat` 改成 `deepseek-flash`，老用户打开游戏读到的仍然是存着的旧值——看起来就像“改了没用”。

已修复：新增 `MODEL_ALIASES` 迁移表，打开设置页时自动把旧名字就地改掉并提示。

### 3. 思考模式吃光了输出额度

DeepSeek V4 系默认开启思考（thinking）。思考产生的 token 先计入 `max_tokens`，等轮到写正文时额度已经用完，返回的 `content` 是空字符串。

表现：**测试显示连接成功，但回答是空的**；`max_tokens` 设得小时，某些情况下直接 400。

已修复：

- 剧情里的短问答默认关闭思考，请求带 `"thinking": {"type": "disabled"}`；
- 关闭时 `max_tokens` 自动提到 512 以上；
- 设置页给了「思考模式」开关，想深想可以手动打开；
- 真的拿到空正文时，报错会写明「正文为空（多为思考模式吃光 token）」，而不是假装成功。

### 4. 安卓包禁止明文 HTTP

原来 `usesCleartextTraffic="false"`，意味着任何 `http://` 地址都会被系统拦掉：

- 本机 Ollama：`http://localhost:11434/v1`
- 局域网网关：`http://192.168.x.x:8000/v1`
- 自建 one-api / vLLM 中转

已改为 `true`。这是单机应用，地址由用户自己填，风险可控。

> 顺带确认过：跨域（CORS）**不是**问题。实测在普通 http 页面和 `file://` 页面里请求 `api.deepseek.com`，都能正常拿到 401 响应，说明请求确实发出去了、响应也回来了。DeepSeek 会回显 Origin。

---

## 二、现在怎么自查

设置 → 游戏设置 → AI 接入 →「开始诊断」，会跑三步：

| 步骤 | 检查什么 | 失败通常意味着 |
| --- | --- | --- |
| 1. 配置检查 | 地址、模型是否填了，是否还在离线模式 | 没选服务商，或地址/模型为空 |
| 2. 拉取模型列表 `GET /models` | 地址对不对、Key 有没有效 | 401 → Key 错；404 → 地址少了 `/v1`；连不上 → 网络或域名错 |
| 3. 真实对话 `POST /chat/completions` | 端到端能不能出字 | 400 提到 model → 模型名不对；429 → 限流；空正文 → 思考模式 |

第 2 步通过、第 3 步失败，基本就是模型名或参数问题；两步都失败，就是地址或 Key；第 1 步就失败，是配置没保存。

「拉取可用模型」按钮会直接读 `/models`，把账号能用的模型列成下拉框，点一下就能切。当前填的模型不在列表里时，会自动切到第一个可用项并提示——这是最快的自愈方式。

---

## 三、各服务商配置速查

| 服务商 | Base URL | 模型名示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-flash` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Ollama | `http://localhost:11434/v1` | `qwen2.5:7b` |
| 自定义 | 任意兼容地址 | 点「拉取可用模型」选 |

只有主机名（如 `https://api.deepseek.com`）也可以，程序会自动补 `/v1`。

---

## 四、常见报错对照

| 看到的话 | 实际原因 | 怎么改 |
| --- | --- | --- |
| 鉴权失败（401） | Key 错、过期，或多了空格 | 重新复制 Key，注意别带换行 |
| 接口不存在（404） | Base URL 少 `/v1`，或多写了 `/v1` | 只填到 `/v1` 为止，不要带 `/chat/completions` |
| 模型不可用（400 Model Not Exist） | 模型名过时或拼错 | 点「拉取可用模型」重选 |
| 余额不足（402） | 账户没钱了 | 充值，或换服务商 |
| 请求过于频繁（429） | 限流 | 等一会儿再试 |
| 无法连接到接口地址 | 网络不通 / 域名错 / 手机没联网权限 | 先确认浏览器能打开该域名；APK 用 v0.2.1 以上 |
| 接口返回成功，但正文为空 | 思考模式吃光 token | 关掉「思考模式」 |
| 请求超时（45 秒） | 网络太慢或模型排队 | 换更快的模型，或换网络 |

---

## 五、没有 Key 会怎样

不会怎样。这是设计上的硬约束：

- 校园学习助手 → 走内置规则表应答；
- 第五章教育局答复 → 走内置公文稿；
- 接口报错、超时、401 → 弹出提示（带具体原因），正文退回内置稿。

**离线也能从头玩到结局**，八类结局的判定完全不依赖 AI。

---

## 六、验证方式

```bash
node tools/test-ai.mjs      # 33 项：模型列表、三步诊断、旧名迁移、思考模式、设置页 UI
node tools/test-bureau.mjs  # 10 项：公文三态（离线 / 在线 / 接口失败）
```

`test-ai.mjs` 会起一个跨域的模拟接口服务，在真实浏览器里跑完整链路，包括：
`/models` 排序、401 与 400 的文案、`deepseek-chat → deepseek-flash` 迁移、思考开关是否真的写进请求体、空正文是否报错、设置页下拉与诊断结果是否渲染。
