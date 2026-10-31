/* =========================================================
   支线 ·《第八节课》
   ---------------------------------------------------------
   第三条支线：课表上多出来的一节课。

   核心问题不是「谁偷偷加了课」，而是——
   一节没有写进课表的课，是怎么被所有人当成理所当然的？

   写作口径（与《一元口罩》《直饮水》一致）：
   1. 只写看得见的：时间、地点、页数、原话、章、签名。
      不替任何人下结论，也不写"他们其实都明白"。
   2. 不用否定排比，不在段末补格言。
   3. 学校里没有坏人。陈老师说她只是执行；教务处说学校没有第八节；
      家长说"自愿的，我们自愿"。每个人说的都成立，拼起来就有一节课。
   4. 「自愿」有三种写法：通知上的、接龙里的、点名册上的。
      玩家要分清是哪一种。
   5. 五种结果由动作决定：有没有课表原件 / 有没有拍到最后讲的不是作业 /
      有没有自己数出不参加的人 / 有没有在校内留下书面 /
      答复说"自愿参加"的时候有没有把名单递上去。

   材料：M055–M066
   人物：陈老师、吴建国（后勤）、罗一舟、何雨、孙芃、马文杰、沈予安、许小满
   时间：2025 年 12 月 16 日 · 周二（第十六周）
   ========================================================= */

import { hasMaterial } from '../core/state.js';

/* ---------------- 结果判定 ----------------
   优先级：隐藏 → 查明 → 陷入争议 → 部分查明 → 只有程序进展 */
export function decideSide3Result(state) {
  const f = state.flags || {};
  const has = (id) => hasMaterial(state, id);

  const base = has('M055') && has('M058');          // 课表原件 + 最后讲的是新内容
  const named = has('M065');                        // 自己数出来的不参加名单
  const schoolRecord = !!f.s3_school_record;         // 校内有没有留下书面
  const anyChannel = (f.s3_channels || 0) >= 1;      // 有没有对外反映过
  const publicClaim = !!f.s3_public_claim;           // 有没有在核实前把话说满
  const follow = !!f.s3_follow;                      // 答复说"自愿参加"之后有没有补名单

  if (base && named && schoolRecord && anyChannel && follow && !publicClaim) return 'hidden';
  if (base && anyChannel) return 'clear';
  if (publicClaim && !base) return 'dispute';
  if (has('M056') && has('M057')) return 'partial';
  return 'procedural';
}

/* ---------------- 政务平台：这一节课的办理进度 ----------------
   编号只认玩家自己提交的那张表（kind: 'eighth'），
   主线或别的支线的受理编号不借过来用。 */
export function eighthProgress(state) {
  const gov = (state.gov && state.gov.kind === 'eighth') ? state.gov : {};
  const no = gov.no || 'ZW2025121622081';
  const t0 = gov.time || '2025-12-16 22:08';
  return {
    no,
    subject: '反映明德中学初三年级在课表之外安排集体授课',
    unit: '市教育局 · 基础教育科',
    nodes: [
      {
        title: '提交', time: t0, who: '本人 · 市政务服务平台', state: '已提交',
        opinion: '反映对象：明德中学。已勾选真实性承诺。'
      },
      {
        title: '受理', time: '2025-12-17 09:40', who: '市政务服务热线', state: '已受理',
        opinion: '事项已受理，转市教育局基础教育科办理。'
      },
      {
        title: '交办', time: '2025-12-17 14:20', who: '市教育局基础教育科', state: '已交办',
        opinion: '转学校所属教育集团核查课后服务实施情况。'
      },
      {
        title: '承办', time: '2025-12-23 10:30', who: '区教育局 · 基教科', state: '办理中',
        opinion: '已调阅学校课后服务备案材料与课表，询问相关教师。'
      },
      {
        title: '答复', time: '2026-01-06 15:10', who: '区教育局 · 基教科', state: '已办结',
        opinion: '办理结果已通过本页面答复，并同步发送短信提示。'
      }
    ],
    reply: [
      '同学你好！你反映的情况收悉，现答复如下：',
      '一、经核查，明德中学本学期按上级要求开展课后服务，服务时间为每周二、周四下午放学后四十分钟，遵循学生自愿参加原则。',
      '二、关于你反映的"课表之外"问题。经了解，课后服务不属于国家课程，未列入课表属正常安排；学校已在开学初通过《告家长书》告知家长，并在班级群内组织报名。',
      '三、关于课后服务内容。学校表示该时段主要用于作业辅导与答疑，未讲授新课。个别教师因进度原因对已学内容作了复习整理。',
      '四、我局已要求学校进一步规范课后服务管理，做好服务内容公示，不得以任何形式强制或变相强制学生参加。',
      '感谢你对教育工作的关心。'
    ],
    tail: '本答复由区教育局通过市政务服务平台作出，可凭事项编号查询。'
  };
}

/* 交给模型重写答复正文时的材料要点：骨架固定，只换措辞。 */
export const EIGHTH_AI_BRIEF = {
  kind: 'eighth',
  facts: {
    subject: '反映明德中学初三年级在课表之外安排每周两节集体授课',
    unit: '明德中学',
    points: [
      '课表上只有七节，每周二、四第七节后全班继续留校四十分钟',
      '该时段实际讲授新内容（二次函数第二课时），不是作业辅导',
      '《告家长书》写「自愿参加」，同时写「原则上全员留校」',
      '班级群以接龙方式报名，接龙名单四十一人，无一人不接',
      '点名册按班级点名，缺席记录直接反馈给班主任'
    ],
    extra: '答复口径必须是：课后服务合规、自愿、已告知；「未列入课表属正常安排」；内容「以辅导答疑为主，个别教师作了复习整理」，不承认讲授新课；不出现处分、追责、具体教师姓名。'
  }
};

/* 提交那一刻的进度页：三段，答复还没出来。 */
export const EIGHTH_FORM_PROGRESS = (no, time) => ({
  no,
  unit: '市教育局 · 基础教育科',
  subject: '反映明德中学初三年级在课表之外安排集体授课',
  nodes: [
    { title: '提交', time, who: '本人 · 市政务服务平台', state: '已提交',
      opinion: '已提交，勾选真实性承诺。' },
    { title: '受理', time: '2025-12-17 09:40', who: '市政务服务热线', state: '已受理',
      opinion: '事项已受理，转市教育局基础教育科办理。' },
    { title: '答复', time: '', who: '区教育局 · 基教科', state: '办理中', done: false,
      opinion: '正在办理，答复后将通过本页面或短信告知。' }
  ],
  reply: ['你的反映已受理，正在办理中。', '办理完成后，答复内容会出现在「进度查询详情」的节点意见里。']
});

