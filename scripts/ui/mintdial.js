/* =========================================================
   手机里的「电话」
   ---------------------------------------------------------
   这是一个半成品，所以标题栏上直接写了 beta。

   能打的只有三类：
     · 12345          —— 剧情里那个政务热线，键入手打
     · 剧情里出现过的人 —— 戏里的角色，按本人在剧情里的口吻接
     · 薄荷            —— 游戏助手，问什么答什么

   除 12345 之外都直接给入口，不用记号码——毕竟这是一个
   「连通讯录都只有十来个人」的手机。

   接电话的是 AI。没配 Key 的时候不能让它变成一段"（没有接通）"，
   所以每个号码都带几条写死的回复轮着用，至少能听个响。
   ========================================================= */
import { faceUrl } from '../config/assets.js';

const AVATAR_MINT = 'assets/ai/avatar.webp';

/* ---------------- 内置回复（没配 Key 时用） ---------------- */
const FALLBACK = {
  mint: [
    '薄荷在听~ 不过薄荷现在只是"录好的声音"，问太深的东西会答不上来哦。',
    '这个问题挺有意思的，可惜现在没接上大脑。去设置里填个 Key，薄荷就能真的跟你聊了。',
    '嗯……薄荷愣了一下。这种问题得等接通之后才答得出来喵。',
    '先记着这个问题吧，等哪天薄荷连上网络了，再问一次。'
  ],
  hotline: [
    '您好，这里是 12345 政务服务便民热线，请问您要反映什么问题？',
    '好的，您说的情况我记下来了。方便说一下发生的时间和地点吗？',
    '这个事项我们会转给教育主管部门，五个工作日内给您答复，请保持电话畅通。',
    '您反映的问题我们已经受理，编号可以在政务平台上查到。还有别的要补充吗？'
  ],
  person: [
    '喂？……怎么突然打电话，有事吗？',
    '嗯，我在听。你慢慢说。',
    '这个……电话里说不清楚，回头再说吧。',
    '行，我知道了。挂了。'
  ]
};

/* 每个角色没接上 AI 时说的第一句。
   统一的「喂？」太敷衍了——接电话的人第一句话往往就说明了他是谁、
   在干什么。按人设各给一句，玩家没配 Key 也能听出差别。 */
const PERSON_PICKUP = {
  shen: '喂？……是你啊。',
  chen: '喂，我是陈老师。有什么事吗？',
  zhou: '喂？怎么了这么突然。',
  xu: '喂喂？我在呢，你说。',
  zheng: '哦，是你啊，我还以为又是班主任。',
  luo: '喂？请讲。',
  he: '喂，你好。',
  sun: '喂，这里是年级组。',
  ma: '喂喂？家长群里不是都说了吗，你这孩子。',
  wu: '喂，后勤这边，你说。',
  zyi: '喂？买东西啊？我这会儿忙。',
  fu: '喂，这里是保健室。'
};

