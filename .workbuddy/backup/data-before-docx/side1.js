/* =========================================================
   支线 ·《一元口罩》
   ---------------------------------------------------------
   独立于主线的调查支线，从标题页「支线」入口进入。
   核心问题：一件只值一块钱的事，谁有责任把它做完？

   写作口径（v0.3.1 重写）：
   1. 只写看得见的东西：时间、地点、数量、动作、原话。
      不写"她其实在保护我"这类替角色下结论的句子。
   2. 不用"不是A，而是B""不是A，也不是B，而是C"这类否定排比。
      也不在每段末尾加一句格言。一件事说完就停在事情上。
   3. 校方没有坏人。吴建国不否认、不发火，他只是不知道"负责的人"是谁。
   4. 口罩不全是过期的。玩家要分清批次、分清收费与免费、分清"听说"与"拍到"。
   5. 五种结果由动作决定：分批次 / 问钱 / 校内留书面 / 走外部渠道 /
      有没有在核实前把话说满 / 答复说"都是免费的"时有没有把付款记录递上去。

   材料：M026–M034
   人物：吴建国（后勤主任）、周姨（小卖部）、傅医生（校医）
   时间：2025 年 11 月 12 日 · 周三（第十一周）
   ========================================================= */

import { hasMaterial } from '../core/state.js';

/* ---------------- 结果判定 ----------------
   优先级：隐藏 → 查明 → 部分查明 → 陷入争议 → 只有程序进展 */
export function decideSideResult(state) {
  const f = state.flags || {};
  const has = (id) => hasMaterial(state, id);

  // 底层证据：自己买的那只 + 两个批次的对照
  const base = has('M034') && has('M026');
  const splitBatch = f.s1_batch === 'split';        // 有没有把批次分开说
  const askedMoney = !!f.s1_asked_money;            // 有没有问过那一百四十七块钱
  const schoolRecord = !!f.s1_school_record;        // 校内有没有留下书面
  const anyChannel = (f.s1_channels || 0) >= 1;     // 有没有对外反映过
  const publicClaim = !!f.s1_public_claim;          // 有没有在核实前把话说满
  const refundFollow = !!f.s1_refund_follow;        // 答复说"都是免费的"之后有没有补付款记录

  if (base && splitBatch && askedMoney && schoolRecord && anyChannel && refundFollow && !publicClaim) return 'hidden';
  if (base && splitBatch && anyChannel) return 'clear';
  if (publicClaim && !splitBatch) return 'dispute';
  if (has('M034') && has('M028')) return 'partial';
  return 'procedural';
}

/* ---------------- 政务平台：这笔口罩反映的办理进度 ----------------
   编号与提交时间取自玩家真的提交过的那张表；没走过网上渠道时用兜底编号，
   页面照样成立（12345 电话那条路留下的是工单号，形状一样）。 */
export function maskProgress(state) {
  // 只认支线自己提交的那一张表：主线的反映编号不能拿来当口罩这笔的编号
  const gov = (state.gov && state.gov.kind === 'mask') ? state.gov : {};
  const no = gov.no || 'ZW2025111235074';
  const t0 = gov.time || '2025-11-12 21:52';
  return {
    no,
    subject: '反映明德中学保健室门口以一元提供超期应急口罩',
    unit: '市市场监督管理局 / 市教育局',
    nodes: [
      {
        title: '提交', time: t0, who: '本人 · 市政务服务平台', state: '已提交',
        opinion: '反映对象：明德中学（保健室门口自助售卖点）。已勾选真实性承诺。'
      },
      {
        title: '受理', time: '2025-11-13 09:12', who: '市政务服务热线', state: '已受理',
        opinion: '事项已受理。因同时涉及产品与收费，按职责分别转市场监督管理部门、市教育局办理。'
      },
      {
        title: '交办', time: '2025-11-13 15:40', who: '市市场监督管理局', state: '已交办',
        opinion: '转药品与医疗器械监管科核实，抄送市教育局。'
      },
      {
        title: '承办', time: '2025-11-18 10:05', who: '市市场监督管理局 · 药械科', state: '办理中',
        opinion: '已联系学校核对库存与进货票据，待学校提供书面材料。'
      },
      {
        title: '答复', time: '2025-12-01 16:20', who: '市市场监督管理局', state: '已办结',
        opinion: '办理结果已通过本页面答复，并同步发送短信提示。'
      }
    ],
    reply: [
      '同学您好！您反映的情况收悉，现将有关情况答复如下：',
      '一、经核查，明德中学保健室门口向学生提供的口罩中，确有部分批次标示有效期已届满。我局已责令学校立即停止发放，并对剩余库存全部封存。',
      '二、关于收费问题。经了解，本学期保健室提供给学生的口罩均系免费提供，由学生自愿取用，不存在销售行为。您提到的一元钱，学校表示系学生自发放入的互助款，与口罩无关。',
      '三、关于款项去向。学校表示该互助款由保健室登记后用于补充日常药品，具体金额与用途正在进一步核实。',
      '四、我局已要求学校规范应急物资管理，定期核对库存有效期，并将核查结果向家长和学生说明。',
      '感谢您对校园食品安全与价格管理工作的关心。'
    ],
    tail: '本答复由市市场监督管理局通过市政务服务平台作出，可凭事项编号查询。'
  };
}

/* 交给模型重写答复正文时用的材料要点。
   骨架（编号、节点、时间、结论口径）全部固定，只换措辞。 */
export const MASK_AI_BRIEF = {
  kind: 'mask',
  facts: {
    subject: '反映明德中学保健室门口以一元一只的价格向学生提供超期应急口罩',
    unit: '明德中学',
    points: [
      '校内以一元一只提供口罩，包装标示有效期至 2023 年 12 月，已过期近两年',
      '同一纸箱内混有 2021 年 12 月与 2022 年 1 月两个有效期的批次',
      '现场无价格公示、无产品信息，收款为个人收款码，钱放进一个铁皮盒',
      '校内书面反映后只收到「已收悉，正在核查」，没有落款与经办人',
      '学校公众号两年前曾发文称「定期检查库存有效期」'
    ],
    extra: '答复的结论口径必须是：过期属实并已封存；但收钱这件事被解释成「学生自发的互助款」而不是销售；款项用途「正在进一步核实」。不要出现处罚、追责、金额、人名。'
  }
};

/* 提交成功那一刻的进度页：只有三段，答复还没出来。
   玩家每提交一次都用这一份，编号由表单现场生成。 */
export const MASK_FORM_PROGRESS = (no, time) => ({
  no,
  unit: '市市场监督管理局',
  subject: '反映明德中学保健室门口以一元提供超期应急口罩',
  nodes: [
    { title: '提交', time, who: '本人 · 市政务服务平台', state: '已提交',
      opinion: '已提交，勾选真实性承诺。' },
    { title: '受理', time: '2025-11-13 09:12', who: '市政务服务热线', state: '已受理',
      opinion: '事项已受理，按职责分别转市场监督管理部门、市教育局办理。' },
    { title: '答复', time: '', who: '市市场监督管理局 · 药械科', state: '办理中', done: false,
      opinion: '正在办理，答复后将通过本页面或短信告知。' }
  ],
  reply: ['您的反映已受理，正在办理中。', '办理完成后，答复内容会出现在「进度查询详情」的节点意见里。']
});

