/* =========================================================
   素材注册表
   ---------------------------------------------------------
   规则：
   1) 剧情脚本里只允许出现素材 ID，禁止写路径；
   2) 新增素材只改这里；
   3) 缺失素材不会崩溃 —— 背景退化为渐变+地点名，立绘退化为虚线占位框，
      音乐静默并在设置里提示。

   素材来源声明：
   立绘、背景均为本项目自制生成，背景音乐与音效为程序合成，
   不依赖任何第三方素材，因此不存在授权问题。
   ========================================================= */

export const ASSET_SOURCE = '自制生成';

/* 全部场景背景为 AI 生成（日式动画背景美术）；同场景的黄昏/夜里/清晨
   由 tools/bg_tone.py 从底图调色而来，保证构图完全一致。 */
export const BACKGROUNDS = {
  gate:        { src: 'assets/backgrounds/bg_gate.webp',        label: '校门' },
  classroom:   { src: 'assets/backgrounds/bg_classroom.webp',   label: '高一（二）班教室' },
  corridor:    { src: 'assets/backgrounds/bg_corridor.webp',    label: '教学楼走廊' },
  shop:        { src: 'assets/backgrounds/bg_shop.webp',        label: '小卖部' },
  commons:     { src: 'assets/backgrounds/bg_commons.webp',     label: '空教室' },
  clubroom:    { src: 'assets/backgrounds/bg_clubroom.webp',    label: '社团活动室' },
  streetNight: { src: 'assets/backgrounds/bg_street_night.webp', label: '回家的路' },
  cityNight:   { src: 'assets/backgrounds/bg_city_night.webp',  label: '夜里' },
  // —— 第二批：从原作背景库补的场景（客厅 / 卧室 / 街区 / 走廊尽头 / 礼堂 / 天台）
  homeLiving:  { src: 'assets/backgrounds/bg_home_living.webp', label: '家里的客厅' },
  bedroom:     { src: 'assets/backgrounds/bg_bedroom.webp',     label: '我的房间' },
  streetDusk:  { src: 'assets/backgrounds/bg_street_dusk.webp', label: '傍晚的街' },
  townDay:     { src: 'assets/backgrounds/bg_town_day.webp',    label: '白天的街区' },
  hallwayEnd:  { src: 'assets/backgrounds/bg_hallway_end.webp', label: '走廊尽头' },
  auditorium:  { src: 'assets/backgrounds/bg_auditorium.webp',  label: '礼堂' },
  skyDusk:     { src: 'assets/backgrounds/bg_sky_dusk.webp',    label: '楼顶的天' },
  studio:      { src: 'assets/backgrounds/bg_studio.webp',      label: '活动室' },
  // —— 第三批：同一张底图的时间变体
  // 全篇一天排到 21:50，晚自习和放学后如果还用白天那张教室，会一直"白天上课"。
  // 这里按时间段做色彩分级（清晨微暖 / 黄昏暖橙 / 夜晚压暗偏蓝），风格与底图完全一致。
  classroomDusk:  { src: 'assets/backgrounds/bg_classroom_dusk.webp',  label: '教室 · 黄昏' },
  classroomNight: { src: 'assets/backgrounds/bg_classroom_night.webp', label: '教室 · 晚自习' },
  corridorDawn:   { src: 'assets/backgrounds/bg_corridor_dawn.webp',   label: '走廊 · 清晨' },
  corridorDusk:   { src: 'assets/backgrounds/bg_corridor_dusk.webp',   label: '走廊 · 放学后' },
  corridorNight:  { src: 'assets/backgrounds/bg_corridor_night.webp',  label: '走廊 · 夜里' },
  gateDusk:       { src: 'assets/backgrounds/bg_gate_dusk.webp',       label: '校门 · 傍晚' },
  gateNight:      { src: 'assets/backgrounds/bg_gate_night.webp',      label: '校门 · 夜里' },
  shopNight:      { src: 'assets/backgrounds/bg_shop_night.webp',      label: '小卖部 · 夜里' },
  commonsDusk:    { src: 'assets/backgrounds/bg_commons_dusk.webp',    label: '空教室 · 黄昏' },
  streetDay:      { src: 'assets/backgrounds/bg_street_day.webp',      label: '白天的街' },
  // —— 第四批：专用地点（由同类底图分级而来，避免食堂/保健室借教室的图）
  canteen:        { src: 'assets/backgrounds/bg_canteen.webp',         label: '食堂' },
  infirmary:      { src: 'assets/backgrounds/bg_infirmary.webp',       label: '保健室' }
};

/* 主角立绘按性别分两套。
   剧本里统一写 who: 'lin'，由 assetUrl('sprite','lin') 按当前设置
   解析成 linM / linF —— 这样所有剧情节点、手机头像、人物档案都不用改。 */
/* 全部立绘为本作 AI 生成（统一画风：青年向日系动画、细长眼型、
   硬边赛璐璐上色、淡蓝紫冷调）。 */