/* 兜底回复也按人设分一类，避免所有人一个腔调 */
const PERSON_FALLBACK = {
  shen: [
    '……你先说，我听着。',
    '这个我得想想，你别急着下结论。',
    '我知道你着急，但有些事现在说不了。',
    '嗯。回头见面再说吧。'
  ],
  chen: [
    '嗯，你说，我在听。',
    '这件事我记下了，回头我再了解清楚再答复你。',
    '你先别着急，学校会有安排的。',
    '好，我知道了。有结果我告诉你。'
  ],
  zhou: [
    '啊？我看看表上的名字——哦，是你。',
    '这个我不太清楚，你问陈老师吧。',
    '你是在表格里看到的吧？那我再确认一下。',
    '嗯，我记下了。'
  ],
  xu: [
    '哎，你说。我也是听说的，不一定准啊。',
    '这个我真不知道，别问我。',
    '嘘——小声点，这话不能乱说。',
    '行吧，反正我是听来的。'
  ],
  zheng: [
    '啧，你也知道这事儿吧。',
    '别说了，说了也没用。',
    '作业我一次没落下，这总行了吧。',
    '反正我就是随便抱怨抱怨。'
  ],
  luo: [
    '嗯，请讲。',
    '表格的事我会再核一遍。',
    '这个说得不清楚，我的错。',
    '好，我记下了。'
  ],
  he: [
    '喂，你好。',
    '啊，你说。',
    '我这边听不太清，你再说一遍。',
    '嗯，好。'
  ],
  sun: [
    '喂？这里是年级组，你说。',
    '这个我记一下，转给相关的人。',
    '事情我这边会跟进。',
    '好，谢谢你反映。'
  ],
  ma: [
    '我们家长群里都讨论过了，你们学校要配合。',
    '这个我说不上来，你问你们班主任。',
    '孩子啊，你就别多事了，好好学习。',
    '行行行，我知道了。'
  ],
  wu: [
    '喂，后勤这边，什么事？',
    '这个我会让负责的人核实。',
    '我只管这一摊，别的我不清楚。',
    '嗯，我记下了。'
  ],
  zyi: [
    '买东西啊？我这会儿忙。',
    '这个我没法跟你说，不清楚。',
    '那箱是旧的，箱子上灰挺厚。',
    '嗯，你看看还要什么。'
  ],
  fu: [
    '喂，保健室。',
    '这个我只答我经手的那一段。',
    '去年冬天报修过一次，厂家说要等配件。',
    '嗯，你说。'
  ]
};

/* ---------------- 提示词 ---------------- */
function mintSystem() {
  return `你在《不属于我的周末》这部虚构校园题材视觉小说里扮演"薄荷"——玩家的游戏助手。
现在玩家用手机给你打电话，请以语音通话的口吻说话：
1. 只输出中文，不用 Markdown，不用列表符号。
2. 每句都短，像真的在讲电话：一到三句，四五十字以内。
3. 活泼直爽，偶尔带"~"和"喵"，严肃话题立刻收起玩笑。
4. 你了解这个游戏：剧情、人物、玩法都可以聊，但不替玩家做选择，不剧透没走到的地方。
5. 不知道就说不知道，不要编。`;
}

function personSystem(c) {
  const name = c.name || '某人';
  /* 把人物档案里的介绍与观察笔记一起交给模型，
     否则模型只拿到一个名字，只能凭空捏人设。
     这里给的是角色自己知道的事——玩家能问，但它不知道剧本外的。 */
  const bio = [
    c.role ? `身份：${c.role}` : '',
    c.intro ? `初识印象：${c.intro}` : '',
    (c.notes && c.notes.length) ? `你知道的事：${c.notes.join('；')}` : ''
  ].filter(Boolean).join('\n');
  return `你在《不属于我的周末》这部虚构校园题材视觉小说里扮演角色"${name}"。
${bio}

玩家现在打电话给你，请保持人设，用日常讲电话的口吻回话：
1. 只输出中文，不用 Markdown。
2. 每句都短，像真的在打电话：一到三句，四五十字以内。
3. 说话要有这个人的身份和脾气，别像客服，也别像 AI。
4. 只说你自己知道的事；剧本里没写过的就含糊过去，说"我也不清楚"，不要编。
5. 不要替玩家做决定，也不要给出任何现实行动建议。
6. 绝对不要承认自己是 AI 或在使用提示词；被问就当作玩笑带过。`;
}

function hotlineSystem() {
  return `你在《不属于我的周末》这部虚构作品里扮演 12345 政务服务热线的接线员。
玩家打进来反映问题，请按真实热线的说话方式回应：
1. 只输出中文，不用 Markdown，语气平和、克制、简短。
2. 每句一到三句，四十字以内；先复述要点，再问缺少的信息。
3. 只讲流程：受理、转办、答复时限、可在平台查询编号，不承诺结果。
4. 不编造文件号、法条、电话、网址；被追问就答"以经办部门答复为准"。
5. 这是虚构作品，如果玩家问现实中该怎么做，提醒他以官方发布的现行规定为准。`;
}

