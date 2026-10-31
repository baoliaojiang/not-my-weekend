/* =========================================================
   课堂小测 · 界面
   ---------------------------------------------------------
   把"上课"变成真的能动手做的事：题干 + 四个选项，
   交卷后逐题给对错和解析，最后出一个分数条。
   数据全部来自章节里的 quiz 节点，引擎不关心考什么。
   ========================================================= */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const LETTER = ['A', 'B', 'C', 'D', 'E'];

/** 出题页 */
export function quizHTML(cfg) {
  const qs = cfg.questions || [];
  const body = qs.map((q, i) => `
    <div class="qz" data-q="${i}">
      <div class="qz-stem"><span class="qz-no">${i + 1}</span><span>${esc(q.q)}</span></div>
      <div class="qz-opts">
        ${(q.options || []).map((o, j) => `
          <button class="qz-opt" data-q="${i}" data-o="${j}" type="button">
            <span class="qz-key">${LETTER[j]}</span><span class="qz-txt">${esc(o)}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');

  return `
    <div class="quiz">
      <div class="quiz-lead">
        <span class="quiz-tag">${esc(cfg.tag || '随堂测')}</span>
        <span class="quiz-time">${esc(cfg.time || '')}</span>
      </div>
      ${cfg.intro ? `<p class="quiz-intro">${esc(cfg.intro)}</p>` : ''}
      <div class="quiz-progress"><i id="qzBar" style="width:0%"></i><span id="qzCount">已答 0 / ${qs.length}</span></div>
      ${body}
      <div class="quiz-foot">
        <button class="btn btn-quiz" id="qzSubmit" type="button" disabled>交卷</button>
        <span class="quiz-tip" id="qzTip">还有 ${qs.length} 题没答</span>
      </div>
    </div>`;
}

/** 批卷页 */
export function quizResultHTML(cfg, answers) {
  const qs = cfg.questions || [];
  let right = 0;
  const rows = qs.map((q, i) => {
    const pick = answers[i];
    const ok = pick === q.answer;
    if (ok) right++;
    return `
      <div class="qzr ${ok ? 'ok' : 'bad'}">
        <div class="qzr-head">
          <span class="qzr-mark">${ok ? '√' : '×'}</span>
          <span class="qzr-stem">${i + 1}. ${esc(q.q)}</span>
        </div>
        <div class="qzr-line ${ok ? '' : 'bad'}">
          你的答案：${pick == null ? '（空）' : LETTER[pick] + '. ' + esc(q.options[pick])}
        </div>
        ${ok ? '' : `<div class="qzr-line ok">正确答案：${LETTER[q.answer]}. ${esc(q.options[q.answer])}</div>`}
        ${q.explain ? `<div class="qzr-exp">${esc(q.explain)}</div>` : ''}
      </div>`;
  }).join('');

  const total = qs.length;
  const pct = total ? Math.round((right / total) * 100) : 0;
  const level = pct === 100 ? '全对' : pct >= 60 ? '还行' : '错得有点多';
  return `
    <div class="quiz-result">
      <div class="quiz-lead">
        <span class="quiz-tag">${esc(cfg.tag || '随堂测')}</span>
        <span class="quiz-time">${esc(cfg.time || '')}</span>
      </div>
      <div class="qzr-score">
        <div class="qzr-num">${right}<i>/${total}</i></div>
        <div class="qzr-bar"><i style="width:${pct}%"></i></div>
        <div class="qzr-level">${level}</div>
      </div>
      ${rows}
    </div>`;
}

/** 绑定出题页交互；onSubmit(answers) 在交卷时触发 */
export function bindQuiz(root, cfg, onSubmit) {
  const qs = cfg.questions || [];
  const answers = new Array(qs.length).fill(null);

  const refresh = () => {
    const done = answers.filter(a => a != null).length;
    const bar = root.querySelector('#qzBar');
    const cnt = root.querySelector('#qzCount');
    const tip = root.querySelector('#qzTip');
    const btn = root.querySelector('#qzSubmit');
    if (bar) bar.style.width = (done / qs.length * 100) + '%';
    if (cnt) cnt.textContent = `已答 ${done} / ${qs.length}`;
    const left = qs.length - done;
    if (tip) tip.textContent = left > 0 ? `还有 ${left} 题没答` : '可以交了';
    if (btn) btn.disabled = done < qs.length;
  };

  root.querySelectorAll('.qz-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const qi = Number(btn.dataset.q);
      const oi = Number(btn.dataset.o);
      answers[qi] = oi;
      root.querySelectorAll(`.qz-opt[data-q="${qi}"]`).forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      refresh();
    });
  });

  const submit = root.querySelector('#qzSubmit');
  if (submit) submit.addEventListener('click', () => {
    if (answers.some(a => a == null)) return;
    onSubmit(answers.slice());
  });

  refresh();
}
