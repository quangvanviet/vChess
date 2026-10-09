/* Bản đồ chiến trường 2.0: lưới ô, đối xứng (2 người: xoay 180°, 3–4 người: xoay 90°). */
(function (G) {
  'use strict';
  var TT = G.TT;

  TT.MAPS = {
    binhnguyen: { name: 'Bình Nguyên Giao Phong', desc: 'Đồng bằng có rặng đồi giữa bản đồ, rừng hai cánh và vài cột đá làm chỗ nấp. Chiếm đồi giữa cho cung thủ, hoặc đánh vòng cánh rừng. Dễ làm quen.' },
    thunglung: { name: 'Thung Lũng Sông', desc: 'Sông có vách đá hai bờ: chỉ qua bằng cầu hẹp (nhanh) hoặc bến cạn (chậm, lộ liễu). Đồi bờ sông khống chế đầu cầu. Hợp quân bay và Công thành.' },
    caonguyen: { name: 'Cao Nguyên Tháp', desc: 'Nhiều tầng đồi với tháp canh trên đồi, cột đá chắn tầm bắn. Ai giữ đồi thì cung thủ, pháp sư mạnh hơn hẳn; kẻ leo dốc chịu thiệt.' },
    rungsau: { name: 'Rừng Sâu', desc: 'Rừng rậm với ba lối mòn: giữa thẳng, trái dài ngoằn nghoèo, phải ngắn nhưng phải lội bùn. Hợp Thích khách, Kỵ binh đánh úp.' },
    damhoang: { name: 'Đầm Hoang', desc: 'Đầm lầy lớn ở giữa làm chậm và hao máu quân đi thẳng; đường rìa khô dài hơn nhưng an toàn. Cù lao đồi có tháp. Quỷ tộc thích nơi này.' },
    thaptu: { name: 'Đường Cầu Thập Tự', desc: 'Vực đá chia bản đồ, nối bằng vài cây cầu: hai cầu cánh hẹp và cầu giữa rộng có đồi canh. Nhiều điểm nghẽn, tháp canh đầu cầu.' },
    phaothanh: { name: 'Pháo Đài Trung Tâm', desc: 'Pháo đài có tường đá bao quanh ở giữa, vài cổng và đồi bên trong. Đánh cổng, giữ cổng hoặc đi vòng ngoài theo đường rừng.' },
    quandao: { name: 'Quần Đảo Cầu Nối', desc: 'Các đảo cách nhau bằng nước nông chậm; cầu nhanh nhưng hẹp là điểm nghẽn. Quân bay, Tiên tộc lội nước thoải mái.' },
    hemnui: { name: 'Hẻm Núi', desc: 'Thung lũng dài và hẹp giữa vách núi, có hốc đồi cho cung thủ hai bên. Đường mòn rìa rừng dài hơn để đánh vòng.' },
    mecung: { name: 'Mê Cung Hành Lang', desc: 'Tường đá chia ba hành lang: giữa ngắn và hẹp, phải có rừng, trái dài ngoằn nghoèo. Gặp nhau ở sân giữa có đồi và tháp.' }
  };
  TT.MAP_ORDER = ['binhnguyen', 'thunglung', 'caonguyen', 'rungsau', 'damhoang', 'thaptu', 'phaothanh', 'quandao', 'hemnui', 'mecung'];

  /* Kích thước và vùng xuất quân. side: 0 Nam (dưới), 1 Tây (trái), 2 Bắc (trên), 3 Đông (phải) */
  TT.mapDims = function (mode) { return mode === 2 ? { W: 40, H: 60 } : { W: 68, H: 68 }; };
  TT.sideOfSeat = function (mode, seat) { seat = +seat; return mode === 2 ? (seat === 1 ? 0 : 2) : seat - 1; };
  TT.zoneOf = function (mode, side) {
    var d = TT.mapDims(mode), ZW = 24, ZD = 12;
    if (mode === 2) return side === 0 ? { x0: 8, y0: d.H - ZD, x1: 31, y1: d.H - 1 } : { x0: 8, y0: 0, x1: 31, y1: ZD - 1 };
    var c0 = (d.W - ZW) / 2, c1 = c0 + ZW - 1;
    return [{ x0: c0, y0: d.H - ZD, x1: c1, y1: d.H - 1 }, { x0: 0, y0: c0, x1: ZD - 1, y1: c1 },
      { x0: c0, y0: 0, x1: c1, y1: ZD - 1 }, { x0: d.W - ZD, y0: c0, x1: d.W - 1, y1: c1 }][side];
  };
  // Hướng "tiến lên" của mỗi phía (về tâm)
  TT.sideFwd = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  TT.inZone = function (z, x, y) { return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1; };
  // Đổi toạ độ "cục bộ" (người chơi nhìn vùng mình ở dưới) <-> toạ độ bản đồ
  TT.zoneLocal = function (mode, side, x, y) {
    var z = TT.zoneOf(mode, side);
    if (side === 0) return [x - z.x0, y - z.y0];
    if (side === 2) return [z.x1 - x, z.y1 - y];
    if (side === 1) return [y - z.y0, z.x1 - x];
    return [z.y1 - y, x - z.x0];
  };

  // Xoay một điểm "chuẩn" (viết cho phía Nam) sang phía bất kỳ — đúng phép đối xứng của bản đồ
  TT.rotPoint = function (mode, side, x, y) {
    var d = TT.mapDims(mode);
    if (mode === 2) return side === 0 ? [x, y] : [d.W - 1 - x, d.H - 1 - y];
    for (var i = 0; i < side; i++) { var nx = d.W - 1 - y, ny = x; x = nx; y = ny; }
    return [x, y];
  };
  TT.buildMap = function (mode, key, seed, extraTowers) {
    var d = TT.mapDims(mode), W = d.W, H = d.H, g = new Array(W * H), rnd = TT.mulberry(seed >>> 0);
    var R = function (n) { return rnd() % n; };
    for (var i = 0; i < g.length; i++) g[i] = '.';
    var syms = mode === 2 ? [function (x, y) { return [x, y]; }, function (x, y) { return [W - 1 - x, H - 1 - y]; }]
      : [function (x, y) { return [x, y]; }, function (x, y) { return [W - 1 - y, x]; }, function (x, y) { return [W - 1 - x, H - 1 - y]; }, function (x, y) { return [y, H - 1 - x]; }];
    function set(x, y, t, force) { x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= W || y >= H) return; var k = y * W + x; if (!force && (g[k] === '=' || g[k] === 'T')) return; g[k] = t; }
    function S(x, y, t, force) { syms.forEach(function (f) { var p = f(x, y); set(p[0], p[1], t, force); }); }
    function circ(cx, cy, r, t, force, dens) { for (var y = Math.floor(cy - r); y <= cy + r; y++) for (var x = Math.floor(cx - r); x <= cx + r; x++) { var dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r + .3 && (!dens || R(100) < dens)) S(x, y, t, force); } }
    function rect(x0, y0, x1, y1, t, force) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) S(x, y, t, force); }
    var cx = (W - 1) / 2, cy = (H - 1) / 2;
    // rải rác ngẫu nhiên đối xứng
    function scatter(t, n, r, y0, y1, x0, x1) { for (var i = 0; i < n; i++) circ(x0 + R(x1 - x0 + 1), y0 + R(y1 - y0 + 1), r + R(2) * .7, t, false, 80); }
    var big = mode !== 2;

    var ci = Math.floor(cx), cj = Math.floor(cy);
    function ell(ex, ey, rx, ry, t, force, dens) { for (var y = Math.floor(ey - ry); y <= ey + ry; y++) for (var x = Math.floor(ex - rx); x <= ex + rx; x++) { var dx = (x - ex) / rx, dy = (y - ey) / ry; if (dx * dx + dy * dy <= 1.05 && (!dens || R(100) < dens)) S(x, y, t, force); } }
    function tw(x, y) { S(Math.round(x), Math.round(y), 'T', true); }
    function ringRect(x0, y0, x1, y1, t) { rect(x0, y0, x1, y0, t); rect(x0, y1, x1, y1, t); rect(x0, y0, x0, y1, t); rect(x1, y0, x1, y1, t); }

    if (key === 'binhnguyen') {
      // đồi giữa + rặng rừng hai cánh + vài cột đá làm chỗ nấp, tháp ở cánh
      var j1 = R(3), j2 = R(3);
      if (big) {
        circ(cx, cy, 3.6, 'H'); ell(cx, cy, 7, 2, 'H');
        scatter('F', 6, 1.6, 16, 30, 16, 50); circ(cx - 12, cy + 12, 2.2, 'H');
        rect(39 + j1, 40, 40 + j1, 42, '#'); rect(24 + j2, 44, 25 + j2, 45, '#');
        tw(24, 40);
      } else {
        ell(cx, cy, 8, 2.8, 'H');
        rect(10 + j1, 38, 11 + j1, 39, '#'); rect(27 - j1, 35, 28 - j1, 36, '#');
        ell(3, 38 + j2, 3, 5, 'F', false, 90); ell(36, 35 + j2, 3, 4, 'F', false, 90);
        circ(9 + j2, 34, 1.8, 'H'); circ(29 - j2, 41, 1.8, 'H');
        scatter('F', 2, 1.4, 38, 44, 10, 28);
        tw(4, 32);
      }
    } else if (key === 'thunglung') {
      // sông có vách đá hai bờ: chỉ qua được ở cầu (nhanh, hẹp) hoặc bến cạn (chậm, rộng)
      var bj = R(3);
      if (big) {
        for (var ry = 0; ry < H; ry++) for (var rx = 0; rx < W; rx++) { var dd = Math.sqrt((rx - cx) * (rx - cx) + (ry - cy) * (ry - cy)); if (dd >= 10 && dd <= 13.5) g[ry * W + rx] = '~'; if (dd >= 11 && dd <= 12.5) g[ry * W + rx] = '#'; }
        circ(cx + 8.4, cy + 8.4, 2.6, '~', true);                 // bến cạn chéo
        rect(ci - 1, cj + 8, ci + 1, cj + 15, '=', true);          // cầu thẳng hướng mỗi phía
        circ(cx, cy, 3, 'H'); circ(cx + 5, cy - 5, 1.6, 'F'); circ(cx - 5, cy + 5, 1.6, 'F');
        circ(cx + 11, cy + 20, 2, 'H'); circ(cx - 14, cy + 17, 2, 'H'); // đồi bờ ngoài nhìn xuống cầu
        scatter('F', 4, 1.6, 48, 54, 14, 54);
        tw(cx + 13, cy + 13);
      } else {
        rect(0, 28, W - 1, 31, '~'); rect(0, 29, W - 1, 30, '#');
        rect(17, 28, 22, 31, '~', true);                            // bến cạn giữa
        rect(5 + bj, 28, 7 + bj, 31, '=', true);                    // hai cầu hẹp (đối xứng xoay)
        circ(12 + bj, 35, 2.2, 'H'); circ(15, 34, 1.4, 'F'); circ(25, 36, 1.8, 'F'); rect(26 - bj, 36, 27 - bj, 37, '#');
        scatter('F', 3, 1.5, 38, 44, 2, 37);
        tw(25, 33);
      }
    } else if (key === 'caonguyen') {
      // nhiều tầng đồi, tháp trên đồi; cột đá chắn tầm nhìn
      var h1 = R(3);
      if (big) {
        [[cx - 10, cy + 10], [cx + 9, cy + 16], [cx, cy + 20]].forEach(function (p) { circ(p[0], p[1], 2.6, 'H'); });
        circ(cx, cy, 3, 'H'); ell(cx, cy + 6, 5, 1.6, 'H'); tw(cx - 10, cy + 10);
        rect(ci - 5, cj + 11, ci - 4, cj + 12, '#'); rect(ci + 4, cj + 8, ci + 5, cj + 9, '#'); rect(ci - 16, cj + 4, ci - 15, cj + 6, '#');
        scatter('F', 3, 1.3, 40, 50, 18, 50);
      } else {
        ell(cx, cy, 10, 2.6, 'H'); rect(15 + h1, 29, 16 + h1, 30, '#');
        circ(7, 35, 2.8, 'H'); circ(30, 38, 2.6, 'H'); circ(19 + h1, 40, 1.8, 'H');
        rect(12 + h1, 33, 13 + h1, 34, '#'); rect(24, 36, 25, 37, '#');
        tw(7, 35); tw(30, 38);
        scatter('F', 3, 1.3, 36, 44, 2, 37);
      }
    } else if (key === 'rungsau') {
      // rừng dày, ba lối mòn: giữa thẳng, trái dài ngoằn nghoèo, phải ngắn nhưng qua bùn
      if (big) {
        circ(cx, cy, 23, 'F');
        for (var k = 0; k < 16; k++) circ(14 + R(40), 30 + R(24), .7 + R(2) * .5, '#', false, 90);
        rect(ci - 1, cj + 5, ci + 2, 56, '.', true);                       // giữa
        rect(24, 46, 26, 56, '.', true); rect(24, 43, 31, 45, '.', true); rect(29, 37, 31, 45, '.', true); // trái dài
        rect(40, 40, 43, 56, '.', true); circ(41.5, 47, 2.2, 'S', true); rect(36, 37, 43, 40, '.', true); // phải qua bùn
        circ(cx, cy, 5.5, '.', true); circ(cx, cy, 1.6, 'H', true); tw(30, 44);
      } else {
        rect(0, 20, W - 1, 45, 'F');
        for (var k2 = 0; k2 < 10; k2++) circ(1 + R(38), 22 + R(23), .7 + R(2) * .5, '#', false, 90);
        rect(18, 24, 21, 45, '.', true);                                    // giữa
        rect(3, 36, 5, 45, '.', true); rect(3, 34, 12, 36, '.', true); rect(11, 24, 13, 36, '.', true);   // trái ngoằn nghoèo
        rect(31, 27, 35, 45, '.', true); circ(33, 38, 2.2, 'S', true);      // phải qua bùn
        circ(cx, cy, 4.5, '.', true); circ(cx, cy, 1.4, 'H', true);
        tw(12, 31);
      }
    } else if (key === 'damhoang') {
      // đầm lầy lớn: đi thẳng bị chậm + mất máu, đi vòng rìa khô thì dài hơn; cù lao đồi có tháp
      if (big) {
        circ(cx, cy, 14, 'S', false, 94); circ(cx, cy, 2.6, 'H', true);
        circ(cx + 8, cy + 8, 2.2, 'H', true); circ(cx + 4, cy + 11, 1.2, '.', true); circ(cx + 11, cy + 4, 1.2, '.', true);
        tw(cx + 8, cy + 8);
        rect(ci + 15, cj + 15, ci + 16, cj + 17, '#'); scatter('F', 4, 1.6, 48, 56, 12, 56);
      } else {
        ell(cx, cy, 15, 12.5, 'S', false, 94); circ(cx, cy, 2.2, 'H', true);
        circ(12, 36, 1.9, 'H', true); circ(27, 31, 1.5, 'H', true); circ(23, 40, 1.2, '.', true); circ(8, 28, 1.2, '.', true);
        tw(12, 36);
        rect(0, 38, 1, 39, '#'); rect(38, 35, 39, 36, '#'); ell(2, 44, 2, 2, 'F'); ell(37, 41, 2, 2, 'F');
      }
    } else if (key === 'thaptu') {
      // vực đá chia bản đồ, nối bằng cầu; cây cầu giữa rộng được đồi canh, hai cầu cánh hẹp
      if (big) {
        for (var t = 6; t < 30; t++) { S(ci - t, cj - t, '#'); S(ci - t + 1, cj - t, '#'); S(ci - t - 1, cj - t, '#'); }
        circ(cx, cy, 5, '#'); circ(cx, cy, 2, '.', true);
        rect(ci - 1, cj + 3, ci + 1, cj + 6, '=', true);
        circ(cx - 12, cy - 12, 1.8, '=', true); circ(cx - 22, cy - 22, 1.8, '=', true);
        circ(cx, cy, 1.4, 'H', true); circ(cx - 12, cy + 16, 2, 'H'); circ(cx - 14, cy - 7, 1.8, 'F');
        tw(cx - 12, cy + 16); scatter('F', 3, 1.4, 44, 52, 20, 48);
      } else {
        rect(0, 27, W - 1, 32, '#');
        rect(4, 27, 6, 32, '=', true); rect(18, 27, 21, 32, '=', true);
        circ(14, 35, 2.2, 'H'); circ(25, 36, 1.8, 'F'); circ(32, 36, 1.6, 'H');
        rect(10, 35, 11, 36, '#'); rect(28, 37, 29, 38, '#'); rect(16, 40, 17, 41, '#');
        tw(14, 35);
        scatter('F', 3, 1.4, 38, 44, 2, 37);
      }
    } else if (key === 'phaothanh') {
      // pháo đài có tường bao quanh trung tâm, vài cổng; đánh cổng hay đi vòng ngoài
      if (big) {
        ringRect(ci - 8, cj - 8, ci + 9, cj + 9, '#');
        rect(ci - 1, cj + 9, ci + 2, cj + 9, '.', true);            // cổng mỗi phía
        circ(cx, cy, 3.4, 'H', true); circ(cx, cy, 1.2, '.', true);
        rect(ci - 12, cj + 12, ci - 11, cj + 13, '#'); circ(cx + 14, cy + 14, 2.2, 'H'); circ(cx - 14, cy + 14, 1.8, 'F');
        tw(cx + 13, cy + 13); scatter('F', 4, 1.6, 48, 54, 12, 56);
      } else {
        ringRect(12, 24, 27, 35, '#');
        rect(18, 35, 21, 35, '.', true);                               // hai cổng đối diện
        rect(12, 33, 12, 34, '.', true);                               // cửa hông nhỏ (đối xứng xoay sang bên kia)
        ell(cx, cy, 4, 2, 'H', true);
        circ(6, 38, 2, 'F'); circ(33, 40, 2, 'F'); circ(5, 33, 1.6, 'H'); rect(8, 41, 9, 42, '#');
        tw(9, 35);
      }
    } else if (key === 'quandao') {
      // quần đảo: đảo căn cứ, đảo giữa, đảo nhỏ; nước nông chậm, cầu nhanh nhưng hẹp
      if (big) {
        for (var qy = 0; qy < H; qy++) for (var qx = 0; qx < W; qx++) { var qd = Math.sqrt((qx - cx) * (qx - cx) + (qy - cy) * (qy - cy)); if (qd < 24) g[qy * W + qx] = '~'; }
        circ(cx, cy, 8, '.', true); circ(cx, cy, 3, 'H', true);
        circ(cx + 14, cy + 14, 3.6, '.', true); circ(cx + 14, cy + 14, 1.5, 'H', true); tw(cx + 14, cy + 14);
        rect(ci - 1, cj + 6, ci + 1, cj + 22, '=', true);                 // cầu thẳng từ căn cứ vào đảo giữa
        rect(ci + 3, cj + 18, ci + 14, cj + 19, '=', true); rect(ci + 13, cj + 14, ci + 14, cj + 19, '=', true);  // cầu viền tới đảo nhỏ
        rect(ci + 9, cj + 9, ci + 12, cj + 10, '=', true);                // cầu nối đảo giữa - đảo nhỏ
        for (var q = 0; q < 5; q++) circ(cx + 6 + R(14), cy + 2 + R(14), .6, '#', false);
        circ(cx - 14, cy + 6, 1.4, '.', true);
      } else {
        rect(0, 14, W - 1, 45, '~');
        ell(cx, cy, 10, 5.5, '.', true); circ(cx, cy, 2.4, 'H', true);
        circ(5, 36, 3.6, '.', true); circ(5, 36, 1.4, 'F', true); circ(33, 40, 2.6, '.', true);
        rect(17, 34, 19, 45, '=', true);                                 // cầu thẳng vào đảo giữa
        rect(5, 41, 6, 45, '=', true); rect(7, 36, 12, 37, '=', true);   // cầu vào đảo nhỏ rồi sang đảo giữa
        rect(31, 40, 32, 45, '=', true);
        for (var q2 = 0; q2 < 4; q2++) circ(8 + R(24), 38 + R(6), .6, '#', false);
        tw(5, 36);
      }
    } else if (key === 'hemnui') {
      // hẻm núi: thung lũng dài hẹp giữa vách đá, hốc đồi cho cung thủ hai bên, đường mòn ngoài rìa dài hơn
      if (big) {
        rect(38, 38, 52, 52, '#');                                       // khối núi mỗi góc chéo
        rect(38, 41, 42, 43, 'H', true); rect(38, 47, 41, 49, 'H', true); // hốc đồi quay ra hẻm
        tw(40, 42); circ(cx, cy, 5.5, '.', true); circ(cx, cy, 1.8, 'H', true);
        for (var q3 = 0; q3 < 3; q3++) circ(55 + R(10), 55 + R(10), 1.5, 'F');
      } else {
        rect(6, 14, 15, 45, '#'); rect(24, 14, 33, 45, '#');
        rect(16, 27, 17, 32, '#'); rect(22, 27, 23, 32, '#');           // chỗ thắt giữa hẻm
        rect(10, 34, 15, 36, 'H', true); rect(24, 40, 29, 42, 'H', true);   // hốc cho cung thủ
        for (var yy = 14; yy <= 45; yy++) { if (yy % 4 < 2) { S(2 + R(2), yy, 'F'); S(3 + R(2), yy, 'F'); } }
        tw(12, 35); tw(27, 41);
      }
    } else if (key === 'mecung') {
      // ba hành lang: giữa ngắn và hẹp, phải vừa có rừng, trái dài ngoằn nghoèo; gặp nhau ở sân giữa
      if (big) {
        rect(29, 43, 30, 53, '#'); rect(37, 43, 38, 53, '#');                 // vách hành lang giữa (rộng 6)
        rect(16, 51, 25, 51, '#'); rect(19, 46, 28, 46, '#');                 // trái: ngoằn nghoèo
        rect(39, 47, 40, 48, '#'); circ(45, 46, 2.4, 'F'); circ(42, 51, 1.6, 'S'); // phải: rộng, rừng, bùn
        circ(cx, cy, 6, '.', true); circ(cx, cy, 2.4, 'H', true); tw(cx - 8, cy - 8);
      } else {
        rect(14, 36, 15, 45, '#'); rect(24, 36, 25, 45, '#');          // vách hai bên hành lang giữa
        rect(19, 41, 20, 41, '#');                                       // trụ giữa hành lang giữa: còn hai lối hẹp
        rect(0, 42, 9, 42, '#'); rect(4, 38, 13, 38, '#');              // trái: ngoằn nghoèo
        circ(33, 40, 2, 'F'); circ(30, 36, 1.6, 'F'); circ(35, 43, 1.6, 'S');
        rect(30, 44, 31, 44, '#');
        circ(cx, cy, 2.6, 'H'); ell(7, 28, 2, 1.2, 'F');
        tw(17, 33);
      }
    }
    if (extraTowers) { if (big) tw(cx + 8, cy - 8); else tw(W - 6, cj + 5); }
    // góc bản đồ 4 người: đồi đá trang trí
    if (big) { for (var q = 0; q < 6; q++) circ(3 + R(14), 3 + R(14), 1.5 + R(2), R(3) ? 'F' : 'H', false, 85); circ(4, 4, 2.5, '#'); }
    // dọn sạch vùng xuất quân + 2 ô đệm
    var sides = mode === 2 ? [0, 2] : [0, 1, 2, 3];
    sides.forEach(function (s) { var z = TT.zoneOf(mode, s); for (var y = z.y0 - 2; y <= z.y1 + 2; y++) for (var x = z.x0 - 2; x <= z.x1 + 2; x++) if (x >= 0 && y >= 0 && x < W && y < H) { var kk = y * W + x; if (g[kk] !== '.' && (TT.inZone(z, x, y) || g[kk] === '#')) g[kk] = '.'; } });
    // đảm bảo mọi vùng nối được với tâm (đổi vực chặn thành cầu)
    var ok = connect(g, W, H, Math.floor(cx), Math.floor(cy), sides.map(function (s) { var z = TT.zoneOf(mode, s); return [(z.x0 + z.x1) >> 1, (z.y0 + z.y1) >> 1]; }));
    if (!ok) for (var i2 = 0; i2 < g.length; i2++) if (g[i2] === '#') g[i2] = '.';
    var towers = []; for (var i3 = 0; i3 < g.length; i3++) if (g[i3] === 'T') towers.push([i3 % W, (i3 / W) | 0]);
    return { key: key, name: (TT.MAPS[key] || {}).name || key, W: W, H: H, g: g.join(''), towers: towers, center: [Math.floor(cx), Math.floor(cy)] };
  };
  function connect(g, W, H, sx, sy, pts) {
    var seen = new Uint8Array(W * H), q = [sy * W + sx]; if (g[q[0]] === '#') g[q[0]] = '.'; seen[q[0]] = 1;
    while (q.length) { var k = q.pop(), x = k % W, y = (k / W) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; var nk = ny * W + nx; if (seen[nk] || g[nk] === '#') return; seen[nk] = 1; q.push(nk); }); }
    return pts.every(function (p) { return seen[p[1] * W + p[0]]; });
  }
  TT.mapForDay = function (seed, day, mode, eventKey, lock) {
    var info = TT.DAYS[day] || {}, key = info.map || (lock ? 'binhnguyen' : null);
    if (!key) { var pool = TT.MAP_ORDER.filter(function (k) { return k !== 'binhnguyen' || day > 5; }); key = pool[TT.hash32(seed, 'map', day) % pool.length]; }
    return TT.buildMap(mode, key, TT.hash32(seed, 'mapseed', day), eventKey === 'chiendia');
  };
})(typeof window !== 'undefined' ? window : global);
