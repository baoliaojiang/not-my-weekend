/* =========================================================
   人物档案
   ---------------------------------------------------------
   静态资料 + 动态隐藏状态（只给质性描述，不给数值）。
   met 条件：state.flags 中对应的标记。

   ⚠️ 这里的每一句都要和剧情对得上。
      写档案时先到 scripts/data/ch*.js、side*.js 里把这个人
      实际说过的话、坐的位置、班级、身份翻出来，
      再照着写，别凭印象。人物页是玩家核对剧情的地方，
      一句对不上，整份资料的可信度就没了。
   ========================================================= */

export const CHARACTERS = {
  shen: {
    id: 'shen',
    name: '沈予安',
    role: '同班同学 · 好友',
    sprite: 'shen',
    metFlag: 'met_shen',
    intro: '小学同班六年，初中又同校，现在同班，坐我旁边。说话总压着声音，什么都先在心里过一遍才开口。',
    notes: [
      '九月一日下课，她把表折成三折又展开，折痕留在纸上，怎么抹都抹不平。',
      '她不想把这件事闹大，但也不像是对现状满意。'
    ],
    stateKeys: ['trust', 'pressure', 'stance']
  },

  zhou: {
    id: 'zhou',
    name: '周予晴',
    role: '同班同学',
    sprite: 'zhou',
    metFlag: 'met_zhou',
    intro: '二班，短头发，坐我斜前方靠过道那一列。数学笔记要借别人的抄。支持周六活动，因为去年暑假的额外复习对她有用。',
    notes: [
      '她提过一个很难回答的问题：如果活动取消了，还需要帮助的人怎么办。',
      '参加意向登记表上她已登记，但周六申请表交上来的那一版，家长栏是空的。'
    ],
    stateKeys: ['trust', 'pressure', 'stance']
  },

  chen: {
    id: 'chen',
    name: '陈老师',
    role: '班主任',
    sprite: 'chen',
    metFlag: 'met_chen',
    intro: '刚接我们三年。她做事细，说话短，能一句说完的不说两句。',
    notes: [
      '她停了一下，说"表交上来就行"。她没有说表交上去之后会怎么样。'
    ],
    stateKeys: ['trust', 'pressure', 'stance']
  },

  xu: {
    id: 'xu',
    name: '许小满',
    role: '同班同学',
    sprite: 'xu',
    metFlag: 'met_xu',
    intro: '消息灵通。她说自己听来的那些，都会先加一句"这是听来的"。',
    notes: ['她知道隔壁班的一些做法，但强调是"听来的"。'],
    stateKeys: []
  },

  zheng: {
    id: 'zheng',
    name: '郑野',
    role: '同班同学',
    sprite: 'zheng',
    metFlag: 'met_zheng',
    intro: '坐最后一排靠门那边。抱怨最多，作业也最常欠。',
    notes: ['他表哥的事，他说是"听说的"。'],
    stateKeys: []
  },

  luo: {
    id: 'luo',
    name: '罗一舟',
    role: '同班同学 · 学习委员',
    sprite: 'luo',
    metFlag: 'met_luo',
    intro: '学习委员。事情按流程走，每一笔都记下来。确认书的回收和交接是他经手的。',
    notes: [
      '他统计的那张纸上，第三行的学号被划掉了，改成了"已补"。',
      '他经手过表格，知道最后交上去多少张、还差几张没交。'
    ],
    stateKeys: ['trust']
  },

  he: {
    id: 'he',
    name: '何雨',
    role: '隔壁三班',
    sprite: 'he',
    metFlag: 'met_he',
    intro: '三班的女生。她妈接到过学校的电话，她把那段转述给了我。',
    notes: ['她家的确认书没签。'],
    stateKeys: ['trust', 'pressure']
  },

  sun: {
    id: 'sun',
    name: '孙芃',
    role: '年级主任',
    sprite: 'sun',
    metFlag: 'met_sun',
    intro: '开学第一天主持全校典礼，也接年级组收到的信。说话总以"我们"开头。',
    notes: ['他知道那些数字，但没有人知道他拿它们做了什么。'],
    stateKeys: ['trust']
  },

  ma: {
    id: 'ma',
    name: '马文杰',
    role: '家委会 · 家长',
    sprite: 'ma',
    metFlag: 'met_ma',
    intro: '家委会家长。在群里发过接龙通知。他转述的旧消息，自己会加一句"后来就没在群里说了"。',
    notes: ['家长群的接龙最初就是他转起来的。'],
    stateKeys: []
  },

  wu: {
    id: 'wu',
    name: '吴老师',
    role: '保健室 · 老师',
    sprite: 'wu',
    metFlag: 'met_wu',
    intro: '在保健室盖章、登记出勤。谁问她都答，但只答她经手的那一段。',
    notes: [
      '她说"这个我得问问。反正我没经手钱。"',
      '关于那批口罩，她主动说了是被收走的、收去了库房。'
    ],
    stateKeys: []
  },

  zyi: {
    id: 'zyi',
    name: '周姨',
    role: '小卖部 · 经营者',
    sprite: 'zyi',
    metFlag: 'met_zyi',
    intro: '小卖部柜台后面的人。她说过那批货里有一箱是旧的，灰挺厚。',
    notes: ['"有一箱是旧的，箱子上灰挺厚。"'],
    stateKeys: []
  },

  fu: {
    id: 'fu',
    name: '校医',
    role: '保健室 · 校医',
    sprite: 'fu',
    metFlag: 'met_fu',
    intro: '在保健室待着，问什么答什么，只答自己经手过的那一段。',
    notes: [
      '去年十二月，保健室那边报修过一次直饮水机，厂家回复"已联系厂家，等待配件"。',
      '那张复印件的牛皮纸袋里有三张：后勤报修单、厂家回复单，和一张手写的情况说明。'
    ],
    stateKeys: []
  }
};

export function getCharacter(id) {
  return CHARACTERS[id] || null;
}

/* =========================================================
   按当前进度说话
   ---------------------------------------------------------
   以前人物页是"一见面就把整个人抖出来"：不管玩到第几章，
   同一段介绍、同样两条笔记，连还没发生的事都写在上面。
   现在拆成两层：
     · 介绍（intro）是初识印象，永远不变；
     · "此刻"那行和笔记条数，跟着 chapterId 往后走——
       玩到哪一步，就只知道到哪一步。
   ========================================================= */

/** 当前章节序（ch0 → 0） */
export function chapterIndex(state) {
  const id = (state && state.chapterId) || 'ch0';
  const n = parseInt(String(id).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** 一句话：到这一章为止，你和他/她处在什么位置 */
export function charNowLine(state) {
  const i = chapterIndex(state);
  if (i <= 0) return '还没开学。你只在群里见过这个名字。';
  if (i <= 2) return '开学第一周，你们说过几次话，都还很客气。';
  if (i <= 4) return '那一周之后，你们之间多了一点不能明说的东西。';
  return '事情走到这一步，你们都知道有些话回不去了。';
}

/** 笔记按进度解锁：第一章一条，第三章第二条，第五章起全给 */
export function charNotes(c, state) {
  const list = (c && c.notes) || [];
  const i = chapterIndex(state);
  const shown = i <= 1 ? 1 : i <= 3 ? 2 : list.length;
  return list.slice(0, Math.max(0, shown));
}