export default {
  id: 'side3',
  title: '支线',
  name: '第八节课',
  dayLabel: '第十六周 · 周二',
  music: 'calm2',
  // 和另外两条支线一样的给法：十二个行动里选八个
  apMax: 8,

  nodes: [
    /* ================= 一、铃响了，没有人站起来 ================= */
    { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 第七节课后 16:40' },
    { t: 'music', id: 'calm2' },
    { t: 'narr', text: '第七节课的下课铃是十六点四十分响的。' },
    { t: 'narr', text: '铃响完，没有人站起来。' },
    { t: 'narr', text: '我数了一下：靠窗那一列，六个人坐着；中间两列，一个都没动；后排靠门，两个男生把椅子往后挪了挪，又坐回去了。' },
    { t: 'narr', text: '全班四十一个人，四十一个人都坐着。' },
    { t: 'narr', text: '有人从桌肚里把数学书拿出来，翻到很后面的一页。' },
    { t: 'narr', text: '那个动作很熟练，熟练到不像是临时决定。' },
    { t: 'narr', text: '我把书包带子从椅背上取下来，拎在手里。' },
    { t: 'narr', text: '然后又挂回去了。' },
    { t: 'say', who: 'lin', name: '林知序', text: '（心里）课表上，第七节是最后一节。' },
    { t: 'narr', text: '这句话我在心里说了一遍，没有人听见，也没有人需要听见。' },
    { t: 'narr', text: '走廊里传来别的班的声音。' },
    { t: 'narr', text: '不是下课那种声音——不是椅子响、不是跑、不是喊。' },
    { t: 'narr', text: '是坐着的声音。' },
    { t: 'narr', text: '广播响了一下，先是一阵电流声，然后：' },
    { t: 'narr', text: '「各年级按课后服务安排，继续。」' },
    { t: 'narr', text: '「课后服务」这四个字，我上一次见到是在开学第一天的通知上。' },
    { t: 'narr', text: '那天我以为它指的是可以在教室里写作业。' },

    /* --- 黑板 --- */
    { t: 'show', id: 'chen', pos: 'center' },
    { t: 'narr', text: '陈老师从前门进来，手里只有一支粉笔。' },
    { t: 'narr', text: '她把粉笔在黑板上按了一下，开始写。' },
    { t: 'narr', text: '「二次函数 y=ax² 的图像与性质（二）」' },
    { t: 'narr', text: '写完，她回过头。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '翻到五十八页。' },
    { t: 'narr', text: '教室里全是翻书的声音。' },
    { t: 'narr', text: '我也翻了。五十八页。' },
    { t: 'narr', text: '五十八页是新的。' },
    { t: 'narr', text: '上周五讲到第五课的例题，课本上还夹着那张我做了一半的练习纸，纸边在五十四页。' },
    { t: 'narr', text: '五十四和五十八之间，隔着四页。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '上节课我们把 a 大于零的情况看完了。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '这节课看 a 小于零。' },
    { t: 'narr', text: '她在黑板右边画了一个开口向下的抛物线。' },
    { t: 'narr', text: '画得很慢，起笔的地方特意顿了一下。' },
    { t: 'say', who: 'lin', name: '林知序', text: '（心里）上节课是上周四。' },
    { t: 'say', who: 'lin', name: '林知序', text: '（心里）上周四的第七节。' },
    { t: 'narr', text: '我把笔帽咬在嘴里，没有动。' },
    { t: 'narr', text: '后排有人小声说了一句「这题作业里有」，被旁边的人用胳膊碰了一下。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '这一节讲完，明天早读我们做两道练习。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '讲不完的话，就往后挪。' },
    { t: 'narr', text: '「往后挪」。' },
    { t: 'narr', text: '往后挪到哪里，她没有说。' },

    /* --- 十七点二十 --- */
    { t: 'hide', id: 'chen' },
    { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 17:20' },
    { t: 'music', id: 'silent' },
    { t: 'narr', text: '十七点二十，陈老师把粉笔放回槽里。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '今天到这里。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '值日生留下，其他人可以走了。' },
    { t: 'narr', text: '这一次，椅子响了。' },
    { t: 'narr', text: '四十一个人几乎同时站起来，教室一下子空了一半。' },
    { t: 'narr', text: '没有人问刚才那节课是什么课。' },
    { t: 'narr', text: '也没有人说「今天多上了一节」。' },
    { t: 'narr', text: '我收拾书包的时候，看见黑板上那行字还在。' },
    { t: 'narr', text: '值日生擦到那一行，停了一下，先拍了张照，才擦掉。' },
    { t: 'narr', text: '我问他拍什么。' },
    { t: 'narr', text: '他说：「我妈要看。」' },

    /* --- 课表 --- */
    { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 教室后墙' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '教室后墙上贴着这学期的课表。' },
    { t: 'narr', text: 'A4，横排，一周六天（周六那栏本来印了，用白纸贴上）。' },
    { t: 'narr', text: '每天七行：早读、一、二、三、四、五、六、七。' },
    { t: 'narr', text: '七行下面有一条粗横线，横线以下是空白。' },
    { t: 'narr', text: '我用手指顺着一列往下数，数到第七节，下面什么都没有。' },
    { t: 'narr', text: '课表上没有第八节。' },
    { t: 'narr', text: '我退后一步，从整张纸看。' },
    { t: 'narr', text: '右下角那块空白上，有一行铅笔字。' },
    { t: 'narr', text: '「二、四 第8节 课后服务」' },
    { t: 'narr', text: '字很小，写得很轻，像是怕被谁看见，又像是怕自己忘了。' },
    { t: 'narr', text: '铅笔。没有盖章。没有日期。没有谁签的字。' },
    { t: 'narr', text: '这张课表从九月贴到现在，被风扇吹得起过两次角，被人用手按平过很多次。' },
    { t: 'narr', text: '那行铅笔字就在那儿，四个月。' },
    { t: 'say', who: 'lin', name: '林知序', text: '（心里）四个月，没有一个人把它擦掉。' },

    /* ================= 二、调查 ================= */
    { t: 'narr', text: '做完值日，教室里只剩几个人。' },
    { t: 'narr', text: '离我回家还有一段时间。' },
    { t: 'hub' },

    /* ================= 三、放学后 ================= */
    { t: 'hide', all: true },
    { t: 'bg', id: 'corridorDusk', place: '教学楼三楼 · 走廊' },
    { t: 'music', id: 'sunset' },
    { t: 'narr', text: '十七点五十，走廊的灯开了一半。' },
    { t: 'narr', text: '不开的那一半靠西，天还没黑透，光线是灰的。' },
    { t: 'show', id: 'shen', pos: 'center' },
    { t: 'narr', text: '沈予安在楼梯口等我。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '你今天在数人。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你看出来了。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '你数了两遍。' },
    { t: 'narr', text: '她把手插在校服兜里，往下走了两级台阶，又站住。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '你数出来了吗。' },
    { t: 'say', who: 'lin', name: '林知序', text: '没有。' },
    { t: 'say', who: 'lin', name: '林知序', text: '我数的是坐着的人。' },
    { t: 'narr', text: '她低头看着楼梯的防滑条。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我们班从九月就开始了。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你怎么知道是九月。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '因为九月第二周我就留过。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '那时候说是「试运行」。' },
    { t: 'narr', text: '试运行这三个字，我记住了。' },
    { t: 'narr', text: '试运行的东西，通常不会有人问它什么时候转正。' },
    {
      t: 'choice',
      prompt: '',
      options: [
        {
          text: '「试运行了一个学期，谁批的？」',
          goto: 't_who',
          effects: [{ stat: 'shen', trust: 1 }]
        },
        {
          text: '「你为什么不走？」',
          goto: 't_why',
          effects: [{ stat: 'shen', trust: 3 }]
        },
        {
          text: '「……算了。跟你没关系。」',
          goto: 't_drop',
          effects: [{ stat: 'shen', trust: -3, pressure: 3 }]
        }
      ]
    },

    { t: 'label', name: 't_who' },
    { t: 'say', who: 'lin', name: '林知序', text: '试运行了一个学期，谁批的？' },
    { t: 'narr', text: '她抬起头，好像没料到我会问这个。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我不知道。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我以为你知道。' },
    { t: 'say', who: 'lin', name: '林知序', text: '我什么都不知道。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '……那就有点奇怪了。' },
    { t: 'narr', text: '她说完这句，往上走了两级台阶，站到和我一样高。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '大家都不问，我以为是因为大家都知道了。' },
    { t: 'goto', label: 't_join' },

    { t: 'label', name: 't_why' },
    { t: 'say', who: 'lin', name: '林知序', text: '你为什么不走？' },
    { t: 'narr', text: '她沉默了一会儿。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '因为没有人走。' },
    { t: 'narr', text: '这句话说得很平，像在陈述一个天气。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我试过一次。' },
    { t: 'say', who: 'lin', name: '林知序', text: '什么时候。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '十月。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我背上书包站起来，全班都看着我。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '陈老师说了一句「你妈妈知道吗」。' },
    { t: 'narr', text: '她说到这里停了一下。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我说不知道。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '她说「那你先坐下，回头我跟你妈说」。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我就坐下了。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '她没有跟我妈说。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你为什么不去问。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '因为我妈也不知道这件事更好。' },
    { t: 'flag', key: 's3_shen_sat_down' },
    { t: 'goto', label: 't_join' },

    { t: 'label', name: 't_drop' },
    { t: 'say', who: 'lin', name: '林知序', text: '……算了。跟你没关系。' },
    { t: 'narr', text: '她看了我两秒。' },
    { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '嗯。' },
    { t: 'narr', text: '然后她转身下楼，走了。' },
    { t: 'narr', text: '我站在楼梯口，听见她的脚步声一层一层往下。' },
    { t: 'narr', text: '「跟你没关系」这句话，是我说的。' },
    { t: 'narr', text: '说完我就知道说错了。' },
    { t: 'goto', label: 't_join' },

    { t: 'label', name: 't_join' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'gateDusk', place: '校门口 · 十八点十分' },
    { t: 'music', id: 'silent' },
    { t: 'narr', text: '出校门的时候天已经黑了。' },
    { t: 'narr', text: '校门口的灯是暖黄色的，照在地上有一圈一圈的水汽。' },
    { t: 'narr', text: '公告栏还亮着。走廊灯关了，公告栏自己有一盏小灯。' },
    { t: 'narr', text: '玻璃上贴着这学期的课表，和教室后墙那张一模一样。' },
    { t: 'narr', text: '不一样的地方是——这张没有铅笔字。' },
    { t: 'narr', text: '公告栏上的课表，干干净净，七行，底下是空白。' },
    { t: 'say', who: 'lin', name: '林知序', text: '（心里）同一所学校，两张课表。' },
    { t: 'narr', text: '一张贴在教室里，有人用铅笔加了一行。' },
    { t: 'narr', text: '一张贴在公告栏，什么都没加。' },

    /* ================= 四、往外面递 ================= */
    { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上十点' },
    { t: 'music', id: 'night_street' },
    { t: 'narr', text: '晚上十点，我把今天的东西摊在床上。' },
    { t: 'narr', text: '课表的照片、黑板上的那行字、点名册抄下来的半张、家长群里的接龙。' },
    { t: 'narr', text: '摊开之后，只有一件事是清楚的：' },
    { t: 'narr', text: '每周二、周四，十六点四十到十七点二十，四十分钟，全班留校，讲的是新课。' },
    { t: 'narr', text: '这件事发生了十六周。' },
    { t: 'narr', text: '它没有出现在任何一张纸上。' },
    { t: 'narr', text: '我打开手机，输入「课后服务」。' },
    { t: 'narr', text: '跳出来的第一条是政策问答：' },
    { t: 'narr', text: '「中小学生课后服务应坚持学生自愿参加，不得利用课后服务时间讲授新课，服务内容、时间、收费应主动公示。」' },
    { t: 'narr', text: '三句话，我读了两遍。' },
    { t: 'narr', text: '第一句，自愿。第二句，不讲新课。第三句，公示。' },
    { t: 'narr', text: '三条，一条都没做到。' },
    { t: 'narr', text: '而三条没有一条是"没写"。三条都写在纸上。' },
    { t: 'narr', text: '我坐在床沿上，想了一会儿。' },
    {
      t: 'choice',
      prompt: '要往外面递吗？',
      options: [
        { text: '网上填表。把课表、黑板、点名册一条条写进去', goto: 's3o_form' },
        { text: '打 12345，先问清楚"课后服务"到底归谁管', goto: 's3o_call' },
        { text: '不递。明天还要上课', goto: 's3o_none' }
      ]
    },

    { t: 'label', name: 's3o_form' },
    { t: 'narr', text: '「是否已向被反映单位反映」这一栏，我选了「是」。' },
    { t: 'narr', text: '选完又改回「否」，想了想，又改成「是」。' },
    {
      t: 'govform',
      kind: 'eighth',
      time: '2025-12-16 22:08',
      progress: EIGHTH_FORM_PROGRESS
    },
    { t: 'narr', text: '提交，跳出受理编号。' },
    { t: 'narr', text: '编号里有日期，后面的数字看不出规律。' },
    { t: 'narr', text: '我把它抄在课表照片的背面。' },
    { t: 'flag', key: 's3_gov_submitted' },
    { t: 'flag', key: 's3_channels', value: 1 },
    { t: 'goto', label: 'verdict' },

    { t: 'label', name: 's3o_call' },
    { t: 'narr', text: '我把要说的写在纸上：几节课、几点到几点、课表上有没有。' },
    { t: 'narr', text: '写到「有没有」那一行，我停了很久。' },
    { t: 'narr', text: '这个问题的答案是一张照片，照片上有一行铅笔字。' },
    {
      t: 'hotline',
      callTitle: '12345 · 通话中',
      number: '12345',
      steps: [
        { who: '接线员', text: '您好，这里是 12345 政务服务便民热线，请问有什么可以帮您。' },
        {
          ask: '接线员：请讲。',
          options: [
            { text: '学校每周二、四放学后多上一节课，课表上没有。', reply: '好的，请问是哪一所学校、哪个年级。', flag: 's3_hot_open' },
            { text: '我想问一下，学校课后服务归哪个部门管。', reply: '中小学课后服务由教育行政部门主管，具体可向属地教育局反映。', flag: 's3_hot_ask' }
          ]
        },
        { who: '我', text: '明德中学，初三年级，每周二和周四。' },
        { who: '接线员', text: '您说的"多上一节课"，是学校安排的课后服务吗。' },
        {
          ask: '接线员：是学校安排的课后服务吗？',
          options: [
            { text: '如果课后服务不能讲新课，那这就不是课后服务。', reply: '……好的，您继续说。', flag: 's3_hot_point' },
            { text: '我不知道。课表上没有，也没人说过这是什么。', reply: '好的，我按「课表外安排集体授课」记录。', flag: 's3_hot_record' }
          ]
        },
        { who: '我', text: '讲的是二次函数第二课时。课本五十八页。' },
        { who: '接线员', text: '您怎么确定是新内容。' },
        { who: '我', text: '因为上一节讲到五十四页，中间四页没有讲过。' },
        { who: '我', text: '而且明天早读要做这一节的练习。' },
        { who: '接线员', text: '好的。有没有跟学校反映过。' },
        {
          ask: '接线员：有没有跟学校反映过？',
          options: [
            { text: '有。我写过一张纸交上去。', reply: '好的，那我一并记录。', flag: 's3_hot_said' },
            { text: '没有。', reply: '好的，我按未向学校反映记录。', flag: 's3_hot_notsaid' }
          ]
        },
        { who: '接线员', text: '这个事项会转教育部门核实。工单号 2025121647309，办理时限十五个工作日。' },
        { who: '我', text: '（我把工单号念了一遍，念的时候在数位数。）' }
      ]
    },
    { t: 'narr', text: '挂了电话，我发现手心有汗。' },
    { t: 'narr', text: '整通电话里，我说得最清楚的一句是「中间四页没有讲过」。' },
    { t: 'narr', text: '这一句是我自己想出来的，没有人教过我该这么说。' },
    { t: 'flag', key: 's3_gov_submitted' },
    { t: 'flag', key: 's3_channels', value: 1 },
    { t: 'goto', label: 'verdict' },

    { t: 'label', name: 's3o_none' },
    { t: 'narr', text: '我把手机放下。' },
    { t: 'narr', text: '床上的东西一件一件收进书包，收得很整齐。' },
    { t: 'narr', text: '课表照片留在相册里，没有删。' },
    { t: 'narr', text: '明天第二节是数学。' },
    { t: 'narr', text: '明天下午四点四十，铃还会响。' },
    { t: 'flag', key: 's3_no_channel' },
    { t: 'goto', label: 'verdict' },

    /* ================= 五、答复 ================= */
    { t: 'label', name: 'verdict' },
    { t: 'hide', all: true },
    { t: 'if', cond: (s) => !!(s.flags && s.flags.s3_gov_submitted), then: 'v_reply' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_reply' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 一月六日 晚' },
    { t: 'music', id: 'office' },
    { t: 'narr', text: '一月六号，晚上七点多，手机响了。' },
    { t: 'narr', text: '陌生号码，自动语音，说事项已办结，请到平台查询。' },
    { t: 'narr', text: '我打开页面。编号对上。' },
    { t: 'govprogress', data: eighthProgress, ai: () => EIGHTH_AI_BRIEF },
    { t: 'narr', text: '五段。读完我把它复制到备忘录里。' },
    { t: 'narr', text: '第一段说，课后服务是按上级要求开展的。' },
    { t: 'narr', text: '第二段说，未列入课表「属正常安排」。' },
    { t: 'narr', text: '第三段说，内容「以辅导答疑为主」。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '「个别教师因进度原因对已学内容作了复习整理。」' },
    { t: 'narr', text: '这句话我看了三遍。' },
    { t: 'narr', text: '「已学内容」四个字，和五十四页到五十八页之间那四页，对不上。' },
    { t: 'narr', text: '「复习整理」四个字，和黑板上的「（二）」，也对不上。' },
    { t: 'narr', text: '但是它写在答复里，就是结论了。' },

    /* --- 补材料：名单 --- */
    { t: 'if', cond: (s) => hasMaterial(s, 'M065'), then: 'v_follow' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_follow' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 一月六日 晚' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '答复里有一句话，我盯了很久。' },
    { t: 'narr', text: '「遵循学生自愿参加原则。」' },
    { t: 'narr', text: '自愿。' },
    { t: 'narr', text: '我手上有一张纸，上面是我自己数出来的东西：' },
    { t: 'narr', text: '从九月到十二月，我们班不参加第八节的，一共三个人。' },
    { t: 'narr', text: '三个人里，两个后来也参加了。' },
    { t: 'narr', text: '剩下那一个，转学了。' },
    { t: 'narr', text: '这张纸没有图章，没有签名，只有一个学生用铅笔写的时间和人数。' },
    { t: 'narr', text: '答复说「自愿」，这张纸上写的是「三个」。' },
    {
      t: 'choice',
      prompt: '',
      options: [
        {
          text: '补一份材料上去。名单也是证据',
          goto: 'v_send',
          effects: [{ flag: 's3_follow', value: true }]
        },
        {
          text: '算了。答复已经出来了',
          goto: 'v_stop'
        }
      ]
    },

    { t: 'label', name: 'v_send' },
    { t: 'narr', text: '我打开平台，找到「补充材料」那一栏。' },
    { t: 'narr', text: '上传，写说明：' },
    { t: 'narr', text: '「本人统计本班本学期不参加该时段的学生共 3 人，其中 2 人于十月后开始参加，1 人于十一月转学。统计方式为本人日常观察，无书面记录可佐证。」' },
    { t: 'narr', text: '最后一句我写了很久。' },
    { t: 'narr', text: '「无书面记录可佐证」——这句话会让这份材料变轻。' },
    { t: 'narr', text: '但不写这句话，它就变成了一份伪造的东西。' },
    { t: 'narr', text: '我写上了。' },
    { t: 'narr', text: '提交之后，页面上多了一行字：「补充材料已接收，将并入办理。」' },
    { t: 'narr', text: '就这一行。没有编号，没有时间。' },
    { t: 'flag', key: 's3_followed' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_stop' },
    { t: 'narr', text: '我把页面关掉。' },
    { t: 'narr', text: '那张纸还在桌上，摊开着。' },
    { t: 'narr', text: '我没有收。' },
    { t: 'narr', text: '第二天早上，它还摊在那儿，纸角被杯子压出一道弧。' },
    { t: 'goto', label: 'v_branch' },

    /* ================= 六、结果 ================= */
    { t: 'label', name: 'v_branch' },
    { t: 'hide', all: true },
    { t: 'branch', decide: decideSide3Result, prefix: 'r_', outcomes: ['hidden', 'clear', 'partial', 'procedural', 'dispute'] },

    /* ---------- 隐藏：那节课从课表上消失了 ---------- */
    { t: 'label', name: 'r_hidden' },
    { t: 'ending', id: 'side_eighth' },
    { t: 'bg', id: 'classroom', place: '初三（2）班 · 一月九日' },
    { t: 'music', id: 'hope' },
    { t: 'narr', text: '一月九号，星期五。' },
    { t: 'narr', text: '教室后墙那张课表被换掉了。' },
    { t: 'narr', text: '新的那张是彩印的，比旧的大一号，塑封过，四个角用图钉钉住。' },
    { t: 'narr', text: '右下角那块空白上，什么也没有。' },
    { t: 'narr', text: '第八节没有出现在新课表上。' },
    { t: 'narr', text: '它只是不见了。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '一月十二号，星期二。' },
    { t: 'narr', text: '十六点四十分的铃响了。' },
    { t: 'narr', text: '教室里四十一个人，四十一个人都坐着。' },
    { t: 'narr', text: '没有人站起来走。' },
    { t: 'narr', text: '陈老师进来，手里只有一支粉笔。' },
    { t: 'narr', text: '她在黑板上写：「作业辅导」。' },
    { t: 'narr', text: '然后她转过身，说：「今天不留新的。有问题的举手。」' },
    { t: 'narr', text: '教室里没有人举手。' },
    { t: 'narr', text: '她把手放下，站了一会儿，坐在了讲台的椅子上。' },
    { t: 'narr', text: '那四十分钟，全班做了一节课的作业。' },
    { t: 'narr', text: '下课的时候，她收拾东西，经过我的桌子，停了一下。' },
    { t: 'show', id: 'chen', pos: 'center' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '那四页，你们自己补一下。' },
    { t: 'say', who: 'lin', name: '林知序', text: '哪四页。' },
    { t: 'narr', text: '她看了我一眼。' },
    { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '你知道是哪四页。' },
    { t: 'narr', text: '她走了。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '后来那张名单上的三个人的事，我没有跟任何人说过。' },
    { t: 'narr', text: '那个转学的同学叫什么，我记得。' },
    { t: 'narr', text: '他转学那天，走廊上很安静，班主任在办公室门口跟他妈妈说话。' },
    { t: 'narr', text: '说的是「孩子的适应问题」。' },
    { t: 'narr', text: '那天是十一月十四号，星期四。' },
    { t: 'narr', text: '下午十六点四十分，铃响了。' },
    { t: 'goto', label: 'outro' },

    /* ---------- 查明 ---------- */
    { t: 'label', name: 'r_clear' },
    { t: 'ending', id: 'side_clear3' },
    { t: 'bg', id: 'classroom', place: '初三（2）班 · 一月' },
    { t: 'music', id: 'calm2' },
    { t: 'narr', text: '一月九号，教室后墙换了一张新课表。' },
    { t: 'narr', text: '塑封的，彩印，右下角那块空白上是空的。' },
    { t: 'narr', text: '一月十二号，星期二，十六点四十分的铃响了。' },
    { t: 'narr', text: '教室里四十一个人，四十一个人都坐着。' },
    { t: 'narr', text: '陈老师进来，在黑板上写「作业辅导」。' },
    { t: 'narr', text: '然后她说：「今天不留新的。有问题的举手。」' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '那四页一直没有补。' },
    { t: 'narr', text: '期末考试考到了第二课时。' },
    { t: 'narr', text: '全班那道题做得还行——因为大部分人在那四十分钟里听过一遍。' },
    { t: 'narr', text: '我听过一遍，也做得还行。' },
    { t: 'narr', text: '这件事让我很长时间没法把话说清楚。' },
    { t: 'goto', label: 'outro' },

    /* ---------- 部分查明 ---------- */
    { t: 'label', name: 'r_partial' },
    { t: 'ending', id: 'side_partial3' },
    { t: 'bg', id: 'corridorDusk', place: '教学楼三楼 · 走廊' },
    { t: 'music', id: 'silent' },
    { t: 'narr', text: '答复出来之后，学校做了一件事：' },
    { t: 'narr', text: '在走廊上贴了一张《课后服务安排表》。' },
    { t: 'narr', text: 'A3，彩印，有服务时间、有内容、有负责教师、有监督电话。' },
    { t: 'narr', text: '右下角盖了教务处的章。' },
    { t: 'narr', text: '那张表上没有写它从哪一天开始执行。' },
    { t: 'narr', text: '也没有写在这之前是怎么做的。' },
    { t: 'narr', text: '它只是从这一天起，贴在走廊上。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '我的材料里没有课表原件，也没有黑板。' },
    { t: 'narr', text: '只有家长群那张《告家长书》，和点名册抄下来的半张。' },
    { t: 'narr', text: '这两样东西能证明「有这件事」，证明不了「这件事不合规」。' },
    { t: 'narr', text: '所以答复写的是：已要求规范公示。' },
    { t: 'narr', text: '它也确实规范了。' },
    { t: 'goto', label: 'outro' },

    /* ---------- 只有程序进展 ---------- */
    { t: 'label', name: 'r_procedural' },
    { t: 'ending', id: 'side_procedural3' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 一月' },
    { t: 'music', id: 'silent' },
    { t: 'narr', text: '答复我读了两遍就关了。' },
    { t: 'narr', text: '四段话，六个「已要求」。' },
    { t: 'narr', text: '没有一句话提到那四十分钟。' },
    { t: 'narr', text: '我打开平台，看了一眼进度。' },
    { t: 'narr', text: '五个节点，全部绿色，已办结。' },
    { t: 'narr', text: '办结的意思是：这件事有人管过了。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '第二天下午四点四十，铃响了。' },
    { t: 'narr', text: '我坐着。' },
    { t: 'narr', text: '我们全班都坐着。' },
    { t: 'narr', text: '陈老师在黑板上写：「五十九页」。' },
    { t: 'goto', label: 'outro' },

    /* ---------- 陷入争议 ---------- */
    { t: 'label', name: 'r_dispute' },
    { t: 'ending', id: 'side_dispute3' },
    { t: 'bg', id: 'classroom', place: '初三（2）班 · 第二天' },
    { t: 'music', id: 'tense' },
    { t: 'narr', text: '事情是从学生群开始的。' },
    { t: 'narr', text: '我在群里发了一句：「第八节课没有写进课表，讲的是新课。」' },
    { t: 'narr', text: '下面跟了三十多条。' },
    { t: 'narr', text: '有人说「早就想说了」，有人发了个表情包，有人截图转发到别的班。' },
    { t: 'narr', text: '第二天中午，班主任把我叫到办公室。' },
    { t: 'narr', text: '她没有发火。她把手机放在桌上，屏幕朝着我。' },
    { t: 'narr', text: '是那张截图。' },
    { t: 'narr', text: '「这句话是你说的吗。」' },
    { t: 'narr', text: '我说是。' },
    { t: 'narr', text: '「你知道这句话传出去，别人会怎么理解。」' },
    { t: 'narr', text: '我没有答。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '三天后，学校发了一则说明：' },
    { t: 'narr', text: '「关于网传我校课表外安排授课的情况，经核实，系个别班级课后服务时段的教学安排，' },
    { t: 'narr', text: '未列入课表，已责令整改。」' },
    { t: 'narr', text: '「个别班级」。' },
    { t: 'narr', text: '全年级六个班，六个班都在上。' },
    { t: 'narr', text: '但说明只有这一句，而我手里没有课表原件，也没有黑板。' },
    { t: 'narr', text: '我只有一句话，和三十多个转发。' },
    { t: 'narr', text: '后来的两个月，走廊上有人见我会绕开走。' },
    { t: 'narr', text: '也有人特意过来跟我说「你说得对」。' },
    { t: 'narr', text: '说这句话的人，说完就走了，走得很快。' },
    { t: 'goto', label: 'outro' },

    /* ---------- 收尾 ---------- */
    { t: 'label', name: 'outro' },
    { t: 'wait', ms: 200 },
    { t: 'end' }
  ],

  /* ================= 调查行动 ================= */
  hubActions: [
    {
      id: 's3_schedule',
      title: '把课表抄下来',
      tag: '文书',
      desc: '教室后墙那张，公告栏那张，两张都抄一遍。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 后墙' },
        { t: 'narr', text: '我把椅子搬到后墙下面，站上去。' },
        { t: 'narr', text: '课表是塑封过的——不对，教室里这张没有塑封，就是一张 A4，用四条透明胶压着。' },
        { t: 'narr', text: '我从左上角开始抄：' },
        { t: 'narr', text: '早读 7:30—8:00；一 8:00—8:40；二 8:50—9:30；三 9:40—10:20；四 10:30—11:10。' },
        { t: 'narr', text: '午休 11:10—13:00；五 13:00—13:40；六 13:50—14:30；七 14:40—15:20。' },
        { t: 'narr', text: '抄到第七节，我停了一下。' },
        { t: 'narr', text: '七 14:40—15:20。' },
        { t: 'narr', text: '十五点二十。' },
        { t: 'say', who: 'lin', name: '林知序', text: '（心里）那我每天十六点四十坐下来的时候，是按哪张表？' },
        { t: 'narr', text: '课表上，十五点二十之后是空白。' },
        { t: 'narr', text: '而每天下午第七节，实际上是十六点四十才下课。' },
        { t: 'narr', text: '也就是说，第七节本身就多上了八十分钟。' },
        { t: 'narr', text: '我重数了一遍。' },
        { t: 'narr', text: '十四点四十到十六点四十，两个钟头，中间一次课间十分钟。' },
        { t: 'narr', text: '一天八节，全校都是这样。' },
        { t: 'narr', text: '下课铃是十七点二十的。' },
        { t: 'narr', text: '我把这行也抄上去：' },
        { t: 'narr', text: '「实际作息与课上表时间不一致（每日约 80 分钟）」' },
        { t: 'narr', text: '然后我翻到纸张背面，把右下角那行铅笔字临了一遍：' },
        { t: 'narr', text: '「二、四 第8节 课后服务」' },
        { t: 'narr', text: '临完，我把纸对折，夹进书里。' },
        { t: 'narr', text: '塑封的那张是公告栏上的，抄下来一模一样，只有一处不同：' },
        { t: 'narr', text: '公告栏那张的右下角，没有铅笔字。' },
        { t: 'mat', id: 'M055' },
        { t: 'flag', key: 's3_has_schedule' }
      ]
    },
    {
      id: 's3_board',
      title: '拍下黑板',
      tag: '现场',
      desc: '趁值日生还没擦，先把那行字拍下来。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 黑板' },
        { t: 'narr', text: '值日生拿着黑板擦站在讲台边上，等我。' },
        { t: 'say', who: 'lin', name: '林知序', text: '等一下。' },
        { t: 'narr', text: '我掏出手机，对着黑板拍了一张。' },
        { t: 'narr', text: '屏幕上，那行字很清楚：' },
        { t: 'narr', text: '「二次函数 y=ax² 的图像与性质（二）」' },
        { t: 'narr', text: '底下的板书还没擦，右边是一条开口向下的抛物线，三个点标了坐标。' },
        { t: 'say', who: 'lin', name: '林知序', text: '再等一下。' },
        { t: 'narr', text: '我退后两步，把整块黑板拍进去，包括左上角的日期栏。' },
        { t: 'narr', text: '日期栏写着：「12/16 周二」。' },
        { t: 'narr', text: '值日生把黑板擦按在右上角，开始擦。' },
        { t: 'say', who: 'lin', name: '林知序', text: '你也拍了？' },
        { t: 'narr', text: '他愣了一下，把手机翻过来给我看。' },
        { t: 'narr', text: '同一块黑板，同一个角度，只是他的手有点抖。' },
        { t: 'narr', text: '「我妈要看。」他说。' },
        { t: 'narr', text: '「看什么？」' },
        { t: 'narr', text: '「看今天讲到哪儿。」' },
        { t: 'narr', text: '他把黑板擦放回槽里，拍了两下手。' },
        { t: 'narr', text: '「她跟不上。她说她连二次函数是什么都不知道。」' },
        { t: 'narr', text: '粉笔灰在光里飘，飘了很久才落下去。' },
        { t: 'mat', id: 'M058' },
        { t: 'flag', key: 's3_has_board' }
      ]
    },
    {
      id: 's3_roll',
      title: '看点名册',
      tag: '文书',
      desc: '第七节下课以后，值日生手里那份册子还在。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 讲台' },
        { t: 'narr', text: '值日生把点名册放在讲台上，人去了走廊倒水。' },
        { t: 'narr', text: '我翻开来。' },
        { t: 'narr', text: '不是印的，是手写的。一张横格纸，用尺子画的线，一共四十二行。' },
        { t: 'narr', text: '表头写着「课后服务考勤」。' },
        { t: 'narr', text: '下面两栏：姓名 / 出席。' },
        { t: 'narr', text: '出席那栏，全是勾。' },
        { t: 'narr', text: '一列一列看过去，四十一个勾，加一个空行。' },
        { t: 'narr', text: '空行是转学那个同学的。' },
        { t: 'narr', text: '日期从九月九号开始，每周两格，一直到十二月十一号。' },
        { t: 'narr', text: '我数了一下：二十七次。' },
        { t: 'narr', text: '二十七次课，四十一个人，一千零八十九个勾。' },
        { t: 'narr', text: '没有一格是空的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '（心里）一节课都没有人缺席。' },
        { t: 'narr', text: '在别的地方，这会被当成纪律好。' },
        { t: 'narr', text: '我掏出手机，把最近四页拍了下来。' },
        { t: 'narr', text: '拍到最后一页的时候，我看见页脚有一行更小的字：' },
        { t: 'narr', text: '「缺勤由班长当日反馈班主任。」' },
        { t: 'mat', id: 'M057' },
        { t: 'flag', key: 's3_has_roll' }
      ]
    },
    {
      id: 's3_count',
      title: '数一数不参加的人',
      tag: '文书',
      desc: '自己数。从九月到现在，到底有没有人真的没留下。',
      ap: 1,
      once: true,
      cond: (s) => !!(s.flags && s.flags.s3_has_roll),
      script: [
        { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 我的座位' },
        { t: 'narr', text: '我坐回自己的位置，把一张草稿纸翻到背面。' },
        { t: 'narr', text: '我要数的不是出席的人，是不出席的人。' },
        { t: 'narr', text: '这个数比出席难数——出席的名字有勾，不出的只有记忆。' },
        { t: 'narr', text: '我从九月开始想。' },
        { t: 'narr', text: '九月：全班都在。' },
        { t: 'narr', text: '十月：有一天，沈予安站起来，又坐下了。' },
        { t: 'narr', text: '十一月：罗一舟请过一次假，是病假，不算。' },
        { t: 'narr', text: '十一月中：马文杰有两天没来第八节，第三天又来了。' },
        { t: 'narr', text: '十一月十四号：那个同学转走了。' },
        { t: 'narr', text: '十二月：没有人缺过。' },
        { t: 'narr', text: '我在纸上写：' },
        { t: 'narr', text: '「不参加（含尝试不参加）：3 人」' },
        { t: 'narr', text: '「其中 2 人于十月后恢复参加；1 人于 11 月 14 日转学」' },
        { t: 'narr', text: '「统计方式：本人日常观察，无书面记录佐证」' },
        { t: 'narr', text: '最后这一行，是写给以后可能看这张纸的人看的。' },
        { t: 'narr', text: '写完我看了一遍：' },
        { t: 'narr', text: '四十一个人的班，十六周，三十二节课。' },
        { t: 'narr', text: '不参加的总人数是三个。' },
        { t: 'narr', text: '三个人里，两个回来了，一个走了。' },
        { t: 'narr', text: '这张纸什么也证明不了。' },
        { t: 'narr', text: '但它是我今天写下的东西里，唯一一个不是复印件的数。' },
        { t: 'mat', id: 'M065' },
        { t: 'flag', key: 's3_has_names' }
      ]
    },
    {
      id: 's3_parents',
      title: '翻家长群',
      tag: '文书',
      desc: '我妈的手机里，应该有那份《告家长书》。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'homeLiving', place: '家里的客厅 · 晚上' },
        { t: 'narr', text: '我妈在厨房，手机在茶几上。' },
        { t: 'narr', text: '「妈，我看一下家长群。」' },
        { t: 'narr', text: '「看吧。又是让填什么？」' },
        { t: 'narr', text: '我往上翻。翻了很久。' },
        { t: 'narr', text: '家长群从九月一号到现在，一共四千多条消息。' },
        { t: 'narr', text: '九月八号，陈老师发了一份 PDF：' },
        { t: 'narr', text: '《关于课后服务致家长的一封信》' },
        { t: 'narr', text: '我点开，一页半。' },
        { t: 'narr', text: '「为贯彻落实……我校拟于本学期开展课后服务，服务时间为每周二、周四下午放学后 40 分钟。」' },
        { t: 'narr', text: '「服务内容以作业辅导、答疑为主，不讲授新课、不集体补课。」' },
        { t: 'narr', text: '「课后服务坚持学生自愿参加原则，家长可根据实际情况选择。」' },
        { t: 'narr', text: '「原则上全体学生留校参加，确有特殊情况者，请与班主任联系。」' },
        { t: 'narr', text: '我把这四句读了两遍。' },
        { t: 'narr', text: '前面三句和最后一句，说的是两件事。' },
        { t: 'narr', text: '「自愿参加」；「原则上全体留校」。' },
        { t: 'narr', text: '这两句话印在同一页纸上，相隔两行。' },
        { t: 'narr', text: '下面还有一张表：《回执》。' },
        { t: 'narr', text: '「本人已知悉上述内容，同意子女参加课后服务。」' },
        { t: 'narr', text: '只有一个选项。' },
        { t: 'narr', text: '没有「不同意」那一栏。' },
        { t: 'narr', text: '我往下翻群记录。' },
        { t: 'narr', text: '九月八号晚上七点，陈老师：「请各位家长接龙确认，格式：学生姓名+已阅。」' },
        { t: 'narr', text: '七点零三分，第一条：「沈予安 已阅」' },
        { t: 'narr', text: '七点零五分：「郑野 已阅」' },
        { t: 'narr', text: '七点零五分：「许小满 已阅」' },
        { t: 'narr', text: '……' },
        { t: 'narr', text: '八点四十，最后一条：「林知序 已阅」' },
        { t: 'narr', text: '那是我妈发的。她那天晚上八点四十才下班。' },
        { t: 'narr', text: '我数了一下接龙的名字：四十一个。' },
        { t: 'narr', text: '没有一个人问「不参加怎么办」。' },
        { t: 'narr', text: '我把 PDF 和接龙那一段都截了图。' },
        { t: 'mat', id: 'M056' },
        { t: 'mat', id: 'M063' },
        { t: 'flag', key: 's3_has_parents' }
      ]
    },
    {
      id: 's3_chen',
      title: '问陈老师',
      tag: '人物',
      desc: '她排的课，她应该知道这节课从哪儿来。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridorDusk', place: '教学楼三楼 · 办公室门口' },
        { t: 'show', id: 'chen', pos: 'center' },
        { t: 'narr', text: '她在改卷子，红笔握得很紧。' },
        { t: 'say', who: 'lin', name: '林知序', text: '老师，我想问一下第八节。' },
        { t: 'narr', text: '红笔停了一下。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '哪个第八节。' },
        { t: 'say', who: 'lin', name: '林知序', text: '课后服务那个。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '课后服务是学校安排的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '课表上没有。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '课表是教务处排的。' },
        { t: 'narr', text: '她把红笔放下。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '你要问的是什么。' },
        { t: 'say', who: 'lin', name: '林知序', text: '今天这节课，讲的是二次函数第二课时。' },
        { t: 'say', who: 'lin', name: '林知序', text: '这是新课。' },
        { t: 'narr', text: '她看着我，看了很久。' },
        { t: 'narr', text: '办公室里只有我们两个人，还有一台一直响的饮水机。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '五十八页的内容，期末考不考。' },
        { t: 'say', who: 'lin', name: '林知序', text: '考。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '那我不讲，谁讲。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '课时是按周排的，一周五节数学。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '五节课，讲不完一本书。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那这四十分钟算什么。' },
        { t: 'narr', text: '她把红笔重新拿起来，在卷子上圈了一个地方。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '算我多上。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '不算你们的。' },
        { t: 'narr', text: '这句话她说的很快，像早就想好了。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那为什么要全班留。' },
        { t: 'narr', text: '她没有答。' },
        { t: 'narr', text: '她把那张卷子翻过去，在背面写了一个分数。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '因为留下的那些人，考试会好看一点。' },
        { t: 'say', who: 'chen', name: '陈老师', sprite: 'chen', text: '这个理由不够吗。' },
        { t: 'narr', text: '我站在那里，忽然不知道该说什么。' },
        { t: 'narr', text: '她没有说谎，也没有让我别说。' },
        { t: 'narr', text: '她只是把一件不该由她决定的事，做成了一件由她扛的事。' },
        { t: 'mat', id: 'M059' },
        { t: 'flag', key: 's3_talked_chen' }
      ]
    },
    {
      id: 's3_jwc',
      title: '去教务处问',
      tag: '文书',
      desc: '课表是谁排的，问排课的人。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'commons', place: '行政楼二层 · 教务处' },
        { t: 'narr', text: '教务处的门开着，里面有两个老师在打印东西。' },
        { t: 'narr', text: '我说我想问一下课表。' },
        { t: 'narr', text: '其中一个抬起头。' },
        { t: 'narr', text: '「课表在你们教室后墙。」' },
        { t: 'narr', text: '「我想问第八节。」' },
        { t: 'narr', text: '「学校没有第八节。」' },
        { t: 'narr', text: '他说得很快，快得像是早就准备好的一句话。' },
        { t: 'narr', text: '「那每天四点四十到五点二十是什么。」' },
        { t: 'narr', text: '「课后服务。」' },
        { t: 'narr', text: '「课后服务为什么不写在课表上。」' },
        { t: 'narr', text: '他把打印出来的纸拿起来，抖了抖。' },
        { t: 'narr', text: '「课表是国家课程。课后服务不是课程。」' },
        { t: 'narr', text: '「不是课程，为什么要上课。」' },
        { t: 'narr', text: '他看了我一眼。' },
        { t: 'narr', text: '「你是哪个班的。」' },
        { t: 'narr', text: '「初三（2）班。」' },
        { t: 'narr', text: '「你叫什么。」' },
        { t: 'narr', text: '我报了名字。' },
        { t: 'narr', text: '他在纸上写了一行，然后把纸放进抽屉。' },
        { t: 'narr', text: '「回去上课。」' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '走出来的时候，我在门口站了一会儿。' },
        { t: 'narr', text: '他说的每一句话都对。' },
        { t: 'narr', text: '课表是国家课程，课后服务不是课程，学校没有第八节。' },
        { t: 'narr', text: '三句话连起来，那一节课就不存在。' },
        { t: 'narr', text: '可是我今天下午，在五十八页上坐了四十分钟。' },
        { t: 'mat', id: 'M060' },
        { t: 'flag', key: 's3_asked_jwc' }
      ]
    },
    {
      id: 's3_ask_shen',
      title: '问沈予安',
      tag: '人物',
      desc: '她在这件事上，比谁都知道得清楚。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridorDusk', place: '教学楼三楼 · 走廊尽头' },
        { t: 'show', id: 'shen', pos: 'center' },
        { t: 'narr', text: '她在窗边站着，手里拿着一个空水杯。' },
        { t: 'say', who: 'lin', name: '林知序', text: '我想问你点事。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '第八节。' },
        { t: 'say', who: 'lin', name: '林知序', text: '……你怎么知道。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '你今天看了三次课表。' },
        { t: 'narr', text: '她把水杯放在窗台上。' },
        { t: 'say', who: 'lin', name: '林知序', text: '你们家那封《告家长书》，回执是谁签的。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '我妈。' },
        { t: 'say', who: 'lin', name: '林知序', text: '她看内容了吗。' },
        { t: 'narr', text: '她笑了一下。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '她在接龙的时候看到别人都发了，就发了。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '回执是第二天早上在车上签的。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '她问我签哪儿，我说最后一行。' },
        { t: 'narr', text: '我把这个记下来的时候，手有点慢。' },
        { t: 'say', who: 'lin', name: '林知序', text: '你觉得这件事有问题吗。' },
        { t: 'narr', text: '她想了很久，久到走廊的灯又亮了一排。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '如果是补课，那肯定不对。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '但是不补，我妈会给我报班。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '报班要钱。' },
        { t: 'say', who: 'shen', name: '沈予安', sprite: 'shen', text: '学校这个不要钱。' },
        { t: 'narr', text: '她说得很轻，也没有看我。' },
        { t: 'narr', text: '这句话我没办法反驳。' },
        { t: 'narr', text: '它和「自愿」一样，是成立的。' },
        { t: 'flag', key: 's3_asked_shen' }
      ]
    },
    {
      id: 's3_ask_ma',
      title: '问马文杰',
      tag: '人物',
      desc: '他有两天没来第八节。第三天又来了。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 后排' },
        { t: 'show', id: 'ma', pos: 'center' },
        { t: 'narr', text: '马文杰在后排收东西，收得很慢。' },
        { t: 'say', who: 'lin', name: '林知序', text: '十一月中，你有两天没留。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '……你记这个干什么。' },
        { t: 'say', who: 'lin', name: '林知序', text: '想问一下。' },
        { t: 'narr', text: '他把书包拉上，坐着没动。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '我爷爷住院，我去了两天。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那你跟老师说了？' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '说了。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '她说让我妈在群里说一声。' },
        { t: 'say', who: 'lin', name: '林知序', text: '然后呢。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '我妈在群里说了。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '然后全班都知道了。' },
        { t: 'narr', text: '他把椅子推进桌子底下。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '第三天我回来了。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '不是因为老师说什么。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '是因为我回来那天，前面那个女生回头问我「你爷爷好了吗」。' },
        { t: 'narr', text: '他背起书包。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '我不太想让全班知道我家的事。' },
        { t: 'say', who: 'ma', name: '马文杰', sprite: 'ma', text: '所以我就来了。' },
        { t: 'narr', text: '他走了。教室里只剩我和值日生。' },
        { t: 'narr', text: '我在纸上写了一行：' },
        { t: 'narr', text: '「请假需在班级群说明，说明内容全班可见。」' },
        { t: 'flag', key: 's3_asked_ma' }
      ]
    },
    {
      id: 's3_ask_sun',
      title: '问孙芃',
      tag: '人物',
      desc: '他上学期转过一次学，对这些事比我们敏感。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridorDusk', place: '教学楼一楼 · 楼梯口' },
        { t: 'show', id: 'sun', pos: 'center' },
        { t: 'narr', text: '孙芃在等雨停。' },
        { t: 'say', who: 'lin', name: '林知序', text: '问你个事。你们班第八节，从什么时候开始的。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '九月。' },
        { t: 'say', who: 'lin', name: '林知序', text: '九月几号。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '我记得是九月九号。' },
        { t: 'say', who: 'lin', name: '林知序', text: '你怎么记得这么准。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '因为我以前那个学校也有。' },
        { t: 'narr', text: '他蹲下来，看外面的水。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '我以前那个学校，叫「晚自习前辅导」。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '也是自愿的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那你转过来了？' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '转学不是因为那个。' },
        { t: 'narr', text: '他停了一下。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '是因为我妈跟学校吵了一架。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '她说「我儿子不参加」。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '学校说没问题。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '然后我在班里就没有人跟我说话了。' },
        { t: 'narr', text: '雨大了一点。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '没人欺负我。就是没有人跟我说话。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '三个月。' },
        { t: 'say', who: 'lin', name: '林知序', text: '……' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '所以你别问得太用力。' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '有些事，问的人比答的人危险。' },
        { t: 'narr', text: '他站起来，把帽子扣上，走进雨里。' },
        { t: 'narr', text: '走出七八米，他回头喊了一句：' },
        { t: 'say', who: 'sun', name: '孙芃', sprite: 'sun', text: '九月九号！我确定！' },
        { t: 'flag', key: 's3_asked_sun' }
      ]
    },
    {
      id: 's3_policy',
      title: '查政策原文',
      tag: '文书',
      desc: '「课后服务」这四个字，是有出处的。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
        { t: 'narr', text: '我在教育局的网站上找了很久。' },
        { t: 'narr', text: '找到一份《关于做好中小学生课后服务工作的指导意见》。' },
        { t: 'narr', text: '不长，六条。' },
        { t: 'narr', text: '第一条：充分发挥中小学校课后服务主渠道作用。' },
        { t: 'narr', text: '第二条：课后服务对象为义务教育阶段学生，坚持学生自愿参加。' },
        { t: 'narr', text: '第三条：课后服务内容主要是安排学生做作业、自主阅读、体育、艺术、科普活动，' },
        { t: 'narr', text: '以及娱乐游戏、拓展训练、开展社团及兴趣小组活动等。' },
        { t: 'narr', text: '「坚决防止将课后服务变相成为集体教学或补课。」' },
        { t: 'narr', text: '第四条：通过「政府购买服务」「财政补贴」「收取服务性收费」等方式筹措经费。' },
        { t: 'narr', text: '第五条：学校要将课后服务内容、时间、收费等信息主动公示。' },
        { t: 'narr', text: '第六条：加强安全管理。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '「坚决防止」这四个字，我看了很久。' },
        { t: 'narr', text: '文件里没有写「不得」，写的是「坚决防止」。' },
        { t: 'narr', text: '一个是禁止，一个是防范。' },
        { t: 'narr', text: '防范的意思，是知道会有人这么做。' },
        { t: 'narr', text: '我把这几条抄进备忘录，标了日期和文号。' },
        { t: 'narr', text: '抄完发现一件事：' },
        { t: 'narr', text: '这份文件是二〇一七年发的。' },
        { t: 'narr', text: '八年前就写过「自愿」「不集体补课」「公示」。' },
        { t: 'narr', text: '八年后，我在一间教室里坐了四十分钟，听了一节没写在课表上的新课。' },
        { t: 'mat', id: 'M064' },
        { t: 'flag', key: 's3_has_policy' }
      ]
    },
    {
      id: 's3_school',
      title: '在校内留一份书面',
      tag: '文书',
      desc: '不发给谁，就交上去。留一个收件的时间。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'commons', place: '行政楼二层 · 教务处门口' },
        { t: 'narr', text: '我写了一张纸，一页。' },
        { t: 'narr', text: '「关于课后服务时段的几点疑问」' },
        { t: 'narr', text: '一、课表上无第八节，实际每周二、四放学后另有四十分钟集体安排，请问该安排的性质与依据。' },
        { t: 'narr', text: '二、该时段讲授内容为课本新章节（二次函数第二课时，第 58 页），与《告家长书》所述「不讲授新课」不一致。' },
        { t: 'narr', text: '三、《告家长书》回执仅设「同意」一项，请说明不同意参加的办理方式。' },
        { t: 'narr', text: '四、请告知该时段的公示渠道。' },
        { t: 'narr', text: '末尾写了名字、班级、日期：十二月十六日。' },
        { t: 'narr', text: '我复印了一份，把原件交到教务处。' },
        { t: 'narr', text: '里面那个老师接过去，看了一眼，放在桌角。' },
        { t: 'narr', text: '「放这儿吧。」' },
        { t: 'say', who: 'lin', name: '林知序', text: '能不能给我一个收件时间。' },
        { t: 'narr', text: '他抬起头。' },
        { t: 'narr', text: '「什么？」' },
        { t: 'say', who: 'lin', name: '林知序', text: '收件时间。什么时候收到的。' },
        { t: 'narr', text: '他看了我一会儿，拿起笔，在纸的右上角写了一个时间。' },
        { t: 'narr', text: '「12.16 16:05」' },
        { t: 'narr', text: '没有签名，没有章。' },
        { t: 'narr', text: '但那是一个时间。' },
        { t: 'narr', text: '我把自己那份复印件折好，放进书包内层。' },
        { t: 'narr', text: '复印件右上角，我自己也写了同样的时间。' },
        { t: 'flag', key: 's3_school_record' },
        { t: 'mat', id: 'M061' }
      ]
    },
    {
      id: 's3_wu',
      title: '去后勤问课时',
      tag: '人物',
      desc: '四十分钟的课，算不算课时，账上应该有痕迹。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
        { t: 'show', id: 'wu', pos: 'center' },
        { t: 'narr', text: '吴建国在算一张表。' },
        { t: 'say', who: 'lin', name: '林知序', text: '吴主任，老师上第八节，算课时吗。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '第八节？' },
        { t: 'say', who: 'lin', name: '林知序', text: '课后服务那个。' },
        { t: 'narr', text: '他把眼镜往上推了推。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '那个不算课时。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那算什么。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '算服务。' },
        { t: 'narr', text: '他在桌上翻了一下，抽出一张表。' },
        { t: 'narr', text: '《课后服务教师值班表》。' },
        { t: 'narr', text: '一周两栏，每栏一个人名。' },
        { t: 'narr', text: '从九月到十二月，一共三十二栏。' },
        { t: 'narr', text: '我数了一下人名：数学组出现二十四次，语文组六次，英语组两次。' },
        { t: 'say', who: 'lin', name: '林知序', text: '为什么数学最多。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '数学课时紧。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '他们组自己排的。' },
        { t: 'say', who: 'lin', name: '林知序', text: '学校知道吗。' },
        { t: 'narr', text: '他把表收回去，放进抽屉。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '值班表在这儿，你说学校知不知道。' },
        { t: 'narr', text: '他继续算他的表，算盘珠子响了两声。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '小姑娘。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '这表是我排的。' },
        { t: 'say', who: 'wu', name: '吴建国', sprite: 'wu', text: '我排的时候，没人跟我说不行。' },
        { t: 'mat', id: 'M062' },
        { t: 'flag', key: 's3_asked_wu' }
      ]
    },
    {
      id: 's3_ask_luo',
      title: '问罗一舟',
      tag: '人物',
      desc: '他是班长。点名册在他手里。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 讲台' },
        { t: 'show', id: 'luo', pos: 'center' },
        { t: 'narr', text: '罗一舟在整理点名册。' },
        { t: 'say', who: 'lin', name: '林知序', text: '这册子谁给你的。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '陈老师。' },
        { t: 'say', who: 'lin', name: '林知序', text: '多久收一次。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '每周五交一次。' },
        { t: 'say', who: 'lin', name: '林知序', text: '交给谁。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '教务处。' },
        { t: 'narr', text: '他把册子合上。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '你别问了。' },
        { t: 'say', who: 'lin', name: '林知序', text: '为什么。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '因为问完，册子还是我交。' },
        { t: 'narr', text: '他顿了顿。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '我上学期当过一学期。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '有一次我写了一个「缺」，是请病假的。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '第二天陈老师问我，我说是病假。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '她说「那你写「假」」。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那你写了吗。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '写了。用涂改液改的。' },
        { t: 'narr', text: '他指了指册子某一页的边上，确实有一小块白色的涂改痕迹。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '她说这表是给上面看的。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '上面看「缺」，会觉得这个班有问题。' },
        { t: 'narr', text: '他把册子放进讲台抽屉。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '你问完了吗。' },
        { t: 'say', who: 'lin', name: '林知序', text: '问完了。' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '那我走了。' },
        { t: 'narr', text: '他走到门口，回头说了一句：' },
        { t: 'say', who: 'luo', name: '罗一舟', sprite: 'luo', text: '册子是我交的，可是名字不是我写的。' },
        { t: 'flag', key: 's3_asked_luo' }
      ]
    },
    {
      id: 's3_public',
      title: '在学生群说一句',
      tag: '外部',
      desc: '三十八个人的群，没有老师。说了会有人接。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
        { t: 'music', id: 'tense' },
        { t: 'narr', text: '我在「初三（2）班 无老师版」里打了一行字。' },
        { t: 'narr', text: '「今天第八节课，课表上没有，讲的是新课。」' },
        { t: 'narr', text: '光标在发送键上停了一会儿。' },
        { t: 'narr', text: '发出去之后，群里安静了大概二十秒。' },
        { t: 'narr', text: '然后第一条：「？」' },
        { t: 'narr', text: '第二条：「你说真的？」' },
        { t: 'narr', text: '第三条是一个表情包。' },
        { t: 'narr', text: '十分钟里，消息到了六十多条。' },
        { t: 'chatmsg', thread: 'students', from: '郑野', text: '我早就觉得不对了' },
        { t: 'chatmsg', thread: 'students', from: '许小满', text: '别在这说' },
        { t: 'chatmsg', thread: 'students', from: '王梓', text: '说了有什么用' },
        { t: 'chatmsg', thread: 'students', from: '郑野', text: '至少大家知道了' },
        { t: 'chatmsg', thread: 'students', from: '许小满', text: '然后呢' },
        { t: 'narr', text: '「然后呢」这三个字底下一片安静。' },
        { t: 'narr', text: '有人开始截图。' },
        { t: 'narr', text: '我看见其中一张截图，右上角有我的名字。' },
        { t: 'flag', key: 's3_public_claim' },
        { t: 'flag', key: 's3_channels', value: 1 }
      ]
    },
    {
      id: 's3_break',
      title: '歇一会儿',
      tag: '休息',
      desc: '想不清楚的时候，先坐一会儿。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'skyDusk', place: '教学楼天台' },
        { t: 'music', id: 'daydream' },
        { t: 'narr', text: '天台的门没锁。' },
        { t: 'narr', text: '我坐在水箱旁边，看楼下的操场。' },
        { t: 'narr', text: '跑道上有人在跑，一圈一圈，跑到弯道就慢一点。' },
        { t: 'narr', text: '天黑得很慢。' },
        { t: 'narr', text: '我把今天听到的每一句话，在脑子里排了一遍。' },
        { t: 'narr', text: '「课后服务是学校安排的。」' },
        { t: 'narr', text: '「学校没有第八节。」' },
        { t: 'narr', text: '「值班表是我排的，没人跟我说不行。」' },
        { t: 'narr', text: '「算我多上，不算你们的。」' },
        { t: 'narr', text: '「我妈会给我报班，报班要钱。」' },
        { t: 'narr', text: '每一句都是真的。' },
        { t: 'narr', text: '这些话拼在一起，就是一节课。' },
        { t: 'narr', text: '没有人在撒谎，所以也找不到可以指的那个人。' },
        { t: 'narr', text: '风把校服吹起来。' },
        { t: 'narr', text: '我坐着，什么也没想清楚。' },
        { t: 'stat', who: 'shen', pressure: -2 },
        { t: 'flag', key: 's3_rested' }
      ]
    }
  ],

  /* ================= 中段事件 ================= */
  hubEvents: [
    {
      id: 'notice',
      after: 4,
      script: [
        { t: 'bg', id: 'corridor', place: '教学楼三楼 · 走廊' },
        { t: 'music', id: 'tense' },
        { t: 'narr', text: '走廊上有人在贴东西。' },
        { t: 'narr', text: 'A3，彩印，两个人一起贴，一个扶，一个压。' },
        { t: 'narr', text: '贴完他们退后两步看了看，把右上角又按了一下。' },
        { t: 'narr', text: '那张表叫《课后服务安排表》。' },
        { t: 'narr', text: '上面有：服务时间（每周二、周四 16:40—17:20）、服务内容（作业辅导、答疑）、' },
        { t: 'narr', text: '负责教师（按周轮值）、监督电话。' },
        { t: 'narr', text: '右下角盖了教务处的红章。' },
        { t: 'narr', text: '我站在那儿，从头看到尾，看了三遍。' },
        { t: 'narr', text: '这张表上，没有一件事是假的。' },
        { t: 'narr', text: '时间是真的，内容——写在纸上是真的，监督电话是真的。' },
        { t: 'narr', text: '它缺的是另一件事：' },
        { t: 'narr', text: '它没有写从哪一天开始执行。' },
        { t: 'narr', text: '也没有写在这之前，这十六周是怎么做的。' },
        { t: 'narr', text: '我把这张表拍了下来。' },
        { t: 'narr', text: '拍照的时候，贴表的那个老师从我旁边过去。' },
        { t: 'narr', text: '「以后有意见，打上面那个电话。」他说。' },
        { t: 'narr', text: '「以前也可以打的。」我说。' },
        { t: 'narr', text: '他没有接这句，走了。' },
        { t: 'mat', id: 'M066' }
      ]
    }
  ],

  summary: {
    title: '支线 · 第八节课',
    subtitle: '一节课四十分钟，十六周，三十二次',
    quote: '「算我多上。不算你们的。」',
    known: [
      '课表上只有七节，每天实际作息比课表多出约八十分钟',
      '每周二、四第七节后另有四十分钟，讲的是课本新章节（第 58 页）',
      '《告家长书》写「自愿参加」，同时写「原则上全体学生留校」；回执只有一个「同意」',
      '家长群接龙四十一个人，无一人不接',
      '考勤册二十七次课，四十一个勾，没有一格是空的',
      '教务处的说法是：课表是国家课程，课后服务不是课程，所以学校没有第八节'
    ],
    unknown: [
      '这节课从哪一天开始，谁批的，有没有备案',
      '不参加的那三个人，后来为什么回来了',
      '值班表一直在后勤的抽屉里，为什么公示要等到被问起',
      '答复说「未讲授新课」的时候，那四页算不算新课'
    ]
  }
};
