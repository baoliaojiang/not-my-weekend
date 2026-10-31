# -*- coding: utf-8 -*-
"""把《重写3.docx》的剧情正文切成结构化行，输出 JSON（不改动原文件）。"""
import json
import re
import sys
from docx import Document

SRC = r'D:/workbuddy/2026-10-25-15-11-12/重写3.docx'
OUT = r'D:/workbuddy/2026-10-23-16-33-10/.workbuddy/tmp/story.json'

# 章节边界（起始段落下标，结束为下一个之前）
SECS = [
    ('ch0',   '序章',   '九月一日',        11,   461),
    ('ch1',   '第一章', '自愿报名',        462,  2282),
    ('ch2',   '第二章', '自愿签字的人',    2283, 4141),
    ('ch3',   '第三章', '已收悉',          4142, 6074),
    ('ch4',   '第四章', '没有人想成为第一个', 6075, 7732),
    ('ch5',   '第五章', '公开的秘密',      7733, 9545),
    ('ch6',   '第六章', '周六之后',        9546, 11627),
    ('side1', '支线',   '一元口罩',        11628, 12134),
    ('side2', '支线',   '直饮水',          12135, 12630),
    ('side3', '支线',   '第八节课',        12631, 13117),
    ('side4', '支线',   '水卡',            13118, 13649),
    ('side5', '支线',   '远足盒饭',        13650, 14603),
]

# 说话人白名单：只有这些前缀才当对白，其余「xx：」一律按旁白/界面文字处理
SPEAKERS = {
    '林知序', '沈予安', '陈老师', '郑野', '周予晴', '妈妈', '孙芃',
    '数学老师', '英语老师', '语文老师', '吴老师', '唐老师', '后勤老师',
    '男老师', '女老师', '老师', '男生', '女生', '保安', '门卫',
    '接线员', '对方', '爸爸', '女人', '男人', '短袖男人', '穿衬衫的男人',
    '卷发妈妈', '眼镜妈妈', '夹克爸爸', '男生的妈妈', '劳动委员',
    '班主任', '许清和', '？？？', '我', '沈予安小声', '郑野在群里',
}

NUM = r'[0-9０-９]'


def clean(line):
    """去掉行尾的作者说明括号。"""
    s = line.strip()
    # 整行被括号包住 = 作者说明
    if re.fullmatch(r'（[^（）]{0,120}）', s):
        return ''
    if re.fullmatch(r'\([^()]{0,120}\)', s):
        return ''
    # 行尾括号里含作者口吻的关键词
    m = re.search(r'（[^（）]{0,80}(如果|此处|插入|不要显示|说明|以下|待定|作者|注意)[^（）]{0,80}）\s*$', s)
    if m:
        s = s[:m.start()].strip()
    return s


