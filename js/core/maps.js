/* Bản đồ chiến trường 2.0: lưới ô, đối xứng (2 người: xoay 180°, 3–4 người: xoay 90°). */
(function (G) {
  'use strict';
  var TT = G.TT;

  TT.MAPS = {
    binhnguyen: { name: 'Bình Nguyên Giao Phong', desc: 'Gần như đồng bằng, vài rặng rừng, một đồi giữa bản đồ. Cân bằng, dễ làm quen.' },
    thunglung: { name: 'Thung Lũng Sông', desc: 'Sông cắt ngang, chỉ vài cây cầu. Hợp quân bay, Công thành và lối phòng thủ.' },
    caonguyen: { name: 'Cao Nguyên Tháp', desc: 'Nhiều đồi cao và tháp canh. Hợp Cung thủ, Pháp sư.' },
    rungsau: { name: 'Rừng Sâu', desc: 'Rừng rậm, đường hẹp. Hợp Thích khách, Kỵ binh đánh úp.' },
    damhoang: { name: 'Đầm Hoang', desc: 'Đầm lầy trung tâm, đất khô quanh rìa. Quỷ tộc thích nơi này.' },
    thaptu: { name: 'Đường Cầu Thập Tự', desc: 'Vực đá chia bản đồ, nối bằng cầu; tháp canh ở giữa. Nhiều điểm nghẽn.' }
  };
  TT.MAP_ORDER = ['binhnguyen', 'thunglung', 'caonguyen', 'rungsau', 'damhoang', 'thaptu'];

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

    if (key === 'binhnguyen') {
      circ(cx, cy, big ? 3.6 : 2.6, 'H');
      if (big) { scatter('F', 6, 1.6, 16, 30, 16, 50); circ(cx - 12, cy + 12, 2.2, 'H'); }
      else { scatter('F', 4, 1.5, 34, 44, 2, 37); circ(8, cy + 4, 1.8, 'H'); }
    } else if (key === 'thunglung') {
      if (big) {
        // sông vòng quanh tâm, 4 cầu thẳng hướng mỗi phía + 4 cầu chéo
        for (var ry = 0; ry < H; ry++) for (var rx = 0; rx < W; rx++) { var dd = (rx - cx) * (rx - cx) + (ry - cy) * (ry - cy); if (dd >= 14 * 14 && dd <= 16.2 * 16.2) S(rx, ry, '~'); }
        rect(Math.floor(cx) - 1, Math.floor(cy) + 13, Math.floor(cx) + 1, Math.floor(cy) + 17, '=', true);
        circ(cx + 11, cy + 11, 1.2, '=', true);
        circ(cx, cy, 2.5, 'H'); scatter('F', 4, 1.6, 50, 54, 14, 54);
      } else {
        rect(0, Math.floor(cy) - 1, W - 1, Math.floor(cy) + 1, '~');
        rect(5, Math.floor(cy) - 1, 7, Math.floor(cy) + 1, '=', true); rect(Math.floor(cx), Math.floor(cy) - 1, Math.floor(cx) + 1, Math.floor(cy) + 1, '=', true);
        scatter('F', 4, 1.5, 36, 46, 2, 37); circ(cx + 10, cy + 8, 1.8, 'H');
      }
    } else if (key === 'caonguyen') {
      if (big) { [[cx - 10, cy + 10], [cx + 9, cy + 16], [cx, cy + 20]].forEach(function (p) { circ(p[0], p[1], 2.6, 'H'); }); circ(cx - 14, cy + 14, .5, 'T', true); circ(cx, cy, 3, 'H'); scatter('F', 3, 1.3, 40, 50, 18, 50); }
      else { circ(6, cy + 2, 2.6, 'H'); circ(cx + 8, cy + 10, 2.4, 'H'); circ(5, cy, .5, 'T', true); scatter('F', 3, 1.3, 36, 46, 2, 37); }
    } else if (key === 'rungsau') {
      if (big) { for (var k = 0; k < 18; k++) circ(14 + R(40), 30 + R(24), 1.6 + R(2), 'F', false, 85); rect(Math.floor(cx) - 1, Math.floor(cy), Math.floor(cx) + 1, H - 13, '.', true); circ(cx, cy, 2, '.', true); }
      else { for (var k2 = 0; k2 < 12; k2++) circ(2 + R(36), 30 + R(16), 1.5 + R(2), 'F', false, 85); rect(Math.floor(cx) - 1, 28, Math.floor(cx) + 1, H - 13, '.', true); rect(4, 28, 5, H - 13, '.', true); }
    } else if (key === 'damhoang') {
      circ(cx, cy, big ? 11 : 7, 'S', false, 90); circ(cx, cy, big ? 2.5 : 1.8, 'H', true);
      if (big) scatter('F', 4, 1.5, 44, 54, 16, 52); else scatter('F', 3, 1.5, 38, 46, 2, 37);
    } else if (key === 'thaptu') {
      if (big) {
        // vực chéo chia 4 cánh; cầu thẳng hướng mỗi phía, tháp giữa
        for (var t = 6; t < 30; t++) { S(Math.floor(cx) - t, Math.floor(cy) - t, '#'); S(Math.floor(cx) - t + 1, Math.floor(cy) - t, '#'); }
        circ(cx, cy, 4.5, '#'); circ(cx, cy, 1.4, '.', true);
        rect(Math.floor(cx) - 1, Math.floor(cy) + 2, Math.floor(cx) + 1, Math.floor(cy) + 5, '=', true);
        circ(cx, cy, .5, 'T', true); circ(cx - 9, cy - 9, 1.1, '=', true);
        scatter('F', 3, 1.4, 44, 52, 20, 48); circ(cx - 12, cy + 16, 2, 'H');
      } else {
        rect(0, Math.floor(cy) - 1, W - 1, Math.floor(cy) + 1, '#');
        rect(4, Math.floor(cy) - 1, 6, Math.floor(cy) + 1, '=', true); rect(Math.floor(cx), Math.floor(cy) - 1, Math.floor(cx) + 1, Math.floor(cy) + 1, '=', true);
        circ(Math.floor(cx), Math.floor(cy) + 4, .5, 'T', true);
        scatter('F', 3, 1.4, 36, 46, 2, 37); circ(cx + 10, cy + 8, 1.8, 'H');
      }
    }
    if (extraTowers) { if (big) circ(cx + 8, cy + 8, .5, 'T', true); else circ(W - 6, cy + 5, .5, 'T', true); }
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
