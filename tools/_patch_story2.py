# -*- coding: utf-8 -*-
import io

p = 'scripts/data/ch5.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("import { buildBureauPrompt } from '../core/ai.js';\n", "", 1)

# 顶部加一个生成办理进度数据的函数
anchor = "export default {\n  id: 'ch5',"
assert anchor in s
progress_fn = '''/* 办理进度页面：编号与提交时间取自玩家在第四章/第五章真的填过的那张表。
   没有提交过（例如直接读档到本章）时，用一份兜底编号，页面照样成立。 */
function bureauProgress(state) {
  const gov = state.gov || {};
  const no = gov.no || 'SZ2025091847362';
  const t0 = gov.time || '2025-09-18 21:34';
  return {
    no,
    subject: '反映明德中学周日学业支持活动组织方式问题',
    unit: '市教育局',
    nodes: [
      {
        title: '提交', time: t0, who: '本人 · 政务服务平台', state: '已提交',
        opinion: '反映对象：明德中学。已填写反映内容并勾选真实性承诺。'
      },
      {
        title: '受理', time: '2025-09-19 09:12', who: '市政务服务热线', state: '已受理',
        opinion: '您反映的事项已受理，已按属地管理原则转交主管部门办理。'
      },
      {
        title: '交办', time: '2025-09-19 15:40', who: '市教育局', state: '已交办',
        opinion: '转基础教育科核实并答复。'
      },
      {
        title: '承办', time: '2025-09-20 10:05', who: '市教育局 · 基础教育科', state: '办理中',
        opinion: '已联系学校了解情况，调阅活动通知、确认书与登记材料。'
      },
      {
        title: '答复', time: '2025-09-21 16:20', who: '市教育局 · 基础教育科', state: '已办结',
        opinion: '办理结果已通过本页面答复，并同步发送短信提示。'
      }
    ],
    reply: [
      '同学您好！您的反馈已收悉，我局高度重视，已转相关科室核查。现将有关情况回复如下：',
      '一、关于活动性质。经了解，明德中学开展的周日学业支持活动，系学校依据自愿原则组织的课后服务，学生和家长可自主选择是否参加。',
      '二、关于确认书。学校表示，确认书用于告知家长活动安排，签署与否，不影响学生正常上课，也不影响学生评价。',
      '三、关于家长群内接龙。经核实，该接龙由家长自发组织，学校未作要求。我局已提醒学校规范家校沟通方式，避免造成误解。',
      '四、关于统计表格。学校称相关表格用于掌握整体参与情况，不进入学生档案。',
      '感谢您对教育工作的关心与监督。'
    ],
    tail: '本答复由市教育局通过市政务服务平台作出，可凭事项编号在平台查询。'
  };
}

export default {
  id: 'ch5','''
s = s.replace(anchor, progress_fn, 1)

# ---- ask_ai5 -> ask_faq5 ----
old_ai = s[s.index("      id: 'ask_ai5',"):s.index("      id: 'ask_ma5',")]
new_ai = """      id: 'ask_faq5',
      tag: '消息',
      title: '再翻一次《答家长问》',
      desc: '同一份文件，好像少了一条。',
      once: true,
      script: [
        { t: 'bg', id: 'classroom', place: '教室 · 午休' },
        { t: 'narr', text: '午休的时候，我又点开那份《答家长问》。' },
        { t: 'narr', text: '文件还在群里，转发的还是那一条消息，时间也没变。' },
        { t: 'narr', text: '我往下划了两下，停住了。' },
        { t: 'narr', text: '九条变成八条。' },
        { t: 'narr', text: '“不参加需要说明理由吗”那一条，没有了。' },
        { t: 'narr', text: '现在是第一条讲自愿，第二条直接跳到统计口径。' },
        { t: 'narr', text: '我把之前存的截图翻出来，两张并排放在桌上。' },
        { t: 'mat', id: 'M038' },
        { t: 'narr', text: '左边那张里有一句：“如方便，可在备注中告知班主任。”' },
        { t: 'narr', text: '右边这张里没有。' },
        { t: 'narr', text: '左边那张里，第三条只有两个字：“不会。”' },
        { t: 'narr', text: '右边这张里，第三条变成了：“不会。学校不将参与情况与学生评价挂钩。”' },
        { t: 'narr', text: '事情变好了。' },
        { t: 'narr', text: '一句模糊的话被删掉，一句明确的话被补上。' },
        { t: 'narr', text: '如果只看这一版，你会觉得这份文件很干净。' },
        { t: 'narr', text: '可文件名没变，转发记录没变，群里也没有人说“问答更新了”。' },
        { t: 'narr', text: '它只是被换掉了。换在一百多个人都看过之后。' },
        { t: 'narr', text: '我盯着两行字看了很久，忽然意识到一件事：' },
        { t: 'narr', text: '如果我没有存过第一版，我今天看到的，就是这份很干净的文件。' },
        { t: 'narr', text: '而我会以为它一直是这样的。' },
        { t: 'note', text: '一份可以被悄悄改好的文件，也可以被悄悄改坏。你只能证明你存过的那一版。' },
        { t: 'flag', key: 'faq_changed' },
        { t: 'stat', who: 'chen', pressure: 2 }
      ]
    },

    {
"""
s = s.replace(old_ai, new_ai, 1)

