/* Tứ Tộc Kỳ Chiến 2.0 — mô hình 3D quân lính phong cách KHỐI (kiểu Minecraft) nhưng BO TRÒN mọi cạnh góc,
   màu tươi sáng kiểu Ragnarok Online 2/3. Dựng hoàn toàn bằng code.
   Mỗi mô hình gồm vài "bộ phận" (thân, tay phải cầm vũ khí, chân, cánh…) đã gộp thành một BufferGeometry
   có màu đỉnh, để vẽ instanced: mọi quân cùng loại chỉ tốn vài lệnh vẽ mà vẫn có hoạt ảnh. */
(function (G) {
  'use strict';
  var TT = G.TT, THREE = G.THREE;
  if (!THREE) return;
  var Models = TT.Models = {};
  var GC = {};
  function gk(k, f) { return GC[k] || (GC[k] = f()); }

  /* Khối hộp bo góc: chia lưới hộp rồi kéo đỉnh về mặt cong quanh hộp lõi (r = bán kính bo) */
  function roundedBox(w, h, d, r, seg) {
    seg = seg || 3;
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
  // B(w,h,d[,bo]) — khối bo góc, bán kính bo mặc định theo cạnh nhỏ nhất
  var ROUND = 1.7; // độ bo: >1 tròn hơn (chibi)
  function B(w, h, d, rr) {
    var r = (rr != null ? rr : Math.min(w, h, d) * .22) * ROUND;
    return gk('b' + w + 'x' + h + 'x' + d + 'r' + r, function () { return roundedBox(w, h, d, r, Math.min(w, h, d) < .05 ? 2 : 4); });
  }
  function CY(rt, rb, h, n) { return gk('c' + rt + rb + h + n, function () { return new THREE.CylinderGeometry(rt, rb, h, n || 8); }); }
  Models.B = B;
  Models.RBox = roundedBox;

  /* ---- bộ phận = danh sách khối có màu, gộp thành 1 geometry ---- */
  function Part(pivot) { this.items = []; this.pivot = pivot || [0, 0, 0]; }
  // a(geo, màu, vị trí, góc xoay, tỉ lệ)
  Part.prototype.a = function (geo, color, p, r, s) { this.items.push([geo, color, p || [0, 0, 0], r || [0, 0, 0], s == null ? 1 : s]); return this; };
  // k(w,h,d, màu, x,y,z, [rx,ry,rz]) — tiện viết khối
  Part.prototype.k = function (w, h, d, color, x, y, z, r, rr) { this.a(B(w, h, d, rr), color, [x || 0, y || 0, z || 0], r); if (Math.min(w, h, d) <= .03) this.items[this.items.length - 1][5] = 0; return this; };
  var _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  Part.prototype.build = function () {
    var pos = [], nor = [], colr = [], olw = [];
    this.items.forEach(function (it) {
      var g = it[0].index ? it[0].toNonIndexed() : it[0].clone();
      var sc = it[4]; _s.set(Array.isArray(sc) ? sc[0] : sc, Array.isArray(sc) ? sc[1] : sc, Array.isArray(sc) ? sc[2] : sc);
      _m.compose(_v.set(it[2][0], it[2][1], it[2][2]), _q.setFromEuler(_e.set(it[3][0], it[3][1], it[3][2])), _s);
      g.applyMatrix4(_m);
      _c.set(it[1]);
      var P = g.attributes.position.array, N = g.attributes.normal.array;
      for (var i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
      var w0 = it[5] === 0 ? 0 : 1;
      for (var j = 0; j < P.length / 3; j++) { colr.push(_c.r, _c.g, _c.b); olw.push(w0); }
      g.dispose();
    });
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    bg.setAttribute('olw', new THREE.Float32BufferAttribute(olw, 1)); // trọng số viền: 0 = chi tiết mỏng không viền
    bg.computeBoundingSphere();
    return bg;
  };
  Part.prototype.shift = function (dx, dy, dz, sc) { this.items.forEach(function (it) { var k = sc || 1; it[2] = [it[2][0] * k + dx, it[2][1] * k + dy, it[2][2] * k + dz]; if (k !== 1) it[4] = Array.isArray(it[4]) ? it[4].map(function (v) { return v * k; }) : it[4] * k; }); return this; };
  function merge(dst, src) { src.items.forEach(function (it) { dst.items.push(it); }); }

  /* ---- bảng màu tươi sáng kiểu Ragnarok Online 2/3 ---- */
  var PAL = Models.PAL = {
    dragon: { skin: '#ffd8b4', hair: '#ff6e3a', hair2: '#ffa04d', armor: '#e44a35', armor2: '#b5321f', trim: '#ffcc4d', cloth: '#ffd9a0', horn: '#fff3dc', eye: '#5a1d00', metal: '#ffe08a', leather: '#9a5226', accent: '#ff8a2a', gem: '#ffb000' },
    human: { skin: '#ffdcbf', hair: '#a8693a', hair2: '#ffd36b', armor: '#e9eff6', armor2: '#a9bcd2', trim: '#f4c64e', cloth: '#3f86e8', horn: null, eye: '#1d2a4a', metal: '#f4f8fc', leather: '#9a6438', accent: '#ffe28a', gem: '#5fd0ff' },
    fairy: { skin: '#ffe9da', hair: '#7ff0d0', hair2: '#ffb3e0', armor: '#f7fffb', armor2: '#bff2db', trim: '#2fcf90', cloth: '#56dca6', horn: null, eye: '#0f6a4c', metal: '#d6fff4', leather: '#8fd09a', accent: '#8ff7ff', gem: '#ff8ad8', wing: '#c9fbff' },
    demon: { skin: '#e2d2ff', hair: '#d9c8ff', hair2: '#ff5fa8', armor: '#7a48b8', armor2: '#4e2a82', trim: '#ff6fb5', cloth: '#9b5be0', horn: '#3a2056', eye: '#ff2e5a', metal: '#b8a6dc', leather: '#4a2e66', accent: '#c88cff', gem: '#ff3d7a' }
  };
  var DARK = '#26283a', WHITE = '#ffffff';

  /* ================= NGƯỜI KHỐI =================
     Chân y 0→.30, thân .30→.60, đầu .62→.94 (tâm .78). Mặt hướng +Z. */
  function head(body, c, o) {
    var n0 = body.items.length;
    headInner(body, c, o);
    // phóng to cả cụm đầu 1.18 lần quanh cổ (chibi đầu to)
    var HS = o.headScale || 1.18, cy = .62;
    for (var i = n0; i < body.items.length; i++) { var it = body.items[i]; it[2] = [it[2][0] * HS, cy + (it[2][1] - cy) * HS, it[2][2] * HS]; it[4] = Array.isArray(it[4]) ? it[4].map(function (v) { return v * HS; }) : it[4] * HS; }
  }
  function headInner(body, c, o) {
    var y = .8, hw = .38, hh = .35, hd = .35, fz = hd / 2 + .002;
    body.k(hw, hh, hd, c.skin, 0, y, 0, 0, .1);
    // mắt khối pixel + điểm sáng
    var ey = y - .015;
    body.k(.065, .09, .02, o.eye || c.eye, .085, ey, fz, 0, .012);
    body.k(.065, .09, .02, o.eye || c.eye, -.085, ey, fz, 0, .012);
    body.k(.026, .026, .01, WHITE, .097, ey + .025, fz + .011, 0, .005);
    body.k(.026, .026, .01, WHITE, -.073, ey + .025, fz + .011, 0, .005);
    body.k(.06, .03, .01, '#ff9c9c', .14, y - .08, fz, 0, .008);
    body.k(.06, .03, .01, '#ff9c9c', -.14, y - .08, fz, 0, .008);
    body.k(.04, .014, .01, '#c4605a', 0, y - .085, fz, 0, .005);
    var hm = o.helmet || 'hair', hc = o.hairColor || c.hair;
    // tóc khối: chỏm, sau gáy, mái, tóc mai
    if (hm === 'hair' || hm === 'crown' || hm === 'tiara' || hm === 'horned' || hm === 'wizard' || hm === 'band') {
      body.k(hw + .04, .11, hd + .04, hc, 0, y + .135, -.005, 0, .04);
      body.k(hw + .04, .26, .07, hc, 0, y + .02, -hd / 2 - .02, 0, .03);
      body.k(.07, .2, hd + .02, hc, hw / 2 + .015, y + .04, -.01, 0, .025);
      body.k(.07, .2, hd + .02, hc, -hw / 2 - .015, y + .04, -.01, 0, .025);
      body.k(.14, .07, .06, hc, .07, y + .085, fz - .01, [0, 0, -.25], .02);
      body.k(.12, .06, .06, o.hair2 || hc, -.08, y + .09, fz - .01, [0, 0, .3], .02);
      if (o.ponytail) body.k(.1, .22, .09, hc, 0, y - .05, -hd / 2 - .08, [.35, 0, 0], .03);
    }
    if (hm === 'cap') { body.k(hw + .05, .14, hd + .05, o.capColor || c.cloth, 0, y + .12, 0, 0, .05); body.k(hw + .06, .04, .12, c.trim, 0, y + .06, hd / 2 + .03, 0, .015); body.k(hw + .04, .2, .06, c.hair, 0, y, -hd / 2 - .02, 0, .02); }
    if (hm === 'full') {
      body.k(hw + .06, hh + .06, hd + .06, o.helmColor || c.armor, 0, y + .02, 0, 0, .07);
      body.k(hw + .02, .045, .02, DARK, 0, y - .01, hd / 2 + .03, 0, .012);
      body.k(.05, .2, .03, c.trim, 0, y + .1, hd / 2 + .035, 0, .012);
      body.k(.05, .12, .2, c.trim, 0, y + .2, 0, 0, .02);
    }
    if (hm === 'plume' || hm === 'crest') {
      body.k(hw + .06, .16, hd + .06, o.helmColor || c.armor, 0, y + .12, 0, 0, .05);
      body.k(hw + .07, .05, .04, c.trim, 0, y + .05, hd / 2 + .03, 0, .015);
      body.k(hw + .04, .2, .06, c.hair, 0, y, -hd / 2 - .02, 0, .02);
      if (hm === 'plume') { body.k(.06, .22, .06, o.plume || c.cloth, 0, y + .3, -.05, [-.35, 0, 0], .025); body.k(.06, .16, .06, o.plume || c.cloth, 0, y + .36, -.15, [-.9, 0, 0], .025); }
      else body.k(.05, .18, .28, o.plume || c.accent, 0, y + .26, -.02, 0, .02);
    }
    if (hm === 'hood') {
      var hcol = o.hoodColor || c.cloth;
      body.k(hw + .07, .09, hd + .07, hcol, 0, y + .175, -.01, 0, .04);
      body.k(hw + .07, hh + .06, .08, hcol, 0, y + .01, -hd / 2 - .02, 0, .03);
      body.k(.07, hh + .04, hd + .06, hcol, hw / 2 + .04, y + .01, 0, 0, .025);
      body.k(.07, hh + .04, hd + .06, hcol, -hw / 2 - .04, y + .01, 0, 0, .025);
      body.k(.12, .14, .12, hcol, 0, y + .17, -hd / 2 - .07, [.5, 0, 0], .03);
      body.k(hw - .02, .06, .05, c.hair, 0, y + .105, fz - .01, 0, .015);
    }
    if (hm === 'wizard') {
      var hat = o.hatColor || c.cloth;
      body.k(hw + .2, .04, hd + .2, hat, 0, y + .18, 0, 0, .02);
      body.k(hw - .02, .12, hd - .02, hat, 0, y + .25, -.01, [-.05, 0, 0], .03);
      body.k(hw - .1, .12, hd - .1, hat, 0, y + .35, -.03, [-.12, 0, .05], .03);
      body.k(hw - .18, .12, hd - .18, hat, .01, y + .45, -.06, [-.22, 0, .12], .025);
      body.k(.06, .1, .06, hat, .03, y + .53, -.1, [-.4, 0, .3], .02);
      body.k(hw + .0, .035, hd + .0, c.trim, 0, y + .215, 0, 0, .012);
      body.k(.05, .05, .02, c.gem || c.accent, .1, y + .3, hd / 2 - .04, [0, 0, .78], .01);
    }
    if (hm === 'crown') { body.k(hw - .02, .05, hd - .02, c.trim, 0, y + .215, 0, 0, .015); [-1, 0, 1].forEach(function (i) { body.k(.05, .07, .05, c.trim, i * .1, y + .26, hd / 2 - .06, 0, .015); body.k(.05, .07, .05, c.trim, i * .1, y + .26, -hd / 2 + .06, 0, .015); }); body.k(.04, .04, .02, c.gem, 0, y + .22, hd / 2 - .005, [0, 0, .78], .008); }
    if (hm === 'tiara') { body.k(hw + .045, .035, .03, c.trim, 0, y + .12, hd / 2 + .005, 0, .01); body.k(.05, .05, .03, c.gem, 0, y + .155, hd / 2 + .01, [0, 0, .78], .01); }
    if (hm === 'band') body.k(hw + .05, .04, hd + .05, o.bandColor || c.cloth, 0, y + .08, 0, 0, .015);
    // tai Tiên, sừng Rồng/Quỷ
    if (o.ears) { body.k(.1, .05, .05, c.skin, hw / 2 + .05, y + .02, 0, [0, 0, .5], .018); body.k(.1, .05, .05, c.skin, -hw / 2 - .05, y + .02, 0, [0, 0, -.5], .018); }
    if (o.horns) {
      var hcl = o.hornColor || c.horn, hs = o.hornSize || 1;
      [1, -1].forEach(function (sd) {
        body.k(.06 * hs, .1 * hs, .06 * hs, hcl, sd * .11, y + .2 + .03 * hs, -.03, [-.2, 0, -sd * .3], .02);
        body.k(.045 * hs, .08 * hs, .045 * hs, hcl, sd * (.13 + .03 * hs), y + .27 + .06 * hs, -.06, [-.5, 0, -sd * .6], .015);
      });
    }
    if (o.mask) body.k(hw + .02, .1, .03, o.mask, 0, y - .07, fz + .01, 0, .015);
    if (o.halo) body.k(.24, .025, .24, '#ffe76a', 0, y + .3, 0, 0, .012);
  }
  function torso(body, c, o) {
    var tc = o.torsoColor || c.armor;
    body.k(.32, .29, .21, tc, 0, .45, 0, 0, .08);
    body.k(.31, .05, .19, o.beltColor || c.leather, 0, .32, 0, 0, .015);
    body.k(.05, .045, .02, c.trim, 0, .32, .1, 0, .01);
    if (o.tabard) { body.k(.16, .2, .02, o.tabard, 0, .44, .095, 0, .01); body.k(.06, .06, .01, c.trim, 0, .47, .106, [0, 0, .78], .008); }
    if (o.chest) body.k(.22, .1, .02, o.chest, 0, .52, .095, 0, .01);
    if (o.heavy || o.pauldrons) { body.k(.13, .07, .2, c.armor2, .19, .6, 0, [0, 0, -.25], .025); body.k(.13, .07, .2, c.armor2, -.19, .6, 0, [0, 0, .25], .025); }
    if (o.cape) body.k(.3, .4, .03, o.cape, 0, .4, -.11, [.1, 0, 0], .012);
    if (o.tail) { body.k(.08, .08, .16, o.tail, 0, .3, -.15, [.4, 0, 0], .025); body.k(.06, .06, .14, o.tail, 0, .24, -.27, [.8, 0, 0], .02); body.k(.05, .07, .07, c.trim, 0, .19, -.35, [.8, 0, 0], .015); }
    if (o.robe) { // váy áo choàng khối, rộng dần xuống dưới
      var rc = o.robeColor || c.cloth;
      body.k(.32, .14, .2, rc, 0, .26, 0, 0, .03);
      body.k(.36, .14, .24, rc, 0, .14, 0, 0, .035);
      body.k(.4, .1, .27, rc, 0, .05, 0, 0, .03);
      body.k(.41, .03, .28, c.trim, 0, .01, 0, 0, .01);
    }
  }
  function legParts(c, o) {
    var L = new Part([.075, .3, 0]), R = new Part([-.075, .3, 0]);
    [L, R].forEach(function (p) {
      p.k(.13, .22, .15, o.legColor || c.armor2, 0, -.11, 0, 0, .035);
      p.k(.14, .1, .17, o.boot || c.leather, 0, -.25, .01, 0, .03);
    });
    return [L, R];
  }
  function armL(body, c, o) { // tay trái tĩnh (cầm khiên/cung), hơi đưa ra trước
    body.k(.11, .27, .12, o.sleeve || c.armor, .205, .47, .02, [-.25, 0, .08], .03);
    body.k(.1, .08, .11, c.skin, .21, .33, .065, [-.25, 0, .08], .025);
  }
  function armR(c, o) { // tay phải (vung vũ khí), trục ở vai
    var a = new Part([-.205, .58, 0]);
    a.k(.11, .27, .12, o.sleeve || c.armor, 0, -.12, 0, 0, .03);
    a.k(.1, .08, .11, c.skin, 0, -.255, 0, 0, .025);
    return a;
  }
  /* vũ khí trong bộ phận tay phải (bàn tay ở y=-.26), chĩa ra phía trước +Z */
  var W = {
    sword: function (a, c, len, broad) { len = len || .4; var w = broad ? .06 : .045; a.k(w, len, .02, c.metal, 0, -.27, .07 + len / 2, [Math.PI / 2, 0, 0], .01); a.k(.14, .035, .05, c.trim, 0, -.27, .06, 0, .012); a.k(.035, .035, .1, c.leather, 0, -.27, .0, 0, .01); a.k(.04, .04, .04, c.trim, 0, -.27, -.05, 0, .012); },
    spear: function (a, c, len) { len = len || .9; a.k(.035, .035, len, c.leather, 0, -.27, .22, 0, .01); a.k(.06, .02, .14, c.metal, 0, -.27, .22 + len / 2 + .06, 0, .008); a.k(.08, .03, .03, c.trim, 0, -.27, .22 + len / 2 - .02, 0, .01); },
    hammer: function (a, c) { a.k(.035, .035, .42, c.leather, 0, -.27, .15, 0, .01); a.k(.12, .12, .16, c.metal, 0, -.27, .38, 0, .03); a.k(.13, .03, .17, c.trim, 0, -.27, .38, 0, .01); },
    axe: function (a, c, s) { s = s || 1; a.k(.04 * s, .04 * s, .55 * s, c.leather, 0, -.27, .2 * s, 0, .01); a.k(.03 * s, .22 * s, .16 * s, c.metal, 0, -.27 + .08 * s, .42 * s, 0, .015); a.k(.035 * s, .05 * s, .05 * s, c.trim, 0, -.27, .44 * s, 0, .01); },
    dagger: function (a, c) { a.k(.035, .2, .015, c.metal, 0, -.27, .14, [Math.PI / 2, 0, 0], .006); a.k(.09, .025, .035, c.trim, 0, -.27, .04, 0, .01); },
    staff: function (a, c, orb, top) {
      a.k(.035, .78, .035, c.leather, 0, -.12, .07, [-.12, 0, 0], .01);
      var ty = .28, tz = .12;
      if (top === 'crystal') { a.k(.08, .14, .08, orb, 0, ty, tz, [0, .78, 0], .02); a.k(.12, .03, .03, c.trim, 0, ty - .09, tz, 0, .01); }
      else if (top === 'skull') { a.k(.12, .11, .11, '#f6ecd8', 0, ty, tz, 0, .03); a.k(.025, .025, .01, orb, .025, ty, tz + .057, 0, .006); a.k(.025, .025, .01, orb, -.025, ty, tz + .057, 0, .006); }
      else if (top === 'flower') { [[0, .05], [.05, 0], [0, -.05], [-.05, 0]].forEach(function (q) { a.k(.06, .06, .06, '#ffb3e0', q[0], ty + q[1], tz, 0, .02); }); a.k(.05, .05, .07, '#fff36b', 0, ty, tz, 0, .02); }
      else if (top === 'cross') { a.k(.04, .16, .04, c.trim, 0, ty, tz, 0, .01); a.k(.12, .04, .04, c.trim, 0, ty + .03, tz, 0, .01); a.k(.06, .06, .06, orb, 0, ty + .03, tz + .02, [0, 0, .78], .015); }
      else { a.k(.11, .11, .11, orb, 0, ty, tz, [.4, .6, 0], .04); a.k(.14, .03, .14, c.trim, 0, ty - .07, tz, 0, .01); }
    },
    lance: function (a, c) { a.k(.06, .06, 1.0, c.metal, 0, -.27, .5, 0, .02); a.k(.04, .04, .14, c.metal, 0, -.27, 1.06, 0, .012); a.k(.14, .14, .06, c.trim, 0, -.27, .06, 0, .03); a.k(.03, .1, .14, c.cloth, 0, -.2, .82, 0, .01); }
  };
  function shield(body, c, kind, col) {
    col = col || c.armor2;
    if (kind === 'tower') { body.k(.34, .48, .05, col, .14, .37, .2, [0, -.12, 0], .03); body.k(.08, .32, .02, c.trim, .14, .39, .23, [0, -.12, 0], .01); body.k(.2, .06, .02, c.trim, .14, .45, .23, [0, -.12, 0], .01); }
    else if (kind === 'kite') { body.k(.22, .24, .04, col, .27, .38, .12, [0, -.6, 0], .025); body.k(.15, .1, .04, col, .27, .22, .12, [0, -.6, 0], .02); body.k(.04, .2, .02, c.trim, .275, .36, .14, [0, -.6, 0], .008); }
    else if (kind === 'leaf') { body.k(.2, .26, .035, col, .27, .37, .12, [0, -.6, .3], .07); body.k(.02, .22, .02, c.trim, .275, .37, .135, [0, -.6, .3], .006); }
    else if (kind === 'spike') { body.k(.24, .24, .04, col, .27, .37, .12, [0, -.6, .78], .03); body.k(.06, .06, .06, c.trim, .29, .37, .15, [0, -.6, .78], .015); }
    else { body.k(.24, .24, .045, col, .27, .37, .12, [0, -.6, 0], .06); body.k(.08, .08, .02, c.trim, .28, .37, .145, [0, -.6, 0], .02); }
  }
  /* cánh khối (bậc thang) — trái (wing=1) kéo về +X, phải về −X */
  function wingParts(c, kind, size, y, z) {
    size = size || 1; y = y || .5; z = z || -.12;
    var L = new Part([.08, y, z]), R = new Part([-.08, y, z]);
    var col = kind === 'bat' ? (c.armor2 || '#5a2a88') : (c.wing || '#ffffff'), col2 = kind === 'bat' ? (c.accent || '#9b5be0') : (c.wing2 || col);
    [[L, 1], [R, -1]].forEach(function (pp) {
      var p = pp[0], sd = pp[1], s = size;
      if (kind === 'bat') {
        p.k(.22 * s, .05 * s, .03, col2, sd * .11 * s, .02 * s, 0, [0, 0, sd * .25], .012);
        p.k(.2 * s, .18 * s, .02, col, sd * .16 * s, -.06 * s, 0, [0, 0, sd * .25], .01);
        p.k(.18 * s, .12 * s, .02, col, sd * .32 * s, .02 * s, 0, [0, 0, sd * .45], .01);
        p.k(.12 * s, .04 * s, .03, col2, sd * .38 * s, .12 * s, 0, [0, 0, sd * .45], .01);
      } else if (kind === 'bird') {
        p.k(.22 * s, .12 * s, .03, col, sd * .11 * s, 0, 0, [0, 0, sd * .15], .02);
        p.k(.2 * s, .1 * s, .025, col2, sd * .29 * s, .03 * s, 0, [0, 0, sd * .25], .018);
        p.k(.16 * s, .07 * s, .02, col, sd * .44 * s, .07 * s, 0, [0, 0, sd * .35], .015);
      } else { // cánh tiên: 2 lá trên dưới
        p.k(.18 * s, .2 * s, .015, col, sd * .1 * s, .09 * s, 0, [0, 0, sd * .5], .06 * s);
        p.k(.13 * s, .14 * s, .015, c.wing2 || '#ffd6f2', sd * .08 * s, -.08 * s, 0, [0, 0, -sd * .4], .045 * s);
      }
      p.wing = sd;
    });
    return [L, R];
  }

  /* ---------- người lính hoàn chỉnh ---------- */
  function humanoid(race, o) {
    var c = PAL[race], body = new Part();
    var raceOpt = { dragon: { horns: 1, tail: c.armor }, human: {}, fairy: { ears: 1 }, demon: { horns: 1, hornColor: c.horn } }[race];
    for (var k in raceOpt) if (o[k] == null) o[k] = raceOpt[k];
    torso(body, c, o); head(body, c, o); armL(body, c, o);
    var arm = armR(c, o), parts = { body: body, armR: arm };
    if (!o.robe) { var legs = legParts(c, o); parts.legL = legs[0]; parts.legR = legs[1]; }
    if (race === 'fairy' && o.wings !== false) { var w = wingParts(c, 'fairy', 1, .52, -.11); parts.wingL = w[0]; parts.wingR = w[1]; }
    return { parts: parts, c: c, body: body, arm: arm };
  }

  /* ---------- thú 4 chân khối ---------- */
  function quad(o) {
    var body = new Part(), legs = [], L = o.len || .62, H = o.h || .44, W = o.w || .3, T = o.t || .3, c1 = o.color, c2 = o.color2 || o.color;
    body.k(W, T, L, c1, 0, H + T / 2 - .04, 0, 0, .06);
    if (o.belly) body.k(W - .04, .06, L - .1, o.belly, 0, H - .02, 0, 0, .02);
    var hz = L / 2, hy = H + T;
    if (o.neck !== false) body.k(W * .62, .3 * (o.neckLen || 1), .18, c1, 0, hy + .06, hz - .03, [-.45, 0, 0], .04);
    var hx = 0, headY = hy + .2 * (o.neckLen || 1), headZ = hz + .12;
    if (o.headKind === 'reptile') {
      body.k(W * .8, .18, .26, c1, 0, headY, headZ, 0, .04);
      body.k(W * .7, .1, .16, c2, 0, headY - .05, headZ + .16, 0, .03);
      body.k(.05, .1, .05, o.horn || '#fff3dc', .07, headY + .13, headZ - .06, [-.5, 0, 0], .015); body.k(.05, .1, .05, o.horn || '#fff3dc', -.07, headY + .13, headZ - .06, [-.5, 0, 0], .015);
    } else {
      body.k(W * .6, .18, .22, c1, 0, headY, headZ, [.15, 0, 0], .04);
      body.k(W * .55, .13, .14, c2, 0, headY - .04, headZ + .14, [.15, 0, 0], .035);
      body.k(.03, .025, .01, DARK, .04, headY - .04, headZ + .215, 0, .006); body.k(.03, .025, .01, DARK, -.04, headY - .04, headZ + .215, 0, .006);
      if (o.ears !== false) { body.k(.05, .09, .04, c1, .06, headY + .12, headZ - .07, 0, .015); body.k(.05, .09, .04, c1, -.06, headY + .12, headZ - .07, 0, .015); }
    }
    body.k(.04, .04, .02, o.eye || DARK, W * .3, headY + .03, headZ + .1, 0, .008); body.k(.04, .04, .02, o.eye || DARK, -W * .3, headY + .03, headZ + .1, 0, .008);
    body.k(.012, .012, .01, WHITE, W * .3 + .01, headY + .045, headZ + .111, 0, .003); body.k(.012, .012, .01, WHITE, -W * .3 + .01, headY + .045, headZ + .111, 0, .003);
    if (o.mane) { for (var i = 0; i < 4; i++) body.k(.07, .1, .08, o.mane, 0, hy + .02 + i * .06, hz - .14 + i * .06, [-.45, 0, 0], .02); body.k(.1, .26, .1, o.mane, 0, H + T / 2 - .05, -L / 2 - .05, [.5, 0, 0], .03); }
    else if (o.tail !== false) body.k(.07, .2, .07, c1, 0, H + T / 2, -L / 2 - .06, [.7, 0, 0], .025);
    if (o.horn1) body.k(.04, .18, .04, o.horn1, 0, headY + .17, headZ + .02, [.45, 0, 0], .012);
    if (o.saddle) { body.k(W + .02, .05, .24, o.saddle, 0, H + T - .02, -.02, 0, .015); body.k(W + .04, .2, .28, o.saddle2 || o.saddle, 0, H + T / 2 - .03, -.02, 0, .02); }
    var lx = W / 2 - .06, lz = L / 2 - .08, legH = H + .02, lw = o.legW || .1;
    [[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].forEach(function (p, i) {
      var leg = new Part([p[0], H + .02, p[1]]);
      leg.k(lw, legH - .06, lw + .01, c1, 0, -(legH - .06) / 2, 0, 0, .025);
      leg.k(lw + .02, .07, lw + .03, o.hoof || '#5a4434', 0, -legH + .035, .005, 0, .02);
      leg.phase = i === 0 || i === 3 ? 0 : 1;
      legs.push(leg);
    });
    return { body: body, legs: legs, H: H, top: H + T - .02 };
  }
  // người cưỡi: nửa trên ngồi trên lưng thú
  function rider(race, o, seatY) {
    var h = humanoid(race, Object.assign({ wings: false }, o));
    h.body.shift(0, seatY - .31, -.02);
    h.body.k(.12, .1, .2, h.c.armor2, .16, seatY - .02, .06, [0, 0, .5], .03);
    h.body.k(.12, .1, .2, h.c.armor2, -.16, seatY - .02, .06, [0, 0, -.5], .03);
    h.body.k(.13, .14, .1, h.c.leather, .2, seatY - .13, .12, [0, 0, .2], .03);
    h.body.k(.13, .14, .1, h.c.leather, -.2, seatY - .13, .12, [0, 0, -.2], .03);
    h.arm.pivot = [h.arm.pivot[0], h.arm.pivot[1] + seatY - .31, h.arm.pivot[2] - .02];
    return h;
  }

  /* ================= 44 mô hình ================= */
  function build(race, role) {
    var c = PAL[race], parts = {}, scale = 1, info = { kind: 'humanoid' };
    var plume = { dragon: '#ffd23a', human: '#ff5d5d', fairy: '#8ff7ff', demon: '#ff5fa8' }[race];
    var setH = function (h) { for (var k in h.parts) parts[k] = h.parts[k]; };
    switch (role) {
      case 'linh': {
        var h = humanoid(race, { helmet: race === 'human' ? 'cap' : race === 'dragon' ? 'band' : 'hair', bandColor: c.trim, tabard: race === 'human' ? c.cloth : race === 'fairy' ? c.cloth : null, chest: race === 'dragon' ? c.trim : null });
        W.sword(h.arm, c, .38, race === 'dragon');
        shield(h.body, c, race === 'human' ? 'kite' : race === 'fairy' ? 'leaf' : race === 'demon' ? 'spike' : 'round', race === 'human' ? c.cloth : race === 'dragon' ? c.trim : race === 'fairy' ? c.cloth : c.armor2);
        setH(h); scale = .86; break;
      }
      case 'thuan': {
        var h2 = humanoid(race, { helmet: 'full', heavy: 1, pauldrons: 1, helmColor: race === 'dragon' ? c.armor : null });
        shield(h2.body, c, 'tower', race === 'human' ? c.cloth : race === 'fairy' ? '#ffffff' : race === 'dragon' ? c.armor2 : c.armor);
        if (race === 'dragon') { h2.body.k(.05, .09, .05, c.horn, .1, .55, .25, [-.3, 0, 0], .015); h2.body.k(.05, .09, .05, c.horn, .19, .55, .24, [-.3, 0, 0], .015); }
        if (race === 'fairy') h2.body.k(.07, .07, .03, c.gem, .14, .4, .245, [0, -.12, .78], .012);
        if (race === 'demon') h2.body.k(.1, .09, .04, '#f6ecd8', .14, .42, .245, [0, -.12, 0], .02);
        if (race === 'human' || race === 'fairy') W.spear(h2.arm, c, .8); else W.hammer(h2.arm, c);
        setH(h2); scale = .92; break;
      }
      case 'cung': {
        var h3 = humanoid(race, { helmet: race === 'fairy' ? 'tiara' : race === 'demon' ? 'hood' : race === 'human' ? 'cap' : 'band', capColor: c.cloth, hoodColor: c.armor2, bandColor: c.trim, sleeve: c.cloth, torsoColor: race === 'human' ? '#7fb26a' : null, capColor2: null, ponytail: race === 'fairy' });
        if (race === 'human') h3.body.k(.3, .05, .19, '#5c8a4a', 0, .55, 0, 0, .015);
        // cung khối (cung cong ghép 5 đoạn) ở tay trái
        var bc = race === 'fairy' ? '#f6e7b8' : race === 'demon' ? '#3a2056' : c.leather;
        [[-2, .55], [-1, .25], [0, 0], [1, -.25], [2, -.55]].forEach(function (q) { h3.body.k(.035, .1, .035, bc, .27, .37 + q[0] * .085, .2 - Math.abs(q[0]) * .03, [q[1], 0, 0], .01); });
        h3.body.k(.008, .42, .008, '#fff8e8', .27, .37, .1);
        // ống tên
        h3.body.k(.09, .26, .09, c.leather, -.08, .5, -.13, [.3, 0, .25], .02);
        [-.11, -.07, -.03].forEach(function (x) { h3.body.k(.02, .07, .02, WHITE, x, .66, -.18, [.3, 0, .25], .006); });
        h3.arm.k(.015, .015, .34, c.leather, 0, -.27, .14, 0, .005);
        setH(h3); scale = .84; break;
      }
      case 'y': {
        var h4 = humanoid(race, { helmet: race === 'human' ? 'hood' : race === 'fairy' ? 'tiara' : race === 'demon' ? 'hood' : 'crown', robe: 1, robeColor: race === 'human' ? '#ffffff' : race === 'demon' ? '#b0204c' : race === 'dragon' ? '#ffe9c4' : c.cloth, hoodColor: race === 'human' ? '#ffffff' : '#7a1838', sleeve: race === 'human' ? '#ffffff' : race === 'dragon' ? '#ffe9c4' : c.cloth, torsoColor: race === 'human' ? '#ffffff' : race === 'dragon' ? '#ffe9c4' : null, halo: race === 'human' || race === 'fairy', ponytail: race === 'fairy' });
        W.staff(h4.arm, c, race === 'demon' ? '#ff2e5a' : race === 'dragon' ? '#ff8a2a' : race === 'fairy' ? '#8ff7ff' : '#fff2a0', race === 'fairy' ? 'flower' : race === 'demon' ? 'skull' : race === 'human' ? 'cross' : 'orb');
        h4.body.k(.08, .16, .02, c.trim, 0, .2, .14, 0, .01);
        setH(h4); scale = .86; break;
      }
      case 'phapsu': {
        var robeC = race === 'dragon' ? c.armor : race === 'human' ? '#3e62d8' : race === 'demon' ? '#3b2066' : c.cloth;
        var h5 = humanoid(race, { helmet: race === 'fairy' ? 'tiara' : 'wizard', robe: 1, robeColor: robeC, hatColor: race === 'dragon' ? c.armor2 : race === 'human' ? '#2c47a8' : race === 'demon' ? '#2a1648' : c.cloth, sleeve: robeC, torsoColor: robeC, horns: race === 'demon' ? 1 : race === 'dragon' ? 1 : 0, hairColor: race === 'human' ? '#e8e8f0' : null, ponytail: race === 'fairy' });
        if (race === 'human') h5.body.k(.14, .16, .08, '#f2f2f8', 0, .6, .13, 0, .03); // râu trắng
        W.staff(h5.arm, c, race === 'dragon' ? '#ff5a1a' : race === 'human' ? '#7fd7ff' : race === 'fairy' ? '#c6fbff' : '#c88cff', race === 'fairy' ? 'crystal' : race === 'demon' ? 'skull' : 'orb');
        h5.body.k(.07, .07, .07, race === 'dragon' ? '#ffb03a' : c.gem || c.accent, .27, .36, .12, [.4, .6, 0], .02);
        setH(h5); scale = .86; break;
      }
      case 'chihuy': {
        var h6 = humanoid(race, { helmet: race === 'human' ? 'plume' : race === 'fairy' ? 'tiara' : race === 'demon' ? 'horned' : 'crest', plume: plume, cape: race === 'human' ? c.cloth : race === 'fairy' ? '#ffffff' : race === 'dragon' ? c.armor2 : '#3b2066', heavy: 1, pauldrons: 1, hornSize: 1.5, chest: c.trim });
        // cờ hiệu sau lưng
        h6.body.k(.03, .85, .03, c.trim, -.1, .72, -.15, 0, .01);
        h6.body.k(.24, .18, .02, race === 'dragon' ? '#ffd23a' : race === 'human' ? '#ffffff' : race === 'fairy' ? c.cloth : c.accent, -.23, 1.02, -.15, 0, .01);
        h6.body.k(.08, .08, .01, race === 'human' ? c.cloth : c.armor2, -.23, 1.02, -.139, [0, 0, .78], .008);
        h6.body.k(.05, .05, .05, c.trim, -.1, 1.15, -.15, 0, .015);
        W.sword(h6.arm, c, .44, true);
        setH(h6); scale = .94; break;
      }
      case 'thichkhach': {
        var hood = race === 'dragon' ? '#7a2414' : race === 'human' ? '#30364a' : race === 'fairy' ? '#1d7a56' : '#2a1848';
        var h7 = humanoid(race, { helmet: 'hood', hoodColor: hood, mask: race === 'demon' ? '#f6ecd8' : '#30364a', torsoColor: race === 'human' ? '#424a60' : race === 'fairy' ? '#2a9a6c' : race === 'dragon' ? '#9a2e1a' : '#3a2266', sleeve: '#30364a', legColor: '#30364a', cape: '#1e2230', wings: false, beltColor: '#1e2230' });
        W.dagger(h7.arm, c);
        h7.body.k(.03, .17, .014, c.metal, .27, .3, .16, [1.2, 0, 0], .006);
        h7.body.k(.05, .05, .05, '#ff4d4d', -.12, .32, .1, 0, .015);
        setH(h7); scale = .82; break;
      }
      case 'ky': {
        var mount = race === 'dragon' ? quad({ color: '#e5543c', color2: '#ffb36b', belly: '#ffb36b', headKind: 'reptile', len: .64, h: .4, w: .28, t: .28, horn: c.horn, saddle: c.trim, saddle2: c.armor2, eye: '#ffcf3a', hoof: '#ffd36b' })
          : race === 'human' ? quad({ color: '#ffffff', color2: '#f0e6d8', mane: '#d9c4a6', len: .62, h: .44, w: .28, t: .3, saddle: c.trim, saddle2: c.cloth })
          : race === 'fairy' ? quad({ color: '#ffffff', color2: '#f2fbff', mane: '#bff7ff', len: .6, h: .44, w: .27, t: .29, saddle: c.trim, saddle2: c.cloth })
          : quad({ color: '#3a2a52', color2: '#4e3a6a', mane: '#ff5fa8', len: .62, h: .44, w: .28, t: .3, saddle: c.armor2, saddle2: c.armor, eye: '#ff2e5a', hoof: '#c88cff' });
        var rd = rider(race, { helmet: race === 'human' ? 'plume' : race === 'fairy' ? 'tiara' : race === 'demon' ? 'horned' : 'crest', plume: plume, wings: false }, mount.top + .02);
        merge(mount.body, rd.body);
        W.lance(rd.arm, c);
        parts.body = mount.body; parts.armR = rd.arm;
        mount.legs.forEach(function (l, i) { parts['q' + i] = l; });
        if (race === 'fairy') { var fw = wingParts({ wing: '#ffffff', wing2: '#dff8ff' }, 'bird', 1.2, mount.top - .05, .02); parts.wingL = fw[0]; parts.wingR = fw[1]; }
        info.kind = 'mount'; scale = 1.05; break;
      }
      case 'congthanh': {
        var b = new Part(), arm = new Part([0, .34, -.05]);
        var wood = race === 'demon' ? '#f0e4cc' : race === 'fairy' ? '#fbf3dc' : '#b47a44', wood2 = race === 'demon' ? '#c9b89a' : race === 'fairy' ? '#d9c6a0' : '#8a5a30';
        b.k(.52, .1, .74, wood, 0, .23, 0, 0, .025);
        b.k(.54, .03, .76, c.trim, 0, .29, 0, 0, .01);
        [[.28, .24], [-.28, .24], [.28, -.24], [-.28, -.24]].forEach(function (p) { b.a(CY(.12, .12, .06, 8), wood2, [p[0], .13, p[1]], [0, 0, Math.PI / 2]); b.k(.07, .05, .05, c.trim, p[0] * 1.08, .13, p[1], 0, .012); });
        if (race === 'dragon') {
          arm.k(.2, .2, .62, '#6a3f2c', 0, .1, .1, [-.35, 0, 0], .05);
          arm.k(.24, .05, .05, c.trim, 0, .03, -.08, [-.35, 0, 0], .015);
          arm.k(.24, .2, .24, c.armor, 0, .22, .38, [-.35, 0, 0], .05);
          arm.k(.05, .12, .05, c.horn, .08, .35, .33, [-.6, 0, 0], .015); arm.k(.05, .12, .05, c.horn, -.08, .35, .33, [-.6, 0, 0], .015);
          arm.k(.1, .08, .04, '#ffcf3a', 0, .24, .51, [-.35, 0, 0], .02);
          b.k(.36, .2, .3, c.armor2, 0, .38, -.2, 0, .04);
        } else if (race === 'human') {
          b.k(.1, .3, .1, wood2, 0, .42, 0, 0, .02);
          arm.k(.08, .07, .82, wood, 0, .14, .1, 0, .02);
          arm.k(.8, .05, .06, wood2, 0, .14, .32, 0, .015);
          arm.k(.06, .05, .12, wood2, .38, .14, .26, [0, .5, 0], .015); arm.k(.06, .05, .12, wood2, -.38, .14, .26, [0, -.5, 0], .015);
          arm.k(.04, .04, .16, c.metal, 0, .2, .56, 0, .01);
          b.k(.54, .05, .06, c.cloth, 0, .3, .32, 0, .01);
        } else if (race === 'fairy') {
          b.k(.3, .2, .3, '#ffffff', 0, .38, 0, 0, .05);
          arm.k(.05, .44, .05, c.trim, 0, .26, 0, 0, .015);
          arm.k(.16, .26, .16, '#8ff7ff', 0, .6, 0, [0, .78, 0], .04);
          arm.k(.36, .025, .36, '#c6fbff', 0, .6, 0, [0, .78, 0], .01);
          arm.k(.3, .025, .3, '#ffe98a', 0, .5, 0, [0, 0, 0], .01);
        } else {
          b.k(.08, .38, .08, wood2, .15, .44, -.1, 0, .02); b.k(.08, .38, .08, wood2, -.15, .44, -.1, 0, .02);
          arm.k(.05, .6, .05, wood, 0, .2, .06, [-.9, 0, 0], .015);
          arm.k(.18, .16, .17, '#f6ecd8', 0, .42, .32, 0, .05); arm.k(.04, .04, .02, '#ff2e5a', .04, .43, .41, 0, .008); arm.k(.04, .04, .02, '#ff2e5a', -.04, .43, .41, 0, .008);
          b.k(.08, .08, .08, c.accent, 0, .33, -.35, [0, .78, 0], .02);
        }
        var crew = humanoid(race, { helmet: race === 'human' ? 'cap' : 'hair', wings: false });
        crew.body.shift(.24, .02, -.4, .7);
        merge(b, crew.body);
        parts.body = b; parts.armR = arm; info.kind = 'siege'; scale = 1.05; break;
      }
      case 'tuong': {
        var ec = race === 'dragon' ? '#d4583e' : race === 'human' ? '#b6c0cf' : race === 'fairy' ? '#f7fcff' : '#f2e8d2';
        var e = quad({ color: ec, color2: ec, len: .66, h: .5, w: .52, t: .5, neck: false, ears: false, tail: true, legW: .16, hoof: race === 'demon' ? '#c88cff' : '#6a5a4a' });
        var hb = e.body, hy = .82, hz = .42;
        hb.k(.42, .38, .3, ec, 0, hy, hz, 0, .08);
        [[0, .1], [1, .25], [2, .45], [3, .7]].forEach(function (q) { hb.k(.12 - q[0] * .015, .14, .12 - q[0] * .015, ec, 0, hy - .2 - q[0] * .11, hz + .17 + q[0] * .035, [q[1], 0, 0], .03); });
        hb.k(.06, .28, .26, race === 'fairy' ? '#ffd6ee' : ec, .27, hy + .02, hz - .06, [0, -.35, 0], .03);
        hb.k(.06, .28, .26, race === 'fairy' ? '#ffd6ee' : ec, -.27, hy + .02, hz - .06, [0, .35, 0], .03);
        hb.k(.05, .05, .24, '#fff8e8', .11, hy - .17, hz + .24, [.5, 0, 0], .02); hb.k(.05, .05, .24, '#fff8e8', -.11, hy - .17, hz + .24, [.5, 0, 0], .02);
        hb.k(.05, .05, .02, race === 'demon' ? '#ff2e5a' : DARK, .13, hy + .05, hz + .155, 0, .01); hb.k(.05, .05, .02, race === 'demon' ? '#ff2e5a' : DARK, -.13, hy + .05, hz + .155, 0, .01);
        hb.k(.5, .05, .52, c.trim, 0, 1.03, -.05, 0, .015);
        hb.k(.44, .18, .46, race === 'human' ? c.cloth : race === 'fairy' ? '#ffffff' : race === 'dragon' ? c.armor2 : c.armor, 0, 1.14, -.05, 0, .04);
        hb.k(.58, .34, .03, race === 'human' ? c.cloth : race === 'dragon' ? c.armor : race === 'fairy' ? c.cloth : c.cloth, 0, .82, .21, 0, .01);
        hb.k(.03, .5, .03, c.trim, .17, 1.45, -.22, 0, .01); hb.k(.18, .12, .02, plume, .27, 1.62, -.22, 0, .01);
        if (race === 'dragon') { hb.k(.07, .2, .07, c.horn, 0, hy + .28, hz + .02, [.3, 0, 0], .02); [0, 1, 2].forEach(function (i) { hb.k(.06, .1, .06, c.trim, 0, 1.03, -.3 - i * .1, 0, .015); }); }
        if (race === 'fairy') { hb.k(.22, .16, .2, '#ffffff', .32, .26, .22, 0, .07); hb.k(.2, .14, .18, '#ffffff', -.32, .22, -.24, 0, .06); hb.k(.18, .12, .16, '#f0faff', .32, .2, -.3, 0, .05); }
        if (race === 'demon') [0, 1, 2, 3].forEach(function (i) { hb.k(.56, .05, .05, '#f6ecd8', 0, .7, -.25 + i * .13, 0, .02); });
        var rdr = rider(race, { helmet: race === 'human' ? 'cap' : 'hair', wings: false }, 1.24);
        rdr.body.shift(0, 0, -.1);
        merge(hb, rdr.body);
        parts.body = hb; e.legs.forEach(function (l, i) { parts['q' + i] = l; });
        info.kind = 'mount'; scale = 1.25; break;
      }
      case 'thanthu': {
        if (race === 'dragon') {
          var d = quad({ color: '#e5503a', color2: '#ffb36b', belly: '#ffb36b', len: .8, h: .38, w: .36, t: .32, neck: false, headKind: 'reptile', ears: false, tail: false, hoof: '#ffd36b', horn: '#fff3dc', eye: '#ffcf3a', legW: .12 });
          var db = d.body;
          [0, 1, 2].forEach(function (n) { db.k(.2 - n * .02, .18, .18, '#e5503a', 0, .74 + n * .12, .4 + n * .1, [-.5, 0, 0], .05); });
          db.k(.28, .22, .36, '#e5503a', 0, 1.08, .74, 0, .06); db.k(.24, .1, .22, '#ffb36b', 0, .99, .86, 0, .03);
          db.k(.06, .2, .06, '#fff3dc', .09, 1.24, .62, [-.7, 0, 0], .02); db.k(.06, .2, .06, '#fff3dc', -.09, 1.24, .62, [-.7, 0, 0], .02);
          db.k(.05, .05, .02, '#ffcf3a', .1, 1.12, .93, 0, .01); db.k(.05, .05, .02, '#ffcf3a', -.1, 1.12, .93, 0, .01);
          [0, 1, 2, 3, 4].forEach(function (t) { db.k(.2 - t * .03, .16 - t * .02, .2, '#e5503a', 0, .5 - t * .05, -.48 - t * .17, [.15, 0, 0], .04); });
          db.k(.1, .12, .12, '#ffd36b', 0, .3, -1.3, [.4, 0, 0], .03);
          [0, 1, 2, 3, 4].forEach(function (s) { db.k(.05, .09, .05, '#ffd36b', 0, .76, .28 - s * .17, 0, .015); });
          var dw = wingParts({ armor2: '#ff8a5a', accent: '#ffcf3a' }, 'bat', 2.2, .7, .05); parts.wingL = dw[0]; parts.wingR = dw[1];
          parts.body = db; d.legs.forEach(function (l, i) { parts['q' + i] = l; }); info.kind = 'mount'; info.fly = 1; scale = 1.5;
        } else if (race === 'human') {
          var q = quad({ color: '#ffd23a', color2: '#fff2b0', belly: '#fff2b0', mane: '#ff7a2a', len: .66, h: .5, w: .3, t: .32, horn1: '#ffffff', hoof: '#c98a1a', eye: '#1d4fa8' });
          var qb = q.body;
          [-1, 1].forEach(function (sd) { [0, 1, 2, 3].forEach(function (i) { qb.k(.03, .07, .07, '#fff2b0', sd * .155, .72, -.18 + i * .12, 0, .012); }); });
          [0, 1, 2].forEach(function (i) { qb.k(.06, .12, .06, '#ff7a2a', (i - 1) * .07, .98, .05 - i * .02, [-.3, 0, 0], .015); });
          qb.k(.07, .2, .07, '#ff7a2a', 0, .78, -.42, [.6, 0, 0], .02);
          parts.body = qb; q.legs.forEach(function (l, i) { parts['q' + i] = l; }); info.kind = 'mount'; scale = 1.5;
        } else if (race === 'fairy') {
          var pb = new Part();
          pb.k(.32, .3, .42, '#ff7a3a', 0, .6, 0, 0, .1);
          pb.k(.26, .22, .3, '#ffd24a', 0, .52, .1, 0, .08);
          pb.k(.24, .24, .24, '#ff8a3a', 0, .9, .26, 0, .07);
          pb.k(.08, .06, .14, '#ffd24a', 0, .87, .44, [.2, 0, 0], .02);
          pb.k(.05, .05, .02, DARK, .08, .93, .38, 0, .01); pb.k(.05, .05, .02, DARK, -.08, .93, .38, 0, .01);
          [0, 1, 2].forEach(function (i) { pb.k(.05, .14, .05, '#ffd24a', 0, 1.06 + i * .02, .22 - i * .07, [-.6 - i * .3, 0, 0], .015); });
          [-2, -1, 0, 1, 2].forEach(function (t) { pb.k(.08, .05, .7 - Math.abs(t) * .08, t % 2 ? '#ffd24a' : '#ff5a2a', t * .07, .52, -.52 + Math.abs(t) * .03, [-.25, t * .2, 0], .02); });
          pb.k(.03, .25, .03, '#ffb03a', .08, .26, 0, 0, .01); pb.k(.03, .25, .03, '#ffb03a', -.08, .26, 0, 0, .01);
          var pw = wingParts({ wing: '#ffb03a', wing2: '#ff6a3a' }, 'bird', 2.3, .66, 0); parts.wingL = pw[0]; parts.wingR = pw[1];
          parts.body = pb; info.kind = 'bird'; info.fly = 1; scale = 1.45;
        } else {
          var mv = humanoid('demon', { helmet: 'crown', heavy: 1, pauldrons: 1, horns: 1, hornSize: 2.2, cape: '#2a1648', torsoColor: '#4e2a82', chest: '#ff6fb5' });
          W.axe(mv.arm, c, 1.6);
          mv.body.k(.08, .08, .02, '#ff3d7a', 0, .48, .1, [0, 0, .78], .015);
          setH(mv);
          var mw = wingParts({ armor2: '#4e2a82', accent: '#ff6fb5' }, 'bat', 1.6, .56, -.12); parts.wingL = mw[0]; parts.wingR = mw[1];
          scale = 1.75; info.big = 1;
        }
        break;
      }
    }
    var out = { parts: {}, scale: scale, info: info };
    for (var k in parts) { var p = parts[k]; out.parts[k] = { geo: p.build(), pivot: p.pivot, phase: p.phase, wing: p.wing }; }
    return out;
  }

  /* quái trung lập (khối bo góc) */
  function buildMonster(kind) {
    var parts = {}, scale = 1, info = { kind: 'mount' };
    if (kind === 'wolf') {
      var w = quad({ color: '#9aa6b8', color2: '#e2e8f0', belly: '#e2e8f0', mane: '#7a8496', len: .56, h: .32, w: .24, t: .24, eye: '#ffcf3a' });
      w.body.k(.03, .05, .02, WHITE, .03, .48, .56, 0, .006); w.body.k(.03, .05, .02, WHITE, -.03, .48, .56, 0, .006);
      parts.body = w.body; w.legs.forEach(function (l, i) { parts['q' + i] = l; }); scale = 1.1;
    } else if (kind === 'ox') {
      var o = quad({ color: '#8a5432', color2: '#5e3820', belly: '#b07a52', len: .66, h: .46, w: .4, t: .38, eye: '#ff3d2e', hoof: '#2a1a10', legW: .13 });
      o.body.k(.06, .06, .24, '#fff3dc', .2, 1.02, .42, [0, .9, -.4], .02); o.body.k(.06, .06, .24, '#fff3dc', -.2, 1.02, .42, [0, -.9, .4], .02);
      o.body.k(.06, .02, .06, '#ffd36b', 0, .86, .64, 0, .01);
      parts.body = o.body; o.legs.forEach(function (l, i) { parts['q' + i] = l; }); scale = 1.5;
    } else {
      var b = new Part(), arm = new Part([-.24, .72, 0]);
      b.k(.36, .8, .3, '#9a6438', 0, .42, 0, 0, .06);
      b.k(.8, .5, .7, '#58b84e', 0, 1.06, 0, 0, .15); b.k(.5, .4, .5, '#74d26a', .25, 1.3, .1, 0, .12); b.k(.48, .36, .46, '#47a845', -.22, 1.24, -.12, 0, .11);
      b.k(.07, .07, .02, '#ffe066', .07, .66, .16, 0, .015); b.k(.07, .07, .02, '#ffe066', -.07, .66, .16, 0, .015);
      b.k(.08, .3, .08, '#7a4a28', .26, .64, .05, [.2, 0, -.9], .02);
      arm.k(.1, .45, .1, '#7a4a28', 0, -.2, .06, [.3, 0, 0], .025); arm.k(.2, .16, .2, '#58b84e', 0, -.44, .16, 0, .06);
      [-.1, .1].forEach(function (x) { b.k(.12, .14, .16, '#6a4022', x, .06, .06, [.3, 0, x * 2], .03); });
      parts.body = b; parts.armR = arm; info.kind = 'siege'; scale = 2.3;
    }
    var out = { parts: {}, scale: scale, info: info };
    for (var k in parts) { var p = parts[k]; out.parts[k] = { geo: p.build(), pivot: p.pivot, phase: p.phase, wing: p.wing }; }
    return out;
  }

  var CACHE = {};
  Models.get = function (race, role) { var k = race + '.' + role; return CACHE[k] || (CACHE[k] = build(race, role)); };
  Models.monster = function (kind) { var k = 'm.' + kind; return CACHE[k] || (CACHE[k] = buildMonster(kind)); };
})(typeof window !== 'undefined' ? window : global);