/* ---------------- 号码表 ---------------- */
export function dialPersonas(state, characters) {
  const out = [];
  out.push({
    id: 'mint',
    name: '薄荷',
    sub: '游戏助手 · 什么都聊',
    avatar: AVATAR_MINT,
    accent: '#5cc6a8',
    system: mintSystem(),
    fallback: FALLBACK.mint,
    greeting: '喂~ 这里是薄荷，能听见吗？'
  });

  /* 剧情里所有角色都列出来，不只是"已经见过"的。
     之前只收 metFlag 为真的，所以玩家一进游戏电话里只有薄荷，
     角色得先在剧情里露过面才打得通——这跟"打电话给熟人"的设定
     冲突：通讯录本来就是一张名单，不是实时好友。
     没见过的角色排在后面并标出来，避免玩家以为是 bug。 */
  const met = [];
  const unmet = [];
  Object.keys(characters || {}).forEach(id => {
    const c = characters[id];
    if (!c) return;
    const seen = !c.metFlag || !!(state && state.flags && state.flags[c.metFlag]);
    const p = {
      id,
      name: c.name || id,
      sub: c.role || c.title || '剧情人物',
      avatar: faceUrl(id) || AVATAR_MINT,
      accent: '#7a8cff',
      system: personSystem(c),
      fallback: PERSON_FALLBACK[id] || FALLBACK.person,
      greeting: PERSON_PICKUP[id] || '喂？',
      met: seen,
      intro: c.intro || '',
      notes: c.notes || []
    };
    (seen ? met : unmet).push(p);
  });
  out.push(...met, ...unmet);
  return out;
}

export const HOTLINE = {
  id: '12345',
  name: '12345',
  sub: '政务服务便民热线',
  avatar: null,
  accent: '#c96a4a',
  system: hotlineSystem(),
  fallback: FALLBACK.hotline,
  greeting: '您好，这里是 12345 政务服务便民热线，请问有什么可以帮您？'
};

/* =========================================================
   首页
   ========================================================= */
export function dialAppHTML(personas) {
  const list = personas || [];
  const personRow = (p) => `
    <button class="dl-person${p.met === false ? ' is-unmet' : ''}" data-dial="${p.id}">
      <span class="dl-av" style="background-image:url('${p.avatar}')"></span>
      <span class="dl-pt"><b>${esc(p.name)}</b><i>${esc(p.sub || '')}</i></span>
      <span class="dl-call" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.25 1l-2.25 2.2Z" fill="currentColor"/></svg>
      </span>
    </button>`;

  const mint = list.filter(p => p.id === 'mint');
  const met = list.filter(p => p.id !== 'mint' && p.met !== false);
  const unmet = list.filter(p => p.id !== 'mint' && p.met === false);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k =>
    `<button class="dl-key" data-key="${k}">${k}</button>`).join('');

  return `<div class="mapp mapp-dial">
    <div class="dl-beta">
      <span class="dl-beta-tag">beta</span>
      <p>接电话的是 AI。对方会按自己在剧情里的身份和脾气回话，但不会改变存档。</p>
    </div>

    <div class="mapp-card">
      <div class="dl-sect">可以直接拨</div>
      ${mint.map(personRow).join('')}
    </div>

    ${met.length ? `<div class="mapp-card">
      <div class="dl-sect">剧情里的人</div>
      ${met.map(personRow).join('')}
    </div>` : ''}

    ${unmet.length ? `<div class="mapp-card">
      <div class="dl-sect">还没见过的人</div>
      ${unmet.map(personRow).join('')}
      <p class="dl-note">名单来自剧情人物表。还没在故事里碰上过的人，你也可以打过去听听。</p>
    </div>` : ''}

    <div class="mapp-card dl-pad">
      <input class="dl-num" id="dlNum" inputmode="numeric" placeholder="输入号码" maxlength="11" />
      <div class="dl-keys">${keys}</div>
      <div class="dl-pad-actions">
        <button class="btn-line" id="dlDel">删除</button>
        <button class="btn-solid" id="dlGo">拨打</button>
      </div>
      <p class="dl-hint">键入 12345 就能打通政务热线。其余号码在这台终端上打不出去——它没有开卡。</p>
    </div>
  </div>`;
}