export default {
  id: 'side1',
  title: '支线',
  name: '一元口罩',
  dayLabel: '第十一周 · 周三',
  music: 'calm2',
  // 支线比主线给得多：11 个行动里选 6 个，重开有变化
  apMax: 6,

  nodes: [
    /* ================= 一、早读前 ================= */
    { t: 'bg', id: 'corridorDawn', place: '教学楼一楼 · 早读前' },
    { t: 'music', id: 'calm2' },
    { t: 'narr', text: '十一月十二号，星期三。' },
    { t: 'narr', text: '早上七点二十，一楼走廊的窗户上全是水汽。' },
    { t: 'narr', text: '有人在上面写了字，又被擦掉，只剩一片白。' },
    { t: 'narr', text: '保健室门口摆着一张折叠桌。' },
    { t: 'narr', text: '桌上一个纸箱，箱口开着。箱边一个铁皮盒子，盖子上的图案磨掉了。' },
    { t: 'narr', text: '纸箱前面立着一张硬纸板，黑笔写的：口罩 一元。' },
    { t: 'narr', text: '旁边还有一行小字：自取，钱放盒里。' },
    { t: 'narr', text: '没有人看着这张桌子。' },

    { t: 'bg', id: 'classroom', place: '初三（2）班 · 早读' },
    { t: 'narr', text: '班里空了五张桌子。' },
    { t: 'narr', text: '班主任在门口点了一遍名字，把没来的人记在本子上。' },
    { t: 'narr', text: '「这两天降温，有不舒服的早说。」' },
    { t: 'narr', text: '她说完就走了。' },

    { t: 'show', id: 'shen' },
    { t: 'narr', text: '沈予安把椅子挪过来，手里捏着两个小塑料袋。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你买了没有。' },
    { t: 'say', who: 'lin', name: '林知序', text: '没有。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '我买了两个。' },
    { t: 'narr', text: '她放了一个在我桌上。' },
    { t: 'narr', text: '包装是那种很薄的膜，边上有一道压痕，捏起来沙沙响。' },
    { t: 'say', who: 'lin', name: '林知序', text: '多少钱。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '一块。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你先看背面。' },
    { t: 'narr', text: '她把窗子拉开一条缝，把包装举到光下面。' },
    { t: 'narr', text: '背面最下面一行小字，印得很浅。' },
    { t: 'narr', text: '生产日期：2021 年 12 月。' },
    { t: 'narr', text: '有效期至：2023 年 12 月。' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '今天是 2025 年 11 月 12 日。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你买的时候看了吗。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '没有。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '谁会看。' },
    { t: 'narr', text: '她把包装侧过来，指给我看折边。' },
    { t: 'narr', text: '折边上有一行烫红的压纹，字被压扁了。' },
    { t: 'narr', text: '「2022 新年快乐」。' },
    { t: 'say', who: 'lin', name: '林知序', text: '这是节庆包装。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '我知道。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '我们班还有三个人买了。' },

    { t: 'say', who: 'lin', name: '林知序', text: '先别在群里说。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '为什么。' },
    { t: 'say', who: 'lin', name: '林知序', text: '你只知道你手上这只。' },
    { t: 'say', who: 'lin', name: '林知序', text: '箱子里有多少只、几个批次，我们都不知道。' },
    { t: 'narr', text: '她看了我一会儿，把口罩收回口袋。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '那你去弄清楚。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你弄得清楚，我就跟着说。' },
    { t: 'hide', id: 'shen' },

    /* ================= 二、第二节课间：自己也买一只 ================= */
    { t: 'bg', id: 'hallwayEnd', place: '保健室门口 · 课间' },
    { t: 'narr', text: '第二节课下课，我下楼。' },
    { t: 'narr', text: '桌子前面围着六七个人。有人放下一个硬币就拿走一只。' },
    { t: 'narr', text: '铁皮盒里有几枚一块的，还有两个五角的。' },
    { t: 'narr', text: '没有人点，也没有人找零。' },
    { t: 'narr', text: '队伍散开的时候，我走过去。' },
    { t: 'narr', text: '我拿起最上面一只，翻过来，对着走廊的光。' },
    { t: 'narr', text: '2021 年 12 月。有效期至 2023 年 12 月。' },
    { t: 'narr', text: '我又拿起下面一只。' },
    { t: 'narr', text: '2022 年 1 月。有效期至 2024 年 1 月。' },
    { t: 'narr', text: '再往下两只，还是 2021 年 12 月。' },
    { t: 'narr', text: '我把钱投进铁皮盒，两枚硬币碰了一下。' },
    { t: 'narr', text: '拿了一只 2021 年 12 月的，装进外套口袋。' },

    { t: 'show', id: 'fu' },
    { t: 'narr', text: '保健室的门开了，傅医生拿着一沓表格出来。' },
    { t: 'narr', text: '白大褂袖口卷到手肘，手上还捏着笔。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '买口罩？' },
    { t: 'say', who: 'lin', name: '林知序', text: '嗯。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '钱放盒子里就行。' },
    { t: 'say', who: 'lin', name: '林知序', text: '傅医生，这箱子是学校放这儿的吗。' },
    { t: 'narr', text: '她把表格夹到胳膊底下。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '后勤拉来的。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '昨天下午推车过来的，说流感季，让学生自己拿。' },
    { t: 'say', who: 'lin', name: '林知序', text: '他们说要收钱吗。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '这个我不知道。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '盒子是他们放的。' },
    { t: 'narr', text: '她顿了一下。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '你要是问口罩的事，去后勤问。' },
    { t: 'say', who: 'fu', name: '傅医生', text: '我这儿只管登记学生发烧。' },
    { t: 'hide', id: 'fu' },
    { t: 'narr', text: '她进了保健室，门没关严，留了一条缝。' },
    { t: 'narr', text: '缝里能看见桌上摊着一本登记册，蓝色硬皮。' },
    { t: 'mat', id: 'M034' },
    { t: 'narr', text: '回到教室，我把那只口罩放进笔袋。' },
    { t: 'narr', text: '沈予安那一只，我夹在数学书里。' },
    { t: 'narr', text: '两只的日期不一样。' },

    /* ================= 三、午休：先跟谁说 ================= */
    { t: 'bg', id: 'classroom', place: '初三（2）班 · 午休' },
    { t: 'music', id: 'daily' },
    { t: 'narr', text: '中午教室里剩了七八个人。' },
    { t: 'narr', text: '有人趴在桌上睡，有人拿手机看视频，声音开得很小。' },
    { t: 'narr', text: '我把两只口罩摊在桌面上。' },
    { t: 'narr', text: '一只我买的，一只沈予安给的。两只都是一块钱。' },
    { t: 'narr', text: '要往下走，先得找个人把这件事说出来。' },

    {
      t: 'choice',
      prompt: '这件事，先跟谁说？',
      options: [
        { text: '去行政楼，找后勤吴主任', goto: 'p_wu', effects: [{ flag: 's1_first', value: 'wu' }] },
        { text: '找班主任陈老师', goto: 'p_chen', effects: [{ flag: 's1_first', value: 'chen' }] },
        { text: '什么也不说，先自己看清楚', goto: 'p_self', effects: [{ flag: 's1_first', value: 'self' }] }
      ]
    },

    /* ---- 路线 A：找后勤 ---- */
    { t: 'label', name: 'p_wu' },
    { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
    { t: 'music', id: 'office' },
    { t: 'narr', text: '后勤办公室在行政楼三层最里面。' },
    { t: 'narr', text: '门开着。里面靠墙堆着打印纸，纸箱上写着「A4 70g」。' },
    { t: 'narr', text: '窗台上排着六瓶洗手液，都是没拆封的。' },
    { t: 'show', id: 'wu' },
    { t: 'say', who: 'wu', name: '吴建国', text: '找谁。' },
    { t: 'say', who: 'lin', name: '林知序', text: '吴主任，我想问一下保健室门口那箱口罩。' },
    { t: 'narr', text: '他把手里的笔放下。' },
    { t: 'say', who: 'lin', name: '林知序', text: '这个有效期到 2023 年 12 月。' },
    { t: 'narr', text: '我把两只包装放在桌角上，日期朝上。' },
    { t: 'narr', text: '他看了一眼，没有拿起来。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '哪儿拿的。' },
    { t: 'say', who: 'lin', name: '林知序', text: '就楼下那个纸箱。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '哦，那批。' },
    { t: 'narr', text: '他把两只口罩挪开一点，腾出桌面，摊开一张采购单。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '三年前备的应急物资。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '那年流感的厉害，一次进了两千只。' },
    { t: 'say', who: 'lin', name: '林知序', text: '剩下的没清掉吗。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '清过一回过期的。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '这批漏在里屋货架最上面，昨天翻出来才看见。' },
    { t: 'say', who: 'lin', name: '林知序', text: '翻出来以后就摆到楼下了。' },
    { t: 'narr', text: '他没马上回答。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '流感季，学生要口罩。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '库里就这批现成的。' },
    { t: 'say', who: 'lin', name: '林知序', text: '这一块钱是谁定的。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '收个成本。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '免费发，学生不当回事，一天就抢光。' },
    { t: 'say', who: 'lin', name: '林知序', text: '那这个钱收到哪儿去。' },
    { t: 'narr', text: '他停了两秒。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '……这个我得问一下。' },
    { t: 'say', who: 'lin', name: '林知序', text: '那这一箱还有多少只。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '没数过。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '你先别在班里讲，我核实一下。' },
    { t: 'say', who: 'lin', name: '林知序', text: '核实完会告诉我吗。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '会。' },
    { t: 'narr', text: '他把采购单收起来，压回那摞纸底下。' },
    { t: 'mat', id: 'M027' },
    { t: 'narr', text: '当天下午，学校服务号推来一条消息。' },
    { t: 'narr', text: '「您反映的情况已收悉，相关情况正在核查。」' },
    { t: 'narr', text: '没有落款，没有经办人，没有可以回话的地方。' },
    { t: 'hide', id: 'wu' },
    { t: 'mat', id: 'M025' },
    { t: 'flag', key: 's1_school_record' },
    { t: 'flag', key: 's1_channels', value: 1 },
    { t: 'goto', label: 'hub_intro' },

    /* ---- 路线 B：找班主任 ---- */
    { t: 'label', name: 'p_chen' },
    { t: 'bg', id: 'corridor', place: '语文办公室门口 · 午休' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '办公室里三个人，两个在改作业，一个在吃盒饭。' },
    { t: 'show', id: 'chen' },
    { t: 'say', who: 'chen', name: '陈老师', text: '进来，把门带上。' },
    { t: 'narr', text: '她桌上摊着一摞作文本，红笔夹在食指和中指之间。' },
    { t: 'narr', text: '我把两只口罩放在作文本旁边。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '楼下买的。' },
    { t: 'say', who: 'lin', name: '林知序', text: '嗯。' },
    { t: 'narr', text: '她拿起来，走到窗边，对着光看包装背面。' },
    { t: 'narr', text: '看了很久，然后把两只并在一起比。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '日期不一样。' },
    { t: 'say', who: 'lin', name: '林知序', text: '一个 2021 年 12 月，一个 2022 年 1 月。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '都过了。' },
    { t: 'narr', text: '她把口罩放回桌上，坐下。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '你希望我做什么。' },
    { t: 'say', who: 'lin', name: '林知序', text: '我不知道谁能管这个。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '后勤。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '但这箱子摆出来，学校是知道的。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '我去问，比你去问快。' },
    { t: 'say', who: 'lin', name: '林知序', text: '他们会不会问是谁说的。' },
    { t: 'narr', text: '她把红笔放下。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '会。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '我就说是我看见的。' },
    { t: 'narr', text: '她说这句话的语气，和说「把窗户关上」一样。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '包装给我留一只。' },
    { t: 'say', who: 'lin', name: '林知序', text: '留哪只。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '你最想说的那只。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '剩下的你自己收好，别都给我。' },
    { t: 'narr', text: '我把 2021 年 12 月那只给她，另一只装回笔袋。' },
    { t: 'hide', id: 'chen' },

    { t: 'narr', text: '第二天中午，她在走廊上叫住我。' },
    { t: 'show', id: 'chen' },
    { t: 'say', who: 'chen', name: '陈老师', text: '后勤说在核对采购记录。' },
    { t: 'say', who: 'lin', name: '林知序', text: '核对什么。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '哪一年买的，买了多少，还剩多少。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '我说了不算，他们得翻单子。' },
    { t: 'say', who: 'lin', name: '林知序', text: '要多久。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '不知道。' },
    { t: 'narr', text: '她把一只空了的口罩包装递还给我。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '他们收走了我那只。' },
    { t: 'say', who: 'chen', name: '陈老师', text: '你手上还有两只，别弄丢。' },
    { t: 'stat', who: 'chen', trust: 6, pressure: 2 },
    { t: 'flag', key: 's1_chen_kept' },
    { t: 'hide', id: 'chen' },
    { t: 'narr', text: '下午第一节课前，服务号推来一条消息。' },
    { t: 'narr', text: '「您反映的情况已收悉，相关情况正在核查。」' },
    { t: 'mat', id: 'M025' },
    { t: 'flag', key: 's1_school_record' },
    { t: 'flag', key: 's1_channels', value: 1 },
    { t: 'goto', label: 'hub_intro' },

    /* ---- 路线 C：先不说 ---- */
    { t: 'label', name: 'p_self' },
    { t: 'bg', id: 'classroom', place: '初三（2）班 · 午休' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '我把两只口罩夹回数学书里，合上。' },
    { t: 'narr', text: '现在说出去，我只有一句话：我买的那只过期了。' },
    { t: 'narr', text: '这句话能引出三个问题，我一个都答不上来。' },
    { t: 'narr', text: '一箱里有多少只。有几个批次。收的钱去了哪儿。' },
    { t: 'show', id: 'shen' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你打算什么时候说。' },
    { t: 'say', who: 'lin', name: '林知序', text: '等我能说清楚的时候。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '那要是说不清楚呢。' },
    { t: 'say', who: 'lin', name: '林知序', text: '那就再查。' },
    { t: 'narr', text: '她把椅子转回去，没再问。' },
    { t: 'hide', id: 'shen' },
    { t: 'narr', text: '下午还有三节课。' },
    { t: 'narr', text: '课间我下楼看了一眼，纸箱下去了两指宽。' },
    { t: 'goto', label: 'hub_intro' },

    /* ================= 四、调查中枢 ================= */
    { t: 'label', name: 'hub_intro' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'classroomDusk', place: '初三（2）班 · 下午' },
    { t: 'music', id: 'calm2' },
    { t: 'narr', text: '下午两节课，一节数学一节英语。' },
    { t: 'narr', text: '黑板上的题我抄了，没算。' },
    { t: 'narr', text: '纸上列了三行字：一箱多少只。几个批次。钱去哪儿了。' },
    { t: 'narr', text: '三个问题，各找一个能问的人。' },
    { t: 'narr', text: '课间十分钟，午休四十分钟，放学之后到晚饭前一段时间。' },
    { t: 'narr', text: '今天能问几次，我心里有数。' },
    { t: 'hub' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'corridorDusk', place: '一楼走廊 · 放学前' },
    { t: 'music', id: 'sunset' },
    { t: 'narr', text: '放学铃响之前，我又下楼一次。' },
    { t: 'narr', text: '纸箱还在，浅了一截。铁皮盒里的硬币多了几枚。' },
    { t: 'narr', text: '我把知道的东西在脑子里排了一遍。' },

    {
      t: 'choice',
      prompt: '接下来这一步，走哪条路？',
      options: [
        { text: '写一份书面追问，一式两份，后勤一份我一份', goto: 'p_write' },
        { text: '先在校内问到答复为止，不往外走', goto: 'p_inside' },
        { text: '直接把材料递到外面去', goto: 'p_out' }
      ]
    },

    /* ---- 收束 A：书面追问 ---- */
    { t: 'label', name: 'p_write' },
    { t: 'bg', id: 'classroomNight', place: '初三（2）班 · 晚自习' },
    { t: 'music', id: 'room' },
    { t: 'narr', text: '晚自习第一节，我在草稿纸上写。' },
    { t: 'narr', text: '写了三遍，删到剩下四段。' },
    { t: 'narr', text: '第一段写事实：11 月 12 日，我在保健室门口以一元购买应急口罩一只，包装标示有效期至 2023 年 12 月。' },
    { t: 'narr', text: '第二段写另外几只：同箱还有 2022 年 1 月生产、有效期至 2024 年 1 月的批次。' },
    { t: 'narr', text: '第三段写问题，一共三行：' },
    { t: 'narr', text: '一、该批口罩的库存数量与来源。' },
    { t: 'narr', text: '二、已售出部分的处理方式。' },
    { t: 'narr', text: '三、销售款项的收取与去向。' },
    { t: 'narr', text: '第四段只有一句：以上情况希望书面答复。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '写完我抄了一遍。' },
    { t: 'narr', text: '两份，一份交后勤，一份自己留着。' },
    { t: 'narr', text: '第二天早读前，我把那份放在吴建国桌角，压在他笔筒下面。' },
    { t: 'narr', text: '他抬头看了一眼，没说话，把纸抽出来对折，放进抽屉。' },
    { t: 'mat', id: 'M032' },
    { t: 'flag', key: 's1_school_record' },
    { t: 'flag', key: 's1_asked_money' },
    { t: 'goto', label: 'verdict' },

    /* ---- 收束 B：只在校内 ---- */
    { t: 'label', name: 'p_inside' },
    { t: 'bg', id: 'corridorDusk', place: '行政楼三层 · 放学后' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '我又去了一趟后勤办公室。' },
    { t: 'narr', text: '吴建国在收拾桌面，把一摞单子往文件夹里塞。' },
    { t: 'say', who: 'lin', name: '林知序', text: '吴主任，核实得怎么样了。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '在核。' },
    { t: 'say', who: 'lin', name: '林知序', text: '核到哪一步了。' },
    { t: 'narr', text: '他把文件夹立起来在桌上磕了两下。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '单子找到了，数目对不上。' },
    { t: 'say', who: 'lin', name: '林知序', text: '对不上是什么意思。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '进的时候是两千，出库没记全。' },
    { t: 'say', who: 'lin', name: '林知序', text: '那卖出去多少。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '不知道。' },
    { t: 'narr', text: '他说这三个字的时候没有回避，也没有解释。' },
    { t: 'say', who: 'lin', name: '林知序', text: '那盒子里那些钱呢。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '一块一块的，谁去点。' },
    { t: 'narr', text: '他把文件夹放进柜子，锁上。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '明天箱子撤了。' },
    { t: 'say', who: 'lin', name: '林知序', text: '撤了以后呢。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '以后再说。' },
    { t: 'flag', key: 's1_school_record' },
    { t: 'goto', label: 'verdict' },

    /* ---- 收束 C：往外递 ---- */
    { t: 'label', name: 'p_out' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
    { t: 'music', id: 'office' },
    { t: 'narr', text: '九点半到家，我没在客厅停，直接进了房间。' },
    { t: 'narr', text: '在校内试过的那条路，到「已收悉，正在核查」就断了。' },
    { t: 'narr', text: '我打开电脑，把外面那条也填上。' },
    { t: 'narr', text: '同一件事，写第二遍的时候顺手多了。' },
    { t: 'narr', text: '哪些是看到的、哪些是听来的，第一次写的时候我还分得很细。' },
    { t: 'narr', text: '第二次，句子短了，事实反而更清楚。' },
    {
      t: 'govform',
      kind: 'mask',
      mat: 'M031',
      time: '2025-11-12 21:52',
      progress: MASK_FORM_PROGRESS
    },
    { t: 'narr', text: '提交之后跳出一个受理编号。' },
    { t: 'narr', text: '我把编号抄在纸上，贴在书桌边。' },
    { t: 'narr', text: '纸的右下角起了毛，是刚才撕胶带撕坏的。' },
    { t: 'flag', key: 's1_gov_submitted' },
    { t: 'flag', key: 's1_channels', value: 1 },
    { t: 'goto', label: 'verdict' },

    /* ================= 五、答复 =================
       走到这里，当天能做的都做完了。真正决定结果的最后一件事在十六天之后：
       答复说「都是免费的」，你手上那一页登记，递还是不递。 */
    { t: 'label', name: 'verdict' },
    { t: 'hide', all: true },
    { t: 'if', cond: (s) => !!(s.flags && s.flags.s1_gov_submitted), then: 'v_reply' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_reply' },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 十二月一日 晚' },
    { t: 'music', id: 'office' },
    { t: 'narr', text: '十二月一号，晚上八点，手机收到一条短信。' },
    { t: 'narr', text: '「您反映的事项已办结，请登录市政务服务平台查询答复。」' },
    { t: 'narr', text: '我打开那个页面。编号还是我抄在本子上的那串。' },
    { t: 'govprogress', data: maskProgress, mat: 'M035', ai: () => MASK_AI_BRIEF },
    { t: 'narr', text: '正文四段。我读了两遍。' },
    { t: 'narr', text: '第一段承认了。用了「确有部分批次」六个字。' },
    { t: 'narr', text: '第二段说，都是免费提供，不存在销售行为。' },
    { t: 'narr', text: '第三段说，那一块钱是学生自发放入的互助款，与口罩无关。' },
    { t: 'wait', ms: 320 },
    { t: 'narr', text: '互助款。' },
    { t: 'narr', text: '这个词我在学校里一次都没听人说过。' },
    { t: 'narr', text: '硬纸板上写的是「口罩 一元」。' },
    { t: 'narr', text: '铁皮盒盖上贴着一张打印出来的收款码。' },
    { t: 'if', cond: (s) => hasMaterial(s, 'M032'), then: 'v_follow' },
    { t: 'narr', text: '我盯着「互助款」这三个字，把页面关掉了。' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_follow' },
    { t: 'narr', text: '我把那页《临时收费登记》从文件夹里抽出来。' },
    { t: 'narr', text: '一行一行：日期、只数、金额。' },
    { t: 'narr', text: '三天，一百四十七只，二百八十四块。' },
    { t: 'narr', text: '最后一列是签字，有几个名字写得很用力，纸都凹下去了。' },
    {
      t: 'choice',
      prompt: '答复说都是免费的。这份登记，递不递？',
      options: [
        { text: '在答复下面补一份材料，把登记页和收款码一起传上去', goto: 'v_send' },
        { text: '算了。已经有一份答复了', goto: 'v_stop' }
      ]
    },

    { t: 'label', name: 'v_send' },
    { t: 'narr', text: '补交材料那一栏只让传五张图。' },
    { t: 'narr', text: '我传了四张：硬纸板、铁皮盒、收款码、登记页。' },
    { t: 'narr', text: '说明栏写了两行：' },
    { t: 'narr', text: '「一元的出处是这张硬纸板。互助款这三个字，此前没有人对我说过。」' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '十二月八号，学校在同一个页面下面补了一条说明。' },
    { t: 'narr', text: '「此前收取的一元/只费用，实为代收的耗材成本。现已停止收取，并将已收款项全额退还。」' },
    { t: 'mat', id: 'M036' },
    { t: 'flag', key: 's1_refund_follow' },
    { t: 'narr', text: '耗材成本。' },
    { t: 'narr', text: '四个字，把「互助款」换掉了。' },
    { t: 'narr', text: '十二月一号出现一个词，十二月八号出现另一个词。' },
    { t: 'narr', text: '中间隔着的那七天，是这一页纸。' },
    { t: 'note', text: '答复里的词可以被换掉，前提是你手上有能替换它的东西。' },
    { t: 'goto', label: 'v_branch' },

    { t: 'label', name: 'v_stop' },
    { t: 'flag', key: 's1_refund_giveup' },
    { t: 'narr', text: '我把登记页夹回文件夹，合上。' },
    { t: 'narr', text: '答复已经在那里了，每一个字都能查，也能被引用。' },
    { t: 'narr', text: '至于那一块钱究竟是什么，这件事就停在这里。' },

    { t: 'label', name: 'v_branch' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'streetDusk', place: '回家的路 · 傍晚' },
    { t: 'music', id: 'rain' },
    // outcomes 显式声明五种结果，校验脚本据此核对 r_* 标签是否齐全
    { t: 'branch', decide: decideSideResult, prefix: 'r_', outcomes: ['hidden', 'clear', 'partial', 'procedural', 'dispute'] },

    /* ---- 隐藏结果：一元钱 ---- */
    { t: 'label', name: 'r_hidden' },
    { t: 'ending', id: 'side_coin' },
    { t: 'narr', text: '箱子在第二天上午撤了。' },
    { t: 'narr', text: '撤的时候没有通知，很多人是走到楼下才发现的。' },
    { t: 'narr', text: '那张硬纸板被折起来，靠在保健室门口的墙边。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '一周之后，年级组发了一张说明。' },
    { t: 'narr', text: '「经核查，11 月 12 日起在校内发放的应急口罩中，部分批次已超过标示有效期，' },
    { t: 'narr', text: '现已停止发放并全部封存处理。已收取的款项将予退还。」' },
    { t: 'narr', text: '下面一行：' },
    { t: 'narr', text: '「退款以班级为单位统一办理，不需学生说明购买情况。」' },
    { t: 'mat', id: 'M033' },
    { t: 'narr', text: '不需要说明购买情况。' },
    { t: 'narr', text: '这句话是给我们留了面子，也是给学校留了面子。' },

    { t: 'bg', id: 'classroom', place: '初三（2）班 · 周五中午' },
    { t: 'music', id: 'calm' },
    { t: 'narr', text: '周五中午，年级组的老师搬了一张桌子到走廊上。' },
    { t: 'narr', text: '桌上摊着一张打印的表，三列：班级、姓名、金额。' },
    { t: 'narr', text: '一共一百四十七行。' },
    { t: 'narr', text: '每个班派一个代表去领，领回来在班里发。' },
    { t: 'narr', text: '我们班是八个。八块钱。' },
    { t: 'narr', text: '沈予安把她那份推给我。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你替我领的，你留着吧。' },
    { t: 'say', who: 'lin', name: '林知序', text: '我自己有一块。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '那就当跑腿费。' },
    { t: 'narr', text: '她把硬币按在桌面上推过来，硬币转了两圈才停。' },
    { t: 'narr', text: '我把两枚都收进笔袋。' },

    { t: 'bg', id: 'shopNight', place: '小卖部 · 晚上放学' },
    { t: 'music', id: 'night_street' },
    { t: 'narr', text: '晚上路过小卖部，我往里看了一眼。' },
    { t: 'narr', text: '柜台上多了一个纸盒，盒子上贴着手写的纸条：口罩 一元。' },
    { t: 'show', id: 'zyi' },
    { t: 'say', who: 'zyi', name: '周姨', text: '看什么。' },
    { t: 'say', who: 'lin', name: '林知序', text: '这个也是学校的吗。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '我自己的货。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '正规渠道进的，你要看日期我撕一包给你看。' },
    { t: 'narr', text: '她真的撕开一包，把包装翻到背面，对着灯举起来。' },
    { t: 'narr', text: '2025 年 3 月。有效期至 2027 年 2 月。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '一块钱我挣两毛。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '学校那个我早就说过，摆在我门口我不卖。' },
    { t: 'say', who: 'lin', name: '林知序', text: '您说过。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '说过有什么用。' },
    { t: 'narr', text: '她把撕开的那包推过来。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '这个送你。' },
    { t: 'hide', id: 'zyi' },
    { t: 'narr', text: '我拿着那包口罩走出校门。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 查明 ---- */
    { t: 'label', name: 'r_clear' },
    { t: 'ending', id: 'side_clear' },
    { t: 'narr', text: '外面那边回得比学校快。' },
    { t: 'narr', text: '受理之后第九天，来了一次现场核查。' },
    { t: 'narr', text: '两个人，一个穿制服，一个拿相机。在保健室门口站了二十分钟。' },
    { t: 'narr', text: '结论只有一句：库存口罩超过标示有效期，责令停止使用、依规处理。' },
    { t: 'narr', text: '学校接着发了一条说明，和外面那句几乎一样。' },
    { t: 'wait', ms: 280 },
    { t: 'bg', id: 'hallwayEnd', place: '保健室门口 · 三天后' },
    { t: 'narr', text: '三天后，桌子没了。' },
    { t: 'narr', text: '地面上留着一圈胶带撕过的印子，比周围的灰浅一点。' },
    { t: 'narr', text: '纸箱搬到里屋，两个封好的箱子，箱子上写着「待处理」。' },
    { t: 'narr', text: '我在回收区碰到吴建国，他正在把箱子往推车上搬。' },
    { t: 'show', id: 'wu' },
    { t: 'say', who: 'lin', name: '林知序', text: '这是那批吗。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '是。' },
    { t: 'say', who: 'lin', name: '林知序', text: '里面有多少。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '没数。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '反正都在这儿了。' },
    { t: 'narr', text: '他把最上面那个箱子往上提了提。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '以后每学期查一次有效期。' },
    { t: 'say', who: 'lin', name: '林知序', text: '谁查。' },
    { t: 'say', who: 'wu', name: '吴建国', text: '我查。' },
    { t: 'narr', text: '他说完就推着车走了。' },
    { t: 'hide', id: 'wu' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '那句话没有人要求他说。' },
    { t: 'narr', text: '我记在了本子上，日期、时间、原话。' },
    { t: 'narr', text: '他做到做不到，我不知道。' },
    { t: 'narr', text: '本子上有这么一行，明年这时候我可以拿出来问。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 部分查明 ---- */
    { t: 'label', name: 'r_partial' },
    { t: 'ending', id: 'side_partial' },
    { t: 'narr', text: '箱子撤了，说明没发。' },
    { t: 'narr', text: '那一块钱也没退。' },
    { t: 'narr', text: '过了两个星期，我听说学校处理了一批东西，具体是什么，说法有三种。' },
    { t: 'narr', text: '有人说是口罩，有人说是库房里的消毒液，还有人说是过期的洗手液。' },
    { t: 'narr', text: '每一种说法都带着「听说」。' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '我手上的东西只有两样：一只过期的口罩，一张箱子里拍的照片。' },
    { t: 'narr', text: '照片上有日期，但没有编号，也没有能对上账的数目。' },
    { t: 'narr', text: '拿着这两样去问，最多换来一句「正在核查」。' },
    { t: 'wait', ms: 260 },
    { t: 'bg', id: 'shop', place: '小卖部 · 一周后' },
    { t: 'narr', text: '一周后，小卖部柜台上摆出了自己进的口罩。' },
    { t: 'narr', text: '一块钱一包，一包十只。' },
    { t: 'narr', text: '周姨把包装翻给我看：2025 年 3 月，有效期至 2027 年 2 月。' },
    { t: 'show', id: 'zyi' },
    { t: 'say', who: 'zyi', name: '周姨', text: '早该这么卖。' },
    { t: 'say', who: 'lin', name: '林知序', text: '学校那个撤了。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '撤了。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '退钱了吗。' },
    { t: 'say', who: 'lin', name: '林知序', text: '没有。' },
    { t: 'narr', text: '她把手在围裙上擦了两下。' },
    { t: 'say', who: 'zyi', name: '周姨', text: '那一箱子钱，够买多少新口罩。' },
    { t: 'hide', id: 'zyi' },
    { t: 'narr', text: '我没接这句话。' },
    { t: 'narr', text: '我买了两包新的，五块钱。' },
    { t: 'narr', text: '旧的收在抽屉里，跟那两只过期的放在一起。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 只有程序进展 ---- */
    { t: 'label', name: 'r_procedural' },
    { t: 'ending', id: 'side_procedural' },
    { t: 'narr', text: '我手上有三样纸。' },
    { t: 'narr', text: '一条服务号的消息，一份我写的追问，一个受理编号。' },
    { t: 'narr', text: '三样都在，三样都没说到那箱口罩。' },
    { t: 'wait', ms: 280 },
    { t: 'narr', text: '箱子在三天后撤了。' },
    { t: 'narr', text: '是有人说了什么，还是流感季过去了，分不出来。' },
    { t: 'narr', text: '我去问过一次，得到的回答是「已经处理了」。' },
    { t: 'narr', text: '处理了什么，处理到哪一步，没有人往下说。' },
    { t: 'wait', ms: 260 },
    { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
    { t: 'narr', text: '晚上我把三样纸按时间排好，夹进一个透明文件袋。' },
    { t: 'narr', text: '袋子上用马克笔写了日期：11 月 12 日 — 11 月 20 日。' },
    { t: 'narr', text: '写完我把袋子放进抽屉最里面。' },
    { t: 'narr', text: '这些纸不能证明口罩有问题。' },
    { t: 'narr', text: '它们能证明这段时间里，有人问过，也有一个编号记着这件事。' },
    { t: 'narr', text: '以后再有人问起，至少不用从零开始。' },
    { t: 'goto', label: 'epilogue' },

    /* ---- 陷入争议 ---- */
    { t: 'label', name: 'r_dispute' },
    { t: 'ending', id: 'side_dispute' },
    { t: 'narr', text: '那天晚上我发了一条朋友圈，配两张照片。' },
    { t: 'narr', text: '正文写：学校卖的口罩过期两年。' },
    { t: 'narr', text: '十分钟，四十多个赞。' },
    { t: 'narr', text: '二十分钟，有人转到了家长群。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '第二天早上，第一个来找我的人不是老师，是隔壁班的男生。' },
    { t: 'narr', text: '他说他买的那只日期是 2022 年 1 月，还没过期。' },
    { t: 'narr', text: '「你凭什么说过期两年。」' },
    { t: 'narr', text: '我说我买的那只是 2021 年 12 月的。' },
    { t: 'narr', text: '他说那是你那只会过期。' },
    { t: 'narr', text: '这句话我接不住。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '一整天，班里来了四个人跟我核对日期。' },
    { t: 'narr', text: '两个和我一样，两个是 2022 年 1 月。' },
    { t: 'narr', text: '有人把聊天记录截了图，发到年级群，标题是「到底谁在造谣」。' },
    { t: 'narr', text: '那天下午，箱子照常摆在那儿。' },
    { t: 'narr', text: '到晚上才撤。' },
    { t: 'wait', ms: 280 },
    { t: 'bg', id: 'corridor', place: '走廊 · 三天后' },
    { t: 'narr', text: '三天后，班主任在班会上说了三分钟。' },
    { t: 'narr', text: '她说学校已经核实，口罩的批次情况不同，个别批次存在标示问题。' },
    { t: 'narr', text: '她说，转发消息之前先确认，这也是一种能力。' },
    { t: 'narr', text: '她没有点名字。' },
    { t: 'narr', text: '全班都知道说的是谁。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '下课以后，沈予安走过来，把我的水杯挪正。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '你那两只，日期记错了吗。' },
    { t: 'say', who: 'lin', name: '林知序', text: '没有。' },
    { t: 'say', who: 'shen', name: '沈予安', text: '那你错在哪儿。' },
    { t: 'say', who: 'lin', name: '林知序', text: '我只有两只，写成了全校。' },
    { t: 'narr', text: '她点了点头，回座位去了。' },
    { t: 'narr', text: '那句话她对我说过一次，我没有听。' },
    { t: 'goto', label: 'epilogue' },

    /* ================= 尾声 ================= */
    { t: 'label', name: 'epilogue' },
    { t: 'hide', all: true },
    { t: 'bg', id: 'streetNight', place: '回家的路' },
    { t: 'music', id: 'silent' },
    { t: 'narr', text: '十二月，流感过去了。' },
    { t: 'narr', text: '一楼走廊的窗户不再起雾，那张折叠桌也没有再摆出来。' },
    { t: 'narr', text: '这件事在班里被提起过两次。' },
    { t: 'narr', text: '一次是有人说「那时候一块钱还挺值」，一次是有人问「退了没有」。' },
    { t: 'wait', ms: 300 },
    { t: 'narr', text: '我抽屉里有两只过期的口罩，一个透明文件袋，两枚一块钱硬币。' },
    { t: 'narr', text: '硬币没有花。' },
    { t: 'narr', text: '不是因为要留纪念，是因为每次看见它们，我会想起三个可以拿去问任何东西的问题：' },
    { t: 'narr', text: '东西是从哪儿来的。' },
    { t: 'narr', text: '钱收到了哪儿去。' },
    { t: 'narr', text: '谁负责把它做完。' },
    { t: 'wait', ms: 260 },
    { t: 'narr', text: '这三个问题，问一张收费单、一次报名、一句「已收悉」，都成立。' },
    { t: 'narr', text: '问的时候，手上最好有东西。' },
    { t: 'narr', text: '一只包装，一张截图，一行日期。' },
    { t: 'narr', text: '——支线《一元口罩》 完' },
    { t: 'end' }
  ],

  /* ================= 调查行动 ================= */
  hubActions: [
    {
      id: 's1_count',
      title: '数一遍纸箱',
      tag: '现场',
      desc: '课间十分钟，把箱子里的口罩一只一只翻过来看日期。',
      // 箱子被收走之后就数不了了，这一项会从中枢里消失
      cond: (s) => !(s.flags && s.flags.s1_box_gone),
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'hallwayEnd', place: '保健室门口 · 课间' },
        { t: 'narr', text: '课间我蹲在桌子边上，一只一只往外拿。' },
        { t: 'narr', text: '拿出来的放在左手边，看完的放回箱子右边。' },
        { t: 'narr', text: '第一个课间数了十九只，第二个课间数完剩下的。' },
        { t: 'narr', text: '一共四十一只。' },
        { t: 'narr', text: '其中 2021 年 12 月的三十二只，2022 年 1 月的九只。' },
        { t: 'narr', text: '两个日期，混着放。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '我把数错的次数写了三遍才对齐。' },
        { t: 'narr', text: '数到第三遍的时候，有人过来买。' },
        { t: 'narr', text: '我把手抽回来，装作在系鞋带。' },
        { t: 'narr', text: '她拿了一只就走，钱扔进盒子。' },
        { t: 'say', who: 'lin', name: '林知序', text: '等一下——' },
        { t: 'narr', text: '她已经拐进楼梯口了。' },
        { t: 'narr', text: '四十只。我数了两遍，第二遍比第一遍少一只。' },
        { t: 'flag', key: 's1_counted' },
        { t: 'narr', text: '我在纸上写：四十一只（11 月 12 日 10:05），三十二只 2021-12，九只 2022-01。' }
      ]
    },

    {
      id: 's1_batch',
      title: '对批号',
      tag: '文书',
      desc: '把三只口罩的封口放在一起，看批号能不能对上。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroom', place: '初三（2）班 · 午休' },
        { t: 'narr', text: '中午我把三只口罩摊在桌上。' },
        { t: 'narr', text: '我买的、沈予安给的、许小满下课塞给我的那一只。' },
        { t: 'narr', text: '批号印在封口压痕旁边，小得要凑近。' },
        { t: 'narr', text: '我买的：0917。沈予安那只：0918。许小满那只：1102。' },
        { t: 'narr', text: '三个批号。' },
        { t: 'narr', text: '0917 和 0918 是 2021 年 12 月产，1102 是 2022 年 1 月产。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '许小满那只的背面有一处印刷发虚，第一位数字糊成一片。' },
        { t: 'narr', text: '我用指甲刮了一下，油墨掉了一点。' },
        { t: 'narr', text: '这一处以后会是麻烦。' },
        { t: 'narr', text: '人家问「你怎么确定这是正规包装」，我没有话回。' },
        { t: 'narr', text: '我把三只分别装进三个自封袋，写上批号和日期。' },
        { t: 'mat', id: 'M026' },
        { t: 'flag', key: 's1_batch', value: 'split' },
        { t: 'note', text: '能说清的是「我见到的三个批号」，不是「全校的口罩」。' }
      ]
    },

    {
      id: 's1_nurse',
      title: '问傅医生登记本的事',
      tag: '人物',
      desc: '保健室里那本蓝皮登记册，记不记口罩的进出。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'infirmary', place: '保健室' },
        { t: 'narr', text: '午休的时候，保健室里有两个人，一个量体温，一个躺着。' },
        { t: 'show', id: 'fu' },
        { t: 'say', who: 'lin', name: '林知序', text: '傅医生，我想问一下，口罩入库有没有登记。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '保健室的登记只记药品。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '口罩是后勤的物资。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那这本书里有没有这一项。' },
        { t: 'narr', text: '她把蓝皮本子翻到中间，转过来给我看。' },
        { t: 'narr', text: '一行一行的日期、姓名、症状、处理。' },
        { t: 'narr', text: '没有口罩。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '十一月十二号，发烧两个人，一个送回去了。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '你要看就看完，别拍照。' },
        { t: 'narr', text: '我翻了两页。' },
        { t: 'narr', text: '十一月一号到十二号，发烧十一个人。' },
        { t: 'narr', text: '这个数字比我想的多。' },
        { t: 'say', who: 'lin', name: '林知序', text: '最近发烧的人多吗。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '比上月多。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '每年这时候都这样。' },
        { t: 'narr', text: '她把本子拿回去，合上。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '口罩的事你去问后勤。' },
        { t: 'say', who: 'fu', name: '傅医生', text: '我这儿只能告诉你谁来了、谁烧了。' },
        { t: 'hide', id: 'fu' },
        { t: 'mat', id: 'M028' },
        { t: 'narr', text: '出门的时候我回头看了一眼那本蓝皮册子。' },
        { t: 'narr', text: '它记的是人，不是物。' }
      ]
    },

    {
      id: 's1_wu',
      title: '再去后勤，问采购',
      tag: '人物',
      desc: '那两千只是哪一年进的，为什么还剩四十只。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
        { t: 'show', id: 'wu' },
        { t: 'narr', text: '这次他在整理柜子，地上摊了三张旧单子。' },
        { t: 'say', who: 'lin', name: '林知序', text: '吴主任，那两千只是哪一年进的。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '二一年底。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '那年冬天发烧的特别多，局里让各校备物资。' },
        { t: 'say', who: 'lin', name: '林知序', text: '一次进两千。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '一次进两千，单价八毛。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '那时候抢货，晚了就没有。' },
        { t: 'say', who: 'lin', name: '林知序', text: '后来用掉多少。' },
        { t: 'narr', text: '他从地上拿起一张单子，看了一眼，又放下。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '学生自己带的多了，就没怎么发。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '放到货架最上面，一放就是三年。' },
        { t: 'say', who: 'lin', name: '林知序', text: '中间没查过吗。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '查过一次，清掉两箱。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '这箱压在后面，没看见。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '他说「没看见」的时候，语气平得像在说库存数。' },
        { t: 'say', who: 'lin', name: '林知序', text: '现在还剩多少。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '不知道。卖一天了，得数。' },
        { t: 'say', who: 'lin', name: '林知序', text: '我数过。四十只。' },
        { t: 'narr', text: '他抬头看了我一眼。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '你数它干什么。' },
        { t: 'say', who: 'lin', name: '林知序', text: '我想知道卖了多少。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '……' },
        { t: 'say', who: 'wu', name: '吴建国', text: '明天撤。' },
        { t: 'hide', id: 'wu' },
        { t: 'mat', id: 'M027' },
        { t: 'narr', text: '出门的时候，我听见他在里面打电话。' },
        { t: 'narr', text: '「……对，那个口罩，先撤了吧。」' }
      ]
    },

    {
      id: 's1_money',
      title: '跟着铁皮盒走一趟',
      tag: '现场',
      desc: '放学时看看谁来收这个盒子，收走之后拿到哪里去。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'corridorDusk', place: '一楼走廊 · 放学后' },
        { t: 'narr', text: '放学后我在楼梯口等着。' },
        { t: 'narr', text: '五点五十，一个穿蓝工作服的人过来，把铁皮盒盖扣上，端走了。' },
        { t: 'narr', text: '我隔着二十米跟着。' },
        { t: 'narr', text: '他进了行政楼，上三楼，进了后勤办公室旁边的小屋。' },
        { t: 'narr', text: '门没关。他坐下，把盒子里的钱倒在桌上。' },
        { t: 'narr', text: '硬币、纸币，混在一起。' },
        { t: 'narr', text: '他十个一摞，摞了十几摞，然后拿笔在本子上写了一个数。' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '我站在门外，看见那个本子是横格的。' },
        { t: 'narr', text: '抬头印着「临时收费登记」。' },
        { t: 'say', who: 'lin', name: '林知序', text: '打扰一下。' },
        { t: 'narr', text: '他抬起头。' },
        { t: 'say', who: 'lin', name: '林知序', text: '这个钱登记完交到哪里。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '……' },
        { t: 'narr', text: '吴建国从里屋出来，站在门口。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '你还没走。' },
        { t: 'say', who: 'lin', name: '林知序', text: '我想知道这个钱最后去哪儿。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '入账。' },
        { t: 'say', who: 'lin', name: '林知序', text: '入哪个账。' },
        { t: 'narr', text: '他沉默了几秒。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '这个我得问财务。' },
        { t: 'say', who: 'lin', name: '林知序', text: '那我明天来问。' },
        { t: 'say', who: 'wu', name: '吴建国', text: '……' },
        { t: 'say', who: 'wu', name: '吴建国', text: '你先回家。' },
        { t: 'flag', key: 's1_asked_money' },
        { t: 'narr', text: '下楼的时候，我手心全是汗。' },
        { t: 'narr', text: '本子上那个数字，我记住了：一百四十七。' }
      ]
    },

    {
      id: 's1_zhouyi',
      title: '问小卖部周姨',
      tag: '人物',
      desc: '她那儿也卖口罩，也许知道学校这批是哪来的。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'shop', place: '小卖部' },
        { t: 'show', id: 'zyi' },
        { t: 'narr', text: '小卖部里开着电暖器，柜台上一层灰。' },
        { t: 'say', who: 'lin', name: '林知序', text: '周姨，学校门口那个口罩是您帮着卖的？' },
        { t: 'say', who: 'zyi', name: '周姨', text: '没有。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '上个月他们来找过我，说放我这儿代卖。' },
        { t: 'say', who: 'lin', name: '林知序', text: '您没答应。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '我看了一眼日期。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '我说这货我卖不了，出了问题算谁的。' },
        { t: 'narr', text: '她把电暖器往我这边转了半圈。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '后来他们自己摆了张桌子。' },
        { t: 'say', who: 'lin', name: '林知序', text: '您跟他们说过这个日期吗。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '说了。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '他说应急物资，先发着。' },
        { t: 'wait', ms: 260 },
        { t: 'say', who: 'lin', name: '林知序', text: '周姨，您这儿现在有口罩吗。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '有，我自己的。' },
        { t: 'narr', text: '她从柜子底下抽出一包，撕开，把包装翻过来对着灯。' },
        { t: 'narr', text: '2025 年 3 月。有效期至 2027 年 2 月。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '一块钱一包，一包十只。' },
        { t: 'say', who: 'lin', name: '林知序', text: '一块钱一包。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '嗯。' },
        { t: 'narr', text: '我在柜台前站了两秒。' },
        { t: 'say', who: 'lin', name: '林知序', text: '学校那只是一块钱一只。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '我知道。' },
        { t: 'say', who: 'zyi', name: '周姨', text: '所以我没接那单。' },
        { t: 'hide', id: 'zyi' },
        { t: 'mat', id: 'M030' },
        { t: 'note', text: '周姨的话是陈述，不是证据。要用得上，得让她愿意署名。' }
      ]
    },

    {
      id: 's1_gzh',
      title: '翻学校公众号的历史消息',
      tag: '材料',
      desc: '去年十月那条推送里，提过应急物资储备。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroom', place: '初三（2）班 · 午休' },
        { t: 'narr', text: '公众号的历史消息能翻到三年前。' },
        { t: 'narr', text: '我一条一条往回拉，拉到二〇二二年十月。' },
        { t: 'narr', text: '有一条：《我校完成秋冬季应急物资储备》。' },
        { t: 'narr', text: '配图是仓库，货架上有箱子，箱子外面贴着标签。' },
        { t: 'narr', text: '正文写着：本次储备包含医用口罩、消毒液、免洗洗手液等，可满足全校师生两周用量。' },
        { t: 'narr', text: '最后一句：「所有物资将定期检查有效期，确保关键时刻用得上。」' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '我把这一句截了图。' },
        { t: 'narr', text: '定期检查有效期。' },
        { t: 'narr', text: '这句话是二〇二二年十月写的。' },
        { t: 'narr', text: '那批口罩的有效期，就是二〇二三年十二月。' },
        { t: 'mat', id: 'M029' },
        { t: 'narr', text: '截图存进相册，往前翻两张，是我今天早上拍的纸箱。' },
        { t: 'narr', text: '两张放在一起，中间隔了三年。' }
      ]
    },

    {
      id: 's1_ask',
      title: '问买了的人',
      tag: '人物',
      desc: '班里还有三个人买了。他们手上那只是什么日期。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroom', place: '初三（2）班 · 课间' },
        { t: 'narr', text: '我在班里问了三个买过的人。' },
        { t: 'show', id: 'xu' },
        { t: 'say', who: 'xu', name: '许小满', text: '我买了三个。' },
        { t: 'say', who: 'xu', name: '许小满', text: '两个给我妈了，一个在书包里。' },
        { t: 'narr', text: '她把书包翻了个底朝天，从一本练习册里抖出来一只。' },
        { t: 'narr', text: '背面：2022 年 1 月。有效期至 2024 年 1 月。' },
        { t: 'say', who: 'lin', name: '林知序', text: '这只先借我两天。' },
        { t: 'say', who: 'xu', name: '许小满', text: '你要它干什么。' },
        { t: 'say', who: 'lin', name: '林知序', text: '对一下批号。' },
        { t: 'say', who: 'xu', name: '许小满', text: '……哦。' },
        { t: 'narr', text: '她把口罩推过来，又收回去。' },
        { t: 'say', who: 'xu', name: '许小满', text: '你别弄丢了。' },
        { t: 'say', who: 'xu', name: '许小满', text: '我发烧那天戴的就是这个。' },
        { t: 'hide', id: 'xu' },
        { t: 'wait', ms: 260 },
        { t: 'show', id: 'zheng' },
        { t: 'say', who: 'zheng', name: '郑野', text: '我没买。' },
        { t: 'say', who: 'zheng', name: '郑野', text: '我家有。' },
        { t: 'say', who: 'lin', name: '林知序', text: '你妈在群里说过。' },
        { t: 'say', who: 'zheng', name: '郑野', text: '说过什么。' },
        { t: 'say', who: 'lin', name: '林知序', text: '说学校什么时候开始卖东西了。' },
        { t: 'narr', text: '他笑了一下。' },
        { t: 'say', who: 'zheng', name: '郑野', text: '我妈什么都问。' },
        { t: 'say', who: 'zheng', name: '郑野', text: '不过她问了也没用。' },
        { t: 'hide', id: 'zheng' },
        { t: 'narr', text: '三个买过的人，日期两个是 2022 年 1 月，一个是 2021 年 12 月。' },
        { t: 'narr', text: '加上我的，四个。' },
        { t: 'narr', text: '还是两个批次。' }
      ]
    },

    {
      id: 's1_ledger',
      title: '看那本《临时收费登记》',
      tag: '文书',
      desc: '一百四十七这个数字，得有个出处。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'clubroom', place: '行政楼三层 · 后勤办公室' },
        { t: 'narr', text: '第二天中午我又去了。' },
        { t: 'narr', text: '吴建国不在，门开着，桌上摊着那个横格本。' },
        { t: 'narr', text: '我站在门口叫了一声，没人应。' },
        { t: 'narr', text: '本子翻开的那页，最后一行是昨天：' },
        { t: 'narr', text: '「11.13 应急口罩 147 元 吴」。' },
        { t: 'narr', text: '前面一行是 11.12，写着 96 元。' },
        { t: 'narr', text: '再往前，11.11，写着 41 元。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '41、96、147。' },
        { t: 'narr', text: '加起来二百八十四。' },
        { t: 'narr', text: '一百四十七是最后一天的数字。' },
        { t: 'narr', text: '我把这一页拍了照。' },
        { t: 'narr', text: '闪光灯忘了关，闪了一下。' },
        { t: 'narr', text: '走廊尽头有人走过来，我把手机塞回口袋，退出办公室。' },
        { t: 'narr', text: '下楼的时候腿有点软。' },
        { t: 'flag', key: 's1_asked_money' },
        { t: 'mat', id: 'M032' },
        { t: 'note', text: '拍到的只是一页登记，能证明收了钱，不能证明钱去了哪儿。' }
      ]
    },

    {
      id: 's1_outside',
      title: '往外面递一份',
      tag: '外部',
      desc: '网上填表和打 12345 是两条路：一条留下编号，一条只留下通话记录。',
      ap: 2,
      once: true,
      script: [
        { t: 'bg', id: 'bedroom', place: '我的房间 · 晚上' },
        { t: 'music', id: 'night_street' },
        { t: 'narr', text: '九点四十，作业写完一半，我把桌上的东西收拢。' },
        { t: 'narr', text: '口罩的包装、抄了日期的纸、写着三个问题的本子。' },
        { t: 'narr', text: '学校那边到现在只有一句话：' },
        { t: 'narr', text: '「您反映的情况已收悉，相关情况正在核查。」' },
        { t: 'narr', text: '没有落款，没有经办人，也没有说什么时候答复。' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '我打开电脑。往外递有两条路，得挑一条。' },

        {
          t: 'choice',
          prompt: '往外面递，走哪条？',
          options: [
            { text: '上市政府门户网站的网上反映，一项一项填', goto: 's1o_form' },
            { text: '打 12345，直接跟人说', goto: 's1o_call' },
            { text: '关掉电脑，今天不递了', goto: 's1o_none' }
          ]
        },

        /* ---- A：网上反映 ---- */
        { t: 'label', name: 's1o_form' },
        { t: 'narr', text: '表格一共九项。' },
        { t: 'narr', text: '反映对象、问题类型、事发时间、事发地点、' },
        { t: 'narr', text: '是否已向被反映单位反映、诉求、联系人、手机号、验证码。' },
        { t: 'narr', text: '「是否已向被反映单位反映」这一项，我选了「是」。' },
        { t: 'narr', text: '下面要求填写反映时间与答复情况。' },
        { t: 'narr', text: '我写：11 月 12 日口头反映，收到「已收悉，正在核查」，未获书面答复。' },
        { t: 'wait', ms: 240 },
        { t: 'narr', text: '正文我写了五行，比我写给后勤的那份短。' },
        { t: 'narr', text: '「本人于 2025 年 11 月 12 日在校内以一元购买应急口罩一只，' },
        { t: 'narr', text: '包装标示生产日期 2021 年 12 月，有效期至 2023 年 12 月。' },
        { t: 'narr', text: '同箱内另有 2022 年 1 月生产、有效期至 2024 年 1 月的批次。' },
        { t: 'narr', text: '现场无价格公示，无产品信息，收款为个人收款码。' },
        { t: 'narr', text: '希望核实该批物资的来源、库存数量、已售出部分的处理方式及款项去向。」' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '联系人那一栏，我填了姓，没填手机号。' },
        { t: 'narr', text: '手机号空着也能提交，只是答复要自己上平台查。' },
        {
          t: 'govform',
          kind: 'mask',
          mat: 'M031',
          time: '2025-11-12 21:52',
          progress: MASK_FORM_PROGRESS
        },
        { t: 'narr', text: '页面跳出一行字：' },
        { t: 'narr', text: '「您的反映已受理，受理编号 2025111235074。办理时限 15 个工作日。」' },
        { t: 'narr', text: '我把编号抄在本子上，抄了两遍。' },
        { t: 'narr', text: '关电脑之前，我盯着那个编号看了一会儿。' },
        { t: 'narr', text: '十五个工作日，到十二月初。' },
        { t: 'flag', key: 's1_gov_submitted' },
        { t: 'flag', key: 's1_channels', value: 1 },
        { t: 'goto', label: 's1o_end' },

        /* ---- B：12345 电话 ---- */
        { t: 'label', name: 's1o_call' },
        { t: 'narr', text: '我在纸上写好要说的四行话，删了两遍。' },
        { t: 'narr', text: '电话打过去，等了五十秒才有人接。' },
        {
          t: 'hotline',
          callTitle: '12345 · 通话中',
          number: '12345',
          steps: [
            { who: '接线员', text: '您好，这里是 12345 政务服务便民热线，请问有什么可以帮您。' },
            {
              ask: '接线员：请讲。',
              options: [
                { text: '我想反映学校在保健室门口卖口罩，卖的是过期的。', reply: '好的，我记一下。请问学校全称。', flag: 's1_hot_open' },
                { text: '……我先想想，等一下再打。', reply: '好的，您方便的时候再拨过来。', flag: 's1_hot_hesitate' }
              ]
            },
            { who: '我', text: '明德中学。保健室门口摆了一张折叠桌，纸箱里是口罩，一块钱一只。' },
            { who: '接线员', text: '请问您怎么知道是过期的。' },
            { who: '我', text: '包装背面印着有效期至 2023 年 12 月。现在是 2025 年 11 月。' },
            { who: '接线员', text: '您购买了吗。' },
            {
              ask: '接线员：您购买了吗？',
              options: [
                { text: '买了。一块钱，钱放进一个铁皮盒。', reply: '好的，您手上有包装和付款记录吗？', flag: 's1_hot_bought' },
                { text: '没买。我是看到别的同学在买。', reply: '好的，那您反映的是这种情况。我记录一下。', flag: 's1_hot_saw' }
              ]
            },
            { who: '接线员', text: '这个事项涉及产品和收费，我们这边会分别转给市场监管和教育部门。' },
            { who: '接线员', text: '请问您贵姓，方便留一个联系电话吗。' },
            {
              ask: '你要不要留信息',
              options: [
                { text: '留姓，不留电话。答复我上平台自己查。', reply: '好的，我记「林同学」，不留联系方式。', flag: 's1_hot_half' },
                { text: '不留。', reply: '好的，可以不留。后续答复只能靠您自己查询。', flag: 's1_hot_anon' },
                { text: '都留吧，万一要回访。', reply: '好的，我登记一下。承办单位可能会联系您。', flag: 's1_hot_full' }
              ]
            },
            { who: '接线员', text: '工单号 2025111288416。办理时限十五个工作日，请留意答复。' },
            { who: '接线员', text: '感谢您的来电。' },
            { who: '我', text: '（电话挂断。屏幕暗下去，房间里只剩下电脑风扇的声音。）' }
          ]
        },
        { t: 'narr', text: '通话记录里多了一条，时长三分零七秒。' },
        { t: 'narr', text: '我把工单号抄在本子上，抄得比写作业认真。' },
        { t: 'narr', text: '打完电话，我坐了一会儿，什么也没做。' },
        { t: 'narr', text: '原来把一件事说清楚，只需要三分钟。' },
        { t: 'narr', text: '难的是之前那三个星期里，我一直在想要不要说。' },
        { t: 'flag', key: 's1_gov_submitted' },
        { t: 'flag', key: 's1_channels', value: 1 },
        { t: 'flag', key: 's1_hot_used' },
        { t: 'goto', label: 's1o_end' },

        /* ---- C：不递 ---- */
        { t: 'label', name: 's1o_none' },
        { t: 'narr', text: '我把网页关掉。' },
        { t: 'narr', text: '窗口消失的时候，屏幕上剩下我自己的一小块倒影。' },
        { t: 'narr', text: '要写的东西其实都已经写好了。' },
        { t: 'narr', text: '提交按钮在那里，点一下，就要写上名字。' },
        { t: 'narr', text: '我没有点。' },
        { t: 'narr', text: '不是怕。是今天已经说得够多了。' },
        { t: 'flag', key: 's1_no_channel' },

        { t: 'label', name: 's1o_end' },
        { t: 'hide', all: true }
      ]
    },

    {
      id: 's1_public',
      title: '发到家长群和朋友圈',
      tag: '外部',
      desc: '两张照片，一句话。发出去很快，收回来很难。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroomNight', place: '初三（2）班 · 晚自习' },
        { t: 'narr', text: '晚自习第二节，我把两张照片拼在一起。' },
        { t: 'narr', text: '一张是纸箱，一张是我那只口罩的背面。' },
        { t: 'narr', text: '编辑框里我写了三行，删掉两行。' },
        { t: 'narr', text: '剩下：学校卖的口罩，有效期 2023 年 12 月。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '发出去之前，我看了一眼沈予安。' },
        { t: 'narr', text: '她在做题，笔尖动得很快。' },
        { t: 'narr', text: '我按了发送。' },
        { t: 'wait', ms: 320 },
        { t: 'narr', text: '十分钟，四十多个赞。' },
        { t: 'narr', text: '二十分钟，有人转进家长群。' },
        { t: 'narr', text: '群里的第一句话是：「这是哪个学校？」' },
        { t: 'narr', text: '第二句是：「一块钱也值得说。」' },
        { t: 'flag', key: 's1_public_claim' },
        { t: 'narr', text: '我把手机扣在桌上。' },
        { t: 'narr', text: '第二天早上，四个人来找我核对日期。' },
        { t: 'narr', text: '两个和我一样，两个是 2022 年 1 月，还没到 2024。' },
        { t: 'narr', text: '其中一个说：「你凭什么说过期两年。」' },
        { t: 'stat', who: 'zhou', trust: -4, pressure: 8 }
      ]
    },

    {
      id: 's1_rest',
      title: '趴在桌上歇一会儿',
      tag: '休息',
      desc: '今天问得够多了。什么也不做，就是不做。',
      ap: 1,
      once: true,
      script: [
        { t: 'bg', id: 'classroom', place: '初三（2）班 · 午休' },
        { t: 'music', id: 'daydream' },
        { t: 'narr', text: '我把外套叠起来当枕头，趴下。' },
        { t: 'narr', text: '教室里有翻书的声音，还有人撕胶带。' },
        { t: 'narr', text: '窗户外面有人在打球，球落地的声音一下一下。' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '我没有睡着。' },
        { t: 'narr', text: '脑子里在数那四十只口罩，数到三十几就断了。' },
        { t: 'narr', text: '起来的时候，脸上有一道桌子边压出来的印子。' },
        { t: 'narr', text: '下午第一节还有十七分钟，够我去一趟楼下。' },
        { t: 'note', text: '歇一会儿不产出材料，但今天剩下的行动还够用。' }
      ]
    }
  ],

  /* 中段事件：查到第三件事的时候，纸箱先被收走了。
     你再想数、想对批号，就只能靠手上的东西。 */
  hubEvents: [
    {
      id: 'box_gone',
      after: 5,
      script: [
        { t: 'hide', all: true },
        { t: 'bg', id: 'hallwayEnd', place: '保健室门口 · 下午课间' },
        { t: 'music', id: 'tense' },
        { t: 'narr', text: '下午第二节课下课，我又下楼一趟。' },
        { t: 'narr', text: '折叠桌还在，纸箱不在了。' },
        { t: 'narr', text: '硬纸板靠在墙边，字朝里。' },
        { t: 'narr', text: '铁皮盒还在桌上，盖子扣着。' },
        { t: 'wait', ms: 280 },
        { t: 'narr', text: '旁边站着两个我不认识的女生，也在看那张空桌子。' },
        { t: 'say', who: 'xu', name: '许小满', sprite: 'xu', text: '刚才还有的。' },
        { t: 'narr', text: '许小满从楼梯口走过来，手里拿着水杯。' },
        { t: 'say', who: 'xu', name: '许小满', sprite: 'xu', text: '我上节课间还看见有人买。' },
        { t: 'say', who: 'lin', name: '林知序', text: '几点。' },
        { t: 'say', who: 'xu', name: '许小满', sprite: 'xu', text: '第二节课前。买的是个男生，好像初二。' },
        { t: 'say', who: 'lin', name: '林知序', text: '他有没有拿走包装。' },
        { t: 'narr', text: '她愣了一下。' },
        { t: 'say', who: 'xu', name: '许小满', sprite: 'xu', text: '……谁会留着那个。' },
        { t: 'wait', ms: 260 },
        { t: 'narr', text: '铁皮盒里还有几枚硬币，能看到两枚一块的。' },
        { t: 'narr', text: '桌子被推回墙边，脚在地砖上刮出很短的一声。' },
        { t: 'narr', text: '一个后勤的老师从保健室出来，把盒子端走了，没有看我们。' },
        { t: 'say', who: 'xu', name: '许小满', sprite: 'xu', text: '这就没了？' },
        { t: 'say', who: 'lin', name: '林知序', text: '嗯。' },
        { t: 'say', who: 'xu', name: '许小满', sprite: 'xu', text: '那你之前问的那些，还算数吗。' },
        { t: 'narr', text: '我看着她，一时没答上来。' },
        { t: 'narr', text: '算数。只是现在能拿出来的，只剩我手上那两只，和几张照片。' },
        { t: 'flag', key: 's1_box_gone' },
        { t: 'note', text: '东西被收走之后，你手上还有什么，才决定你还能说什么。' },
        { t: 'hide', id: 'xu' }
      ]
    }
  ],

  summary: {
    title: '支线 · 一元口罩',
    subtitle: '一块钱，四十只，一百四十七块',
    quote: '「经核查，部分批次已超过标示有效期，现已停止发放并全部封存处理。」',
    known: [
      '自己在校内以一元购买的那只，标示有效期至 2023 年 12 月',
      '同一箱里有 2021 年 12 月和 2022 年 1 月两个批次',
      '收款登记上写着「应急口罩」，三天共记 284 元',
      '学校公众号二〇二二年说过「定期检查有效期」',
      '周姨拒绝代卖，理由是她看了一眼日期'
    ],
    unknown: [
      '这箱口罩到底是哪一次采购剩下的',
      '一百四十七只之外，前面几天卖掉的去了哪儿',
      '那笔钱最后入了哪个账',
      '下一次不会再有人在货架最上面放三年'
    ]
  }
};