def parse_range(lines):
    out = []
    i = 0
    n = len(lines)
    while i < n:
        raw = lines[i]
        t = clean(raw)
        i += 1
        if not t:
            continue

        # ---- 分隔线 / 章节标题 / 导演说明 ----
        if re.fullmatch(r'—+\s*.+?\s*—+', t):
            continue
        if re.match(r'^(中间显示|画面|镜头|此处|以下场景|切至|淡入|淡出)', t):
            continue

        # ---- 演出与玩法标记 ----
        m = re.match(r'^〔\s*场景\s*〕\s*(.+)$', t)
        if m:
            out.append({'k': 'scene', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^〔\s*音乐\s*〕\s*(.+)$', t)
        if m:
            out.append({'k': 'music', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^〔\s*立绘\s*〕\s*出场\s*[：:]\s*([^（(]+)[（(]\s*([a-zA-Z]+)\s*[）)]', t)
        if m:
            out.append({'k': 'show', 'v': {'who': m.group(1).strip(), 'pos': m.group(2)}})
            continue
        m = re.match(r'^〔\s*立绘\s*〕\s*退场\s*[：:]\s*(\S+)', t)
        if m:
            out.append({'k': 'hide', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^〔\s*材料\s*〕\s*(M\d+)\s*《([^》]+)》\s*(?:·\s*来源\s*[：:]\s*([^·]+))?', t)
        if m:
            out.append({'k': 'mat', 'v': {'id': m.group(1), 'title': m.group(2),
                                          'src': (m.group(3) or '').strip()}})
            continue
        if re.match(r'^〔\s*材料获取\s*〕', t):
            continue
        m = re.match(r'^〔\s*成就\s*〕\s*(\S+)\s*(?:·\s*(.+))?$', t)
        if m:
            out.append({'k': 'ach', 'v': {'id': m.group(1), 'name': (m.group(2) or '').strip()}})
            continue
        m = re.match(r'^〔\s*日程\s*〕\s*(.+)$', t)
        if m:
            out.append({'k': 'day', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^〔\s*关系\s*〕\s*(\S+?)\s*Lv\.?\s*(\d+)\s*(?:→|-{1,2}>|到)\s*Lv\.?\s*(\d+)\s*(.*)$', t)
        if m:
            out.append({'k': 'rel', 'v': {'who': m.group(1), 'from': int(m.group(2)),
                                          'to': int(m.group(3)), 'tag': m.group(4).strip()}})
            continue
        m = re.match(r'^〔\s*情报\s*〕\s*(.+)$', t)
        if m:
            out.append({'k': 'info', 'v': m.group(1).strip()})
            continue
        if re.match(r'^〔\s*(小游戏|属性|条件)\s*〕', t):
            # 小游戏块：紧跟的五段说明一并跳过
            while i < n:
                nxt = lines[i].strip()
                if re.match(r'^(玩法|操作|判定|失败|回写|权重|胜负|奖励|备注)\s*[：:]', nxt):
                    i += 1
                    continue
                break
            continue
        # ---- 结局锚点（必须放在通用〔判断之前）----
        m = re.match(r'^〔\s*结局锚点\s*〕\s*(\S+)', t)
        if m:
            out.append({'k': 'ending', 'v': m.group(1).strip()})
            continue
        if re.match(r'^〔', t):
            continue

        # ---- 流程 ----
        m = re.match(r'^▸\s*选择\s*[：:]\s*(.*)$', t)
        if m:
            out.append({'k': 'choice', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^◆\s*分支标签\s*[：:]\s*(\S+)', t)
        if m:
            out.append({'k': 'label', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^↳\s*跳转到\s*(\S+)', t)
        if m:
            out.append({'k': 'goto', 'v': m.group(1).strip()})
            continue
        m = re.match(r'^([A-F])\.\s*(.+?)(?:\s*→\s*(\S+))?\s*$', t)
        if m and out and (out[-1]['k'] == 'choice' or out[-1]['k'] == 'opt'):
            out.append({'k': 'opt', 'v': {'key': m.group(1), 'text': m.group(2).strip(),
                                          'goto': (m.group(3) or '').strip()}})
            continue

        # ---- 对白 ----
        m = re.match(r'^([^：:]{1,8})[：:]\s*(.*)$', t)
        if m and m.group(1).strip() in SPEAKERS:
            who, text = m.group(1).strip(), m.group(2).strip()
            if text:
                out.append({'k': 'say', 'v': {'who': who, 'text': text}})
                continue

        # ---- 其余=旁白 ----
        out.append({'k': 'narr', 'v': t})

    return out


def main():
    doc = Document(SRC)
    ps = [p.text for p in doc.paragraphs]
    chapters = []
    for cid, title, name, a, b in SECS:
        lines = ps[a:b]
        rows = parse_range(lines)
        if rows and rows[0]['k'] == 'narr' and rows[0]['v'].strip() == f'{title} · {name}':
            rows.pop(0)
        chapters.append({'id': cid, 'title': title, 'name': name, 'rows': rows})
    json.dump({'chapters': chapters}, open(OUT, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=0)
    for ch in chapters:
        kinds = {}
        for r in ch['rows']:
            kinds[r['k']] = kinds.get(r['k'], 0) + 1
        chars = sum(len(r['v'] if isinstance(r['v'], str) else r['v'].get('text', ''))
                    for r in ch['rows'] if r['k'] in ('narr', 'say'))
        print(f"{ch['id']:6} 行{len(ch['rows']):5} 字{chars:7} {kinds}")
    print('输出', OUT)


if __name__ == '__main__':
    main()
