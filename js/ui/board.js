/* Bàn cờ canvas: vẽ ô, quân, vùng sáng, hoạt ảnh (di chuyển, đạn, sát thương, hạ gục). */
(function (G) {
  'use strict';
  var TT = G.TT, E = TT.Engine, I = TT.Icons;

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
  function hexA(hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  TT.hexA = hexA;

  function Board(canvas, wrap) {
    this.c = canvas; this.wrap = wrap; this.g = canvas.getContext('2d');
    this.state = null; this.view = 0; this.hl = {}; this.anims = []; this.ghosts = []; this.shake = 0;
    this.hover = null; this.cs = 40; this.ox = 0; this.oy = 0; this.dpr = 1;
    var self = this;
    this.ro = new ResizeObserver(function () { self.resize(); });
    this.ro.observe(wrap);
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) { if (e.button === 2) return; drag = { x: e.clientX, y: e.clientY, cell: self.cellAt(e), moved: false, piece: false }; });
    this._onMove = function (e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 7) {
        drag.moved = true;
        if (drag.cell && self.onDragStart && self.onDragStart(drag.cell[0], drag.cell[1])) { drag.piece = true; var t = E.teamAt(self.state, drag.cell[0], drag.cell[1]); self.dragId = t ? t.id : null; }
      }
      if (drag.piece) { var r = self.c.getBoundingClientRect(); self.dragPos = [e.clientX - r.left, e.clientY - r.top]; var c = self.cellAt(e); self.hover = c; if (self.onDragMove) self.onDragMove(c, e); }
    };
    this._onUp = function (e) { if (drag && drag.piece) { self.dragId = null; self.dragPos = null; if (self.onDragEnd) self.onDragEnd(self.cellAt(e), e); } setTimeout(function () { drag = null; }, 0); };
    G.addEventListener('pointermove', this._onMove); G.addEventListener('pointerup', this._onUp);
    canvas.addEventListener('click', function (e) { if (drag && drag.moved) return; var c = self.cellAt(e); if (c && self.onClick) self.onClick(c[0], c[1], e); });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); if (self.onRight) self.onRight(); });
    canvas.addEventListener('mousemove', function (e) {
      var c = self.cellAt(e);
      var key = c ? c[0] + ',' + c[1] : '';
      if (key !== self._hk) { self._hk = key; self.hover = c; if (self.onHover) self.onHover(c, e); }
      else if (c && self.onHoverMove) self.onHoverMove(c, e);
    });
    canvas.addEventListener('mouseleave', function () { self.hover = null; self._hk = ''; if (self.onHover) self.onHover(null); });
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  Board.prototype = {
    setState: function (st) { this.state = st; if (!this.cs || this._W !== st.W) this.resize(); },
    setView: function (side) { this.view = side || 0; this.resize(); },
    resize: function () {
      if (!this.state) return;
      var r = this.wrap.getBoundingClientRect(), W = this.state.W;
      var size = Math.max(200, Math.min(r.width, r.height) - 8);
      this.dpr = Math.min(2, G.devicePixelRatio || 1);
      this.cs = Math.floor(size / W);
      var px = this.cs * W;
      this.c.width = px * this.dpr; this.c.height = px * this.dpr;
      this.c.style.width = px + 'px'; this.c.style.height = px + 'px';
      this._W = W;
    },
    // xoay để phe mình ở dưới
    toS: function (x, y) {
      var W = this.state.W, H = this.state.H;
      switch (this.view) { case 1: return [y, W - 1 - x]; case 2: return [W - 1 - x, H - 1 - y]; case 3: return [H - 1 - y, x]; default: return [x, y]; }
    },
    fromS: function (sx, sy) {
      var W = this.state.W, H = this.state.H;
      switch (this.view) { case 1: return [W - 1 - sy, sx]; case 2: return [W - 1 - sx, H - 1 - sy]; case 3: return [sy, H - 1 - sx]; default: return [sx, sy]; }
    },
    cellAt: function (e) {
      if (!this.state) return null;
      var r = this.c.getBoundingClientRect();
      var sx = Math.floor((e.clientX - r.left) / this.cs), sy = Math.floor((e.clientY - r.top) / this.cs);
      var c = this.fromS(sx, sy);
      return E.exists(this.state, c[0], c[1]) ? c : null;
    },
    center: function (x, y) { var s = this.toS(x, y); return [(s[0] + 0.5) * this.cs, (s[1] + 0.5) * this.cs]; },
    cellRect: function (x, y) { var r = this.c.getBoundingClientRect(), s = this.toS(x, y); return { x: r.left + s[0] * this.cs, y: r.top + s[1] * this.cs, w: this.cs }; },
    setHL: function (h) { this.hl = h || {}; },

    /* -------------- hoạt ảnh -------------- */
    play: function (prev, events, speed) {
      speed = speed || 1;
      var self = this, now = performance.now(), t = 0, cur = {};
      var D = { move: 230 / speed, atk: 260 / speed };
      events.forEach(function (ev) {
        switch (ev.e) {
          case 'move': {
            var tm = (prev && prev.teams[ev.id]) || (self.state && self.state.teams[ev.id]);
            self.anims.push({ k: 'move', id: ev.id, from: ev.from, to: ev.to, t0: now + t, dur: D.move, ghost: tm ? JSON.parse(JSON.stringify(tm)) : null, merge: ev.merge });
            t += D.move * 0.9; TT.Sound.play('move');
            break;
          }
          case 'attack': {
            self.anims.push({ k: ev.ranged ? 'shot' : 'lunge', id: ev.id, from: ev.from, to: ev.to, t0: now + t, dur: D.atk, t: ev.t });
            setTimeout(function () { TT.Sound.play(ev.ranged ? 'shoot' : 'hit'); }, t);
            t += D.atk * 0.85;
            break;
          }
          case 'dmg':
            self.anims.push({ k: 'float', x: ev.x, y: ev.y, text: ev.amt > 0 ? '−' + ev.amt : 'Chặn', color: ev.amt > 0 ? '#ff6b6b' : '#9ad', t0: now + t, dur: 900 });
            self.anims.push({ k: 'flash', x: ev.x, y: ev.y, color: '#ff4040', t0: now + t, dur: 300 });
            break;
          case 'destroy': {
            var g = prev && prev.teams[ev.id];
            self.anims.push({ k: 'die', x: ev.x, y: ev.y, team: g ? JSON.parse(JSON.stringify(g)) : { t: ev.t, o: ev.o, n: 1 }, t0: now + t, dur: 550 });
            setTimeout(function () { TT.Sound.play('die'); self.shake = 6; }, t);
            t += 120;
            break;
          }
          case 'reward':
            if (ev.x != null) self.anims.push({ k: 'float', x: ev.x, y: ev.y, text: '+' + ev.n + ev.res, color: '#ffd76a', t0: now + t + 200, dur: 1100, dy: -0.2 });
            setTimeout(function () { TT.Sound.play('coin'); }, t + 200);
            break;
          case 'buy': case 'spawn':
            self.anims.push({ k: 'flash', x: ev.x, y: ev.y, color: ev.e === 'buy' ? '#ffd76a' : '#b38cff', t0: now + t, dur: 420, ring: true });
            self.anims.push({ k: 'pop', id: ev.id, x: ev.x, y: ev.y, t0: now + t, dur: 260 });
            if (ev.e === 'buy') TT.Sound.play('buy');
            t += ev.e === 'buy' ? 40 : 160;
            break;
          case 'grow':
            self.anims.push({ k: 'float', x: ev.x, y: ev.y, text: '+1 quân', color: '#c79bff', t0: now + t, dur: 1000 });
            self.anims.push({ k: 'flash', x: ev.x, y: ev.y, color: '#a066ff', t0: now + t, dur: 500, ring: true });
            break;
          case 'fx':
            self.anims.push({ k: 'flash', x: ev.x, y: ev.y, color: ev.kind === 'fire' ? '#ff8a2a' : ev.kind === 'curse' ? '#a066ff' : ev.kind === 'roar' ? '#ff5533' : '#fff', t0: now + t, dur: 500, ring: true });
            break;
          case 'skill':
            if (ev.x != null) self.anims.push({ k: 'flash', x: ev.x, y: ev.y, color: '#0ac8b9', t0: now + t, dur: 600, ring: true });
            TT.Sound.play('skill'); t += 150;
            break;
          case 'convert': case 'sacrifice':
            self.anims.push({ k: 'flash', x: ev.x, y: ev.y, color: '#a066ff', t0: now + t, dur: 600, ring: true }); t += 150;
            break;
          case 'swap': TT.Sound.play('skill'); break;
          case 'age': TT.Sound.play('age'); break;
          case 'soul': break;
        }
      });
      return new Promise(function (res) { setTimeout(res, Math.max(0, t) + 60); });
    },

    destroy: function () { this.dead = true; this.ro.disconnect(); G.removeEventListener('pointermove', this._onMove); G.removeEventListener('pointerup', this._onUp); },
    setDragHover: function (cell) { this.hover = cell; },
    loop: function (ts) {
      if (this.dead) return;
      requestAnimationFrame(this.loop);
      if (!this.state) return;
      this.draw(performance.now());
    },

    draw: function (now) {
      var st = this.state, g = this.g, cs = this.cs, W = st.W, H = st.H, self = this;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, cs * W, cs * H);
      if (this.shake > 0.2) { g.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake); this.shake *= 0.86; }
      // nền ô
      var seatColor = {}; st.players.forEach(function (p, i) { seatColor[p.seat] = TT.SEAT_COLORS[p.seat]; });
      var spawnOwner = {}, homeOwner = {};
      st.players.forEach(function (p, i) {
        E.spawnCells(st, i).forEach(function (c) { spawnOwner[c[1] * W + c[0]] = p.seat; });
        var h = E.homeCell(st, i); homeOwner[h[1] * W + h[0]] = p.seat;
      });
      var wildSide = st.wild;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        if (!E.exists(st, x, y)) continue;
        var s = this.toS(x, y), px = s[0] * cs, py = s[1] * cs;
        var dark = (x + y) % 2 === 0;
        var grd = g.createLinearGradient(px, py, px + cs, py + cs);
        grd.addColorStop(0, dark ? '#c3d3e2' : '#f6edd6'); grd.addColorStop(1, dark ? '#aec0d2' : '#eadfc2');
        g.fillStyle = grd; g.fillRect(px, py, cs, cs);
        var idx = y * W + x, zone = this.zoneOf(x, y);
        if (zone === 'wild') { g.fillStyle = 'rgba(160,110,60,.3)'; g.fillRect(px, py, cs, cs); }
        else if (zone != null && zone >= 0) { g.fillStyle = hexA(TT.SEAT_COLORS[zone], 0.05); g.fillRect(px, py, cs, cs); }
        if (spawnOwner[idx] != null) {
          g.fillStyle = hexA(TT.SEAT_COLORS[spawnOwner[idx]], 0.28); g.fillRect(px, py, cs, cs);
        }
        g.strokeStyle = 'rgba(120,100,70,.25)'; g.lineWidth = 1; g.strokeRect(px + .5, py + .5, cs - 1, cs - 1);
        var tile = st.tiles[idx];
        if (tile) {
          var rg = g.createRadialGradient(px + cs / 2, py + cs / 2, 2, px + cs / 2, py + cs / 2, cs * .55);
          var tc = tile === 'V' ? '246,197,72' : tile === 'T' ? '226,196,107' : '76,194,122';
          rg.addColorStop(0, 'rgba(' + tc + ',.28)'); rg.addColorStop(1, 'rgba(' + tc + ',0)');
          g.fillStyle = rg; g.fillRect(px, py, cs, cs);
          var im = I.img('res' + tile, '#fff');
          if (im.complete) { g.globalAlpha = .55; g.drawImage(im, px + cs * .22, py + cs * .22, cs * .56, cs * .56); g.globalAlpha = 1; }
          if (homeOwner[idx] != null) {
            g.strokeStyle = hexA(TT.SEAT_COLORS[homeOwner[idx]], .9); g.lineWidth = 2;
            var m = 3, l = cs * .25;
            g.beginPath();
            g.moveTo(px + m, py + m + l); g.lineTo(px + m, py + m); g.lineTo(px + m + l, py + m);
            g.moveTo(px + cs - m - l, py + cs - m); g.lineTo(px + cs - m, py + cs - m); g.lineTo(px + cs - m, py + cs - m - l);
            g.stroke();
          }
        }
      }
      // viền vàng quanh bàn
      g.strokeStyle = '#d9a93a'; g.lineWidth = 3;
      for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
        if (!E.exists(st, xx, yy)) continue;
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d) {
          if (E.exists(st, xx + d[0], yy + d[1])) return;
          var a = self.center(xx, yy), b = self.center(xx + d[0], yy + d[1]);
          var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          var horiz = Math.abs(a[1] - b[1]) > 1;
          g.beginPath();
          if (horiz) { g.moveTo(mx - cs / 2, my); g.lineTo(mx + cs / 2, my); } else { g.moveTo(mx, my - cs / 2); g.lineTo(mx, my + cs / 2); }
          g.stroke();
        });
      }
      // sông giữa bàn 2 người / viền lõi bàn chữ thập
      g.save(); g.strokeStyle = 'rgba(200,170,110,.35)'; g.lineWidth = 1.5; g.setLineDash([6, 5]);
      if (st.bm === 2) { g.beginPath(); g.moveTo(0, cs * 4); g.lineTo(cs * W, cs * 4); g.stroke(); }
      else { g.strokeRect(cs * 3, cs * 3, cs * 8, cs * 8); }
      g.restore();
      // vùng sáng
      var hl = this.hl, pulse = (Math.sin(now / 220) + 1) / 2;
      (hl.spawn || []).forEach(function (c) { self.cellFx(c[0], c[1], 'rgba(255,215,106,' + (0.12 + pulse * 0.12) + ')', 'rgba(255,215,106,.8)', true); });
      (hl.moves || []).forEach(function (m) {
        var ctr = self.center(m.x, m.y);
        g.fillStyle = m.merge ? 'rgba(160,120,255,.22)' : 'rgba(10,200,185,.16)'; var s2 = self.toS(m.x, m.y); g.fillRect(s2[0] * cs + 1, s2[1] * cs + 1, cs - 2, cs - 2);
        g.fillStyle = m.merge ? 'rgba(190,150,255,.9)' : 'rgba(10,200,185,.85)'; g.beginPath(); g.arc(ctr[0], ctr[1], cs * .09, 0, 7); g.fill();
      });
      (hl.attacks || []).forEach(function (a) {
        var ctr = self.center(a.x, a.y);
        g.strokeStyle = 'rgba(255,80,80,' + (0.55 + pulse * 0.45) + ')'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(ctr[0], ctr[1], cs * (.44 + pulse * .04), 0, 7); g.stroke();
        var s3 = self.toS(a.x, a.y); g.fillStyle = 'rgba(255,60,60,.12)'; g.fillRect(s3[0] * cs, s3[1] * cs, cs, cs);
      });
      (hl.cells || []).forEach(function (c) { self.cellFx(c[0], c[1], 'rgba(10,200,185,.18)', 'rgba(10,200,185,.8)', true); });
      if (this.hover) { var hs = this.toS(this.hover[0], this.hover[1]); g.strokeStyle = 'rgba(240,230,210,.5)'; g.lineWidth = 1.5; g.strokeRect(hs[0] * cs + 1.5, hs[1] * cs + 1.5, cs - 3, cs - 3); }
      // quân
      var movingIds = {};
      this.anims.forEach(function (a) { if (a.k === 'move' && now < a.t0 + a.dur) movingIds[a.id] = movingIds[a.id] || a; });
      E.teamIds(st).forEach(function (id) {
        var t = st.teams[id], pos = self.center(t.x, t.y), scale = 1;
        var ma = self.activeAnim('move', id, now);
        if (ma) {
          var k = ease((now - ma.t0) / ma.dur), a0 = self.center(ma.from[0], ma.from[1]), b0 = self.center(ma.to[0], ma.to[1]);
          if (now < ma.t0) pos = a0; else pos = [a0[0] + (b0[0] - a0[0]) * k, a0[1] + (b0[1] - a0[1]) * k - Math.sin(k * Math.PI) * cs * .12];
        }
        var la = self.activeAnim('lunge', id, now);
        if (la && now >= la.t0) {
          var kk = Math.sin(Math.min(1, (now - la.t0) / la.dur) * Math.PI) * .32;
          var tb = self.center(la.to[0], la.to[1]), fa = self.center(la.from[0], la.from[1]);
          pos = [pos[0] + (tb[0] - fa[0]) * kk, pos[1] + (tb[1] - fa[1]) * kk];
        }
        var pa = self.activeAnim('pop', id, now);
        if (pa) scale = now < pa.t0 ? 0.01 : 0.6 + 0.4 * ease((now - pa.t0) / pa.dur) + Math.sin(Math.min(1, (now - pa.t0) / pa.dur) * Math.PI) * .12;
        if (id === self.dragId && self.dragPos) pos = self.dragPos;
        self.drawUnit(t, pos[0], pos[1], scale, 1, id === hl.select, now);
      });
      // bóng ma (đã gộp / bị diệt)
      this.anims.forEach(function (a) {
        if (now < a.t0 || now > a.t0 + a.dur) return;
        var k = (now - a.t0) / a.dur;
        if (a.k === 'move' && a.ghost && !st.teams[a.id]) {
          var a0 = self.center(a.from[0], a.from[1]), b0 = self.center(a.to[0], a.to[1]), e2 = ease(k);
          self.drawUnit(a.ghost, a0[0] + (b0[0] - a0[0]) * e2, a0[1] + (b0[1] - a0[1]) * e2, 1, 1 - k * .5, false, now);
        }
        if (a.k === 'die') { var c = self.center(a.x, a.y); self.drawUnit(a.team, c[0], c[1] + k * cs * .15, 1 + k * .3, 1 - k, false, now); }
      });
      // hiệu ứng
      this.anims.forEach(function (a) {
        if (now < a.t0 || now > a.t0 + a.dur) return;
        var k = (now - a.t0) / a.dur;
        if (a.k === 'shot') {
          var f = self.center(a.from[0], a.from[1]), to = self.center(a.to[0], a.to[1]);
          var px2 = f[0] + (to[0] - f[0]) * k, py2 = f[1] + (to[1] - f[1]) * k - Math.sin(k * Math.PI) * cs * (a.t === 'siege' ? .9 : .25);
          var col = a.t === 'mage' ? '#7fd7ff' : a.t === 'siege' ? '#ff9a3a' : '#ffe6a0';
          g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 14;
          g.beginPath(); g.arc(px2, py2, cs * (a.t === 'siege' ? .12 : .07), 0, 7); g.fill(); g.shadowBlur = 0;
        } else if (a.k === 'flash') {
          var c2 = self.center(a.x, a.y);
          g.globalAlpha = 1 - k;
          if (a.ring) { g.strokeStyle = a.color; g.lineWidth = 3; g.beginPath(); g.arc(c2[0], c2[1], cs * (.2 + k * .5), 0, 7); g.stroke(); }
          else { g.fillStyle = a.color; g.beginPath(); g.arc(c2[0], c2[1], cs * .45, 0, 7); g.fill(); }
          g.globalAlpha = 1;
        } else if (a.k === 'float') {
          var c3 = self.center(a.x, a.y);
          g.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
          g.font = '800 ' + Math.max(12, cs * .34) + 'px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center';
          g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.85)';
          var yy2 = c3[1] - cs * .2 - k * cs * .6 + (a.dy || 0) * cs;
          g.strokeText(a.text, c3[0], yy2); g.fillStyle = a.color; g.fillText(a.text, c3[0], yy2);
          g.globalAlpha = 1;
        }
      });
      this.anims = this.anims.filter(function (a) { return now < a.t0 + a.dur + 50; });
      // xem trước vị trí đi tới
      if (hl.ghost && st.teams[hl.ghost.id]) {
        var gc = this.center(hl.ghost.x, hl.ghost.y);
        this.drawUnit(Object.assign({}, st.teams[hl.ghost.id], { n: hl.ghost.k || st.teams[hl.ghost.id].n }), gc[0], gc[1], 1, .65 + pulse * .2, true, now);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
    },
    activeAnim: function (k, id, now) {
      for (var i = 0; i < this.anims.length; i++) { var a = this.anims[i]; if (a.k === k && a.id === id && now < a.t0 + a.dur) return a; }
      return null;
    },
    zoneOf: function (x, y) {
      var st = this.state;
      if (st.bm === 2) return null;
      var side = -1;
      if (y < 3) side = 2; else if (y > 10) side = 0; else if (x < 3) side = 1; else if (x > 10) side = 3;
      if (side < 0) return null;
      if (side === st.wild) return 'wild';
      return side;
    },
    cellFx: function (x, y, fill, stroke, dashed) {
      var s = this.toS(x, y), cs = this.cs, g = this.g;
      g.fillStyle = fill; g.fillRect(s[0] * cs + 1, s[1] * cs + 1, cs - 2, cs - 2);
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; if (dashed) g.setLineDash([4, 3]); g.strokeRect(s[0] * cs + 2.5, s[1] * cs + 2.5, cs - 5, cs - 5); g.setLineDash([]); }
    },
    drawUnit: function (t, cx, cy, scale, alpha, sel, now) {
      var st = this.state, g = this.g, cs = this.cs, pl = st.players[t.o];
      if (!pl) return;
      var f = TT.FACTIONS[pl.faction], sc = TT.SEAT_COLORS[pl.seat];
      var r = cs * .4 * scale;
      g.save(); g.globalAlpha = alpha;
      var resting = E.isResting(st, t);
      var acted = st.active === t.o && t.na >= t.n && !st.over;
      // bóng
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, cy + r * .78, r * .9, r * .28, 0, 0, 7); g.fill();
      // vòng chọn
      if (sel) { g.strokeStyle = '#ffd76a'; g.lineWidth = 2.5; g.shadowColor = '#ffd76a'; g.shadowBlur = 12; g.beginPath(); g.arc(cx, cy, r + 4, 0, 7); g.stroke(); g.shadowBlur = 0; }
      // thân
      var grd = g.createRadialGradient(cx - r * .3, cy - r * .35, r * .1, cx, cy, r);
      grd.addColorStop(0, hexA(f.color, 1)); grd.addColorStop(1, '#0a0d14');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.lineWidth = t.t === 'king' ? 3.5 : 2.5; g.strokeStyle = t.t === 'king' ? '#ffd76a' : sc;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      if (t.t === 'king') { g.strokeStyle = sc; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r - 3.5, 0, 7); g.stroke(); }
      if (t.t === 'beast') { g.strokeStyle = '#fff'; g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); g.arc(cx, cy, r + 2, 0, 7); g.stroke(); g.setLineDash([]); }
      var im = I.img(I.unitKey(t.t, t.job), '#ffffff');
      if (im.complete) { var s = r * 1.15; g.drawImage(im, cx - s / 2, cy - s / 2, s, s); }
      if (resting || acted) { g.fillStyle = 'rgba(5,8,12,.55)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
      if (resting) { g.fillStyle = '#bcd'; g.font = '700 ' + Math.max(9, cs * .2) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('z', cx + r * .55, cy - r * .5); }
      // số quân
      var label = t.t === 'beast' ? null : (t.n > 1 || t.t === 'worker' || t.n > 6) ? String(t.n) : null;
      if (label) {
        var br = Math.max(7, cs * .16), bx = cx + r * .72, by = cy + r * .62;
        var big = t.n > 6;
        g.fillStyle = big ? '#7a3cff' : '#0b0f17'; g.strokeStyle = big ? '#d6c2ff' : sc; g.lineWidth = 1.5;
        g.beginPath(); g.arc(bx, by, br + (label.length > 1 ? 2 : 0), 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.font = '800 ' + Math.max(9, br * 1.15) + 'px "Be Vietnam Pro",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(label, bx, by + 0.5); g.textBaseline = 'alphabetic';
      }
      if (t.t === 'beast') {
        var max = pl.faction === 'fairy' ? 2 : 3;
        for (var i = 0; i < max; i++) { g.fillStyle = i < t.hp ? '#ff5d6c' : '#333'; g.fillRect(cx - r * .6 + i * (r * 1.2 / max) + 1, cy + r + 3, r * 1.2 / max - 2, 4); }
      }
      // trạng thái
      var sts = Object.keys(t.st || {}).filter(function (k) { return !/R$/.test(k); });
      sts.slice(0, 4).forEach(function (k, i) {
        var col = { pct50: '#ff7a3a', plus: '#ffd76a', longuy: '#ff5533', haphon: '#a066ff', linhnhan: '#7fd7ff', enraged: '#ff3333', shield: '#7fffd4', curse: '#a066ff', weak: '#888', hong: '#ff9966' }[k] || '#fff';
        g.fillStyle = col; g.beginPath(); g.arc(cx - r * .8 + i * 7, cy - r * .85, 3, 0, 7); g.fill();
      });
      g.restore();
    }
  };
  TT.Board = Board;
})(window);