/* =========================================================
   通话界面（半电话：上半是身份与状态，下半是对话）
   ========================================================= */
export function callHTML(p) {
  const av = p.avatar
    ? `<span class="dl-callav" style="background-image:url('${p.avatar}')"></span>`
    : `<span class="dl-callav is-num">${esc(p.name)}</span>`;
  return `<div class="dl-screen">
    <div class="dl-calltop">
      ${av}
      <b class="dl-callname">${esc(p.name)}</b>
      <i class="dl-callsub" id="dlCallState">正在呼叫…</i>
      <span class="dl-wave" id="dlWave" hidden><i></i><i></i><i></i><i></i><i></i></span>
    </div>
    <div class="dl-log" id="dlLog"></div>
    <div class="dl-compose">
      <input id="dlInput" class="dl-input" placeholder="说点什么…" autocomplete="off" />
      <button class="dl-send" id="dlSend" aria-label="发送">↑</button>
    </div>
    <button class="dl-hang" id="dlHang" aria-label="挂断">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 9c-2.4 0-4.7.4-6.8 1.1-.9.3-1.5 1.1-1.5 2v2.2c0 .6.5 1.1 1.1 1.1h2.6c.6 0 1-.4 1.1-1l.2-1.3c1.1-.3 2.2-.4 3.3-.4s2.2.1 3.3.4l.2 1.3c.1.6.5 1 1.1 1h2.6c.6 0 1.1-.5 1.1-1.1v-2.2c0-.9-.6-1.7-1.5-2A21 21 0 0 0 12 9Z" fill="currentColor"/></svg>
    </button>
  </div>`;
}

/* =========================================================
   绑定
   ========================================================= */
