/* =========================================================
   兼容版补丁（只打进「兼容版 APK」）
   ---------------------------------------------------------
   用途：让内核较老的系统 WebView（Chrome 60–80 区间，常见于
   安卓 7/8/9 且长期没更新过 WebView 的设备）也能把游戏跑起来。

   这一层只做两件事：
     1 补上代码里用到、老内核却没有的 API；
     2 给 Element.animate 一个降级实现，让开场淡入淡出仍然成立。
   它不改游戏逻辑，也不改存档格式——开关前后存档互通。
   ========================================================= */
(function () {
  'use strict';

  var W = window;

  /* ---------- 1. 基础 API 补齐 ---------- */

  // Promise.finally：更新检查里用了
  if (W.Promise && !W.Promise.prototype['finally']) {
    W.Promise.prototype['finally'] = function (cb) {
      var P = this.constructor;
      return this.then(
        function (v) { return P.resolve(cb && cb()).then(function () { return v; }); },
        function (e) { return P.resolve(cb && cb()).then(function () { throw e; }); }
      );
    };
  }

  // Element.closest / replaceWith / after：UI 里大量用
  if (W.Element && !W.Element.prototype.closest) {
    W.Element.prototype.closest = function (sel) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches ? el.matches(sel) : el.msMatchesSelector && el.msMatchesSelector(sel)) return el;
        el = el.parentElement || el.parentNode;
      }
      return null;
    };
  }
  if (W.Element && !W.Element.prototype.replaceWith) {
    W.Element.prototype.replaceWith = function () {
      var parent = this.parentNode;
      if (!parent) return;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < arguments.length; i++) {
        var n = arguments[i];
        frag.appendChild(n && n.nodeType ? n : document.createTextNode(String(n)));
      }
      parent.replaceChild(frag, this);
    };
  }
  if (W.Element && !W.Element.prototype.after) {
    W.Element.prototype.after = function () {
      var parent = this.parentNode;
      if (!parent) return;
      var next = this.nextSibling;
      for (var i = 0; i < arguments.length; i++) {
        var n = arguments[i];
        parent.insertBefore(n && n.nodeType ? n : document.createTextNode(String(n)), next);
      }
    };
  }

  // NodeList.forEach
  if (W.NodeList && !W.NodeList.prototype.forEach) {
    W.NodeList.prototype.forEach = Array.prototype.forEach;
  }

  // Object.assign / entries / values
  if (!W.Object.assign) {
    W.Object.assign = function (t) {
      for (var i = 1; i < arguments.length; i++) {
        var s = arguments[i];
        if (!s) continue;
        for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
      }
      return t;
    };
  }
  if (!W.Object.entries) {
    W.Object.entries = function (o) {
      var r = [];
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r.push([k, o[k]]);
      return r;
    };
  }
  if (!W.Object.values) {
    W.Object.values = function (o) { return W.Object.entries(o).map(function (p) { return p[1]; }); };
  }

  // String.padStart：时间戳里用了
  if (!W.String.prototype.padStart) {
    W.String.prototype.padStart = function (len, pad) {
      var s = String(this);
      pad = pad === undefined ? ' ' : String(pad);
      while (s.length < len) s = pad + s;
      return s.length > len ? s.slice(s.length - len) : s;
    };
  }

  // Array.from / includes
  if (!W.Array.from) {
    W.Array.from = function (obj, fn) {
      var out = [];
      if (!obj) return out;
      if (typeof obj.length === 'number') {
        for (var i = 0; i < obj.length; i++) out.push(fn ? fn(obj[i], i) : obj[i]);
      } else {
        for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) out.push(fn ? fn(obj[k], k) : obj[k]);
      }
      return out;
    };
  }
  if (!W.Array.prototype.includes) {
    W.Array.prototype.includes = function (v) { return this.indexOf(v) !== -1; };
  }

  /* Web Animations API：启动序列的淡入淡出完全靠它。
     老内核没有 element.animate，降级成"设初值 → 下一帧设终值"，
     配合 CSS transition 就能得到同样的淡出淡入，而不是直接跳变。 */
  if (W.Element && !W.Element.prototype.animate) {
    W.Element.prototype.animate = function (frames, opts) {
      var el = this;
      var o = typeof opts === 'number' ? { duration: opts } : (opts || {});
      var dur = o.duration || 300;
      var first = (frames && frames[0]) || {};
      var last = (frames && frames[frames.length - 1]) || {};
      var done = false;

      function apply(style, frame) {
        for (var k in frame) {
          if (k === 'offset' || k === 'easing') continue;
          var v = frame[k];
          if (k === 'opacity') style.opacity = v;
          else if (k === 'transform') style.transform = v;
          else if (k === 'filter') style.filter = v;
          else if (k === 'backgroundColor') style.backgroundColor = v;
        }
      }

      el.style.transition = 'none';
      apply(el.style, first);
      void el.offsetWidth;
      el.style.transition = 'opacity ' + dur + 'ms ease, transform ' + dur + 'ms ease, filter ' + dur + 'ms ease';

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { apply(el.style, last); });
      });

      var finished = new W.Promise(function (resolve) {
        setTimeout(function () {
          if (done) return;
          done = true;
          resolve();
        }, dur + 30);
      });

      return {
        finished: finished,
        onfinish: null,
        cancel: function () {
          done = true;
          el.style.transition = '';
          finished.then && finished.then(function () {});
        }
      };
    };
  }

  /* 标记：让 CSS 与日志知道现在跑在兼容层上 */
  W.__COMPAT = true;
  document.documentElement.className += ' is-compat';

  /* ---------- 2. 兜底：别让一处缺失就把整个游戏卡死 ---------- */

  // 有些老内核会在 requestAnimationFrame 里抛错，导致动画整条断掉
  if (W.requestAnimationFrame) {
    var raf = W.requestAnimationFrame;
    W.requestAnimationFrame = function (cb) {
      return raf.call(W, function (t) {
        try { cb(t); } catch (e) { /* 单帧出错丢掉，不影响后续 */ }
      });
    };
  }

  // 日志里带一句，反馈时一眼看出是不是在兼容版上跑
  try {
    console.log('[compat] 兼容层已加载 · UA=' + navigator.userAgent.slice(0, 120));
  } catch (e) { /* 忽略 */ }
})();
