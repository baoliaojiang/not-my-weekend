/* =========================================================
   更新日志配图
   ---------------------------------------------------------
   两处更新日志（游戏里的更新页面、首页的更新日志入口）
   都要能看图，所以渲染函数单独放一个文件，两边共用。

   样式参照微信的更新公告：图**插在正文条目中间**，
   说到哪一步就贴哪张图，而不是在下面单开一块放图。
   所以条目分两种：
     · { type, text }              文字说明
     · { type:'shot', src, cap }   一张图

   图片加载不出来时不能留一个破图占位，
   所以用 onerror 把整块藏掉。
   ========================================================= */

/** 转义，避免 caption 里出现尖括号时破坏 HTML */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 渲染单张配图。
 * shot: { src, cap, gif }
 */
export function shotHTML(shot) {
  if (!shot || !shot.src) return '';
  const isGif = !!shot.gif || /\.gif$/i.test(shot.src);
  return `<figure class="clog-shot${isGif ? ' is-gif' : ''}">
    <img src="${esc(shot.src)}" alt="${esc(shot.cap || '')}" loading="lazy"
         onerror="this.closest('.clog-shot')&amp;&amp;this.closest('.clog-shot').remove()" />
    ${shot.cap ? `<figcaption>${esc(shot.cap)}</figcaption>` : ''}
  </figure>`;
}

/**
 * 渲染一组配图（给更新弹窗那种没有分节的地方用）。
 * shots: [{ src, cap, gif }]
 */
export function shotsHTML(shots) {
  if (!shots || !shots.length) return '';
  const items = shots.map(shotHTML).join('');
  return `<div class="clog-shots">${items}</div>`;
}

/**
 * 渲染一整版的分节内容，图片按原位置混在条目中间。
 * sections: [{ title, items: [...] }]
 * renderItem(item, index) → 条目的 HTML（由调用方决定文字条目的样式）
 */
export function sectionItemsHTML(sections, renderItem) {
  if (!sections || !sections.length) return '';
  return sections.map(sec => `
    <div class="clog-sec">
      <h4 class="clog-sec-t">${esc(sec.title)}</h4>
      ${(sec.items || []).map((it, i) => {
        if (it && it.type === 'shot') return shotHTML(it);
        return renderItem(it, i);
      }).join('')}
    </div>`).join('');
}

/** 取一版里所有的图（更新弹窗用） */
export function collectShots(entry) {
  const out = [];
  for (const sec of (entry && entry.sections) || []) {
    for (const it of sec.items || []) {
      if (it && it.type === 'shot' && it.src) out.push(it);
    }
  }
  return out;
}