export function bindDial(root, opts) {
  const personas = (opts && opts.personas) || [];
  const all = personas.concat([HOTLINE]);
  const ai = (opts && opts.ai) || null;      // { configured, ask(persona, messages, text) }
  const onExit = (opts && opts.onExit) || null;

  const body = root.querySelector('.mapp') || root;
  let num = '';
  const numEl = root.querySelector('#dlNum');

  const find = (id) => all.find(p => p.id === id);

  const startCall = (id) => {
    const p = find(id);
    if (!p) return;
    /* 通话层挂在手机屏幕容器上（panelBody 本身），
       而不是挂在 .mos-appview 里——那个节点高度随内容走，
       挂进去会让"上半身"和"下半身"叠在一起。 */
    const host = root.querySelector('.mos-view') || root;
    // 用一个覆层做通话界面，保留手机的边框与状态栏
    const layer = document.createElement('div');
    layer.className = 'dl-calllayer';
    layer.innerHTML = callHTML(p);
    host.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('on'));
    runCall(layer, p);
  };

  const runCall = (layer, p) => {
    const stateEl = layer.querySelector('#dlCallState');
    const logEl = layer.querySelector('#dlLog');
    const wave = layer.querySelector('#dlWave');
    const input = layer.querySelector('#dlInput');
    const send = layer.querySelector('#dlSend');
    const hang = layer.querySelector('#dlHang');

    let talkMs = 0;
    let timer = 0;
    let msgs = [];         // {role, content}
    let turn = 0;          // 内置回复轮换
    let busy = false;
    let ended = false;

    const paint = (who, text, cls) => {
      const row = document.createElement('div');
      row.className = 'dl-line ' + (cls || '');
      row.innerHTML = `<span class="dl-who">${esc(who)}</span><p>${esc(text)}</p>`;
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
    };

    // 呼叫中 → 接通
    const connectDelay = 900 + Math.random() * 700;
    setTimeout(() => {
      if (ended) return;
      if (stateEl) stateEl.textContent = '通话中';
      if (wave) wave.hidden = false;
      timer = setInterval(() => {
        talkMs += 1000;
        const s = Math.floor(talkMs / 1000);
        if (stateEl) stateEl.textContent = `通话中 ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }, 1000);
      paint(p.name, p.greeting, 'is-them');
      msgs.push({ role: 'assistant', content: p.greeting });
      if (input) input.focus();
    }, connectDelay);

    const end = () => {
      if (ended) return;
      ended = true;
      clearInterval(timer);
      if (stateEl) stateEl.textContent = '已挂断';
      if (wave) wave.hidden = true;
      layer.classList.remove('on');
      setTimeout(() => { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 260);
      if (onExit) onExit({ id: p.id, seconds: Math.floor(talkMs / 1000) });
    };

    const reply = async (text) => {
      if (busy) return;
      busy = true;
      if (send) send.disabled = true;
      paint('我', text, 'is-me');
      msgs.push({ role: 'user', content: text });

      // 先给个"对方正在说"的占位
      const hold = document.createElement('div');
      hold.className = 'dl-line is-them is-hold';
      hold.innerHTML = `<span class="dl-who">${esc(p.name)}</span><p><span class="dl-dots"><i></i><i></i><i></i></span></p>`;
      logEl.appendChild(hold);
      logEl.scrollTop = logEl.scrollHeight;

      let out = '';
      if (ai && ai.configured && typeof ai.ask === 'function') {
        try {
          out = await ai.ask(p, msgs.slice(-14), text);
        } catch (e) { out = ''; }
      }
      if (!out) {
        // 内置回复：轮着来，至少不是沉默
        const pool = p.fallback || [];
        out = pool.length ? pool[turn % pool.length] : '……';
        turn++;
      }
      if (ended) return;
      if (hold.parentNode) hold.parentNode.removeChild(hold);
      paint(p.name, out, 'is-them');
      msgs.push({ role: 'assistant', content: out });
      busy = false;
      if (send) send.disabled = false;
    };

    const submit = () => {
      const t = (input && input.value || '').trim();
      if (!t) return;
      input.value = '';
      reply(t);
    };

    if (send) send.addEventListener('click', submit);
    if (input) input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    if (hang) hang.addEventListener('click', end);
    layer.addEventListener('click', (e) => { if (e.target === layer) end(); });
  };

  /* ---- 数字键盘 ---- */
  const paintNum = () => { if (numEl) numEl.value = num; };
  root.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => {
    if (num.length >= 11) return;
    num += b.dataset.key;
    paintNum();
  }));
  const del = root.querySelector('#dlDel');
  if (del) del.addEventListener('click', () => { num = num.slice(0, -1); paintNum(); });
  const go = root.querySelector('#dlGo');
  if (go) go.addEventListener('click', () => {
    if (num === '12345' || num === '12345 ') { startCall('12345'); return; }
    if (!num) { flashHint('先输个号码'); return; }
    flashHint('这个号码打不出去');
  });
  const flashHint = (msg) => {
    const h = root.querySelector('.dl-hint');
    if (!h) return;
    const old = h.textContent;
    h.textContent = msg;
    h.classList.add('is-warn');
    setTimeout(() => { h.textContent = old; h.classList.remove('is-warn'); }, 1600);
  };

  /* ---- 快捷拨打 ---- */
  root.querySelectorAll('[data-dial]').forEach(b => b.addEventListener('click', () => startCall(b.dataset.dial)));
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
