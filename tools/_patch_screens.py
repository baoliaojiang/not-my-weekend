import io, sys

p = 'scripts/ui/screens.js'
s = io.open(p, encoding='utf-8').read()
lines = s.split('\n')

i_ai = next(i for i,l in enumerate(lines) if l.strip().startswith('/* ================= 校园学习助手'))
i_set = next(i for i,l in enumerate(lines) if l.strip().startswith('/* ================= 设置'))
assert i_set > i_ai

GOV = '''  /* ================= 政务服务平台 =================
     剧情里的“提交反映”不再是旁白：玩家真的填一张表，
     填了什么会带进后面的答复与材料。 */
  openComplaintForm(cfg, cb) {
    cfg = cfg || {};
    const done = (res) => {
      if (this._govDone) return;
      this._govDone = true;
      this._panelOnClose = null;
      this._lockClose = false;
      $('#panelClose').style.visibility = '';
      this.el.panelLayer.hidden = true;
      if (this.engine) this.engine.resume();
      cb(res);
    };
    this._govDone = false;

    this.openPanel({
      title: '市政务服务平台',
      body: complaintHTML(this.state, cfg),
      lockClose: !!cfg.lockClose,
      onClose: () => done({ submitted: false }),
      wide: true
    });
    const box = this.el.panelBody;
    bindComplaint(box, this.state, (res) => {
      if (!res.submitted) { this.audio.sfx('click'); done({ submitted: false }); return; }
      this.audio.sfx('ok');
      const no = makeCaseNo();
      const time = cfg.time || '2025-09-18 21:34';
      this._lastGov = { no, time, res };
      this.el.panelTitle.textContent = '市政务服务平台 · 提交结果';
      box.innerHTML = receiptHTML({
        no, time,
        unit: '市教育局',
        typeText: res.types.map(k => ({ fee: '违规收费', force: '变相强制', time: '作息与减负', other: '其他' }[k] || k)).join('、'),
        note: cfg.note || ''
      });
      const go = box.querySelector('#gvProgress');
      if (go) go.addEventListener('click', () => {
        this.audio.sfx('page');
        this._renderGovProgress(cfg.progress, () => done({ submitted: true, ...this._lastGov, res }), false);
      });
      const back = box.querySelector('#gvBack');
      if (back) back.addEventListener('click', () => done({ submitted: true, ...this._lastGov, res }));
    });
  }

  /* 单独的进度查询页（不经过表单，直接给答复） */
  openGovProgress(data, cb) {
    this._govDone = false;
    this.openPanel({
      title: '市政务服务平台 · 进度查询',
      body: progressHTML(data || {}),
      wide: true
    });
    const box = this.el.panelBody;
    bindProgress(box, data || {}, null, (act) => {
      if (this._govDone) return;
      this._govDone = true;
      this._panelOnClose = null;
      this.el.panelLayer.hidden = true;
      if (this.engine) this.engine.resume();
      if (cb) cb(act);
    });
  }

  _renderGovProgress(data, cb) {
    if (!data) return cb && cb();
    this.el.panelBody.innerHTML = progressHTML(data);
    bindProgress(this.el.panelBody, data, null, (act) => cb && cb(act));
  }

'''

lines[i_ai:i_set] = GOV.split('\n')
s = '\n'.join(lines)
arr = s.split('\n')
i0 = next(i for i, l in enumerate(arr) if l.strip().startswith('/* ================= AI 接入设置'))
i1 = next(i for i, l in enumerate(arr) if l.strip().startswith('/* ================= 更新日志'))
arr[i0:i1] = []
s = '\n'.join(arr)

# 设置页里的助手入口
old = """      <div class="setting">
        <div><div class="setting-label">校园学习助手</div>
        <div class="setting-hint">${describeAIConfig(this.settings)}</div></div>
        <button class="btn btn-sm" id="aiConfig">配置</button>
      </div>

"""
assert old in s
s = s.replace(old, '')
s = s.replace("    $('#assetInfo', this.el.panelBody).addEventListener('click', () => this.openAbout());\n    $('#aiConfig', this.el.panelBody).addEventListener('click', () => this.openAISettings());",
              "    $('#assetInfo', this.el.panelBody).addEventListener('click', () => this.openAbout());")

# 引入
s = s.replace("import { AI_PRESETS, getPreset, describeAIConfig, migrateModel } from '../core/ai.js';",
              "import { complaintHTML, bindComplaint, receiptHTML, progressHTML, bindProgress } from './gov.js';")

# 构造函数里的 ai
s = s.replace("  constructor({ root, state, settings, audio, saveAPI, ai }) {", "  constructor({ root, state, settings, audio, saveAPI }) {")
s = s.replace("    this.ai = ai;\n", "")

# closeAll 里的 closeAI
s = s.replace("    this.closeAI(false);\n", "")

# 编号生成
if 'function makeCaseNo' not in s:
    s = s.replace("function sleep(ms)", """function makeCaseNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `SZ${stamp}${seq}`;
}

function sleep(ms)""")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('done')
