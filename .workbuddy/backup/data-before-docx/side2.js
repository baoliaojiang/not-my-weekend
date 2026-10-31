/* =========================================================
   支线 ·《直饮水》
   ---------------------------------------------------------
   独立于主线的第二条调查支线，从标题页「支线」入口进入。
   核心问题：一台没人记录维护的机器，要坏到什么程度，才有人承认它坏了？

   写作口径（v0.3.1 重写）：
   1. 只写看得见的：日期、读数、原话、动作。不替角色下结论。
   2. 不用"不是A，而是B"式否定排比，也不在段末加格言。
   3. 没有人做坏事。问题是这台机器从二〇二四年十月起就没有"今天"的记录，
      而每一个环节的人都能说清自己那一段。
   4. 结果由动作决定：有没有实测、有没有拿到记录、有没有问过喝过的人、
      有没有在核实前把话说满、校内有没有留下追问。

   材料：M043–M054
   人物：傅医生（校医）、吴建国（后勤主任）、周姨（小卖部）、
        何雨（三班）、罗一舟（学习委员）、马文杰（家长）
   时间：2025 年 9 月 19 日 · 周五（第三周）
   ========================================================= */

import { hasMaterial } from '../core/state.js';

/* ---------------- 结果判定 ----------------
   优先级：隐藏 → 查明 → 部分查明 → 陷入争议 → 只有程序进展 */
export function decideSide2Result(state) {
  const f = state.flags || {};
  const has = (id) => hasMaterial(state, id);

  const base = has('M043') && has('M045');           // 现场记录 + 公示照片
  const record = has('M044');                        // 滤芯更换记录
  const repair = has('M046');                        // 报修登记
  const measured = has('M049');                      // TDS 读数
  const drank = has('M047') || has('M052');          // 问过喝过的人
  const blank = has('M053');                         // 空白维护表
  const publish = has('M054');                       // 公示为什么不上网

  const schoolChannel = !!f.s2_school_record;
  const anyChannel = (f.s2_channels || 0) >= 1;
  const publicClaim = !!f.s2_public_claim;

  if (base && record && repair && measured && drank && blank && publish &&
      schoolChannel && anyChannel && !publicClaim) return 'hidden';
  if (base && record && anyChannel) return 'clear';
  if (publicClaim && !record) return 'dispute';
  if (base && (repair || measured)) return 'partial';
  return 'procedural';
}

/* ---------------- 政务平台：这台直饮水的办理进度 ----------------
   卫健部门管水质检测，教育部门管学校设备管理，两顶帽子扣在一台机器上，
   于是两市一区最后都只回自己那一段。 */
export function waterProgress(state) {
  const gov = (state.gov && state.gov.kind === 'water') ? state.gov : {};
  const no = gov.no || 'WS2025091921537';
  const t0 = gov.time || '2025-09-19 22:08';
  return {
    no,
    subject: '反映明德中学三楼直饮水机维护记录与水质公示长期未更新',
    unit: '市卫生健康委员会 / 市教育局',
    nodes: [
      {
        title: '提交', time: t0, who: '本人 · 市政务服务平台', state: '已提交',
        opinion: '反映对象：明德中学（教学楼三楼走廊直饮水机）。已勾选真实性承诺。'
      },
      {
        title: '受理', time: '2025-09-22 09:12', who: '市政务服务热线', state: '已受理',
        opinion: '事项已受理。涉及饮用水卫生与学校设备管理，分别转卫生健康、教育主管部门。'
      },
      {
        title: '交办', time: '2025-09-22 15:40', who: '市卫生健康委员会', state: '已交办',
        opinion: '转卫生监督机构核实该设备的滤芯更换与检测情况，抄送市教育局。'
      },
      {
        title: '承办', time: '2025-09-26 10:05', who: '市卫生健康委员会 · 卫生监督', state: '办理中',
        opinion: '已联系学校调阅设备维护记录与最近一次检测报告。'
      },
      {
        title: '答复', time: '2025-10-14 16:20', who: '市卫生健康委员会', state: '已办结',
        opinion: '办理结果已通过本页面答复，并同步发送短信提示。'
      }
    ],
    reply: [
      '同学您好！您反映的情况收悉，现将有关情况答复如下：',
      '一、关于设备维护。经了解，该校教学楼三楼直饮水机由学校后勤部门负责日常管理，滤芯更换由供货单位按合同约定周期上门实施。学校表示，更换作业完成后未及时在机身维护卡片上登记，属记录填写不规范。',
      '二、关于水质检测。该校最近一次水质检测由具备资质的第三方机构实施，检测结果符合当时执行的标准，报告已在校内张贴公示。我局已要求学校按规定的周期委托检测，并及时更新公示内容。',
      '三、关于异味问题。经现场查看，该设备出水口存在水垢，学校已安排清洗。感官异常可能与管路长期未清洗有关，我局已要求学校将清洗纳入日常维护。',
      '四、关于记录缺失。我局已要求学校完善设备维护台账，做到更换、清洗、检测逐项留痕，并接受师生监督。',
      '感谢您对学校卫生工作的关心。'
    ],
    tail: '本答复由市卫生健康委员会通过市政务服务平台作出，可凭事项编号查询。'
  };
}

/* 交给模型重写时的要点：骨架固定，只换措辞 */
export const WATER_AI_BRIEF = {
  kind: 'water',
  facts: {
    subject: '反映明德中学三楼直饮水机维护记录停在去年十月、水质公示长期未更新、出水有异味',
    unit: '明德中学',
    points: [
      '机身《设备维护记录》最后一次填写日期为 2024 年 10 月 8 日',
      '走廊张贴的水质检测报告日期为 2024 年 10 月 16 日，此后未更新',
      '2024 年 12 月 19 日报修，回复称已处理，未见书面闭环',
      '出水有异味，出水口有水垢，机器运行本身正常',
      'TDS 读数与公示数值存在差异，但不同测法读数不同'
    ],
    extra: '答复的结论口径必须是：维护记录填写不规范、已要求完善台账；检测当时合格、已要求按周期复检；异味归因于水垢与管路清洗，不承认水质不合格。不要出现处罚、追责、具体读数。'
  }
};

export const WATER_FORM_PROGRESS = (no, time) => ({
  no,
  unit: '市卫生健康委员会',
  subject: '反映明德中学三楼直饮水机维护记录与水质公示长期未更新',
  nodes: [
    { title: '提交', time, who: '本人 · 市政务服务平台', state: '已提交',
      opinion: '已提交，勾选真实性承诺。' },
    { title: '受理', time: '2025-09-22 09:12', who: '市政务服务热线', state: '已受理',
      opinion: '事项已受理，分别转卫生健康、教育主管部门办理。' },
    { title: '答复', time: '', who: '市卫生健康委员会 · 卫生监督', state: '办理中', done: false,
      opinion: '正在办理，答复后将通过本页面或短信告知。' }
  ],
  reply: ['您的反映已受理，正在办理中。', '办理完成后，答复内容会出现在「进度查询详情」的节点意见里。']
});

