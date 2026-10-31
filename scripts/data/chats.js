/* =========================================================
   聊天数据：会话定义
   ---------------------------------------------------------
   三个群 + 一个单聊。真实学校里这三件事完全不是一回事，
   所以从名字、人数、头像配色到谁在里面说话，都分开：

   · class    班级群 —— 班主任在群里。只有通知、收到、转发。
              学生不会在这里说真话。
   · students 学生群 —— 没有老师。吐槽、试探、传照片都在这里。
   · parents  家长群 —— 只有家长。接龙、报名、互相打听。
   · shen     和沈予安的单聊。

   判断一个群该不该有老师在，是这游戏里最省力也最有效的一次观察。
   ========================================================= */

export const THREAD_KINDS = {
  class:   { label: '班级群', hint: '班主任在群里', tone: 'class' },
  students: { label: '学生群', hint: '没有老师',   tone: 'student' },
  parents: { label: '家长群', hint: '只有家长',    tone: 'parent' },
  dm:      { label: '单聊',   hint: '',            tone: 'dm' }
};

export const THREADS = {
  class:    { id: 'class',    name: '高一（2）班',        sub: '42 人', kind: 'class',    avatar: null, group: true },
  students: { id: 'students', name: '高一（2）班 无老师版', sub: '38 人', kind: 'students', avatar: null, group: true },
  parents:  { id: 'parents',  name: '高一（2）班家长群',   sub: '83 人', kind: 'parents',  avatar: null, group: true },
  shen:     { id: 'shen',     name: '沈予安',              sub: '',      kind: 'dm',       avatar: 'shen' },
  xu:       { id: 'xu',       name: '许小满',              sub: '',      kind: 'dm',       avatar: 'xu' }
};

export function threadMessages(state, thread) {
  return (state.chats || []).filter(m => m.thread === thread);
}

export function threadPreview(state, thread) {
  const list = threadMessages(state, thread);
  if (!list.length) return '';
  const last = list[list.length - 1];
  return last.me ? `我：${last.text}` : last.text;
}

export function threadUnreadCount(state, thread) {
  return threadMessages(state, thread).length;
}

export function totalMessages(state) {
  return (state.chats || []).length;
}

export function threadKind(id) {
  const t = THREADS[id];
  return (t && THREAD_KINDS[t.kind]) || THREAD_KINDS.dm;
}
