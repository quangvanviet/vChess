/* Tứ Tộc Kỳ Chiến — mô hình 3D nhân vật phong cách LOW-POLY STYLIZED (kiểu Ragnarok Online 3):
   - KHÔNG dùng hộp/cầu trơn: mọi bộ phận được "điêu khắc" từ khối tiện (lathe), khối ép đùn có vát cạnh (extrude + bevel),
     khối đa diện bo tròn (icosa/dodeca ép tỉ lệ) và ống thon (capsule tiện) → cạnh bo tròn, mặt phẳng low-poly.
   - Màu theo đỉnh (vertex color) + độ nhám/kim loại theo đỉnh (thuộc tính "mr") để vật liệu PBR hiển thị kim loại, vải, da khác nhau.
   - Mỗi bộ phận là một hàm riêng, tham số hóa (kích thước, màu, kiểu): đầu, mắt, tóc, tai, sừng, thân, tay, chân, áo choàng,
     mũ giáp, vũ khí, khiên, cánh, thú cưỡi…
   - Các bộ phận chuyển động (tay phải, chân, cánh, áo choàng, chân thú) là "Part" riêng có điểm xoay, gộp thành BufferGeometry
     để vẽ instanced: mọi quân cùng loại chỉ tốn vài lệnh vẽ mà vẫn có hoạt ảnh. */
