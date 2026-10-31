/* =========================================================
   游戏中心
   ---------------------------------------------------------
   学生机上能有的东西：两个不用联网的小游戏，加一个"未安装"的占位。
   2048 和扫雷都是真能玩的，不是截图。
   ========================================================= */

export function gameCenterHTML() {
  const items = [
    { id: 'g2048', name: '2048', desc: '合并数字，凑到 2048', cls: 'g-2048' },
    { id: 'mine', name: '扫雷', desc: '9 × 9 · 10 颗雷', cls: 'g-mine' },
    { id: 'snake', name: '贪吃蛇', desc: '未安装', cls: 'g-snake', off: true }
  ];
  const grid = items.map(g => `
    <button class="gc-item ${g.off ? 'is-off' : ''}" type="button" ${g.off ? 'disabled' : `data-game="${g.id}"`}>
      <span class="gc-tile ${g.cls}">${g.name.slice(0, 1)}</span>
      <span class="gc-t"><b>${g.name}</b><i>${g.desc}</i></span>
    </button>`).join('');

  return `<div class="mapp">
    <div class="gc-head"><b>游戏中心</b><i>不用联网也能玩</i></div>
    <div class="mapp-card">${grid}</div>
    <p class="mapp-foot">缓存里只有这两个。想要别的，得等放假回家。</p>
  </div>`;
}

/* ---------------- 2048 ---------------- */
export function g2048HTML() {
  return `<div class="mapp mapp-g2048">
    <div class="g2-top">
      <div class="g2-score"><span>分数</span><b id="g2Score">0</b></div>
      <div class="g2-score"><span>最高</span><b id="g2Best">0</b></div>
      <button class="g2-new" type="button" id="g2New">重开</button>
    </div>
    <div class="g2-board" id="g2Board"></div>
    <p class="mapp-foot">方向键 / 在棋盘上滑动</p>
  </div>`;
}

export function bind2048(root) {
  const board = root.querySelector('#g2Board');
  const scoreEl = root.querySelector('#g2Score');
  const bestEl = root.querySelector('#g2Best');
  if (!board) return;

  const N = 4;
  const KEY = 'zbnx.2048.best';
  let best = 0;
  try { best = Number(localStorage.getItem(KEY) || 0) || 0; } catch (e) { best = 0; }

  let grid, score = 0, over = false;

  const paint = () => {
    board.innerHTML = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = grid[r][c];
        const cell = document.createElement('div');
        cell.className = 'g2-cell' + (v ? ` v-${Math.min(v, 4096)}` : '');
        cell.textContent = v || '';
        board.appendChild(cell);
      }
    }
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
  };

  const empty = () => {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) out.push([r, c]);
    return out;
  };

  const spawn = () => {
    const e = empty();
    if (!e.length) return;
    const [r, c] = e[Math.floor(Math.random() * e.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  };

  const reset = () => {
    grid = Array.from({ length: N }, () => Array(N).fill(0));
    score = 0; over = false;
    spawn(); spawn();
    paint();
  };

  const canMove = () => {
    if (empty().length) return true;
    for (let r = 0; r < N; r++) {
      for (let c = 1; c < N; c++) {
        if (grid[r][c] === grid[r][c - 1]) return true;
        if (grid[c][r] === grid[c - 1][r]) return true;
      }
    }
    return false;
  };

  const move = (dir) => {
    if (over) return;
    const before = JSON.stringify(grid);
    for (let i = 0; i < N; i++) {
      let line = [];
      for (let j = 0; j < N; j++) {
        line.push(dir === 'left' || dir === 'right' ? grid[i][j] : grid[j][i]);
      }
      if (dir === 'right' || dir === 'down') line.reverse();
      const out = [];
      for (let k = 0; k < line.length; k++) {
        if (!line[k]) continue;
        if (out.length && out[out.length - 1] === line[k]) {
          out[out.length - 1] *= 2;
          score += out[out.length - 1];
        } else out.push(line[k]);
      }
      while (out.length < N) out.push(0);
      if (dir === 'right' || dir === 'down') out.reverse();
      for (let j = 0; j < N; j++) {
        if (dir === 'left' || dir === 'right') grid[i][j] = out[j];
        else grid[j][i] = out[j];
      }
    }
    if (JSON.stringify(grid) === before) return;
    spawn();
    if (score > best) {
      best = score;
      try { localStorage.setItem(KEY, String(best)); } catch (e) { /* 隐私模式 */ }
    }
    if (!canMove()) over = true;
    paint();
  };

  const keyHandler = (e) => {
    if (!board.isConnected) { document.removeEventListener('keydown', keyHandler); return; }
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
  };
  document.addEventListener('keydown', keyHandler);

  // 触摸滑动
  let sx = 0, sy = 0;
  board.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY;
  }, { passive: true });
  board.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });

  const nb = root.querySelector('#g2New');
  if (nb) nb.addEventListener('click', reset);

  reset();
}

/* ---------------- 扫雷 ---------------- */
export function mineHTML() {
  return `<div class="mapp mapp-mine">
    <div class="mn-top">
      <span class="mn-tag" id="mnLeft">雷 10</span>
      <span class="mn-tag" id="mnState">进行中</span>
      <button class="mn-flag" type="button" id="mnFlag">插旗</button>
      <button class="mn-new" type="button" id="mnNew">重开</button>
    </div>
    <div class="mn-board" id="mnBoard"></div>
    <p class="mapp-foot">先按「插旗」再点格子，可以标雷。</p>
  </div>`;
}

export function bindMine(root) {
  const board = root.querySelector('#mnBoard');
  if (!board) return;
  const N = 9, MINES = 10;
  let cells, dead, flagMode = false, left = MINES, opened = 0;

  const reset = () => {
    cells = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ mine: false, open: false, flag: false, n: 0 })));
    dead = false; opened = 0; left = MINES;
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
      if (cells[r][c].mine) continue;
      cells[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr][cc].mine) n++;
      }
      cells[r][c].n = n;
    }
    paint();
  };

  const reveal = (r, c) => {
    const cell = cells[r][c];
    if (cell.open || cell.flag) return;
    cell.open = true;
    if (cell.mine) { dead = true; return; }
    opened++;
    if (cell.n === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) reveal(rr, cc);
      }
    }
  };

  const paint = () => {
    board.innerHTML = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = cells[r][c];
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'mn-cell' + (cell.open ? ' is-open' : '') + (cell.flag ? ' is-flag' : '');
        if (cell.open && cell.mine) d.classList.add('is-mine');
        if (cell.open && !cell.mine && cell.n) {
          d.textContent = String(cell.n);
          d.classList.add('n' + cell.n);
        }
        if (cell.flag) d.textContent = '⚑';
        d.addEventListener('click', () => {
          if (dead || cell.open) return;
          if (flagMode && !cell.open) {
            cell.flag = !cell.flag;
            left += cell.flag ? -1 : 1;
          } else {
            reveal(r, c);
          }
          paint();
          const st = root.querySelector('#mnState');
          if (st) st.textContent = dead ? '踩雷了' : (opened >= N * N - MINES ? '清完了' : '进行中');
        });
        board.appendChild(d);
      }
    }
    const tl = root.querySelector('#mnLeft');
    if (tl) tl.textContent = '雷 ' + left;
  };

  const fb = root.querySelector('#mnFlag');
  if (fb) fb.addEventListener('click', () => {
    flagMode = !flagMode;
    fb.classList.toggle('on', flagMode);
    fb.textContent = flagMode ? '开挖' : '插旗';
  });
  const nb = root.querySelector('#mnNew');
  if (nb) nb.addEventListener('click', () => { reset(); });

  reset();
}
