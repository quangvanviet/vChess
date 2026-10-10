/* vChess — Hướng dẫn tân thủ từng bước (coach marks): làm mờ màn hình, khoanh sáng chỗ cần bấm, bong bóng lời dẫn,
   tự sang bước khi người chơi làm đúng. Chạy trong một ván thật 1 đấu 1 với Bot Dễ, thời gian chuẩn bị không giới hạn.
   Kịch bản: STEPS (mỗi bước: ch = bài, title, text, target, wait/next, enter, skipIf, dim, block, place). */
(function (G) {
  'use strict';
  var TT = G.TT, I = TT.Icons, P = TT.Prep;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var Tutor = TT.Tutor = {};
  var st = null;   // { i, timer, root, hole, bub, block }

  function S() { return TT.Game && TT.Game._s ? TT.Game._s() : null; }
  function me() { var s = S(); return s && s.P; }
  function now() { return TT.Net && TT.Net.B ? TT.Net.B.now() : Date.now(); }
  function gens(p) { return p ? p.squads.filter(function (q) { return !TT.ROLES[q.t].marshal; }) : []; }
  function mar(p) { return p ? p.squads.filter(function (q) { return TT.ROLES[q.t].marshal; })[0] : null; }
  function sq(t) { return gens(me()).filter(function (q) { return q.t === t; })[0]; }
  function vis(el) { if (!el) return null; var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null; return r; }
  function phase() { var s = S(); return s ? s.phase : ''; }
  function prep() { var s = S(); return s && s.phase === 'prep' && s.P && !s.committed; }
  /* điểm trên sân 3D → toạ độ màn hình */
  function fieldPt(x, y, h) {
    var s = S(), f = s && s.field; if (!f || !f.map || !f.cam || !G.THREE) return null;
    var v = new G.THREE.Vector3(f.wx(x), f.hAt(x, y) + (h || 0), f.wz(y)).project(f.cam), r = f.c.getBoundingClientRect();
    if (v.z > 1) return null;
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  function rectOfPts(pts, pad) {
    pts = pts.filter(Boolean); if (!pts.length) return null;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    pad = pad || 0; x0 = Math.max(4, x0 - pad); y0 = Math.max(4, y0 - pad); x1 = Math.min(innerWidth - 4, x1 + pad); y1 = Math.min(innerHeight - 4, y1 + pad);
    return { left: x0, top: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0), right: x1, bottom: y1 };
  }
  function zoneRect() {
    var s = S(); if (!s || !s.P) return null; var z = TT.zoneOf(s.M.mode, s.P.side);
    return rectOfPts([fieldPt(z.x0, z.y0), fieldPt(z.x1 + 1, z.y0), fieldPt(z.x0, z.y1 + 1), fieldPt(z.x1 + 1, z.y1 + 1)], 4);
  }
  /* dải đất phía trước vùng xuất quân (để cắm cờ) */
  function frontRect() {
    var s = S(); if (!s || !s.P) return null; var z = TT.zoneOf(s.M.mode, s.P.side), f = TT.sideFwd[s.P.side], D = 7, pts;
    if (f[1] < 0) pts = [[z.x0, z.y0 - D], [z.x1 + 1, z.y0 - D], [z.x0, z.y0], [z.x1 + 1, z.y0]];
    else if (f[1] > 0) pts = [[z.x0, z.y1 + 1], [z.x1 + 1, z.y1 + 1], [z.x0, z.y1 + 1 + D], [z.x1 + 1, z.y1 + 1 + D]];
    else if (f[0] > 0) pts = [[z.x1 + 1, z.y0], [z.x1 + 1 + D, z.y0], [z.x1 + 1, z.y1 + 1], [z.x1 + 1 + D, z.y1 + 1]];
    else pts = [[z.x0 - D, z.y0], [z.x0, z.y0], [z.x0 - D, z.y1 + 1], [z.x0, z.y1 + 1]];
    return rectOfPts(pts.map(function (p) { return fieldPt(p[0], p[1]); }), 4);
  }
  function unitRect(q) {
    var s = S(); if (!q || !s || !s.field) return null; var key = s.seat + ':' + q.id + ':0', r = s.field.unitScreenRect && s.field.unitScreenRect(key, 10);
    if (r) return r;
    var v = (s.field.vis || {})[key], g = v ? [v.x, v.y] : s.genPos && s.genPos[q.id]; if (!g) return null;
    var a = fieldPt(g[0], g[1], 0), b = fieldPt(g[0], g[1], 2.2); if (!a || !b) return null;
    var hh = Math.max(56, Math.abs(a.y - b.y) + 24);
    return { left: a.x - hh * .62, top: b.y - 14, width: hh * 1.24, height: hh + 22, right: a.x + hh * .62, bottom: a.y + 10 };
  }
  function actRect() {
    var bs = [].slice.call(document.querySelectorAll('#g-act .ga-b')).map(function (b) { return b.getBoundingClientRect(); }).filter(function (r) { return r.width > 4; });
    if (!bs.length) return null;
    var x0 = Math.min.apply(0, bs.map(function (r) { return r.left; })), x1 = Math.max.apply(0, bs.map(function (r) { return r.right; })), y0 = Math.min.apply(0, bs.map(function (r) { return r.top; })), y1 = Math.max.apply(0, bs.map(function (r) { return r.bottom; }));
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0, right: x1, bottom: y1 };
  }
  function unionRect(els) {
    var rs = els.map(function (e) { return e && vis(e); }).filter(Boolean); if (!rs.length) return null;
    var l = Math.min.apply(0, rs.map(function (r) { return r.left; })), t = Math.min.apply(0, rs.map(function (r) { return r.top; })), rr = Math.max.apply(0, rs.map(function (r) { return r.right; })), b = Math.max.apply(0, rs.map(function (r) { return r.bottom; }));
    return { left: l, top: t, width: rr - l, height: b - t, right: rr, bottom: b };
  }
  /* nút mua thêm lính: chỉ khoanh nút "+1 lính" và biểu tượng Lính (không gồm "+ Tối đa") */
  function addRect() { return unionRect([$('#gb-cards .sol-q.one'), $('#gb-cards .bcard.sol')]) || vis($('#gb-cards')); }
  /* kéo trang bị: ô đồ đầu tiên + tướng Lính trên sân */
  function equipRects() {
    var slot = vis($('#gb-inv .inv-slot.item')) || vis($('#gb-inv')), q = sq('linh') || gens(me())[0], u = q ? unitRect(q) : null;
    return [slot ? { r: slot } : null, u ? { r: u, field: true } : null].filter(Boolean);
  }
  function actUp() { var a = $('#g-act'); return !!a && !a.classList.contains('hidden'); }
  var IC = function (n) { return I.ui(n, 12); };

  /* ---------------- kịch bản ---------------- */
  var CH = ['', 'Làm quen', 'Đặt quân', 'Ra lệnh', 'Nguyên soái', 'Trang bị & Lõi', 'Kinh tế', 'Giao tranh', 'Ngày mới'];
  var STEPS = [
    { ch: 1, title: 'Chào mừng đến vChess!', place: 'center', block: true, next: 'Bắt đầu',
      text: 'Đây là trận luyện tập 1 đấu 1 với Bot. Mỗi ván có <b>10 ngày</b>, mỗi ngày gồm 2 phần:<br>' + IC('wand') + ' <b>Chuẩn bị</b>: mua quân, xếp đội hình, ra lệnh.<br>' + IC('swords') + ' <b>Giao tranh</b>: quân tự đánh, bạn chỉ xem.<br>Làm theo các bước, khoảng 5 phút là chơi được.' },
    { ch: 1, title: 'Thông tin ngày', target: '#day-banner', block: true, next: 'Tiếp',
      text: 'Ngày hiện tại, ban ngày/đêm, thời tiết và bản đồ. Rê chuột hoặc chạm vào từng mục để xem hiệu ứng (ví dụ mưa làm quân tầm xa đánh chậm hơn).' },
    { ch: 1, title: 'Thời gian chuẩn bị', target: '#phase-timer', block: true, next: 'Tiếp',
      text: 'Bình thường mỗi ngày có giới hạn thời gian chuẩn bị. Trong hướng dẫn này đồng hồ được tạm dừng, cứ thong thả.' },
    { ch: 1, title: 'Vàng, Đời và Dân số', target: '#gb-me', block: true, next: 'Tiếp',
      text: IC('coin') + ' <b>Vàng</b> dùng mua mọi thứ, mỗi ngày nhận thêm; để dư được <b>lãi</b>.<br>' + IC('star') + ' <b>Đời</b> (vòng tròn) mở khóa quân mạnh hơn và tăng sức chứa.<br>' + IC('worker') + ' <b>Dân số</b>: mỗi tướng/lính chiếm chỗ, không vượt quá sức chứa.<br>Trong hướng dẫn bạn được tặng <b>999 Vàng</b> để thoải mái thử mọi thứ.' },
    { ch: 1, title: 'Nguyên soái của bạn', target: function () { return unitRect(mar(me())); }, block: true, next: 'Tiếp',
      text: 'Nguyên soái đứng sẵn ở hàng sau và <b>tự triệu hồi lính</b> trong giao tranh. Hãy bảo vệ ông ấy: <b>Nguyên soái gục là thua ngày đó</b>.' },
    { ch: 1, title: 'Địa hình chiến trường', place: 'top', block: true, next: 'Tiếp',
      text: 'Địa hình ảnh hưởng trận đánh: <b>bụi rậm</b> che chắn đòn tầm xa, <b>đồi</b> giúp quân tầm xa bắn xa hơn, <b>sông và đầm</b> làm chậm.<br><b>Vách đá</b> chặn cả đường đi lẫn đường bắn; <b>tường thấp</b> chặn đường đi nhưng quân tầm xa vẫn bắn qua được. Trên máy tính, rê chuột lên ô đất để xem chi tiết; bảng đầy đủ có trong Bách khoa ở sảnh.' },
    { ch: 1, title: 'Điều khiển camera', target: '.cam-bar', place: 'auto', free: true, next: 'Tiếp',
      text: 'Camera đã tự lùi để thấy trọn <b>vùng xuất quân</b> của bạn. <b>Kéo</b> để dịch, <b>cuộn chuột / chụm hai ngón</b> để phóng to thu nhỏ, các nút này để xoay, nhìn từ trên xuống hoặc về mặc định. Khi giao tranh sẽ có thêm nút <b>Camera tự động</b>.' },
    { ch: 2, title: 'Mua tướng đầu tiên', target: '#gb-cards .bcard.gen[data-r="linh"]', place: 'auto',
      text: 'Mỗi <b>tướng</b> dẫn một đạo quân. Chạm thẻ <b>Lính</b> để vào <b>chế độ mua tướng</b> (chạm lại thẻ hoặc bấm nút khác để thoát), hoặc kéo thẻ thả xuống sân.',
      enter: function () { var s = S(); if (s && s.sel != null) { s.sel = null; s.tab = 'gen'; TT.Game._r(); } },
      wait: function () { var s = S(); return !!sq('linh') || (s && s.placeRole === 'linh'); } },
    { ch: 2, title: 'Đặt vào vùng xuất quân', target: zoneRect, field: true, place: 'top',
      text: 'Các bảng khác tạm trượt đi để bạn nhìn rõ sân. Chạm vào <b>ô trống</b> trong vùng xuất quân (khung viền sáng) để đặt tướng; chạm sai chỗ (đè lên quân khác) sẽ không đặt.', skipIf: function () { return !!sq('linh'); },
      wait: function () { return !!sq('linh'); } },
    { ch: 2, title: 'Thêm lính cho tướng', target: addRect, place: 'auto',
      text: 'Tướng đang được chọn, thanh dưới chuyển sang <b>Lính</b>. Bấm nút <b>+1 lính</b> (hoặc chạm biểu tượng Lính) <b>2 lần</b> để có thêm lính. Lính đứng quanh tướng và đánh cùng tướng. (Nút + Tối đa sẽ học sau.)',
      enter: function () { var s = S(), q = sq('linh'); if (s && q) { s.placeRole = null; if (s.sel !== q.id) { s.sel = q.id; s.tab = 'sol'; } TT.Game._r(); } },
      wait: function () { var q = sq('linh'); return q && q.n >= 3; }, skipIf: function () { var q = sq('linh'); return q && q.n >= 3; } },
    { ch: 2, title: 'Thêm Cung thủ ở phía sau', target: '#gb-cards .bcard.gen[data-r="cung"]', place: 'auto',
      text: 'Đội hình tốt có <b>tiền tuyến</b> chắn đòn và <b>hậu tuyến</b> bắn xa. Mua thêm tướng <b>Cung thủ</b> và đặt phía sau Lính.',
      enter: function () { var s = S(); if (s && !sq('cung')) { s.placeRole = null; s.sel = null; s.tab = 'gen'; TT.Game._r(); } },
      wait: function () { var s = S(); return !!sq('cung') || (s && s.placeRole === 'cung'); } },
    { ch: 2, title: 'Đặt Cung thủ phía sau', target: zoneRect, field: true, place: 'top',
      text: 'Chạm vào phần <b>phía sau</b> của vùng xuất quân, sau lưng đạo quân Lính.', skipIf: function () { return !!sq('cung'); },
      wait: function () { return !!sq('cung'); } },
    { ch: 3, title: 'Chọn một tướng', target: function () { return unitRect(sq('linh')); }, field: true, place: 'top',
      text: 'Rê chuột lên tướng khoảng nửa giây (hoặc chạm) để hiện <b>tên</b> và tướng sẽ quay mặt về phía bạn. Chạm vào <b>tướng Lính</b> để chọn: các nút tròn sẽ <b>xòe ra</b> quanh đầu tướng.',
      enter: function () { var s = S(), q = sq('linh'); if (s) { s.tac = null; s.flagMode = null; s.placeRole = null; s.moveSq = null; if (q && s.sel !== q.id) { s.sel = null; s.tab = 'gen'; } TT.Game._r(); } },
      wait: function () { var s = S(), q = sq('linh'); return s && q && s.sel === q.id && actUp(); } },
    { ch: 3, title: 'Menu lệnh của tướng', target: actRect, block: true, next: 'Tiếp',
      text: IC('move') + ' <b>Di chuyển</b> chỗ đứng · ' + IC('shield') + ' <b>Chiến thuật</b> · ' + IC('flag') + ' <b>Hành quân</b> (cắm cờ) · ' + IC('plus') + ' <b>Thêm lính</b>.<br>Bảng bên cạnh hiện chỉ số, kỹ năng và nội tại của tướng.' },
    { ch: 3, title: 'Mở Chiến thuật', target: '#g-act [data-a="st"]',
      text: 'Bấm nút <b>Chiến thuật</b>.', wait: function () { var s = S(); return s && !!s.tac; },
      skipIf: function () { var s = S(), q = sq('linh'); return !(s && q && s.sel === q.id); } },
    { ch: 3, title: 'Tư thế và đội hình', target: '#tac-pop', block: true, next: 'Tiếp',
      text: '<b>Tư thế</b>: Tấn công, Giữ vị trí, Săn hậu tuyến, Rút khi yếu.<br><b>Đội hình</b>: hình dạng lính quanh tướng (khối, hàng ngang, chữ V…) và vị trí của tướng trong đội.',
      skipIf: function () { var s = S(); return !(s && s.tac); } },
    { ch: 3, title: 'Cắm cờ hành quân', target: '#g-act [data-a="flag"]',
      text: 'Đóng bảng Chiến thuật rồi bấm <b>Hành quân</b> để chỉ đường cho đạo quân.',
      enter: function () { var s = S(); if (s && s.tac) { s.tac = null; TT.Game._r(); } },
      wait: function () { var s = S(); return s && !!s.flagMode; },
      skipIf: function () { var s = S(), q = sq('linh'); return !(s && q) || q.fl.length > 0; } },
    { ch: 3, title: 'Cắm cờ lên bản đồ', target: frontRect, field: true, place: 'top',
      text: 'Loại cờ phụ thuộc chỗ bạn chạm:<br>' + IC('flag') + ' <b>Mặt đất</b>: Cờ Đỏ, tiến tới và đánh địch gặp trên đường.<br>' + IC('flag') + ' <b>Tướng của bạn</b>: Cờ Vàng, đi hộ tống đạo quân đó.<br>' + IC('flag') + ' <b>Quân địch</b>: Cờ Tím, dồn lực diệt đạo quân đó.<br>Chạm lên <b>mặt đất phía trước</b> để cắm 1 Cờ Đỏ. Chạm lại cờ để đổi sang Cờ Xanh (đi thẳng không dừng) hoặc xóa.',
      wait: function () { var s = S(), q = sq('linh'); return (q && q.fl.length > 0) || (s && !s.flagMode); }, skipIf: function () { var q = sq('linh'); return !q || q.fl.length > 0; } },
    { ch: 3, title: 'Xong cắm cờ', target: '#fb-done',
      text: 'Đường hành quân đã hiện trên bản đồ. Bấm nút <b>X</b> để xong. (Không cắm cờ thì quân tự tìm địch gần nhất.)',
      wait: function () { var s = S(); return s && !s.flagMode; }, skipIf: function () { var s = S(); return !(s && s.flagMode); } },
    { ch: 4, title: 'Chọn Nguyên soái', target: function () { return unitRect(mar(me())); }, field: true, place: 'top',
      text: 'Chạm vào <b>Nguyên soái</b> ở hàng sau.',
      enter: function () { var s = S(), m = mar(me()); if (s) { s.flagMode = null; s.tac = null; s.moveSq = null; if (m && s.sel !== m.id) { s.sel = null; s.tab = 'gen'; } TT.Game._r(); } },
      wait: function () { var s = S(), m = mar(me()); return s && m && s.sel === m.id; } },
    { ch: 4, title: 'Chọn lính để triệu hồi', target: '#gb-cards', place: 'auto', next: 'Tiếp',
      text: 'Nguyên soái không mua lính mà <b>triệu hồi</b>: giây thứ 3 gọi đợt đầu, sau đó cứ vài giây lại gọi thêm, không giới hạn. Chọn loại lính muốn triệu hồi ở đây (quân mạnh thì hồi lâu hơn).' },
    { ch: 5, title: 'Đeo trang bị', targets: equipRects, link: true, place: 'auto', alsoField: true,
      text: 'Bạn có sẵn 1 <b>trang bị khởi đầu</b> trong tủ đồ (ô sáng). <b>Kéo</b> nó thả lên <b>tướng Lính</b> (khung sáng trên sân), hoặc chạm trang bị rồi chạm vào tướng. Mỗi tướng đeo tối đa 3 món.',
      enter: function () { var s = S(); if (s && s.sel != null) { s.sel = null; s.tab = 'gen'; TT.Game._r(); } },
      wait: function () { return gens(me()).some(function (q) { return q.it.length > 0; }) || (me() && !me().inv.length); } },
    { ch: 5, title: 'Lõi nâng cấp', target: '#gb-tabs [data-t="core"]',
      text: 'Bấm tab <b>Lõi</b>.', enter: function () { var s = S(); if (s && s.sel != null) { s.sel = null; TT.Game._r(); } },
      wait: function () { var s = S(); return s && s.tab === 'core'; } },
    { ch: 5, title: 'Mua một Lõi', target: '#gb-cards', place: 'auto', next: 'Bỏ qua',
      text: '<b>Lõi</b> tăng sức mạnh cho cả quân hoặc một loại quân, có hiệu lực khi nằm trong tủ đồ. Bán lại được bằng giá mua (Lõi kinh tế chỉ hoàn nửa giá). Thử mua một Lõi bạn thích.',
      wait: function () { var p = me(); return p && p.cores.length > 0; } },
    { ch: 6, title: 'Lên Đời và mua dân', target: '#gb-me', block: true, next: 'Tiếp',
      text: IC('star') + ' <b>Lên Đời</b>: mua EXP để mở quân mạnh hơn (Kỵ binh, Pháp sư, Tượng binh…), trang bị bậc cao và thêm sức chứa. Mỗi ngày tự nhận thêm EXP.<br>' + IC('worker') + ' <b>Mua dân</b>: thêm sức chứa ngay (giá tăng dần).<br>Để dư mỗi 10 Vàng được thêm 1 Vàng lãi mỗi ngày.' },
    { ch: 7, title: 'Sẵn sàng!', target: '#btn-go',
      text: 'Khi xếp xong, bấm <b>Sẵn sàng</b>. Mọi người chuẩn bị cùng lúc, không ai thấy đội hình của nhau cho tới khi giao tranh.',
      enter: function () { var s = S(); if (s) { s.sel = null; s.tab = 'gen'; s.flagMode = null; s.tac = null; TT.Game._r(); } },
      wait: function () { var s = S(); return s && (s.committed || s.phase === 'locked' || s.phase === 'battle'); } },
    { ch: 7, title: 'Giao tranh tự động', target: '#battle-ctrl', place: 'auto', next: 'Tiếp', dim: false,
      text: 'Quân tự di chuyển, đánh và dùng kỹ năng. Tên và thanh máu của tướng nằm dưới chân đội hình. <b>Camera tự động</b> (nút phim đỏ) sẽ quay cận đội quân của bạn rồi lùi ra xem toàn cảnh; kéo tay là bạn tự lái ngay. Bạn cũng có thể <b>tăng tốc</b> hoặc <b>bỏ qua</b>.',
      wait0: function () { return phase() === 'battle'; } },
    { ch: 7, title: 'Kết quả ngày', target: '#result-overlay .result-box', place: 'auto', next: 'Tiếp', block: true,
      text: 'Xếp hạng trong ngày cho <b>điểm hạng</b>, hạ gục quân địch cho thêm <b>điểm hạ gục</b>. Sau 10 ngày, ai nhiều điểm nhất thắng. Ngày cuối (Chung kết) điểm hạng ×1.5.',
      wait0: function () { var s = S(); return s && (s.phase === 'result' || s.phase === 'over-wait') && !!vis($('#result-overlay')); } },
    { ch: 8, title: 'Ngày mới', target: '#gb-me', block: true, next: 'Tiếp',
      text: 'Đầu mỗi ngày bạn nhận Vàng mới, lãi và EXP. Đội hình hôm trước <b>được giữ nguyên</b>, bạn chỉ cần bổ sung và điều chỉnh.',
      wait0: function () { var s = S(); return s && s.M.day >= 2 && s.phase === 'prep'; } },
    { ch: 8, title: 'Cửa hàng trang bị', target: '#gb-tabs [data-t="item"]',
      text: 'Bấm tab <b>Trang bị</b>: mỗi ngày cửa hàng bày món mới, bậc cao xuất hiện nhiều hơn khi lên Đời. Bấm Đổi để làm mới cửa hàng.',
      enter: function () { var s = S(); if (s && s.sel != null) { s.sel = null; TT.Game._r(); } },
      wait: function () { var s = S(); return s && s.tab === 'item'; } },
    { ch: 8, title: 'Lịch 10 ngày', place: 'center', block: true, next: 'Tiếp',
      text: IC('skull') + ' Ngày 3, 6, 9: <b>Săn quái</b> (quái trung lập giữa bản đồ, hạ được thưởng Vàng).<br>' + IC('star') + ' Ngày 5 và 8: <b>Sự kiện</b> ngẫu nhiên.<br>' + IC('trophy') + ' Ngày 10: <b>Chung kết</b>.<br>Bảng điểm ở góc màn hình cho biết ai đang dẫn đầu.' },
    { ch: 8, title: 'Bạn đã sẵn sàng!', place: 'center', block: true, next: 'Hoàn thành', final: true,
      text: 'Bạn đã nắm đủ để tự chơi. Mẹo: thử các tộc và Nguyên soái khác nhau, đọc kỹ kỹ năng tướng, và dùng cờ để tránh bị đánh lẻ. Bạn có thể chơi tiếp ván này đến hết 10 ngày.' }
  ];

  /* ---------------- giao diện ---------------- */
  var ARW = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 60 8 30h14V4h20v26h14z" fill="#ffcf33" stroke="#8a5300" stroke-width="4" stroke-linejoin="round"/><path d="M28 10h8v24h9L32 50 19 34h9z" fill="#fff6bf" opacity=".55"/></svg>';
  function build() {
    var root = document.createElement('div'); root.id = 'tut'; root.className = 'tut';
    root.innerHTML = '<div class="tut-block hidden"></div><div class="tut-hole hidden"></div><svg class="tut-link hidden" aria-hidden="true"></svg><div class="tut-arw hidden">' + ARW + '</div><div class="tut-bub" role="dialog" aria-live="polite"><div class="tut-top"><span class="tut-ch"></span><span class="tut-pg"></span></div><b class="tut-t"></b><div class="tut-x"></div><div class="tut-f"><button type="button" class="tut-skip">Bỏ qua hướng dẫn</button><span class="tut-wait"></span><button type="button" class="btn gold tut-next"></button></div></div>';
    document.body.appendChild(root);
    root.querySelector('.tut-skip').onclick = function () { TT.App.confirm('Bỏ qua hướng dẫn?', 'Ván luyện tập với Bot vẫn tiếp tục. Bạn có thể mở lại hướng dẫn ở sảnh bất cứ lúc nào.', 'Bỏ qua').then(function (ok) { if (ok) finish(true); }); };
    root.querySelector('.tut-next').onclick = function () { var sp = STEPS[st.i]; if (sp.final) { finish(false); return; } go(st.i + 1); };
    return root;
  }
  function targetRect(sp) {
    if (!sp.target) return null;
    if (typeof sp.target === 'function') { var r = sp.target(); return r && r.nodeType ? vis(r) : r; }
    return vis($(sp.target));
  }
  function rectsOf(sp) {
    if (sp.targets) { try { return sp.targets(); } catch (e) { return []; } }
    var r = targetRect(sp); return r ? [{ r: r, field: !!sp.field }] : [];
  }
  function render() {
    if (!st) return;
    var sp = STEPS[st.i], root = st.root, hole = root.querySelector('.tut-hole'), bub = root.querySelector('.tut-bub'), blk = root.querySelector('.tut-block'), arw = root.querySelector('.tut-arw');
    var rs = rectsOf(sp), r = rs[0] && rs[0].r, dim = sp.dim !== false, has = !!(r && r.width > 0);
    syncExtras(root, sp, rs, dim);
    // chỉ khoanh sáng đúng vùng cần thao tác; vùng trên sân (ô đất, tướng) có viền nét đứt + nền nhấp nháy cho nổi bật
    if (has) {
      var pad = sp.field ? 2 : 5; hole.classList.remove('hidden'); hole.classList.toggle('nodim', !dim); hole.classList.toggle('field', !!sp.field);
      hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px'; hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
    } else { hole.classList.add('hidden'); }
    root.classList.toggle('dimall', dim && !has && sp.place === 'center');
    blk.classList.toggle('hidden', !sp.block);
    if (bub._i !== st.i) {
      bub._i = st.i;
      bub.querySelector('.tut-ch').textContent = 'Bài ' + sp.ch + ' · ' + CH[sp.ch];
      bub.querySelector('.tut-pg').textContent = (st.i + 1) + '/' + STEPS.length;
      bub.querySelector('.tut-t').textContent = sp.title;
      bub.querySelector('.tut-x').innerHTML = sp.text;
      var nb = bub.querySelector('.tut-next'); nb.textContent = sp.next || ''; nb.classList.toggle('hidden', !sp.next);
      bub.querySelector('.tut-wait').innerHTML = sp.next ? '' : '<i class="tut-dot"></i>Làm theo hướng dẫn';
      bub.querySelector('.tut-skip').classList.toggle('hidden', !!sp.final);
      bub.classList.remove('in'); void bub.offsetWidth; bub.classList.add('in');
      bub._pos = null;
    }
    place(bub, has ? r : null, sp);
    // mũi tên nhấp nhô chỉ thẳng vào chỗ cần bấm (bước cần thao tác)
    if (has && !sp.block) pointAt(arw, r, bub); else arw.classList.add('hidden');
  }
  /* khung sáng phụ (bước cần chỉ nhiều chỗ, vd kéo trang bị vào tướng) + đường nối có chấm chạy */
  function syncExtras(root, sp, rs, dim) {
    var xs = [].slice.call(root.querySelectorAll('.tut-hole.xtra')), n = Math.max(0, rs.length - 1), i;
    while (xs.length < n) { var d = document.createElement('div'); d.className = 'tut-hole xtra nodim'; root.insertBefore(d, root.querySelector('.tut-arw')); xs.push(d); }
    xs.forEach(function (d, k) {
      var it = rs[k + 1]; if (!it) { d.classList.add('hidden'); return; }
      var pad = it.field ? 2 : 5, rr = it.r; d.classList.remove('hidden'); d.classList.toggle('field', !!it.field);
      d.style.left = (rr.left - pad) + 'px'; d.style.top = (rr.top - pad) + 'px'; d.style.width = (rr.width + pad * 2) + 'px'; d.style.height = (rr.height + pad * 2) + 'px';
    });
    var lk = root.querySelector('.tut-link');
    if (sp.link && rs.length > 1) {
      var a = rs[0].r, b = rs[1].r, x1 = a.left + a.width / 2, y1 = a.top + a.height / 2, x2 = b.left + b.width / 2, y2 = b.top + b.height * .7;
      lk.classList.remove('hidden'); lk.setAttribute('viewBox', '0 0 ' + innerWidth + ' ' + innerHeight);
      lk.innerHTML = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="tl-l"/><circle r="7" class="tl-d"><animateMotion dur="1.6s" repeatCount="indefinite" path="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '"/></circle>';
    } else if (lk) lk.classList.add('hidden');
  }
  function inter(a, b) { var x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); return x * y; }
  function hudTop(x, bw) { var y = 10, H = innerHeight; ['#day-banner', '#prep-ctrl', '#battle-ctrl', '#g-mode', '.top-ctrl'].forEach(function (q) { var rr = vis($(q)); if (rr && rr.left < x + bw && rr.right > x && rr.bottom < H * .45) y = Math.max(y, rr.bottom + 10); }); return y; }
  /* bong bóng tự chọn chỗ: không che vùng cần thao tác, né con trỏ chuột, không ra khỏi màn hình */
  function place(bub, r, sp) {
    var W = innerWidth, H = innerHeight, bw = bub.offsetWidth, bh = bub.offsetHeight, m = 8, gap = 18, cands = [];
    var clampC = function (x, y) { return { x: Math.max(m, Math.min(W - bw - m, x)), y: Math.max(m, Math.min(H - bh - m, y)) }; };
    var cx0 = (W - bw) / 2;
    if (r) {
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (sp.place === 'top') cands.push(clampC(cx0, hudTop(cx0, bw)));
      cands.push(clampC(cx - bw / 2, r.bottom + gap), clampC(cx - bw / 2, r.top - bh - gap), clampC(r.right + gap, cy - bh / 2), clampC(r.left - bw - gap, cy - bh / 2));
      cands.push(clampC(cx0, hudTop(cx0, bw)), clampC(cx0, H - bh - 12), clampC(m, hudTop(m, bw)), clampC(W - bw - m, hudTop(W - bw - m, bw)), clampC(m, H - bh - 12), clampC(W - bw - m, H - bh - 12));
    } else cands.push(clampC(cx0, sp.place === 'center' ? (H - bh) / 2 : H - bh - 16), clampC(cx0, hudTop(cx0, bw)));
    var av = sp.next == null ? st.avoid : null, mouse = av ? { left: av.x - 40, right: av.x + 40, top: av.y - 40, bottom: av.y + 40 } : null;
    var tgt = r ? { left: r.left - 6, right: r.right + 6, top: r.top - 6, bottom: r.bottom + 6 } : null;
    var best = null, bs = 1e18;
    cands.forEach(function (c, i) {
      var box = { left: c.x, right: c.x + bw, top: c.y, bottom: c.y + bh };
      var sc = i * 10 + (tgt ? inter(box, tgt) * 50 : 0) + (mouse ? inter(box, mouse) * 80 : 0);
      if (bub._pos && Math.abs(bub._pos.x - c.x) < 2 && Math.abs(bub._pos.y - c.y) < 2) sc -= 25;   // giữ chỗ cũ nếu vẫn tốt (đỡ nhảy lung tung)
      if (sc < bs) { bs = sc; best = c; }
    });
    bub._pos = best;
    bub.style.left = Math.round(best.x) + 'px'; bub.style.top = Math.round(best.y) + 'px';
  }
  function pointAt(arw, r, bub) {
    var W = innerWidth, H = innerHeight, b = bub.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, s = r.width > 160 || r.height > 120 ? 44 : 36, dir;
    // mũi tên đặt ở phía có chỗ trống và không trùng bong bóng
    var opts = [['d', cx, r.top - s - 4], ['u', cx, r.bottom + 4], ['r', r.left - s - 4, cy], ['l', r.right + 4, cy]];
    if (r.width > 220 && r.height > 120) opts.unshift(['d', cx, cy - s / 2]);   // vùng lớn (khu xuất quân): chỉ vào giữa vùng
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i], x = o[0] === 'd' || o[0] === 'u' ? o[1] - s / 2 : o[1], y = o[0] === 'd' || o[0] === 'u' ? o[2] : o[2] - s / 2;
      var box = { left: x, right: x + s, top: y, bottom: y + s };
      if (x < 2 || y < 2 || x + s > W - 2 || y + s > H - 2) continue;
      if (inter(box, b) > 0) continue;
      dir = o[0]; arw.style.left = Math.round(x) + 'px'; arw.style.top = Math.round(y) + 'px'; break;
    }
    if (!dir) { arw.classList.add('hidden'); return; }
    arw.style.width = arw.style.height = s + 'px';
    arw.dataset.dir = dir; arw.classList.remove('hidden');
  }
  function go(i) {
    if (!st) return;
    while (i < STEPS.length && STEPS[i].skipIf && STEPS[i].skipIf()) i++;
    if (i >= STEPS.length) { finish(false); return; }
    st.i = i; st.since = Date.now(); st.avoid = null;
    var sp = STEPS[i];
    if (sp.enter) try { sp.enter(); } catch (e) { console.warn(e); }
    render();
  }
  function tick() {
    if (!st) return;
    var s = S(); if (!s) { Tutor.stop(); return; }
    // đồng hồ chuẩn bị tạm dừng; màn kết quả chờ người chơi đọc xong
    if (s.phase === 'prep' && !s.committed) s.deadline = now() + 600000;
    var sp = STEPS[st.i];
    dodge();
    var mo = document.querySelector('.modal:not(.hidden)'); st.root.classList.toggle('under', !!mo);
    if (s.phase === 'result' && st.i > idx('Kết quả ngày') && TT.Game._ack) TT.Game._ack();   // đã đọc xong kết quả: tự xác nhận để sang ngày mới
    if ((s.phase === 'result' || s.phase === 'over-wait') && s.nextPrep && STEPS[st.i].ch <= 7 && st.i <= idx('Kết quả ngày')) s.nextPrep = Math.max(s.nextPrep, now() + 4000);
    // bước chỉ hiện khi tới giai đoạn phù hợp (giao tranh, kết quả, ngày mới)
    if (sp.wait0 && !sp.wait0()) { st.root.classList.add('idle'); return; }
    st.root.classList.remove('idle');
    if (sp.wait && Date.now() - st.since > 350) { var ok = false; try { ok = sp.wait(); } catch (e) { } if (ok) { go(st.i + 1); return; } }
    // nếu giao tranh đã bắt đầu mà người chơi còn ở bước chuẩn bị, nhảy tới phần giao tranh
    if (s.phase === 'battle' && st.i < idx('Giao tranh tự động')) { go(idx('Giao tranh tự động')); return; }
    if ((s.phase === 'result') && st.i < idx('Kết quả ngày')) { go(idx('Kết quả ngày')); return; }
    if (s.M.day >= 2 && s.phase === 'prep' && st.i < idx('Ngày mới')) { go(idx('Ngày mới')); return; }
    render();
  }

  /* khoá thao tác: trong lúc chuẩn bị chỉ cho bấm vào đúng vùng đang được hướng dẫn (và bong bóng / hộp thoại) */
  var BLK = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu', 'wheel'];
  function lockOn() {
    if (!st) return false; var s = S(), sp = STEPS[st.i]; if (!s || !sp || sp.free) return false;
    if (document.querySelector('.modal:not(.hidden)')) return false;
    return s.phase === 'prep' && !s.committed;
  }
  function allowedAt(x, y, e) {
    var t = e.target; if (t && t.closest && t.closest('.tut-bub, .modal')) return true;
    var sp = STEPS[st.i]; if (sp.block) return false;
    if (sp.alsoField && t && t.id === 'board') return true;
    var rs = rectsOf(sp); if (!rs.length) return false;
    for (var qi = 0; qi < rs.length; qi++) { var r = rs[qi].r, p = rs[qi].field ? 6 : 10; if (x >= r.left - p && x <= r.right + p && y >= r.top - p && y <= r.bottom + p) return true; }
    // menu xòe quanh tướng và thanh cờ thuộc cùng thao tác
    if (sp.also) { var ar = sp.also(); if (ar && x >= ar.left - 8 && x <= ar.right + 8 && y >= ar.top - 8 && y <= ar.bottom + 8) return true; }
    return false;
  }
  function guard(e) {
    if (!st || !lockOn()) return;
    var pt = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0] || e;
    if (e.type === 'wheel' || e.type === 'contextmenu' || e.clientX == null && !pt) { if (!allowedAt(pt.clientX, pt.clientY, e)) { e.preventDefault(); e.stopPropagation(); } return; }
    if (allowedAt(pt.clientX, pt.clientY, e)) return;
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    st.shake = Date.now(); st.root.classList.remove('nudge'); void st.root.offsetWidth; st.root.classList.add('nudge');
  }
  /* bong bóng chỉ né chuột khi con trỏ nằm trong vùng bong bóng đủ 0,5 giây; đang chỉ vào nút / liên kết trong bong bóng thì không né */
  function dodge() {
    if (!st || st.mx == null) return;
    var sp = STEPS[st.i]; if (sp.next != null) { st.dw = 0; return; }
    var bub = st.root.querySelector('.tut-bub'), b = bub.getBoundingClientRect();
    var inside = st.mx > b.left - 10 && st.mx < b.right + 10 && st.my > b.top - 10 && st.my < b.bottom + 10;
    var el = document.elementFromPoint(st.mx, st.my), onBtn = !!(el && el.closest && el.closest('.tut-bub') && el.closest('button, a, .btn'));
    if (!inside || onBtn) { st.dw = 0; return; }
    if (!st.dw) { st.dw = Date.now(); return; }
    if (Date.now() - st.dw >= 500) { st.avoid = { x: st.mx, y: st.my }; st.dw = 0; render(); }
  }
  function idx(title) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].title === title) return i; return 0; }
  function finish(skipped) {
    try { localStorage.setItem('ttkc.tutDone', skipped ? 'skip' : '1'); } catch (e) { }
    var s = S();
    Tutor.stop();
    if (!skipped) {
      TT.Sound && TT.Sound.play && TT.Sound.play('win');
      TT.App.modal('<h2>' + I.ui('trophy', 18) + ' Hoàn thành hướng dẫn!</h2><p>Bạn có thể chơi tiếp ván này đến hết 10 ngày, hoặc về sảnh để tạo phòng, đấu Bot với độ khó cao hơn, hay chơi cùng bạn bè.</p>', [['Về sảnh', 'ghost', 'lobby'], ['Chơi tiếp', 'gold', 'stay']]).then(function (v) {
        if (v === 'lobby' && TT.App.leaveGame) TT.App.leaveGame();
      });
    }
    if (s) s.tut = false;
  }
  Tutor.active = function () { return !!st; };
  Tutor.start = function () {
    Tutor.stop();
    st = { i: 0, root: build(), since: Date.now() };
    document.body.classList.add('tut-on');
    (function () { var s = S(); if (!s || !s.M || s.M.day > 1) return; var mp = s.M.players.filter(function (x) { return String(x.seat) === String(s.seat); })[0]; if (mp && mp.gold < 999) mp.gold = 999; if (s.P && s.P.gold < 999) s.P.gold = 999; TT.Game._r(); })();
    st.timer = setInterval(tick, 250);
    addEventListener('resize', render);
    st.onMove = function (e) { if (!st) return; if (e.pointerType && e.pointerType !== 'mouse') return; st.mx = e.clientX; st.my = e.clientY; dodge(); };
    addEventListener('pointermove', st.onMove, true);
    st.guard = guard; BLK.forEach(function (n) { addEventListener(n, guard, { capture: true, passive: false }); });
    go(0);
  };
  Tutor.stop = function () {
    if (!st) return;
    clearInterval(st.timer); removeEventListener('resize', render); removeEventListener('pointermove', st.onMove, true); BLK.forEach(function (n) { removeEventListener(n, st.guard, { capture: true, passive: false }); });
    if (st.root) st.root.remove();
    document.body.classList.remove('tut-on');
    st = null;
  };
  Tutor.STEPS = STEPS;
})(window);
