/* =========================================================
   可选 AI 接口
   ---------------------------------------------------------
   用途：让「政务服务平台 / 教育局」的答复由模型现场生成，
   每次措辞略有不同，读起来更像真的办理答复。

   设计原则：
   1. 完全可选。玩家不填任何东西时，游戏照旧使用内置答复文案，
      所有流程、判定、结局一条都不依赖这个接口。
   2. 只走 OpenAI 兼容的 /chat/completions 协议（DeepSeek、通义、
      Moonshot、OpenAI、本地 Ollama/vLLM 都是这个形状）。
   3. 任何失败（没网、CORS、超时、返回格式不对）都静默回退，
      绝不打断剧情：答复面板会直接显示内置文案。
   4. 不做流式。答复面板要一次性排版，流式反而会让节点意见跳动。
   ========================================================= */

const DEFAULTS = {
  on: false,
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  temperature: 0.9,
  maxTokens: 1000,
  timeout: 8000,
  // 追加在每次请求的 system 后面，写给"想调口吻"的玩家用；
  // 留空就等于没有，不影响内置提示词。
  systemPrompt: '',
  // 搜索模式与可选的检索接口（地址里用 {q} 占位）
  searchMode: false,
  searchApi: '',
  searchKey: ''
};

/** 把设置里的 ai 段补齐默认值 */
export function aiConfig(settings) {
  return { ...DEFAULTS, ...((settings && settings.ai) || {}) };
}

/** 是否具备调用条件（只判断"填了没有"，不判断网络） */
export function aiConfigured(settings) {
  const c = aiConfig(settings);
  return !!(c.on && c.baseUrl && c.model);
}

function joinUrl(base, path) {
  return String(base || '').replace(/\/+$/, '') + path;
}

/**
 * 调一次对话补全，只取第一条候选的正文。
 * @param {{settings:object, system?:string, prompt:string, timeout?:number}} opts
 * @returns {Promise<string|null>} 失败一律返回 null，由调用方回退
 */
