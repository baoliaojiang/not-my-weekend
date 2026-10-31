/* =========================================================
   支线路口
   ---------------------------------------------------------
   首页「支线」入口打开的那一页。这里只登记"有哪些支线、什么时候能进"，
   具体的剧情、材料、判定都在各自的 data/sideN.js 里。

   规则：
   · 路口在序章通关之后才解锁（progress.chapters 里出现 'ch0'）。
   · 已开放的支线可以反复进，每次都是独立的一局，不继承上一次的结论。
   · 未开放的支线只显示一条引子，不剧透内容。
   · 支线存档与主线存档完全分开（见 core/store.js 的 writeSideSlot）。
   ========================================================= */

export const SIDES = [
  {
    id: 'side1',
    no: '01',
    name: '一元口罩',
    tag: '校园后勤',
    dayLabel: '第十一周 · 周三',
    desc: '保健室门口摆着个纸箱，一块钱一只的口罩，有效期印在封口上，糊得看不清。\n有人说是过期的，有人说自己看错了。',
    points: ['产品责任', '批次与证据', '五个部门各管一段'],
    minutes: 40,
    available: true,
    // 结局数量，只用来做提示，不作为判定依据
    endings: 5
  },
  {
    id: 'side2',
    no: '02',
    name: '直饮水',
    tag: '校园设施',
    dayLabel: '第三周 · 周五',
    desc: '三楼走廊那台直饮水机，滤芯更换记录停在去年十月。\n后勤说换过了，只是没写。',
    points: ['维护记录', '抽检与公示'],
    minutes: 40,
    available: true,
    // 结局数量，只用来做提示，不作为判定依据
    endings: 5
  },
  {
    id: 'side3',
    no: '03',
    name: '第八节课',
    tag: '课表之外',
    dayLabel: '第十六周',
    desc: '课表上多出来的一节课，家长群里叫"自愿留下"。\n没有人说得清它从哪一天开始的。',
    points: ['课表', '自愿与默认', '公示在哪一面墙上'],
    minutes: 40,
    available: true,
    // 结局数量，只用来做提示，不作为判定依据
    endings: 5
  },
  {
    id: 'side4',
    no: '04',
    name: '水卡',
    tag: '校园收费',
    dayLabel: '十月 · 周三',
    desc: '免费的直饮水机换成了刷卡的新机器，卡要先用校园通充值。\n公告上没写单价，也没写一分钟多少钱。',
    points: ['收费公示', '成本与定价'],
    minutes: 40,
    available: true,
    endings: 3
  },
  {
    id: 'side5',
    no: '05',
    name: '远足盒饭',
    tag: '集体活动',
    dayLabel: '十一月 · 远足当天',
    desc: '远足那天统一订餐，一人一份，费用从班费里出。\n通知的附件里写着「不建议自带」。',
    points: ['自愿与统一', '成本去向'],
    minutes: 45,
    available: true,
    endings: 3
  }
];

/** 序章通关即解锁路口 */
export function sideHubUnlocked(progress) {
  if (!progress) return false;
  return (progress.chapters || []).includes('ch0');
}

export function getSide(id) {
  return SIDES.find(s => s.id === id) || null;
}

/** 已开放的条目（用于统计首页按钮上的角标） */
export function openSideCount() {
  return SIDES.filter(s => s.available).length;
}