export const SPRITES = {
  lin:     { src: 'assets/characters/lin_zhixu.webp',      label: '林知序' },
  linM:    { src: 'assets/characters/lin_male.webp',       label: '林知序' },
  linF:    { src: 'assets/characters/lin_female.webp',     label: '林知序' },
  shen:    { src: 'assets/characters/shen_yuan.webp',       label: '沈予安' },
  zhou:    { src: 'assets/characters/zhou_yuqing.webp',     label: '周予晴' },
  chen:    { src: 'assets/characters/teacher_chen.webp',    label: '陈老师' },
  xu:      { src: 'assets/characters/classmate_xu.webp',    label: '许小满' },
  zheng:   { src: 'assets/characters/classmate_zheng.webp', label: '郑野' },
  luo:     { src: 'assets/characters/luo_yizhou.webp',      label: '罗一舟' },
  he:      { src: 'assets/characters/he_yu.webp',           label: '何雨' },
  sun:     { src: 'assets/characters/sun_peng.webp',        label: '孙芃' },
  ma:      { src: 'assets/characters/ma_wenjie.webp',       label: '马文杰' },
  wu:      { src: 'assets/characters/wu_jianguo.webp',      label: '吴老师' },
  zyi:     { src: 'assets/characters/zhou_yi.webp',         label: '周姨' },
  fu:      { src: 'assets/characters/fu_yisheng.webp',      label: '校医' }
};

/* 全部背景音乐为本作程序合成（tools/make_music.py）：
   五声音阶内的和弦进行 + 长音 pad + 分解和弦，统一 -17dB RMS / -2dB 封顶。
   好处是不再依赖任何外部曲库，也就没有授权问题。 */
export const MUSIC = {
  title:   { src: 'assets/music/title.mp3', label: '主题曲 · 不属于我的周末' },
  daily:   { src: 'assets/music/daily.mp3',       label: '日常' },
  calm:    { src: 'assets/music/calm.mp3',                label: '安静' },
  silent:  { src: 'assets/music/silent.mp3',              label: '沉默' },
  rain:    { src: 'assets/music/rain.mp3',                label: '雨前' },
  daydream:{ src: 'assets/music/daydream.mp3',            label: '白日梦' },
  // —— 第二批：补足不同情绪
  calm2:   { src: 'assets/music/calm2.mp3',        label: '安静 · 二' },
  relax:   { src: 'assets/music/relax.mp3',        label: '松一口气' },
  city:    { src: 'assets/music/city.mp3',         label: '城市' },
  office:  { src: 'assets/music/office.mp3',       label: '办事' },
  room:    { src: 'assets/music/room.mp3',         label: '室内' },
  hall:    { src: 'assets/music/hall.mp3',         label: '礼堂' },
  sunset:  { src: 'assets/music/sunset.mp3',       label: '黄昏' },
  night_street: { src: 'assets/music/night_street.mp3', label: '夜街' },
  hope:    { src: 'assets/music/hope.mp3',         label: '往上走' },
  tense:   { src: 'assets/music/tense.mp3',        label: '绷紧' },
  // —— 第三批：按场景补到 23 首，剧情里靠 bg 自动选曲
  classroom:{ src: 'assets/music/classroom.mp3',   label: '教室' },
  morning: { src: 'assets/music/morning.mp3',      label: '清晨' },
  canteen: { src: 'assets/music/canteen.mp3',      label: '食堂' },
  playground:{ src: 'assets/music/playground.mp3', label: '操场' },
  exam:    { src: 'assets/music/exam.mp3',         label: '考试' },
  broadcast:{ src: 'assets/music/broadcast.mp3',   label: '广播' },
  goodbye: { src: 'assets/music/goodbye.mp3',      label: '告别' },
  memory:  { src: 'assets/music/memory.mp3',       label: '回忆' },
  home:    { src: 'assets/music/home.mp3',         label: '家' }
};

export const SFX = {
  click:  { src: 'assets/sfx/click.wav' },
  page:   { src: 'assets/sfx/page.wav' },
  notify: { src: 'assets/sfx/notify.wav' },
  select: { src: 'assets/sfx/select.wav' }
};

const REGISTRY = { background: BACKGROUNDS, sprite: SPRITES, music: MUSIC, sfx: SFX };

/* 当前主角性别。由 main.js 在启动与设置变更时写入，
   立绘、头像、人物档案都从这里读，保证同一局里前后一致。 */
let protagonistGender = 'male';
export function setProtagonist(gender) {
  protagonistGender = gender === 'female' ? 'female' : 'male';
}
export function getProtagonist() { return protagonistGender; }
/** 主角立绘的实际资源 id */
export function playerSpriteId() {
  return protagonistGender === 'female' ? 'linF' : 'linM';
}

/** 解析素材 ID → URL；找不到时返回 null（由调用方走占位逻辑） */
export function assetUrl(kind, id) {
  const group = REGISTRY[kind];
  if (!group) return null;
  // 主角：一个 id 对应两套图，按性别分流
  if (kind === 'sprite' && id === 'lin') {
    const item = group[playerSpriteId()] || group.lin;
    return item ? item.src : null;
  }
  const item = group[id];
  return item ? item.src : null;
}

/** 头像图：把立绘路径里的 characters 换成 faces
    （tools/make-faces.py 从每张立绘上裁出来的正脸方图） */
export function faceUrl(id) {
  const src = assetUrl('sprite', id);
  return src ? src.replace('/characters/', '/faces/') : null;
}

export function assetLabel(kind, id) {
  const group = REGISTRY[kind];
  const item = group && group[id];
  return (item && item.label) || id;
}

export function hasAsset(kind, id) {
  const group = REGISTRY[kind];
  return !!(group && group[id]);
}