export async function aiComplete({ settings, system, prompt, timeout }) {
  const cfg = aiConfig(settings);
  if (!aiConfigured(settings)) return null;
  if (typeof fetch !== 'function') return null;

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = timeout || cfg.timeout || DEFAULTS.timeout;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, ms);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    // 自定义提示词接在内置提示词后面：内置的负责把答复写成公文，
    // 玩家额外写的那段只负责调口吻，两者不冲突。
    const extraSystem = String(cfg.systemPrompt || '').trim();
    const sysText = [system || '你是一个中文写作助手。', extraSystem]
      .filter(Boolean).join('\n\n');
    const res = await fetch(joinUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers,
      signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify({
        model: cfg.model,
        temperature: Math.min(2, Math.max(0, Number(cfg.temperature))) || 0,
        max_tokens: Math.max(64, Math.min(8192, Number(cfg.maxTokens) || 1000)),
        messages: [
          { role: 'system', content: sysText },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) {
      console.warn('[ai] 接口返回', res.status);
      return null;
    }
    const data = await res.json();
    const text = data && data.choices && data.choices[0]
      && data.choices[0].message && data.choices[0].message.content;
    if (!text || typeof text !== 'string') return null;
    return text.trim();
  } catch (e) {
    console.warn('[ai] 调用失败，改用内置文案：', e && e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 把模型输出拆成段落：去掉 markdown 记号、空行、编号外的装饰 */
export function toParagraphs(text) {
  if (!text) return [];
  return String(text)
    .replace(/\r/g, '')
    .replace(/^```[a-z]*\s*|```$/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/* ---------------------------------------------------------
   答复正文的生成提示词
   ---------------------------------------------------------
   关键是"写成一个真的会这样回的单位"，而不是写成一封道歉信：
   不认错、不承诺整改到具体程度、把责任摊到"依自愿原则组织"上，
   语气客气、句子长、每段都有出处（经了解 / 经核实 / 学校表示）。
   这正是这类答复最真实的地方，也是这游戏想让人看见的地方。
   --------------------------------------------------------- */
export function buildGovPrompt(kind, facts) {
  const common = [
    '你要写的是一份中国基层政府部门（教育局）通过政务服务平台作出的办理答复。',
    '写作要求：',
    '1. 公文口吻，称呼「同学您好」，结尾「感谢您对教育工作的关心与监督」。',
    '2. 分成 4 到 6 段，每段一句话到三句话，不要小标题以外的修饰。',
    '3. 必须以「经了解」「经核实」「学校表示」「我局已提醒」这类转述句式交代信息来源，',
    '   但永远不给出可核查的数字、人名、单据编号。',
    '4. 不承认违法，不承认过错，不使用道歉、追责、处罚这类词。',
    '5. 把结论落在「依自愿原则组织」「不影响学生评价」「已提醒规范方式方法」这三类表述上。',
    '6. 只输出答复正文，不要标题、不要解释、不要 markdown。'
  ].join('\n');

  const ctx = [
    `反映事项：${facts.subject || '校内有关事项'}`,
    `反映要点：${(facts.points || []).join('；')}`,
    `涉及单位：${facts.unit || '明德中学'}`,
    facts.extra || ''
  ].filter(Boolean).join('\n');

  return `${common}\n\n${ctx}\n\n请写出这份答复。`;
}

/** 内置兜底提示词：模型不可用时不产生任何影响，仅用于日志排查 */
export const AI_SYSTEM = '你熟悉中国基层政务回复的写法，能在不承诺具体整改的前提下把一份答复写得完整、客气、滴水不漏。';

/* ---------------------------------------------------------
   拉取模型列表（GET /models）
   ---------------------------------------------------------
   OpenAI 兼容接口都提供这个端点。返回结构有两三种：
   {data:[{id,owned_by}]}、{models:[...]}、或者直接一个数组。
   全部按行提取 id，并且把失败原因分类，好让人知道是地址错了、
   Key 错了、还是浏览器把跨域拦了——这三种在界面上给的建议完全不同。
   --------------------------------------------------------- */
export async function aiListModels({ settings, timeout } = {}) {
  const cfg = aiConfig(settings);
  if (!cfg.baseUrl) {
    return { ok: false, kind: 'nobase', error: '还没有填接口地址。' };
  }
  if (typeof fetch !== 'function') {
    return { ok: false, kind: 'env', error: '当前环境不支持网络请求。' };
  }

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = timeout || 10000;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, ms);

  try {
    const headers = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const res = await fetch(joinUrl(cfg.baseUrl, '/models'), {
      method: 'GET',
      headers,
      signal: ctrl ? ctrl.signal : undefined
    });

    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403
        ? '接口拒绝了请求，多半是 API Key 不对或者没有这个模型的权限。'
        : res.status === 404
          ? '这个地址下没有 /models。检查一下地址末尾是不是少了 /v1。'
          : `接口返回 ${res.status}。`;
      return { ok: false, kind: 'http', status: res.status, error: hint };
    }

    const data = await res.json();
    const raw = Array.isArray(data) ? data
      : Array.isArray(data && data.data) ? data.data
        : Array.isArray(data && data.models) ? data.models
          : [];

    const list = raw.map((m) => {
      if (typeof m === 'string') return { id: m, owned: '' };
      const id = m && (m.id || m.name || m.model);
      return id ? { id: String(id), owned: String(m.owned_by || m.owner || '') } : null;
    }).filter(Boolean);

    // 去重并按名字排序，本地部署时经常一堆别名指向同一个模型
    const seen = new Set();
    const uniq = [];
    list.forEach((m) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      uniq.push(m);
    });
    uniq.sort((a, b) => a.id.localeCompare(b.id));

    return { ok: true, list: uniq, count: uniq.length };
  } catch (e) {
    const msg = (e && e.message) || '';
    const aborted = msg.indexOf('abort') >= 0;
    return {
      ok: false,
      kind: aborted ? 'timeout' : 'network',
      error: aborted
        ? '等了十秒没有响应，检查地址是否正确、服务是否在跑。'
        : '请求没发出去。浏览器直连常被跨域策略拦下，本地接口可以换成同源代理；也可能只是没联网。'
    };
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   AI 助手用的多轮对话
   ---------------------------------------------------------
   和 aiComplete 的区别：这里要把错误原样交回界面。
   政务答复失败可以静默回退内置文案，但聊天不能——
   玩家发出去一句话，总得有个交代，哪怕是"接口没通"。
   ========================================================= */

/**
 * @param {{settings:object, system:string, messages:Array<{role:string,content:string}>, timeout?:number}} opts
 * @returns {Promise<{ok:boolean, text?:string, kind?:string, error?:string}>}
 */
export async function aiChat({ settings, system, messages, timeout }) {
  const cfg = aiConfig(settings);
  if (!cfg.baseUrl || !cfg.model) {
    return { ok: false, kind: 'nocfg', error: '还没有填接口地址和模型名。' };
  }
  if (typeof fetch !== 'function') {
    return { ok: false, kind: 'env', error: '当前环境不支持网络请求。' };
  }

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = timeout || cfg.timeout || DEFAULTS.timeout;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, ms);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const res = await fetch(joinUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers,
      signal: ctrl ? ctrl.signal : undefined,
      body: JSON.stringify({
        model: cfg.model,
        temperature: Math.min(2, Math.max(0, Number(cfg.temperature))) || 0,
        max_tokens: Math.max(64, Math.min(4096, Number(cfg.maxTokens) || 1000)),
        messages: [
          { role: 'system', content: system || '你是一个中文助手。' },
          ...messages
        ]
      })
    });

    if (!res.ok) {
      /* 429 是限流，不是配置错。给它单独的提示，
         并且在响应头给了 Retry-After 时按它等一等再试。 */
      if (res.status === 429) {
        const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
        return {
          ok: false, kind: 'rate', status: 429,
          retryAfter: Number.isFinite(ra) && ra > 0 ? ra : 0,
          error: '请求太频繁，被接口限流了。等一会儿再试，或者换个模型/接口。'
        };
      }
      const hint = res.status === 401 || res.status === 403
        ? '接口拒绝了请求，多半是 API Key 不对或者这个模型没开通。'
        : res.status === 404
          ? '这个地址下没有 /chat/completions，检查地址末尾是不是少了 /v1。'
          : `接口返回 ${res.status}。`;
      return { ok: false, kind: 'http', error: hint };
    }

    const data = await res.json();
    const text = data && data.choices && data.choices[0]
      && data.choices[0].message && data.choices[0].message.content;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return { ok: false, kind: 'empty', error: '接口回来了，但内容是空的。' };
    }
    return { ok: true, text: text.trim() };
  } catch (e) {
    const msg = (e && e.message) || '';
    const aborted = msg.toLowerCase().indexOf('abort') >= 0;
    return {
      ok: false,
      kind: aborted ? 'timeout' : 'network',
      error: aborted
        ? '等了太久没有响应，可能是模型太慢或者网络卡住了。'
        : '请求没发出去。浏览器直连常被跨域策略拦下，也可能只是没联网。'
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------
   可选的联网检索
   ---------------------------------------------------------
   这里不绑定具体服务商：设置里填一个带 {q} 占位的地址，
   发 GET 请求，把返回的前 1500 个字塞进提示词。
   没填就当作"没有联网能力"，助手会照实说自己查不到。
   --------------------------------------------------------- */
export async function webSearch({ settings, query, timeout = 8000 }) {
  const cfg = aiConfig(settings);
  const tpl = String(cfg.searchApi || '').trim();
  if (!tpl) return { ok: false, kind: 'nosearch', error: '没有配置搜索接口。' };
  if (!query) return { ok: false, kind: 'noquery', error: '没有要查的内容。' };
  if (typeof fetch !== 'function') return { ok: false, kind: 'env', error: '当前环境不支持网络请求。' };

  const url = tpl.indexOf('{q}') >= 0
    ? tpl.replace(/\{q\}/g, encodeURIComponent(query))
    : tpl + (tpl.indexOf('?') >= 0 ? '&' : '?') + 'q=' + encodeURIComponent(query);

  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, timeout);
  try {
    const headers = {};
    if (cfg.searchKey) headers.Authorization = `Bearer ${cfg.searchKey}`;
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl ? ctrl.signal : undefined });
    if (!res.ok) return { ok: false, kind: 'http', error: `搜索接口返回 ${res.status}。` };
    const raw = await res.text();
    let text = raw;
    try {
      const j = JSON.parse(raw);
      // 常见结构都试一遍，取不到就退回原始文本
      text = j.answer || j.summary || j.snippet || j.result
        || (Array.isArray(j.results) ? j.results.map(r => [r.title, r.snippet || r.content].filter(Boolean).join('：')).join('\n') : null)
        || (Array.isArray(j.data) ? j.data.map(r => (typeof r === 'string' ? r : [r.title, r.snippet || r.description].filter(Boolean).join('：'))).join('\n') : null)
        || raw;
    } catch (e) { /* 不是 JSON 就按文本用 */ }
    text = String(text).replace(/\s+/g, ' ').slice(0, 1500);
    if (!text) return { ok: false, kind: 'empty', error: '搜索接口没有返回内容。' };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, kind: 'network', error: '搜索请求失败，可能是跨域或没联网。' };
  } finally {
    clearTimeout(timer);
  }
}
