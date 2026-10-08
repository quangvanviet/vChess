/* Tứ Tộc Kỳ Chiến 2.0 — chiến trường 3D (Three.js): địa hình, quân instanced có hoạt ảnh,
   phát lại giao tranh từ mô phỏng xác định, VFX, thanh máu & số sát thương (lớp 2D), camera tự do. */
(function (G) {
  'use strict';
  var TT = G.TT, THREE = G.THREE;
  if (!THREE) return;
  TT.webglOK = (function () { try { var c = document.createElement('canvas'); return !!(G.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } })();

  var PI = Math.PI, US = 1.6; // US: phóng to mô hình cho dễ nhìn trên bản đồ lớn
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
  function col(c) { return new THREE.Color(c); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  var FXC = { dragon: '#ff7a2a', human: '#ffe28a', fairy: '#6ff7e2', demon: '#b67bff', star: '#fff2a0', boom: '#ffb040', taunt: '#ff9966', curse: '#a066ff', blood: '#ff1f3d' };
  // địa hình liền mạch (heightmap): độ cao & màu gốc theo loại ô
  var TER_H = { '.': 0, 'F': .06, 'H': .9, '~': -.62, 'S': -.38, '=': .02, '#': 1.55, 'T': .12 };
  var TER_C = { '.': '#86c663', 'F': '#5a9f48', 'H': '#a6d071', '~': '#cdb88a', 'S': '#5f7a45', '=': '#c9a46c', '#': '#a59d8d', 'T': '#cbbf9f' };
  var WATER_Y = -.3, RES = 2, MARGIN = 14;

  /* ---------- tài nguyên dùng chung ---------- */
  var TEX = {}, GEO = {}, MAT = {};
  function geo(k, f) { return GEO[k] || (GEO[k] = f()); }
  function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function glowTex() { return TEX.glow || (TEX.glow = canvasTex(64, 64, function (g) { var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); })); }
  function starTex() { return TEX.star || (TEX.star = canvasTex(64, 64, function (g) { g.translate(32, 32); g.fillStyle = '#fff'; g.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 6 : 30, a = i * PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); var gr = g.createRadialGradient(0, 0, 0, 0, 0, 14); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); })); }
  function skyTex() { return TEX.sky || (TEX.sky = canvasTex(16, 512, function (g) { var gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#3d8fe6'); gr.addColorStop(.55, '#8fd0ff'); gr.addColorStop(.8, '#d8f1ff'); gr.addColorStop(1, '#fff6e0'); g.fillStyle = gr; g.fillRect(0, 0, 16, 512); })); }
  function grassTex() {
    return TEX.grass || (TEX.grass = (function () {
      var t = canvasTex(256, 256, function (g) {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
        for (var i = 0; i < 900; i++) { var v = 225 + Math.random() * 30 | 0; g.fillStyle = 'rgba(' + (v - 20) + ',' + v + ',' + (v - 30) + ',.5)'; var x = Math.random() * 256, y = Math.random() * 256; g.fillRect(x, y, 2, 4 + Math.random() * 5); }
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.strokeRect(1, 1, 254, 254);
      }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
    })());
  }
  function waterTex() {
    return TEX.water || (TEX.water = (function () {
      var t = canvasTex(256, 256, function (g) {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
        for (var i = 0; i < 70; i++) { var x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 22; g.strokeStyle = 'rgba(190,235,255,' + (.25 + Math.random() * .35) + ')'; g.lineWidth = 1.5 + Math.random() * 2; g.beginPath(); g.ellipse(x, y, r * 1.6, r * .45, 0, 0, Math.PI * (0.6 + Math.random() * .6)); g.stroke(); }
      }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
    })());
  }
  function rrect(g, x, y, w, h, r, fill) { if (w <= 0) return; r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = fill; g.fill(); }
  var ITEM_IMG = {};
  function itemImg(k) {
    if (ITEM_IMG[k]) return ITEM_IMG[k];
    var it = TT.ITEMS[k], I = TT.Icons; if (!it || !I) return null;
    var bg = { 1: ['#d8e1ea', '#8b9cb2'], 2: ['#9fdcff', '#3d8fe0'], 3: ['#e6c2ff', '#9b5be0'], 4: ['#ffe9a0', '#f0a020'] }[it.tier];
    var ic = I.svg(I.ITEM_ICON[k] || 'it_gem', '#ffffff', 40).replace(/<svg /, '<svg x="12" y="12" ').replace(/currentColor/g, '#ffffff');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="14" fill="url(#g)" stroke="#ffffff" stroke-width="5"/>' + ic + '</svg>';
    var im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); ITEM_IMG[k] = im; return im;
  }
  function mulberry(seed) { return TT.mulberry(seed >>> 0); }
  // gộp nhiều geometry thành một (không chỉ mục), giữ position + normal
  function mergeGeo(list) {
    var pos = [], nor = [];
    list.forEach(function (g0) { var g = g0.index ? g0.toNonIndexed() : g0; var P = g.attributes.position.array, N = g.attributes.normal.array; for (var i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); } });
    var bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); bg.computeBoundingSphere(); return bg;
  }
  // tán cây tròn mềm: vài khối cầu chồng lên nhau
  function blobGeo(spheres) { return mergeGeo(spheres.map(function (s) { var g = new THREE.IcosahedronGeometry(s[3], 1); g.translate(s[0], s[1], s[2]); return g; })); }
  var toonGrad = null;
  function toonMap() { if (toonGrad) return toonGrad; var d = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 240, 240, 240, 255, 255, 255, 255, 255]); toonGrad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter; toonGrad.needsUpdate = true; return toonGrad; }
  // vật liệu PBR low-poly: MeshStandardMaterial, mặt phẳng (flat shading), nhận ánh sáng HDRI
  function toon(c, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: col(c), roughness: .82, metalness: 0, flatShading: true, envMapIntensity: .75 }, extra || {})); }
  /* vật liệu nhân vật (smooth shading cho da/tóc/vải; giáp, mũ, vũ khí đã có pháp tuyến phẳng sẵn trong mô hình): màu đỉnh + độ nhám/kim loại theo từng đỉnh (thuộc tính "mr" do models.js ghi: kim loại sáng bóng, vải nhám) */
  function unitMat() {
    if (MAT.unit) return MAT.unit;
    var m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: .7, metalness: 0, envMapIntensity: .9 });
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = 'attribute vec2 mr;\nvarying vec2 vMR;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vMR = mr;');
      sh.fragmentShader = 'varying vec2 vMR;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vMR.y;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = vMR.x;');
    };
    m.userData.shared = true; return (MAT.unit = m);
  }
  // HDRI môi trường (Poly Haven, CC0) — nạp một lần, dùng chung
  var ASSET_BASE = (function () { var sc = document.querySelector('script[src*="field3d.js"]'); return sc ? sc.getAttribute('src').replace(/js\/ui\/field3d\.js.*$/, '') : ''; })();
  var HDR = null;
  function loadHDR(cb) {
    if (HDR && HDR.tex) return cb(HDR.tex);
    if (!HDR) { HDR = { cbs: [] }; if (THREE.RGBELoader) new THREE.RGBELoader().load(ASSET_BASE + 'assets/hdri/quarry_01_1k.hdr', function (t) { t.mapping = THREE.EquirectangularReflectionMapping; HDR.tex = t; HDR.cbs.forEach(function (f) { f(t); }); HDR.cbs = []; }, null, function () { HDR.cbs = []; }); }
    if (HDR.cbs) HDR.cbs.push(cb);
  }
  /* viền đậm kiểu hoạt hình: vẽ mặt sau, đẩy đỉnh ra theo pháp tuyến, màu tối cùng tông */
  function outlineMat() {
    if (MAT.ol) return MAT.ol;
    var m = new THREE.MeshBasicMaterial({ color: '#6a5262', vertexColors: true, side: THREE.BackSide });
    m.onBeforeCompile = function (sh) { sh.vertexShader = 'attribute float olw;\nattribute vec3 onrm;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(onrm) * 0.0135 * olw;'); }; // pháp tuyến mượt → viền liền, không nứt ở cạnh giáp
    m.userData.shared = true; return (MAT.ol = m);
  }
  function RB(w, h, d, r) { return TT.Models.B(w, h, d, r); } // khối bo góc dùng chung với nhân vật
  function propOutlineMat() {
    if (MAT.pol) return MAT.pol;
    var m = new THREE.MeshBasicMaterial({ color: '#4a4048', side: THREE.BackSide });
    m.onBeforeCompile = function (sh) { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * 0.022;'); };
    m.userData.shared = true; return (MAT.pol = m);
  }
  // viền cho InstancedMesh (dùng chung ma trận) hoặc Mesh thường
  function withOutline(mesh) {
    var ol;
    if (mesh.isInstancedMesh) { ol = new THREE.InstancedMesh(mesh.geometry, propOutlineMat(), mesh.instanceMatrix.count); ol.instanceMatrix = mesh.instanceMatrix; ol.count = mesh.count; }
    else { ol = new THREE.Mesh(mesh.geometry, propOutlineMat()); ol.position.copy(mesh.position); ol.rotation.copy(mesh.rotation); ol.scale.copy(mesh.scale); }
    ol.userData.isOutline = true; mesh.userData.ol = ol; return ol;
  }
  function addMat(c) { return new THREE.MeshBasicMaterial({ color: col(c), transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }); }
  function disposeObj(o) { o.traverse(function (m) { if (m.material && !m.material.userData.shared) { (Array.isArray(m.material) ? m.material : [m.material]).forEach(function (mt) { mt.dispose(); }); } if (m.geometry && m.geometry.userData.own) m.geometry.dispose(); }); }
  var _m4 = new THREE.Matrix4(), _m5 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _p = new THREE.Vector3();

  function Field3D(canvas, wrap, opts) {
    opts = opts || {};
    this.c = canvas; this.wrap = wrap; this.showcase = !!opts.showcase; this.lowGfx = !!opts.lowRes;
    this.map = null; this.mode = 'prep'; this.view = 0; this.anims = []; this.texts = []; this.vis = {}; this.kinds = {}; this.prepList = [];
    this.az = 0; this.azT = 0; this.el = .95; this.R = 40; this.RT = 40; this.userAz = 0; this.pan = { x: 0, z: 0 }; this.panT = { x: 0, z: 0 };
    this.speed = 1; this.acc = 0; this.B = null; this.paused = false;
    // chất lượng cao: hậu kỳ (SSAO + Bloom + Vignette + ToneMapping ACES + SMAA) qua pmndrs postprocessing
    this.hq = !opts.lowRes && !!(THREE.PP && THREE.N8AOPostPass) && !this.showcase;
    var r = this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !this.hq, alpha: !!this.showcase, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(opts.lowRes ? 1.25 : (this.hq ? 1.5 : 2), G.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = this.hq ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    if (!this.showcase) this.scene.background = skyTex();
    this.scene.fog = new THREE.Fog('#d3e9f7', 85, 230);
    this.cam = new THREE.PerspectiveCamera(36, 1, .5, 500);
    // ánh sáng: HDRI làm ánh sáng môi trường (IBL) + nắng chính đổ bóng mềm + trời/đất nhẹ
    this.hemi = new THREE.HemisphereLight('#eef7ff', '#6f9152', .55); this.scene.add(this.hemi);
    var key = this.key = new THREE.DirectionalLight('#ffeed2', 2.1);
    key.position.set(-30, 60, 40); key.castShadow = true; key.shadow.mapSize.set(opts.lowRes ? 1024 : 2048, opts.lowRes ? 1024 : 2048); key.shadow.bias = -.0005; key.shadow.normalBias = .035; key.shadow.radius = 3;
    this.scene.add(key); this.scene.add(key.target);
    var fill = new THREE.DirectionalLight('#a8dcff', .35); fill.position.set(30, 20, -30); this.scene.add(fill);
    var self0 = this;
    loadHDR(function (t) { if (self0.dead) return; var pm = new THREE.PMREMGenerator(r); self0.scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); self0.hemi.intensity = .25; });
    if (this.hq) {
      var PP = THREE.PP, cp = this.composer = new PP.EffectComposer(r, { frameBufferType: THREE.HalfFloatType });
      cp.addPass(new PP.RenderPass(this.scene, this.cam));
      var ao = this.ao = new THREE.N8AOPostPass(this.scene, this.cam, 512, 512);
      ao.configuration.aoRadius = 1.4; ao.configuration.distanceFalloff = .9; ao.configuration.intensity = 2.4; ao.configuration.halfRes = true; ao.configuration.color = new THREE.Color('#2b2440');
      cp.addPass(ao);
      cp.addPass(new PP.EffectPass(this.cam, new PP.BloomEffect({ luminanceThreshold: .86, luminanceSmoothing: .25, intensity: .6, mipmapBlur: true }), new PP.VignetteEffect({ offset: .3, darkness: .42 }), new PP.ToneMappingEffect({ mode: PP.ToneMappingMode.ACES_FILMIC })));
      cp.addPass(new PP.EffectPass(this.cam, new PP.SMAAEffect({ preset: PP.SMAAPreset.HIGH })));
    }
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.terrainG = new THREE.Group(); this.scene.add(this.terrainG);
    this.unitG = new THREE.Group(); this.scene.add(this.unitG);
    this.hlG = new THREE.Group(); this.scene.add(this.hlG);
    this.fxG = new THREE.Group(); this.scene.add(this.fxG);
    // lớp 2D: thanh máu, số sát thương
    var ov = this.ov = document.createElement('canvas'); ov.className = 'field-ov'; wrap.appendChild(ov); this.og = ov.getContext('2d');
    var self = this;
    this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(wrap);
    this.clock = performance.now();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    if (!this.showcase) this._controls();
  }
  TT.Field3D = Field3D;

  Field3D.prototype = {
    is3D: true,
    /* toạ độ ô → thế giới */
    wx: function (tx) { return tx - this.map.W / 2; },
    wz: function (ty) { return ty - this.map.H / 2; },
    hAt: function (tx, ty) { // độ cao bề mặt (ô, số thực) — quân đứng trên đó
      var m = this.map; if (!m || !this.hf) return 0;
      var cx = Math.floor(tx), cy = Math.floor(ty);
      if (cx >= 0 && cy >= 0 && cx < m.W && cy < m.H && this.bridgeAt && this.bridgeAt[cy * m.W + cx]) return .14;
      return Math.max(this._hRaw(tx, ty), WATER_Y - .14);
    },
    _hRaw: function (tx, ty) {
      var hf = this.hf, gx = (tx + MARGIN) * RES, gy = (ty + MARGIN) * RES;
      gx = Math.max(0, Math.min(hf.nx - 1.001, gx)); gy = Math.max(0, Math.min(hf.ny - 1.001, gy));
      var x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, n = hf.nx, h = hf.h;
      var a = h[y0 * n + x0], b = h[y0 * n + x0 + 1], c = h[(y0 + 1) * n + x0], d = h[(y0 + 1) * n + x0 + 1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    },

    /* ================= bản đồ: địa hình liền mạch nhấp nhô ================= */
    setMap: function (map, o) {
      o = o || {};
      this.map = map; this.mapMode = o.mode || 2; this.zones = o.zones || [];
      var tg = this.terrainG; while (tg.children.length) { var ch = tg.children.pop(); disposeObj(ch); }
      var W = map.W, H = map.H, g = map.g, self = this, i, x, y;
      var low = !!this.lowGfx;
      function T(tx, ty) { return tx < 0 || ty < 0 || tx >= W || ty >= H ? 'o' : g[ty * W + tx]; }
      // ô cầu: đường '=' cạnh sông
      var bridge = new Uint8Array(W * H);
      for (i = 0; i < W * H; i++) { if (g[i] !== '=') continue; x = i % W; y = (i / W) | 0; if (T(x - 1, y) === '~' || T(x + 1, y) === '~' || T(x, y - 1) === '~' || T(x, y + 1) === '~' || T(x - 2, y) === '~' || T(x + 2, y) === '~' || T(x, y - 2) === '~' || T(x, y + 2) === '~') bridge[i] = 1; }
      this.bridgeAt = bridge;
      // nhiễu mượt xác định
      function nz(a, b) { return Math.sin(a * .37 + Math.sin(b * .21) * 1.7) * .5 + Math.sin(b * .29 + a * .13) * .35 + Math.sin((a + b) * .71) * .15; }
      function tileH(tx, ty) {
        var t = T(tx, ty);
        if (t === 'o') {
          var dx = tx < 0 ? -tx : tx >= W ? tx - W + 1 : 0, dy = ty < 0 ? -ty : ty >= H ? ty - H + 1 : 0, dd = Math.max(dx, dy);
          var edgeT = T(Math.max(0, Math.min(W - 1, tx)), Math.max(0, Math.min(H - 1, ty)));
          if (edgeT === '~' && (dx === 0 || dy === 0)) return TER_H['~'] + Math.min(.15, dd * .01); // sông chảy tiếp ra ngoài
          return .25 + Math.min(2.6, dd * .16) + nz(tx * 1.3, ty * 1.3) * .5;
        }
        if (t === '=' && bridge[ty * W + tx]) return TER_H['~'];
        return TER_H[t] || 0;
      }
      function tileC(tx, ty) { var t = T(tx, ty); if (t === 'o') { var et = T(Math.max(0, Math.min(W - 1, tx)), Math.max(0, Math.min(H - 1, ty))); return et === '~' && (tx < 0 || tx >= W) !== (ty < 0 || ty >= H) ? TER_C['~'] : '#6fae52'; } if (t === '=' && bridge[ty * W + tx]) return TER_C['~']; return TER_C[t] || TER_C['.']; }
      // lưới đỉnh
      var nx = (W + MARGIN * 2) * RES + 1, ny = (H + MARGIN * 2) * RES + 1, N = nx * ny;
      var hh = new Float32Array(N), cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N), cc = new THREE.Color();
      for (y = 0; y < ny; y++) for (x = 0; x < nx; x++) {
        var fx = x / RES - MARGIN, fy = y / RES - MARGIN, k = y * nx + x, sum = 0, n = 0, r = 0, gg = 0, b = 0;
        // đỉnh nằm ở góc/cạnh/tâm ô → trung bình các ô chạm vào
        var xs = x % RES === 0 ? [Math.floor(fx) - 1, Math.floor(fx)] : [Math.floor(fx)], ys = y % RES === 0 ? [Math.floor(fy) - 1, Math.floor(fy)] : [Math.floor(fy)];
        xs.forEach(function (ax) { ys.forEach(function (ay) { sum += tileH(ax, ay); cc.set(tileC(ax, ay)); r += cc.r; gg += cc.g; b += cc.b; n++; }); });
        hh[k] = sum / n; cr[k] = r / n; cg[k] = gg / n; cb[k] = b / n;
      }
      // làm mượt (đồi tròn, bờ sông thoải)
      function blur(a, passes) {
        var t = new Float32Array(N);
        for (var p = 0; p < passes; p++) {
          for (var yy = 0; yy < ny; yy++) for (var xx = 0; xx < nx; xx++) {
            var s0 = 0, c0 = 0;
            for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var X = xx + ox, Y = yy + oy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue; var wgt = (ox === 0 && oy === 0) ? 4 : (ox === 0 || oy === 0) ? 2 : 1; s0 += a[Y * nx + X] * wgt; c0 += wgt; }
            t[yy * nx + xx] = s0 / c0;
          }
          a.set(t);
        }
      }
      blur(hh, 3); blur(cr, 2); blur(cg, 2); blur(cb, 2);
      // nhấp nhô + vệt màu cỏ
      for (y = 0; y < ny; y++) for (x = 0; x < nx; x++) {
        var k2 = y * nx + x, wx0 = x / RES, wy0 = y / RES, nn = nz(wx0, wy0), n2 = nz(wx0 * 2.3 + 7, wy0 * 2.1 - 3);
        if (hh[k2] > WATER_Y + .05) hh[k2] += nn * .09 + n2 * .035;
        var lt = n2 * .05 + nn * .03;
        cr[k2] = Math.max(0, cr[k2] + lt); cg[k2] = Math.max(0, cg[k2] + lt * 1.2); cb[k2] = Math.max(0, cb[k2] + lt * .5);
      }
      this.hf = { nx: nx, ny: ny, h: hh };
      // dựng mesh
      var geoT = new THREE.PlaneGeometry(W + MARGIN * 2, H + MARGIN * 2, nx - 1, ny - 1); geoT.rotateX(-PI / 2);
      var pos = geoT.attributes.position, colA = new Float32Array(N * 3);
      for (i = 0; i < N; i++) { pos.setY(i, hh[i]); }
      geoT.computeVertexNormals();
      var nor = geoT.attributes.normal, rock = col('#b0a794'), sand = col('#dccb98');
      for (i = 0; i < N; i++) {
        cc.setRGB(cr[i], cg[i], cb[i]);
        var ny0 = nor.getY(i), hv = hh[i];
        if (ny0 < .82) cc.lerp(rock, Math.min(1, (.82 - ny0) * 3.2));            // dốc đứng: lộ đá
        if (hv < WATER_Y + .12 && hv > WATER_Y - .25) cc.lerp(sand, .55);        // bờ cát
        colA[i * 3] = cc.r; colA[i * 3 + 1] = cc.g; colA[i * 3 + 2] = cc.b;
      }
      geoT.setAttribute('color', new THREE.BufferAttribute(colA, 3));
      geoT.userData.own = true;
      var terr = new THREE.Mesh(geoT, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
      terr.position.set(0, 0, 0); terr.receiveShadow = true; tg.add(terr); this.terrain = terr;
      // nước
      var hasWater = g.indexOf('~') >= 0;
      if (hasWater) {
        var wt = waterTex();
        var wm = new THREE.Mesh(new THREE.PlaneGeometry(W + MARGIN * 2, H + MARGIN * 2), new THREE.MeshStandardMaterial({ color: '#5cc3ee', map: wt, transparent: true, opacity: .8, roughness: .12, metalness: .15, emissive: '#1f78b8', emissiveIntensity: .18, depthWrite: false }));
        wm.geometry.userData.own = true; wm.rotation.x = -PI / 2; wm.position.y = WATER_Y; wm.renderOrder = 1; tg.add(wm); this.water = wm;
      } else this.water = null;
      // gom ô theo loại
      var forest = [], rocks = [], swamp = [], plain = [], bridges = [];
      for (i = 0; i < W * H; i++) { var tt = g[i]; if (tt === 'F') forest.push(i); else if (tt === '#') rocks.push(i); else if (tt === 'S') swamp.push(i); else if (tt === '=' && bridge[i]) bridges.push(i); else if (tt === '.') plain.push(i); }
      var R0 = mulberry(map.g.length * 31 + W * 7 + H), rr = function (a, b) { return a + (R0() / 4294967296) * (b - a); };
      function cx(i0) { return self.wx(i0 % W) + .5; } function cz(i0) { return self.wz((i0 / W) | 0) + .5; }
      // cây: trong rừng + hàng cây dày ngoài rìa (như Dota)
      var trees = [];
      forest.forEach(function (k0) { var n0 = R0() % 3 === 0 ? 2 : 1; for (var t = 0; t < n0; t++) trees.push([cx(k0) + rr(-.32, .32), cz(k0) + rr(-.32, .32), rr(.85, 1.25), R0() % 4 === 0 ? 1 : 0]); });
      var ringN = low ? 220 : 420, ringStart = trees.length;
      for (i = 0, x = 0; i < ringN && x < ringN * 6; x++) {
        var tx1 = rr(-MARGIN + .8, W + MARGIN - .8), ty1 = rr(-MARGIN + .8, H + MARGIN - .8);
        if (tx1 > -1.4 && tx1 < W + 1.4 && ty1 > -1.4 && ty1 < H + 1.4) continue;
        trees.push([this.wx(tx1), this.wz(ty1), rr(1, 1.75), R0() % 3 === 0 ? 1 : 0]); i++;
      }
      this._trees(trees.slice(0, ringStart), true); this._trees(trees.slice(ringStart), false);
      // đá: vách đá + đá nhỏ rải rác
      var rk = [];
      rocks.forEach(function (k0) { rk.push([cx(k0) + rr(-.2, .2), cz(k0) + rr(-.2, .2), rr(.8, 1.3), 1]); if (R0() % 2) rk.push([cx(k0) + rr(-.4, .4), cz(k0) + rr(-.4, .4), rr(.45, .75), 1]); });
      plain.forEach(function (k0) { if (R0() % 37 === 0) rk.push([cx(k0) + rr(-.4, .4), cz(k0) + rr(-.4, .4), rr(.18, .32), 0]); });
      this._rocks(rk);
      // cỏ, hoa, lau sậy (trang trí, không ảnh hưởng luật)
      if (!low) {
        var tuft = [], flower = [];
        plain.forEach(function (k0) { if (R0() % 2 === 0) tuft.push([cx(k0) + rr(-.45, .45), cz(k0) + rr(-.45, .45), rr(.7, 1.3)]); if (R0() % 9 === 0) flower.push([cx(k0) + rr(-.45, .45), cz(k0) + rr(-.45, .45), R0() % 3]); });
        forest.forEach(function (k0) { if (R0() % 2 === 0) tuft.push([cx(k0) + rr(-.45, .45), cz(k0) + rr(-.45, .45), rr(.9, 1.4)]); });
        this._tufts(tuft, flower);
      }
      if (swamp.length) this._reeds(swamp.map(function (k0) { return [cx(k0), cz(k0)]; }), R0);
      if (bridges.length) this._bridges(bridges, T);
      // tháp canh
      this.towers = (map.towers || []).map(function (tw) { return self._tower(tw); });
      this._env();
      // vùng xuất quân: lớp phủ mềm trên mặt đất (shader), không kẻ ô
      this._zoneLayer();
      var half = Math.max(W, H) / 2 + 6, sc = this.key.shadow.camera; this.mapHalf = half; this._shH = 0; sc.near = 1; sc.far = 220; sc.updateProjectionMatrix();
      this._fitCamera(true);
    },
    _trees: function (list, outline) {
      var tg = this.terrainG, n = list.length; if (!n) return;
      var trunkG = geo('trunkS', function () { var c = new THREE.CylinderGeometry(.07, .11, .7, 7); c.translate(0, .35, 0); return c; });
      var roundG = geo('crownS', function () { return blobGeo([[0, 1.0, 0, .5], [.24, .82, .1, .34], [-.22, .86, -.08, .36], [0, 1.32, .02, .34]]); });
      var pineG = geo('pineS', function () { var a = new THREE.ConeGeometry(.5, .75, 8); a.translate(0, .85, 0); var b = new THREE.ConeGeometry(.38, .62, 8); b.translate(0, 1.25, 0); var c2 = new THREE.ConeGeometry(.24, .5, 8); c2.translate(0, 1.6, 0); return mergeGeo([a, b, c2]); });
      var trunks = new THREE.InstancedMesh(trunkG, toon('#8a5a34'), n), rounds = new THREE.InstancedMesh(roundG, toon('#ffffff'), n), pines = new THREE.InstancedMesh(pineG, toon('#ffffff'), n);
      var ri = 0, pi = 0, self = this;
      var greens = ['#5fbf55', '#6fcb60', '#4fae4a', '#7ad06a'], pinkC = '#ffa8cf', pineC = ['#3f9a58', '#4aa862', '#358c50'];
      list.forEach(function (t, j) {
        var tx = t[0] + self.map.W / 2, ty = t[1] + self.map.H / 2, y0 = self._hRaw(tx, ty) - .04, s = t[2], rot = (j * 2.399) % 6.28;
        _m4.compose(_v.set(t[0], y0, t[1]), _q.setFromEuler(_e.set(0, rot, 0)), _s.set(s, s, s)); trunks.setMatrixAt(j, _m4);
        if (t[3]) { pines.setMatrixAt(pi, _m4); pines.setColorAt(pi, _c.set(pineC[j % 3])); pi++; }
        else { rounds.setMatrixAt(ri, _m4); rounds.setColorAt(ri, _c.set(j % 11 === 5 ? pinkC : greens[j % 4])); ri++; }
      });
      rounds.count = ri; pines.count = pi;
      [trunks, rounds, pines].forEach(function (m) { m.castShadow = !!outline; if (m.instanceColor) m.instanceColor.needsUpdate = true; tg.add(m); if (outline) tg.add(withOutline(m)); });
    },
    _rocks: function (list) {
      if (!list.length) return;
      var tg = this.terrainG, self = this;
      var rg = geo('rockS', function () { var d = new THREE.DodecahedronGeometry(.5, 1), p = d.attributes.position; for (var i = 0; i < p.count; i++) { var k = 1 + Math.sin(p.getX(i) * 9 + p.getZ(i) * 7) * .08; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .8, p.getZ(i) * k); } d.computeVertexNormals(); return d; });
      var m = new THREE.InstancedMesh(rg, toon('#ffffff'), list.length);
      var cols = ['#b8b3a8', '#a9a397', '#c4bfb3', '#9c978c'];
      list.forEach(function (r, j) { var tx = r[0] + self.map.W / 2, ty = r[1] + self.map.H / 2, s = r[2] * (r[3] ? 1.1 : 1); _m4.compose(_v.set(r[0], self._hRaw(tx, ty) + s * .18, r[1]), _q.setFromEuler(_e.set((j % 5) * .1, j * 1.7, (j % 3) * .08)), _s.set(s, s * (r[3] ? 1.25 : .8), s)); m.setMatrixAt(j, _m4); m.setColorAt(j, _c.set(cols[j % 4])); });
      m.castShadow = true; m.receiveShadow = true; m.instanceColor.needsUpdate = true; tg.add(m); tg.add(withOutline(m));
    },
    _tufts: function (tuft, flower) {
      var tg = this.terrainG, self = this;
      if (tuft.length) {
        var tgeo = geo('tuft', function () { var parts = []; for (var b = 0; b < 3; b++) { var c = new THREE.ConeGeometry(.035, .22, 3); c.translate(0, .11, 0); c.rotateZ((b - 1) * .35); c.rotateY(b * 2.1); c.translate((b - 1) * .04, 0, 0); parts.push(c); } return mergeGeo(parts); });
        var tm = new THREE.InstancedMesh(tgeo, toon('#ffffff'), tuft.length), gc = ['#79c25a', '#8ad468', '#68b54f', '#9bd96f'];
        tuft.forEach(function (t, j) { _m4.compose(_v.set(t[0], self._hRaw(t[0] + self.map.W / 2, t[1] + self.map.H / 2) - .01, t[1]), _q.setFromEuler(_e.set(0, j * 1.3, 0)), _s.set(t[2], t[2], t[2])); tm.setMatrixAt(j, _m4); tm.setColorAt(j, _c.set(gc[j % 4])); });
        tm.instanceColor.needsUpdate = true; tg.add(tm);
      }
      if (flower.length) {
        var fg = geo('flowerS', function () { var a = new THREE.SphereGeometry(.05, 6, 4); a.translate(0, .1, 0); var st = new THREE.CylinderGeometry(.008, .008, .1, 3); st.translate(0, .05, 0); return mergeGeo([a, st]); });
        var fm = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: '#ffffff' }), flower.length), fc = ['#ffd1e8', '#fff4a3', '#ffffff'];
        flower.forEach(function (f, j) { _m4.makeTranslation(f[0], self._hRaw(f[0] + self.map.W / 2, f[1] + self.map.H / 2), f[1]); fm.setMatrixAt(j, _m4); fm.setColorAt(j, _c.set(fc[f[2]])); });
        fm.instanceColor.needsUpdate = true; tg.add(fm);
      }
    },
    _reeds: function (cells, R0) {
      var tg = this.terrainG, self = this, W = this.map.W, H = this.map.H;
      // mặt nước đầm (đục, xanh rêu) phủ vùng trũng
      var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; cells.forEach(function (c) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); z0 = Math.min(z0, c[1]); z1 = Math.max(z1, c[1]); });
      var sw = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 3, z1 - z0 + 3), new THREE.MeshStandardMaterial({ color: '#5f8f6a', transparent: true, opacity: .82, roughness: .2, metalness: .1, emissive: '#22402c', emissiveIntensity: .25, depthWrite: false }));
      sw.geometry.userData.own = true; sw.rotation.x = -PI / 2; sw.position.set((x0 + x1) / 2, -.2, (z0 + z1) / 2); sw.renderOrder = 1; tg.add(sw);
      var picks = cells.filter(function () { return R0() % 3 === 0; }), n = picks.length * 3; if (!n) return;
      var rg = geo('reedS', function () { var c = new THREE.CylinderGeometry(.015, .025, .55, 4); c.translate(0, .27, 0); var h = new THREE.CylinderGeometry(.035, .035, .13, 5); h.translate(0, .55, 0); return mergeGeo([c, h]); });
      var m = new THREE.InstancedMesh(rg, toon('#ffffff'), n);
      picks.forEach(function (c, j) {
        for (var r = 0; r < 3; r++) { var x = c[0] + ((R0() % 100) / 100 - .5) * .7, z = c[1] + ((R0() % 100) / 100 - .5) * .7; _m4.compose(_v.set(x, -.24, z), _q.setFromEuler(_e.set((r - 1) * .14, 0, (r - 1) * .12)), _s.set(1, .8 + r * .25, 1)); m.setMatrixAt(j * 3 + r, _m4); m.setColorAt(j * 3 + r, _c.set(r ? '#7a9a42' : '#9a7a44')); }
      });
      m.instanceColor.needsUpdate = true; tg.add(m);
    },
    _bridges: function (cells, T) {
      var tg = this.terrainG, self = this, W = this.map.W;
      var plank = geo('plankS', function () { return RB(1.0, .09, .22, .03); }), post = geo('postS', function () { var c = new THREE.CylinderGeometry(.05, .06, .5, 6); c.translate(0, .2, 0); return c; });
      var pk = new THREE.InstancedMesh(plank, toon('#ffffff'), cells.length * 4), ps = new THREE.InstancedMesh(post, toon('#8a5a34'), cells.length * 2), pi = 0;
      cells.forEach(function (k, j) {
        var x = k % W, y = (k / W) | 0, ns = T(x, y - 1) === '=' || T(x, y + 1) === '=' || (T(x - 1, y) === '~' && T(x + 1, y) === '~'), cxp = self.wx(x) + .5, czp = self.wz(y) + .5;
        for (var q = 0; q < 4; q++) { var off = -.36 + q * .24; _m4.compose(_v.set(ns ? cxp : cxp + off, .1, ns ? czp + off : czp), _q.setFromEuler(_e.set(0, ns ? 0 : PI / 2, 0)), _s.set(1, 1, 1)); pk.setMatrixAt(j * 4 + q, _m4); pk.setColorAt(j * 4 + q, _c.set(q % 2 ? '#c08a52' : '#b07a46')); }
        [-1, 1].forEach(function (sd) { _m4.makeTranslation(ns ? cxp + sd * .5 : cxp, .02, ns ? czp : czp + sd * .5); ps.setMatrixAt(pi++, _m4); });
      });
      ps.count = pi; pk.instanceColor.needsUpdate = true; pk.receiveShadow = true; pk.castShadow = true;
      tg.add(pk); tg.add(withOutline(pk)); tg.add(ps); tg.add(withOutline(ps));
    },
    _tower: function (tw) {
      var self = this, gq = new THREE.Group(), x = tw[0] + .5, y = tw[1] + .5;
      gq.position.set(this.wx(x), this._hRaw(x, y) - .05, this.wz(y));
      var st = toon('#f2ead8'), st2 = toon('#cdbf9e'), roofM = toon('#5aa2ea'), add = function (g0, m, px, py, pz) { var me = new THREE.Mesh(g0, m); me.position.set(px, py, pz); me.castShadow = true; gq.add(me); gq.add(withOutline(me)); return me; };
      add(geo('twBase', function () { return new THREE.CylinderGeometry(.75, .85, .3, 14); }), st2, 0, .15, 0);
      add(geo('twBody', function () { return new THREE.CylinderGeometry(.48, .58, 1.6, 14); }), st, 0, 1.08, 0);
      add(geo('twTop', function () { return new THREE.CylinderGeometry(.66, .6, .24, 14); }), st2, 0, 1.98, 0);
      add(geo('twWin', function () { return RB(.16, .26, .06, .03); }), toon('#4a3a52'), 0, 1.25, .52);
      add(geo('twRoof', function () { return new THREE.ConeGeometry(.72, .9, 14); }), roofM, 0, 2.55, 0);
      var pole = new THREE.Mesh(geo('twp2', function () { return new THREE.CylinderGeometry(.025, .025, .8, 5); }), toon('#ffd36b')); pole.position.y = 3.25; gq.add(pole);
      var flag = new THREE.Mesh(geo('twf2', function () { var p = new THREE.PlaneGeometry(.55, .34, 4, 1); p.translate(.275, 0, 0); return p; }), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9, side: THREE.DoubleSide }));
      flag.position.y = 3.45; flag.name = 'flag'; gq.add(flag);
      var ring = new THREE.Mesh(geo('twring2', function () { var r = new THREE.RingGeometry(1.4, 1.58, 48); r.rotateX(-PI / 2); return r; }), addMat('#ffffff')); ring.position.y = .1; ring.material.opacity = .45; gq.add(ring);
      this.terrainG.add(gq); return { g: gq, flag: flag, ring: ring, team: -1 };
    },
    /* lớp phủ vùng xuất quân + ô đang trỏ: vẽ trên chính mặt đất (shader), viền mềm phát sáng */
    _zoneLayer: function () {
      var zs = this.zones.slice(0, 4), self = this, rects = [], cols = [], mine = [];
      for (var i = 0; i < 4; i++) { var z = zs[i]; if (z) { rects.push(new THREE.Vector4(this.wx(z.x0), this.wz(z.y0), this.wx(z.x1 + 1), this.wz(z.y1 + 1))); cols.push(col(z.color)); mine.push(z.mine ? 1 : 0); } else { rects.push(new THREE.Vector4(0, 0, 0, 0)); cols.push(col('#ffffff')); mine.push(-1); } }
      var mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: { rects: { value: rects }, cols: { value: cols }, mine: { value: mine }, t: { value: 0 }, show: { value: 1 }, hov: { value: new THREE.Vector4(0, 0, 0, 0) }, hovC: { value: col('#ffffff') } },
        vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'uniform vec4 rects[4]; uniform vec3 cols[4]; uniform float mine[4]; uniform float t; uniform float show; uniform vec4 hov; uniform vec3 hovC; varying vec2 vW;',
          'float sdBox(vec2 p, vec4 r){ vec2 c = (r.xy + r.zw) * .5; vec2 h = abs(r.zw - r.xy) * .5; vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }',
          'void main(){ vec3 c = vec3(0.0); float a = 0.0;',
          ' for (int i = 0; i < 4; i++) { if (mine[i] < 0.0 || show < .5) continue; float d = sdBox(vW, rects[i]); float m = mine[i];',
          '   float fill = (1.0 - smoothstep(-.2, .15, d)) * (m > .5 ? .07 + .02 * sin(t * 2.0) : .04);',
          '   float edge = (1.0 - smoothstep(0.0, .22, abs(d))) * (m > .5 ? .85 : .45);',
          '   float aa = max(fill, edge); c = mix(c, cols[i], aa / max(.001, a + aa)); a = max(a, aa); }',
          ' if (hov.w > 0.0) { float dd = length(vW - hov.xy); float ring = (1.0 - smoothstep(0.0, .09, abs(dd - hov.z))) * .95; float disk = (1.0 - smoothstep(hov.z * .6, hov.z, dd)) * .28; float ha = max(ring, disk); c = mix(c, hovC, ha / max(.001, a + ha)); a = max(a, ha); }',
          ' if (a < .01) discard; gl_FragColor = vec4(c, a); }'].join('\n')
      });
      var m = new THREE.Mesh(this.terrain.geometry, mat); m.renderOrder = 2; this.terrainG.add(m); this.zoneMesh = m;
    },
    showZones: function (on) { if (this.zoneMesh) this.zoneMesh.material.uniforms.show.value = on ? 1 : 0; },
    setTowerTeam: function (i, color) { var t = this.towers && this.towers[i]; if (!t) return; t.flag.material.color.set(color || '#ffffff'); t.ring.material.color.set(color || '#ffffff'); },
    _env: function () {
      var tg = this.terrainG, W = this.map.W, H = this.map.H;
      // mặt đất xa (nối liền mép heightmap), đồi xa, mây
      var inner = Math.min(W, H) / 2 + MARGIN - .5;
      var big = new THREE.Mesh(new THREE.RingGeometry(inner, 320, 64, 1), new THREE.MeshStandardMaterial({ color: '#73b257', roughness: 1 }));
      big.geometry.userData.own = true; big.rotation.x = -PI / 2; big.position.y = .3; tg.add(big);
      var R0 = Math.max(W, H) / 2 + MARGIN + 6, hillM = [toon('#86c46c'), toon('#7aba66'), toon('#98cf7c')];
      for (var h = 0; h < 14; h++) { var ha = h / 14 * PI * 2 + .2, hr = R0 + 10 + (h % 3) * 12, hm = new THREE.Mesh(geo('hillS2', function () { return new THREE.SphereGeometry(1, 20, 12); }), hillM[h % 3]); hm.position.set(Math.cos(ha) * hr, -2, Math.sin(ha) * hr); hm.scale.set(22 + (h % 3) * 8, 10 + (h % 2) * 6, 18); tg.add(hm); }
      this.clouds = [];
      var cm = toon('#ffffff', { transparent: true, opacity: .9 });
      for (var c = 0; c < 7; c++) {
        var cg = new THREE.Group(), cr = R0 + 14 + (c % 2) * 14, ca = c / 7 * 6.28;
        cg.position.set(Math.cos(ca) * cr, 24 + (c % 3) * 5, Math.sin(ca) * cr);
        for (var j = 0; j < 5; j++) { var cs = new THREE.Mesh(geo('cloudS2', function () { return new THREE.SphereGeometry(1, 12, 8); }), cm); cs.position.set((j - 2) * 3, Math.sin(j) * 1, (j % 2) * 2); cs.scale.set(3.4 + (j % 3), 2.2 + (j % 2), 2.6); cg.add(cs); }
        tg.add(cg); this.clouds.push({ g: cg, a: ca, r: cr, s: .004 + (c % 3) * .002 });
      }
    },

    /* ================= camera ================= */
    setView: function (side, focusZone) { this.view = side || 0; this.userAz = 0; this.azT = this._baseAz(); this.az = this.azT; this.focus = focusZone || null; this._fitCamera(true); },
    _baseAz: function () { return [0, -PI / 2, PI, PI / 2][this.view] + this.userAz; },
    _fitCamera: function (snap) {
      if (!this.map) return;
      var asp = this.cam.aspect || 1, S = Math.max(this.map.W, this.map.H);
      var R = S * 1.08 + 6; if (asp < 1) R *= .8 / Math.max(.45, asp);
      this.Rbase = R;
      var tgt = this.mode === 'battle' ? R * .8 : R, px = 0, pz = 0;
      if (this.focus && this.mode === 'battle') { tgt = R * .7; var zb = this.focus; px = this.wx((zb.x0 + zb.x1 + 1) / 2) * .32; pz = this.wz((zb.y0 + zb.y1 + 1) / 2) * .32; }
      if (this.focus && this.mode === 'prep') { tgt = R * .42; var z = this.focus; px = this.wx((z.x0 + z.x1 + 1) / 2) * .78; pz = this.wz((z.y0 + z.y1 + 1) / 2) * .78; }
      if (snap) { this.RT = this.R = tgt; this.panT = { x: px, z: pz }; this.pan = { x: px, z: pz }; }
      this.RT = Math.max(R * .2, Math.min(R * 1.3, this.RT));
    },
    resize: function () {
      var r = this.wrap.getBoundingClientRect(), w = Math.max(100, r.width), h = Math.max(100, r.height);
      this.renderer.setSize(w, h, false); this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
      if (this.composer) this.composer.setSize(w, h, false);
      var dpr = Math.min(2, G.devicePixelRatio || 1); this.ov.width = w * dpr; this.ov.height = h * dpr; this.ov.style.width = w + 'px'; this.ov.style.height = h + 'px'; this.dpr = dpr; this.vw = w; this.vh = h;
      this.cam.aspect = w / h; this.cam.fov = w / h < 1 ? 50 : 36; this.cam.updateProjectionMatrix();
      if (this.map) this._fitCamera(false);
    },
    planePoint: function (e) {
      var r = this.c.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.mouse, this.cam);
      // cắt mặt phẳng rồi chỉnh theo độ cao địa hình vài lần (mặt đất nhấp nhô)
      var v = new THREE.Vector3(), h = 0;
      for (var it = 0; it < 4; it++) { this.plane.constant = -h; if (!this.ray.ray.intersectPlane(this.plane, v)) { this.plane.constant = 0; return null; } if (!this.map) break; h = this.hAt(v.x + this.map.W / 2, v.z + this.map.H / 2); }
      this.plane.constant = 0; return v;
    },
    cellAt: function (e) { if (!this.map) return null; var p = this.planePoint(e); if (!p) return null; var x = Math.floor(p.x + this.map.W / 2), y = Math.floor(p.z + this.map.H / 2); if (x < 0 || y < 0 || x >= this.map.W || y >= this.map.H) return null; return [x, y]; },
    cellRect: function (x, y) { // toạ độ màn hình của tâm ô
      _v.set(this.wx(x) + .5, this.hAt(x + .5, y + .5), this.wz(y) + .5).project(this.cam);
      var r = this.c.getBoundingClientRect(); return { x: r.left + (_v.x + 1) / 2 * r.width, y: r.top + (1 - _v.y) / 2 * r.height };
    },
    panBy: function (dx, dy) {
      var k = this.R * .0016, az = this.az, lim = this.map ? Math.max(this.map.W, this.map.H) / 2 + 2 : 10;
      var rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az);
      this.panT.x = Math.max(-lim, Math.min(lim, this.panT.x - rx * dx * k + fx * dy * k));
      this.panT.z = Math.max(-lim, Math.min(lim, this.panT.z - rz * dx * k + fz * dy * k));
    },
    zoomBy: function (f) { this.RT = Math.max(this.Rbase * .2, Math.min(this.Rbase * 1.3, this.RT * f)); },
    resetCam: function () { this.userAz = 0; this.azT = this._baseAz(); this.el = .95; this._fitCamera(true); },
    focusAt: function (tx, ty, R) { this.panT = { x: this.wx(tx), z: this.wz(ty) }; if (R) this.RT = R; },
    _controls: function () {
      var self = this, c = this.c, drag = null, touch = null;
      c.addEventListener('pointerdown', function (e) {
        if (touch && touch.multi) return;
        var cell = e.button === 0 ? self.cellAt(e) : null;
        drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, btn: e.button, az: self.azT, el: self.el, moved: false, id: e.pointerId, cell: cell, obj: false, canObj: !!(cell && self.onDragStart) };
        try { c.setPointerCapture(e.pointerId); } catch (x) { }
      });
      this._onMove = function (e) {
        if (!drag || drag.id !== e.pointerId || (touch && touch.multi)) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 7) {
          drag.moved = true;
          if (drag.btn === 0 && drag.canObj && self.onDragStart(drag.cell, e)) { drag.obj = true; c.style.cursor = 'grabbing'; }
          else if (drag.btn === 0) c.style.cursor = 'grabbing';
        }
        if (!drag.moved) return;
        if (drag.obj) { var cell = self.cellAt(e), key = cell ? cell + '' : ''; if (key !== self._dk) { self._dk = key; if (self.onDragMove) self.onDragMove(cell, e); } }
        else if (drag.btn === 2 || e.shiftKey) {
          self.azT = drag.az - dx * .008; self.az = self.azT; self.el = Math.max(.42, Math.min(1.45, drag.el + dy * .006));
          self.userAz = self.azT - [0, -PI / 2, PI, PI / 2][self.view];
        } else self.panBy(e.clientX - drag.lx, e.clientY - drag.ly);
        drag.lx = e.clientX; drag.ly = e.clientY;
      };
      this._onUp = function (e) {
        if (drag && drag.obj) { var cell = self.cellAt(e); self._dk = ''; if (self.onDragEnd) self.onDragEnd(cell, e); }
        c.style.cursor = '';
        var d = drag; setTimeout(function () { if (drag === d) drag = null; }, 0);
      };
      G.addEventListener('pointermove', this._onMove); G.addEventListener('pointerup', this._onUp);
      c.addEventListener('click', function (e) { if (drag && drag.moved) return; var cell = self.cellAt(e); if (self.onClick) self.onClick(cell, e); });
      c.addEventListener('contextmenu', function (e) { e.preventDefault(); if (drag && drag.moved) return; if (self.onRight) self.onRight(self.cellAt(e), e); });
      c.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomBy(1 + Math.sign(e.deltaY) * .09); }, { passive: false });
      var two = function (e) { var a = e.touches[0], b = e.touches[1]; return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), ang: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX), cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 }; };
      c.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { var t = two(e); touch = { multi: true, d: t.d, ang: t.ang, cx: t.cx, cy: t.cy, R: self.RT, az: self.azT }; drag = null; } }, { passive: true });
      c.addEventListener('touchmove', function (e) {
        if (!touch || e.touches.length !== 2) return;
        var t = two(e);
        self.RT = Math.max(self.Rbase * .2, Math.min(self.Rbase * 1.3, touch.R * touch.d / t.d));
        self.azT = touch.az - (t.ang - touch.ang); self.az = self.azT; self.userAz = self.azT - [0, -PI / 2, PI, PI / 2][self.view];
        self.panBy(t.cx - touch.cx, t.cy - touch.cy); touch.cx = t.cx; touch.cy = t.cy;
      }, { passive: true });
      c.addEventListener('touchend', function (e) { if (e.touches.length < 2 && touch) setTimeout(function () { touch = null; }, 50); });
      c.addEventListener('mousemove', function (e) { if (drag && drag.moved) return; var cell = self.cellAt(e), key = cell ? cell + '' : ''; self._mx = e.clientX; self._my = e.clientY; if (key !== self._hk) { self._hk = key; if (self.onHover) self.onHover(cell, e); } else if (self.onHoverMove) self.onHoverMove(cell, e); });
      c.addEventListener('mouseleave', function () { self._hk = ''; if (self.onHover) self.onHover(null); });
      var I = TT.Icons, bar = document.createElement('div'); bar.className = 'cam-bar';
      bar.innerHTML = '<button title="Xoay trái" data-c="l">' + I.ui('rotl', 16) + '</button><button title="Xoay phải" data-c="rr">' + I.ui('rotr', 16) + '</button><button title="Phóng to" data-c="zi">' + I.ui('plus', 16) + '</button><button title="Thu nhỏ" data-c="zo">' + I.ui('minus', 16) + '</button><button title="Nhìn từ trên xuống" data-c="t">' + I.ui('top', 16) + '</button><button title="Về góc nhìn mặc định (H)" data-c="r">' + I.ui('home', 16) + '</button>';
      this.wrap.appendChild(bar); this.camBar = bar;
      bar.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.c;
          if (k === 'l') { self.userAz -= PI / 2; self.azT = self._baseAz(); }
          if (k === 'rr') { self.userAz += PI / 2; self.azT = self._baseAz(); }
          if (k === 'zi') self.zoomBy(.82); if (k === 'zo') self.zoomBy(1.2);
          if (k === 'r') self.resetCam(); if (k === 't') self.el = self.el > 1.3 ? .95 : 1.45;
        };
      });
    },
    destroy: function () {
      this.dead = true; this.ro.disconnect(); if (this.composer) this.composer.dispose(); if (this.camBar) this.camBar.remove(); if (this.ov) this.ov.remove();
      if (this._onMove) { G.removeEventListener('pointermove', this._onMove); G.removeEventListener('pointerup', this._onUp); }
      this.renderer.dispose();
    },

    /* ================= quân (instanced) ================= */
    _kind: function (key) {
      var k = this.kinds[key]; if (k) return k;
      var sp = key.split('.'), model = sp[0] === 'm' ? TT.Models.monster(sp[1]) : TT.Models.get(sp[0], sp[1], sp[2] === 'g');
      k = this.kinds[key] = { key: key, model: model, cap: 0, meshes: {}, list: [] };
      return k;
    },
    _ensureCap: function (k, n) {
      if (n <= k.cap) return;
      var cap = Math.max(8, Math.ceil(n * 1.5)), self = this;
      for (var pn in k.meshes) { this.unitG.remove(k.meshes[pn]); if (k.meshes[pn].userData.ol) this.unitG.remove(k.meshes[pn].userData.ol); k.meshes[pn].dispose(); }
      k.meshes = {};
      for (var name in k.model.parts) {
        var m = new THREE.InstancedMesh(k.model.parts[name].geo, unitMat(), cap);
        m.castShadow = true; m.frustumCulled = false; m.count = 0;
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
        k.meshes[name] = m; self.unitG.add(m);
        var ol = new THREE.InstancedMesh(k.model.parts[name].geo, outlineMat(), cap);
        ol.instanceMatrix = m.instanceMatrix; ol.frustumCulled = false; ol.count = 0; m.userData.ol = ol; self.unitG.add(ol);
      }
      k.cap = cap;
    },
    _ringMesh: function (n) {
      if (this.rings && this.rings.userData.cap >= n) return this.rings;
      if (this.rings) { this.unitG.remove(this.rings); this.rings.dispose(); }
      var cap = Math.max(64, Math.ceil(n * 1.5));
      var rg = geo('uring', function () { var r = new THREE.RingGeometry(.78, 1, 24); r.rotateX(-PI / 2); return r; });
      var m = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .85, depthWrite: false }), cap);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      m.userData.cap = cap; m.frustumCulled = false; m.renderOrder = 2; this.unitG.add(m); this.rings = m; return m;
    },
    /* Đặt danh sách quân hiển thị ở màn chuẩn bị.
       list: [{id, race, role, x, y (ô, số thực), face (rad), seat, cap, sel, ghost, sq}] */
    setPrepUnits: function (list) {
      this.mode = this.B ? this.mode : 'prep';
      var vis = {}, self = this;
      list.forEach(function (u) {
        var v = self.vis[u.id] || { walk: Math.random() * 6, ph: Math.random() * 6, atk: -9, hit: -9 };
        v.id = u.id; v.key = u.race + '.' + u.role + (u.cap ? '.g' : ''); v.x = u.x; v.y = u.y; v.px = u.x; v.py = u.y; v.face = u.face; v.seat = u.seat; v.cap = u.cap; v.sel = u.sel; v.ghost = u.ghost; v.alive = true; v.hpr = 1; v.mpr = 0; v.items = u.items || null; v.sq = u.sq; v.rad = u.rad || .35; v.race = u.race; v.role = u.role;
        vis[u.id] = v;
      });
      this.vis = vis; this.prepList = list;
    },
    clearUnits: function () { this.vis = {}; },
    /* ================= giao tranh ================= */
    startBattle: function (B, o) {
      o = o || {};
      this.B = B; this.mode = 'battle'; this.acc = 0; this.speed = o.speed || 1; this.paused = false; this.ended = false; this.onEvent = o.onEvent; this.onEnd = o.onEnd; this.seatColor = o.seatColor || TT.SEAT_COLORS;
      this.vis = {}; this.texts = [];
      var self = this;
      B.units.forEach(function (u) { self._addVis(u); });
      this.showZones(false); this._fitCamera(true);
      (this.towers || []).forEach(function (t, i) { self.setTowerTeam(i, null); });
    },
    _addVis: function (u) {
      var key = u.monster ? 'm.' + u.mkind : u.race + '.' + u.role + (u.cap ? '.g' : '');
      var items = u.cap && u.sq >= 0 && this.B && this.B.squads[u.sq] ? this.B.squads[u.sq].items : null;
      this.vis[u.id] = { items: items, mpr: u.mmp ? u.mp / u.mmp : 0, id: u.id, u: u, key: key, x: u.x / 1000, y: u.y / 1000, px: u.x / 1000, py: u.y / 1000, face: Math.atan2(u.fx, u.fy), walk: Math.random() * 6, ph: Math.random() * 6, atk: -9, hit: -9, alive: true, seat: u.seat, cap: u.cap, rad: u.rad / 1000, hpr: 1, die: 0, race: u.race, role: u.role, pop: performance.now() };
    },
    setSpeed: function (s) { this.speed = s; },
    skipBattle: function () { if (!this.B) return; var B = this.B; while (!B.ended) { B.step(); if (this.onEvent) B.events.forEach(this.onEvent); B.events = []; } this._finish(); },
    stopBattle: function () { this.B = null; this.mode = 'prep'; this.vis = {}; this.texts = []; this.showZones(true); },
    _finish: function () { if (this.ended) return; this.ended = true; var self = this; var B = this.B; B.units.forEach(function (u) { var v = self.vis[u.id]; if (v) { v.alive = u.alive; if (!u.alive && !v.die) v.die = performance.now(); v.x = v.px = u.x / 1000; v.y = v.py = u.y / 1000; } }); if (this.onEnd) setTimeout(function () { self.onEnd(B.result()); }, 600); },
    _stepBattle: function (dt) {
      var B = this.B; if (!B || this.ended || this.paused) return;
      this.acc += dt * this.speed * 20;
      var guard = 0;
      while (this.acc >= 1 && !B.ended && guard++ < 40) {
        B.step(); this.acc -= 1;
        var evs = B.events; B.events = [];
        for (var i = 0; i < evs.length; i++) { this._event(evs[i]); if (this.onEvent) this.onEvent(evs[i]); }
        // cập nhật toạ độ hiển thị
        for (var j = 0; j < B.units.length; j++) {
          var u = B.units[j], v = this.vis[u.id]; if (!v) continue;
          v.px = u.px / 1000; v.py = u.py / 1000; v.x = u.x / 1000; v.y = u.y / 1000;
          var dx = v.x - v.px, dy = v.y - v.py, d = Math.abs(dx) + Math.abs(dy);
          
          v.face = Math.atan2(u.fx, u.fy); v.hpr = u.hp / u.mhp; v.mpr = u.mmp ? u.mp / u.mmp : 0; v.shield = u.shield > 0; v.stun = u.stun > 0; v.stealth = u.stealthT > 0; v.cap = u.cap;
        }
      }
      if (this.acc > 12) this.acc = 12;
      if (B.ended) this._finish();
    },
    _wpos: function (v, frac) { var x = v.px + (v.x - v.px) * frac, y = v.py + (v.y - v.py) * frac; return _p.set(this.wx(x), this.hAt(x, y), this.wz(y)); },
    _vp: function (id, h) { var v = this.vis[id]; if (!v) return null; var p = this._wpos(v, this.acc < 1 ? this.acc : 1).clone(); p.y += h == null ? .5 : h; return p; },
    _event: function (e) {
      var now = performance.now(), self = this, budget = this.anims.length < 240;
      switch (e.e) {
        case 'atk': {
          var a = this.vis[e.a], b = this.vis[e.b]; if (!a || !b) break;
          a.atk = now;
          if (!budget && Math.random() < .6) break;
          var from = this._vp(e.a, .55), to = this._vp(e.b, .45);
          var race = a.u.monster ? 'demon' : a.race, role = a.role, fc = FXC[race] || '#ffffff';
          if (e.r) {
            var d = from.distanceTo(to), dur = Math.max(120, d / TT.CONFIG.projSpeed * 1000 / this.speed);
            if (role === 'cung') this.projectile(now, from, to, { kind: 'arrow', color: fc, arc: Math.min(1.2, d * .08), dur: dur, trail: '#fff6d0' });
            else if (role === 'congthanh') { this.projectile(now, from.clone().setY(from.y + .4), to, { kind: race === 'fairy' ? 'orb' : race === 'human' ? 'bolt' : 'rock', color: race === 'fairy' ? '#9ff7ff' : '#ff9a3a', arc: race === 'human' ? .3 : d * .18, dur: dur * 1.1, glow: 1.4, spin: 1 }); }
            else if (role === 'y') this.projectile(now, from, to, { kind: 'orb', color: race === 'demon' ? '#ff2e4d' : '#9fffb0', arc: .4, dur: dur, glow: .8 });
            else this.projectile(now, from, to, { kind: 'orb', color: fc, arc: .3, dur: dur, glow: 1 });
          } else if (budget) {
            this.slash(now + 90 / this.speed, to, fc, { s: a.u.rad > 600 ? 1.6 : .9 });
          }
          break;
        }
        case 'hit': {
          var t = this.vis[e.b]; if (!t) break;
          if (e.d > 0) { t.hit = now; this._text(e.b, (e.c ? e.d + '!' : '' + e.d), e.c ? '#ffd23a' : e.s ? '#ffffff' : '#ff6b6b', e.c ? 1.25 : e.s ? 1.05 : .85); }
          else this._text(e.b, e.m === 2 ? 'Chặn' : 'Né', '#bff7ff', .8);
          break;
        }
        case 'heal': { if (e.v > 0) { this._text(e.b, '+' + e.v, '#5dffa0', .85); if (e.k !== 'atk' && budget) { var hp = this._vp(e.b, .2); if (hp) this.particles(now, { at: hp, n: 8, color: '#8dffb4', speed: .3, up: 1.6, size: .22, dur: 700, grav: 0, star: true }); } } break; }
        case 'die': {
          var dv = this.vis[e.a]; if (!dv) break;
          dv.alive = false; dv.die = now;
          var dp = this._vp(e.a, .4); if (!dp || !budget) break;
          var dc = FXC[dv.race] || '#ffffff';
          this.particles(now, { at: dp, n: dv.rad > .6 ? 40 : 14, color: dc, speed: 1.6, up: 2.2, size: .26, dur: 800, star: true });
          if (dv.race === 'demon') this.particles(now + 120, { at: dp, n: 4, color: '#d0b0ff', speed: .2, up: 2.2, size: .45, dur: 1200, grav: -.6 });
          if (dv.rad > .6) this.shake(now, .15);
          break;
        }
        case 'sk': {
          var sv = this.vis[e.a]; if (!sv) break; sv.atk = now;
          var sp0 = this._vp(e.a, .3); if (!sp0) break;
          var sc = FXC[sv.race] || '#ffffff';
          this._text(e.a, e.n, '#ffe98a', 1.0, 1.25, true);
          this.ring(now, sp0.clone().setY(sp0.y - .25), sc, { r1: 1.2, dur: 500 });
          this.flash(now, sp0.clone().setY(sp0.y + .5), sc, 1.4, 300);
          break;
        }
        case 'area': {
          var ap = _p.set(this.wx(e.x / 1000), this.hAt(e.x / 1000, e.y / 1000) + .06, this.wz(e.y / 1000)).clone(), r = e.r / 1000, kc = FXC[e.k] || '#ffffff';
          if (e.k === 'boom') { if (budget) { this.flash(now, ap.clone().setY(ap.y + .3), '#ffb040', r * 1.6, 300); this.particles(now, { at: ap.clone().setY(ap.y + .2), n: 16, color: '#ff9a3a', speed: r * 2, up: 2, size: .28, dur: 600 }); } break; }
          this.ring(now, ap, kc, { r0: r * .3, r1: r * 1.4, dur: 650 });
          this.ring(now + 80, ap, '#ffffff', { r0: r * .2, r1: r * 1.1, dur: 500, thin: 1 });
          this.particles(now, { at: ap.clone().setY(ap.y + .3), n: Math.min(40, 10 + r * 8), color: kc, speed: r * 1.4, up: 2.2, size: .3, dur: 800, star: e.k === 'star' || e.k === 'fairy' });
          if (e.k === 'dragon') { this.flash(now, ap.clone().setY(ap.y + .5), '#ff8a2a', r * 2, 450); this.shake(now, .08); }
          if (e.k === 'curse' || e.k === 'demon' || e.k === 'blood') this.particles(now, { at: ap.clone().setY(ap.y + 1.2), n: 18, color: kc, speed: .4, up: -1.2, size: .38, dur: 900, swirl: 5, grav: 0 });
          break;
        }
        case 'cone': { var ca = this._vp(e.a, .5), ct = _p.set(this.wx(e.x / 1000), .5, this.wz(e.y / 1000)).clone(); if (!ca) break; var dir = ct.sub(ca).normalize(); var cv = this.vis[e.a]; this.particles(now, { at: ca, n: 40, color: FXC[cv ? cv.race : 'dragon'], speed: e.r / 1000 * 2.2, dir: dir, cone: .45, grav: -.3, size: .34, dur: 600, shrink: 1 }); break; }
        case 'line': { var la = this._vp(e.a, .6), lt = _p.set(this.wx(e.x / 1000), .6, this.wz(e.y / 1000)).clone(); if (!la) break; this.beam(now, la, lt.sub(la).normalize().multiplyScalar(e.r / 1000).add(la), '#fff2a0', 350); break; }
        case 'shot': { var s0 = this._vp(e.a, .6), s1 = this._vp(e.b, .45); if (!s0 || !s1) break; var shv = this.vis[e.a]; this.projectile(now, s0, s1, { kind: e.k === 'bolt' ? 'orb' : shv && shv.role === 'cung' ? 'arrow' : 'orb', color: e.k === 'bolt' ? '#bff7ff' : FXC[shv ? shv.race : 'human'], arc: .3, dur: 220 / this.speed, glow: .9 }); break; }
        case 'dash': { var x0 = this.wx(e.x0 / 1000), z0 = this.wz(e.y0 / 1000), x1 = this.wx(e.x1 / 1000), z1 = this.wz(e.y1 / 1000), dvv = this.vis[e.a]; for (var q = 0; q < 6; q++) { var k = q / 5; this._trail(new THREE.Vector3(x0 + (x1 - x0) * k, .5, z0 + (z1 - z0) * k), e.k === 'blink' ? '#6a3cb0' : FXC[dvv ? dvv.race : 'human'], .6); } if (dvv) { dvv.px = e.x1 / 1000; dvv.py = e.y1 / 1000; } break; }
        case 'fx': {
          var fp = this._vp(e.a, .1); if (!fp) break;
          if (e.k === 'shield') this.dome(now, fp, '#8ff7ff', 700);
          else if (e.k === 'buff' && budget) this.pillar(now, fp, '#ffe066', { h: 1.4, w: .5, dur: 600 });
          else if (e.k === 'rebirth') { this.pillar(now, fp, '#ffb03a', { h: 4, w: 1, dur: 1200 }); this.particles(now, { at: fp.clone().setY(fp.y + .4), n: 40, color: '#ffcf3a', speed: 1.4, up: 3, size: .3, dur: 1200, star: true }); this._text(e.a, 'Hồi sinh!', '#ffcf3a', 1.2, 1.4, true); }
          else if (e.k === 'heal') this.particles(now, { at: fp, n: 14, color: '#8dffb4', speed: .4, up: 2, size: .24, dur: 900, grav: 0, star: true });
          break;
        }
        case 'knock': { var kp = this._vp(e.a, .1); if (kp && budget) this.particles(now, { at: kp, n: 8, color: '#e2cfae', speed: 1, up: .5, size: .45, dur: 700, drag: 2, grav: -.1 }); break; }
        case 'spawn': {
          var u = this.B && this.B.byId[e.a]; if (!u) break; this._addVis(u);
          var sp2 = this._vp(e.a, 0); if (sp2) { this.pillar(now, sp2, '#c79bff', { h: 1.8, dur: 700, w: .6 }); }
          break;
        }
        case 'tower': { this.setTowerTeam(e.i, this._teamColor(e.team)); var tw = this.towers[e.i]; if (tw) this.pillar(now, tw.g.position.clone(), this._teamColor(e.team), { h: 5, w: 1.6, dur: 1200 }); break; }
        case 'order': {
          var ob = this.B; if (!ob) break;
          var pl = ob.pls.filter(function (p) { return p.seat === e.seat; })[0]; if (!pl) break;
          var cx = 0, cz = 0, n = 0; ob.units.forEach(function (uu) { if (uu.alive && uu.pl === pl.idx) { cx += uu.x; cz += uu.y; n++; } });
          if (n) { var op = new THREE.Vector3(this.wx(cx / n / 1000), .1, this.wz(cz / n / 1000)); var oc = FXC[pl.race]; for (var rr = 0; rr < 3; rr++) this.ring(now + rr * 160, op, oc, { r0: 1, r1: 8, dur: 900 }); this.pillar(now, op, oc, { h: 6, w: 1.5, dur: 1200 }); }
          break;
        }
        case 'storm': { this.stormT = now; this.stormK = e.k; break; }
      }
    },
    _teamColor: function (team) { var B = this.B; if (!B) return '#ffffff'; for (var i = 0; i < B.pls.length; i++) if (B.pls[i].team === team) return this.seatColor[B.pls[i].seat] || '#ffffff'; return '#ffffff'; },
    _text: function (id, text, color, size, h, bold) { var v = this.vis[id]; if (!v) return; if (this.texts.length > 160 && !bold) return; this.texts.push({ id: id, x: v.x, y: v.y, h: (h || 1.1) * (v.rad > .6 ? 1.6 : 1), text: text, color: color, size: size || 1, t0: performance.now(), dur: bold ? 1300 : 900, dx: rnd(-10, 10), bold: bold }); },

    /* ================= VFX (thư viện) ================= */
    _fx: function (t0, dur, init, upd, end) { this.anims.push({ k: 'fx', t0: t0, dur: dur, init: init, upd: upd, end: end }); },
    particles: function (t0, o) {
      var self = this;
      this._fx(t0, o.dur || 800, function (a) {
        var n = Math.max(1, Math.round((o.n || 24) * .7)), sz = (o.size || .22) * .55; a.vel = []; a.pos = []; a.rot = [];
        var m = new THREE.InstancedMesh(geo('pgem', function () { return new THREE.IcosahedronGeometry(.62, 0); }), new THREE.MeshBasicMaterial({ color: col(o.color), transparent: true, depthWrite: false }), n);
        m.frustumCulled = false;
        for (var i = 0; i < n; i++) {
          var p = o.at.clone(); if (o.spread) { p.x += rnd(-o.spread, o.spread); p.z += rnd(-o.spread, o.spread); }
          var v;
          if (o.dir) { v = o.dir.clone().normalize().multiplyScalar(rnd(.6, 1) * (o.speed || 3)); var cn = o.cone || .5; v.x += rnd(-1, 1) * cn; v.y += rnd(-1, 1) * cn; v.z += rnd(-1, 1) * cn; }
          else { var an = Math.random() * 6.28, sp = rnd(.3, 1) * (o.speed || 2); v = new THREE.Vector3(Math.cos(an) * sp, rnd(.2, 1) * (o.up != null ? o.up : 2), Math.sin(an) * sp); }
          a.vel.push(v); a.pos.push(p); a.rot.push(new THREE.Vector3(rnd(0, 6), rnd(0, 6), rnd(-6, 6)));
        }
        a.obj = m; a.sz = sz; a.white = o.star; self.fxG.add(m);
      }, function (a, k, dt) {
        var gr = o.grav != null ? o.grav : 4, m = a.obj, s0 = a.sz * (o.shrink ? 1 - k * .8 : 1 - k * .55);
        for (var i = 0; i < a.vel.length; i++) {
          var v = a.vel[i], p = a.pos[i], r = a.rot[i];
          p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt; v.y -= gr * dt; if (o.drag) v.multiplyScalar(1 - o.drag * dt);
          if (o.swirl) { var x = p.x - o.at.x, z = p.z - o.at.z; v.x += -z * o.swirl * dt; v.z += x * o.swirl * dt; }
          r.x += dt * 5; r.y += dt * 4;
          _m4.compose(p, _q.setFromEuler(_e.set(r.x, r.y, 0)), _s.set(s0, s0, s0)); m.setMatrixAt(i, _m4);
        }
        m.instanceMatrix.needsUpdate = true; m.material.opacity = 1 - k * k;
      });
    },
    ring: function (t0, at, color, o) {
      o = o || {}; var self = this;
      this._fx(t0, o.dur || 650, function (a) { a.obj = new THREE.Mesh(geo('fxring' + (o.thin ? 1 : 0), function () { var r = new THREE.RingGeometry(o.thin ? .86 : .68, 1, 8); r.rotateX(-PI / 2); r.rotateY(PI / 8); return r; }), addMat(color)); a.obj.position.copy(at); a.obj.position.y = Math.max(.05, at.y); self.fxG.add(a.obj); },
        function (a, k) { a.obj.scale.setScalar((o.r0 || .3) + ease(k) * ((o.r1 || 1.5) - (o.r0 || .3))); a.obj.material.opacity = (1 - k) * (o.op || .9); });
    },
    flash: function (t0, at, color, size, dur) {
      var self = this;
      this._fx(t0, dur || 350, function (a) { a.obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(color), transparent: true, depthWrite: false })); a.obj.position.copy(at); a.obj.renderOrder = 5; self.fxG.add(a.obj); },
        function (a, k) { var s = (size || 1.5) * (.4 + ease(k) * .8); a.obj.scale.set(s, s, 1); a.obj.material.opacity = 1 - k; });
    },
    pillar: function (t0, at, color, o) {
      o = o || {}; var self = this;
      this._fx(t0, o.dur || 900, function (a) { a.obj = new THREE.Mesh(geo('pillar', function () { return new THREE.CylinderGeometry(.42, .5, 1, 6, 1, true); }), addMat(color)); a.obj.position.copy(at); self.fxG.add(a.obj); },
        function (a, k) { var h = (o.h || 3) * ease(Math.min(1, k * 2)); a.obj.scale.set(o.w || 1, Math.max(.01, h), o.w || 1); a.obj.position.y = at.y + h / 2; a.obj.material.opacity = (k < .5 ? .65 : .65 * (1 - (k - .5) * 2)); });
    },
    slash: function (t0, at, color, o) {
      o = o || {}; var self = this;
      this._fx(t0, o.dur || 260, function (a) {
        a.obj = new THREE.Mesh(geo('slash', function () { return new THREE.RingGeometry(.36, .56, 24, 1, 0, PI * .85); }), addMat(color));
        a.obj.position.copy(at); a.obj.lookAt(self.cam.position); a.obj.rotateZ(rnd(-1, 1)); a.obj.scale.setScalar(o.s || 1); self.fxG.add(a.obj);
      }, function (a, k) { a.obj.rotateZ(.3); a.obj.material.opacity = 1 - k; a.obj.scale.setScalar((o.s || 1) * (1 + k * .4)); });
    },
    dome: function (t0, at, color, dur) {
      var self = this;
      this._fx(t0, dur || 900, function (a) { a.obj = new THREE.Mesh(geo('fxdome', function () { return new THREE.SphereGeometry(.6, 8, 4, 0, PI * 2, 0, PI / 2); }), addMat(color)); a.obj.position.copy(at); self.fxG.add(a.obj); },
        function (a, k) { a.obj.scale.setScalar(.4 + ease(k) * .8); a.obj.material.opacity = (1 - k) * .5; });
    },
    beam: function (t0, from, to, color, dur) {
      var self = this, d = from.distanceTo(to);
      this._fx(t0, dur || 350, function (a) { a.obj = new THREE.Mesh(geo('beam', function () { var c = new THREE.CylinderGeometry(.12, .12, 1, 8, 1, true); c.rotateX(PI / 2); c.translate(0, 0, .5); return c; }), addMat(color)); a.obj.position.copy(from); a.obj.lookAt(to); a.obj.scale.set(1, 1, d); self.fxG.add(a.obj); },
        function (a, k) { a.obj.material.opacity = (1 - k) * .9; var w = 1 + k * 1.5; a.obj.scale.set(w, w, d); });
    },
    projectile: function (t0, from, to, o) {
      var self = this, dur = o.dur || 400;
      if (this.fxG.children.length > 220) return;
      this._fx(t0, dur, function (a) {
        a.obj = new THREE.Group();
        if (o.kind === 'arrow') {
          var sh = new THREE.Mesh(geo('arw', function () { return RB(.045, .045, .55, .012); }), MAT.wood || (MAT.wood = toon('#9a6a3e'))); a.obj.add(sh); var fl = new THREE.Mesh(geo('arwf', function () { var c = RB(.12, .02, .1, .008).clone(); c.translate(0, 0, -.24); return c; }), MAT.white || (MAT.white = new THREE.MeshBasicMaterial({ color: '#ffffff' }))); a.obj.add(fl);
          var hd = new THREE.Mesh(geo('arwh', function () { var c = RB(.08, .08, .12, .02).clone(); c.rotateZ(PI / 4); c.translate(0, 0, .3); return c; }), MAT.steel || (MAT.steel = toon('#eef3f8'))); a.obj.add(hd);
        } else if (o.kind === 'rock') { a.obj.add(new THREE.Mesh(geo('boulder2', function () { return new THREE.DodecahedronGeometry(.19, 0); }), MAT.boulder || (MAT.boulder = toon('#9a8f86')))); a.spin = 1; }
        else if (o.kind === 'bolt') { a.obj.add(new THREE.Mesh(geo('bolt', function () { return RB(.09, .09, .9, .025); }), MAT.steel || (MAT.steel = toon('#eef3f8')))); }
        else { var ob = new THREE.Mesh(geo('orbS', function () { return new THREE.IcosahedronGeometry(.12, 1); }), new THREE.MeshBasicMaterial({ color: col(o.color).lerp(col('#ffffff'), .45) })); a.obj.add(ob); a.spin = 1; }
        if (o.kind !== 'arrow') { var gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(o.color), transparent: true, depthWrite: false })); gl.scale.set(o.glow || .8, o.glow || .8, 1); a.obj.add(gl); }
        self.fxG.add(a.obj); a.last = from.clone();
      }, function (a, k) {
        var p = new THREE.Vector3().lerpVectors(from, to, k); p.y += Math.sin(k * PI) * (o.arc || .4);
        a.obj.lookAt(p.x + (p.x - a.last.x), p.y + (p.y - a.last.y), p.z + (p.z - a.last.z)); a.obj.position.copy(p); if (a.spin && a.obj.children[0]) a.obj.children[0].rotation.set(k * 14, k * 10, 0);
        if (o.trail && Math.random() < .5) self._trail(p, o.trail, .2);
        a.last = p;
      });
    },
    _trail: function (p, color, s) {
      var self = this;
      this._fx(performance.now(), 350, function (a) { a.obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col(color), transparent: true, depthWrite: false })); a.obj.position.copy(p); a.obj.scale.set(s, s, 1); self.fxG.add(a.obj); },
        function (a, k) { a.obj.material.opacity = (1 - k) * .8; a.obj.scale.setScalar(s * (1 - k * .6)); });
    },
    shake: function (at, amt) { this.shakeT = at; this.shakeA = amt || .12; },
    fxAt: function (kind, tx, ty, color) { var p = new THREE.Vector3(this.wx(tx), .1, this.wz(ty)), now = performance.now(); if (kind === 'buy') { this.pillar(now, p, color || '#ffe27a', { h: 1.6, dur: 600, w: .7 }); this.particles(now, { at: p.clone().setY(.3), n: 12, color: color || '#ffe27a', speed: .7, up: 2.2, size: .2, dur: 700, star: true, grav: 1 }); } else if (kind === 'level') { this.pillar(now, p, '#ffe066', { h: 5, w: 2.4, dur: 1400 }); for (var r = 0; r < 3; r++) this.ring(now + r * 200, p, '#ffd34d', { r1: 6, dur: 900 }); this.particles(now, { at: p.clone().setY(.4), n: 60, color: '#fff2a0', speed: 2, up: 4, size: .3, dur: 1400, star: true, grav: 1.5 }); } else if (kind === 'sell') { this.particles(now, { at: p.clone().setY(.4), n: 14, color: '#ffd34d', speed: 1, up: 2, size: .22, dur: 600 }); } },

    /* ================= vẽ quân mỗi khung hình ================= */
    _drawUnits: function (now, frac) {
      var tsec = now / 1000, self = this, kinds = this.kinds, vis = this.vis, dt = Math.min(.1, (now - (this._lastDraw || now)) / 1000); this._lastDraw = now;
      for (var kk in kinds) kinds[kk].list.length = 0;
      var total = 0;
      for (var id in vis) { var v = vis[id]; if (!v.alive && v.die && now - v.die > 900) continue; var k = this._kind(v.key); k.list.push(v); total++; }
      var rings = this._ringMesh(total), ri = 0;
      for (var key in kinds) {
        var K = kinds[key], list = K.list, model = K.model;
        this._ensureCap(K, list.length);
        for (var pn in K.meshes) { K.meshes[pn].count = list.length; if (K.meshes[pn].userData.ol) K.meshes[pn].userData.ol.count = list.length; }
        for (var i = 0; i < list.length; i++) {
          var v2 = list[i], x = v2.px + (v2.x - v2.px) * frac, y = v2.py + (v2.y - v2.py) * frac;
          var wy = this.hAt(x, y), sc = model.scale * US, dieK = 0;
          if (!v2.alive && v2.die) { dieK = Math.min(1, (now - v2.die) / 800); sc *= 1 - ease(dieK) * .9; }
          if (v2.pop && now - v2.pop < 350) sc *= .4 + .6 * ease((now - v2.pop) / 350);
          // nhịp bước theo quãng đường thật mỗi khung hình → mượt ở mọi tốc độ xem
          if (v2.lx == null) { v2.lx = x; v2.ly = y; v2.mv = 0; v2.fv = v2.face || 0; }
          var dd = Math.hypot(x - v2.lx, y - v2.ly); v2.lx = x; v2.ly = y;
          if (dd > 1.5) dd = 0; // lướt/dịch chuyển: không tính bước
          var quadK = model.info.kind === 'mount' || model.info.kind === 'siege', bird = model.info.kind === 'bird';
          v2.walk += dd * (quadK ? 5.5 : 8.5);
          var tgtMv = dd > .0008 * Math.max(1, dt * 60) ? 1 : 0; v2.mv += (tgtMv - v2.mv) * Math.min(1, dt * (tgtMv ? 10 : 5));
          var mv = v2.mv, moving = mv > .05;
          // quay mặt mượt theo góc ngắn nhất
          var df = (v2.face || 0) - v2.fv; df = Math.atan2(Math.sin(df), Math.cos(df)); v2.fv += df * Math.min(1, dt * 12);
          var hopA = quadK ? .07 : .2, hs = Math.sin(v2.walk), ah = Math.abs(hs);
          // chân sáo: nảy theo |sin|, lắc lư trái–phải theo nhịp bước, bẹp khi chạm đất rồi giãn khi bật lên
          var breathe = Math.sin(tsec * 2.6 + v2.ph);
          var bob = mv * ah * hopA * sc + (1 - mv) * (breathe + 1) * .01 * sc;
          var tilt = mv * hs * (quadK ? .05 : .22) + (1 - mv) * Math.sin(tsec * 1.3 + v2.ph) * .035;
          var land = Math.pow(1 - ah, 3);
          var squash = mv * (land * (quadK ? .08 : .2) - ah * .08) + (1 - mv) * breathe * .03;
          var fly = model.info.fly ? .55 + Math.sin(tsec * 2 + v2.ph) * .14 : 0;
          // nhún tới khi ra đòn
          var atkK0 = (now - v2.atk) / (this.mode === 'battle' ? 380 / Math.max(1, this.speed * .7) : 380), lunge = atkK0 >= 0 && atkK0 < 1 ? Math.sin(atkK0 * PI) : 0;
          var fx0 = Math.sin(v2.fv) * lunge * .16 * sc, fz0 = Math.cos(v2.fv) * lunge * .16 * sc;
          if (lunge) squash -= lunge * .08;
          if (v2.drag) { wy = .5; }
          _e.set(-lunge * .18, v2.fv, dieK * 1.2 + tilt, 'YXZ');
          _m4.compose(_v.set(this.wx(x) + fx0, wy + bob + fly, this.wz(y) + fz0), _q.setFromEuler(_e), _s.set(sc * (1 + squash * .6), sc * (1 - squash), sc * (1 + squash * .6)));
          _e.order = 'XYZ';
          // màu: trúng đòn đỏ, choáng vàng, vô hình nhạt, chết xám
          var hk = now - v2.hit < 160 ? 1 : 0;
          if (!v2.alive) _c.setRGB(.55, .55, .6); else if (hk) _c.setRGB(1, .45, .45); else if (v2.stealth) _c.setRGB(.75, 1, 1); else if (v2.stun) _c.setRGB(1, 1, .55); else if (v2.ghost) _c.setRGB(.7, .85, 1); else _c.setRGB(1, 1, 1);
          var atkK = (now - v2.atk) / (this.mode === 'battle' ? 380 / Math.max(1, this.speed * .7) : 380);
          var swing = atkK >= 0 && atkK < 1 ? Math.sin(atkK * PI) : 0;
          for (var name in model.parts) {
            var part = model.parts[name], mesh = K.meshes[name], ang = 0, axis = 0;
            if (name === 'armR') { ang = model.info.kind === 'siege' ? swing * .5 : -.35 - swing * 1.7 + mv * Math.sin(v2.walk) * .45 + (1 - mv) * Math.sin(tsec * 1.6 + v2.ph) * .06; }
            else if (name === 'legL') ang = mv * Math.sin(v2.walk) * .95;
            else if (name === 'legR') ang = -mv * Math.sin(v2.walk) * .95;
            else if (name[0] === 'q') ang = mv * Math.sin(v2.walk + (part.phase ? PI : 0)) * .6;
            else if (part.cape) ang = .1 + mv * .38 + Math.sin(tsec * 3.2 + v2.ph) * (.05 + mv * .06) + lunge * .15;
            else if (part.wing) { axis = 1; var f = model.info.fly ? 4 : model.info.kind === 'mount' ? 3 : 9; ang = part.wing * (.35 + Math.sin(tsec * f + v2.ph) * (model.info.fly ? .55 : .35)); }
            if (name === 'body' && moving && model.info.kind === 'mount') { ang = mv * Math.sin(v2.walk * 2) * .05; }
            var pv = part.pivot;
            if (ang) { _m5.compose(_v.set(pv[0], pv[1], pv[2]), _q.setFromEuler(axis ? _e.set(0, ang, 0) : _e.set(ang, 0, 0)), _s.set(1, 1, 1)); _m5.premultiply(_m4); mesh.setMatrixAt(i, _m5); }
            else { _m5.makeTranslation(pv[0], pv[1], pv[2]); _m5.premultiply(_m4); mesh.setMatrixAt(i, _m5); }
            mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
          }
          // vòng chân theo màu ghế
          if (v2.alive && ri < rings.userData.cap) {
            var rr = (v2.rad || .35) * 1.25 * (v2.cap ? 1.25 : 1.05) * (v2.sel ? 1.25 : 1);
            _m4.compose(_v.set(this.wx(x), wy + .035, this.wz(y)), _q.identity(), _s.set(rr, 1, rr)); rings.setMatrixAt(ri, _m4);
            _c.set(v2.sel ? '#ffffff' : v2.cap ? '#ffd34d' : (this.seatColor || TT.SEAT_COLORS)[v2.seat] || '#ffffff'); rings.instanceColor.setXYZ(ri, _c.r, _c.g, _c.b); ri++;
          }
        }
        for (var pn2 in K.meshes) { K.meshes[pn2].instanceMatrix.needsUpdate = true; K.meshes[pn2].instanceColor.needsUpdate = true; }
      }
      rings.count = ri; rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true;
    },
    /* lớp 2D: thanh máu, chữ nổi, vòng bão */
    _drawOverlay: function (now, frac) {
      var g = this.og, dpr = this.dpr || 1, W = this.vw, H = this.vh, self = this;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      var cam = this.cam, seatC = this.seatColor || TT.SEAT_COLORS;
      // chỉ TƯỚNG có thanh: máu (màu ghế), năng lượng (xanh) và hàng biểu tượng trang bị
      var showBars = this.mode === 'battle' || this.mode === 'prep';
      if (showBars) {
        var bwBase = Math.max(22, Math.min(46, 900 / this.R));
        for (var id in this.vis) {
          var v = this.vis[id]; if (!v.alive || !v.cap || v.ghost) continue;
          var x = v.px + (v.x - v.px) * frac, y = v.py + (v.y - v.py) * frac, K = this.kinds[v.key];
          var hh = (K ? K.model.scale : 1) * US * (K && K.model.info.kind === 'mount' ? 1.5 : 1.38) + (K && K.model.info.fly ? .6 : 0);
          _v.set(this.wx(x), this.hAt(x, y) + hh, this.wz(y)).project(cam);
          if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1 || _v.y < -1.1 || _v.y > 1.1) continue;
          var sx = (_v.x + 1) / 2 * W, sy = (1 - _v.y) / 2 * H, bw = bwBase * (v.rad > .7 ? 1.3 : 1), bh = bw > 30 ? 5 : 4, x0 = sx - bw / 2;
          if (this.mode === 'battle') {
            rrect(g, x0 - 1.5, sy - 1.5, bw + 3, bh * 2 + 4, 3, 'rgba(24,22,40,.72)');
            rrect(g, x0, sy, bw * Math.max(0, v.hpr), bh, 2, seatC[v.seat] || '#9a9a9a');
            g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0, sy, bw * Math.max(0, v.hpr), 1.2);
            rrect(g, x0, sy + bh + 1, bw * Math.max(0, Math.min(1, v.mpr || 0)), bh - 1, 1.5, v.mpr >= .999 ? '#bff4ff' : '#4fb2ff');
            if (v.shield) { g.fillStyle = 'rgba(220,252,255,.95)'; g.fillRect(x0, sy - 3, bw, 1.6); }
          }
          var its = v.items; if (its && its.length) { var isz = Math.max(9, Math.min(14, bw / 3.4)), ix = sx - (its.length * (isz + 2) - 2) / 2, iy = sy + (this.mode === 'battle' ? bh * 2 + 5 : 0); for (var ii = 0; ii < its.length; ii++) { var im = itemImg(its[ii]); if (im && im.complete) g.drawImage(im, ix + ii * (isz + 2), iy, isz, isz); } }
        }
      }
      // chữ nổi
      var keep = [];
      g.textAlign = 'center'; g.lineJoin = 'round';
      for (var i = 0; i < this.texts.length; i++) {
        var t = this.texts[i], k = (now - t.t0) / t.dur; if (k >= 1) continue; keep.push(t);
        var vv = this.vis[t.id]; if (vv) { t.x = vv.px + (vv.x - vv.px) * frac; t.y = vv.py + (vv.y - vv.py) * frac; }
        _v.set(this.wx(t.x), this.hAt(t.x, t.y) + t.h + ease(k) * .8, this.wz(t.y)).project(cam);
        if (_v.z > 1) continue;
        var px = (_v.x + 1) / 2 * W + t.dx * (t.bold ? 0 : 1), py = (1 - _v.y) / 2 * H;
        var fs = Math.round((t.bold ? 15 : 13) * t.size * (k < .12 ? 1 + (1 - k / .12) * .4 : 1));
        g.font = '800 ' + fs + 'px "Baloo 2", Nunito, Arial, sans-serif';
        g.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
        g.lineWidth = 4; g.strokeStyle = 'rgba(20,24,48,.85)'; g.strokeText(t.text, px, py); g.fillStyle = t.color; g.fillText(t.text, px, py);
        g.globalAlpha = 1;
      }
      this.texts = keep;
      if (this.stormT && now - this.stormT < 700) { var a = (1 - (now - this.stormT) / 700) * .35; var gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); gr.addColorStop(0, 'rgba(255,40,60,0)'); gr.addColorStop(1, 'rgba(255,40,60,' + a + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      if (this.overlayHook) this.overlayHook(g, W, H);
    },
    /* chiếu toạ độ ô → màn hình (cho lớp giao diện) */
    project: function (tx, ty, h) { _v.set(this.wx(tx), (h || 0) + this.hAt(tx, ty), this.wz(ty)).project(this.cam); var r = this.c.getBoundingClientRect(); return { x: r.left + (_v.x + 1) / 2 * r.width, y: r.top + (1 - _v.y) / 2 * r.height, vis: _v.z < 1 }; },
    /* quân gần con trỏ nhất (cho tooltip) */
    unitAt: function (e, maxPx) {
      var r = this.c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = (maxPx || 26) * (maxPx || 26), frac = this.mode === 'battle' ? Math.min(1, this.acc) : 1;
      for (var id in this.vis) {
        var v = this.vis[id]; if (!v.alive) continue;
        var x = v.px + (v.x - v.px) * frac, y = v.py + (v.y - v.py) * frac, K = this.kinds[v.key];
        _v.set(this.wx(x), this.hAt(x, y) + (K ? K.model.scale * US * .5 : .5), this.wz(y)).project(this.cam);
        var sx = (_v.x + 1) / 2 * r.width, sy = (1 - _v.y) / 2 * r.height, d = (sx - mx) * (sx - mx) + (sy - my) * (sy - my);
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    },

    /* ================= highlight & cờ (màn chuẩn bị) ================= */
    setHL: function (h) {
      h = h || {};
      var g = this.hlG, self = this; while (g.children.length) { var c = g.children.pop(); if (c.geometry && c.geometry.userData.own) c.geometry.dispose(); if (c.material && !c.material.userData.shared) c.material.dispose(); }
      if (!this.map) return;
      var zu = this.zoneMesh && this.zoneMesh.material.uniforms;
      if (zu) { if (h.hover) { zu.hov.value.set(this.wx(h.hover[0]) + .5, this.wz(h.hover[1]) + .5, h.hoverR || .55, 1); zu.hovC.value.set(h.hoverOk === false ? '#ff5d5d' : (h.hoverColor || '#ffffff')); } else zu.hov.value.w = 0; }
      var disc = geo('hlDisc', function () { var r = new THREE.CircleGeometry(.42, 24); r.rotateX(-PI / 2); return r; });
      (h.cells || []).forEach(function (c) { var m2 = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color: col(c[2] || '#ffe066'), transparent: true, opacity: .35, depthWrite: false })); m2.position.set(self.wx(c[0]) + .5, self.hAt(c[0] + .5, c[1] + .5) + .05, self.wz(c[1]) + .5); m2.userData.pulse = 1; g.add(m2); });
      (h.circles || []).forEach(function (c) { var m3 = new THREE.Mesh(geo('hlRing', function () { var r = new THREE.RingGeometry(.88, 1, 48); r.rotateX(-PI / 2); return r; }), new THREE.MeshBasicMaterial({ color: col(c.color || '#ffffff'), transparent: true, opacity: .9, depthWrite: false })); m3.position.set(self.wx(c.x), self.hAt(c.x, c.y) + .07, self.wz(c.y)); m3.scale.setScalar(c.r); m3.userData.spin = 1; g.add(m3); });
      // đường cờ
      (h.paths || []).forEach(function (pth) {
        var pts = pth.pts.map(function (p) { return new THREE.Vector3(self.wx(p[0]), .25 + self.hAt(p[0], p[1]), self.wz(p[1])); });
        for (var i = 1; i < pts.length; i++) {
          var a = pts[i - 1], b = pts[i], d = a.distanceTo(b), colr = pth.cols[i - 1];
          var seg = new THREE.Mesh(geo('flagSeg', function () { var c = new THREE.CylinderGeometry(.06, .06, 1, 6); c.rotateX(PI / 2); c.translate(0, 0, .5); return c; }), new THREE.MeshBasicMaterial({ color: col(colr), transparent: true, opacity: pth.dash && pth.dash[i - 1] ? .5 : .85, depthWrite: false }));
          seg.position.copy(a); seg.lookAt(b); seg.scale.set(1, 1, d); g.add(seg);
        }
        pth.flags.forEach(function (f, i) {
          var fg = new THREE.Group(); fg.position.set(self.wx(f[0]), self.hAt(f[0], f[1]) - .02, self.wz(f[1]));
          var pole = new THREE.Mesh(geo('fpole', function () { var c = new THREE.CylinderGeometry(.03, .03, 1.4, 5); c.translate(0, .7, 0); return c; }), MAT.fpole || (MAT.fpole = toon('#8a5a34'))); fg.add(pole);
          var cloth = new THREE.Mesh(geo('fcloth', function () { var p = new THREE.PlaneGeometry(.6, .4); p.translate(.3, 1.15, 0); return p; }), new THREE.MeshBasicMaterial({ color: col(f[2]), side: THREE.DoubleSide })); fg.add(cloth);
          var base = new THREE.Mesh(geo('fbase', function () { var r = new THREE.RingGeometry(.4, .55, 24); r.rotateX(-PI / 2); return r; }), new THREE.MeshBasicMaterial({ color: col(f[2]), transparent: true, opacity: .7, depthWrite: false })); base.position.y = .05; base.userData.spin = 1; fg.add(base);
          fg.userData.flag = 1; g.add(fg);
        });
      });
    },

    /* ================= vòng lặp ================= */
    loop: function () {
      if (this.dead) return;
      requestAnimationFrame(this.loop);
      if (!this.map || (this.showcase && this.pausedShow)) return;
      var now = performance.now(), dt = Math.min(.1, (now - this.clock) / 1000); this.clock = now;
      var tsec = now / 1000, self = this;
      if (this.mode === 'battle') this._stepBattle(dt);
      if (this.showcase) this.azT += dt * .06;
      this.az += (this.azT - this.az) * Math.min(1, dt * 8);
      this.R += (this.RT - this.R) * Math.min(1, dt * 8);
      this.pan.x += (this.panT.x - this.pan.x) * Math.min(1, dt * 10); this.pan.z += (this.panT.z - this.pan.z) * Math.min(1, dt * 10);
      var shake = 0; if (this.shakeT && now - this.shakeT < 380 && now >= this.shakeT) shake = (1 - (now - this.shakeT) / 380) * (this.shakeA || .12);
      var el = this.el, Rb = this.Rbase || 40; if (!this.showcase) { var zr = Math.max(0, Math.min(1, (this.R - Rb * .2) / (Rb * .8))); el = this.el - (1 - zr) * .38; }
      this.cam.position.set(this.pan.x + Math.cos(el) * Math.sin(this.az) * this.R + rnd(-1, 1) * shake, Math.sin(el) * this.R + rnd(-1, 1) * shake, this.pan.z + Math.cos(el) * Math.cos(this.az) * this.R);
      this.cam.lookAt(this.pan.x, 0, this.pan.z);
      this.key.position.set(this.pan.x - 30, 60, this.pan.z + 40); this.key.target.position.set(this.pan.x, 0, this.pan.z);
      // bóng đổ khít vùng đang nhìn: nét hơn khi phóng to
      var sh = Math.max(12, Math.min(this.mapHalf || 60, this.R * .85)), scam = this.key.shadow.camera;
      if (Math.abs(sh - (this._shH || 0)) > .5) { this._shH = sh; scam.left = -sh; scam.right = sh; scam.top = sh; scam.bottom = -sh; scam.updateProjectionMatrix(); }
      (this.clouds || []).forEach(function (c) { c.a += c.s * dt; c.g.position.x = Math.cos(c.a) * c.r; c.g.position.z = Math.sin(c.a) * c.r; });
      (this.towers || []).forEach(function (t, i) { t.flag.rotation.y = Math.sin(tsec * 2 + i) * .35; });
      if (this.water) { this.water.material.emissiveIntensity = .16 + Math.sin(tsec * 1.5) * .05; this.water.material.map.offset.set(tsec * .012, tsec * .007); }
      if (this.zoneMesh) this.zoneMesh.material.uniforms.t.value = tsec;
      var frac = this.mode === 'battle' ? Math.min(1, this.acc) : 1;
      this._drawUnits(now, frac);
      // hiệu ứng
      this.anims.forEach(function (a) { if (now < a.t0) return; var k = Math.min(1, (now - a.t0) / a.dur); if (!a.started) { a.started = true; a.init(a); } a.upd(a, k, dt); });
      this.anims = this.anims.filter(function (a) { var done = now > a.t0 + a.dur + 20; if (done && a.obj) { if (a.obj.parent) a.obj.parent.remove(a.obj); disposeObj(a.obj); } return !done; });
      var pulse = (Math.sin(now / 230) + 1) / 2;
      this.hlG.children.forEach(function (o) { if (o.userData.pulse) o.material.opacity = .35 + pulse * .3; if (o.userData.spin) o.rotation.y = tsec * 1.2; if (o.userData.flag) o.children[1].rotation.y = Math.sin(tsec * 3) * .25; });
      if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.cam);
      this._drawOverlay(now, frac);
    }
  };

  /* ---------- màn trưng bày ở trang đăng nhập ---------- */
  TT.showcase3D = function (canvas, wrap) {
    if (!TT.webglOK || !TT.Models) return null;
    var W = 18, H = 18, g = '', i;
    for (i = 0; i < W * H; i++) { var x = i % W, y = (i / W) | 0, d = Math.hypot(x - 8.5, y - 8.5); g += d < 2.2 ? 'H' : (d > 7.6 && (x + y) % 3 === 0) ? 'F' : '.'; }
    var map = { W: W, H: H, g: g, towers: [[9, 9]] };
    var f = new Field3D(canvas, wrap, { showcase: true, lowRes: true });
    f.setMap(map, { mode: 2 }); f.el = .5; f.RT = f.R = 21; f.azT = f.az = .7; f.panT = { x: 0, z: 0 };
    var list = [], roles = ['linh', 'cung', 'ky', 'phapsu', 'y', 'thuan', 'chihuy', 'thichkhach'], big = ['thanthu', 'tuong', 'congthanh', 'thanthu'];
    TT.FACTION_ORDER.forEach(function (race, ri) {
      var ang = ri / 4 * PI * 2 + PI / 4;
      for (var k = 0; k < 4; k++) { var a = ang + (k - 1.5) * .26, r = 5.6; list.push({ id: race + k, race: race, role: roles[(k + ri * 2) % roles.length], x: 9 + Math.cos(a) * r, y: 9 + Math.sin(a) * r, face: Math.atan2(9 - (9 + Math.cos(a) * r), 9 - (9 + Math.sin(a) * r)), seat: String(ri + 1) }); }
      list.push({ id: race + 'B', race: race, role: big[ri], x: 9 + Math.cos(ang) * 3.2, y: 9 + Math.sin(ang) * 3.2, face: Math.atan2(-Math.cos(ang), -Math.sin(ang)), seat: String(ri + 1) });
    });
    f.setPrepUnits(list); f.mode = 'show';
    setInterval(function () {
      if (f.pausedShow || f.dead) return;
      var u = list[(Math.random() * list.length) | 0], v = f.vis[u.id]; if (v) v.atk = performance.now();
      f._event({ e: 'area', x: u.x * 1000, y: u.y * 1000, r: 1600, k: u.race });
    }, 1800);
    return f;
  };
})(window);
