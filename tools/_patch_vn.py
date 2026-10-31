import io, re

p = 'scripts/core/vn.js'
s = io.open(p, encoding='utf-8').read()

s = s.replace("import { BUREAU_PROMPT, buildBureauPrompt, offlineBureauReply } from './ai.js';\n", "")

start = s.index("      /* ---------- 校园学习助手 ---------- */")
end = s.index("      /* ---------- 流程 ---------- */")
NEW = '''      /* ---------- 政务服务平台：填写反映 ---------- */
      case 'govform': {
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        const f = this.frames[this.frames.length - 1];
        ui.openComplaintForm(node, (res) => {
          this.blocked = false;
          if (res && res.submitted) {
            const r = res.res || {};
            state.gov = {
              no: res.no,
              time: res.time,
              types: r.types || [],
              desc: r.desc || '',
              claims: r.claims || [],
              amount: r.amount || 0,
              evidence: !!r.evidence,
              replied: false
            };
            setFlag(state, 'gov_submitted');
            if (r.evidence) setFlag(state, 'gov_evidence');
            if ((r.claims || []).includes('refund')) setFlag(state, 'gov_claim_refund');
            if (node.mat) {
              const added = addMaterial(state, node.mat);
              if (added) {
                const mat = ui.getMaterial(node.mat);
                ui.toast(`已收入材料：${mat ? mat.title : node.mat}`, 1800);
              }
            }
            return this.next();
          }
          const target = node.closeGoto ? this.findLabel(node.closeGoto) : undefined;
          if (target !== undefined) { f.i = target; return this.run(); }
          return this.next();
        });
        return;
      }

      /* ---------- 政务服务平台：查看办理答复 ---------- */
      case 'govprogress': {
        this.stopAllModes();
        this.blocked = true;
        markRead(key);
        const data = typeof node.data === 'function' ? node.data(state) : node.data;
        if (state.gov) state.gov.replied = true;
        if (node.flag) setFlag(state, node.flag, true);
        ui.openGovProgress(data, () => {
          this.blocked = false;
          if (node.mat) {
            const added = addMaterial(state, node.mat);
            if (added) {
              const mat = ui.getMaterial(node.mat);
              ui.toast(`已收入材料：${mat ? mat.title : node.mat}`, 1800);
            }
          }
          this.next();
        });
        return;
      }

'''
s = s[:start] + NEW + s[end:]

# 删除 showAIReply
a = s.index('  /* ================= AI 撰写的公文 =================')
b = s.index('  renderText(node, textEl, instant) {')
s = s[:a] + s[b:]

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
