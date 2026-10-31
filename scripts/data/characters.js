/* =========================================================
   人物档案
   ---------------------------------------------------------
   静态资料 + 动态隐藏状态（只给质性描述，不给数值）。
   met 条件：state.flags 中对应的标记。
   ========================================================= */

export const CHARACTERS = {
  shen: {
    id: 'shen',
    name: '沈予安',
    role: '同班同学 · 好友',
    sprite: 'shen',
    metFlag: 'met_shen',
    intro: '从初一开始就坐我斜后方。说话直接，脾气来得快去得也快，但很少真的生气。',
    notes: [
      '九月一日，她书包里有一张对折过很多次的纸。',
      '她不想把这件事闹大，但也不像是对现状满意。'
    ],
    stateKeys: ['trust', 'pressure', 'stance']
  },

  zhou: {
    id: 'zhou',
    name: '周予晴',
    role: '同班同学 · 学习委员',
    sprite: 'zhou',
    metFlag: 'met_zhou',
    intro: '成绩一直在年级前列。她支持周日活动，并且不掩饰这一点。',
    notes: [
      '她提过一个很难回答的问题：如果活动取消了，还需要帮助的人怎么办。',
      '她自己也在这张表格上。'
    ],
    stateKeys: ['trust', 'pressure', 'stance']
  },

  chen: {
    id: 'chen',
    name: '陈老师',
    role: '班主任 · 语文',
    sprite: 'chen',
    metFlag: 'met_chen',
    intro: '带了我们三年。她做事细，话不多，习惯把"没关系"挂在嘴边。',
    notes: [
      '她说"表交上来就行"，然后就换了话题。'
    ],
    stateKeys: ['trust', 'pressure', 'stance']
  },

  xu: {
    id: 'xu',
    name: '许小满',
    role: '同班同学',
    sprite: 'xu',
    metFlag: 'met_xu',
    intro: '消息灵通，说话前习惯先看看周围有没有老师。',
    notes: ['她知道隔壁班的一些做法，但强调是"听来的"。'],
    stateKeys: []
  },

  zheng: {
    id: 'zheng',
    name: '郑野',
    role: '同班同学',
    sprite: 'zheng',
    metFlag: 'met_zheng',
    intro: '坐在最后一排，抱怨最多，但作业一次没落下。',
    notes: ['他表哥的事，他说是"听说的"。'],
    stateKeys: []
  },

  luo: {
    id: 'luo',
    name: '罗一舟',
    role: '同班同学 · 学习委员',
    sprite: 'luo',
    metFlag: 'met_luo',
    intro: '做事一板一眼，收作业会数两遍。喜欢把话说清楚，但不太会看别人的脸色。',
    notes: [
      '他认为问题出在"写得不清楚"，而不是"有没有强制"。',
      '他经手过表格，知道哪些纸最后交给了谁。'
    ],
    stateKeys: ['trust']
  },

  he: {
    id: 'he',
    name: '何雨',
    role: '隔壁三班 · 走读生',
    sprite: 'he',
    metFlag: 'met_he',
    intro: '三班的女生，每天骑二十分钟车上学。说话声音不大，但句子很完整。',
    notes: ['她家的确认书没签。'],
    stateKeys: ['trust', 'pressure']
  },

  sun: {
    id: 'sun',
    name: '孙芃',
    role: '年级组 · 干事',
    sprite: 'sun',
    metFlag: 'met_sun',
    intro: '去年刚入职，管各种表的收发。说话时会下意识用"我们这边"开头。',
    notes: ['他知道那些数字最后变成了什么。'],
    stateKeys: ['trust']
  },

  ma: {
    id: 'ma',
    name: '马文杰',
    role: '家委会 · 家长',
    sprite: 'ma',
    metFlag: 'met_ma',
    intro: '郑野的爸爸。在群里最活跃，习惯把"配合学校工作"挂在嘴边。',
    notes: ['家长群的接龙最初就是他转起来的。'],
    stateKeys: []
  },

  wu: {
    id: 'wu',
    name: '吴建国',
    role: '后勤 · 主任',
    sprite: 'wu',
    metFlag: 'met_wu',
    intro: '五十岁上下，说话不快。办公室堆着打印纸和没拆封的洗手液。',
    notes: [
      '他说“会让负责的人核实”，但没说是谁。',
      '他没有否认过任何一个事实，也从来没有主动说过一个。'
    ],
    stateKeys: []
  },

  zyi: {
    id: 'zyi',
    name: '周姨',
    role: '小卖部 · 经营者',
    sprite: 'zyi',
    metFlag: 'met_zyi',
    intro: '在小卖部柜台后面待了很多年。问她什么，她都答，但只说她知道的那部分。',
    notes: ['“有一箱是旧的，箱子上灰挺厚。”'],
    stateKeys: []
  },

  fu: {
    id: 'fu',
    name: '傅医生',
    role: '保健室 · 校医',
    sprite: 'fu',
    metFlag: 'met_fu',
    intro: '在保健室待了很多年，说话慢。问什么他都答，但只答自己经手过的那一段。',
    notes: [
      '去年冬天他报修过一次，厂家回复“等待配件”。',
      '他留下了唯一一张写着那件事的纸。'
    ],
    stateKeys: []
  }
};

export function getCharacter(id) {
  return CHARACTERS[id] || null;
}