export default {
  id: 'side2',
  title: '支线',
  name: '直饮水',
  dayLabel: '第三周 · 周五',
  music: 'calm2',
  // 13 个行动里选 8 个。隐藏结果要求六份东西齐全，8 点是刚刚够。
  apMax: 8,

  nodes: [
    /* ================= 一、一杯水 ================= */
    { t: 'bg', id: 'corridor', place: '教学楼三楼 · 上午大课间' },
    { t: 'music', id: 'daily' },
    { t: 'narr', text: '九月十九号，星期五，三十四度。' },
    { t: 'narr', text: '上午大课间，三楼走廊尽头排了六个人。' },
    { t: 'narr', text: '一台直饮水机，白色外壳，红色按键，下面两个龙头。' },
    { t: 'narr', text: '机器侧面贴着一张塑封的纸，边角卷起来了。' },
    { t: 'narr', text: '轮到我的时候，我按了红色那个。' },
    { t: 'narr', text: '水出来得有点慢，先是一股气，然后才出水。' },
    { t: 'narr', text: '我接了大半杯，喝了一口。' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '有味道。' },
    { t: 'narr', text: '说不上是哪种。像放了一夜的白开水，杯底那一点。' },
    { t: 'narr', text: '我又喝了一口，还是有。' },
    { t: 'narr', text: '后面有人催，我让开位置。' },
    { t: 'narr', text: '那个人接了满满一瓶，仰头喝了半瓶，拧上盖子走了。' },
    { t: 'narr', text: '他没有说什么。' },

    { t: 'narr', text: '我站在旁边看那张塑封的纸。' },
    { t: 'narr', text: '《饮用水水质检测公示》。' },
    { t: 'narr', text: '检测单位、检测项目、结论、日期。' },
    { t: 'narr', text: '结论那一栏：合格。' },
    { t: 'narr', text: '日期那一栏：二〇二四年十月十六日。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '今天是二〇二五年九月十九日。' },
    { t: 'narr', text: '这张纸贴了十一个月。' },

    {
      t: 'choice',
      prompt: '先看哪一样？',
      options: [
        { text: '把公示看仔细', goto: 's2_pg' },
        { text: '蹲下来看机器', goto: 's2_machine' },
        { text: '问一句刚接完水的人', goto: 's2_ask' }
      ]
    },

    /* ---- 分支一：公示 ---- */
    { t: 'label', name: 's2_pg' },
    { t: 'bg', id: 'corridor', place: '走廊 · 直饮水机前' },
    { t: 'narr', text: '塑封纸用四颗图钉按在墙上，下面两颗已经锈了。' },
    { t: 'narr', text: '项目一共九项：色度、浑浊度、臭和味、肉眼可见物、pH、' },
    { t: 'narr', text: '总硬度、耗氧量、菌落总数、总大肠菌群。' },
    { t: 'narr', text: '每一项后面都是「合格」，最后一行是检测单位盖章的位置。' },
    { t: 'narr', text: '章是红的，盖得有点斜。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '我把手机举起来，把整张纸拍进去。' },
    { t: 'narr', text: '拍完放大看，日期确实是二〇二四年十月十六日。' },
    { t: 'narr', text: '右下角还有一行小字：本报告仅对送检样品负责。' },
    { t: 'narr', text: '送检样品。' },
    { t: 'narr', text: '也就是说，检的是那一瓶水，不是这台机器。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '我蹲下来。' },
    { t: 'narr', text: '出水口外面那一圈积着黄褐色，指甲刮不动。' },
    { t: 'narr', text: '水垢是一层一层长出来的，边上那层已经发硬。' },
    { t: 'mat', id: 'M043' },
    { t: 'mat', id: 'M045' },
    { t: 'goto', label: 's2_join' },

    /* ---- 分支二：机器 ---- */
    { t: 'label', name: 's2_machine' },
    { t: 'bg', id: 'corridor', place: '走廊 · 直饮水机侧面' },
    { t: 'narr', text: '我蹲下来，从侧面看这台机器。' },
    { t: 'narr', text: '铭牌在右下方：明德 HS-20 直饮水机，出厂二〇二一年四月。' },
    { t: 'narr', text: '铭牌旁边贴着一张巴掌大的卡片，塑料膜里夹着纸。' },
    { t: 'narr', text: '卡片上印着表格，一行一个月，手写填的。' },
    { t: 'narr', text: '一月、二月、三月……八月、九月、十月、十一月、十二月。' },
    { t: 'narr', text: '前面十行有笔迹，写着「已换」「冲洗」「正常」。' },
    { t: 'narr', text: '十月那一行的字，笔画更重一点。' },
    { t: 'narr', text: '十一月往后，全是空的。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '卡片最下面印着一行：更换滤芯后请填写并签字。' },
    { t: 'narr', text: '十行字里，只有三行后面有签名。' },
    { t: 'narr', text: '我把卡片那一段放大了三遍。' },
    { t: 'narr', text: '最后一次填的日期是二〇二四年十月八日。' },
    { t: 'mat', id: 'M043' },
    { t: 'mat', id: 'M044' },
    { t: 'goto', label: 's2_join' },

    /* ---- 分支三：问人 ---- */
    { t: 'label', name: 's2_ask' },
    { t: 'bg', id: 'corridor', place: '走廊 · 窗口边' },
    { t: 'narr', text: '刚接完水的那个人在窗口站着，手里捏着瓶子。' },
    { t: 'show', id: 'zheng' },
    { t: 'say', who: 'lin', name: '林知序', text: '这水你喝着有味道吗。' },
    { t: 'narr', text: '他把瓶子举到眼前看了看。' },
    { t: 'say', who: 'zheng', name: '郑野', text: '有点。' },
    { t: 'say', who: 'zheng', name: '郑野', text: '我以为是我瓶子没洗。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你天天喝这个？' },
    { t: 'say', who: 'zheng', name: '郑野', text: '教室在四楼，懒得下去。' },
    { t: 'say', who: 'zheng', name: '郑野', text: '这儿近。' },
    { t: 'narr', text: '他把瓶子拧开，又喝了一口，皱着眉咽下去。' },
    { t: 'say', who: 'zheng', name: '郑野', text: '好像是有点。' },
    { t: 'say', who: 'zheng', name: '郑野', text: '不过喝了半年了，也没怎么样。' },
    { t: 'hide', id: 'zheng' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '半年。' },
    { t: 'narr', text: '也就是说，从上学期开始就是这样。' },
    { t: 'narr', text: '我回到机器前面，把公示和机身都拍了照。' },
    { t: 'mat', id: 'M043' },
    { t: 'mat', id: 'M045' },
    { t: 'goto', label: 's2_join' },

    /* ================= 二、汇合 ================= */
    { t: 'label', name: 's2_join' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'corridor', place: '三楼走廊 · 午休前' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '我把两件事写在草稿纸上。' },
    { t: 'narr', text: '一、公示日期是二〇二四年十月十六日，距今十一个月。' },
    { t: 'narr', text: '二、机身维护卡片最后一次填写是二〇二四年十月八日。' },
    { t: 'narr', text: '两张纸，隔了八天。' },
    { t: 'narr', text: '之后再没有新的。' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '这两件事放在一起，还不构成什么问题。' },
    { t: 'narr', text: '检测报告管一年，很多学校一年做一次。' },
    { t: 'narr', text: '维护卡片空着，可能是换了新机器忘了贴，也可能是忘了换。' },
    { t: 'narr', text: '要往下问，得先知道这台机器这一年里出过什么事。' },

    { t: 'show', id: 'luo' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '你在看那个水机？' },
    { t: 'say', who: 'lin', name: '林知序', text: '嗯。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '上学期报修过。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你怎么知道。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '我们班在三楼待过一个学期。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '有一阵出水特别慢，我写纸条塞给了后勤。' },
    { t: 'say', who: 'lin', name: '林知序', text: '他们回了吗。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '修过一次。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '换了个什么零件，换完快了两天。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '后来还是慢。' },
    { t: 'narr', text: '他说完就走，走了两步又回头。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '你要查的话，报修单在保健室那边有一份复印件。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你怎么连这个都知道。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '我去问过。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '没问出什么，我就回来了。' },
    { t: 'hide', id: 'luo' },
    { t: 'flag', key: 's2_repair_hint' },
    { t: 'narr', text: '他走了以后，我在纸上加了第三行：报修单。' },
    { t: 'goto', label: 'hub_intro' },

    /* ================= 三、调查中枢 ================= */
    { t: 'label', name: 'hub_intro' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'corridorDusk', place: '三楼走廊 · 下午课间' },
    { t: 'music', id: 'calm2' },
    { t: 'narr', text: '下午两节课之后，走廊上没什么人。' },
    { t: 'narr', text: '机器嗡嗡地响，压缩机每隔一分钟起动一次。' },
    { t: 'narr', text: '我站在旁边听了两分钟。' },
    { t: 'narr', text: '要问的东西比口罩那件事多。' },
    { t: 'narr', text: '谁换滤芯。换了几次。为什么卡片没写。报修单在谁那里。' },
    { t: 'narr', text: '还有一件我一直没想好的：这一年喝过水的人。' },
    { t: 'hub' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'corridorDusk', place: '三楼走廊 · 放学后' },
    { t: 'music', id: 'sunset' },
    { t: 'narr', text: '放学铃响过十分钟，走廊空下来。' },
    { t: 'narr', text: '机器的红色按键亮着，一直亮着。' },
    { t: 'narr', text: '我把今天问到的写在纸上，数了数，还差几样。' },

    {
      t: 'choice',
      prompt: '接下来往哪里走？',
      options: [
        { text: '整理成一份书面追问，交学校办公室', goto: 'p_school' },
        { text: '先在班里说一句，让大家这两天别接', goto: 'p_class' },
        { text: '把情况递到外面的平台上', goto: 'p_out' }
      ]
    },

    /* ---- 收束 A：书面 ---- */
    { t: 'label', name: 'p_school' },
    { t: 'bg', id: 'classroomNight', place: '初三（2）班 · 晚自习' },
    { t: 'music', id: 'room' },
    { t: 'narr', text: '晚自习第一节，我写了一份《关于三楼直饮水机的情况说明》。' },
    { t: 'narr', text: '一页半，四段。' },
    { t: 'narr', text: '第一段写现象：出水有异味，出水口有水垢，机器运行正常。' },
    { t: 'narr', text: '第二段写记录：机身维护卡片最后一次填写时间为二〇二四年十月八日。' },
    { t: 'narr', text: '第三段写公示：张贴的检测报告日期为二〇二四年十月十六日。' },
    { t: 'narr', text: '第四段写三个问题：' },
    { t: 'narr', text: '一、过去十一个月内滤芯的更换时间与更换人。' },
    { t: 'narr', text: '二、二〇二四年十二月的报修事项是否已处理完毕。' },
    { t: 'narr', text: '三、近期是否有重新检测的计划，结果是否公示。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '最后一行：以上情况希望书面答复，谢谢。' },
    { t: 'narr', text: '写完抄了一遍。' },
    { t: 'narr', text: '第二天早上，我把它交到行政楼一层的学校办公室。' },
    { t: 'narr', text: '里面的人接过去，翻了一下，问我是哪个班的。' },
    { t: 'narr', text: '我说了。她在纸角上写了一个班号，放进一个蓝色文件夹。' },
    { t: 'mat', id: 'M048' },
    { t: 'flag', key: 's2_school_record' },
    { t: 'goto', label: 'verdict' },

    /* ---- 收束 B：先跟同学说 ---- */
    { t: 'label', name: 'p_class' },
    { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 放学前' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '放学前五分钟，班主任还没来。' },
    { t: 'narr', text: '我站到讲台边上，说了三句。' },
    { t: 'narr', text: '三楼那台机器出的水有味道。' },
    { t: 'narr', text: '墙上的检测报告是去年十月的。' },
    { t: 'narr', text: '这两天先别接，等学校说清楚。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '班里先是安静，然后有人问：' },
    { t: 'narr', text: '「你喝出问题了？」' },
    { t: 'narr', text: '我说没有。' },
    { t: 'narr', text: '「那你凭什么说它有问题。」' },
    { t: 'narr', text: '我说报告过期了。' },
    { t: 'narr', text: '「报告过期又不是水过期。」' },
    { t: 'narr', text: '这句话有人笑了一下。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '第二天中午，三楼那台机器前面还是有人排队。' },
    { t: 'narr', text: '只是有几个我们班的，绕到二楼去了。' },
    { t: 'show', id: 'shen' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你说的那三句，我信。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '但你要别人也信，得有个能看的东西。' },
    { t: 'hide', id: 'shen' },
    { t: 'flag', key: 's2_class_warned' },
    { t: 'goto', label: 'verdict' },

    /* ---- 收束 C：递到外面 ---- */
    { t: 'label', name: 'p_out' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
    { t: 'music', id: 'night_street' },
    { t: 'narr', text: '晚上十点，我在网上反映的表格里写五行。' },
    { t: 'narr', text: '「本校教学楼三楼直饮水机出水有异味，出水口有明显水垢。' },
    { t: 'narr', text: '机身维护记录最后一次填写为二〇二四年十月八日。' },
    { t: 'narr', text: '走廊公示的水质检测报告日期为二〇二四年十月十六日，至今未更新。' },
    { t: 'narr', text: '希望核实该设备近一年的维护与检测情况，并将结果公示。」' },
    { t: 'narr', text: '填到「是否已向被反映单位反映」那一栏，我停了一下。' },
    { t: 'narr', text: '我还没跟学校说过。' },
    {
      t: 'choice',
      prompt: '往外面递，走哪条？',
      options: [
        { text: '网上填表。把日期、读数、报修单一条条写进去', goto: 's2o_form' },
        { text: '打 12345，先问清楚这事该谁管', goto: 's2o_call' },
        { text: '算了。机器还在响，明天再说', goto: 's2o_none' }
      ]
    },

    { t: 'label', name: 's2o_form' },
    { t: 'narr', text: '「是否已向被反映单位反映」我选了「否」。' },
    { t: 'narr', text: '下面如实写：尚未反映，先向平台咨询。' },
    { t: 'wait', ms: 240 },
    {
      t: 'govform',
      kind: 'water',
      time: '2025-09-19 22:08',
      progress: WATER_FORM_PROGRESS
    },
    { t: 'narr', text: '提交，跳出受理编号。' },
    { t: 'narr', text: '编号里有日期，也有一串看不出规律的数。' },
    { t: 'narr', text: '我把它抄在维护卡片照片的背面。' },
    { t: 'flag', key: 's2_gov_submitted' },
    { t: 'flag', key: 's2_channels', value: 1 },
    { t: 'goto', label: 'verdict' },

    { t: 'label', name: 's2o_call' },
    { t: 'narr', text: '我把要说的写在纸上：机器位置、两个日期、一句闻到的味道。' },
    { t: 'narr', text: '写完觉得太短，又加了一行：这一年喝过水的人有多少，我不知道。' },
    {
      t: 'hotline',
      callTitle: '12345 · 通话中',
      number: '12345',
      steps: [
        { who: '接线员', text: '您好，这里是 12345 政务服务便民热线，请问有什么可以帮您。' },
        {
          ask: '接线员：请讲。',
          options: [
            { text: '学校走廊上的直饮水机，维护记录停在去年十月。', reply: '好的，请问具体是哪一所学校、哪一台设备。', flag: 's2_hot_open' },
            { text: '我想先问一下，学校饮水机该找哪个部门。', reply: '学校饮用水卫生一般由卫生健康部门监督，学校管理问题由教育部门。', flag: 's2_hot_ask' }
          ]
        },
        { who: '我', text: '明德中学，教学楼三楼走廊，一台白色的直饮水机。' },
        { who: '接线员', text: '您怎么确定记录没有更新。' },
        { who: '我', text: '机身贴着一张维护卡，最后一行的日期是二〇二四年十月八日。' },
        { who: '我', text: '墙上的检测报告是二〇二四年十月十六日。' },
        { who: '接线员', text: '那您是自己喝出问题了吗。' },
        {
          ask: '接线员：您是自己喝出问题了吗？',
          options: [
            { text: '我喝过。有味道，说不上来是什么味。', reply: '好的，这个我记下来。有没有不舒服？', flag: 's2_hot_drank' },
            { text: '没有。我是看到记录才想打的。', reply: '好的，我按您反映的记录。', flag: 's2_hot_record' }
          ]
        },
        { who: '接线员', text: '这个事项我们会转卫生健康部门核实，教育部门那边一起抄送。' },
        { who: '接线员', text: '工单号 2025091984631，办理时限十五个工作日。' },
        { who: '我', text: '（挂了电话，我把工单号念了一遍，怕记错。）' }
      ]
    },
    { t: 'narr', text: '通话时长两分四十秒。' },
    { t: 'narr', text: '比我想的短。我以为会被问很多。' },
    { t: 'narr', text: '后来才明白，他们不需要问很多。' },
    { t: 'narr', text: '他们只需要一个能转出去的说法。' },
    { t: 'flag', key: 's2_gov_submitted' },
    { t: 'flag', key: 's2_channels', value: 1 },
    { t: 'goto', label: 'verdict' },

    { t: 'label', name: 's2o_none' },
    { t: 'narr', text: '我把页面关掉。' },
    { t: 'narr', text: '表格里已经写好的字还在，关掉之后就没有了。' },
    { t: 'narr', text: '我坐了一会儿，听见楼下有人在收废品。' },
    { t: 'narr', text: '明天再说。这句话我今天已经说过两次。' },
    { t: 'flag', key: 's2_no_channel' },
    { t: 'goto', label: 'verdict' },

    /* ================= 四、结果 ================= */
    { t: 'label', name: 'verdict' },
    { t: 'hide', all: true },
    { t: 'if', cond: (s) => !!(s.flags && s.flags.s2_gov_submitted), then: 'v_reply' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_reply' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 十月十四日 晚' },
    { t: 'music', id: 'office' },
    { t: 'narr', text: '十月十四号，晚上七点多，手机响了。' },
    { t: 'narr', text: '陌生号码，自动语音，说事项已办结，请到平台查询。' },
    { t: 'narr', text: '我打开页面。编号对上。' },
    { t: 'govprogress', data: waterProgress, ai: () => WATER_AI_BRIEF },
    { t: 'narr', text: '五段。读完我把它复制到备忘录里。' },
    { t: 'narr', text: '第一段说，记录没填，是「填写不规范」。' },
    { t: 'narr', text: '第二段说，检测「符合当时执行的标准」。' },
    { t: 'narr', text: '第三段说，异味是水垢，已安排清洗。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '六句话里，有四个「已要求」。' },
    { t: 'narr', text: '已要求完善台账。已要求按周期复检。已要求清洗。已要求接受监督。' },
    { t: 'narr', text: '要求之后的事，这一段里没有。' },
    { t: 'narr', text: '但它确实回答了。每一条都对着我问的那一条。' },
    { t: 'narr', text: '我把页面往下拉，办理节点里有五个时间。' },
    { t: 'narr', text: '从九月十九号到十月十四号，二十五天。' },
    { t: 'narr', text: '比十五个工作日多了几天，加上假期，算得上按时。' },
    { t: 'note', text: '答复把每一条都答到了，但它只说「已要求」。要求是动作，不是结果。' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_branch' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'streetDusk', place: '回家的路 · 傍晚' },
    { t: 'music', id: 'rain' },
    // outcomes 显式声明五种结果
    { t: 'branch', decide: decideSide2Result, prefix: 'r_', outcomes: ['hidden', 'clear', 'partial', 'procedural', 'dispute'] },

    /* ---- 隐藏结果：最后一杯 ---- */
    { t: 'label', name: 'r_hidden' },
    { t: 'ending', id: 'side_filter' },
    { t: 'narr', text: '那台机器是周一上午被推走的。' },
    { t: 'narr', text: '两个人，一辆平板车，拆管子的时候地上漏了一小滩水。' },
    { t: 'narr', text: '扫地的阿姨拿拖把拖了三遍。' },
    { t: 'wait', ms: 300 },
    { t: 'bg', id: 'corridor', place: '三楼走廊 · 一周后' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '一周后装了新机器，还是白色外壳，按键换成绿色。' },
    { t: 'narr', text: '墙上换了一张新公示，日期是二〇二五年九月二十二日。' },
    { t: 'narr', text: '机身侧面多了一张卡片，比原来那张大一点。' },
    { t: 'narr', text: '卡片上第一行是手写的：' },
    { t: 'narr', text: '「二〇二五年九月二十二日 更换滤芯 更换人 吴建国 验收人 傅。」' },
    { t: 'narr', text: '第二行：「二〇二五年九月二十二日 水质检测 合格 报告编号 2025-0918。」' },
    { t: 'narr', text: '第三行是印上去的，不是手写：' },
    { t: 'narr', text: '「本机维护记录每学期公示一次，可向学校办公室查询。」' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '第三行那句话，是我在追问里写的第三问。' },
    { t: 'narr', text: '他们把它印上去了。' },

    { t: 'bg', id: 'infirmary', place: '保健室 · 当天下午' },
    { t: 'show', id: 'fu' },
    { t: 'narr', text: '下午我去保健室还体温计，傅医生正在整理柜子。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '新机器我去看过了。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '验收人写的是我。' },
    { t: 'say', who: 'lin', name: '林知序', text: '您签的？' },
    { t: 'say', who: 'fu', name: '傅医生', text: '我签的。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '滤芯换没换，我看着他拆的包装。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '检测报告我也看了，编号对得上。' },
    { t: 'narr', text: '她把柜门关上。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '以前没人让我签这个。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '以后要签，我就得看。' },
    { t: 'hide', id: 'fu' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '这句话我记在了本子上。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 查明：换了新的 ---- */
    { t: 'label', name: 'r_clear' },
    { t: 'ending', id: 'side_clear2' },
    { t: 'narr', text: '外面那边先回的话。' },
    { t: 'narr', text: '受理之后第十二天，来了两个人，带着一个便携检测箱。' },
    { t: 'narr', text: '他们在机器前面取样，接了三瓶，贴上标签。' },
    { t: 'narr', text: '一周后出了结果：菌落总数超限。' },
    { t: 'narr', text: '结论是「责令立即停止使用并清洗消毒，更换滤芯后重新检测」。' },
    { t: 'wait', ms: 300 },
    { t: 'bg', id: 'corridor', place: '三楼走廊 · 九月末' },
    { t: 'narr', text: '机器停了三天。' },
    { t: 'narr', text: '三天里，走廊那头很安静，没有嗡嗡的声音。' },
    { t: 'narr', text: '有人走过去，看一眼贴在上面的纸，又走回来。' },
    { t: 'narr', text: '第四天换了新滤芯，重新检测，合格。' },
    { t: 'narr', text: '重开的当天中午，队伍排到了楼梯口。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '墙上那张公示换成了新的，日期是九月二十八日。' },
    { t: 'narr', text: '机身侧面那张维护卡片也换了新的。' },
    { t: 'narr', text: '第一行写着更换日期和更换人。' },
    { t: 'narr', text: '第二行是空的。' },
    { t: 'narr', text: '空行下面印着同一句：更换滤芯后请填写并签字。' },
    { t: 'narr', text: '我看着那行空白看了一会儿。' },
    { t: 'narr', text: '这张卡片能证明今天有人换过。' },
    { t: 'narr', text: '它不能说明上一年里换过几次。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 部分查明 ---- */
    { t: 'label', name: 'r_partial' },
    { t: 'ending', id: 'side_partial2' },
    { t: 'narr', text: '滤芯换了。' },
    { t: 'narr', text: '换的那天是周六，学校没几个人。' },
    { t: 'narr', text: '周一早上，机器上贴了一张手写的纸：' },
    { t: 'narr', text: '「滤芯已更换，请放心使用。」' },
    { t: 'narr', text: '没有日期，没有签名，没有检测报告。' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '我问过后勤，他们说换了就是换了。' },
    { t: 'narr', text: '我问换了几次，他们说这次换了。' },
    { t: 'narr', text: '我问以前换过没有，他们说该换的时候会换。' },
    { t: 'narr', text: '三句话，一句比一句短。' },
    { t: 'wait', ms: 260 },
    { t: 'bg', id: 'corridorDusk', place: '三楼走廊 · 一周后' },
    { t: 'narr', text: '那张手写的纸贴了一个星期，掉了。' },
    { t: 'narr', text: '掉在地上，被人踩了一脚，扫走了。' },
    { t: 'narr', text: '墙上还是那张二〇二四年十月的公示。' },
    { t: 'narr', text: '机身侧面还是那张空白的维护卡片。' },
    { t: 'show', id: 'luo' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '水现在没味了。' },
    { t: 'say', who: 'lin', name: '林知序', text: '嗯。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '那不就行了。' },
    { t: 'narr', text: '他接了一杯，喝了一口。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '你看，还是没人记录。' },
    { t: 'say', who: 'luo', name: '罗一舟', text: '下次坏了，还是从零开始。' },
    { t: 'hide', id: 'luo' },
    { t: 'narr', text: '他把杯子晃了晃，走了。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 只有程序进展 ---- */
    { t: 'label', name: 'r_procedural' },
    { t: 'ending', id: 'side_procedural2' },
    { t: 'narr', text: '我交上去的那份说明，第二周有了回音。' },
    { t: 'narr', text: '学校办公室打电话到年级组，年级组通知班主任，班主任在班会上念了一段。' },
    { t: 'narr', text: '「近期有同学反映三楼饮水设备情况，学校已安排后勤检查，' },
    { t: 'narr', text: '该设备运行正常，水质检测合格，请同学们放心使用。」' },
    { t: 'narr', text: '念完她合上本子。' },
    { t: 'narr', text: '从反映到念完，一共十一天。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '我去看过那台机器。' },
    { t: 'narr', text: '出水口的黄褐色还在，维护卡片还是空的，公示还是去年十月那张。' },
    { t: 'narr', text: '「检查」这个动作发生过，只是没有留下任何东西。' },
    { t: 'wait', ms: 260 },
    { t: 'bg', id: 'classroomNight', place: '初三（2）班 · 晚自习' },
    { t: 'narr', text: '晚自习我把这一串记在本子上：' },
    { t: 'narr', text: '9 月 19 日，反映。' },
    { t: 'narr', text: '9 月 22 日，交书面说明。' },
    { t: 'narr', text: '9 月 30 日，班会宣读答复。' },
    { t: 'narr', text: '三行字，中间没有任何一份文件。' },
    { t: 'narr', text: '我把本子合上，去二楼接了一杯水。' },
    { t: 'narr', text: '二楼那台是去年新装的。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 陷入争议：三个人在传 ---- */
    { t: 'label', name: 'r_dispute' },
    { t: 'ending', id: 'side_dispute2' },
    { t: 'narr', text: '那天我在班群里发了一句话：三楼的水别喝，机器一年没换滤芯。' },
    { t: 'narr', text: '发出去五分钟，群里有人问：谁说的。' },
    { t: 'narr', text: '我说：我自己看的。' },
    { t: 'narr', text: '「你又不是检测机构。」' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '中午这句话传到三班，下午传到四班。' },
    { t: 'narr', text: '到我听见的时候，版本已经变了三次。' },
    { t: 'narr', text: '第一次：三楼的水有毒。' },
    { t: 'narr', text: '第二次：有个学生喝了住院了。' },
    { t: 'narr', text: '第三次：学校把机器藏起来了。' },
    { t: 'narr', text: '第三次传到我耳朵里的时候，机器还在原地响。' },
    { t: 'wait', ms: 280 },
    { t: 'bg', id: 'corridor', place: '三楼走廊 · 三天后' },
    { t: 'narr', text: '第三天，学校发了一条通知：' },
    { t: 'narr', text: '「网传我校饮水设备存在安全问题，经核查不实。设备运行正常，' },
    { t: 'narr', text: '水质检测结果已于去年十月公示。请同学们不信谣、不传谣。」' },
    { t: 'narr', text: '通知贴在那张旧公示旁边，两张纸并排。' },
    { t: 'narr', text: '一张说合格，一张说不实。' },
    { t: 'narr', text: '中间隔着十一个月，没有人提这十一个月。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '班里再也没有人提这件事。' },
    { t: 'narr', text: '三楼那台机器照样响，照样排队。' },
    { t: 'narr', text: '只是有人接水之前，会先低头看一眼出水口。' },
    { t: 'narr', text: '看一眼，然后接。' },
    { t: 'goto', label: 'epilogue' },

    /* ================= 尾声 ================= */
    { t: 'label', name: 'epilogue' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'streetNight', place: '回家的路' },
    { t: 'music', id: 'silent' },
    { t: 'narr', text: '十月，天气凉下来，走廊上接水的人少了一半。' },
    { t: 'narr', text: '那台机器还在那儿，红键一直亮着。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '这件事我后来想起的，不是水。' },
    { t: 'narr', text: '是那张卡片上十行空白。' },
    { t: 'narr', text: '一台机器用了一年，没有人为它写过一行字。' },
    { t: 'narr', text: '它坏了有人修，脏了有人擦，就是没有人记。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '没有记录，就没有人需要回答「上一次是什么时候」。' },
    { t: 'narr', text: '问不出来的事，最后都变成了「应该没事」。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '我抽屉里现在有一沓纸：' },
    { t: 'narr', text: '一张公示的照片，一张维护卡片的照片，一份自己写的说明。' },
    { t: 'narr', text: '都不是什么大东西。' },
    { t: 'narr', text: '但它们上面都有日期。' },
    { t: 'narr', text: '——支线《直饮水》 完' },
    { t: 'end' }
  ],

  /* ================= 调查行动 ================= */
  hubActions: [
    {
      id: 's2_filter',
      title: '去后勤要滤芯更换记录',
      tag: '文书',
      desc: '一台机器一年换几次滤芯，应该有个本子。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
        { t: 'show', id: 'wu' },
        { t: 'narr', text: '他正在算一张表，算盘旁边放着一个计算器。' },
        { t: 'say', who: 'lin', name: '林知序', text: '吴主任，三楼直饮水机的滤芯更换记录有吗。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '有。' },
        { t: 'narr', text: '他拉开抽屉，翻了一会儿，抽出一个牛皮纸文件夹。' },
        { t: 'narr', text: '文件夹上写着「直饮水机 2023—」。' },
        { t: 'narr', text: '打开，里面三张纸。' },
        { t: 'narr', text: '第一张是采购合同，二〇二三年买的四台机器。' },
        { t: 'narr', text: '第二张是滤芯领用单，日期二〇二四年十月八日，领了四支。' },
        { t: 'narr', text: '第三张是……没有第三张。' },
        { t: 'wait', ms: 300 },
        { t: 'say', who: 'lin', name: '林知序', text: '就这些？' },
        { t: 'say', who: 'wu', name: '吴建国', text: '就这些。' },
        { t: 'say', who: 'lin', name: '林知序', text: '今年没换过？' },
        { t: 'narr', text: '他把文件夹合上，又打开，把三张纸翻了一遍。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '……今年没领。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那今年换过吗。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '换了就得领。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '没领就是没换。' },
        { t: 'narr', text: '他说这句话的时候看着文件夹，没看我。' },
        { t: 'say', who: 'lin', name: '林知序', text: '滤芯多久换一次。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '厂家说三到六个月。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那上一次是去年十月。' },
        { t: 'narr', text: '他没有接话。' },
        { t: 'hide', id: 'wu' },
        { t: 'mat', id: 'M044' },
        { t: 'narr', text: '出门之后，我在走廊上站了一会儿。' },
        { t: 'narr', text: '三到六个月。十一个月。' },
        { t: 'narr', text: '两个数字放在一起，就是这件事的形状。' }
      ]
    },

    {
      id: 's2_notice',
      title: '把公示拍下来去查编号',
      tag: '材料',
      desc: '报告上有编号，编号能查出出具时间和检测机构。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridor', place: '走廊 · 公示牌前' },
        { t: 'narr', text: '塑封纸右下角有一行很小的字。' },
        { t: 'narr', text: '检测机构：市疾病预防控制中心。报告编号：2024-1016-021。' },
        { t: 'narr', text: '我把这一行放大拍了三张，一张比一张近。' },
        { t: 'narr', text: '然后打开手机查这种编号的规则。' },
        { t: 'narr', text: '一般是「年份-日期-流水号」。' },
        { t: 'narr', text: '2024-1016-021，就是二〇二四年十月十六日出的第 21 号报告。' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '这张纸确实是那一天出的。' },
        { t: 'narr', text: '它不是伪造的，它是过期的。' },
        { t: 'narr', text: '两件不同的事。' },
        { t: 'mat', id: 'M045' },
        { t: 'narr', text: '我又看了一遍那九项检测项目。' },
        { t: 'narr', text: '九项都是「合格」，没有一项写数值。' },
        { t: 'narr', text: '合格是一个结论，结论背后没有数。' },
        { t: 'narr', text: '这一点我记住了，后面有用。' }
      ]
    },

    {
      id: 's2_repair',
      title: '去保健室要报修单复印件',
      tag: '文书',
      desc: '罗一舟说那边有一份，二〇二四年十二月的。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'infirmary', place: '保健室' },
        { t: 'show', id: 'fu' },
        { t: 'say', who: 'lin', name: '林知序', text: '傅医生，直饮水机的报修单在您这儿吗。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '谁跟你说的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '罗一舟。' },
        { t: 'narr', text: '她拉开柜子最下面一层，翻出一叠单子。' },
        { t: 'narr', text: '单子是复写的，第二联，字迹有点花。' },
        { t: 'narr', text: '抬头：设备报修单。' },
        { t: 'narr', text: '设备名称：直饮水机（三楼）。报修日期：2024 年 12 月 19 日。' },
        { t: 'narr', text: '故障描述：出水慢，有异味。报修人：傅。' },
        { t: 'narr', text: '下面一栏是「处理结果」，写着一行：已联系厂家，等待配件。' },
        { t: 'narr', text: '日期是 12 月 26 日。' },
        { t: 'wait', ms: 300 },
        { t: 'say', who: 'lin', name: '林知序', text: '后来配件到了吗。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '没人告诉我。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '这张单子在这儿放了大半年。' },
        { t: 'say', who: 'lin', name: '林知序', text: '单子上没写「已修复」。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '没写。' },
        { t: 'narr', text: '她把单子递给我。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '要复印就去楼下打印店，一块钱一张。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '原单我得留着。' },
        { t: 'hide', id: 'fu' },
        { t: 'mat', id: 'M046' },
        { t: 'narr', text: '复印件拿回来，我把它和公示照片放在一起看。' },
        { t: 'narr', text: '十二月十九日报修。十二月二十六日等配件。' },
        { t: 'narr', text: '之后没有下文。' }
      ]
    },

    {
      id: 's2_tds',
      title: '借一支 TDS 笔测一测',
      tag: '现场',
      desc: '罗一舟家里养鱼，笔在他书包里。数不会骗人。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridor', place: '三楼走廊 · 直饮水机前' },
        { t: 'show', id: 'luo' },
        { t: 'narr', text: '罗一舟从书包侧袋里摸出一支笔，比记号笔粗一点。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '先测自来水，再测这个。' },
        { t: 'say', who: 'lin', name: '林知序', text: '为什么。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '没有对照，数没有意义。' },
        { t: 'narr', text: '我们去了洗手间，接了一杯自来水。' },
        { t: 'narr', text: '笔放进去，晃两下，屏幕跳到 138。' },
        { t: 'narr', text: '等五秒，稳定在 142。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '回到饮水机，接了一杯。' },
        { t: 'narr', text: '笔放进去，屏幕跳到 210，又升到 236。' },
        { t: 'narr', text: '稳定在 241。' },
        { t: 'narr', text: '罗一舟把笔拿出来，甩了甩。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '反了。' },
        { t: 'say', who: 'lin', name: '林知序', text: '什么反了。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '直饮水应该比自来水低。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '它高了将近一百。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '他又测了一遍，两次都在 240 左右。' },
        { t: 'narr', text: '自来水 142，饮水机 241。' },
        { t: 'say', who: 'lin', name: '林知序', text: '这说明什么。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '说明滤芯没起作用。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '也可能说明滤芯太旧，脏东西都进去了。' },
        { t: 'narr', text: '他把读数念给我，我写在纸上。' },
        { t: 'narr', text: '时间、地点、两个数、笔的型号。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '这支笔只能测溶解性总固体。' },
        { t: 'say', who: 'luo', name: '罗一舟', text: '细菌测不出来。' },
        { t: 'say', who: 'lin', name: '林知序', text: '我知道。' },
        { t: 'say', who: 'lin', name: '林知序', text: '有数总比没数好。' },
        { t: 'hide', id: 'luo' },
        { t: 'mat', id: 'M049' },
        { t: 'note', text: 'TDS 不是水质结论，只能说明这台机器现在没在过滤。' }
      ]
    },

    {
      id: 's2_school_office',
      title: '去学校办公室问公示谁负责',
      tag: '人物',
      desc: '一层西侧那间屋子，门口挂着「学校办公室」的牌子。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼一层 · 学校办公室' },
        { t: 'narr', text: '屋里三张桌子，只有一张有人。' },
        { t: 'narr', text: '一个三十来岁的女老师，正在给一摞文件编号。' },
        { t: 'say', who: 'lin', name: '林知序', text: '老师，走廊上的水质公示是谁贴的。' },
        { t: 'narr', text: '她抬头看了我一眼，手没停。' },
        { t: 'narr', text: '「后勤。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '那检测是谁去联系的。' },
        { t: 'narr', text: '她把笔放下。' },
        { t: 'narr', text: '「这个我不清楚，你问后勤。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '如果公示过期了，需要谁去换。' },
        { t: 'narr', text: '她想了想。' },
        { t: 'narr', text: '「按理说是后勤。」' },
        { t: 'narr', text: '「但我们这边没有收到过要换的通知。」' },
        { t: 'wait', ms: 260 },
        { t: 'say', who: 'lin', name: '林知序', text: '那谁来发这个通知。' },
        { t: 'narr', text: '她笑了一下，那种很短的、不带情绪的笑。' },
        { t: 'narr', text: '「你这个问题问得挺细。」' },
        { t: 'narr', text: '「一般是后勤自己发现，自己换。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '如果没发现呢。' },
        { t: 'narr', text: '她没有回答。' },
        { t: 'narr', text: '桌上那摞文件她编到第 47 号，笔尖在纸上顿了一下。' },
        { t: 'narr', text: '「你反映的话，写个书面的交过来，我给你登记。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '登记之后呢。' },
        { t: 'narr', text: '「转后勤。」' },
        { t: 'mat', id: 'M048' },
        { t: 'narr', text: '出来的时候，我把她说的三句话记在纸上：' },
        { t: 'narr', text: '按理说是后勤。没有收到通知。一般是后勤自己发现。' },
        { t: 'narr', text: '三句话都对。三句话连起来，就是没有人负责。' }
      ]
    },

    {
      id: 's2_ledger',
      title: '问滤芯是什么时候买的',
      tag: '文书',
      desc: '今年没领，那库里还有没有备用的。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
        { t: 'show', id: 'wu' },
        { t: 'narr', text: '这次我去的时候，他正在打电话。' },
        { t: 'narr', text: '「……对，四支，先放着。」' },
        { t: 'narr', text: '他看见我，把电话放下了。' },
        { t: 'say', who: 'lin', name: '林知序', text: '库里有备用滤芯吗。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '有。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '去年领了四支，用了两支。' },
        { t: 'say', who: 'lin', name: '林知序', text: '四台机器，为什么只领四支。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '一台一支是半年的量。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '一年得两轮。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那今年第二轮呢。' },
        { t: 'narr', text: '他把手里的笔转了一圈。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '今年没报计划。' },
        { t: 'say', who: 'lin', name: '林知序', text: '为什么没报。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '忘了。' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '他说完自己停了一下。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '不是忘了。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '报计划的表在学期初，那时候没人提。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那就等下一个学期初。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '……嗯。' },
        { t: 'narr', text: '我在纸上写：滤芯按学期报计划，一年应两次，今年只有一次。' },
        { t: 'narr', text: '写完之后我问他：' },
        { t: 'say', who: 'lin', name: '林知序', text: '现在能不能补报。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '能。' },
        { t: 'say', who: 'lin', name: '林知序', text: '您会报吗。' },
        { t: 'narr', text: '他把笔放下。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '你把书面材料交上来，我就有依据报。' },
        { t: 'hide', id: 'wu' },
        { t: 'mat', id: 'M050' },
        { t: 'narr', text: '这句话他说得很干脆。' },
        { t: 'narr', text: '他要的不是道理，是一张能放在桌上的纸。' }
      ]
    },

    {
      id: 's2_blank',
      title: '要一张空白的维护记录',
      tag: '文书',
      desc: '新的记录表长什么样，上面该有多少行。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
        { t: 'narr', text: '第二天中午，办公室门开着，吴建国在复印东西。' },
        { t: 'show', id: 'wu' },
        { t: 'say', who: 'lin', name: '林知序', text: '吴主任，新的维护记录表有吗。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '什么表。' },
        { t: 'say', who: 'lin', name: '林知序', text: '直饮水机那张卡片，换新的那种。' },
        { t: 'narr', text: '他从抽屉里抽出一沓印好的卡片，A5 大小。' },
        { t: 'narr', text: '抬头：《设备维护记录（直饮水设备）》。' },
        { t: 'narr', text: '下面一张表，八列：日期、项目、更换部件、数量、' },
        { t: 'narr', text: '更换人、验收人、水温、备注。' },
        { t: 'narr', text: '一共二十行。' },
        { t: 'narr', text: '二十行全是空的。' },
        { t: 'wait', ms: 300 },
        { t: 'say', who: 'lin', name: '林知序', text: '这张表什么时候开始用。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '下学期。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那这学期呢。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '墙上那张还贴着。' },
        { t: 'say', who: 'lin', name: '林知序', text: '墙上那张是二〇二四年十月八号最后一次填的。' },
        { t: 'narr', text: '他把卡片搁在桌上，没说话。' },
        { t: 'say', who: 'lin', name: '林知序', text: '这张能拍一下吗。' },
        { t: 'narr', text: '他往后退了半步。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '空表你拍它干什么。' },
        { t: 'say', who: 'lin', name: '林知序', text: '我想知道它本来该有多少行。' },
        { t: 'narr', text: '他看了我两秒，把卡片推过来一点。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '拍吧。' },
        { t: 'hide', id: 'wu' },
        { t: 'mat', id: 'M053' },
        { t: 'narr', text: '二十行。' },
        { t: 'narr', text: '按三个月一次，够用五年。' },
        { t: 'narr', text: '实际上只用了三行。' }
      ]
    },

    {
      id: 's2_drank',
      title: '问三班那个转学的孩子',
      tag: '人物',
      desc: '何雨说，他们班以前有人天天喝这台机器的水。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridor', place: '二楼走廊 · 课间' },
        { t: 'show', id: 'he' },
        { t: 'say', who: 'lin', name: '林知序', text: '你们班上学期在三楼。' },
        { t: 'say', who: 'he', name: '何雨', text: '嗯。' },
        { t: 'say', who: 'lin', name: '林知序', text: '有人一直喝那台机器的水吗。' },
        { t: 'narr', text: '她想了想。' },
        { t: 'say', who: 'he', name: '何雨', text: '有个男生，天天喝。' },
        { t: 'say', who: 'he', name: '何雨', text: '带个两升的壶，一天接两回。' },
        { t: 'say', who: 'lin', name: '林知序', text: '他现在呢。' },
        { t: 'say', who: 'he', name: '何雨', text: '转学了。' },
        { t: 'say', who: 'he', name: '何雨', text: '去年十二月走的。' },
        { t: 'wait', ms: 280 },
        { t: 'say', who: 'lin', name: '林知序', text: '为什么转。' },
        { t: 'say', who: 'he', name: '何雨', text: '说是家里搬了。' },
        { t: 'say', who: 'he', name: '何雨', text: '走之前那阵他老说肚子不舒服。' },
        { t: 'say', who: 'he', name: '何雨', text: '去医院查了，说是肠胃炎。' },
        { t: 'narr', text: '她说到这儿停了一下。' },
        { t: 'say', who: 'he', name: '何雨', text: '我不知道有没有关系。' },
        { t: 'say', who: 'he', name: '何雨', text: '他喝水那阵子，水就有味道了。' },
        { t: 'say', who: 'he', name: '何雨', text: '我们说过，他说喝习惯了尝不出来。' },
        { t: 'hide', id: 'he' },
        { t: 'mat', id: 'M047' },
        { t: 'note', text: '「喝习惯了」是转述，不能当证据。但它能让我去问对的人。' }
      ]
    },

    {
      id: 's2_parent',
      title: '回家问我妈',
      tag: '人物',
      desc: '家长群里有人提过这台机器，我妈当时回了一句。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'homeLiving', place: '家里的客厅 · 晚上' },
        { t: 'music', id: 'room' },
        { t: 'narr', text: '吃饭的时候我问她：' },
        { t: 'say', who: 'lin', name: '林知序', text: '妈，你记不记得家长群里说过学校的水。' },
        { t: 'narr', text: '她夹菜的手停了一下。' },
        { t: 'narr', text: '「去年冬天说过一次。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '说什么。' },
        { t: 'narr', text: '「有个家长说他孩子喝了拉肚子，问是不是水的问题。」' },
        { t: 'narr', text: '「后来班主任回了一句：学校的水是检测过的。」' },
        { t: 'narr', text: '「就没有人再说了。」' },
        { t: 'wait', ms: 280 },
        { t: 'say', who: 'lin', name: '林知序', text: '你还记得是哪个家长吗。' },
        { t: 'narr', text: '她想了想，报了一个名字。' },
        { t: 'narr', text: '「三班的。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '妈，你能不能把当时群里那句话找出来。' },
        { t: 'narr', text: '她放下筷子，去客厅拿了手机。' },
        { t: 'narr', text: '翻了大概三分钟。' },
        { t: 'narr', text: '「找到了。」' },
        { t: 'narr', text: '「你看看，就这一句。」' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '截图上是去年十二月十一日，晚上九点四十。' },
        { t: 'narr', text: '「孩子这两天肚子不舒服，医生说是肠胃炎。他天天在学校接水喝，' },
        { t: 'narr', text: '想问一下三楼那台饮水机多久清洗一次。」' },
        { t: 'narr', text: '下面一条是班主任：' },
        { t: 'narr', text: '「学校饮水设备均按要求维护，水质经检测合格，请家长放心。」' },
        { t: 'narr', text: '再往下，没有人说话。' },
        { t: 'mat', id: 'M051' },
        { t: 'say', who: 'lin', name: '林知序', text: '妈，这句话你能发给我吗。' },
        { t: 'narr', text: '她把手机推过来。' },
        { t: 'narr', text: '「你要这个干什么。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '学校说检测合格。我想看看检测的日期。' },
        { t: 'narr', text: '她看了我一会儿。' },
        { t: 'narr', text: '「你别一个人去闹。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '我不闹。' },
        { t: 'narr', text: '她把碗收走，没再说什么。' },

        { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
        { t: 'narr', text: '回房间以后，我照着家长群里那句话，写了一封信。' },
        { t: 'narr', text: '写给那位家长的。' },
        { t: 'narr', text: '信里只问三件事：孩子当时查出来是什么，' },
        { t: 'narr', text: '那段时间他是不是只喝学校的水，愿不愿意把就诊记录复印一份给我。' },
        { t: 'narr', text: '最后一行：如果不想给，也没关系。' },
        { t: 'narr', text: '第二天我托何雨带过去。' },
        { t: 'narr', text: '周五下午，回信夹在一本练习册里回到我手上。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '一张 A4 纸，写了半页。' },
        { t: 'narr', text: '「……查了两次，都是急性肠胃炎。」' },
        { t: 'narr', text: '「孩子说学校的水有味道，我们以为是他不爱喝水找的借口。」' },
        { t: 'narr', text: '「后来他自己带水，就没有再犯。」' },
        { t: 'narr', text: '「我们没往学校那边想，也没找过学校。」' },
        { t: 'narr', text: '最后一句：「你要问就去问，别写我孩子的名字。」' },
        { t: 'mat', id: 'M052' },
        { t: 'narr', text: '我把这半页纸看了两遍，折起来，夹进文件袋。' }
      ]
    },

    {
      id: 's2_publish',
      title: '问公示为什么不放到网上',
      tag: '人物',
      desc: '公示贴在走廊上，为什么不能贴到学校公众号里。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'infirmary', place: '保健室门口' },
        { t: 'show', id: 'fu' },
        { t: 'say', who: 'lin', name: '林知序', text: '傅医生，检测报告为什么不发到公众号上。' },
        { t: 'narr', text: '她正在把体温计泡进消毒液。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '谁发的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '学校呀。公示本来就是给人看的。' },
        { t: 'narr', text: '她把体温计捞出来，甩了两下。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '贴在墙上，学校就算公示了。' },
        { t: 'say', who: 'lin', name: '林知序', text: '可只有走到三楼才看得见。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '这个道理你跟我说没用。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '她把体温计插回盒子，坐下。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '我跟你讲一件事。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '去年这份报告拿回来的时候，是我送上来的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '送到哪儿。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '学校办公室。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '他们说要挂出来，我就挂出来了。' },
        { t: 'say', who: 'lin', name: '林知序', text: '网上呢。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '没人提。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '我也没有提。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '我的活到挂上墙为止。' },
        { t: 'wait', ms: 300 },
        { t: 'say', who: 'lin', name: '林知序', text: '那如果检出问题呢。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '检出问题，报告就上不来了。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '厂家先来处理。' },
        { t: 'say', who: 'lin', name: '林知序', text: '处理完还公示吗。' },
        { t: 'narr', text: '她把手在裤子上擦了一下。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '按规矩是要的。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '实际上我没见过。' },
        { t: 'hide', id: 'fu' },
        { t: 'mat', id: 'M054' },
        { t: 'narr', text: '这段话我一个字一个字记下来。' },
        { t: 'narr', text: '她说的是流程，不是秘密。' },
        { t: 'narr', text: '流程里没有人负责把结果放到别人看得见的地方。' }
      ]
    },

    {
      id: 's2_outside',
      title: '往外面递一份',
      tag: '外部',
      desc: '网上填表和打 12345 是两条路，留下的东西不一样。',
      ap: 2,
      once: true,
      script: [
        { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
        { t: 'music', id: 'night_street' },
        { t: 'narr', text: '十点，我把今天抄下来的东西摊在桌上。' },
        { t: 'narr', text: '维护卡片上的最后一个日期。公示上的那一个日期。' },
        { t: 'narr', text: '还有一张纸上，我记的「喝过的人」。' },
        { t: 'narr', text: '校内那条路走到现在，能问的人我都问过一遍了。' },
        { t: 'narr', text: '剩下没有答案的那部分，只能往外递。' },
        { t: 'wait', ms: 240 },
        {
          t: 'choice',
          prompt: '往外面递，走哪条？',
          options: [
            { text: '网上填表。把日期、读数、报修单一条条写进去', goto: 's2o_form' },
            { text: '打 12345，先问清楚这事该谁管', goto: 's2o_call' },
            { text: '算了。机器还在响，明天再说', goto: 's2o_none' }
          ]
        },

        { t: 'label', name: 's2o_form' },
        { t: 'narr', text: '「是否已向被反映单位反映」这一栏，我选了「是」。' },
        { t: 'narr', text: '下面写：已向学校办公室提交书面情况说明，未获书面答复。' },
        { t: 'wait', ms: 220 },
        {
          t: 'govform',
          kind: 'water',
          time: '2025-09-19 22:08',
          progress: WATER_FORM_PROGRESS
        },
        { t: 'narr', text: '提交，跳出受理编号。' },
        { t: 'narr', text: '我把它抄在维护卡片照片的背面。' },
        { t: 'flag', key: 's2_gov_submitted' },
        { t: 'flag', key: 's2_channels', value: 1 },
        { t: 'goto', label: 's2o_end' },

        { t: 'label', name: 's2o_call' },
        { t: 'narr', text: '我把要说的写在纸上：机器位置、两个日期、一句闻到的味道。' },
        { t: 'narr', text: '写完觉得太短，又加了一行：这一年喝过水的人有多少，我不知道。' },
        {
          t: 'hotline',
          callTitle: '12345 · 通话中',
          number: '12345',
          steps: [
            { who: '接线员', text: '您好，这里是 12345 政务服务便民热线，请问有什么可以帮您。' },
            {
              ask: '接线员：请讲。',
              options: [
                { text: '学校走廊上的直饮水机，维护记录停在去年十月。', reply: '好的，请问具体是哪一所学校、哪一台设备。', flag: 's2_hot_open' },
                { text: '我想先问一下，学校饮水机该找哪个部门。', reply: '学校饮用水卫生一般由卫生健康部门监督，学校管理问题由教育部门。', flag: 's2_hot_ask' }
              ]
            },
            { who: '我', text: '明德中学，教学楼三楼走廊，一台白色的直饮水机。' },
            { who: '接线员', text: '您怎么确定记录没有更新。' },
            { who: '我', text: '机身贴着一张维护卡，最后一行的日期是二〇二四年十月八日。' },
            { who: '接线员', text: '那您是自己喝出问题了吗。' },
            {
              ask: '接线员：您是自己喝出问题了吗？',
              options: [
                { text: '我喝过。有味道，说不上来是什么味。', reply: '好的，这个我记下来。有没有不舒服？', flag: 's2_hot_drank' },
                { text: '没有。我是看到记录才想打的。', reply: '好的，我按您反映的记录。', flag: 's2_hot_record' }
              ]
            },
            { who: '接线员', text: '这个事项我们会转卫生健康部门核实，教育部门一起抄送。' },
            { who: '接线员', text: '工单号 2025091984631，办理时限十五个工作日。' },
            { who: '我', text: '（挂了电话，我把工单号念了一遍，怕记错。）' }
          ]
        },
        { t: 'narr', text: '通话时长两分四十秒。' },
        { t: 'narr', text: '比我想的短。' },
        { t: 'flag', key: 's2_gov_submitted' },
        { t: 'flag', key: 's2_channels', value: 1 },
        { t: 'goto', label: 's2o_end' },

        { t: 'label', name: 's2o_none' },
        { t: 'narr', text: '我把页面关掉。' },
        { t: 'narr', text: '表格里写好的字还在，关掉之后就没了。' },
        { t: 'flag', key: 's2_no_channel' },

        { t: 'label', name: 's2o_end' },
        { t: 'hide', all: true }
      ]
    },

    {
      id: 's2_public',
      title: '把这件事发到班群',
      tag: '外部',
      desc: '一句话，两张图。发出去之后，版本就不归你管了。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomNight', place: '初三（2）班 · 晚自习' },
        { t: 'narr', text: '晚自习第二节，我在班群里发了两张照片。' },
        { t: 'narr', text: '一张是维护卡片，一张是公示。' },
        { t: 'narr', text: '正文：三楼的直饮水机一年没换滤芯了，别接。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '五分钟，群里二十七条。' },
        { t: 'narr', text: '第一条是「真的假的」。' },
        { t: 'narr', text: '第二条是「我喝了半年」。' },
        { t: 'narr', text: '第三条是「怪不得」。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '第三节下课，隔壁班有人过来问。' },
        { t: 'narr', text: '到第二天中午，我听见的版本是：三楼的水里有虫。' },
        { t: 'narr', text: '我说没有。' },
        { t: 'narr', text: '「那你发那两张图什么意思。」' },
        { t: 'narr', text: '我说滤芯过期了。' },
        { t: 'narr', text: '「滤芯过期会有虫吗。」' },
        { t: 'narr', text: '我答不上来。' },
        { t: 'flag', key: 's2_public_claim' },
        { t: 'stat', who: 'zhou', trust: -3, pressure: 6 },
        { t: 'narr', text: '第二天下午，学校在公告栏贴了一张说明，说网传不实。' },
        { t: 'narr', text: '那张纸贴在旧公示旁边，两张并排。' }
      ]
    },

    {
      id: 's2_rest',
      title: '在走廊坐一会儿',
      tag: '休息',
      desc: '机器一直在响，今天就先听到这儿。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridorDusk', place: '三楼走廊 · 放学后' },
        { t: 'music', id: 'daydream' },
        { t: 'narr', text: '放学后我在走廊的长椅上坐了十五分钟。' },
        { t: 'narr', text: '窗户外面是操场，有人在跑圈，跑到第三圈开始走。' },
        { t: 'narr', text: '机器在我背后每隔一分钟响一次。' },
        { t: 'narr', text: '压缩机起动的声音，像有人在很远的地方关了一下门。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '一个男生过来接水，接了半瓶，喝了一口。' },
        { t: 'narr', text: '他皱了皱眉，还是喝完了。' },
        { t: 'narr', text: '走的时候他看了我一眼。' },
        { t: 'narr', text: '我没有说话。' },
        { t: 'note', text: '歇一会儿不产出材料，今天剩下的行动还够用。' }
      ]
    }
  ],

  /* 中段事件：问到第四件事的时候，机器先被「保护」起来了。
     贴一张「检修中」的纸，比回答一百个问题都省事。 */
  hubEvents: [
    {
      id: 'shutdown',
      after: 4,
      script: [
        { t: 'hide', all: true },
        { t: 'bg', id: 'corridor', place: '三楼走廊 · 下午第一节课前' },
        { t: 'music', id: 'tense' },
        { t: 'narr', text: '下午第一节课前，走廊那头围了几个人。' },
        { t: 'narr', text: '机器正面贴了一张纸，A4，打印的，四个字：' },
        { t: 'narr', text: '「设备检修」。' },
        { t: 'narr', text: '下面一行小字：暂停使用，请勿接水。' },
        { t: 'narr', text: '红色按键不亮了。' },
        { t: 'wait', ms: 280 },
        { t: 'show', id: 'luo', pos: 'center' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '上午还好好的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '谁贴的。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '不知道。可能是后勤，也可能是厂家。' },
        { t: 'narr', text: '他把手插在裤袋里，看那张纸。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '这机器我一天接两回。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '从初一开始。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那你喝出过味道吗。' },
        { t: 'narr', text: '他想了很久。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '喝习惯了，就尝不出来。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '这句话是我妈说的。她喝自来水也这么讲。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '上课铃响了。' },
        { t: 'narr', text: '走到楼梯口，我回头看了一次。' },
        { t: 'narr', text: '那张纸在风里翘起一个角，又落下去。' },
        { t: 'flag', key: 's2_shutdown' },
        { t: 'note', text: '一台机器停用，只需要一张 A4 纸。它和一份检测报告之间，隔着的是一整年的记录。' },
        { t: 'hide', id: 'luo' }
      ]
    }
  ],

  summary: {
    title: '支线 · 直饮水',
    subtitle: '一台机器，十一个月，十行空白',
    quote: '「该设备运行正常，水质检测合格，请同学们放心使用。」',
    known: [
      '走廊公示的检测报告日期是二〇二四年十月十六日',
      '机身维护卡片最后一次填写是二〇二四年十月八日',
      '二〇二四年十二月十九日报修过，处理结果是「等待配件」',
      'TDS 实测：自来水 142，饮水机 241',
      '今年没有报过第二轮滤芯计划'
    ],
    unknown: [
      '这一年里到底有没有换过滤芯',
      '十二月那次报修最后为什么没有下文',
      '有没有人因为这台机器去过医院',
      '下一次再坏，还是不是从零开始'
    ]
  }
};