(function (G) {
  'use strict';
  var TT = G.TT, THREE = G.THREE;
  if (!THREE) return;
  var Models = TT.Models = {};
  var GC = {}, PI = Math.PI;
  function gk(k, f) { return GC[k] || (GC[k] = f()); }
  var V2 = function (x, y) { return new THREE.Vector2(x, y); };

  /* ======================= HÌNH KHỐI CƠ SỞ (low-poly, bo tròn) ======================= */
  // khối hộp vát/bo cạnh low-poly (dùng cho ván gỗ, chi tiết cơ khí) — không phải hộp trơn
  function roundedBox(w, h, d, r, seg) {
    seg = seg || 2;
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    var g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal;
    var hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      v.sub(c); var l = v.length() || 1; v.multiplyScalar(1 / l);
      n.setXYZ(i, v.x, v.y, v.z);
      p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
    }
    return g;
  }
  // hộp bo tròn: dùng RoundedBoxGeometry của three/examples (có sẵn trong gói vendor), dự phòng bằng bản tự viết
  function B(w, h, d, rr) {
    var r = rr != null ? rr : Math.min(w, h, d) * .3;
    return gk('b' + w + 'x' + h + 'x' + d + 'r' + r, function () {
      r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
      return THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(w, h, d, 2, r) : roundedBox(w, h, d, r, 2);
    });
  }
  Models.B = B; Models.RBox = roundedBox;
  // đa diện bo tròn đơn vị (low-poly) — ép tỉ lệ thành khối trứng/hạt đậu
  // VOXEL: mọi khối 'trứng' đều thành khối lập phương kiểu Minecraft (chibi + Ragnarok: đầu to, thân gọn)
  var ICO = function (det) { return gk('vox', function () { return new THREE.BoxGeometry(1.72, 1.72, 1.72); }); };
  var DOD = function () { return gk('dod', function () { return new THREE.DodecahedronGeometry(1, 0); }); };
  // khối tiện: profile [[r,y]...] quay quanh trục Y
  function LA(prof, seg, phi0, phiL) { seg = Math.min(seg || 8, 6); return gk('la' + seg + (phi0 || 0) + (phiL || 0) + JSON.stringify(prof), function () { return new THREE.LatheGeometry(prof.map(function (p) { return V2(p[0], p[1]); }), seg || 8, phi0 || 0, phiL || PI * 2); }); }
  // ống thon bo tròn hai đầu (capsule tiện): bán kính r1 (dưới) → r2 (trên), dài h, tâm ở 0
  function CAP(r1, r2, h, seg) {
    return gk('cap' + r1 + '_' + r2 + '_' + h, function () {
      var L = h + r1 * .6 + r2 * .6, g = new THREE.CylinderGeometry(r2 * 1.25, r1 * 1.25, L, 4, 1); g.rotateY(PI / 4); g.translate(0, (r2 * .6 - r1 * .6) / 2, 0); return g;
    });
  }
  /* ống capsule THON (tay, chân): CapsuleGeometry của three.js rồi bóp bán kính từ r1 (đầu dưới, cổ tay/cổ chân) lên r2 (đầu trên, vai/hông).
     Pháp tuyến tính lại → bề mặt mượt (smooth shading). */
  function TCAP(r1, r2, h) {
    return gk('tc' + r1 + '_' + r2 + '_' + h, function () {
      var g = new THREE.CylinderGeometry(r2 * 1.22, r1 * 1.22, h + r1 + r2, 4, 1); g.rotateY(PI / 4); g.translate(0, (r2 - r1) / 2, 0); return g;
    });
  }
  function CONE(r, h, seg) { return gk('cn' + r + h + seg, function () { var c = new THREE.ConeGeometry(r, h, seg || 6, 1); return c; }); }
  function CYL(rt, rb, h, seg) { return gk('cy' + rt + rb + h + seg, function () { return new THREE.CylinderGeometry(rt, rb, h, Math.min(seg || 8, 6), 1); }); }
  function TOR(R, r, rs, ts, arc) { return gk('to' + R + r + rs + ts + arc, function () { return new THREE.TorusGeometry(R, r, rs || 4, ts || 10, arc || PI * 2); }); }
  // khối ép đùn có vát cạnh từ đường viền 2D (lưỡi kiếm, khiên, tóc, tai, cánh, áo choàng)
  function EX(pts, depth, bevel, key) {
    return gk('ex' + (key || JSON.stringify(pts)) + depth + bevel, function () {
      var s = new THREE.Shape(); pts.forEach(function (p, i) { if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); });
      var g = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * .9, bevelSegments: 1, curveSegments: 3 });
      g.translate(0, 0, -depth / 2); return g;
    });
  }
  // ống cong theo đường (cung, sừng cong)
  function TUBE(pts, r, seg) { return gk('tb' + r + JSON.stringify(pts), function () { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); })), seg || 8, r, 5, false); }); }

  /* ======================= BỘ PHẬN (Part) ======================= */
  function Part(pivot) { this.items = []; this.pivot = pivot || [0, 0, 0]; }
  // a(geo, màu, vị trí, góc xoay, tỉ lệ, viền)
  // FLAT = true khi đang dựng giáp/mũ/vũ khí → mặt phẳng (flat shading) để tương phản chất liệu với da, tóc, vải mượt
  var FLAT = false, FLATC = {};
  Part.prototype.a = function (geo, color, p, r, s, ol) { this.items.push([geo, color, p || [0, 0, 0], r || [0, 0, 0], s == null ? 1 : s, ol == null ? 1 : ol, FLAT || !!FLATC[color], KEEP]); return this; };
  var KEEP = false;   // true khi dựng khuôn mặt: mắt, mày, miệng luôn giữ
  function keep(f) { var o = KEEP; KEEP = true; try { f(); } finally { KEEP = o; } }
  var MIN_BIT = .1; // phong cách Minecraft: bỏ mọi chi tiết nhỏ hơn ngưỡng này (trừ khuôn mặt)
  function flat(f) { var o = FLAT; FLAT = true; try { f(); } finally { FLAT = o; } }
  // các "nét bút" điêu khắc
  Part.prototype.e = function (rx, ry, rz, color, x, y, z, r, det) { return this.a(ICO(det == null ? 1 : Math.min(det, 1)), color, [x || 0, y || 0, z || 0], r, [rx, ry, rz], Math.min(rx, ry, rz) > .018 ? 1 : 0); };   // khối trứng low-poly
  Part.prototype.c = function (r1, r2, h, color, x, y, z, r, seg) { return this.a(CAP(r1, r2, h, seg), color, [x || 0, y || 0, z || 0], r, 1, Math.min(r1, r2) > .016 ? 1 : 0); }; // ống thon
  Part.prototype.k = function (w, h, d, color, x, y, z, r, rr) { return this.a(B(w, h, d, rr), color, [x || 0, y || 0, z || 0], r, 1, Math.min(w, h, d) > .03 ? 1 : 0); };      // khối vát cạnh
  Part.prototype.x = function (pts, depth, color, x, y, z, r, s, bevel, key) { return this.a(EX(pts, depth, bevel == null ? Math.min(.012, depth * .4) : bevel, key), color, [x || 0, y || 0, z || 0], r, s == null ? 1 : s, depth > .02 ? 1 : 0); }; // ép đùn
  Part.prototype.l = function (prof, seg, color, x, y, z, r, s) { return this.a(LA(prof, seg), color, [x || 0, y || 0, z || 0], r, s == null ? 1 : s); }; // khối tiện
  // tay chân: capsule thon mượt
  Part.prototype.t = function (r1, r2, h, color, x, y, z, r) { return this.a(TCAP(r1, r2, h), color, [x || 0, y || 0, z || 0], r, 1, 1); };
  Part.prototype.n = function (r, h, color, x, y, z, rot, seg) { return this.a(CONE(r, h, seg), color, [x || 0, y || 0, z || 0], rot, 1, r > .02 ? 1 : 0); }; // chóp
  var _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  // vật liệu theo màu: kim loại / đá quý / vải / da / tóc → [metalness, roughness]
  var MR = {};
  function mrOf(color) { return MR[color] || [0, .78]; }
  /* chuẩn hoá hướng mặt sau khi gộp: tỉ lệ âm (đối xứng) đảo chiều tam giác; khối tiện (lathe) có profile đi từ trên xuống
     cũng bị ngược → đảo lại thứ tự đỉnh và pháp tuyến cho hướng ra ngoài (cần cho smooth shading + viền mặt sau). */
  function orient(g, neg, vote) {
    var P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 9, i, k;
    var swap = neg, flipN = false;
    if (vote) {
      var cx = 0, cy = 0, cz = 0; for (i = 0; i < P.length; i += 3) { cx += P[i]; cy += P[i + 1]; cz += P[i + 2]; } k = P.length / 3; cx /= k; cy /= k; cz /= k;
      var vw = 0, vn = 0;
      for (var t = 0; t < n; t++) {
        var o = t * 9, ax = P[o], ay = P[o + 1], az = P[o + 2];
        var ux = P[o + 3] - ax, uy = P[o + 4] - ay, uz = P[o + 5] - az, wx = P[o + 6] - ax, wy = P[o + 7] - ay, wz = P[o + 8] - az;
        var fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
        var mx = (ax + P[o + 3] + P[o + 6]) / 3 - cx, my = (ay + P[o + 4] + P[o + 7]) / 3 - cy, mz = (az + P[o + 5] + P[o + 8]) / 3 - cz;
        vw += fx * mx + fy * my + fz * mz;
        var area = Math.sqrt(fx * fx + fy * fy + fz * fz);
        vn += area * ((N[o] + N[o + 3] + N[o + 6]) * mx + (N[o + 1] + N[o + 4] + N[o + 7]) * my + (N[o + 2] + N[o + 5] + N[o + 8]) * mz);
      }
      swap = vw < 0; flipN = vn < 0;
    }
    if (swap) for (var q = 0; q < n; q++) for (var j = 0; j < 3; j++) { var a1 = q * 9 + 3 + j, a2 = q * 9 + 6 + j, tp = P[a1]; P[a1] = P[a2]; P[a2] = tp; tp = N[a1]; N[a1] = N[a2]; N[a2] = tp; }
    if (flipN) for (i = 0; i < N.length; i++) N[i] = -N[i];
  }
  Part.prototype.build = function () {
    var pos = [], nor = [], onr = [], colr = [], olw = [], mr = [], tmk = [];
    this.items.forEach(function (it) {
      if (!it[7]) {   // lọc chi tiết li ti: cỡ lớn nhất của khối sau khi co giãn < MIN_BIT thì bỏ
        var bb = it[0].boundingBox || (it[0].computeBoundingBox(), it[0].boundingBox), sc0 = it[4], sx = Array.isArray(sc0) ? sc0[0] : sc0, sy = Array.isArray(sc0) ? sc0[1] : sc0, sz = Array.isArray(sc0) ? sc0[2] : sc0;
        var ex = Math.max((bb.max.x - bb.min.x) * Math.abs(sx), (bb.max.y - bb.min.y) * Math.abs(sy), (bb.max.z - bb.min.z) * Math.abs(sz));
        var e3 = [(bb.max.x - bb.min.x) * Math.abs(sx), (bb.max.y - bb.min.y) * Math.abs(sy), (bb.max.z - bb.min.z) * Math.abs(sz)], mn = Math.min(e3[0], e3[1], e3[2]);
        if (ex < MIN_BIT || (ex < .32 && mn / ex < .22 && !it[6])) { Models._drop = (Models._drop || 0) + 1; return; }   // bỏ khối vụn và mảnh mỏng (lọn tóc, lông vũ, gai nhỏ) — giữ giáp/vũ khí kim loại (flat)
      }
      var g = it[0].index ? it[0].toNonIndexed() : it[0].clone();
      var sc = it[4]; _s.set(Array.isArray(sc) ? sc[0] : sc, Array.isArray(sc) ? sc[1] : sc, Array.isArray(sc) ? sc[2] : sc);
      _m.compose(_v.set(it[2][0], it[2][1], it[2][2]), _q.setFromEuler(_e.set(it[3][0], it[3][1], it[3][2])), _s);
      g.applyMatrix4(_m);
      _c.set(it[1]);
      orient(g, _m.determinant() < 0, /Lathe|Capsule/.test(it[0].type));
      var O = g.attributes.normal.array.slice();          // pháp tuyến mượt gốc → dùng cho viền (không bị nứt ở cạnh)
      g.computeVertexNormals();                // giáp/mũ/vũ khí: pháp tuyến theo mặt (flat)
      var P = g.attributes.position.array, N = g.attributes.normal.array, m = mrOf(it[1]), w0 = it[5] ? 1 : 0;
      for (var i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); onr.push(O[i]); }
      for (var j = 0; j < P.length / 3; j++) { var jt = 1 + (((((j / 3) | 0) * 2654435761 + pos.length) >>> 7) % 13 - 6) * .0015; colr.push(_c.r * jt, _c.g * jt, _c.b * jt); olw.push(w0); mr.push(m[0], m[1]); tmk.push(TEAM[it[1]] ? 1 : 0); }
      g.dispose();
    });
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    bg.setAttribute('onrm', new THREE.Float32BufferAttribute(onr, 3));   // pháp tuyến mượt cho viền
    bg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    bg.setAttribute('olw', new THREE.Float32BufferAttribute(olw, 1)); // trọng số viền: 0 = chi tiết mảnh không viền
    bg.setAttribute('tm', new THREE.Float32BufferAttribute(tmk, 1));   // 1 = vùng màu phe (giáp, áo, áo choàng) để đổi theo skin
    bg.setAttribute('mr', new THREE.Float32BufferAttribute(mr, 2));   // kim loại / độ nhám theo đỉnh
    bg.computeBoundingSphere();
    return bg;
  };
  Part.prototype.shift = function (dx, dy, dz, sc) { this.items.forEach(function (it) { var k = sc || 1; it[2] = [it[2][0] * k + dx, it[2][1] * k + dy, it[2][2] * k + dz]; if (k !== 1) it[4] = Array.isArray(it[4]) ? it[4].map(function (v) { return v * k; }) : it[4] * k; }); return this; };
  function merge(dst, src) { src.items.forEach(function (it) { dst.items.push(it); }); }
  // đối xứng trái/phải: f(sd) với sd = 1 (trái, +X) và −1 (phải)
  function both(f) { f(1); f(-1); }

  /* ======================= BẢNG MÀU kiểu Ragnarok Online 3 ======================= */
  // tông pastel bão hòa vừa, ấm, kim loại vàng ánh hồng; da sáng ấm
  var PAL = Models.PAL = {
    dragon: { skin: '#ffd9bd', hair: '#f2643a', hair2: '#ffab5c', armor: '#d9473a', armor2: '#9e2f26', trim: '#f5c25a', cloth: '#ffe0b0', horn: '#fff1d8', eye: '#8a2d10', iris: '#ff9a3c', metal: '#e9d6b0', leather: '#8f5332', accent: '#ff8a2a', gem: '#ff9e1f' },
    human: { skin: '#ffe0c6', hair: '#9a6237', hair2: '#d9a066', armor: '#e6edf5', armor2: '#9fb4cc', trim: '#e8b84e', cloth: '#3b7fe0', horn: null, eye: '#1f2b52', iris: '#4a8ee8', metal: '#eef3f8', leather: '#8c5c36', accent: '#ffe28a', gem: '#58c8ff' },
    fairy: { skin: '#ffeadc', hair: '#78e6c8', hair2: '#ffb8e2', armor: '#f6fff9', armor2: '#b8eed6', trim: '#2fc58c', cloth: '#58d6a4', horn: null, eye: '#0f5c44', iris: '#34c99a', metal: '#d8fff2', leather: '#86c890', accent: '#8ff3ff', gem: '#ff86d6', wing: '#d4fbff', wing2: '#ffd9f2' },
    demon: { skin: '#e8dbff', hair: '#d6c6ff', hair2: '#ff62a8', armor: '#7446b0', armor2: '#4a2a7c', trim: '#ff72b6', cloth: '#9658da', horn: '#3c2358', eye: '#c0103e', iris: '#ff3d6a', metal: '#bcaee0', leather: '#4a2f66', accent: '#c88cff', gem: '#ff3d7a' }
  };
  var TEAM = {};   // màu nào thuộc vùng đổi theo skin phe
  function markTeam() { for (var i = 0; i < arguments.length; i++) if (arguments[i] && typeof arguments[i] === 'string') TEAM[arguments[i]] = 1; }
  var DARK = '#2a2236', WHITE = '#ffffff', BLUSH = '#ffb0a8', MOUTH = '#c8605a';
  (function () {
    for (var r in PAL) { var c = PAL[r]; MR[c.metal] = [.75, .28]; MR[c.trim] = [.85, .3]; MR[c.gem] = [.1, .12]; MR[c.skin] = [0, .6]; MR[c.hair] = [0, .5]; MR[c.hair2] = [0, .5]; MR[c.eye] = [0, .2]; MR[c.iris] = [0, .15]; MR[c.leather] = [0, .7]; MR[c.cloth] = [0, .9]; }
    for (var r3 in PAL) markTeam(PAL[r3].armor, PAL[r3].armor2, PAL[r3].cloth);
    for (var r2 in PAL) { var c2 = PAL[r2]; [c2.metal, c2.trim, c2.gem].forEach(function (k) { FLATC[k] = 1; }); }
    FLATC['#ffd36b'] = FLATC['#ffe76a'] = 1;
    MR[WHITE] = [0, .35]; MR[DARK] = [0, .4]; MR['#ffd36b'] = [.85, .3]; MR['#ffe76a'] = [.6, .25];
  })();

  /* ======================= ĐẦU NGƯỜI CHIBI =======================
     Toạ độ: chân y 0 → hông .30 → vai .58 → cổ .64; đầu tâm (0, HY, 0), mặt hướng +Z. */
  var HY = .87, HR = .215;
  function partHead(b, c, o) {
    b.e(HR, HR * .94, HR * .93, c.skin, 0, HY, 0, 0, 3);              // sọ tròn mịn (1280 mặt, smooth shading)
    b.e(HR * .62, HR * .42, HR * .5, c.skin, 0, HY - .085, .055, 0, 2); // má bầu + cằm
    b.t(.05, .055, .04, c.skin, 0, .655, 0);                            // cổ
  }
  function partFace(b, c, o) {
    var fz = HR * .9, ey = HY - .03;
    both(function (sd) {
      var ex = sd * .078, rot = [0, sd * .32, 0];
      // mắt anime: tròng to bo tròn, đồng tử, 2 điểm sáng
      b.x([[-.026, -.034], [.026, -.034], [.032, 0], [.026, .036], [-.026, .036], [-.032, 0]], .012, o.eye || c.eye, ex, ey, fz - .004, rot, 1, .006, 'eye');
      b.x([[-.016, -.024], [.016, -.024], [.02, 0], [.016, .02], [-.016, .02], [-.02, 0]], .006, o.iris || c.iris, ex, ey - .006, fz + .006, rot, 1, .003, 'iris');
      b.e(.011, .013, .006, WHITE, ex + sd * -.009, ey + .016, fz + .012, 0, 0);
      b.e(.006, .006, .004, WHITE, ex + sd * .01, ey - .012, fz + .012, 0, 0);
      b.x([[-.03, 0], [.03, .006], [.03, .014], [-.03, .008]], .006, o.brow || c.hair, ex, ey + .055, fz - .006, [0, sd * .3, sd * -.12], 1, .002, 'brow');   // lông mày
      b.e(.03, .014, .006, BLUSH, sd * .118, HY - .088, fz - .025, [0, sd * .5, 0], 0);    // má hồng
    });
    b.x([[-.014, 0], [.014, 0], [.008, -.01], [-.008, -.01]], .006, MOUTH, 0, HY - .118, fz + .002, 0, 1, .002, 'mouth');   // miệng
  }
  // tóc: chỏm + mái + tóc mai + đuôi, kiểu theo tộc
  function partHair(b, c, o) {
    var hc = o.hairColor || c.hair, h2 = o.hair2 || c.hair2, st = o.hairStyle || 'short';
    b.e(HR * 1.08, HR * .96, HR * 1.05, hc, 0, HY + .035, -.022, 0, 1);       // chỏm tóc phủ đỉnh và gáy
    // mái: các lọn hình giọt nước ôm theo vòng trán
    // mái tóc kiểu Minecraft: một khối ngang trán + hai mảng tóc mai, không còn lọn nhỏ
    b.k(HR * 1.78, .075, .12, hc, 0, HY + .105, HR * .86, [-.12, 0, 0], .008);
    both(function (sd) { b.k(.06, .17, .13, hc, sd * HR * .93, HY - .0, .02, 0, .008); });
    if (st === 'spiky') { // Rồng: tóc dựng nhọn hất ra sau
      [[0, .22, -.04, -.5, 0], [.11, .17, -.08, -.8, -.5], [-.11, .17, -.08, -.8, .5]].forEach(function (q, i) { b.n(.075, .2, i % 2 ? h2 : hc, q[0], HY + q[1], q[2], [q[3], 0, q[4]], 5); });
    } else if (st === 'long') { // Tiên: tóc dài mềm chảy sau lưng
      [[-.1, -.12], [-.035, -.14], [.035, -.14], [.1, -.12]].forEach(function (q, i) { b.c(.045, .03, .26, i % 2 ? h2 : hc, q[0], HY + q[1] - .02, -.17, [.25, 0, q[0] * .8], 6); });
      both(function (sd) { b.c(.035, .022, .22, hc, sd * .2, HY - .12, -.03, [.1, 0, sd * .08], 6); });
    } else if (st === 'messy') { // Quỷ: lọn rối chĩa ngang
      [[.17, .1, -.05, .9], [-.17, .1, -.05, -.9], [0, .2, -.13, 0]].forEach(function (q, i) { b.n(.07, .17, i % 2 ? h2 : hc, q[0], HY + q[1], q[2], [-.6, 0, -q[3]], 5); });
      b.e(HR * .95, HR * .7, HR * .5, hc, 0, HY - .04, -.13, 0, 1);
    } else { // ngắn gọn
      b.e(HR * .98, HR * .65, HR * .55, hc, 0, HY - .03, -.12, 0, 1);
    }
    if (o.ponytail) { b.e(.04, .04, .04, c.trim, 0, HY + .06, -.21, 0, 0); b.c(.06, .03, .26, hc, 0, HY - .07, -.27, [.5, 0, 0], 6); }
  }
  function partEars(b, c, o) {
    if (o.ears === 'elf') both(function (sd) { b.x([[0, -.03], [.14, .05], [.02, .03]], .025, c.skin, sd * .2, HY + .01, -.01, [0, sd > 0 ? -.3 : PI + .3, 0], [1, 1, 1], .008, 'elf'); });
    else both(function (sd) { b.e(.028, .04, .02, c.skin, sd * .21, HY - .01, 0, [0, sd * .3, 0], 0); });
  }
  // sừng: chuỗi chóp cong (Rồng cong ra sau, Quỷ xoắn lên)
  function partHorns(b, c, o) {
    var hc = o.hornColor || c.horn, s = o.hornSize || 1, curl = o.hornCurl || 'back';
    both(function (sd) {
      var x = sd * .12, y = HY + .16, z = -.02;
      b.n(.055 * s, .17 * s, hc, x, y, z, curl === 'up' ? [-.15, 0, -sd * .4] : [-.7, 0, -sd * .3], 6);
      b.n(.04 * s, .12 * s, hc, x + sd * (curl === 'up' ? .03 : .012) * s, y + (curl === 'up' ? .12 : .08) * s, z + (curl === 'up' ? -.01 : -.07) * s, curl === 'up' ? [-.15, 0, -sd * .75] : [-1.2, 0, -sd * .25], 6);
    });
  }
  /* ---------- mũ giáp ---------- */
  function partHelm(b, c, o) {
    var hm = o.helmet || 'hair';
    var dome = function (col, r, y) { b.l([[0, r * 1.02], [r * .55, r * .9], [r * .86, r * .58], [r * 1.02, r * .18], [r * 1.05, -r * .05], [r * .98, -r * .12]], 10, col, 0, y, -.01); };
    if (hm === 'cap') { dome(o.capColor || c.cloth, HR * 1.12, HY + .02); b.e(HR * .8, .022, .11, c.trim, 0, HY + .02, HR * .9, [-.1, 0, 0], 1); b.e(.03, .03, .03, c.trim, 0, HY + .26, -.01, 0, 0); }
    if (hm === 'full') { // mũ trụ kín, khe mắt, sống mũ
      var hcol = o.helmColor || c.armor;
      b.l([[0, .27], [.13, .25], [.22, .17], [.25, .04], [.25, -.1], [.21, -.18], [.15, -.2]], 10, hcol, 0, HY, 0);
      b.x([[-.15, -.012], [.15, -.012], [.13, .012], [-.13, .012]], .02, DARK, 0, HY - .005, .235, [-.08, 0, 0], 1, .004, 'visor');
      b.x([[-.012, 0], [.012, 0], [.02, .26], [-.02, .26]], .03, c.trim, 0, HY - .02, .0, [-PI / 2 + .02, 0, 0], [1, 1, 1], .008, 'ridge');
      b.x([[0, -.12], [.02, 0], [0, .14], [-.02, 0]], .14, c.trim, 0, HY + .24, -.03, [0, PI / 2, 0], 1, .01, 'fin');
    }
    if (hm === 'plume' || hm === 'crest' || hm === 'horned') { // mũ hở mặt + má giáp + chùm lông / mào
      dome(o.helmColor || c.armor, HR * 1.1, HY + .03);
      b.a(TOR(.225, .016, 4, 12), c.trim, [0, HY + .04, -.005], [PI / 2, 0, 0], [1, 1.02, 1]);
      both(function (sd) { b.x([[0, .06], [.05, .03], [.04, -.08], [0, -.1]], .02, o.helmColor || c.armor, sd * .2, HY - .04, .05, [0, sd * .5, 0], [sd, 1, 1], .006, 'cheek'); });
      if (hm === 'plume') { [[0, .3, -.06, -.3], [0, .33, -.15, -.9], [0, .26, -.22, -1.4]].forEach(function (q, i) { b.x([[0, 0], [.035, .05], [.03, .16], [0, .2], [-.03, .16], [-.035, .05]], .03, i === 1 ? WHITE : (o.plume || c.cloth), q[0], HY + q[1] - .1, q[2], [q[3], 0, 0], 1, .008, 'feather'); }); }
      else if (hm === 'crest') b.x([[-.16, 0], [-.1, .1], [.06, .14], [.16, .02], [.12, -.02]], .025, o.plume || c.accent, 0, HY + .24, -.04, [0, PI / 2, 0], 1, .008, 'crest');
      else partHorns(b, c, Object.assign({}, o, { hornSize: o.hornSize || 1.5, hornCurl: 'up' }));
    }
    if (hm === 'hood') { // mũ trùm: vòm sau đầu, hở mặt, chóp rủ sau gáy
      var hd = o.hoodColor || c.cloth;
      b.a(LA([[0, .27], [.14, .25], [.23, .16], [.255, .02], [.24, -.14], [.2, -.24]], 10, PI * .3, PI * 1.4), hd, [0, HY, -.02], 0, [1, 1, 1.05]); // vòm trùm hở mặt
      b.a(TOR(.2, .03, 4, 12, PI * .55), hd, [0, HY - .01, .035], [0, 0, PI * .225 + PI / 2]); // viền mép mũ quanh mặt
      b.n(.07, .22, hd, 0, HY + .12, -.26, [-1.9, 0, 0], 6);
    }
    if (hm === 'wizard') { // mũ phù thủy: vành rộng + chóp gập
      var hat = o.hatColor || c.cloth;
      // MŨ CAO (silhouette pháp sư): vành rộng + chóp rất cao gập về sau
      b.l([[0, .016], [.34, .01], [.37, -.004], [.35, -.016], [0, -.016]], 16, hat, 0, HY + .17, 0);
      b.l([[.2, 0], [.18, .12], [.15, .22], [.12, .28], [0, .29]], 12, hat, 0, HY + .17, -.01);
      b.l([[.125, 0], [.1, .12], [.07, .22], [.045, .28], [0, .3]], 10, hat, .01, HY + .45, -.03, [-.18, 0, .06]);
      b.l([[.05, 0], [.035, .08], [.018, .14], [0, .16]], 8, hat, .04, HY + .72, -.1, [-.75, 0, .3]);
      b.e(.03, .03, .03, c.trim, .06, HY + .79, -.22, 0, 1);
      b.a(TOR(.19, .022, 4, 14), c.trim, [0, HY + .19, -.01], [PI / 2, 0, 0]);
      b.x([[0, -.03], [.03, 0], [0, .03], [-.03, 0]], .015, c.gem || c.accent, .12, HY + .28, .15, [0, .4, 0], 1, .004, 'gem');
    }
    if (hm === 'brim') { // MŨ RỘNG VÀNH (silhouette tu sĩ): vành rất rộng, chỏm thấp tròn, dải ruy băng
      var bh = o.hatColor || c.cloth;
      b.l([[0, .018], [.4, .008], [.45, -.012], [.43, -.026], [0, -.02]], 18, bh, 0, HY + .14, -.01, [-.08, 0, 0]);
      b.l([[0, .17], [.12, .16], [.19, .11], [.215, .04], [.22, 0]], 14, bh, 0, HY + .14, -.01);
      b.a(TOR(.218, .024, 6, 16), o.bandColor || c.trim, [0, HY + .17, -.01], [PI / 2, 0, 0]);
      b.x([[0, 0], [.05, -.02], [.04, -.22], [0, -.18], [-.03, -.24]], .016, o.bandColor || c.trim, -.14, HY + .14, -.2, [0, .6, 0], 1, .005, 'ribbon');
      b.x([[0, -.035], [.03, 0], [0, .035], [-.03, 0]], .02, c.gem || c.accent, 0, HY + .2, .21, [-.2, 0, 0], 1, .006, 'gem');
    }
    if (hm === 'crown') { b.l([[.17, -.02], [.18, .05], [.17, .06]], 12, c.trim, 0, HY + .21, -.01); for (var i = 0; i < 6; i++) { var a = i / 6 * PI * 2; b.n(.03, .07, c.trim, Math.sin(a) * .17, HY + .3, Math.cos(a) * .17 - .01, 0, 5); } b.e(.025, .025, .02, c.gem, 0, HY + .25, .17, 0, 0); }
    if (hm === 'tiara') { b.a(TOR(.2, .013, 4, 12, PI), c.trim, [0, HY + .1, -.01], [-.25, 0, 0]); b.x([[0, -.035], [.025, 0], [0, .035], [-.025, 0]], .015, c.gem, 0, HY + .19, .185, [-.3, 0, 0], 1, .004, 'gem'); }
    if (hm === 'band') b.a(TOR(.215, .022, 4, 14), o.bandColor || c.cloth, [0, HY + .08, -.01], [PI / 2 - .15, 0, 0]);
  }
  /* ---------- thân, tay, chân ---------- */
  function partTorso(b, c, o) {
    var tc = o.torsoColor || FAC(c);     // màu phe trên vùng lớn (thân áo)
    b.l([[0, .29], [.12, .3], [.145, .34], [.13, .42], [.14, .5], [.155, .57], [.12, .62], [.05, .645], [0, .65]], 9, tc, 0, 0, 0, 0, [1, 1, .78]); // thân tiện: ngực–eo–hông
    b.a(TOR(.128, .022, 4, 12), o.beltColor || c.leather, [0, .335, 0], [PI / 2, 0, 0], [1, .78, 1]);                                   // thắt lưng
    b.x([[-.03, -.025], [.03, -.025], [.035, .025], [-.035, .025]], .02, c.trim, 0, .335, .1, 0, 1, .006, 'buckle');
    if (o.chest) flat(function () { b.e(.115, .08, .05, o.chest, 0, .51, .085, [-.1, 0, 0], 1); });                                    // giáp ngực
    if (o.tabard) b.x([[-.08, .16], [.08, .16], [.09, -.06], [0, -.1], [-.09, -.06]], .015, o.tabard, 0, .38, .1, [-.05, 0, 0], 1, .005, 'tabard');
    if (o.heavy || o.pauldrons) flat(function () {
      var k = o.bigShoulder ? 1.75 : 1.15, pcol = o.pauldronColor || c.armor2;   // vai to: silhouette quân khiên
      both(function (sd) {
        b.l([[0, .075], [.06, .068], [.095, .03], [.105, -.012], [.09, -.03]], 10, pcol, sd * (.18 + (k - 1) * .06), .6 + (k - 1) * .02, 0, [0, 0, -sd * .4], [k, k, k * 1.1]);
        b.a(TOR(.1, .016, 4, 12), c.trim, [sd * (.195 + (k - 1) * .065), .59 + (k - 1) * .01, 0], [PI / 2, sd * .4, 0], [k, k * 1.1, k]);
        if (o.bigShoulder) { b.l([[0, .06], [.07, .05], [.08, 0], [.06, -.02]], 10, pcol, sd * .245, .53, 0, [0, 0, -sd * .7], [1.3, 1, 1.3]); b.n(.035, .1, c.trim, sd * .3, .7, 0, [0, 0, -sd * .55], 6); }
      });
    });
    if (o.longCape) b.x([[-.16, 0], [.16, 0], [.22, -.5], [.12, -.56], [0, -.6], [-.12, -.56], [-.22, -.5]], .022, o.longCape, 0, .62, -.13, [.1, 0, 0], 1, .008, 'capeL'); // áo choàng dài (tu sĩ)
    if (o.cape) b.x([[-.14, 0], [.14, 0], [.17, -.38], [.06, -.34], [0, -.4], [-.06, -.34], [-.17, -.38]], .02, o.cape, 0, .62, -.115, [.08, 0, 0], 1, .006, 'capeS');
    if (o.tail) { var tz = -.12, ty = .3, ts = .055; for (var i = 0; i < 4; i++) { b.e(ts, ts, ts * 1.4, i % 2 ? (o.tail2 || o.tail) : o.tail, 0, ty, tz, [.4 + i * .2, 0, 0], 1); tz -= .07; ty -= .035; ts *= .82; } b.n(.035, .08, c.trim, 0, ty + .01, tz + .02, [-2.2, 0, 0], 5); }
    if (o.robe) { // áo choàng dài loe xuống
      var rc = o.robeColor || c.cloth;
      b.l([[.13, .36], [.16, .26], [.2, .14], [.23, .04], [.235, .01], [0, .01]], 10, rc, 0, 0, 0, 0, [1, 1, .85]);
      b.a(TOR(.232, .018, 4, 14), c.trim, [0, .025, 0], [PI / 2, 0, 0], [1, .85, 1]);
    }
  }
  /* tay chân CHIBI: ngắn, mập, thon dần về cổ tay/cổ chân; bàn tay, bàn chân to (~1.3×) — capsule mượt.
     Tay: vai (khớp tròn) → bắp tay → cẳng tay → bàn tay "găng" to. Bàn tay ở y = −.255 so với vai. */
  function limbArm(a, c, o, x, y, z, rx, rz) {
    var sl = o.sleeve || c.armor, sl2 = o.sleeve2 || sl, gl = o.glove || c.skin;
    a.e(.074, .07, .074, sl, x, y - .01, z, 0, 2);                                                   // khớp vai tròn
    a.t(.064, .072, .085, sl, x + rz * .02, y - .075, z + rx * .01, [rx * .6, 0, rz]);               // bắp tay
    a.t(.056, .064, .07, sl2, x + rz * .04, y - .16, z + rx * .04, [rx, 0, rz * .6]);               // cẳng tay (thon về cổ tay)
    a.a(TOR(.056, .016, 6, 12), o.cuff || c.trim, [x + rz * .05, y - .195, z + rx * .05], [PI / 2 + rx, 0, rz * .6]); // cổ tay áo
    a.e(.062, .058, .066, gl, x + rz * .05, y - .25, z + .02 + rx * .06, 0, 2);                      // bàn tay to
    a.e(.026, .03, .026, gl, x + rz * .05 + (x > 0 ? -.042 : .042), y - .235, z + .05 + rx * .06, 0, 1); // ngón cái
  }
  function partArmL(b, c, o) { limbArm(b, c, o, .2, .575, .0, -.35, .12); }   // tay trái tĩnh (cầm khiên/cung), đưa ra trước
  function partArmR(c, o) { // tay phải (vung vũ khí), trục ở vai
    var a = new Part([-.2, .575, 0]);
    limbArm(a, c, o, 0, 0, 0, .1, 0);
    return a;
  }
  function partLegs(c, o) {
    var L = new Part([.08, .3, 0]), R = new Part([-.08, .3, 0]);
    [L, R].forEach(function (p) {
      var lc = o.legColor || c.armor2, bt = o.boot || c.leather;
      p.t(.07, .078, .08, lc, 0, -.065, 0);                                                                                   // đùi mập
      p.l([[0, -.07], [.074, -.07], [.08, -.03], [.076, .02], [.07, .055], [0, .055]], 12, bt, 0, -.205, 0);                 // ống ủng
      p.a(TOR(.074, .016, 6, 12), c.trim, [0, -.15, 0], [PI / 2, 0, 0]);                                                      // viền ủng
      p.e(.078, .055, .11, bt, 0, -.255, .04, 0, 2);                                                                          // bàn chân to
    });
    return [L, R];
  }
  /* ---------- vũ khí (trong bộ phận tay phải; bàn tay y = −.26, mũi hướng +Z) ----------
     Bản DÀY, khối liền mạch: lưỡi rộng có gờ giữa, chuôi to, đốc/khâu rõ — nhìn xa vẫn nhận ra hình dáng. */
  var BLADE = function (w, len) { return [[-w * .5, 0], [w * .5, 0], [w * .58, len * .62], [w * .3, len * .9], [0, len], [-w * .3, len * .9], [-w * .58, len * .62]]; };
  var HY0 = -.26;
  var W = {
    sword: function (a, c, len, broad) {
      len = len || .46; var w = broad ? .12 : .095;
      a.x(BLADE(w, len), .036, c.metal, 0, HY0, .085, [PI / 2, 0, 0], 1, .012, 'blade' + w + len);                       // lưỡi dày
      a.x(BLADE(w * .28, len * .8), .05, c.trim, 0, HY0, .09, [PI / 2, 0, 0], 1, .008, 'fuller' + w + len);               // gờ giữa
      a.x([[-.11, -.025], [.11, -.025], [.135, 0], [.11, .03], [-.11, .03], [-.135, 0]], .06, c.trim, 0, HY0, .075, [PI / 2, 0, 0], 1, .014, 'guard2'); // chắn tay
      a.t(.03, .03, .07, c.leather, 0, HY0, .02, [PI / 2, 0, 0]);                                                           // chuôi
      a.e(.042, .042, .042, c.gem || c.trim, 0, HY0, -.045, 0, 1);                                                          // đốc
    },
    spear: function (a, c, len) {
      len = len || .9;
      a.t(.028, .028, len, c.leather, 0, HY0, .22, [PI / 2, 0, 0]);
      var tip = .22 + len / 2;
      a.x([[0, 0], [.08, .06], [.07, .14], [0, .3], [-.07, .14], [-.08, .06]], .04, c.metal, 0, HY0, tip - .03, [PI / 2, 0, 0], 1, .012, 'leaf2');
      a.l([[0, -.04], [.045, -.035], [.05, 0], [.04, .04], [0, .05]], 10, c.trim, 0, HY0, tip - .04, [PI / 2, 0, 0]);       // khâu
      a.x([[0, 0], [.1, -.02], [.08, -.08], [0, -.06]], .012, c.cloth, 0, HY0 + .03, tip - .08, [0, -PI / 2, 0], 1, .004, 'tassel');
    },
    hammer: function (a, c) {
      a.t(.03, .03, .44, c.leather, 0, HY0, .15, [PI / 2, 0, 0]);
      a.l([[0, -.11], [.09, -.105], [.11, -.07], [.11, .07], [.09, .105], [0, .11]], 10, c.metal, 0, HY0, .4, [0, 0, PI / 2]); // đầu búa to
      both(function (sd) { a.a(TOR(.1, .02, 6, 12), c.trim, [sd * .07, HY0, .4], [0, PI / 2, 0]); });
      a.n(.04, .1, c.trim, 0, HY0, .54, [PI / 2, 0, 0], 6);
    },
    axe: function (a, c, s) {
      s = s || 1;
      a.t(.03 * s, .03 * s, .58 * s, c.leather, 0, HY0, .2 * s, [PI / 2, 0, 0]);
      a.x([[0, -.06], [.08, -.15], [.21, -.13], [.17, 0], [.21, .13], [.08, .15], [0, .06]], .045 * s, c.metal, 0, HY0, .43 * s, [0, -PI / 2, 0], s, .014, 'axe2');
      a.x([[0, -.04], [.06, -.08], [.1, 0], [.06, .08], [0, .04]], .04 * s, c.metal, 0, HY0, .43 * s, [0, PI / 2, 0], s, .012, 'axeb');
      a.e(.045 * s, .045 * s, .045 * s, c.trim, 0, HY0, .45 * s, 0, 1);
    },
    dagger: function (a, c) {
      a.x(BLADE(.075, .24), .03, c.metal, 0, HY0, .06, [PI / 2, 0, 0], 1, .01, 'dagger2');
      a.x([[-.07, -.018], [.07, -.018], [.08, 0], [.07, .018], [-.07, .018], [-.08, 0]], .045, c.trim, 0, HY0, .055, [PI / 2, 0, 0], 1, .01, 'dg2');
      a.t(.026, .026, .05, c.leather, 0, HY0, .02, [PI / 2, 0, 0]); a.e(.032, .032, .032, c.trim, 0, HY0, -.02, 0, 1);
    },
    staff: function (a, c, orb, top) {
      a.t(.026, .03, .82, c.leather, 0, -.12, .07, [-.12, 0, 0]);
      a.a(TOR(.034, .012, 6, 10), c.trim, [0, -.42, .03], [PI / 2 - .12, 0, 0]);
      var ty = .31, tz = .12;
      a.l([[0, -.06], [.04, -.05], [.055, 0], [.03, .02], [0, .02]], 10, c.trim, 0, ty - .07, tz - .01);                  // đế đỡ
      if (top === 'crystal') { a.a(gk('oct', function () { return new THREE.OctahedronGeometry(1, 0); }), orb, [0, ty + .04, tz], [0, .4, 0], [.08, .15, .08]); both(function (sd) { a.n(.03, .12, c.trim, sd * .065, ty - .03, tz, [0, 0, sd * .5], 5); }); }
      else if (top === 'skull') { a.e(.08, .074, .08, '#f3e8d2', 0, ty + .02, tz, 0, 2); a.e(.054, .034, .054, '#f3e8d2', 0, ty - .04, tz + .02, 0, 1); both(function (sd) { a.e(.02, .024, .012, orb, sd * .032, ty + .025, tz + .07, 0, 0); a.n(.022, .1, '#f3e8d2', sd * .07, ty + .08, tz - .01, [0, 0, -sd * .6], 5); }); }
      else if (top === 'flower') { for (var i = 0; i < 5; i++) { var an = i / 5 * PI * 2; a.x([[0, 0], [.045, .05], [0, .1], [-.045, .05]], .022, '#ffb8e2', Math.sin(an) * .012, ty + .03 + Math.cos(an) * .012, tz, [0, 0, an], 1, .008, 'petal2'); } a.e(.036, .036, .036, '#fff36b', 0, ty + .03, tz + .015, 0, 1); }
      else if (top === 'cross') { a.x([[-.026, -.1], [.026, -.1], [.026, .03], [.08, .03], [.08, .075], [.026, .075], [.026, .14], [-.026, .14], [-.026, .075], [-.08, .075], [-.08, .03], [-.026, .03]], .045, c.trim, 0, ty, tz, 0, 1, .012, 'cross2'); a.e(.03, .03, .026, orb, 0, ty + .05, tz + .03, 0, 1); }
      else { a.e(.075, .075, .075, orb, 0, ty + .03, tz, [.4, .6, 0], 2); a.a(TOR(.07, .016, 6, 12), c.trim, [0, ty - .02, tz], [PI / 2, 0, 0]); both(function (sd) { a.n(.02, .1, c.trim, sd * .055, ty + .01, tz, [0, 0, sd * .6], 5); }); }
    },
    lance: function (a, c) {
      a.l([[0, 0], [.075, .02], [.05, .22], [.026, .9], [0, 1.02]], 10, c.metal, 0, HY0, .02, [PI / 2, 0, 0]);
      a.l([[0, -.03], [.11, -.04], [.1, .04], [0, .05]], 12, c.trim, 0, HY0, .06, [PI / 2, 0, 0]);                           // chắn tay hình phễu
      a.x([[0, 0], [.16, -.04], [.0, -.1]], .014, c.cloth, 0, HY0 + .05, .76, [0, -PI / 2, 0], 1, .005, 'pennant2');
    }
  };
  // mọi vũ khí dựng ở chế độ mặt phẳng (flat) → tương phản với da/vải mượt
  Object.keys(W).forEach(function (k) { var f = W[k]; W[k] = function () { var ar = arguments; flat(function () { f.apply(null, ar); }); }; });
  // khiên ép đùn DÀY có viền + huy hiệu (đeo tay trái, x ≈ .28); màu phe ở mặt khiên (vùng lớn)
  var SHIELD = {
    kite: [[0, -.19], [.11, -.06], [.13, .1], [.08, .15], [-.08, .15], [-.13, .1], [-.11, -.06]],
    round: (function () { var p = []; for (var i = 0; i < 14; i++) { var a = i / 14 * PI * 2; p.push([Math.sin(a) * .145, Math.cos(a) * .145]); } return p; })(),
    tower: [[-.17, -.26], [.17, -.26], [.19, -.22], [.19, .22], [.13, .27], [-.13, .27], [-.19, .22], [-.19, -.22]],
    leaf: [[0, -.18], [.09, -.09], [.135, .04], [.07, .15], [0, .19], [-.07, .15], [-.135, .04], [-.09, -.09]],
    spike: [[0, -.16], [.14, -.08], [.14, .08], [0, .16], [-.14, .08], [-.14, -.08]]
  };
  function shield(b, c, kind, col) {
    flat(function () {
      col = col || c.armor2; var pts = SHIELD[kind] || SHIELD.round, x = kind === 'tower' ? .17 : .29, y = kind === 'tower' ? .36 : .34, z = kind === 'tower' ? .21 : .14, ry = kind === 'tower' ? -.12 : -.6, rz = kind === 'spike' ? PI / 6 : 0;
      b.x(pts, .05, c.trim, x, y, z - .01, [0, ry, rz], 1.1, .014, 'sh2' + kind + 'r');            // viền kim loại
      b.x(pts, .05, col, x, y, z + .008, [0, ry, rz], 1, .016, 'sh2' + kind);                      // mặt khiên màu phe
      var fx = x + Math.sin(ry) * .04, fz = z + Math.cos(ry) * .04;
      if (kind === 'spike') b.n(.05, .12, c.trim, fx, y, fz, [PI / 2, 0, 0], 6);
      else { b.x([[0, -.06], [.05, 0], [0, .06], [-.05, 0]], .035, c.trim, fx, y + (kind === 'kite' ? .03 : 0), fz, [0, ry, 0], kind === 'tower' ? 1.4 : 1.05, .01, 'emb2'); b.e(.025, .025, .02, c.gem, fx + Math.sin(ry) * .02, y + (kind === 'kite' ? .03 : 0), fz + Math.cos(ry) * .02, 0, 1); }
    });
  }
  // cung: thân cung dày + nắm giữa + dây
  function bow(b, col, c) {
    flat(function () {
      b.a(TUBE([[.28, .6, .13], [.3, .49, .21], [.3, .37, .24], [.3, .25, .21], [.28, .14, .13]], .026, 12), col, [0, 0, 0]);
      b.e(.034, .05, .034, c ? c.leather : '#8f5332', .3, .37, .24, 0, 1);
      both(function (sd) { b.n(.026, .06, c ? c.trim : '#f5c25a', .28, .37 + sd * .245, .12, [sd > 0 ? 0 : PI, 0, 0], 5); });
    });
    b.c(.006, .006, .44, '#fff4dc', .28, .37, .13, 0, 4);
  }
  /* ---------- cánh (ép đùn) — trái (wing = 1) về +X, phải về −X ---------- */
  function wingParts(c, kind, size, y, z) {
    size = size || 1; y = y || .5; z = z || -.12;
    var L = new Part([.07, y, z]), R = new Part([-.07, y, z]);
    var col = kind === 'bat' ? (c.armor2 || '#5a2a88') : (c.wing || '#ffffff'), col2 = kind === 'bat' ? (c.accent || '#9b5be0') : (c.wing2 || col);
    [[L, 1], [R, -1]].forEach(function (pp) {
      var p = pp[0], sd = pp[1], s = size, rot = [0, sd > 0 ? 0 : PI, 0];
      if (kind === 'bat') {
        p.x([[0, .02], [.18, .14], [.4, .12], [.36, -.02], [.3, -.12], [.22, -.05], [.15, -.14], [.08, -.06], [0, -.08]], .02, col, 0, 0, 0, rot, s, .006, 'batw');
        p.a(TUBE([[0, .02, 0], [.18, .14, 0], [.4, .12, 0]], .016, 6), col2, [0, 0, 0], rot, s);
      } else if (kind === 'bird') {
        for (var i = 0; i < 4; i++) p.x([[0, -.03], [.2, 0], [.3 - i * .03, .03], [.2, .05], [0, .03]], .02, i % 2 ? col2 : col, .02 + i * .06, .04 - i * .035, 0, [0, rot[1], sd * (.25 - i * .12)], s, .006, 'feather' + i);
      } else { // cánh tiên: hai cánh hoa trong suốt nhẹ
        p.x([[0, 0], [.12, .12], [.22, .2], [.2, .06], [.08, -.01]], .01, col, 0, .02, 0, rot, s, .004, 'fw1');
        p.x([[0, 0], [.14, -.04], [.16, -.14], [.06, -.1]], .01, col2, 0, -.01, 0, rot, s, .004, 'fw2');
      }
      p.wing = sd;
    });
    return [L, R];
  }

  /* ======================= NGƯỜI LÍNH HOÀN CHỈNH ======================= */
  var GEN = false; // đang dựng TƯỚNG: to hơn, áo choàng bay, giáp vai vàng, chùm lông, huy hiệu
  // màu nhận diện phe cho vùng lớn (áo, khiên, áo choàng)
  function FAC(c) { return c === PAL.human || c === PAL.fairy ? c.cloth : c.armor; }
  var CAPE = { dragon: '#c33a2a', human: '#2f6ad0', fairy: '#ffffff', demon: '#3a1d63' };
  for (var cr in CAPE) markTeam(CAPE[cr]);
  var RACE_OPT = function (race, c) { return { dragon: { horns: 1, tail: c.armor, tail2: c.armor2, hairStyle: 'spiky', ears: 'round' }, human: { hairStyle: 'short', ears: 'round' }, fairy: { ears: 'elf', hairStyle: 'long' }, demon: { horns: 1, hornColor: c.horn, hornCurl: 'up', hairStyle: 'messy', ears: 'elf' } }[race]; };
  // chibi: phóng đầu (và tóc, mũ, sừng...) lên 1.3 lần quanh cổ → đầu to, thân nhỏ
  function chibiHead(b, i0) { var k = 1.3, ny = .62; for (var i = i0; i < b.items.length; i++) { var it = b.items[i]; it[2] = [it[2][0] * k, ny + (it[2][1] - ny) * k, it[2][2] * k]; it[4] = Array.isArray(it[4]) ? it[4].map(function (v) { return v * k; }) : it[4] * k; } }
  function humanoid(race, o) {
    var c = PAL[race], body = new Part(), ro = RACE_OPT(race, c);
    for (var k in ro) if (o[k] == null) o[k] = ro[k];
    markTeam(o.torsoColor, o.robeColor, o.hatColor, o.sleeve, o.hoodColor, o.cape, o.legColor, o.tabard, o.bandColor);
    var genCape = null;
    if (GEN) { o.pauldrons = 1; genCape = o.cape || CAPE[race]; o.cape = null; }
    partTorso(body, c, o); var hi0 = body.items.length; partHead(body, c, o); keep(function () { partFace(body, c, o); }); partEars(body, c, o);
    var hm = o.helmet || 'hair';
    if (hm !== 'full' && hm !== 'hood') partHair(body, c, o);
    if (/^(full|plume|crest|horned|crown|tiara|cap)$/.test(hm)) flat(function () { partHelm(body, c, o); }); else partHelm(body, c, o);
    if (o.horns && hm !== 'full' && hm !== 'horned') partHorns(body, c, o);
    if (o.mask) body.x([[-.15, 0], [.15, 0], [.13, -.07], [0, -.09], [-.13, -.07]], .02, o.mask, 0, HY - .06, HR * .92, 0, 1, .006, 'mask');
    if (o.halo) body.a(TOR(.13, .018, 6, 18), '#ffe76a', [0, HY + (hm === 'brim' ? .42 : .33), 0], [PI / 2, 0, 0]);
    if (o.beard) body.x([[-.1, .02], [.1, .02], [.08, -.08], [.03, -.16], [0, -.18], [-.03, -.16], [-.08, -.08]], .05, o.beard, 0, HY - .1, HR * .78, [-.1, 0, 0], 1, .012, 'beard');
    chibiHead(body, hi0);
    partArmL(body, c, o);
    var arm = partArmR(c, o), parts = { body: body, armR: arm };
    if (!o.robe) { var legs = partLegs(c, o); parts.legL = legs[0]; parts.legR = legs[1]; }
    if (race === 'fairy' && o.wings !== false) { var w = wingParts(c, 'fairy', 1, .52, -.1); parts.wingL = w[0]; parts.wingR = w[1]; }
    if (GEN) {
      var pc = { dragon: '#ffd23a', human: '#ff5d5d', fairy: '#8ff7ff', demon: '#ff5fa8' }[race];
      both(function (sd) { body.e(.03, .03, .03, c.gem, sd * .19, .655, .06, 0, 0); });
      body.x([[0, -.06], [.05, 0], [0, .06], [-.05, 0]], .02, c.trim, 0, .5, .115, 0, 1, .006, 'emb'); body.e(.022, .022, .015, c.gem, 0, .5, .13, 0, 0);
      if (hm !== 'wizard' && hm !== 'crown' && hm !== 'plume' && hm !== 'brim') { body.x([[0, 0], [.035, .05], [.03, .17], [0, .21], [-.03, .17], [-.035, .05]], .035, pc, 0, HY + .2, -.08, [-.45, 0, 0], 1, .01, 'feather'); body.x([[0, 0], [.025, .04], [.02, .12], [0, .15], [-.02, .12], [-.025, .04]], .03, WHITE, 0, HY + .2, -.14, [-1, 0, 0], 1, .008, 'feather2'); }
      // áo choàng: bộ phận riêng để bay theo gió khi chạy
      var cp = new Part([0, .61, -.11]);
      cp.x([[-.17, 0], [.17, 0], [.2, -.46], [.1, -.42], [0, -.5], [-.1, -.42], [-.2, -.46]], .024, genCape, 0, 0, 0, [.04, 0, 0], 1, .008, 'capeG');
      cp.x([[-.2, -.44], [.2, -.44], [.22, -.5], [.1, -.46], [0, -.53], [-.1, -.46], [-.22, -.5]], .026, c.trim, 0, 0, .002, [.04, 0, 0], 1, .006, 'capeT');
      cp.a(TOR(.12, .03, 4, 10, PI), genCape, [0, .0, .05], [PI / 2, 0, 0], [1.3, 1, 1]);
      both(function (sd) { cp.e(.025, .025, .015, c.trim, sd * .12, .0, .09, 0, 0); });
      parts.cape = cp;
    }
    return { parts: parts, c: c, body: body, arm: arm };
  }

  /* ======================= THÚ 4 CHÂN ======================= */
  function quad(o) {
    var body = new Part(), legs = [], L = o.len || .62, H = o.h || .44, Wd = o.w || .3, T = o.t || .3, c1 = o.color, c2 = o.color2 || o.color;
    var by = H + T / 2 - .03;
    body.e(Wd / 2 * 1.05, T / 2, L / 2, c1, 0, by, 0, 0, 1);                   // thân
    body.e(Wd / 2 * 1.08, T / 2 * 1.02, L / 4, c1, 0, by + .01, L * .28, 0, 1); // ngực
    if (o.belly) body.e(Wd / 2 * .85, T / 4, L / 2 * .8, o.belly, 0, by - T * .28, 0, 0, 1);
    var hz = L / 2, hy = H + T;
    var headY = hy + .2 * (o.neckLen || 1), headZ = hz + .12;
    if (o.neck !== false) body.c(Wd * .3, Wd * .26, .3 * (o.neckLen || 1), c1, 0, hy + .04, hz - .02, [.55, 0, 0], 6);
    if (o.headKind === 'reptile') {
      body.e(Wd * .42, .1, .15, c1, 0, headY, headZ, 0, 1); body.e(Wd * .34, .065, .12, c2, 0, headY - .04, headZ + .13, 0, 1);
      both(function (sd) { body.n(.025, .13, o.horn || '#fff1d8', sd * .07, headY + .1, headZ - .08, [-1.1, 0, -sd * .2], 5); body.e(.012, .008, .01, DARK, sd * .03, headY - .01, headZ + .245, 0, 0); });
    } else {
      body.e(Wd * .33, .1, .13, c1, 0, headY, headZ, [.15, 0, 0], 1); body.e(Wd * .27, .075, .1, c2, 0, headY - .04, headZ + .12, [.15, 0, 0], 1);
      both(function (sd) { body.e(.012, .01, .006, DARK, sd * .035, headY - .045, headZ + .215, 0, 0); if (o.ears !== false) body.n(.03, .09, c1, sd * .065, headY + .11, headZ - .06, [-.2, 0, -sd * .25], 4); });
    }
    both(function (sd) { body.e(.022, .024, .012, o.eye || DARK, sd * Wd * .29, headY + .025, headZ + .085, [0, sd * .5, 0], 0); body.e(.007, .007, .004, WHITE, sd * Wd * .29 + .004, headY + .035, headZ + .097, 0, 0); });
    if (o.mane) { for (var i = 0; i < 5; i++) body.x([[0, 0], [.04, .03], [.02, .12], [-.02, .1]], .05, i % 2 ? (o.mane2 || o.mane) : o.mane, 0, hy - .02 + i * .05, hz - .16 + i * .05, [-.5, PI / 2, 0], 1, .012, 'mane'); body.c(.04, .02, .26, o.mane, 0, by + .02, -L / 2 - .1, [-.9, 0, 0], 5); }
    else if (o.tail !== false) body.c(.03, .015, .2, c1, 0, by + .03, -L / 2 - .08, [-.9, 0, 0], 5);
    if (o.horn1) body.n(.03, .18, o.horn1, 0, headY + .14, headZ + .03, [.4, 0, 0], 5);
    if (o.saddle) { body.e(Wd / 2 + .02, .035, .14, o.saddle, 0, H + T - .015, -.02, 0, 1); both(function (sd) { body.x([[0, 0], [.12, 0], [.13, -.14], [0, -.16]], .02, o.saddle2 || o.saddle, sd * (Wd / 2 + .01), H + T - .02, -.08, [0, sd > 0 ? -PI / 2 : PI / 2, 0], 1, .006, 'blanket'); }); }
    var lx = Wd / 2 - .055, lz = L / 2 - .09, legH = H + .02, lw = o.legW || .1;
    [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].forEach(function (p, i) {
      // chân thú gập khớp: đùi mập nghiêng + khớp gối tròn + cẳng chân thon + móng to
      var leg = new Part([p[0], H + .02, p[1]]), fr = i < 2 ? 1 : -1, ag = .22 * fr, hoofH = .06;
      var u = (legH - hoofH) * .52, l = legH - hoofH - u * Math.cos(ag) - .01;
      var r1 = lw * .78, r2 = lw * .58, r3 = lw * .5;
      leg.e(r1 * 1.15, r1 * 1.25, r1 * 1.2, c1, 0, -.01, 0, 0, 2);                                                           // khớp hông/vai
      leg.t(r2, r1, u, c1, 0, -u / 2 * Math.cos(ag), -u / 2 * Math.sin(ag), [-ag, 0, 0]);                                      // đùi
      var ky = -u * Math.cos(ag), kz = -u * Math.sin(ag);
      leg.e(r2 * 1.08, r2 * 1.08, r2 * 1.08, c1, 0, ky, kz, 0, 1);                                                           // gối
      leg.t(r3, r2, l, c2, 0, ky - l / 2, kz * .5, [ag * .9, 0, 0]);                                                         // cẳng
      leg.l([[0, 0], [lw * .72, 0], [lw * .7, .035], [lw * .55, hoofH], [0, hoofH + .005]], 10, o.hoof || '#5a4434', 0, -legH + .005, kz * .05); // móng to
      leg.phase = i === 0 || i === 3 ? 0 : 1;
      legs.push(leg);
    });
    return { body: body, legs: legs, H: H, top: H + T - .02 };
  }
  // người cưỡi: thân trên ngồi trên lưng thú
  function rider(race, o, seatY) {
    var h = humanoid(race, Object.assign({ wings: false }, o));
    h.body.shift(0, seatY - .31, -.02);
    both(function (sd) { h.body.t(.06, .07, .12, h.c.armor2, sd * .14, seatY - .04, .07, [PI / 2 - .2, 0, sd * .5]); h.body.e(.07, .055, .1, h.c.leather, sd * .21, seatY - .14, .14, 0, 2); });
    h.arm.pivot = [h.arm.pivot[0], h.arm.pivot[1] + seatY - .31, h.arm.pivot[2] - .02];
    if (h.parts.cape) h.parts.cape.pivot = [0, h.parts.cape.pivot[1] + seatY - .31, h.parts.cape.pivot[2] - .02];
    return h;
  }
  // bánh xe gỗ low-poly
  function wheel(b, col, hub, x, y, z, r) { b.a(CYL(r, r, .06, 10), col, [x, y, z], [0, 0, PI / 2]); b.a(TOR(r * .92, .018, 3, 10), hub, [x, y, z], [0, PI / 2, 0]); b.e(.04, .04, .04, hub, x * 1.12, y, z, 0, 0); }

  /* ======================= 44 MÔ HÌNH ======================= */
  function build(race, role) {
    var c = PAL[race], parts = {}, scale = 1, info = { kind: 'humanoid' };
    var plume = { dragon: '#ffd23a', human: '#ff5d5d', fairy: '#8ff7ff', demon: '#ff5fa8' }[race];
    var setH = function (h) { for (var k in h.parts) parts[k] = h.parts[k]; };
    switch (role) {
      case 'linh': {
        var h = humanoid(race, { helmet: race === 'human' ? 'cap' : race === 'dragon' ? 'band' : 'hair', bandColor: c.trim, tabard: race === 'human' ? c.armor : race === 'fairy' ? c.armor : null, chest: race === 'dragon' ? c.trim : null });
        W.sword(h.arm, c, .38, race === 'dragon');
        shield(h.body, c, race === 'human' ? 'kite' : race === 'fairy' ? 'leaf' : race === 'demon' ? 'spike' : 'round', FAC(c));
        setH(h); scale = .86; break;
      }
      case 'thuan': {
        var h2 = humanoid(race, { helmet: 'full', heavy: 1, pauldrons: 1, bigShoulder: 1, helmColor: race === 'dragon' ? c.armor : null, chest: c.armor2 });
        shield(h2.body, c, 'tower', FAC(c));
        if (race === 'dragon') both(function (sd) { h2.body.n(.025, .08, c.horn, .15 + sd * .05, .55, .24, [-.3, 0, 0], 5); });
        if (race === 'demon') h2.body.e(.05, .045, .025, '#f3e8d2', .15, .42, .24, 0, 1);
        if (race === 'human' || race === 'fairy') W.spear(h2.arm, c, .8); else W.hammer(h2.arm, c);
        setH(h2); scale = .92; break;
      }
      case 'cung': {
        var h3 = humanoid(race, { helmet: race === 'fairy' ? 'tiara' : race === 'demon' ? 'hood' : race === 'human' ? 'cap' : 'band', capColor: '#5c8a4a', hoodColor: c.armor2, bandColor: c.trim, sleeve: c.cloth, torsoColor: race === 'human' ? '#7fb26a' : null, ponytail: race === 'fairy' });
        bow(h3.body, race === 'fairy' ? '#f2e2ae' : race === 'demon' ? '#3a2056' : c.leather, c);
        h3.body.c(.045, .04, .26, c.leather, -.08, .5, -.13, [.3, 0, .25], 6);              // ống tên
        [-.11, -.075, -.04].forEach(function (x) { h3.body.x([[0, 0], [.02, .03], [0, .06], [-.02, .03]], .006, WHITE, x, .64, -.17, [.3, 0, .25], 1, .002, 'fletch'); });
        h3.arm.c(.006, .006, .34, c.leather, 0, -.26, .14, [PI / 2, 0, 0], 3);
        setH(h3); scale = .84; break;
      }
      case 'y': {
        // TU SĨ: mũ rộng vành + áo choàng dài chấm đất
        var h4 = humanoid(race, { helmet: 'brim', hatColor: race === 'human' ? '#ffffff' : race === 'demon' ? '#2a1648' : race === 'dragon' ? '#ffe9c4' : '#ffffff', bandColor: race === 'human' ? c.cloth : FAC(c), longCape: FAC(c), robe: 1, robeColor: race === 'human' ? '#ffffff' : race === 'demon' ? '#b0204c' : race === 'dragon' ? '#ffe9c4' : c.cloth, hoodColor: race === 'human' ? '#ffffff' : '#7a1838', sleeve: race === 'human' ? '#ffffff' : race === 'dragon' ? '#ffe9c4' : c.cloth, torsoColor: race === 'human' ? '#ffffff' : race === 'dragon' ? '#ffe9c4' : null, halo: race === 'human' || race === 'fairy', ponytail: race === 'fairy' });
        W.staff(h4.arm, c, race === 'demon' ? '#ff2e5a' : race === 'dragon' ? '#ff8a2a' : race === 'fairy' ? '#8ff7ff' : '#fff2a0', race === 'fairy' ? 'flower' : race === 'demon' ? 'skull' : race === 'human' ? 'cross' : 'orb');
        h4.body.x([[-.04, .1], [.04, .1], [.04, -.1], [0, -.13], [-.04, -.1]], .012, c.trim, 0, .2, .2, [-.12, 0, 0], 1, .004, 'stole');
        setH(h4); scale = .86; break;
      }
      case 'phapsu': {
        var robeC = race === 'dragon' ? c.armor : race === 'human' ? '#3e62d8' : race === 'demon' ? '#3b2066' : c.cloth;
        var h5 = humanoid(race, { helmet: 'wizard', robe: 1, robeColor: robeC, hatColor: race === 'dragon' ? c.armor2 : race === 'human' ? '#2c47a8' : race === 'demon' ? '#2a1648' : c.cloth, sleeve: robeC, torsoColor: robeC, hairColor: race === 'human' ? '#e8e8f0' : null, beard: race === 'human' ? '#f2f2f8' : null, ponytail: race === 'fairy' });
        W.staff(h5.arm, c, race === 'dragon' ? '#ff5a1a' : race === 'human' ? '#7fd7ff' : race === 'fairy' ? '#c6fbff' : '#c88cff', race === 'fairy' ? 'crystal' : race === 'demon' ? 'skull' : 'orb');
        h5.body.a(gk('oct', function () { return new THREE.OctahedronGeometry(1, 0); }), race === 'dragon' ? '#ffb03a' : c.gem || c.accent, [.27, .38, .13], [.4, .6, 0], [.04, .06, .04]);
        setH(h5); scale = .86; break;
      }
      case 'chihuy': {
        var h6 = humanoid(race, { helmet: race === 'human' ? 'plume' : race === 'fairy' ? 'tiara' : race === 'demon' ? 'horned' : 'crest', plume: plume, cape: race === 'human' ? c.cloth : race === 'fairy' ? '#ffffff' : race === 'dragon' ? c.armor2 : '#3b2066', heavy: 1, pauldrons: 1, hornSize: 1.5, chest: c.trim });
        // cờ hiệu sau lưng
        h6.body.c(.014, .014, .9, c.trim, -.1, .76, -.15, 0, 5);
        h6.body.x([[0, 0], [.26, 0], [.24, -.1], [.26, -.2], [0, -.2]], .012, race === 'dragon' ? '#ffd23a' : race === 'human' ? '#ffffff' : race === 'fairy' ? c.cloth : c.accent, -.1, 1.17, -.15, [0, PI, 0], 1, .004, 'banner');
        h6.body.x([[0, -.04], [.04, 0], [0, .04], [-.04, 0]], .014, race === 'human' ? c.cloth : c.armor2, -.22, 1.07, -.145, 0, 1, .004, 'bemb');
        h6.body.e(.025, .025, .025, c.trim, -.1, 1.22, -.15, 0, 0);
        W.sword(h6.arm, c, .44, true);
        setH(h6); scale = .94; break;
      }
      case 'nguyensoai': {
        var hm0 = humanoid(race, { helmet: 'crown', plume: plume, cape: race === 'human' ? '#b8242c' : race === 'fairy' ? '#ffffff' : race === 'dragon' ? '#ffb02e' : '#4a1d7a', heavy: 1, pauldrons: 1, hornSize: 1.3, chest: c.trim, halo: 1 });
        hm0.body.k(.5, .05, .34, c.trim, 0, .43, 0, 0, .01);                    // đai vàng bản to
        hm0.body.k(.14, .24, .05, c.gem || c.accent, 0, .62, .13, 0, .01);      // ngọc ngực lớn
        W.sword(hm0.arm, c, .5, true);
        setH(hm0); scale = 1.08; break;
      }
      case 'thichkhach': {
        var hood = race === 'dragon' ? '#7a2414' : race === 'human' ? '#30364a' : race === 'fairy' ? '#1d7a56' : '#2a1848';
        var h7 = humanoid(race, { helmet: 'hood', hoodColor: hood, mask: race === 'demon' ? '#f3e8d2' : '#30364a', torsoColor: race === 'human' ? '#424a60' : race === 'fairy' ? '#2a9a6c' : race === 'dragon' ? '#9a2e1a' : '#3a2266', sleeve: '#30364a', legColor: '#30364a', cape: '#1e2230', wings: false, beltColor: '#1e2230' });
        W.dagger(h7.arm, c);
        h7.body.x(BLADE(.04, .17), .012, c.metal, .27, .3, .16, [1.2, 0, 0], 1, .004, 'dagger2');
        h7.body.e(.025, .025, .025, '#ff4d4d', -.12, .32, .1, 0, 0);
        setH(h7); scale = .76; break;   // nhỏ gọn: silhouette sát thủ
      }
      case 'ky': {
        var mount = race === 'dragon' ? quad({ color: '#e5543c', color2: '#ffb36b', belly: '#ffb36b', headKind: 'reptile', len: .64, h: .4, w: .28, t: .28, horn: c.horn, saddle: c.trim, saddle2: c.armor2, eye: '#ffcf3a', hoof: '#ffd36b' })
          : race === 'human' ? quad({ color: '#ffffff', color2: '#f0e6d8', mane: '#d9c4a6', mane2: '#c8b090', len: .62, h: .44, w: .28, t: .3, saddle: c.trim, saddle2: c.cloth })
          : race === 'fairy' ? quad({ color: '#ffffff', color2: '#f2fbff', mane: '#bff7ff', mane2: '#ffd9f2', len: .6, h: .44, w: .27, t: .29, saddle: c.trim, saddle2: c.cloth, horn1: '#fff3a8' })
          : quad({ color: '#3a2a52', color2: '#4e3a6a', mane: '#ff5fa8', mane2: '#c88cff', len: .62, h: .44, w: .28, t: .3, saddle: c.armor2, saddle2: c.armor, eye: '#ff2e5a', hoof: '#c88cff' });
        var rd = rider(race, { helmet: race === 'human' ? 'plume' : race === 'fairy' ? 'tiara' : race === 'demon' ? 'horned' : 'crest', plume: plume, wings: false }, mount.top + .02);
        merge(mount.body, rd.body);
        W.lance(rd.arm, c);
        parts.body = mount.body; parts.armR = rd.arm; if (rd.parts.cape) parts.cape = rd.parts.cape;
        mount.legs.forEach(function (l, i) { parts['q' + i] = l; });
        if (race === 'fairy') { var fw = wingParts({ wing: '#ffffff', wing2: '#dff8ff' }, 'bird', 1.2, mount.top - .05, .02); parts.wingL = fw[0]; parts.wingR = fw[1]; }
        info.kind = 'mount'; scale = 1.05; break;
      }
      case 'congthanh': {
        var b = new Part(), arm = new Part([0, .34, -.05]);
        var wood = race === 'demon' ? '#f0e4cc' : race === 'fairy' ? '#fbf3dc' : '#b47a44', wood2 = race === 'demon' ? '#c9b89a' : race === 'fairy' ? '#d9c6a0' : '#8a5a30';
        b.k(.5, .09, .72, wood, 0, .23, 0, 0, .03);                               // sàn gỗ vát cạnh
        both(function (sd) { b.k(.05, .06, .76, c.trim, sd * .25, .28, 0, 0, .015); });
        [[.28, .24], [-.28, .24], [.28, -.24], [-.28, -.24]].forEach(function (p) { wheel(b, wood2, c.trim, p[0], .13, p[1], .12); });
        if (race === 'dragon') { // pháo phun lửa: nòng thon miệng rồng
          arm.l([[.08, -.3], [.1, -.1], [.09, .15], [.12, .28], [.13, .32], [0, .33]], 9, '#6a3f2c', 0, .1, .12, [PI / 2 - .35, 0, 0]);
          arm.a(TOR(.1, .02, 4, 10), c.trim, [0, .03, -.06], [.35 + PI / 2, 0, 0]);
          arm.e(.13, .11, .14, c.armor, 0, .23, .4, [-.35, 0, 0], 1);
          both(function (sd) { arm.n(.025, .1, c.horn, sd * .07, .34, .34, [-.6, 0, 0], 5); });
          arm.e(.05, .04, .02, '#ffcf3a', 0, .24, .53, [-.35, 0, 0], 0);
          b.e(.18, .1, .15, c.armor2, 0, .38, -.2, 0, 1);
        } else if (race === 'human') { // nỏ lớn
          b.c(.05, .05, .3, wood2, 0, .42, 0, 0, 6);
          arm.k(.08, .07, .82, wood, 0, .14, .1, 0, .025);
          arm.a(TUBE([[.4, .14, .22], [.2, .14, .34], [0, .14, .36], [-.2, .14, .34], [-.4, .14, .22]], .022, 10), wood2, [0, 0, 0]);
          arm.c(.004, .004, .8, '#fff4dc', 0, .14, .22, [0, 0, PI / 2], 3);
          arm.x(BLADE(.04, .16), .02, c.metal, 0, .2, .48, [PI / 2, 0, 0], 1, .006, 'bolt');
          b.x([[-.27, 0], [.27, 0], [.27, .06], [-.27, .06]], .02, c.cloth, 0, .28, .32, 0, 1, .004, 'cloth');
        } else if (race === 'fairy') { // tháp pha lê
          b.l([[.0, .28], [.15, .3], [.16, .42], [.12, .48], [0, .5]], 8, '#ffffff', 0, 0, 0);
          arm.c(.025, .025, .44, c.trim, 0, .26, 0, 0, 6);
          arm.a(gk('oct', function () { return new THREE.OctahedronGeometry(1, 0); }), '#8ff7ff', [0, .62, 0], [0, .4, 0], [.11, .18, .11]);
          arm.a(TOR(.17, .012, 3, 14), '#c6fbff', [0, .6, 0], [PI / 2, 0, 0]); arm.a(TOR(.14, .01, 3, 14), '#ffe98a', [0, .5, 0], [PI / 2 + .3, 0, 0]);
        } else { // máy bắn đầu lâu
          both(function (sd) { b.c(.04, .04, .38, wood2, sd * .15, .44, -.1, 0, 6); });
          arm.c(.025, .025, .6, wood, 0, .2, .06, [-.9, 0, 0], 6);
          arm.e(.09, .085, .09, '#f3e8d2', 0, .42, .32, 0, 1); both(function (sd) { arm.e(.02, .022, .01, '#ff2e5a', sd * .035, .43, .405, 0, 0); });
          b.a(gk('oct', function () { return new THREE.OctahedronGeometry(1, 0); }), c.accent, [0, .33, -.35], [0, .78, 0], [.05, .07, .05]);
        }
        var crew = humanoid(race, { helmet: race === 'human' ? 'cap' : 'hair', wings: false });
        crew.body.shift(.24, .02, -.4, .7);
        merge(b, crew.body);
        parts.body = b; parts.armR = arm; info.kind = 'siege'; scale = 1.05; break;
      }
      case 'tuong': { // voi chiến
        var ec = race === 'dragon' ? '#d4583e' : race === 'human' ? '#b6c0cf' : race === 'fairy' ? '#f7fcff' : '#f2e8d2';
        var e = quad({ color: ec, color2: ec, len: .66, h: .5, w: .52, t: .5, neck: false, ears: false, tail: true, legW: .17, hoof: race === 'demon' ? '#c88cff' : '#6a5a4a' });
        var hb = e.body, hy = .82, hz = .42;
        hb.e(.21, .19, .16, ec, 0, hy, hz, 0, 1);                                                                        // đầu
        var ty2 = hy - .14, tz2 = hz + .15; for (var ti = 0; ti < 5; ti++) { hb.c(.055 - ti * .007, .05 - ti * .007, .1, ec, 0, ty2, tz2, [.1 + ti * .18, 0, 0], 6); ty2 -= .085; tz2 += .02 + ti * .006; } // vòi cong
        both(function (sd) {
          hb.x([[0, .12], [.16, .1], [.2, -.04], [.12, -.14], [0, -.1]], .025, race === 'fairy' ? '#ffd6ee' : ec, sd * .19, hy + .02, hz - .08, [0, sd > 0 ? -.35 : PI + .35, 0], 1, .008, 'ear');
          hb.n(.03, .22, '#fff8e8', sd * .11, hy - .2, hz + .22, [1.9, 0, 0], 6);                                          // ngà
          hb.e(.026, .028, .012, race === 'demon' ? '#ff2e5a' : DARK, sd * .12, hy + .04, hz + .15, [0, sd * .5, 0], 0);
        });
        hb.l([[.0, 0], [.25, 0], [.26, .03], [.23, .05]], 10, c.trim, 0, 1.0, -.05, 0, [1, 1, 1.05]);               // vành đai
        hb.k(.42, .18, .44, race === 'human' ? c.cloth : race === 'fairy' ? '#ffffff' : race === 'dragon' ? c.armor2 : c.armor, 0, 1.12, -.05, 0, .06); // bành
        hb.x([[-.28, .17], [.28, .17], [.3, -.15], [0, -.2], [-.3, -.15]], .02, race === 'human' ? c.cloth : c.cloth, 0, .82, .22, 0, 1, .006, 'cloth2');
        hb.c(.014, .014, .5, c.trim, .17, 1.45, -.22, 0, 5); hb.x([[0, 0], [.18, 0], [.16, -.06], [.18, -.12], [0, -.12]], .01, plume, .17, 1.7, -.22, 0, 1, .004, 'pen2');
        if (race === 'dragon') { hb.n(.035, .2, c.horn, 0, hy + .28, hz + .02, [-.3, 0, 0], 5); for (var si = 0; si < 3; si++) hb.n(.03, .09, c.trim, 0, 1.03, -.3 - si * .1, 0, 5); }
        if (race === 'fairy') { hb.e(.11, .08, .1, '#ffffff', .32, .26, .22, 0, 1); hb.e(.1, .07, .09, '#ffffff', -.32, .22, -.24, 0, 1); }
        if (race === 'demon') for (var ri = 0; ri < 4; ri++) hb.a(TOR(.27, .02, 3, 12, PI), '#f3e8d2', [0, .7, -.25 + ri * .13], [0, 0, 0]);
        var rdr = rider(race, { helmet: race === 'human' ? 'cap' : 'hair', wings: false }, 1.24);
        rdr.body.shift(0, 0, -.1);
        merge(hb, rdr.body);
        parts.body = hb; e.legs.forEach(function (l, i) { parts['q' + i] = l; });
        info.kind = 'mount'; scale = 1.25; break;
      }
      case 'thanthu': {
        if (race === 'dragon') { // Long Vương
          var d = quad({ color: '#e5503a', color2: '#ffb36b', belly: '#ffb36b', len: .8, h: .38, w: .36, t: .32, neck: false, headKind: 'reptile', ears: false, tail: false, hoof: '#ffd36b', horn: '#fff1d8', eye: '#ffcf3a', legW: .13 });
          var db = d.body;
          for (var ni = 0; ni < 3; ni++) db.e(.1 - ni * .01, .09, .1, '#e5503a', 0, .74 + ni * .12, .4 + ni * .1, [-.5, 0, 0], 1);
          db.e(.14, .11, .18, '#e5503a', 0, 1.08, .74, 0, 1); db.e(.12, .05, .11, '#ffb36b', 0, .99, .86, 0, 1);
          both(function (sd) { db.n(.03, .22, '#fff1d8', sd * .09, 1.24, .62, [-1.1, 0, -sd * .2], 6); db.e(.025, .022, .012, '#ffcf3a', sd * .1, 1.12, .93, [0, sd * .4, 0], 0); });
          var tz3 = -.48, ty3 = .5, ts3 = .1; for (var tk = 0; tk < 5; tk++) { db.e(ts3, ts3 * .8, .1, '#e5503a', 0, ty3, tz3, [.15, 0, 0], 1); tz3 -= .17; ty3 -= .05; ts3 *= .82; }
          db.n(.06, .14, '#ffd36b', 0, .3, -1.32, [-1.2, 0, 0], 5);
          for (var sp = 0; sp < 5; sp++) db.n(.03, .09, '#ffd36b', 0, .78, .28 - sp * .17, 0, 5);
          var dw = wingParts({ armor2: '#ff8a5a', accent: '#ffcf3a' }, 'bat', 2.2, .7, .05); parts.wingL = dw[0]; parts.wingR = dw[1];
          parts.body = db; d.legs.forEach(function (l, i) { parts['q' + i] = l; }); info.kind = 'mount'; info.fly = 1; scale = 1.5;
        } else if (race === 'human') { // Sư tử vàng
          var q = quad({ color: '#ffd23a', color2: '#fff2b0', belly: '#fff2b0', mane: '#ff7a2a', mane2: '#ffa04d', len: .66, h: .5, w: .3, t: .32, horn1: '#ffffff', hoof: '#c98a1a', eye: '#1d4fa8' });
          var qb = q.body;
          both(function (sd) { for (var fi = 0; fi < 4; fi++) qb.x([[0, 0], [.04, .02], [.03, .08], [-.01, .06]], .03, '#fff2b0', sd * .155, .7, -.18 + fi * .12, [0, sd > 0 ? -PI / 2 : PI / 2, 0], 1, .008, 'fur'); });
          for (var mi = 0; mi < 7; mi++) { var ma = (mi - 3) * .4; qb.x([[0, 0], [.05, .05], [.03, .16], [-.03, .14]], .05, mi % 2 ? '#ff7a2a' : '#ffa04d', Math.sin(ma) * .13, .96 + Math.cos(ma) * .06, .32, [-.3, 0, -ma], 1, .012, 'mane'); }
          parts.body = qb; q.legs.forEach(function (l, i) { parts['q' + i] = l; }); info.kind = 'mount'; scale = 1.5;
        } else if (race === 'fairy') { // Phượng hoàng
          var pb = new Part();
          pb.e(.16, .15, .21, '#ff7a3a', 0, .6, 0, 0, 1); pb.e(.13, .11, .15, '#ffd24a', 0, .52, .1, 0, 1);
          pb.e(.12, .12, .12, '#ff8a3a', 0, .9, .26, 0, 1); pb.n(.04, .12, '#ffd24a', 0, .87, .44, [PI / 2 + .3, 0, 0], 5);
          both(function (sd) { pb.e(.022, .024, .012, DARK, sd * .07, .93, .36, [0, sd * .5, 0], 0); });
          for (var ci = 0; ci < 3; ci++) pb.x([[0, 0], [.03, .06], [0, .2], [-.03, .06]], .02, '#ffd24a', 0, 1.0 + ci * .02, .22 - ci * .07, [-.6 - ci * .3, 0, 0], 1, .006, 'crestF');
          for (var tf = -2; tf <= 2; tf++) pb.x([[0, 0], [.05, .1], [.03, .7 - Math.abs(tf) * .08], [0, .78 - Math.abs(tf) * .08], [-.03, .7 - Math.abs(tf) * .08], [-.05, .1]], .02, tf % 2 ? '#ffd24a' : '#ff5a2a', tf * .07, .52, -.15, [-PI / 2 - .25, tf * .2, 0], 1, .006, 'tailF');
          both(function (sd) { pb.c(.015, .015, .25, '#ffb03a', sd * .08, .3, 0, 0, 5); });
          var pw = wingParts({ wing: '#ffb03a', wing2: '#ff6a3a' }, 'bird', 2.3, .66, 0); parts.wingL = pw[0]; parts.wingR = pw[1];
          parts.body = pb; info.kind = 'bird'; info.fly = 1; scale = 1.45;
        } else { // Ma Vương
          var mv = humanoid('demon', { helmet: 'crown', heavy: 1, pauldrons: 1, horns: 1, hornSize: 2.2, hornCurl: 'up', cape: '#2a1648', torsoColor: '#4e2a82', chest: '#ff6fb5' });
          W.axe(mv.arm, c, 1.6);
          setH(mv);
          var mw = wingParts({ armor2: '#4e2a82', accent: '#ff6fb5' }, 'bat', 1.6, .56, -.12); parts.wingL = mw[0]; parts.wingR = mw[1];
          scale = 1.75; info.big = 1;
        }
        break;
      }
    }
    if (GEN) {
      // tướng to gấp 2.5 lính để dễ nhận ra; voi / máy công thành vốn đã to nên ×1.8; Thần thú không có lính nên giữ nguyên
      scale *= role === 'thanthu' ? (info.big ? 1.12 : 1.3) : (role === 'tuong' || role === 'congthanh') ? 1.8 : 2.5; info.gen = 1;
      if (!parts.cape && parts.body) { // cỗ máy / thú lớn: cắm cờ hiệu sau lưng
        var bb = parts.body, top = info.kind === 'siege' ? .75 : info.kind === 'bird' ? .85 : 1.0, bz = info.kind === 'siege' ? -.25 : -.3;
        bb.c(.016, .016, .8, c.trim, 0, top + .3, bz, 0, 5);
        bb.x([[0, 0], [.3, 0], [.27, -.11], [.3, -.22], [0, -.22]], .012, CAPE[race], 0, top + .69, bz, 0, 1, .004, 'gflag');
        bb.e(.03, .03, .03, c.gem, 0, top + .72, bz, 0, 0);
      }
    }
    var out = { parts: {}, scale: scale, info: info };
    for (var k in parts) { var p = parts[k]; out.parts[k] = { geo: p.build(), pivot: p.pivot, phase: p.phase, wing: p.wing, cape: k === 'cape' }; }
    return out;
  }

  /* quái trung lập */
  function buildMonster(kind) {
    var parts = {}, scale = 1, info = { kind: 'mount' };
    if (kind === 'wolf') {
      var w = quad({ color: '#9aa6b8', color2: '#e2e8f0', belly: '#e2e8f0', mane: '#7a8496', mane2: '#aab4c4', len: .56, h: .32, w: .24, t: .24, eye: '#ffcf3a' });
      both(function (sd) { w.body.n(.012, .04, WHITE, sd * .025, .47, .57, [PI, 0, 0], 4); });
      parts.body = w.body; w.legs.forEach(function (l, i) { parts['q' + i] = l; }); scale = 1.1;
    } else if (kind === 'ox') {
      var o = quad({ color: '#8a5432', color2: '#5e3820', belly: '#b07a52', len: .66, h: .46, w: .4, t: .38, eye: '#ff3d2e', hoof: '#2a1a10', legW: .14 });
      both(function (sd) { o.body.a(TUBE([[sd * .08, 1.0, .42], [sd * .2, 1.04, .44], [sd * .26, 1.12, .5]], .028, 6), '#fff3dc', [0, 0, 0]); });
      o.body.a(TOR(.03, .008, 3, 8), '#ffd36b', [0, .86, .64], [0, 0, 0]);
      parts.body = o.body; o.legs.forEach(function (l, i) { parts['q' + i] = l; }); scale = 1.5;
    } else { // Cổ Thụ Yêu Vương
      var b = new Part(), arm = new Part([-.22, .72, 0]);
      b.l([[0, 0], [.22, 0], [.2, .1], [.16, .3], [.15, .6], [.17, .8], [0, .85]], 8, '#9a6438', 0, 0, 0);
      b.e(.4, .26, .36, '#58b84e', 0, 1.06, 0, 0, 1); b.e(.25, .2, .25, '#74d26a', .25, 1.3, .1, 0, 1); b.e(.24, .18, .23, '#47a845', -.22, 1.24, -.12, 0, 1);
      both(function (sd) { b.e(.035, .04, .015, '#ffe066', sd * .07, .66, .16, 0, 0); b.c(.06, .03, .2, '#6a4022', sd * .1, .06, .06, [1.2, 0, sd * .5], 6); });
      b.c(.04, .02, .3, '#7a4a28', .26, .64, .05, [.2, 0, -.9], 6);
      arm.c(.05, .035, .45, '#7a4a28', 0, -.2, .06, [.3, 0, 0], 6); arm.e(.1, .08, .1, '#58b84e', 0, -.44, .16, 0, 1);
      parts.body = b; parts.armR = arm; info.kind = 'siege'; scale = 2.3;
    }
    var out = { parts: {}, scale: scale, info: info };
    for (var k in parts) { var p = parts[k]; out.parts[k] = { geo: p.build(), pivot: p.pivot, phase: p.phase, wing: p.wing }; }
    return out;
  }

  var CACHE = {};
  Models.get = function (race, role, gen) { var k = race + '.' + role + (gen ? '.g' : ''); if (CACHE[k]) return CACHE[k]; GEN = !!gen; try { CACHE[k] = build(race, role); } finally { GEN = false; } return CACHE[k]; };
  Models.monster = function (kind) { var k = 'm.' + kind; return CACHE[k] || (CACHE[k] = buildMonster(kind)); };
})(typeof window !== 'undefined' ? window : global);
