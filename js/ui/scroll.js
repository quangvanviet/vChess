/* vChess — cuộn nội dung dài: thanh cuộn mảnh + gợi ý "còn nội dung" tinh tế ở mọi khung có thể cuộn (PC và điện thoại).
   - Khung chữ thuần (chat, danh sách…): mép trên/dưới mờ dần khi còn nội dung.
   - Khung có viền/bóng (popup, tooltip, bảng HUD): nút mũi tên nhỏ nhấp nháy ở đáy, bấm để cuộn tiếp.
   - Popup có hàng nút (Hủy/Xác nhận): hàng nút luôn dính ở đáy, có bóng mờ khi còn nội dung phía dưới. */
(function () {
  'use strict';
  var SEL = '.modal-box,.tip-box,.hud-info,.hud-unit,.shop-panel,.dock-body,.lb-sheet-body,.room-list,.chat-log,.result-box,.tac-pop,.info-pop,.mp-main,.room-main,.lobby-main';
  var MASK = ['chat-log', 'room-list', 'lb-sheet-body', 'mp-main', 'dock-body', 'room-main', 'lobby-main'];
  var DOWN = '<svg viewBox="0 0 64 64" width="14" height="14" aria-hidden="true"><path d="M14 24l18 18 18-18" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function isMask(el) { for (var i = 0; i < MASK.length; i++) if (el.classList.contains(MASK[i])) return true; return false; }
  function scrollable(el) { var o = getComputedStyle(el).overflowY; return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 4; }
  function upd(el) {
    if (!el.isConnected) return;
    var v = '';
    if (el.offsetParent !== null || getComputedStyle(el).position === 'fixed') {
      if (scrollable(el)) { var st = el.scrollTop, ch = el.clientHeight, sh = el.scrollHeight; v = st < 4 ? 'top' : st + ch >= sh - 4 ? 'end' : 'mid'; }
    }
    if ((el.dataset.sc || '') !== v) { if (v) el.dataset.sc = v; else delete el.dataset.sc; }
    var btns = el.classList.contains('modal-box') ? el.querySelector(':scope > .btns') : null;
    if (btns) { btns.style.bottom = (-parseFloat(getComputedStyle(el).paddingBottom) || 0) + 'px'; return; }
    if (isMask(el)) return;
    var c = el.querySelector(':scope > .sc-cue'), want = v === 'top' || v === 'mid';
    if (want && !c) { c = document.createElement('div'); c.className = 'sc-cue'; c.innerHTML = '<span role="button" aria-label="Cuộn xuống">' + DOWN + '</span>'; c.firstChild.onclick = function (e) { e.stopPropagation(); el.scrollBy({ top: Math.max(60, el.clientHeight * .7), behavior: 'smooth' }); }; el.appendChild(c); }
    else if (!want && c) c.remove();
    else if (want && c && c !== el.lastElementChild) el.appendChild(c);
  }
  function wire(el) {
    if (el._scw) return; el._scw = 1;
    el.addEventListener('scroll', function () { if (!el._scr) { el._scr = 1; requestAnimationFrame(function () { el._scr = 0; upd(el); }); } }, { passive: true });
  }
  var pend = 0;
  function scan() { pend = 0; var list = document.querySelectorAll(SEL); for (var i = 0; i < list.length; i++) { wire(list[i]); upd(list[i]); } }
  function later() { if (!pend) pend = setTimeout(scan, 160); }
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t.classList && t.classList.contains('sc-cue')) continue; later(); return; }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', later);
  addEventListener('load', later);
})();

/* vChess — khung mô tả thu gọn / mở rộng (accordion): mỗi mô tả ban đầu chỉ 1 dòng có "…" ở cuối; bấm vào thì khung đó phóng ra đủ nội dung,
   các khung mô tả khác (và mục chứa chúng) mờ dần rồi gọn mất để nhường chỗ; bấm lại thì thu gọn và các khung kia hiện lại. Dùng: TT.Acc.bind(gốc, {key}) */