# ---- bureau ----
i0 = s.index("      id: 'bureau',")
i1 = s.index("      id: 'ask_chen5',")
new_bureau = """      id: 'bureau',
      tag: '外部',
      title: '往政务服务平台上填一张表',
      desc: '学校这条线走完了，还有一条路。',
      once: true,
      script: [
        { t: 'bg', id: 'cityNight', place: '家里 · 晚上' },
        { t: 'music', id: 'silent' },
        { t: 'narr', text: '我在搜索框里输入“教育局 网上反映”。' },
        { t: 'narr', text: '第一个结果是政务服务平台的“我要反映”。' },
        { t: 'narr', text: '页面很朴素：几个输入框，一个提交按钮。' },
        { t: 'narr', text: '“反映内容”下面有一行灰色小字：请客观陈述事实，勿包含他人隐私信息。' },
        { t: 'narr', text: '光标在输入框里闪。' },
        { t: 'narr', text: '我把那几条已经在纸上写过很多遍的句子，又打了一遍。' },
        { t: 'narr', text: '打完之后，我盯着提交按钮看了一会儿。' },
        { t: 'narr', text: '填不填，是这一章最后一件事。' },
        {
          t: 'govform',
          closeGoto: 'bureau_close',
          mat: 'M039',
          progress: (no, time) => ({
            no, unit: '市教育局',
            subject: '反映明德中学周日学业支持活动组织方式问题',
            nodes: [
              { title: '提交', time, who: '本人 · 政务服务平台', state: '已提交',
                opinion: '反映对象：明德中学。已填写反映内容并勾选真实性承诺。' },
              { title: '受理', time: '2025-09-19 09:12', who: '市政务服务热线', state: '已受理',
                opinion: '您反映的事项已受理，已按属地管理原则转交主管部门办理。' },
              { title: '答复', time: '', who: '市教育局', state: '办理中', done: false,
                opinion: '正在办理，答复后将通过本页面或短信告知。' }
            ],
            reply: ['您的反映已受理，正在办理中。', '办理完成后，答复内容会出现在“进度查询详情”的节点意见里。']
          })
        },
        { t: 'narr', text: '页面跳出一行提示：您的反映已提交。' },
        { t: 'narr', text: '下面是一串编号，中间夹着日期。' },
        { t: 'narr', text: '我把它抄在本子最后一页，抄得很慢，怕抄错一位。' },
        { t: 'narr', text: '编号下面还有一句：答复将在办理后通过本页面或短信告知。' },
        { t: 'narr', text: '我点了返回，又点了一次返回，回到搜索页。' },
        { t: 'narr', text: '屏幕上还留着那个搜索框，里面是“教育局 网上反映”六个字。' },
        { t: 'flag', key: 'bureau_sent' },
        { t: 'wait', ms: 300 },
        { t: 'narr', text: '第三天下午，手机收到一条短信，说反映的事项已答复。' },
        { t: 'narr', text: '我打开那个页面。' },
        { t: 'govprogress', data: bureauProgress, mat: 'M040' },
        { t: 'narr', text: '我把这段文字读了两遍。' },
        { t: 'narr', text: '每一句都成立。每一句我都在别的地方见过。' },
        { t: 'narr', text: '它没有说“你反映的问题不存在”，也没有说“我们会改”。' },
        { t: 'narr', text: '它说的是：收到了，了解了，已经提醒过了，感谢关心。' },
        { t: 'narr', text: '我往上翻进度节点。' },
        { t: 'narr', text: '提交、受理、交办、承办、答复。五个节点，五个时间，一个不缺。' },
        { t: 'narr', text: '从外面看，这件事被处理得非常完整。' },
        { t: 'narr', text: '“提醒学校规范家校沟通方式”。' },
        { t: 'narr', text: '提醒，不是要求。方式，不是内容。' },
        { t: 'note', text: '一个流程做完了，不等于一个问题被回答了。办理完毕和办成，是两件不同的事。' },
        { t: 'goto', label: 'bureau_end' },

        { t: 'label', name: 'bureau_close' },
        { t: 'narr', text: '我把页面关掉了。' },
        { t: 'narr', text: '窗口消失的时候，屏幕上剩下我自己的一小块倒影。' },
        { t: 'narr', text: '我想，写到这里为止，能说的其实都已经说完了。' },
        { t: 'narr', text: '提交按钮在那里，点一下不会有人知道是我。' },
        { t: 'narr', text: '但我还是没有点。' },
        { t: 'narr', text: '不是因为怕。是因为我忽然不确定：如果一份答复注定只能写成那样，我写这么多，是为了什么。' },
        { t: 'flag', key: 'bureau_closed' },

        { t: 'label', name: 'bureau_end' },
        { t: 'hide', all: true }
      ]
    },

    {
"""
s = s[:i0] + new_bureau + s[i1:]

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
