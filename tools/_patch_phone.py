# -*- coding: utf-8 -*-
import io

p = 'scripts/ui/screens.js'
s = io.open(p, encoding='utf-8').read()

# ---------- 1) 会话列表 / 聊天页渲染 ----------
start = s.index("  _renderPhone(thread, reply) {")
end = s.index("  /* ================= 政务服务平台 =================")
new_render = '''  _renderPhone(thread, reply) {
    const isList = thread === 'list';
    const th = THREADS[thread];
    const headTitle = isList ? '微信' : (th ? th.name : '');
    this._phoneThread = isList ? null : thread;
    this.hideChatContinue();

    const avatarOf = (name, sprite) => {
      const img = sprite ? assetUrl('sprite', sprite) : null;
      return img
        ? `<span class="wx-av" style="background-image:url('${img}')"></span>`
        : `<span class="wx-av wx-av-t">${escapeHtml((name || '·').slice(0, 1))}</span>`;
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
            const time = lastMsg.day ? String(lastMsg.day).replace(/^九月/, '9/').replace(/日.*$/, '') : '';
            const unread = t === last && !lastMsg.me;
            return `<button class="wx-item" data-thread="${t.id}">
              ${avatarOf(t.name, t.avatar)}
              <span class="wx-main">
                <span class="wx-name">${escapeHtml(t.name)}</span>
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
      bodyHTML = msgs.map(m => {
        let dayDiv = '';
        if (m.day && m.day !== lastDay) {
          dayDiv = `<div class="wx-time">${escapeHtml(m.day)}</div>`;
          lastDay = m.day;
        }
        if (!m.from) {
          return `${dayDiv}<div class="wx-sys"><span>${escapeHtml(m.text)}</span></div>`;
        }
        const me = !!m.me;
        const inner = `<div class="wx-bub">${escapeHtml(m.text)}</div>`;
        const av = me
          ? avatarOf('我', null)
          : avatarOf(m.from, m.spriteOf || null);
        return `${dayDiv}<div class="wx-row ${me ? 'me' : ''}">
          ${me ? inner + av : av + `<div class="wx-bubwrap">${(th && th.group && m.from) ? `<div class="wx-nick">${escapeHtml(m.from)}</div>` : ''}${inner}</div>`}
        </div>`;
      }).join('') || '<div class="wx-empty">这里还没有对话。</div>';
    }

    const html = `<div class="wx">
      <div class="wx-top">
        ${isList ? '' : '<button class="wx-back" data-back="1" aria-label="返回">‹</button>'}
        <span class="wx-title">${escapeHtml(headTitle)}</span>
        <span class="wx-act">${isList ? '＋' : '⋯'}</span>
      </div>
      <div class="wx-body" id="phoneBody">${bodyHTML}</div>
      ${isList ? '' : `<div class="wx-inputbar">
        <span class="wx-ico">☺</span>
        <span class="wx-input">发送消息…</span>
        <span class="wx-ico">＋</span>
      </div>`}
    </div>`;

    this.openPanel({ title: '手机', body: html, phone: true, lockClose: !!reply });

    const bodyEl = $('#phoneBody');
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;

    this.el.panelBody.querySelectorAll('[data-thread]').forEach(b => {
      b.addEventListener('click', () => { this.audio.sfx('page'); this._renderPhone(b.dataset.thread, null); });
    });
    const back = this.el.panelBody.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { this.audio.sfx('page'); this._renderPhone('list', null); });

    if (reply) {
      // 首次进入也留一点时间让人看到最后一条消息再出选项
      this._queueReplyOptions(reply.node, reply.cb, 420);
    }
  }

'''
s = s[:start] + new_render + s[end:]

# ---------- 2) 追加消息：改成微信气泡 ----------
start = s.index("  /** 往当前会话里追加一条消息 */")
end = s.index("  showTyping() {")
new_append = '''  /** 往当前会话里追加一条消息 */
  appendChatMessage(m) {
    const body = $('#phoneBody');
    if (!body) return;
    const empty = body.querySelector('.wx-empty');
    if (empty) empty.remove();

    const me = !!(m.me || m.from === '我');
    const el = document.createElement('div');
    if (!m.from) {
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
    const bub = `<div class="wx-bub">${escapeHtml(m.text)}</div>`;
    el.className = 'wx-row' + (me ? ' me' : '');
    el.innerHTML = me
      ? bub + av
      : av + `<div class="wx-bubwrap">${(th && th.group) ? `<div class="wx-nick">${escapeHtml(m.from)}</div>` : ''}${bub}</div>`;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

'''
s = s[:start] + new_append + s[end:]

# ---------- 3) 输入中指示 ----------
s = s.replace("""    const t = document.createElement('div');
    t.id = 'chatTyping';
    t.className = 'msg typing';
    t.innerHTML = '<div class="msg-wrap"><div class="typing-dots"><i></i><i></i><i></i></div></div>';""",
"""    const t = document.createElement('div');
    t.id = 'chatTyping';
    t.className = 'wx-row';
    t.innerHTML = '<span class="wx-av wx-av-t">·</span><div class="wx-bub wx-typing"><span class="typing-dots"><i></i><i></i><i></i></span></div>';""")

# ---------- 4) 选项区：做成微信底部弹出的选择 ----------
s = s.replace("""    box.className = 'chat-reply';
    box.innerHTML = `
      ${node.prompt ? `<div class="chat-day">${escapeHtml(node.prompt)}</div>` : ''}
      ${node.options.map((o, i) => `<button data-reply="${i}">${escapeHtml(o.text)}</button>`).join('')}`;""",
"""    box.className = 'wx-reply';
    box.innerHTML = `
      ${node.prompt ? `<div class="wx-reply-tip">${escapeHtml(node.prompt)}</div>` : ''}
      ${node.options.map((o, i) => `<button data-reply="${i}">${escapeHtml(o.text)}</button>`).join('')}`;""")

# ---------- 5) 继续按钮 ----------
s = s.replace("""    box.className = 'chat-continue';
    box.innerHTML = `<button class="btn btn-primary" id="chatContinueBtn">${label}</button>`;""",
"""    box.className = 'wx-continue';
    box.innerHTML = `<button id="chatContinueBtn">${label}</button>`;""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('screens patched')