(function (G) {
  'use strict';
  var TT = G.TT = G.TT || {}, memo = {};
  var CHEV = '<svg viewBox="0 0 64 64" width="12" height="12" aria-hidden="true"><path d="M14 24l18 18 18-18" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function measure(a) {
    var b = a.querySelector('.acc-b'); if (!b) return;
    var wasC = a.classList.contains('clamp'); a.classList.remove('clamp'); b.style.maxHeight = 'none';
    var cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 12) * 1.4, full = b.scrollHeight, ch = Math.round(lh + 1);
    b.style.maxHeight = ''; if (wasC) a.classList.add('clamp');
    a.style.setProperty('--ch', ch + 'px'); a.style.setProperty('--fh', full + 'px');
    var short = full <= ch + 3 || a._flat; a.classList.toggle('short', short); if (short) a.classList.remove('clamp');
  }
  // ẩn / hiện một khối (mờ dần + gập chiều cao)
  function away(el, on) {
    if (!el || el.classList.contains('acc-away') === on) return;
    clearTimeout(el._at);
    if (on) { el.style.maxHeight = el.offsetHeight + 'px'; void el.offsetWidth; el.classList.add('acc-away'); }
    else { el.classList.remove('acc-away'); el.style.maxHeight = el.scrollHeight + 'px'; el._at = setTimeout(function () { el.style.maxHeight = ''; }, 420); }
  }
  /* chỉ thu gọn khi nội dung của popup/khung chứa vượt quá khung nhìn; còn vừa thì hiện đủ nội dung */
  function tight(root) {
    var el = root, r;
    while (el && el !== document.body && el.nodeType === 1) {
      var oy = getComputedStyle(el).overflowY;
      if (oy !== 'visible' && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) return true;
      el = el.parentElement;
    }
    if (root.querySelectorAll) { var all = root.querySelectorAll('*'); for (var q = 0; q < all.length; q++) { var d = all[q]; if (d.clientHeight > 40 && d.scrollHeight > d.clientHeight + 6) { var oy2 = getComputedStyle(d).overflowY; if (oy2 === 'auto' || oy2 === 'scroll') return true; } } }
    var m = root.closest ? (root.closest('#modal-box') || root.closest('.gi') || root) : root;
    r = m.getBoundingClientRect(); return r.bottom > (G.innerHeight || 800) - 2 || r.top < -2;
  }
  var bound = [];
  function decide(root, items, first) {
    items.forEach(function (a) { a._flat = false; a.classList.remove('clamp', 'short'); a.style.maxHeight = ''; var b = a.querySelector('.acc-b'); if (b) b.style.maxHeight = 'none'; a.style.setProperty('--fh', ''); });
    var t = tight(root);
    items.forEach(function (a) { a._flat = !t; if (!t) { a.classList.remove('open', 'clamp', 'hide'); a.classList.add('short'); } else if (!a.classList.contains('open')) { a.classList.add('clamp'); } measure(a); });
    return t;
  }
  addEventListener('resize', function () {
    clearTimeout(bound._t); bound._t = setTimeout(function () {
      bound = bound.filter(function (b) { return document.body.contains(b.root); });
      bound.forEach(function (b) { if (!b.items.some(function (x) { return x.classList.contains('open'); })) decide(b.root, b.items); });
    }, 200);
  });
  function bind(root, o) {
    root = root || document; o = o || {};
    var items = [].slice.call(root.querySelectorAll('.acc'));
    var holders = [];
    items.forEach(function (a) { var h = a.closest('.sp-sec, .rp-desc, .mp-sk-wrap'); a._h = h || null; if (h && holders.indexOf(h) < 0) holders.push(h); });
    function focus(open, instant) {
      items.forEach(function (x) { if (x === open) { x.classList.remove('hide'); } else x.classList.toggle('hide', !!open); });
      holders.forEach(function (h) { var has = open && h.contains(open); if (instant) { h.classList.toggle('acc-away', !!open && !has); h.style.maxHeight = ''; } else away(h, !!open && !has); });
      root.classList.toggle('acc-focus', !!open);
    }
    items.forEach(function (a, i) {
      if (!a.querySelector('.acc-c')) { var c = document.createElement('i'); c.className = 'acc-c'; c.innerHTML = CHEV; a.appendChild(c); }
      measure(a);
      a.onclick = function (e) {
        if (e.target.closest('button, a, input')) return;
        if (a.classList.contains('short')) return;
        var was = a.classList.contains('open');
        measure(a);
        items.forEach(function (x) { if (x !== a && x.classList.contains('open')) { x.classList.remove('open'); clearTimeout(x._ct); x._ct = setTimeout(function () { x.classList.add('clamp'); }, 380); } });
        if (was) { a.classList.remove('open'); clearTimeout(a._ct); a._ct = setTimeout(function () { a.classList.add('clamp'); }, 380); focus(null); }
        else { clearTimeout(a._ct); a.classList.remove('clamp'); void a.offsetWidth; a.classList.add('open'); focus(a); }
        if (o.key) memo[o.key] = was ? -1 : i;
      };
      if (o.key && memo[o.key] === i && !a.classList.contains('short')) { a.classList.remove('clamp'); a.classList.add('open', 'settled'); setTimeout(function () { a.classList.remove('settled'); }, 60); a._restore = 1; }
    });
    var op = items.filter(function (x) { return x._restore; })[0];
    bound.push({ root: root, items: items });
    var lay = function () { var openI = items.filter(function (x) { return x.classList.contains('open'); }); if (!openI.length) decide(root, items); };
    if (!op) lay();
    else { var t0 = tight(root); if (!t0) { items.forEach(function (x) { x.classList.remove('open', 'settled'); }); focus(null, true); lay(); } else focus(op, true); }
    [60, 220, 600, 1300].forEach(function (ms) { setTimeout(function () { if (!document.body.contains(root)) return; if (!items.some(function (x) { return x.classList.contains('open'); })) decide(root, items); }, ms); });
    if (G.document && document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (document.body.contains(root) && !items.some(function (x) { return x.classList.contains('open'); })) decide(root, items); });
  }
  TT.Acc = { tight: tight, bind: bind, wrap: function (html, lines, cls) { return '<div class="acc ' + (cls || '') + '"><div class="acc-b">' + html + '</div></div>'; } };
})(window);
