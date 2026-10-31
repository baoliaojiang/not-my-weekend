/* =========================================================
   结局判定
   ---------------------------------------------------------
   八类结局全部由「实际做过什么」决定，而不是单一数值：
   · 交了什么材料（report_mode / supplement）
   · 拿到哪些关键材料（materials）
   · 第四章怎么面对班级（ch4_stance）
   · 关键人物关系（shen / chen / zhou / luo 的信任）
   · 第五章是否查清了执行链的来源（sun_origin / knows_excel_detail）

   判定顺序即优先级，隐藏结局在最前。
   ========================================================= */

export const ENDINGS = {
  hidden: { name: '把名字留给自己', kind: '隐藏结局' },
  collective: { name: '一起签的那张纸', kind: '集体行动' },
  institutional: { name: '两周之后', kind: '制度性改变' },
  procedural: { name: '已收悉', kind: '程序性胜利' },
  isolated: { name: '一个人的材料', kind: '孤立的胜利' },
  reconcile: { name: '把话说清楚', kind: '意外和解' },
  compromise: { name: '各退一步', kind: '有限妥协' },
  silence: { name: '第二个学期', kind: '沉默的结束' }
};

/** 关键材料：能支撑"执行环节"这一层判断的那几份 */
const KEY_MATERIALS = ['M009', 'M010', 'M014', 'M015', 'M016', 'M019', 'M021', 'M022'];

export function keyMaterialCount(state) {
  const mats = state.materials || [];
  return KEY_MATERIALS.filter(id => mats.includes(id)).length;
}

export function endingScore(state) {
  const trust = (who) => (state.stats && state.stats[who] ? state.stats[who].trust : 0);
  return {
    keyMats: keyMaterialCount(state),
    total: (state.materials || []).length,
    shen: trust('shen'),
    chen: trust('chen'),
    zhou: trust('zhou'),
    luo: trust('luo'),
    mode: state.flags.report_mode || 'none',
    supplement: state.flags.supplement || 'no',
    stance: state.flags.ch4_stance || 'quiet'
  };
}

export function decideEnding(state) {
  const f = state.flags || {};
  const s = endingScore(state);
  const reported = s.mode === 'formal';

  // 1) 隐藏结局：正式反映 + 查清来源 + 只写已核实 + 保住了人 + 与沈予安的信任
  if (
    reported &&
    f.sun_origin && f.knows_excel_detail &&
    s.supplement === 'safe' &&
    s.stance === 'quiet' &&
    s.shen >= 60 && s.keyMats >= 7
  ) return 'hidden';

  // 2) 集体行动：第四章选择联合他人，并且确实组成了
  if (s.stance === 'collective' && f.collective_formed) return 'collective';

  // 3) 制度性改变：材料充分 + 班主任或经手人愿意出面
  if (reported && s.keyMats >= 7 && (s.chen >= 55 || f.luo_statement)) return 'institutional';

  // 4) 程序性胜利 / 5) 孤立的胜利：看材料是否站得住
  if (reported && s.keyMats >= 4) return 'procedural';
  if (reported) return 'isolated';

  // 6) 意外和解：走了面谈路线，并且和两个人都谈开了
  if (s.mode === 'talk' && s.shen >= 55 && s.zhou >= 50) return 'reconcile';

  // 7) 有限妥协：面谈过，但只推动了一部分
  if (s.mode === 'talk') return 'compromise';

  // 8) 沉默的结束
  return 'silence';
}

/** 给玩家看的结局条件提示（不剧透具体数值，只在"关于本作"里列结构） */
export const ENDING_HINTS = [
  { id: 'institutional', text: '材料足够扎实，并且有成年人愿意为它背书。' },
  { id: 'procedural', text: '反映被受理，但能否落地取决于别人。' },
  { id: 'compromise', text: '通过面谈推动了一部分改变。' },
  { id: 'collective', text: '不止一个人愿意站出来，代价由大家分。' },
  { id: 'reconcile', text: '事情没有完全解决，但人和人之间说清楚了。' },
  { id: 'isolated', text: '你确认了事实，也付出了一些关系上的代价。' },
  { id: 'silence', text: '你选择了不再推进，日子照常过下去。' },
  { id: 'hidden', text: '条件苛刻：材料、分寸、关系和时机都刚好。' }
];
