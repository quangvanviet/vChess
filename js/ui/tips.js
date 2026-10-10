/* vChess — tooltip chung cho sảnh/phòng/menu: thay chú thích gốc (title) bằng khung gọn, hiện sau 0,5 giây (chỉ chuột, bỏ qua cảm ứng). */
(function () {
  'use strict';
  var box = null, timer = 0, cur = null, DELAY = 500;
  function ensure() { if (box) return box; box = document.createElement('div'); box.className = 'tip-box gtip hidden'; box.style.zIndex = 9999; document.body.appendChild(box); return box; }
  function hide() { if (timer) { clearTimeout(timer); timer = 0; } if (box) box.classList.add('hidden'); if (cur) { if (cur._tt != null && !cur.getAttribute('title')) cur.setAttribute('title', cur._tt); cur._tt = null; cur = null; } }
  function place(x, y) {
    var b = box, w = b.offsetWidth, h = b.offsetHeight, vw = innerWidth, vh = innerHeight;
    var px = Math.min(Math.max(8, x + 14), vw - w - 8), py = y + 18; if (py + h > vh - 8) py = Math.max(8, y - h - 14);
    b.style.left = Math.round(px) + 'px'; b.style.top = Math.round(py) + 'px';
  }
  var lx = 0, ly = 0, touchAt = 0;
  document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') touchAt = Date.now(); hide(); }, true);
  document.addEventListener('mouseover', function (e) {
    if (Date.now() - touchAt < 800) return;
    var el = e.target.closest ? e.target.closest('[title]') : null;
    if (el === cur) return;
    hide();
    if (!el || el.closest('[data-tf]') || el.closest('#tip-box')) return;
    var t = el.getAttribute('title'); if (!t) return;
    cur = el; el._tt = t; el.removeAttribute('title'); lx = e.clientX; ly = e.clientY;
    timer = setTimeout(function () { timer = 0; if (!cur) return; var b = ensure(); b.textContent = t; b.classList.remove('hidden'); place(lx, ly); }, DELAY);
  }, true);
  document.addEventListener('mousemove', function (e) { lx = e.clientX; ly = e.clientY; if (box && cur && !box.classList.contains('hidden')) place(lx, ly); }, true);
  document.addEventListener('mouseout', function (e) { if (cur && !cur.contains(e.relatedTarget)) hide(); }, true);
  window.addEventListener('blur', hide);
})();
