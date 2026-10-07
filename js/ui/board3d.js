/* Bàn cờ 3D (Three.js / WebGL) — phong cách anime tươi sáng (cảm hứng Ragnarok Online 3):
 * đảo cỏ lơ lửng giữa trời xanh, bàn đá viền vàng, quân chibi tô bóng hoạt hình (toon),
 * camera xoay/zoom, kéo-thả quân, VFX riêng cho từng loại đòn đánh và kỹ năng.
 * Giao diện giống TT.Board (2D) để game.js dùng chung. */
(function (G) {
  'use strict';
  var TT = G.TT, E = TT.Engine, F = TT.FACTIONS, THREE = G.THREE;
  if (!THREE) return;

  TT.webglOK = (function () {
    try { var c = document.createElement('canvas'); return !!(G.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  })();

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
  function col(c) { return new THREE.Color(c); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var FX_COLOR = { dragon: '#ff7a2a', human: '#ffe28a', fairy: '#6ff7e2', demon: '#b67bff' };
  var PS = 1.22; // tỉ lệ quân
  var FACING = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];

  /* ---------- tài nguyên dùng chung ---------- */
  var GEO = {}, TEX = {}, MAT = {};
  function geo(k, fn) { return GEO[k] || (GEO[k] = fn()); }
  function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 28); }
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function stoneTex() {
    return TEX.stone || (TEX.stone = (function () {
      var t = canvasTex(256, 256, function (g) {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
        for (var i = 0; i < 1800; i++) { var v = 205 + Math.random() * 50 | 0; g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.15 + Math.random() * .2) + ')'; var s = 2 + Math.random() * 9; g.fillRect(Math.random() * 256, Math.random() * 256, s, s); }
        g.strokeStyle = 'rgba(120,110,95,.25)'; g.lineWidth = 2;
        for (var k = 0; k < 3; k++) { g.beginPath(); var x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (var j = 0; j < 5; j++) { x += (Math.random() - .5) * 50; y += (Math.random() - .5) * 50; g.lineTo(x, y); } g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
        g.strokeStyle = 'rgba(90,80,60,.35)'; g.lineWidth = 3; g.strokeRect(9, 9, 238, 238);
      }); t.anisotropy = 4; return t;
    })());
  }
  function glowTex() {
    return TEX.glow || (TEX.glow = canvasTex(64, 64, function (g) {
      var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.3, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    }));
  }
  function starTex() {
    return TEX.star || (TEX.star = canvasTex(64, 64, function (g) {
      g.translate(32, 32); g.fillStyle = '#fff';
      g.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 6 : 30, a = i * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
      var grd = g.createRadialGradient(0, 0, 0, 0, 0, 14); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(-32, -32, 64, 64);
    }));
  }
  function skyTex() {
    return TEX.sky || (TEX.sky = canvasTex(16, 512, function (g) {
      var grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#3d8fe6'); grd.addColorStop(.55, '#8fd0ff'); grd.addColorStop(.8, '#d8f1ff'); grd.addColorStop(1, '#fff6e0');
      g.fillStyle = grd; g.fillRect(0, 0, 16, 512);
    }));
  }
  var toonGrad = null;
  function toonMap() {
    if (toonGrad) return toonGrad;
    var d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
    toonGrad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter; toonGrad.needsUpdate = true;
    return toonGrad;
  }
  function textSprite(text, color, h, bg, stroke) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), fs = 64, font = '800 ' + fs + 'px "Baloo 2", "Nunito", Arial, sans-serif';
    g.font = font;
    var w = Math.ceil(g.measureText(text).width) + 44; c.width = w; c.height = 96;
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (bg) { g.fillStyle = bg; var r = 40; g.beginPath(); g.moveTo(r, 8); g.arcTo(w - 4, 8, w - 4, 88, r); g.arcTo(w - 4, 88, 4, 88, r); g.arcTo(4, 88, 4, 8, r); g.arcTo(4, 8, w - 4, 8, r); g.fill(); g.strokeStyle = '#ffe9a8'; g.lineWidth = 5; g.stroke(); }
    g.lineWidth = 12; g.strokeStyle = stroke || 'rgba(20,24,48,.9)'; g.lineJoin = 'round'; g.strokeText(text, w / 2, 52);
    g.fillStyle = color; g.fillText(text, w / 2, 52);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(h * w / 96, h, 1); sp.renderOrder = 20; sp.userData.ownTex = true;
    return sp;
  }
  function disposeObj(o) {
    o.traverse(function (m) {
      if (m.material) { (Array.isArray(m.material) ? m.material : [m.material]).forEach(function (mt) { if (mt.userData.shared) return; if (mt.map && m.userData.ownTex) mt.map.dispose(); mt.dispose(); }); }
      if (m.geometry && m.geometry.userData.own) m.geometry.dispose();
    });
  }
  function mat(k, fn) { if (!MAT[k]) { MAT[k] = fn(); MAT[k].userData.shared = true; } return MAT[k]; }
  function std(c, rough, metal, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: col(c), roughness: rough, metalness: metal }, extra || {})); }
  function toon(c, extra) { return new THREE.MeshToonMaterial(Object.assign({ color: col(c), gradientMap: toonMap() }, extra || {})); }
  function addMat(c) { return new THREE.MeshBasicMaterial({ color: col(c), transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }); }
  function slow() { return G.TT_FX_SLOW || 1; }
  var M = {
    gold: function () { return mat('gold', function () { return std('#ffc94a', .28, .85, { emissive: col('#6a4200'), emissiveIntensity: .45 }); }); },
    steel: function () { return mat('steel', function () { return toon('#e4ecf5'); }); },
    wood: function () { return mat('wood', function () { return toon('#9a6a3e'); }); },
    dark: function () { return mat('dark', function () { return toon('#3c4256'); }); },
    cloth: function () { return mat('cloth', function () { return toon('#fff7e6'); }); },
    ivory: function () { return mat('ivory', function () { return toon('#fff3da'); }); },
    skin: function () { return mat('skin', function () { return toon('#ffd9b8'); }); }
  };
  function facMat(fid) { return mat('fac-' + fid, function () { return toon(F[fid].color, { emissive: col(F[fid].color), emissiveIntensity: .08 }); }); }
  function facMat2(fid) { return mat('fac2-' + fid, function () { return toon(fid === 'demon' ? '#d8c6ff' : F[fid].color2); }); }
  function hairMat(fid) { return mat('hair-' + fid, function () { return toon({ dragon: '#ffcf5a', human: '#6a4a2a', fairy: '#bff7ff', demon: '#2a1838' }[fid]); }); }
  function seatMat(c) { return mat('seat-' + c, function () { return toon(c, { emissive: col(c), emissiveIntensity: .3 }); }); }

  function add(g, geom, m, x, y, z, rx, ry, rz, sx, sy, sz) {
    var mesh = new THREE.Mesh(geom, m);
    mesh.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sx) mesh.scale.set(sx, sy || sx, sz || sx);
    mesh.castShadow = true;
    g.add(mesh); return mesh;
  }
  var B = {
    body: function (h, w) { return geo('body' + h + w, function () { return lathe([[0, 0], [w, 0], [w, .03], [w * .8, .08], [w * .62, h * .6], [w * .7, h * .8], [w * .45, h], [0, h]]); }); },
    robe: function (h, w) { return geo('robe' + h + w, function () { return lathe([[0, 0], [w, 0], [w * .95, .05], [w * .5, h * .75], [w * .52, h * .86], [w * .32, h], [0, h]]); }); },
    sphere: function (r) { return geo('sph' + r, function () { return new THREE.SphereGeometry(r, 22, 16); }); },
    cyl: function (a, b, h, s) { return geo('cyl' + a + b + h + (s || 16), function () { return new THREE.CylinderGeometry(a, b, h, s || 16); }); },
    cone: function (r, h, s) { return geo('cone' + r + h + (s || 16), function () { return new THREE.ConeGeometry(r, h, s || 16); }); },
    box: function (x, y, z) { return geo('box' + x + y + z, function () { return new THREE.BoxGeometry(x, y, z); }); },
    torus: function (r, t, arc) { return geo('tor' + r + t + (arc || 0), function () { return new THREE.TorusGeometry(r, t, 10, 32, arc || Math.PI * 2); }); },
    oct: function (r) { return geo('oct' + r, function () { return new THREE.OctahedronGeometry(r); }); },
    dode: function (r) { return geo('dode' + r, function () { return new THREE.DodecahedronGeometry(r); }); }
  };

  /* ---------- quân chibi ---------- */
  function chibiHead(g, fid, y, r, hat) {
    add(g, B.sphere(r), M.skin(), 0, y, 0);
    var eye = mat('eye-dark', function () { return toon('#1d1f33'); });
    add(g, B.sphere(r * .13), eye, r * .36, y + r * .02, r * .88); add(g, B.sphere(r * .13), eye, -r * .36, y + r * .02, r * .88);
    var shine = mat('eye-shine', function () { return new THREE.MeshBasicMaterial({ color: '#ffffff' }); });
    add(g, B.sphere(r * .05), shine, r * .4, y + r * .08, r * .98); add(g, B.sphere(r * .05), shine, -r * .32, y + r * .08, r * .98);
    if (!hat) add(g, B.sphere(r * 1.04), hairMat(fid), 0, y + r * .18, -r * .12, 0, 0, 0, 1, .82, 1);
  }
  function buildPiece(type, fid, seatColor, job) {
    var g = new THREE.Group(), fm = facMat(fid), f2 = facMat2(fid);
    var body = new THREE.Group(); g.add(body);
    add(g, B.cyl(.32, .36, .1, 32), M.dark(), 0, .05, 0);
    var rimMat = new THREE.MeshStandardMaterial({ color: col(seatColor), emissive: col(seatColor), emissiveIntensity: .8, roughness: .35, metalness: .3 });
    add(g, B.torus(.34, .03), rimMat, 0, .1, 0, Math.PI / 2);
    var y0 = .1, eyeM = mat('eye-dark', function () { return toon('#1d1f33'); });
    switch (type) {
      case 'king':
        add(body, B.robe(.42, .26), fm, 0, y0, 0); add(body, B.cyl(.27, .27, .05, 24), M.gold(), 0, y0 + .03, 0);
        add(body, B.sphere(.12), f2, 0, y0 + .4, 0, 0, 0, 0, 1.3, .7, 1.1);
        chibiHead(body, fid, y0 + .6, .19, true);
        add(body, B.cyl(.16, .17, .1, 20), M.gold(), 0, y0 + .76, 0);
        for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; add(body, B.cone(.035, .13, 8), M.gold(), Math.cos(a) * .15, y0 + .86, Math.sin(a) * .15); }
        add(body, B.oct(.055), mat('gem', function () { return std('#ff3d6a', .1, .3, { emissive: col('#ff2255'), emissiveIntensity: 1.5 }); }), 0, y0 + .78, .17);
        add(body, B.cyl(.014, .014, .62, 6), M.gold(), .27, y0 + .34, .05); add(body, B.oct(.05), M.gold(), .27, y0 + .68, .05);
        break;
      case 'worker':
        add(body, B.body(.22, .18), fm, 0, y0, 0); chibiHead(body, fid, y0 + .36, .15);
        if (job === 'V') { add(body, B.cyl(.016, .016, .4, 6), M.wood(), .2, y0 + .26, .04, 0, 0, .35); add(body, B.torus(.1, .022, Math.PI * .9), M.steel(), .27, y0 + .44, .04, 0, 0, .3); }
        else if (job === 'T') { var wm = mat('wheat', function () { return toon('#f2cc5e'); }); add(body, B.cyl(.06, .03, .28, 8), wm, .2, y0 + .26, .04, 0, 0, .25); add(body, B.cone(.08, .12, 8), wm, .23, y0 + .44, .04, 0, 0, .25); }
        else { add(body, B.cyl(.016, .016, .4, 6), M.wood(), .2, y0 + .26, .04, 0, 0, .25); add(body, B.box(.14, .1, .02), M.steel(), .27, y0 + .42, .04, 0, 0, .25); }
        add(body, B.cone(.17, .08, 16), mat('strawhat', function () { return toon('#f7d98a'); }), 0, y0 + .53, 0);
        break;
      case 'soldier':
        add(body, B.body(.3, .22), fm, 0, y0, 0); chibiHead(body, fid, y0 + .44, .17, true);
        add(body, B.sphere(.18), M.steel(), 0, y0 + .5, -.02, 0, 0, 0, 1, .75, 1);
        add(body, B.box(.03, .22, .03), fm, 0, y0 + .66, -.02);
        add(body, B.box(.04, .42, .014), M.steel(), .23, y0 + .32, .05, 0, 0, -.15);
        add(body, B.box(.13, .03, .03), M.gold(), .21, y0 + .14, .05, 0, 0, -.15);
        break;
      case 'archer':
        add(body, B.body(.3, .21), fm, 0, y0, 0); chibiHead(body, fid, y0 + .44, .17, true);
        add(body, B.cone(.2, .32, 16), f2, 0, y0 + .58, -.02, -.2);
        add(body, B.torus(.22, .016, Math.PI), M.wood(), .22, y0 + .32, .02, 0, Math.PI / 2, Math.PI / 2);
        add(body, B.cyl(.004, .004, .44, 4), M.cloth(), .22, y0 + .32, .02);
        add(body, B.cyl(.05, .05, .22, 8), M.wood(), -.12, y0 + .32, -.14, .4);
        break;
      case 'shield':
        add(body, B.body(.3, .24), fm, 0, y0, 0); chibiHead(body, fid, y0 + .44, .17, true);
        add(body, B.sphere(.18), M.steel(), 0, y0 + .5, -.02, 0, 0, 0, 1, .75, 1);
        add(body, B.cyl(.21, .21, .04, 6), f2, 0, y0 + .26, .25, Math.PI / 2, 0, 0, 1, 1, 1.3);
        add(body, B.torus(.2, .02), M.gold(), 0, y0 + .26, .27, 0, 0, 0, 1, 1.3, 1);
        add(body, B.oct(.05), M.gold(), 0, y0 + .26, .29);
        break;
      case 'cavalry':
        add(body, B.sphere(.2), fm, 0, y0 + .28, 0, 0, 0, 0, .8, .8, 1.35);
        [[-.08, -.14], [.08, -.14], [-.08, .14], [.08, .14]].forEach(function (p) { add(body, B.cyl(.035, .03, .2, 6), M.dark(), p[0], y0 + .1, p[1]); });
        add(body, B.sphere(.13), fm, 0, y0 + .48, .26, 0, 0, 0, .8, .9, 1.3);
        add(body, B.cone(.03, .08, 6), fm, .05, y0 + .6, .22); add(body, B.cone(.03, .08, 6), fm, -.05, y0 + .6, .22);
        add(body, B.box(.03, .14, .2), f2, 0, y0 + .5, .12, -.3);
        chibiHead(body, fid, y0 + .62, .14, true); add(body, B.sphere(.15), M.steel(), 0, y0 + .67, 0, 0, 0, 0, 1, .7, 1);
        add(body, B.cyl(.012, .012, .7, 6), M.wood(), .16, y0 + .55, .15, .9);
        break;
      case 'assassin':
        add(body, B.robe(.34, .2), mat('dark2-' + fid, function () { return toon('#3a3150', { emissive: col(F[fid].color), emissiveIntensity: .12 }); }), 0, y0, 0);
        chibiHead(body, fid, y0 + .48, .16, true);
        add(body, B.cone(.2, .36, 14), fm, 0, y0 + .6, -.02, -.15);
        add(body, B.box(.18, .05, .02), eyeM, 0, y0 + .44, .14);
        add(body, B.box(.02, .22, .01), M.steel(), .2, y0 + .22, .05, 0, 0, .7);
        add(body, B.box(.02, .22, .01), M.steel(), -.2, y0 + .22, .05, 0, 0, -.7);
        break;
      case 'mage':
        add(body, B.robe(.36, .26), fm, 0, y0, 0); chibiHead(body, fid, y0 + .48, .17);
        add(body, B.cyl(.28, .28, .03, 24), fm, 0, y0 + .6, 0);
        add(body, B.cone(.15, .36, 16), fm, 0, y0 + .78, -.03, -.25);
        add(body, B.cyl(.014, .014, .72, 6), M.wood(), .25, y0 + .32, .04);
        add(body, B.sphere(.07), mat('orb-' + fid, function () { return new THREE.MeshBasicMaterial({ color: col(FX_COLOR[fid]) }); }), .25, y0 + .72, .04).name = 'orb';
        break;
      case 'siege':
        add(body, B.box(.44, .08, .5), M.wood(), 0, y0 + .14, 0);
        [[-.24, -.17], [.24, -.17], [-.24, .17], [.24, .17]].forEach(function (p) { add(body, B.cyl(.1, .1, .05, 14), M.dark(), p[0], y0 + .1, p[1], 0, 0, Math.PI / 2); });
        add(body, B.box(.05, .3, .05), M.wood(), -.14, y0 + .32, 0); add(body, B.box(.05, .3, .05), M.wood(), .14, y0 + .32, 0);
        add(body, B.cyl(.03, .03, .32, 8), M.wood(), 0, y0 + .46, 0, 0, 0, Math.PI / 2);
        add(body, B.box(.05, .6, .05), fm, 0, y0 + .46, -.04, -.9);
        add(body, B.sphere(.09), M.dark(), 0, y0 + .66, -.25);
        add(body, B.box(.46, .05, .05), fm, 0, y0 + .2, .26);
        break;
      case 'chariot':
        add(body, B.box(.34, .22, .36), fm, 0, y0 + .26, -.04);
        add(body, B.box(.36, .07, .04), M.gold(), 0, y0 + .39, .14);
        [-.21, .21].forEach(function (x) { add(body, B.torus(.15, .03), M.dark(), x, y0 + .17, -.04, 0, Math.PI / 2); add(body, B.cyl(.025, .025, .3, 6), M.gold(), x, y0 + .17, -.04, Math.PI / 2, 0, 0); });
        add(body, B.cone(.03, .16, 6), M.steel(), .28, y0 + .17, -.04, 0, 0, -Math.PI / 2); add(body, B.cone(.03, .16, 6), M.steel(), -.28, y0 + .17, -.04, 0, 0, Math.PI / 2);
        add(body, B.sphere(.13), f2, 0, y0 + .26, .32, 0, 0, 0, .8, .8, 1.2);
        chibiHead(body, fid, y0 + .56, .15, true); add(body, B.sphere(.16), M.steel(), 0, y0 + .6, -.02, 0, 0, 0, 1, .7, 1);
        break;
      case 'beast': {
        var em = mat('beasteye', function () { return new THREE.MeshBasicMaterial({ color: '#fff1a0' }); });
        add(body, B.sphere(.22), fm, 0, y0 + .32, 0, 0, 0, 0, 1, .9, 1.25);
        add(body, B.sphere(.14), f2, 0, y0 + .3, .12, 0, 0, 0, 1, 1, .8);
        add(body, B.sphere(.17), fm, 0, y0 + .6, .2);
        add(body, B.sphere(.04), em, .07, y0 + .64, .34); add(body, B.sphere(.04), em, -.07, y0 + .64, .34);
        add(body, B.cone(.03, .14, 6), M.ivory(), .08, y0 + .78, .14, -.5); add(body, B.cone(.03, .14, 6), M.ivory(), -.08, y0 + .78, .14, -.5);
        add(body, B.cone(.08, .36, 8), fm, 0, y0 + .26, -.36, -Math.PI / 2 - .3);
        var wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(.46, .26); wingShape.lineTo(.4, .04); wingShape.lineTo(.3, .12); wingShape.lineTo(.22, -.03); wingShape.lineTo(.12, .05); wingShape.lineTo(0, -.06);
        var wg = geo('wing', function () { return new THREE.ShapeGeometry(wingShape); });
        var wmt = mat('wing-' + fid, function () { return toon(F[fid].color2, { side: THREE.DoubleSide, transparent: true, opacity: .92 }); });
        add(body, wg, wmt, .12, y0 + .44, -.02, -.3, 0, .2).name = 'wingR';
        add(body, wg, wmt, -.12, y0 + .44, -.02, -.3, Math.PI, .2).name = 'wingL';
        [[-.11, -.12], [.11, -.12], [-.11, .12], [.11, .12]].forEach(function (p) { add(body, B.cyl(.04, .035, .2, 6), fm, p[0], y0 + .1, p[1]); });
        break;
      }
      case 'commander':
        add(body, B.robe(.36, .26), fm, 0, y0, 0); chibiHead(body, fid, y0 + .5, .17, true);
        add(body, B.cyl(.19, .17, .1, 20), M.gold(), 0, y0 + .62, 0); add(body, B.cone(.05, .14, 8), seatMat(seatColor), 0, y0 + .74, 0);
        add(body, B.cyl(.014, .014, 1.0, 6), M.gold(), -.24, y0 + .5, -.02);
        var fl = new THREE.Mesh(geo('flag', function () { return new THREE.PlaneGeometry(.34, .22, 8, 1); }), new THREE.MeshToonMaterial({ color: col(seatColor), side: THREE.DoubleSide, gradientMap: toonMap() }));
        fl.position.set(-.06, y0 + .88, -.02); fl.castShadow = true; fl.name = 'flag'; body.add(fl);
        break;
      case 'elephant': {
        add(body, B.sphere(.27), fm, 0, y0 + .38, -.03, 0, 0, 0, 1, .88, 1.2);
        [[-.13, -.17], [.13, -.17], [-.13, .14], [.13, .14]].forEach(function (p) { add(body, B.cyl(.07, .07, .26, 8), fm, p[0], y0 + .13, p[1]); });
        add(body, B.sphere(.18), fm, 0, y0 + .5, .26);
        add(body, B.sphere(.04), eyeM, .09, y0 + .56, .4); add(body, B.sphere(.04), eyeM, -.09, y0 + .56, .4);
        var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .45, .4), new THREE.Vector3(0, .3, .5), new THREE.Vector3(0, .14, .48), new THREE.Vector3(0, .1, .56)]);
        add(body, geo('trunk', function () { return new THREE.TubeGeometry(curve, 12, .04, 8, false); }), fm, 0, y0, 0);
        add(body, B.cone(.025, .2, 6), M.ivory(), .09, y0 + .38, .44, 1.9); add(body, B.cone(.025, .2, 6), M.ivory(), -.09, y0 + .38, .44, 1.9);
        add(body, B.sphere(.12), f2, .19, y0 + .56, .22, 0, 0, 0, .35, 1, 1); add(body, B.sphere(.12), f2, -.19, y0 + .56, .22, 0, 0, 0, .35, 1, 1);
        add(body, B.box(.28, .14, .26), f2, 0, y0 + .68, -.06); add(body, B.box(.32, .03, .3), M.gold(), 0, y0 + .76, -.06);
        add(body, B.cone(.2, .16, 4), fm, 0, y0 + .86, -.06, 0, Math.PI / 4);
        break;
      }
    }
    factionAccent(body, fid, type, y0);
    return { group: g, body: body, rimMat: rimMat };
  }
  /* đặc trưng tộc trên mọi quân hình người */
  var HEADY = { king: .6, worker: .36, soldier: .44, archer: .44, shield: .44, cavalry: .62, assassin: .48, mage: .48, chariot: .56, commander: .5 };
  function factionAccent(body, fid, type, y0) {
    var hy = HEADY[type];
    if (fid === 'fairy') {
      var wm = mat('fwing', function () { return new THREE.MeshBasicMaterial({ color: col('#bff7ff'), transparent: true, opacity: .6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }); });
      var wg = geo('fwingG', function () { return new THREE.CircleGeometry(.16, 20); });
      var wy = y0 + (hy != null ? hy - .12 : .45), wz = type === 'beast' ? -.05 : -.16;
      [[1, .5], [-1, .5], [1, -.2], [-1, -.2]].forEach(function (p, i) {
        var w = add(body, wg, wm, p[0] * .14, wy + p[1] * .2, wz, 0, p[0] * .5, p[0] * (i < 2 ? .6 : -.4), 1.1, i < 2 ? 1.5 : 1, 1);
        w.castShadow = false; w.name = 'fw' + (p[0] > 0 ? 'R' : 'L');
      });
      body.userData.float = 1;
      return;
    }
    if (hy == null) return;
    var hY = y0 + hy, r = type === 'king' ? .19 : type === 'worker' ? .15 : .17;
    if (fid === 'dragon') {
      var hm = mat('dhorn', function () { return toon('#fff1c8'); });
      add(body, B.cone(.035, .16, 8), hm, r * .55, hY + r * .85, -.02, -.3, 0, -.45);
      add(body, B.cone(.035, .16, 8), hm, -r * .55, hY + r * .85, -.02, -.3, 0, .45);
      add(body, B.cone(.06, .26, 8), facMat('dragon'), 0, y0 + .12, -.26, -Math.PI / 2 - .5);
    } else if (fid === 'demon') {
      var dm = mat('dmhorn', function () { return toon('#3a1a56', { emissive: col('#7a3cff'), emissiveIntensity: .25 }); });
      add(body, B.torus(.06, .022, Math.PI * 1.1), dm, r * .6, hY + r * .8, 0, 0, Math.PI / 2, -.4);
      add(body, B.torus(.06, .022, Math.PI * 1.1), dm, -r * .6, hY + r * .8, 0, 0, Math.PI / 2, Math.PI + .4);
      add(body, B.cyl(.012, .02, .28, 6), dm, 0, y0 + .14, -.26, -1.1);
      add(body, B.cone(.05, .09, 4), dm, 0, y0 + .26, -.38, -1.1);
    } else if (fid === 'human') {
      var cm = mat('hcape', function () { return toon('#3b82f6', { side: THREE.DoubleSide }); });
      var cape = new THREE.Mesh(geo('cape', function () { var gg = new THREE.PlaneGeometry(.34, .36, 4, 4); return gg; }), cm);
      cape.position.set(0, y0 + Math.max(.18, hy - .2), -.2); cape.rotation.x = .18; cape.castShadow = true; cape.name = 'cape'; body.add(cape);
      add(body, B.sphere(.05), mat('plume', function () { return toon('#ffffff'); }), 0, hY + r * 1.1, -.04, 0, 0, 0, .7, 1.6, .7);
    }
  }

  function buildProp(kind) {
    var g = new THREE.Group();
    if (kind === 'V') {
      var gm = mat('goldOre', function () { return std('#ffd34d', .2, .7, { emissive: col('#c27800'), emissiveIntensity: .6 }); });
      add(g, B.dode(.1), M.dark(), 0, .05, 0, 0, 0, 0, 1.3, .7, 1.3);
      [[0, .14, 0, .1], [.09, .1, .05, .07], [-.07, .09, .06, .06], [.03, .08, -.08, .055]].forEach(function (p) { add(g, B.oct(p[3]), gm, p[0], p[1], p[2], .3, p[0] * 9, 0, 1, 1.6, 1); });
    } else if (kind === 'T') {
      var wm = mat('wheat', function () { return toon('#f2cc5e'); });
      for (var i = 0; i < 8; i++) { var a = i / 8 * 6.28, r = i ? .07 : 0; add(g, B.cyl(.009, .009, .28, 4), wm, Math.cos(a) * r, .14, Math.sin(a) * r, Math.cos(a) * .2, 0, Math.sin(a) * .2); add(g, B.sphere(.028), wm, Math.cos(a) * (r + .028), .29, Math.sin(a) * (r + .028), 0, 0, 0, .7, 1.8, .7); }
    } else {
      var lm = mat('leaf', function () { return toon('#4fc46a'); });
      add(g, B.cyl(.03, .04, .14, 6), M.wood(), 0, .07, 0);
      add(g, B.sphere(.15), lm, 0, .28, 0); add(g, B.sphere(.11), lm, .09, .36, .03); add(g, B.sphere(.1), lm, -.08, .37, -.03);
    }
    return g;
  }

  /* ================== BOARD 3D ================== */
  function Board3D(canvas, wrap, opts) {
    opts = opts || {};
    this.c = canvas; this.wrap = wrap; this.showcase = !!opts.showcase;
    this.state = null; this.view = 0; this.hl = {}; this.anims = []; this.pieces = {}; this.grave = {};
    this.az = 0; this.azT = 0; this.el = 0.92; this.R = 12; this.RT = 12; this.userAz = 0; this.pan = { x: 0, z: 0 }; this.panT = { x: 0, z: 0 };
    var r = this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: !!this.showcase, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, G.devicePixelRatio || 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = skyTex(); this.scene.fog = new THREE.Fog('#d6eeff', 34, 90);
    this.cam = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight('#e6f4ff', '#5e8a3e', 1.15));
    var key = this.key = new THREE.DirectionalLight('#fff3dc', 2.3);
    key.position.set(-7, 15, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = .02;
    this.scene.add(key); this.scene.add(key.target);
    var fill = new THREE.DirectionalLight('#9fd6ff', .55); fill.position.set(9, 6, -10); this.scene.add(fill);
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hlGroup = new THREE.Group(); this.scene.add(this.hlGroup);
    this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
    var self = this;
    this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(wrap);
    this.clock = performance.now();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    if (!this.showcase) this._controls();
  }
  TT.Board3D = Board3D;

  Board3D.prototype = {
    is3D: true,
    w: function (x, y) { var st = this.state; return { x: x - st.W / 2 + .5, z: y - st.H / 2 + .5 }; },
    V: function (x, y, h) { var p = this.w(x, y); return new THREE.Vector3(p.x, h || 0, p.z); },
    zoneOf: function (x, y) {
      var st = this.state; if (st.bm === 2) return null;
      var side = -1;
      if (y < 3) side = 2; else if (y > 10) side = 0; else if (x < 3) side = 1; else if (x > 10) side = 3;
      if (side < 0) return null;
      return side === st.wild ? 'wild' : side;
    },
    _buildBoard: function () {
      var st = this.state, W = st.W, H = st.H, self = this;
      if (this.boardGroup) { this.root.remove(this.boardGroup); disposeObj(this.boardGroup); }
      var bg = this.boardGroup = new THREE.Group(); this.root.add(bg);
      this._W = W; this._mode = st.mode;
      var cells = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (E.exists(st, x, y)) cells.push([x, y]);
      this.cellList = cells;
      var spawnOwner = {}, homeOwner = {};
      st.players.forEach(function (p, i) {
        E.spawnCells(st, i).forEach(function (c) { spawnOwner[c[1] * W + c[0]] = p.seat; });
        var h = E.homeCell(st, i); homeOwner[h[1] * W + h[0]] = p.seat;
      });
      var tileGeo = new THREE.BoxGeometry(.98, .3, .98); tileGeo.userData.own = true;
      var tiles = this.tiles = new THREE.InstancedMesh(tileGeo, std('#ffffff', .85, .02, { map: stoneTex() }), cells.length);
      tiles.receiveShadow = true;
      var m4 = new THREE.Matrix4(), cc = new THREE.Color();
      cells.forEach(function (c, i) {
        var p = self.w(c[0], c[1]);
        m4.makeTranslation(p.x, -.15, p.z); tiles.setMatrixAt(i, m4);
        var dark = (c[0] + c[1]) % 2 === 0, idx = c[1] * W + c[0];
        cc.set(dark ? '#b9c9d8' : '#f3e8cf');
        var zone = self.zoneOf(c[0], c[1]);
        if (zone === 'wild') cc.lerp(col('#b9875a'), .5);
        else if (zone != null) cc.lerp(col(TT.SEAT_COLORS[zone]), .08);
        if (spawnOwner[idx] != null) cc.lerp(col(TT.SEAT_COLORS[spawnOwner[idx]]), .3);
        tiles.setColorAt(i, cc);
      });
      tiles.instanceColor.needsUpdate = true;
      bg.add(tiles);
      var baseGeo = new THREE.BoxGeometry(1, .4, 1); baseGeo.userData.own = true;
      var base = new THREE.InstancedMesh(baseGeo, toon('#8b5a34'), cells.length);
      cells.forEach(function (c, i) { var p = self.w(c[0], c[1]); m4.makeTranslation(p.x, -.48, p.z); base.setMatrixAt(i, m4); });
      base.receiveShadow = true; base.castShadow = true; bg.add(base);
      cells.forEach(function (c) {
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d) {
          if (E.exists(st, c[0] + d[0], c[1] + d[1])) return;
          var p = self.w(c[0], c[1]);
          var m = new THREE.Mesh(B.box(d[0] ? .08 : 1.08, .14, d[0] ? 1.08 : .08), M.gold());
          m.position.set(p.x + d[0] * .5, -.01, p.z + d[1] * .5); m.castShadow = true; bg.add(m);
        });
      });
      var lineMat = new THREE.MeshBasicMaterial({ color: col('#d9a93a'), transparent: true, opacity: .7 });
      if (st.bm === 2) { var ln = new THREE.Mesh(new THREE.BoxGeometry(W, .012, .04), lineMat); ln.position.set(0, .006, 0); bg.add(ln); }
      else { [[0, -4, 8, .04], [0, 4, 8, .04], [-4, 0, .04, 8], [4, 0, .04, 8]].forEach(function (q) { var l = new THREE.Mesh(new THREE.BoxGeometry(q[2], .012, q[3]), lineMat); l.position.set(q[0], .006, q[1]); bg.add(l); }); }
      this.resGlows = [];
      for (var i = 0; i < st.tiles.length; i++) {
        var k = st.tiles[i]; if (!k) continue;
        var tx = i % W, ty = (i / W) | 0, wp = this.w(tx, ty);
        var colr = k === 'V' ? '#ffcf3a' : k === 'T' ? '#f2b84a' : '#3fd27a';
        var inlay = new THREE.Mesh(geo('inlay', function () { return new THREE.RingGeometry(.36, .44, 48); }), new THREE.MeshBasicMaterial({ color: col(colr), transparent: true, opacity: .9, side: THREE.DoubleSide }));
        inlay.rotation.x = -Math.PI / 2; inlay.position.set(wp.x, .008, wp.z); bg.add(inlay);
        var gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(colr), transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
        gl.scale.set(1.2, 1.2, 1); gl.position.set(wp.x, .1, wp.z); bg.add(gl); this.resGlows.push(gl);
        var prop = buildProp(k); prop.position.set(wp.x + .32, 0, wp.z + .32); prop.scale.setScalar(.85); bg.add(prop);
        if (homeOwner[i] != null) {
          var sc = TT.SEAT_COLORS[homeOwner[i]];
          var pole = new THREE.Mesh(B.cyl(.014, .014, .5, 6), M.gold()); pole.position.set(wp.x - .38, .25, wp.z - .38); pole.castShadow = true; bg.add(pole);
          var ban = new THREE.Mesh(geo('banner', function () { return new THREE.PlaneGeometry(.22, .15); }), new THREE.MeshToonMaterial({ color: col(sc), side: THREE.DoubleSide, gradientMap: toonMap() }));
          ban.position.set(wp.x - .27, .42, wp.z - .38); ban.name = 'banner'; bg.add(ban);
        }
      }
      this._env();
      this._fitCamera(true);
      var half = Math.max(W, H) / 2 + 2;
      var sc2 = this.key.shadow.camera; sc2.left = -half; sc2.right = half; sc2.top = half; sc2.bottom = -half; sc2.near = 1; sc2.far = 50; sc2.updateProjectionMatrix();
    },
    _env: function () {
      if (this.envGroup) { this.scene.remove(this.envGroup); disposeObj(this.envGroup); }
      var eg = this.envGroup = new THREE.Group(); this.scene.add(eg);
      var st = this.state, W = st.W, half = W / 2, self = this;
      var dais = (st.bm === 2 ? half * 1.42 : half * 1.18) + .7;
      // quảng trường lát gạch
      var cobble = TEX.cobble || (TEX.cobble = (function () {
        var t = canvasTex(512, 512, function (g) {
          g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, 512, 512);
          for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
            var ox = (y % 2) * 16, v = 220 + ((x * 7 + y * 13) % 5) * 6;
            g.fillStyle = 'rgb(' + v + ',' + (v - 14) + ',' + (v - 40) + ')';
            g.beginPath(); g.roundRect ? g.roundRect(x * 32 + ox + 2, y * 32 + 2, 28, 28, 7) : g.rect(x * 32 + ox + 2, y * 32 + 2, 28, 28); g.fill();
          }
        });
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.anisotropy = 4; return t;
      })());
      var plazaR = dais + 7;
      var plaza = add(eg, geo('plaza' + plazaR, function () { return new THREE.CircleGeometry(plazaR, 64); }), new THREE.MeshStandardMaterial({ map: cobble, roughness: .95, color: '#ffffff' }), 0, -1.02, 0, -Math.PI / 2);
      plaza.receiveShadow = true; plaza.castShadow = false;
      var lawn = add(eg, new THREE.RingGeometry(plazaR, plazaR * 6, 64), toon('#9bd77f'), 0, -1.03, 0, -Math.PI / 2); lawn.receiveShadow = true; lawn.castShadow = false;
      add(eg, B.torus(plazaR, .12), toon('#d8c49a'), 0, -1.0, 0, Math.PI / 2).castShadow = false;
      // bệ đá bát giác 2 bậc, viền vàng
      var stone = toon('#f4ead2'), stone2 = toon('#e2d3b0');
      add(eg, B.cyl(dais + .9, dais + 1.0, .18, 8), stone2, 0, -.93, 0, 0, Math.PI / 8).receiveShadow = true;
      add(eg, B.cyl(dais, dais + .1, .2, 8), stone, 0, -.78, 0, 0, Math.PI / 8).receiveShadow = true;
      add(eg, geo('daisTrim' + dais, function () { return new THREE.TorusGeometry(dais * 1.0, .05, 6, 8); }), M.gold(), 0, -.68, 0, Math.PI / 2, 0, Math.PI / 8).castShadow = false;
      // hàng cột trắng có đèn
      var colR = dais + 2.4, colM = toon('#ffffff'), capM = toon('#7fb6f0'), lampM = mat('lamp', function () { return toon('#fff3c4', { emissive: col('#ffd56a'), emissiveIntensity: .9 }); });
      this.braziers = [];
      for (var i = 0; i < 8; i++) {
        var an = i / 8 * Math.PI * 2 + Math.PI / 8, cg = new THREE.Group(); cg.position.set(Math.cos(an) * colR, -1.02, Math.sin(an) * colR); eg.add(cg);
        add(cg, B.cyl(.42, .46, .3, 8), stone2, 0, .15, 0);
        add(cg, B.cyl(.26, .3, 2.6, 16), colM, 0, 1.6, 0);
        add(cg, B.cyl(.4, .3, .22, 8), stone, 0, 3.0, 0);
        add(cg, B.cone(.42, .5, 8), capM, 0, 3.36, 0);
        add(cg, B.sphere(.16), lampM, 0, 3.75, 0);
        var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col('#ffe39a'), transparent: true, opacity: .7, depthWrite: false })); glow.position.set(0, 3.75, 0); glow.scale.set(1.1, 1.1, 1); cg.add(glow);
        this.braziers.push({ fire: glow, ph: i });
      }
      // cờ phe phía sau mỗi người chơi
      var sideDir = [[0, 1], [-1, 0], [0, -1], [1, 0]];
      st.players.forEach(function (p) {
        var d = sideDir[p.seat], bx = d[0] * (dais + 1.5), bz = d[1] * (dais + 1.5), c0 = TT.SEAT_COLORS[p.seat], fc = F[p.faction].color;
        [-1, 1].forEach(function (k) {
          var g = new THREE.Group(); g.position.set(bx + (d[1] ? k * 2.2 : 0), -1.02, bz + (d[0] ? k * 2.2 : 0)); eg.add(g);
          add(g, B.cyl(.05, .06, 3.4, 8), M.gold(), 0, 1.7, 0);
          add(g, B.sphere(.1), M.gold(), 0, 3.45, 0);
          var ban = new THREE.Mesh(geo('bigBanner', function () { return new THREE.PlaneGeometry(.9, 1.6, 4, 6); }), mat('ban-' + fc, function () { return toon(fc, { side: THREE.DoubleSide }); }));
          ban.position.set(0, 2.45, 0); ban.rotation.y = Math.atan2(d[0], d[1]); ban.castShadow = true; ban.name = 'banner'; g.add(ban);
          var stripe = new THREE.Mesh(geo('banStripe', function () { return new THREE.PlaneGeometry(.92, .14); }), mat('banS-' + c0, function () { return toon(c0, { side: THREE.DoubleSide }); }));
          stripe.position.set(0, 1.62, .005); ban.add(stripe);
        });
      });
      // đồi xa và vài đám mây cao
      var hillM = [toon('#a9dc8c', { fog: true }), toon('#8fcf86'), toon('#b7e3a2')];
      for (var h = 0; h < 7; h++) {
        var ha = h / 7 * Math.PI * 2 + .3, hr = 46 + (h % 3) * 6;
        add(eg, B.sphere(1), hillM[h % 3], Math.cos(ha) * hr, -6, Math.sin(ha) * hr, 0, 0, 0, 16 + (h % 3) * 5, 7 + (h % 2) * 3, 12).castShadow = false;
      }
      this.clouds = [];
      var cm = mat('cloud', function () { return toon('#ffffff', { transparent: true, opacity: .92 }); });
      for (var k = 0; k < 5; k++) {
        var cgr = new THREE.Group(), cr = 34 + (k % 2) * 8, ca = k / 5 * 6.28;
        cgr.position.set(Math.cos(ca) * cr, 9 + (k % 3) * 2, Math.sin(ca) * cr);
        for (var j = 0; j < 5; j++) add(cgr, B.sphere(1.3 + (j % 3) * .5), cm, (j - 2) * 1.5, Math.sin(j) * .4, (j % 2) * .8).castShadow = false;
        eg.add(cgr); this.clouds.push({ g: cgr, a: ca, r: cr, s: .006 + (k % 3) * .003 });
      }
      var n = 40, pos = new Float32Array(n * 3), sp = [];
      for (var q = 0; q < n; q++) { pos[q * 3] = (Math.random() - .5) * W * 1.6; pos[q * 3 + 1] = Math.random() * 4; pos[q * 3 + 2] = (Math.random() - .5) * W * 1.6; sp.push(.12 + Math.random() * .25); }
      var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.userData.own = true;
      this.sparkles = new THREE.Points(pg, new THREE.PointsMaterial({ map: starTex(), color: col('#fff4b8'), size: .13, transparent: true, opacity: .8, depthWrite: false }));
      this.sparkles.userData.sp = sp; eg.add(this.sparkles);
    },

    /* ---------- camera & điều khiển ---------- */
    setView: function (side) { this.view = side || 0; this.userAz = 0; this.azT = this._baseAz(); this.az = this.azT; this.resize(); },
    _baseAz: function () { return [0, -Math.PI / 2, Math.PI, Math.PI / 2][this.view] + this.userAz; },
    _fitCamera: function (snap) {
      var W = this.state ? this.state.W : 8, asp = this.cam.aspect || 1;
      var R = W * 1.42 + 4.2; if (asp < 1) R *= .78 / Math.max(.45, asp);
      this.Rbase = R; if (snap || !this.RT) { this.RT = R; this.R = R; }
      this.RT = Math.max(R * .5, Math.min(R * 1.5, this.RT));
    },
    resize: function () {
      var r = this.wrap.getBoundingClientRect(), w = Math.max(100, r.width), h = Math.max(100, r.height);
      this.renderer.setSize(w, h, false);
      this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
      this.cam.aspect = w / h; this.cam.fov = w / h < 1 ? 50 : 36; this.cam.updateProjectionMatrix();
      if (this.state) this._fitCamera(false);
    },
    planePoint: function (e) {
      var r = this.c.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.cam);
      var v = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, v) ? v : null;
    },
    /* dịch camera theo hướng màn hình (kéo bản đồ) */
    panBy: function (dx, dy) {
      var k = this.R * .0019, az = this.az, lim = this.state ? this.state.W / 2 + 1 : 6;
      var rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az);
      this.panT.x = Math.max(-lim, Math.min(lim, this.panT.x - rx * dx * k + fx * dy * k));
      this.panT.z = Math.max(-lim, Math.min(lim, this.panT.z - rz * dx * k + fz * dy * k));
    },
    resetCam: function () { this.userAz = 0; this.azT = this._baseAz(); this.el = .92; this.RT = this.Rbase; this.panT = { x: 0, z: 0 }; },
    _controls: function () {
      var self = this, c = this.c, drag = null, touch = null;
      c.addEventListener('pointerdown', function (e) {
        if (touch && touch.multi) return;
        var cell = e.button === 0 ? self.cellAt(e) : null;
        drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, btn: e.button, az: self.azT, el: self.el, moved: false, id: e.pointerId, cell: cell, piece: false, canPiece: !!(cell && self.onDragStart) };
        try { c.setPointerCapture(e.pointerId); } catch (x) { }
      });
      this._onMove = function (e) {
        if (!drag || drag.id !== e.pointerId || (touch && touch.multi)) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 7) {
          drag.moved = true;
          if (drag.btn === 0 && drag.canPiece && self.onDragStart(drag.cell[0], drag.cell[1])) { drag.piece = true; var t = E.teamAt(self.state, drag.cell[0], drag.cell[1]); self.dragId = t ? t.id : null; c.style.cursor = 'grabbing'; }
          else if (drag.btn === 0) c.style.cursor = 'grabbing';
        }
        if (!drag.moved) return;
        if (drag.piece) {
          self.dragPoint = self.planePoint(e);
          var cell = self.cellAt(e, true), key = cell ? cell + '' : '';
          if (key !== self._dk) { self._dk = key; self.hover = cell; self._syncHL(); if (self.onDragMove) self.onDragMove(cell, e); }
        } else if (drag.btn === 2 || e.shiftKey) {
          self.azT = drag.az - dx * .008; self.az = self.azT; self.el = Math.max(.42, Math.min(1.42, drag.el + dy * .006));
          self.userAz = self.azT - [0, -Math.PI / 2, Math.PI, Math.PI / 2][self.view];
        } else {
          self.panBy(e.clientX - drag.lx, e.clientY - drag.ly);
        }
        drag.lx = e.clientX; drag.ly = e.clientY;
      };
      this._onUp = function (e) {
        if (drag && drag.piece) {
          var cell = self.cellAt(e, true); self.dragId = null; self.dragPoint = null; self._dk = '';
          if (self.onDragEnd) self.onDragEnd(cell, e);
        }
        c.style.cursor = '';
        var d = drag; setTimeout(function () { if (drag === d) drag = null; }, 0);
      };
      G.addEventListener('pointermove', this._onMove);
      G.addEventListener('pointerup', this._onUp);
      c.addEventListener('click', function (e) { if (drag && drag.moved) return; var cell = self.cellAt(e); if (cell && self.onClick) self.onClick(cell[0], cell[1], e); });
      c.addEventListener('contextmenu', function (e) { e.preventDefault(); if (drag && drag.moved) return; if (self.onRight) self.onRight(); });
      c.addEventListener('wheel', function (e) { e.preventDefault(); self.RT = Math.max(self.Rbase * .45, Math.min(self.Rbase * 1.5, self.RT * (1 + Math.sign(e.deltaY) * .08))); }, { passive: false });
      // hai ngón: chụm để zoom, xoay để xoay góc nhìn, kéo để dịch
      var two = function (e) { var a = e.touches[0], b = e.touches[1]; return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), ang: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX), cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 }; };
      c.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { var t = two(e); touch = { multi: true, d: t.d, ang: t.ang, cx: t.cx, cy: t.cy, R: self.RT, az: self.azT }; drag = null; } }, { passive: true });
      c.addEventListener('touchmove', function (e) {
        if (!touch || e.touches.length !== 2) return;
        var t = two(e);
        self.RT = Math.max(self.Rbase * .45, Math.min(self.Rbase * 1.5, touch.R * touch.d / t.d));
        self.azT = touch.az - (t.ang - touch.ang); self.az = self.azT; self.userAz = self.azT - [0, -Math.PI / 2, Math.PI, Math.PI / 2][self.view];
        self.panBy(t.cx - touch.cx, t.cy - touch.cy); touch.cx = t.cx; touch.cy = t.cy;
      }, { passive: true });
      c.addEventListener('touchend', function (e) { if (e.touches.length < 2 && touch) { setTimeout(function () { touch = null; }, 50); } });
      c.addEventListener('mousemove', function (e) {
        if (drag && drag.moved) return;
        var cell = self.cellAt(e), key = cell ? cell[0] + ',' + cell[1] : '';
        if (key !== self._hk) { self._hk = key; self.hover = cell; self._syncHL(); if (self.onHover) self.onHover(cell, e); }
      });
      c.addEventListener('mouseleave', function () { self.hover = null; self._hk = ''; self._syncHL(); if (self.onHover) self.onHover(null); });
      var I = TT.Icons, bar = document.createElement('div'); bar.className = 'cam-bar';
      bar.innerHTML = '<button title="Xoay trái" data-c="l">' + I.ui('rotl', 16) + '</button><button title="Xoay phải" data-c="rr">' + I.ui('rotr', 16) + '</button><button title="Phóng to" data-c="zi">' + I.ui('plus', 16) + '</button><button title="Thu nhỏ" data-c="zo">' + I.ui('minus', 16) + '</button><button title="Nhìn từ trên xuống" data-c="t">' + I.ui('top', 16) + '</button><button title="Về góc nhìn mặc định" data-c="r">' + I.ui('home', 16) + '</button>';
      this.wrap.appendChild(bar); this.camBar = bar;
      bar.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.c;
          if (k === 'l') { self.userAz -= Math.PI / 2; self.azT = self._baseAz(); }
          if (k === 'rr') { self.userAz += Math.PI / 2; self.azT = self._baseAz(); }
          if (k === 'zi') self.RT = Math.max(self.Rbase * .45, self.RT * .85);
          if (k === 'zo') self.RT = Math.min(self.Rbase * 1.5, self.RT * 1.18);
          if (k === 'r') self.resetCam();
          if (k === 't') { self.el = self.el > 1.3 ? .92 : 1.42; }
        };
      });
    },
    destroy: function () {
      this.dead = true; this.ro.disconnect(); if (this.camBar) this.camBar.remove();
      if (this._onMove) { G.removeEventListener('pointermove', this._onMove); G.removeEventListener('pointerup', this._onUp); }
      this.renderer.dispose();
    },
    cellAt: function (e, tileOnly) {
      if (!this.state || !this.tiles) return null;
      var r = this.c.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.cam);
      if (!tileOnly) {
        var objs = [], self = this;
        Object.keys(this.pieces).forEach(function (id) { if (+id !== self.dragId) objs.push(self.pieces[id].group); });
        var hits = this.ray.intersectObjects(objs, true);
        if (hits.length) { var o = hits[0].object; while (o && o.userData.cell == null) o = o.parent; if (o) return o.userData.cell.slice(); }
      }
      var th = this.ray.intersectObject(this.tiles, false);
      if (th.length) return this.cellList[th[0].instanceId].slice();
      return null;
    },
    cellRect: function (x, y) {
      var p = this.w(x, y), r = this.c.getBoundingClientRect();
      var a = new THREE.Vector3(p.x, 0, p.z).project(this.cam), b = new THREE.Vector3(p.x + .5, 0, p.z).project(this.cam);
      var sx = r.left + (a.x + 1) / 2 * r.width, sy = r.top + (1 - a.y) / 2 * r.height;
      var bx = r.left + (b.x + 1) / 2 * r.width, by = r.top + (1 - b.y) / 2 * r.height;
      var w = Math.max(16, Math.hypot(bx - sx, by - sy) * 2);
      return { x: sx - w / 2, y: sy - w / 2, w: w };
    },
    center: function (x, y) { var r = this.cellRect(x, y); return [r.x + r.w / 2, r.y + r.w / 2]; },

    /* ---------- đồng bộ quân ---------- */
    setState: function (st) {
      var rebuild = !this.state || this._W !== st.W || this._mode !== st.mode || this._seed !== st.seed;
      this.state = st;
      if (rebuild) { this._seed = st.seed; this._clearPieces(); this._buildBoard(); }
      var self = this, seen = {};
      E.teamIds(st).forEach(function (id) {
        var t = st.teams[id], pl = st.players[t.o]; seen[id] = 1;
        var key = t.t + '|' + t.o + '|' + (t.job || '');
        var pc = self.pieces[id];
        if (pc && pc.key !== key) { self._removePiece(id, true); pc = null; }
        if (!pc) {
          var b = buildPiece(t.t, pl.faction, TT.SEAT_COLORS[pl.seat], t.job);
          pc = self.pieces[id] = { group: b.group, body: b.body, rimMat: b.rimMat, key: key, id: id, seat: TT.SEAT_COLORS[pl.seat], fac: pl.faction, type: t.t, ph: Math.random() * 6 };
          var wp = self.w(t.x, t.y); b.group.position.set(wp.x, 0, wp.z);
          b.group.rotation.y = FACING[pl.seat];
          self.root.add(b.group);
        }
        pc.group.userData.cell = [t.x, t.y]; pc.x = t.x; pc.y = t.y;
        var label = t.t === 'beast' ? 'HP ' + t.hp : (t.n > 1 || t.t === 'worker') ? '×' + t.n : '';
        if (label !== pc.label) {
          if (pc.badge) { pc.group.remove(pc.badge); disposeObj(pc.badge); pc.badge = null; }
          if (label) { pc.badge = textSprite(label, '#fff', .24, t.n > 6 ? 'rgba(140,70,255,.95)' : t.t === 'beast' ? 'rgba(220,50,80,.92)' : 'rgba(40,90,190,.92)'); pc.badge.position.set(.32, t.t === 'king' ? 1.3 : 1.12, 0); pc.group.add(pc.badge); }
          pc.label = label;
        }
        var resting = E.isResting(st, t), acted = st.active === t.o && t.na >= t.n && !st.over;
        var stateKey = (resting ? 'r' : '') + (acted ? 'a' : '');
        if (stateKey !== pc.stateKey) {
          pc.stateKey = stateKey;
          pc.rimMat.color.set(acted ? '#7c8496' : pc.seat); pc.rimMat.emissive.set(acted ? '#222' : pc.seat);
          if (pc.zz) { pc.group.remove(pc.zz); disposeObj(pc.zz); pc.zz = null; }
          if (resting) { pc.zz = textSprite('Zz', '#cfe6ff', .26); pc.zz.position.set(-.3, 1.05, 0); pc.group.add(pc.zz); }
        }
        var sk = Object.keys(t.st || {}).filter(function (k) { return !/R$/.test(k); }).sort().join(',');
        if (sk !== pc.sk) { pc.sk = sk; self._aura(pc, sk); }
      });
      Object.keys(this.pieces).forEach(function (id) { if (!seen[id]) self._removePiece(id, false); });
      this._syncHL();
    },
    _aura: function (pc, sk) {
      if (pc.aura) { pc.group.remove(pc.aura); disposeObj(pc.aura); pc.aura = null; }
      if (!sk) return;
      var g = new THREE.Group(), keys = sk.split(',');
      if (keys.indexOf('shield') >= 0) {
        var dome = new THREE.Mesh(geo('dome', function () { return new THREE.SphereGeometry(.55, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2); }), new THREE.MeshBasicMaterial({ color: col('#8ff7ff'), transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        dome.position.y = .1; g.add(dome); g.userData.dome = dome;
      }
      var c0 = { curse: '#a066ff', weak: '#9aa0b0', hong: '#ff9966', pct50: '#ff7a3a', plus: '#ffd76a', longuy: '#ff4433', haphon: '#b67bff', linhnhan: '#6fd7ff', enraged: '#ff3333', shield: '#8ff7ff' }[keys.filter(function (k) { return k !== 'shield'; })[0] || 'shield'] || '#fff';
      var ring = new THREE.Mesh(B.torus(.42, .025), new THREE.MeshBasicMaterial({ color: col(c0), transparent: true, opacity: .9 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = .15; g.add(ring);
      for (var i = 0; i < 3; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(c0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(.18, .18, 1); s.userData.orb = i; g.add(s); }
      pc.aura = g; pc.group.add(g);
    },
    _removePiece: function (id, now) {
      var pc = this.pieces[id]; if (!pc) return;
      delete this.pieces[id];
      if (now) { this.root.remove(pc.group); disposeObj(pc.group); return; }
      pc.group.visible = false; pc.deadAt = performance.now(); this.grave[id] = pc;
    },
    _clearPieces: function () {
      var self = this;
      Object.keys(this.pieces).forEach(function (id) { self._removePiece(id, true); });
      Object.keys(this.grave).forEach(function (id) { self.root.remove(self.grave[id].group); });
      this.grave = {};
    },

    /* ---------- vùng sáng ---------- */
    setHL: function (h) { this.hl = h || {}; this._syncHL(); },
    _syncHL: function () {
      var g = this.hlGroup, self = this, hl = this.hl;
      while (g.children.length) { var o = g.children.pop(); if (o.userData.own) disposeObj(o); }
      if (!this.state || !this.tiles) return;
      var tileOv = function (x, y, color, op) {
        var m = new THREE.Mesh(geo('ov', function () { return new THREE.PlaneGeometry(.96, .96); }), mat('ov' + color + op, function () { return new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity: op, depthWrite: false }); }));
        var p = self.w(x, y); m.rotation.x = -Math.PI / 2; m.position.set(p.x, .012, p.z); g.add(m); return m;
      };
      var frame = function (x, y, color) {
        var m = new THREE.Mesh(geo('frame', function () { var s = new THREE.Shape(); s.moveTo(-.47, -.47); s.lineTo(.47, -.47); s.lineTo(.47, .47); s.lineTo(-.47, .47); s.lineTo(-.47, -.47); var h = new THREE.Path(); h.moveTo(-.4, -.4); h.lineTo(-.4, .4); h.lineTo(.4, .4); h.lineTo(.4, -.4); h.lineTo(-.4, -.4); s.holes.push(h); return new THREE.ShapeGeometry(s); }), mat('fr' + color, function () { return new THREE.MeshBasicMaterial({ color: col(color), transparent: true, opacity: .95, depthWrite: false }); }));
        var p = self.w(x, y); m.rotation.x = -Math.PI / 2; m.position.set(p.x, .016, p.z); m.userData.pulse = 1; g.add(m); return m;
      };
      var dragging = this.dragId != null || !!this.extDrag;
      (hl.spawn || []).forEach(function (c) { tileOv(c[0], c[1], '#ffd34d', dragging ? .45 : .35); frame(c[0], c[1], '#ffb020'); });
      (hl.cells || []).forEach(function (c) { tileOv(c[0], c[1], '#2ee6d6', .32); frame(c[0], c[1], '#16b8c9'); });
      (hl.moves || []).forEach(function (m) {
        tileOv(m.x, m.y, m.merge ? '#a066ff' : '#11c9d8', dragging ? .55 : .42);
        frame(m.x, m.y, m.merge ? '#8b45f0' : '#0aa3c2');
        var d = new THREE.Mesh(geo('dot', function () { return new THREE.CylinderGeometry(.1, .1, .02, 20); }), mat('dot' + !!m.merge, function () { return new THREE.MeshBasicMaterial({ color: col(m.merge ? '#c79bff' : '#14d8c8') }); }));
        var p = self.w(m.x, m.y); d.position.set(p.x, .03, p.z); d.userData.bob = 1; g.add(d);
      });
      (hl.attacks || []).forEach(function (a) {
        tileOv(a.x, a.y, '#ff3b3b', .4); frame(a.x, a.y, '#ff2d4a');
        var r = new THREE.Mesh(B.torus(.43, .04), mat('atkRing', function () { return new THREE.MeshBasicMaterial({ color: col('#ff3355') }); }));
        var p = self.w(a.x, a.y); r.rotation.x = Math.PI / 2; r.position.set(p.x, .07, p.z); r.userData.spin = 1; g.add(r);
        var sw = new THREE.Mesh(B.cone(.08, .16, 4), mat('atkArrow', function () { return new THREE.MeshBasicMaterial({ color: col('#ff3355') }); }));
        sw.position.set(p.x, 1.45, p.z); sw.rotation.x = Math.PI; sw.userData.bobHi = 1; g.add(sw);
      });
      if (hl.select && this.pieces[hl.select]) {
        var pc = this.pieces[hl.select], sp = this.w(pc.x, pc.y);
        var ring = new THREE.Mesh(B.torus(.47, .035), mat('selRing', function () { return new THREE.MeshBasicMaterial({ color: col('#ffd34d') }); }));
        ring.rotation.x = Math.PI / 2; ring.position.set(sp.x, .05, sp.z); ring.userData.spin = 1; g.add(ring);
        var beam = new THREE.Mesh(geo('beam', function () { return new THREE.CylinderGeometry(.42, .42, 2.6, 24, 1, true); }), mat('beam', function () { return new THREE.MeshBasicMaterial({ color: col('#ffe27a'), transparent: true, opacity: .18, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }); }));
        beam.position.set(sp.x, 1.3, sp.z); g.add(beam);
      }
      if (hl.ghost && this.state.teams[hl.ghost.id]) {
        var t = this.state.teams[hl.ghost.id], pl = this.state.players[t.o];
        var b = buildPiece(t.t, pl.faction, TT.SEAT_COLORS[pl.seat], t.job);
        b.group.traverse(function (m) { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = .55; m.castShadow = false; } });
        var gp = this.w(hl.ghost.x, hl.ghost.y); b.group.position.set(gp.x, 0, gp.z); b.group.rotation.y = FACING[pl.seat];
        b.group.scale.setScalar(PS); b.group.userData.own = true; b.group.userData.ghost = 1; g.add(b.group);
        frame(hl.ghost.x, hl.ghost.y, '#ffd34d');
      }
      if (this.hover) { tileOv(this.hover[0], this.hover[1], '#ffffff', dragging ? .35 : .18); if (dragging) frame(this.hover[0], this.hover[1], '#ffffff'); }
    },
    setDragHover: function (cell, on) { this.extDrag = on; this.hover = cell; this._syncHL(); },

    /* ================== VFX ================== */
    _fx: function (t0, dur, init, upd, end) { this.anims.push({ k: 'fx', t0: t0, dur: dur * slow(), init: init, upd: upd, end: end }); },
    particles: function (t0, o) {
      var self = this;
      this._fx(t0, o.dur || 800, function (a) {
        var n = o.n || 24, pos = new Float32Array(n * 3); a.vel = [];
        for (var i = 0; i < n; i++) {
          var p = o.at.clone(); if (o.spread) { p.x += rnd(-o.spread, o.spread); p.z += rnd(-o.spread, o.spread); }
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          var v;
          if (o.dir) { v = o.dir.clone().normalize().multiplyScalar(rnd(.6, 1) * (o.speed || 3)); var cn = o.cone || .5; v.x += rnd(-1, 1) * cn; v.y += rnd(-1, 1) * cn; v.z += rnd(-1, 1) * cn; }
          else { var an = Math.random() * 6.28, sp = rnd(.3, 1) * (o.speed || 2); v = new THREE.Vector3(Math.cos(an) * sp, rnd(.2, 1) * (o.up != null ? o.up : 2), Math.sin(an) * sp); }
          a.vel.push(v);
        }
        var bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.userData.own = true;
        a.obj = new THREE.Points(bg, new THREE.PointsMaterial({ map: o.star ? starTex() : glowTex(), color: col(o.color), size: o.size || .22, transparent: true, depthWrite: false }));
        self.fxGroup.add(a.obj);
      }, function (a, k, dt) {
        var pp = a.obj.geometry.attributes.position, gr = o.grav != null ? o.grav : 4;
        for (var i = 0; i < a.vel.length; i++) {
          var v = a.vel[i];
          pp.setXYZ(i, pp.getX(i) + v.x * dt, pp.getY(i) + v.y * dt, pp.getZ(i) + v.z * dt);
          v.y -= gr * dt; if (o.drag) v.multiplyScalar(1 - o.drag * dt);
          if (o.swirl) { var x = pp.getX(i) - o.at.x, z = pp.getZ(i) - o.at.z; v.x += -z * o.swirl * dt; v.z += x * o.swirl * dt; }
        }
        pp.needsUpdate = true; a.obj.material.opacity = 1 - k * k; a.obj.material.size = (o.size || .22) * (o.shrink ? 1 - k * .7 : 1);
      });
    },
    ring: function (t0, at, color, o) {
      o = o || {}; var self = this;
      this._fx(t0, o.dur || 650, function (a) {
        a.obj = new THREE.Mesh(geo('fxring' + (o.thin ? 1 : 0), function () { return new THREE.RingGeometry(o.thin ? .44 : .32, .5, 56); }), addMat(color));
        a.obj.rotation.x = -Math.PI / 2; a.obj.position.copy(at); a.obj.position.y = Math.max(.04, at.y); self.fxGroup.add(a.obj);
      }, function (a, k) { a.obj.scale.setScalar((o.r0 || .6) + ease(k) * (o.r1 || 2)); a.obj.material.opacity = (1 - k) * (o.op || 1); });
    },
    flash: function (t0, at, color, size, dur) {
      var self = this;
      this._fx(t0, dur || 350, function (a) { a.obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(color), transparent: true, depthWrite: false })); a.obj.position.copy(at); a.obj.renderOrder = 5; self.fxGroup.add(a.obj); },
        function (a, k) { var s = (size || 1.5) * (.4 + ease(k) * .8); a.obj.scale.set(s, s, 1); a.obj.material.opacity = 1 - k; });
    },
    pillar: function (t0, at, color, o) {
      o = o || {}; var self = this;
      this._fx(t0, o.dur || 900, function (a) {
        a.obj = new THREE.Mesh(geo('pillar', function () { return new THREE.CylinderGeometry(.42, .5, 1, 28, 1, true); }), addMat(color));
        a.obj.position.copy(at); self.fxGroup.add(a.obj);
      }, function (a, k) { var h = (o.h || 3) * ease(Math.min(1, k * 2)); a.obj.scale.set(o.w || 1, Math.max(.01, h), o.w || 1); a.obj.position.y = at.y + h / 2; a.obj.material.opacity = (k < .5 ? .7 : .7 * (1 - (k - .5) * 2)); });
    },
    slash: function (t0, at, color, o) {
      o = o || {}; var self = this;
      this._fx(t0, o.dur || 320, function (a) {
        a.obj = new THREE.Mesh(geo('slash', function () { return new THREE.RingGeometry(.36, .56, 32, 1, 0, Math.PI * .85); }), addMat(color));
        a.obj.position.copy(at); a.obj.position.y = o.y || .55;
        a.obj.lookAt(self.cam.position); a.obj.rotateZ(o.rot != null ? o.rot : rnd(-1, 1));
        a.obj.scale.setScalar(o.s || 1.2); self.fxGroup.add(a.obj);
        var c2 = new THREE.Mesh(a.obj.geometry, addMat('#ffffff')); c2.scale.setScalar(.92); a.obj.add(c2); a.inner = c2;
      }, function (a, k) { a.obj.rotateZ(.25); a.obj.material.opacity = 1 - k; a.inner.material.opacity = (1 - k) * .8; a.obj.scale.setScalar((o.s || 1.2) * (1 + k * .4)); });
    },
    dome: function (t0, at, color, dur) {
      var self = this;
      this._fx(t0, dur || 900, function (a) { a.obj = new THREE.Mesh(geo('fxdome', function () { return new THREE.SphereGeometry(.6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2); }), addMat(color)); a.obj.position.copy(at); self.fxGroup.add(a.obj); },
        function (a, k) { a.obj.scale.setScalar(.3 + ease(k) * 1.1); a.obj.material.opacity = (1 - k) * .6; });
    },
    coins: function (t0, at, n) {
      var self = this;
      this._fx(t0, 1100, function (a) {
        a.obj = new THREE.Group(); a.items = [];
        for (var i = 0; i < (n || 10); i++) { var m = new THREE.Mesh(B.cyl(.07, .07, .02, 14), M.gold()); m.position.set(at.x + rnd(-.35, .35), at.y + 1.6 + rnd(0, 1), at.z + rnd(-.35, .35)); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); a.obj.add(m); a.items.push({ m: m, v: rnd(-.5, 0) }); }
        self.fxGroup.add(a.obj);
      }, function (a, k, dt) { a.items.forEach(function (it) { it.v -= 7 * dt; it.m.position.y = Math.max(at.y + .1, it.m.position.y + it.v * dt); it.m.rotation.x += dt * 9; }); if (k > .75) a.obj.scale.setScalar(Math.max(.01, 1 - (k - .75) * 4)); });
    },
    projectile: function (t0, from, to, o) {
      var self = this, dur = o.dur || 420;
      this._fx(t0, dur, function (a) {
        a.obj = new THREE.Group();
        if (o.kind === 'arrow') {
          var sh = new THREE.Mesh(B.cyl(.014, .014, .5, 5), M.wood()); sh.rotation.x = Math.PI / 2; a.obj.add(sh);
          var hd = new THREE.Mesh(B.cone(.045, .11, 6), M.steel()); hd.rotation.x = Math.PI / 2; hd.position.z = .29; a.obj.add(hd);
          var fl = new THREE.Mesh(B.box(.09, .002, .1), mat('fletch', function () { return new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }); })); fl.position.z = -.22; a.obj.add(fl);
        } else if (o.kind === 'rock') a.obj.add(new THREE.Mesh(B.dode(.15), mat('boulder', function () { return toon('#7d7369'); })));
        else a.obj.add(new THREE.Mesh(B.sphere(.09), new THREE.MeshBasicMaterial({ color: col('#ffffff') })));
        var gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(o.color), transparent: true, depthWrite: false })); gl.scale.set(o.glow || .8, o.glow || .8, 1); a.obj.add(gl);
        self.fxGroup.add(a.obj); a.last = from.clone();
      }, function (a, k) {
        var p = new THREE.Vector3().lerpVectors(from, to, k); p.y += Math.sin(k * Math.PI) * (o.arc || .6);
        a.obj.lookAt(p.x + (p.x - a.last.x), p.y + (p.y - a.last.y), p.z + (p.z - a.last.z));
        a.obj.position.copy(p);
        if (o.spin) a.obj.children[0].rotation.x += .3;
        if (Math.random() < .85) self._trail(p, o.trail || o.color, o.kind === 'rock' ? .45 : .28);
        a.last = p;
      });
    },
    _trail: function (p, color, s) {
      var self = this;
      this._fx(performance.now(), 380, function (a) { a.obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(color), transparent: true, depthWrite: false })); a.obj.position.copy(p); a.obj.scale.set(s, s, 1); self.fxGroup.add(a.obj); },
        function (a, k) { a.obj.material.opacity = (1 - k) * .8; a.obj.scale.setScalar(s * (1 - k * .6)); a.obj.position.y += .004; });
    },
    shake: function (at, amt) { var self = this; setTimeout(function () { self.shakeT = performance.now(); self.shakeA = amt || .12; }, Math.max(0, at - performance.now())); },

    _attackFx: function (ev, prev, t0, dur) {
      var tm = (prev && prev.teams[ev.id]) || {}, owner = prev && prev.players[tm.o], fid = owner ? owner.faction : 'human';
      var fc = FX_COLOR[fid], type = ev.t, self = this;
      var from = this.V(ev.from[0], ev.from[1], .55), to = this.V(ev.to[0], ev.to[1], .55), hitT = t0 + dur * .5;
      var impact = function (t) {
        if (fid === 'dragon') self.particles(t, { at: to, n: 22, color: '#ff8a2a', speed: 2, up: 2.5, size: .25, dur: 700 });
        if (fid === 'human') self.particles(t, { at: to, n: 18, color: '#ffe28a', speed: 2.2, up: 2, size: .2, dur: 600, star: true });
        if (fid === 'fairy') self.particles(t, { at: to, n: 22, color: '#7ff5e6', speed: 1.6, up: 1.8, size: .2, dur: 800, star: true, grav: 1 });
        if (fid === 'demon') self.particles(t, { at: to, n: 22, color: '#a066ff', speed: 1.2, up: 1.2, size: .32, dur: 900, grav: -1 });
      };
      if (ev.ranged) {
        if (type === 'archer') {
          this.projectile(t0, from.clone().setY(.8), to, { kind: 'arrow', color: fc, arc: .7, dur: dur, trail: '#fff6d0' });
          this.particles(t0 + dur, { at: to, n: 14, color: '#fff2b0', speed: 2.4, up: 1.5, size: .16, dur: 450 }); impact(t0 + dur);
        } else if (type === 'mage') {
          var mf = from.clone().setY(.95);
          this.flash(t0, mf, fc, 1.2, 300);
          this.particles(t0, { at: mf, n: 16, color: fc, speed: .6, up: .8, size: .18, dur: dur, swirl: 6, grav: 0, star: true });
          this.projectile(t0, mf, to, { kind: 'orb', color: fc, arc: .25, dur: dur, glow: 1.1 });
          var tt = t0 + dur;
          this.flash(tt, to, fc, 2.4, 420); this.ring(tt, to.clone().setY(.06), fc, { r1: 1.6, dur: 600 }); this.ring(tt + 80, to.clone().setY(.06), '#ffffff', { r1: 1.1, dur: 450, thin: 1 });
          this.particles(tt, { at: to, n: 34, color: fc, speed: 2.4, up: 2.6, size: .2, dur: 800, star: true, grav: 2 });
        } else if (type === 'siege') {
          this.projectile(t0, from.clone().setY(1.1), to.clone().setY(.2), { kind: 'rock', color: '#ff7a2a', arc: 2.6, dur: dur * 1.25, trail: '#ffb060', glow: 1.3, spin: 1 });
          var te = t0 + dur * 1.25, tp = to.clone().setY(.4);
          this.flash(te, tp, '#ffb040', 3.4, 500); this.ring(te, to.clone().setY(.05), '#ffd08a', { r1: 2.8, dur: 700 });
          this.particles(te, { at: to.clone().setY(.3), n: 50, color: '#ff8a2a', speed: 3.4, up: 3.5, size: .3, dur: 900 });
          this.particles(te, { at: to.clone().setY(.2), n: 24, color: '#d9c4a8', speed: 1.4, up: 1.2, size: .55, dur: 1100, grav: -.2, drag: 2 });
          this.shake(te, .16);
        }
        return;
      }
      if (type === 'assassin') {
        this.particles(t0, { at: from, n: 26, color: '#4a2a70', speed: .8, up: .8, size: .45, dur: 600, grav: -.5 });
        this.slash(hitT, to, fc, { rot: .8, s: 1.3 }); this.slash(hitT + 60, to, '#ffffff', { rot: -.8, s: 1.3 });
        this.flash(hitT, to, fc, 1.6, 300); impact(hitT);
      } else if (type === 'beast') {
        var dir = new THREE.Vector3().subVectors(to, from);
        this.particles(t0 + dur * .2, { at: from.clone().setY(.75), n: 60, color: fid === 'fairy' ? '#7ff5e6' : fid === 'demon' ? '#b67bff' : '#ff7a2a', speed: 4.5, dir: dir, cone: .55, grav: -.5, size: .34, dur: 650, shrink: 1 });
        this.flash(hitT + 120, to, '#ffcf6a', 2.6, 420); impact(hitT + 120); this.shake(hitT + 120, .08);
      } else if (type === 'elephant' || type === 'chariot') {
        this.ring(hitT, to.clone().setY(.05), '#ffe7b0', { r1: 2.2, dur: 600 });
        this.particles(hitT, { at: to.clone().setY(.15), n: 30, color: '#e2cfae', speed: 2.2, up: .8, size: .5, dur: 900, drag: 2, grav: -.1 });
        this.slash(hitT, to, fc, { rot: 0, s: 1.5 }); impact(hitT); this.shake(hitT, .12);
      } else if (type === 'cavalry') {
        this.slash(hitT, to, fc, { rot: .5, s: 1.3 }); this.slash(hitT + 90, to, fc, { rot: -1.2, s: 1.2 });
        impact(hitT);
      } else {
        this.slash(hitT, to, fc, { s: type === 'king' ? 1.5 : 1.2 }); this.flash(hitT, to, '#ffffff', 1.2, 220); impact(hitT);
      }
    },
    _skillFx: function (ev, t0) {
      var st = this.state, self = this, at;
      var tm = ev.id != null ? st.teams[ev.id] : null;
      if (tm) at = this.V(tm.x, tm.y, .1); else if (ev.x != null) at = this.V(ev.x, ev.y, .1);
      if (!at && ev.p != null) { var k = E.kingOf(st, ev.p); if (k) at = this.V(k.x, k.y, .1); }
      if (!at) return;
      var up = at.clone().setY(.6);
      switch (ev.a) {
        case 'longluc': this.pillar(t0, at, '#ff6a1a', { h: 2.6 }); this.particles(t0, { at: up, n: 40, color: '#ff8a2a', speed: .8, up: 3, size: .3, dur: 1000, swirl: 5, grav: 0 }); break;
        case 'longuy': [-.3, 0, .3].forEach(function (o, i) { self.slash(t0 + i * 70, at.clone().add(new THREE.Vector3(o, 0, 0)), '#ff3322', { rot: 1.4, s: 1, y: .7 }); }); this.ring(t0, at, '#ff4433'); break;
        case 'longhong': for (var i = 0; i < 3; i++) this.ring(t0 + i * 160, at, '#ff9966', { r1: 4.6, dur: 800 }); this.particles(t0, { at: up, n: 40, color: '#ffb080', speed: 4, up: .3, size: .3, dur: 800, grav: 0 }); this.shake(t0, .1); break;
        case 'taitro': this.coins(t0, at, 12); this.pillar(t0, at, '#ffd34d', { h: 2.2 }); break;
        case 'hoilo': this.coins(t0, at, 8); this.particles(t0, { at: up, n: 30, color: '#c79bff', speed: .9, up: 1.4, size: .25, dur: 1000, swirl: 6, grav: 0, star: true }); this.ring(t0, at, '#ffd34d'); break;
        case 'thuthue': this.coins(t0, at, 16); this.ring(t0, at, '#ffd34d', { r1: 3 }); break;
        case 'linhnhan': this.pillar(t0, at, '#6fd7ff', { h: 3.2, w: .6 }); this.particles(t0, { at: up, n: 28, color: '#bff7ff', speed: .5, up: 3, size: .2, dur: 1000, grav: 0, star: true }); break;
        case 'thienmac': this.dome(t0, at, '#8ff7ff', 900); this.particles(t0, { at: up, n: 30, color: '#d8ffff', speed: 1.2, up: 1.2, size: .2, dur: 900, star: true, grav: .5 }); break;
        case 'loinguyen': this.ring(t0, at, '#7a3cff', { r1: 1.4, dur: 900 }); this.particles(t0, { at: at.clone().setY(1.4), n: 36, color: '#6a2ad6', speed: .5, up: -1.5, size: .38, dur: 1000, swirl: 7, grav: 0 }); break;
        case 'haphon': this.particles(t0, { at: up, n: 50, color: '#b67bff', speed: 1.4, up: .6, size: .28, dur: 1200, swirl: 9, grav: -.6, drag: .8 }); this.pillar(t0, at, '#7a3cff', { h: 1.8 }); break;
        case 'huyette': this.pillar(t0, at, '#ff1f3d', { h: 2.4, w: .7 }); break;
        default: this.ring(t0, at, '#2ee6d6'); this.particles(t0, { at: up, n: 24, color: '#7ff5e6', speed: 1.2, up: 1.5, size: .2, dur: 800, star: true });
      }
    },

    play: function (prev, events, speed) {
      speed = (speed || 1) / slow();
      var self = this, now = performance.now(), t = 0;
      var D = { move: 320 / speed, atk: 420 / speed };
      events.forEach(function (ev) {
        var T = now + t;
        switch (ev.e) {
          case 'move': {
            var mt = (prev && prev.teams[ev.id]) || self.state.teams[ev.id];
            self.anims.push({ k: 'move', id: ev.id, from: ev.from, to: ev.to, t0: T, dur: D.move, push: ev.push });
            if (mt && (mt.t === 'cavalry' || mt.t === 'chariot' || mt.t === 'elephant')) for (var d = 0; d < 4; d++) self.particles(T + d * D.move / 4, { at: self.V(ev.from[0] + (ev.to[0] - ev.from[0]) * d / 4, ev.from[1] + (ev.to[1] - ev.from[1]) * d / 4, .1), n: 6, color: '#e2cfae', speed: .5, up: .4, size: .4, dur: 600, grav: -.1 });
            if (ev.push) self.ring(T, self.V(ev.to[0], ev.to[1], .05), '#ffe7b0', { r1: 1.2 });
            (function (tt) { setTimeout(function () { TT.Sound.play('move'); }, tt); })(t);
            t += D.move * .9; break;
          }
          case 'attack': {
            var dur = ev.ranged ? D.atk : D.atk * .9;
            if (!ev.ranged) self.anims.push({ k: 'lunge', id: ev.id, from: ev.from, to: ev.to, t0: T, dur: dur });
            self._attackFx(ev, prev, T, dur);
            (function (tt) { setTimeout(function () { TT.Sound.play(ev.ranged ? 'shoot' : 'hit'); }, tt); })(t);
            t += ev.ranged ? (ev.t === 'siege' ? dur * 1.3 : dur * 1.05) : dur * .7;
            break;
          }
          case 'dmg': {
            self.anims.push({ k: 'float', at: self.V(ev.x, ev.y, 1.15), text: ev.amt > 0 ? '-' + ev.amt : 'CHẶN', color: ev.amt > 0 ? '#ff5d5d' : '#9fe7ff', t0: T, dur: 1200, h: ev.amt >= 4 ? .75 : .6, pop: 1 });
            self.anims.push({ k: 'hitflash', id: ev.id, t0: T, dur: 300 });
            if (ev.amt > 0) self.particles(T, { at: self.V(ev.x, ev.y, .5), n: 12, color: '#ff4d4d', speed: 1.8, up: 2, size: .16, dur: 500 });
            break;
          }
          case 'destroy': {
            var fid = (self.state.players[ev.o] || (prev && prev.players[ev.o]) || {}).faction || 'human';
            self.anims.push({ k: 'die', id: ev.id, t0: T, dur: 750 });
            var c0 = self.V(ev.x, ev.y, .4);
            self.flash(T, c0, '#ffffff', 2.2, 300);
            self.particles(T, { at: c0, n: 44, color: FX_COLOR[fid], speed: 2.6, up: 3, size: .3, dur: 1000, star: true });
            self.ring(T, self.V(ev.x, ev.y, .05), FX_COLOR[fid], { r1: 1.6 });
            if (fid === 'demon') self.particles(T + 200, { at: c0, n: 10, color: '#d0b0ff', speed: .3, up: 2.5, size: .5, dur: 1400, grav: -.5, swirl: 4 });
            self.shake(T, ev.t === 'king' ? .3 : .1);
            (function (tt) { setTimeout(function () { TT.Sound.play('die'); }, tt); })(t);
            t += 160; break;
          }
          case 'reward':
            if (ev.x != null) {
              self.anims.push({ k: 'float', at: self.V(ev.x, ev.y, 1.5), text: '+' + ev.n + ' ' + TT.RES_NAME[ev.res], color: '#ffe066', t0: T + 240, dur: 1400, h: .5 });
              self.coins(T + 200, self.V(ev.x, ev.y, 0), Math.min(10, 3 + ev.n));
            }
            (function (tt) { setTimeout(function () { TT.Sound.play('coin'); }, tt + 220); })(t);
            break;
          case 'buy': case 'spawn': {
            var bc = self.V(ev.x, ev.y, 0), sc = ev.e === 'buy' ? '#ffe27a' : '#c79bff';
            self.anims.push({ k: 'pop', id: ev.id, t0: T, dur: 420 });
            self.pillar(T, bc, sc, { h: 1.8, dur: 700, w: .8 });
            self.particles(T, { at: bc.clone().setY(.3), n: 16, color: sc, speed: .8, up: 2.4, size: .18, dur: 800, star: true, grav: 1 });
            if (ev.e === 'buy') TT.Sound.play('buy');
            t += ev.e === 'buy' ? 60 : 200; break;
          }
          case 'grow':
            self.anims.push({ k: 'float', at: self.V(ev.x, ev.y, 1.4), text: '+1 quân!', color: '#d8b6ff', t0: T, dur: 1300, h: .5 });
            self.pillar(T, self.V(ev.x, ev.y, 0), '#a066ff', { h: 2.4 });
            self.particles(T, { at: self.V(ev.x, ev.y, .4), n: 30, color: '#c79bff', speed: 1, up: 2, size: .26, dur: 1000, swirl: 6, grav: 0 });
            break;
          case 'fx': {
            var fp = self.V(ev.x, ev.y, .1);
            if (ev.kind === 'fire') { self.flash(T, fp.clone().setY(.5), '#ff8a2a', 1.8, 400); self.particles(T, { at: fp.clone().setY(.3), n: 26, color: '#ff8a2a', speed: 1.4, up: 2.6, size: .3, dur: 700 }); }
            else if (ev.kind === 'pierce') self.slash(T, fp, '#fff2a0', { rot: 0, s: 1 });
            else if (ev.kind === 'curse') { self.ring(T, fp, '#a066ff'); self.particles(T, { at: fp.clone().setY(.6), n: 18, color: '#7a3cff', speed: .6, up: -.5, size: .32, dur: 800, swirl: 6, grav: 0 }); }
            else if (ev.kind === 'roar') self.ring(T, fp, '#ff9966', { r1: 1.2 });
            break;
          }
          case 'skill': self._skillFx(ev, T); TT.Sound.play('skill'); t += 260; break;
          case 'swap':
            [ev.a, ev.b].forEach(function (id) { var tt = self.state.teams[id]; if (tt) { var sp = self.V(tt.x, tt.y, .3); self.particles(T, { at: sp, n: 30, color: '#7ff5e6', speed: 1, up: 1.2, size: .24, dur: 900, swirl: 8, grav: 0, star: true }); self.ring(T, sp.clone().setY(.05), '#2ee6d6'); self.anims.push({ k: 'pop', id: id, t0: T + 150, dur: 380 }); } });
            TT.Sound.play('skill'); t += 250; break;
          case 'convert': case 'sacrifice': {
            var cp = self.V(ev.x, ev.y, 0), cc2 = ev.e === 'sacrifice' ? '#ff1f3d' : '#ffd34d';
            self.pillar(T, cp, cc2, { h: 2.4, w: .7 }); self.particles(T, { at: cp.clone().setY(.4), n: 30, color: cc2, speed: 1.6, up: 2.5, size: .26, dur: 900 });
            if (ev.e === 'convert') self.coins(T, cp, 8);
            t += 200; break;
          }
          case 'age': {
            var k2 = E.kingOf(self.state, ev.p);
            if (k2) {
              var kp = self.V(k2.x, k2.y, 0);
              self.pillar(T, kp, '#ffe066', { h: 5, w: 1.2, dur: 1400 });
              for (var r = 0; r < 3; r++) self.ring(T + r * 200, kp, '#ffd34d', { r1: 3, dur: 900 });
              self.particles(T, { at: kp.clone().setY(.4), n: 60, color: '#fff2a0', speed: 1.4, up: 4, size: .26, dur: 1400, star: true, grav: 1.5 });
              self.anims.push({ k: 'float', at: kp.clone().setY(1.8), text: 'Đời ' + TT.AGE_ROMAN[ev.age] + ' · ' + TT.AGE_NAME[ev.age] + '!', color: '#ffe066', t0: T + 200, dur: 1800, h: .7 });
            }
            TT.Sound.play('age'); break;
          }
          case 'elim': self.shake(T, .3); break;
        }
      });
      return new Promise(function (res) { setTimeout(res, Math.max(0, t) + 80); });
    },
    _anim: function (k, id, now) { for (var i = 0; i < this.anims.length; i++) { var a = this.anims[i]; if (a.k === k && a.id === id && now < a.t0 + a.dur) return a; } return null; },

    loop: function () {
      if (this.dead) return;
      requestAnimationFrame(this.loop);
      if (!this.state || (this.showcase && this.paused)) return;
      var now = performance.now(), dt = Math.min(.05, (now - this.clock) / 1000); this.clock = now;
      var self = this, tsec = now / 1000;
      if (this.showcase) this.azT += dt * .08;
      this.az += (this.azT - this.az) * Math.min(1, dt * 8);
      this.R += (this.RT - this.R) * Math.min(1, dt * 8);
      var el = this.el, shake = 0;
      if (this.shakeT && now - this.shakeT < 380) shake = (1 - (now - this.shakeT) / 380) * (this.shakeA || .12);
      this.pan.x += (this.panT.x - this.pan.x) * Math.min(1, dt * 10); this.pan.z += (this.panT.z - this.pan.z) * Math.min(1, dt * 10);
      this.cam.position.set(this.pan.x + Math.cos(el) * Math.sin(this.az) * this.R + rnd(-1, 1) * shake, Math.sin(el) * this.R + rnd(-1, 1) * shake, this.pan.z + Math.cos(el) * Math.cos(this.az) * this.R);
      this.cam.lookAt(this.pan.x, -.9, this.pan.z);
      (this.braziers || []).forEach(function (b) { var f = .9 + Math.sin(tsec * 2 + b.ph) * .1; b.fire.scale.set(1.1 * f, 1.1 * f, 1); });
      (this.clouds || []).forEach(function (c) { c.a += c.s * dt; c.g.position.x = Math.cos(c.a) * c.r; c.g.position.z = Math.sin(c.a) * c.r; });
      (this.resGlows || []).forEach(function (g, i) { g.material.opacity = .3 + Math.sin(tsec * 2 + i) * .12; });
      if (this.sparkles) {
        var pa = this.sparkles.geometry.attributes.position, sp = this.sparkles.userData.sp;
        for (var i = 0; i < sp.length; i++) { var y = pa.getY(i) + sp[i] * dt; if (y > 5) y = 0; pa.setY(i, y); pa.setX(i, pa.getX(i) + Math.sin(tsec * .7 + i) * dt * .15); }
        pa.needsUpdate = true;
      }
      if (this.boardGroup) this.boardGroup.children.forEach(function (o) { if (o.name === 'banner') o.rotation.y = Math.sin(tsec * 2 + o.position.x) * .3; });
      if (this.envGroup) this.envGroup.traverse(function (o) { if (o.name === 'banner') { var pp = o.geometry.attributes.position; if (!o.userData.base) o.userData.base = pp.array.slice(); var bs = o.userData.base; for (var vi = 0; vi < pp.count; vi++) { var vy = bs[vi * 3 + 1]; pp.setZ(vi, Math.sin(tsec * 2.2 + vy * 2 + o.parent.position.x) * .06 * (.8 - vy)); } pp.needsUpdate = true; } });
      Object.keys(this.pieces).forEach(function (id) {
        var pc = self.pieces[id], wp = self.w(pc.x, pc.y), pos = new THREE.Vector3(wp.x, 0, wp.z), sc = 1;
        var ma = self._anim('move', +id, now);
        if (ma) {
          var a0 = self.w(ma.from[0], ma.from[1]), b0 = self.w(ma.to[0], ma.to[1]);
          if (now < ma.t0) pos.set(a0.x, 0, a0.z);
          else { var k = ease((now - ma.t0) / ma.dur), dist = Math.hypot(b0.x - a0.x, b0.z - a0.z); pos.set(a0.x + (b0.x - a0.x) * k, Math.sin(k * Math.PI) * (ma.push ? .15 : .3 + dist * .1), a0.z + (b0.z - a0.z) * k); }
        }
        var la = self._anim('lunge', +id, now);
        if (la && now >= la.t0) {
          var kk = Math.sin(Math.min(1, (now - la.t0) / la.dur) * Math.PI) * .42;
          var fa = self.w(la.from[0], la.from[1]), tb = self.w(la.to[0], la.to[1]);
          pos.x += (tb.x - fa.x) * kk; pos.z += (tb.z - fa.z) * kk; pos.y += kk * .35;
        }
        if (+id === self.dragId && self.dragPoint) pos.set(self.dragPoint.x, .55 + Math.sin(tsec * 8) * .04, self.dragPoint.z);
        var po = self._anim('pop', +id, now);
        if (po) sc = now < po.t0 ? .01 : .3 + .7 * ease((now - po.t0) / po.dur) + Math.sin(Math.min(1, (now - po.t0) / po.dur) * Math.PI) * .2;
        pc.group.position.copy(pos); pc.group.scale.setScalar(sc * PS);
        pc.body.scale.set(1, 1 + Math.sin(tsec * 2.4 + pc.ph) * .025, 1);
        var fl = pc.body.getObjectByName('flag'); if (fl) fl.rotation.y = Math.sin(tsec * 3 + pc.ph) * .3;
        var wr = pc.body.getObjectByName('wingR'), wl = pc.body.getObjectByName('wingL');
        if (wr) { var fw = Math.sin(tsec * 5 + pc.ph) * .3; wr.rotation.z = .2 + fw; wl.rotation.z = .2 + fw; }
        var orb = pc.body.getObjectByName('orb'); if (orb) orb.scale.setScalar(1 + Math.sin(tsec * 4 + pc.ph) * .15);
        if (pc.body.userData.float) { pc.body.position.y = .06 + Math.sin(tsec * 2 + pc.ph) * .04; pc.body.children.forEach(function (c) { if (c.name === 'fwR') c.rotation.y = .5 + Math.sin(tsec * 9 + pc.ph) * .35; if (c.name === 'fwL') c.rotation.y = -.5 - Math.sin(tsec * 9 + pc.ph) * .35; }); }
        var cp = pc.body.getObjectByName('cape'); if (cp) cp.rotation.x = .18 + Math.sin(tsec * 2.5 + pc.ph) * .08;
        var hf = self._anim('hitflash', +id, now);
        pc.body.position.x = hf && now >= hf.t0 ? Math.sin((now - hf.t0) / 18) * .05 : 0;
        if (pc.aura) {
          pc.aura.children.forEach(function (c) { if (c.userData.orb != null) { var an = tsec * 2 + c.userData.orb * 2.09; c.position.set(Math.cos(an) * .4, .3 + Math.sin(tsec * 3 + c.userData.orb) * .15, Math.sin(an) * .4); } });
          if (pc.aura.userData.dome) pc.aura.userData.dome.material.opacity = .22 + Math.sin(tsec * 3) * .08;
        }
      });
      this.anims.forEach(function (a) {
        if (now < a.t0) return;
        var k = Math.min(1, (now - a.t0) / a.dur);
        if (a.k === 'fx') { if (!a.started) { a.started = true; a.init(a); } a.upd(a, k, dt); return; }
        if (a.k === 'float') {
          if (!a.obj) { a.obj = textSprite(a.text, a.color, a.h || .55); a.obj.position.copy(a.at); self.fxGroup.add(a.obj); a.base = a.obj.scale.clone(); }
          a.obj.position.y = a.at.y + ease(k) * .9;
          var pk = a.pop && k < .15 ? 1 + (1 - k / .15) * .6 : 1; a.obj.scale.set(a.base.x * pk, a.base.y * pk, 1);
          a.obj.material.opacity = k < .7 ? 1 : 1 - (k - .7) / .3;
        }
        if (a.k === 'die') {
          if (!a.started) { a.started = true; var pc = self.grave[a.id]; if (pc) { a.obj = pc.group; pc.group.visible = true; delete self.grave[a.id]; } }
          if (a.obj) { a.obj.scale.setScalar(Math.max(.01, 1 - ease(k))); a.obj.position.y = k * .6; a.obj.rotation.y += dt * 12; }
        }
      });
      this.anims = this.anims.filter(function (a) {
        var done = now > a.t0 + a.dur + 30;
        if (done && a.obj && (a.k === 'fx' || a.k === 'float' || a.k === 'die')) { if (a.obj.parent) a.obj.parent.remove(a.obj); disposeObj(a.obj); if (a.end) a.end(a); }
        return !done;
      });
      Object.keys(this.grave).forEach(function (id) { if (now - self.grave[id].deadAt > 2500) { self.root.remove(self.grave[id].group); disposeObj(self.grave[id].group); delete self.grave[id]; } });
      var pulse = (Math.sin(now / 230) + 1) / 2;
      this.hlGroup.children.forEach(function (o) {
        if (o.userData.spin) { o.rotation.z = tsec * 1.5; o.scale.setScalar(1 + pulse * .06); }
        if (o.userData.bob) o.position.y = .03 + pulse * .05;
        if (o.userData.bobHi) o.position.y = 1.35 + pulse * .15;
        if (o.userData.pulse) o.material.opacity = .6 + pulse * .4;
        if (o.userData.ghost) o.position.y = .06 + pulse * .06;
      });
      this.renderer.render(this.scene, this.cam);
    }
  };

  /* ---------- màn trưng bày ở trang đăng nhập ---------- */
  TT.showcase3D = function (canvas, wrap) {
    if (!TT.webglOK) return null;
    var setup = { seed: 20261007, mode: 4, players: [0, 1, 2, 3].map(function (s) { return { seat: s, uid: 'x' + s, name: 'P' + s, faction: TT.FACTION_ORDER[s], passive: TT.FACTIONS[TT.FACTION_ORDER[s]].passives[0].id, home: 'VTG'[s % 3] }; }) };
    var st = E.init(setup);
    var lineup = ['soldier', 'archer', 'cavalry', 'mage', 'siege', 'chariot', 'beast', 'elephant', 'commander', 'shield', 'assassin', 'worker'];
    st.players.forEach(function (p, i) {
      var cells = E.spawnCells(st, i);
      [0, 1, 2, 4, 5, 6, 7].forEach(function (c, j) { var cc = cells[c]; var id = st.nextId++; st.teams[id] = { id: id, o: i, t: lineup[(j + i * 3) % lineup.length], x: cc[0], y: cc[1], n: 1, na: 0, rest: -9, st: {}, job: 'V', hp: 3 }; });
    });
    var b = new Board3D(canvas, wrap, { showcase: true });
    b.setState(st); b.el = .55; b.RT = b.R = 19; b.azT = b.az = .6;
    setInterval(function () {
      if (b.paused || b.dead) return;
      var ids = E.teamIds(st), t = st.teams[ids[(Math.random() * ids.length) | 0]];
      b._skillFx({ a: ['longluc', 'thienmac', 'haphon', 'linhnhan', 'taitro'][(Math.random() * 5) | 0], id: t.id }, performance.now());
    }, 2200);
    return b;
  };
})(window);
