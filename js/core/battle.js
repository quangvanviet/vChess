/* Tứ Tộc Kỳ Chiến 2.0 — MÔ PHỎNG GIAO TRANH XÁC ĐỊNH.
   20 tick/giây, toạ độ mili-ô, chỉ số nguyên, RNG có seed, duyệt theo id tăng dần.
   create(input) → B; B.step() mỗi tick (trả false khi xong); B.result(). */
(function (G) {
  'use strict';
  var TT = G.TT, CFG = TT.CONFIG;
  var T = 20, M = 1000;
  var TER = { '.': 0, 'F': 1, 'H': 2, '~': 3, 'S': 4, '=': 5, '#': 6, 'T': 7 };
  var TSPD = [100, 90, 85, 65, 70, 115, 0, 100];
  var TCOST = [10, 12, 12, 16, 15, 8, 0, 10];
  var ROLEPRI = { thichkhach: 'back', ky: 'back' };
  var floor = Math.floor;
  function sec(s) { return Math.round(s * T); }
  function mil(t) { return Math.round(t * M); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var Battle = TT.Battle = {};

  Battle.create = function (inp) {
    var B = {
      inp: inp, tick: 0, W: inp.map.W, H: inp.map.H, units: [], squads: [], pls: [], proj: [], events: [], spawnQ: [],
      rng: TT.mulberry(TT.hash32(inp.seed, 'battle', inp.day)), fields: {}, ended: false, elimAt: {}, elimHp: {}, storm: 0, log: [],
      towers: (inp.map.towers || []).map(function (t) { return { x: t[0], y: t[1], team: -1, cap: -1, capT: 0 }; }),
      maxTick: CFG.battleMaxSec * T, nid: 1
    };
    var g = inp.map.g; B.grid = new Uint8Array(B.W * B.H);
    for (var i = 0; i < g.length; i++) B.grid[i] = TER[g[i]] || 0;
    B.R = function (n) { return n > 0 ? B.rng() % n : 0; };
    // người chơi
    inp.players.forEach(function (p, idx) {
      var cf = {}; (p.cores || []).forEach(function (c) { var C = TT.CORES[c]; if (C) cf[c] = C; });
      var pl = {
        idx: idx, seat: String(p.seat), side: p.side, team: p.team, race: p.race, talent: p.talent, lv: p.lv, cores: cf, name: p.name, mar: R_MAR(p),
        souls: 0, soulMax: 25 + (cf.honchu2 ? 10 : 0), deaths: 0, engaged: false, used: [false, false, false], totalMax: 0,
        kills: 0, mkills: 0, dmg: 0, taken: 0, healed: 0, towerAtk: 0, itemsTotal: 0, out: false
      };
      (p.squads || []).forEach(function (q) { pl.itemsTotal += q.it.length; });
      B.pls.push(pl);
    });
    inp.players.forEach(function (p, idx) { var pl = B.pls[idx]; (p.squads || []).forEach(function (q) { spawnSquad(B, pl, q); }); });
    // quái trung lập
    if (inp.monster) spawnMonsters(B, inp.monster);
    B.pls.forEach(function (pl) { pl.totalMax = 0; B.units.forEach(function (u) { if (u.pl === pl.idx) pl.totalMax += u.mhp; }); });
    // Long Uy (Lõi): choáng sợ đầu trận
    B.pls.forEach(function (pl) {
      if (!pl.cores.longuy) return;
      var src = B.units.filter(function (u) { return u.pl === pl.idx; });
      B.units.forEach(function (e) { if (!isEnemy(B, src[0] || {}, e) || e.pl === pl.idx) return; for (var k = 0; k < src.length; k++) if (d2(src[k], e) <= sq(mil(4))) { e.stun = Math.max(e.stun, sec(1.5)); break; } });
      B.events.push({ e: 'order', seat: pl.seat, n: 'Long Uy Tuyệt Đối' });
    });
    B.step = function () { return step(B); };
    B.run = function (lim) { lim = lim || 99999; while (!B.ended && lim-- > 0) step(B); return B.result(); };
    B.result = function () { return result(B); };
    return B;
  };

  function R_MAR(p) { return p.mar ? TT.marshalOf(p.race, p.mar) : null; }
  function sq(v) { return v * v; }
  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
  function dist(a, b) { return TT.isqrt(d2(a, b)); }
  function isEnemy(B, a, b) { if (a.team === b.team) return false; return true; }
  function cellOf(B, x, y) { var cx = clamp(floor(x / M), 0, B.W - 1), cy = clamp(floor(y / M), 0, B.H - 1); return cy * B.W + cx; }
  function terAt(B, x, y) { return B.grid[cellOf(B, x, y)]; }
  function passable(B, cx, cy) { return cx >= 0 && cy >= 0 && cx < B.W && cy < B.H && B.grid[cy * B.W + cx] !== 6; }

  /* ---------------- dựng quân ---------------- */
  function sumFx(target, fx, scale) { for (var k in fx) { var v = fx[k]; if (typeof v === 'number') target[k] = (target[k] || 0) + floor(v * (scale || 100) / 100); else target[k] = v; } }
  function coreApplies(C, role, race) {
    var s = C.scope, R = TT.ROLES[role];
    if (s === 'all') return true;
    if (s === 'econ') return false;
    if (s.indexOf('cls:') === 0) return R.cls === s.slice(4);
    if (s.indexOf('role:') === 0) return role === s.slice(5);
    if (s.indexOf('race:') === 0) return race === s.slice(5) && (!C.fx.roleOnly || C.fx.roleOnly === role);
    return false;
  }
  function makeUnit(B, pl, sqd, role, opts) {
    opts = opts || {};
    var race = opts.race || pl.race, R = TT.ROLES[role], f = TT.FACTIONS[race].mods, ud = TT.UNITS[race + '.' + role] || {};
    if (R.marshal && pl && pl.mar) ud = { name: pl.mar.name, ps: pl.mar.ps, sk: ud.sk, psd: pl.mar.psd };
    var a = { hpPct: f.hp - 100, atkPct: f.atk - 100, defPct: f.def - 100, asPct: f.as - 100, spdPct: f.spd - 100, mpGain: f.mpGain - 100, dodge: R.dodge + (f.dodge || 0), ls: f.ls || 0, crit: R.crit, critDmg: 150, armorPen: 0, mp0: R.mp0, hp: 0, atk: 0, def: 0, rngAdd: 0, skillDmg: 0, healPct: 0, reflect: 0, regen: R.regen, dr: 0 };
    var fx = {}, ps = ud.ps || {};
    if (!opts.monster) {
      var tal = pl.talent;
      if (tal === 'vaythep') a.def += 8; if (tal === 'kyluat') a.hpPct += 10; if (tal === 'tinhlinh') a.mpGain += 20; if (tal === 'huyetam') a.ls += 6;
      if (tal === 'longdiem' && R.cls === 'xa') fx.burnOnHit = { pct: 15, dur: 2 };
      if (race === 'beast') { fx.ccAdd = (fx.ccAdd || 0) + (tal === 'kimkep' ? 30 : 15); fx.huntP = (fx.huntP || 0) + (tal === 'sanmoi' ? 20 : 12); if (tal === 'longday') { a.hpPct += 10; fx.tenacity = (fx.tenacity || 0) + 20; } }
      var night = B.inp.day % 2 === 0;
      if ((!night && (race === 'dragon' || race === 'human')) || (night && (race === 'fairy' || race === 'demon'))) a.atkPct += 4;
      if (B.inp.event === 'cuongphong') { a.asPct += 15; a.hpPct -= 10; }
      if (B.inp.weather === 'gio') a.dodge += 4;
      if (B.inp.weather === 'mua' && R.cls === 'xa') a.asPct -= 10;
      for (var cid in pl.cores) { var C = pl.cores[cid]; if (coreApplies(C, role, race)) sumFx(a, C.fx), sumFx(fx, C.fx); }
      if (pl.cores.thuonghoi) { var pi = Math.min(20, pl.itemsTotal * 2); a.atkPct += pi; a.hpPct += pi; }
      if (pl.cores.doanket && sqd && sqd.n0 >= 8) { a.atkPct += 15; a.defPct += 15; a.hpPct += 15; }
      // trang bị
      var imul = 100 + (race === 'human' ? (tal === 'renkhi' ? 30 : 15) : 0) + (pl.cores.thankhi ? 25 : 0);
      if (sqd) {
        sqd.items.forEach(function (k) { var I = TT.ITEMS[k]; if (I.aura) sumFx(a, I.aura, imul); });
        if (race === 'human') a.atkPct += 2 * sqd.items.length;
        if (opts.cap) sqd.items.forEach(function (k) { var I = TT.ITEMS[k]; if (I.st) sumFx(a, I.st, imul); if (I.fx) sumFx(fx, I.fx); });
      }
      if (ps.dodgeAdd) a.dodge += ps.dodgeAdd;
      if (pl.mar && pl.mar.mods) { var MM = pl.mar.mods; if (R.marshal) { a.hpPct += MM.hp || 0; a.atkPct += MM.atk || 0; a.defPct += MM.def || 0; a.asPct += MM.as || 0; a.spdPct += MM.spd || 0; } }
    }
    // nâng cấp lính (Vàng): chỉ áp cho lính thường của đạo quân, không áp cho tướng/quân triệu hồi
    if (sqd && sqd.up && !opts.cap && !opts.temp && !opts.monster) CFG.solUp.stats.forEach(function (S, i) { var v = (sqd.up[i] | 0) * S.pct; if (S.k === 'hp') a.hpPct += v; else if (S.k === 'atk') a.atkPct += v; else if (S.k === 'def') a.defPct += v; else a.asPct += v; });
    // ánh xạ chỉ số phẳng / phần trăm
    a.hpPct += a.hpPct2 || 0;
    var pct = opts.pct || 100, mon = opts.monster;
    var hp = mon ? mon.hp : floor((R.hp + a.hp) * (100 + a.hpPct) / 100);
    var atk = mon ? mon.atk : floor((R.atk + a.atk) * (100 + a.atkPct) / 100);
    var def = mon ? mon.def : floor((R.def + a.def) * (100 + a.defPct) / 100);
    hp = Math.max(1, floor(hp * pct / 100)); atk = Math.max(1, floor(atk * pct / 100));
    var gen = opts.cap && !mon && !opts.temp, GC = CFG.gen;
    if (gen) { hp = floor(hp * GC.hp / 100); atk = floor(atk * GC.atk / 100); def = floor(def * GC.def / 100); }
    var u = {
      id: B.nid++, pl: pl ? pl.idx : -1, seat: pl ? pl.seat : '0', team: pl ? pl.team : -1, sq: sqd ? sqd.idx : -1, role: role, race: race,
      cls: R.cls, cap: !!opts.cap, temp: !!opts.temp, monster: !!mon, mkind: mon ? mon.model : null, name: mon ? mon.name : (ud.name || R.name),
      x: 0, y: 0, px: 0, py: 0, fx: 0, fy: -M, rad: mil(R.rad * (gen ? GC.rad / 100 : 1)), fly: !!ps.flying, pass: !!(ps.flying || ps.passThrough),
      hp: hp, mhp: hp, atk: atk, def: def, as: Math.max(20, floor(R.as * 100 * (100 + a.asPct) / 100)),
      spd: Math.max(10, floor(R.spd * M * (100 + a.spdPct) / 100 / T)), rng: mil(R.rng + a.rngAdd + (ps.rangeAdd || 0)),
      mp: 0, mmp: R.mp, crit: a.crit, critDmg: a.critDmg, dodge: a.dodge, ls: a.ls, pen: fx.armorPen || 0, regen: race === 'demon' ? 0 : a.regen,
      mpGain: 100 + a.mpGain, skillDmg: fx.skillDmg || 0, healPct: fx.healPct || 0, reflect: fx.reflect || 0, idr: fx.dr || 0, dt: R.dt === 'magic' ? 1 : 0,
      splash: R.splash ? mil(R.splash + (a.splashAdd || 0)) : 0, pop: R.pop,
      cd: 0, castT: 0, tgt: -1, tgtT: 0, lastHit: -1, moved: 0, standT: 0, kiteT: 0, kx: 0, ky: 0, hits: 0, firstT: -999, stackK: 0,
      stun: 0, rootT: 0, silT: 0, airT: 0, slowP: 0, slowT: 0, slowAsP: 0, slowAsT: 0, burnD: 0, burnT: 0, burnS: -1, shield: 0, shieldT: 0, tauntBy: -1, tauntT: 0,
      stealthT: 0, block: 0, blockT: 0, vulnP: 0, vulnT: 0, weakP: 0, weakT: 0, shredP: 0, shredT: 0, antiP: 0, antiT: 0, adS: 0, adT: 0,
      buffs: [], bs: null, au: null, ps: ps, sk: (gen || mon) ? (ud.sk || null) : null, ifx: fx, alive: true, revive: 0, rebirth: !!ps.rebirth, lowHealUsed: false,
      dmgDone: 0, dmgTaken: 0, healDone: 0, kills: 0, spawnX: 0, spawnY: 0
    };
    if (!gen && !mon) u.mmp = 0; // chỉ tướng có năng lượng và kỹ năng
    if (mon) { u.as = 80; u.spd = floor(2.2 * M / T); u.rng = mil(mon.role === 'thanthu' ? 2 : 1.2); u.mmp = 0; u.regen = 0; u.rad = mil(mon.role === 'linh' ? .4 : mon.role === 'tuong' ? .8 : 1.3); }
    if (R.marshal && gen) { // Nguyên soái: kỹ năng Triệu hồi theo loại lính đã chọn; MP cần đầy tùy loại lính, hồi MP đều mỗi giây
      var MC = CFG.marshal, smk = (sqd && sqd.sm) || 'linh', S0 = MC.summon[smk] || MC.summon.linh;
      u.mmp = Math.max(10, floor(S0.mp * (100 - Math.min(60, fx.summonMp || 0)) / 100));
      u.sk = { name: 'Triệu Hồi', fx: [{ t: 'summon', marshal: 1, role: MC.summon[smk] ? smk : 'linh', n: S0.n + (fx.summonN || 0), pct: S0.pct + (fx.summonPct || 0) }] };
      u.mpRegen = MC.mpRegen + (fx.mpRegen || 0); u.marshal = true;
      if (pl.mar && pl.mar.act) { u.act = pl.mar.act; u.actCd = sec(3); }
    }
    var mp0 = a.mp0 + (fx.mpStartPct ? floor(u.mmp * fx.mpStartPct / 100) : 0); u.mp = Math.min(u.mmp, mp0);
    if (fx.revive) u.revive = fx.revive;
    if (opts.cap && !mon && pl && (pl.talent === 'batdiet' && race === 'demon')) u.revive = Math.max(u.revive, 30);
    if (opts.cap && pl && pl.cores.thiengioi) u.revive = Math.max(u.revive, 30);
    // Linh Khí của Tiên
    if (race === 'fairy' && !mon && !opts.temp) u.stealthT = sec(1.5 + (pl.talent === 'linhan' ? 2 : 0) + (ps.stealthStart || 0));
    if (race === 'fairy' && pl && pl.talent === 'phongthan') u.buffs.push({ as: 20, spd: 20, t: sec(6) });
    if (ps.healAtk || ps.drainHeal) u.healer = 1;
    if (fx.startShield) { u.shield = floor(u.mhp * fx.startShield / 100); u.shieldT = sec(6); }
    u.mid = R.marshal && pl && pl.mar ? pl.mar.id : ''; u.huntP = fx.huntP || 0; u.ccAdd = fx.ccAdd || 0;
    return u;
  }
  function placeFree(B, x, y) {
    var cx = floor(x / M), cy = floor(y / M);
    if (passable(B, cx, cy)) return [clamp(x, 300, B.W * M - 300), clamp(y, 300, B.H * M - 300)];
    for (var r = 1; r < 6; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (passable(B, cx + dx, cy + dy)) return [(cx + dx) * M + 500, (cy + dy) * M + 500];
    return [x, y];
  }
  function spawnSquad(B, pl, q) {
    var R = TT.ROLES[q.t]; if (!R) return;
    var sqd = { idx: B.squads.length, id: q.id, pl: pl.idx, seat: pl.seat, team: pl.team, role: q.t, n0: q.n, items: q.it.slice(), up: (q.up || [0, 0, 0, 0]).slice(), st: q.st || 'tc', fm: q.fm || 'khoi', lp: q.lp == null ? 4 : q.lp, fl: (q.fl || []).slice(), sm: q.sm || null, step: 0, phase: 0, waitT: 0, blockT: 0, lastD: 1e12, breakT: 0,
      ax: q.x * M + 500, ay: q.y * M + 500, cx: 0, cy: 0, alive: 0, hp: 0, mhp: 0, units: [], dmg: 0, taken: 0, healed: 0, kills: 0, name: TT.unitName(pl.race, q.t), done: false };
    B.squads.push(sqd);
    var pos = formation(B, pl.side, q.t, q.n, sqd.ax, sqd.ay, q.fm, q.lp, q.sp, q.cu), fwd = TT.sideFwd[pl.side];
    for (var i = 0; i < q.n; i++) {
      var u = makeUnit(B, pl, sqd, q.t, { cap: i === 0 });
      u.x = u.px = pos[i][0]; u.y = u.py = pos[i][1]; u.fx = fwd[0] * M; u.fy = fwd[1] * M; u.spawnX = u.x; u.spawnY = u.y;
      B.units.push(u); sqd.units.push(u);
    }
  }
  /* ---------- Hình dạng đội hình ----------
     shapeLocal trả về n điểm [ngang, sâu] (mili-ô; sâu 0 = hàng đầu, tăng dần ra sau; ngang âm = bên trái) đã căn tâm khung bao,
     điểm số 0 luôn là TƯỚNG (đặt ở ô lp của lưới 3×3: 0..8 theo hàng trước→sau, trái→phải). Chỉ dùng số nguyên → mọi máy như nhau. */
  function shapeRaw(fm, n, sp) {
    var o = [], i, r, c;
    function rows(widths) { for (r = 0; r < widths.length && o.length < n; r++) for (c = 0; c < widths[r] && o.length < n; c++) o.push([floor((c - (widths[r] - 1) / 2) * sp), r * sp]); }
    function grid(cols) { var w = []; for (var k = 0; k < n; k += cols) w.push(Math.min(cols, n - k)); rows(w); }
    function tri(up) { var b = 1; while (b * (b + 1) / 2 < n) b++; var w = []; for (var k = 0; k < b; k++) w.push(up ? k + 1 : b - k); rows(w); }
    function ringAt(cnt, rad, a0) { for (var k = 0; k < cnt && o.length < n; k++) { var a = a0 + floor(k * 6283 / cnt); o.push([floor(rad * icos(a) / 1000), floor(rad * isin(a) / 1000)]); } }
    switch (fm) {
      case 'ngang': grid(Math.min(n, 24)); break;
      case 'doc': grid(Math.max(1, Math.ceil(n / 16))); break;
      case 'vuong': grid(Math.max(1, Math.ceil(Math.sqrt(n)))); break;
      case 'chunhat': grid(Math.max(1, Math.ceil(Math.sqrt(n * 2.6)))); break;
      case 'non': tri(true); break;
      case 'tamgiac': tri(false); break;
      case 'chuv': { o.push([0, 0]); for (i = 1; o.length < n; i++) { o.push([-i * sp, i * sp]); if (o.length < n) o.push([i * sp, i * sp]); } break; }
      case 'tron': { o.push([0, 0]); var k = 1; while (o.length < n) { var rad = k * sp, cnt = Math.max(6, floor(6.283 * rad / sp)); ringAt(Math.min(cnt, n - o.length), rad, k * 700); k++; } break; }
      case 'vong': { o.push([0, 0]); var k2 = 1, left = n - 1; while (left > 0) { var rd = (k2 + 1) * sp, ct = Math.max(6, floor(6.283 * rd / sp)), take = Math.min(ct, left); for (i = 0; i < take; i++) { var a = k2 * 500 + floor(i * 6283 / take); o.push([floor(rd * icos(a) / 1000), floor(rd * isin(a) / 1000)]); } left -= take; k2++; } break; }
      case 'cung': case 'vom': { // cung: một hàng cong lồi về phía trước; vòm: nhiều lớp cong đồng tâm
        var layers = fm === 'vom' ? Math.max(2, Math.min(4, Math.ceil(n / 8))) : Math.max(1, Math.ceil(n / 26)), per = Math.ceil(n / layers);
        var R0 = Math.max(floor(per * sp / 2.618), sp * 2), Cy = R0 + layers * sp;
        for (var L = 0; L < layers; L++) {
          var cntL = Math.min(per, n - o.length), Rr = R0 + L * sp;
          for (i = 0; i < cntL; i++) { var th = cntL > 1 ? -1309 + floor(i * 2618 / (cntL - 1)) : 0; o.push([floor(Rr * isin(th) / 1000), Cy - floor(Rr * icos(th) / 1000)]); }
        }
        break;
      }
      default: { var cols = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(n * 1.6)))); grid(cols); }
    }
    return o;
  }
  function shapeLocal(fm, n, sp, lp) {
    var pts = shapeRaw(fm, n, sp), i;
    if (!pts.length) return pts;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    var cx = floor((x0 + x1) / 2), cy = floor((y0 + y1) / 2);
    pts = pts.map(function (p) { return [p[0] - cx, p[1] - cy]; });
    var g = 0;
    if (fm === 'vong' || (fm === 'tron' && lp === 4)) g = 0;       // tướng ở tâm vòng
    else {
      lp = lp == null ? 4 : lp | 0; var col = lp % 3, row = floor(lp / 3);
      var tx = floor((x0 - cx) + (x1 - x0) * col / 2), ty = floor((y0 - cy) + (y1 - y0) * row / 2), bd = 1e18;
      for (i = 0; i < pts.length; i++) { var dd = sq(pts[i][0] - tx) + sq(pts[i][1] - ty); if (dd < bd) { bd = dd; g = i; } }
    }
    if (g) { var t = pts[0]; pts[0] = pts[g]; pts[g] = t; }
    return pts;
  }
  /* vị trí từng quân trong đội hình, hướng về phía địch (dùng cả cho màn chuẩn bị). Tướng đứng đúng ô đặt (ax, ay) */
  /* Bố trí cục bộ quanh tướng (tướng ở [0,0]; x = ngang, y = lùi về phía sau; đơn vị mili-ô).
     spPct: giãn cách lính (%, 100 = mặc định, đã rộng hơn trước 30%); cu: vị trí tự kéo của từng lính [[x,y]…] theo 1/100 ô. */
  function layoutLocal(role, n, fm, lp, spPct, cu) {
    var R = TT.ROLES[role], sp = floor(mil(R.rad * 2 + .14) * 12 * (spPct || 100) / 1000), pts = shapeLocal(fm || 'khoi', n, sp, lp), g = pts[0], out = [], gap = floor(sp * 1.9), gap2 = sq(gap);
    for (var i = 0; i < n; i++) {
      var off = pts[i][0] - g[0], back = pts[i][1] - g[1];
      if (i) { // tướng to hơn lính nhiều: chừa chỗ quanh tướng
        var dd = sq(off) + sq(back);
        if (dd < gap2) { if (!dd) { off = gap; back = 0; } else { var L = Math.sqrt(dd); off = floor(off * gap / L); back = floor(back * gap / L); } }
        if (cu && cu[i - 1]) { off = cu[i - 1][0] * 10; back = cu[i - 1][1] * 10; }
      }
      out.push([off, back]);
    }
    return out;
  }
  function formation(B, side, role, n, ax, ay, fm, lp, spPct, cu) {
    var R = TT.ROLES[role], fwd = TT.sideFwd[side], fx = fwd[0], fy = fwd[1], lx = -fy, ly = fx, out = [];
    var sp = mil(R.rad * 2 + .14), loc = layoutLocal(role, n, fm, lp, spPct, cu);
    for (var i = 0; i < n; i++) {
      var off = loc[i][0], back = loc[i][1];
      var q = placeFree(B, ax + floor(lx * off) - fx * back, ay + floor(ly * off) - fy * back), lim = sq(floor(sp * .6));
      if (i) { // đội hình thò ra ngoài bản đồ / tường: đẩy các quân bị chồng lên nhau ra ô trống gần nhất
        var clash = function (c) { for (var j = 0; j < out.length; j++) if (sq(out[j][0] - c[0]) + sq(out[j][1] - c[1]) < lim) return true; return false; };
        if (clash(q)) {
          var bx = q[0], by = q[1], found = null;
          for (var k = 1; k <= 24 && !found; k++) for (var d = 0; d < 8 && !found; d++) {
            var c = placeFree(B, bx + floor(icos(d * 785) * k * sp / 2000), by + floor(isin(d * 785) * k * sp / 2000));
            if (!clash(c)) found = c;
          }
          if (found) q = found;
        }
      }
      out.push(q);
    }
    return out;
  }
  Battle.shape = function (fm, n, lp) { var pts = shapeLocal(fm, n, 1000, lp); return pts; };
  Battle.layout = function (role, n, fm, lp, spPct, cu) { return layoutLocal(role, n, fm, lp, spPct, cu); }; // mili-ô, tướng ở gốc
  var FB = {};
  Battle.formation = function (map, side, role, n, tx, ty, fm, lp, spPct, cu) {
    var B = FB[map.g];
    if (!B) { B = FB[map.g] = { W: map.W, H: map.H, grid: new Uint8Array(map.W * map.H) }; for (var i = 0; i < map.g.length; i++) B.grid[i] = TER[map.g[i]] || 0; }
    return formation(B, side, role, n, tx * M + 500, ty * M + 500, fm, lp, spPct, cu);
  };
  function spawnMonsters(B, lvl) {
    var mon = TT.MONSTERS[lvl]; if (!mon) return;
    var pl = { idx: -1, seat: '0', team: -9, race: 'demon', talent: '', cores: {}, itemsTotal: 0 };
    var sqd = { idx: B.squads.length, id: -1, pl: -1, seat: '0', team: -9, role: mon.role, n0: mon.n, items: [], st: 'giu', fl: [], step: 0, ax: B.inp.map.center[0] * M + 500, ay: B.inp.map.center[1] * M + 500, units: [], monster: 1, name: mon.name, cx: 0, cy: 0, alive: 0, hp: 0, mhp: 0, dmg: 0, taken: 0, healed: 0, kills: 0 };
    B.squads.push(sqd);
    for (var i = 0; i < mon.n; i++) {
      var u = makeUnit(B, pl, sqd, mon.role, { monster: mon });
      var ang = i * 6283 / mon.n, r = mon.n > 1 ? 2200 : 0;
      var p = placeFree(B, sqd.ax + floor(r * icos(ang) / M), sqd.ay + floor(r * isin(ang) / M));
      u.x = u.px = p[0]; u.y = u.py = p[1]; u.spawnX = u.x; u.spawnY = u.y; u.fy = M;
      B.units.push(u); sqd.units.push(u);
    }
  }
  // sin/cos số nguyên (mili-radian → ×1000), xấp xỉ Bhaskara — xác định
  function isin(mr) { mr = ((mr % 6283) + 6283) % 6283; var neg = mr > 3141; if (neg) mr -= 3141; var x = mr * 180 / 3141; var v = floor(4000 * x * (180 - x) / (40500 - x * (180 - x))); return neg ? -v : v; }
  function icos(mr) { return isin(mr + 1571); }

  /* ---------------- trường dòng chảy (tìm đường theo đội) ---------------- */
  function profileOf(u) { return u.race === 'fairy' ? 1 : u.race === 'demon' ? 2 : 0; }
  function getField(B, gx, gy, prof, free) {
    var key = gx + ',' + gy + ',' + prof + (free ? 'f' : '');
    var f = B.fields[key];
    if (f && B.tick - f.t < 30) return f.d;
    var W = B.W, H = B.H, N = W * H, d = f ? f.d : new Int32Array(N);
    d.fill(0x3fffffff);
    var gk = gy * W + gx; d[gk] = 0;
    // Dijkstra hàng đợi theo xô (chi phí nhỏ, nguyên)
    var buckets = [[gk]], cur = 0, done = 0, maxB = 0;
    while (cur <= maxB) {
      var bk = buckets[cur]; if (!bk || !bk.length) { cur++; continue; }
      var k = bk.pop(); if (d[k] !== cur) continue;
      var x = k % W, y = (k / W) | 0;
      for (var n = 0; n < 8; n++) {
        var dx = DX[n], dy = DY[n], nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var nk = ny * W + nx, t = B.grid[nk]; if (t === 6) continue;
        if (dx && dy && (B.grid[y * W + nx] === 6 || B.grid[ny * W + x] === 6)) continue;
        var c = TCOST[t]; if (free) c = t === 5 ? 8 : 10; else if (prof === 1 && t === 3) c = 10; else if (prof === 2 && t === 4) c = 10;
        var nd = cur + (dx && dy ? floor(c * 14 / 10) : c);
        if (nd < d[nk]) { d[nk] = nd; (buckets[nd] || (buckets[nd] = [])).push(nk); if (nd > maxB) maxB = nd; }
      }
    }
    B.fields[key] = { t: B.tick, d: d };
    return d;
  }
  var DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  function losClear(B, a, b) {
    var x0 = floor(a.x / M), y0 = floor(a.y / M), x1 = floor(b.x / M), y1 = floor(b.y / M);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, n = 0;
    while (n++ < 200) { if (B.grid[y0 * B.W + x0] === 6) return false; if (x0 === x1 && y0 === y1) return true; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    return true;
  }

  /* ---------------- chỉ số hiệu dụng ---------------- */
  function bsum(u) { return u.bs || ZB; }
  var ZB = { atk: 0, as: 0, def: 0, dr: 0, spd: 0, ls: 0, rng: 0, dmg: 0, reflect: 0, regenPct: 0, cc: 0 };
  var ZA = { atk: 0, def: 0, as: 0, ls: 0, rng: 0, mpGain: 0, regenPct: 0, rdr: 0, fdef: 0, cdef: 0, guard: 0 };
  function aura(u) { return u.au || ZA; }
  function pl(B, u) { return u.pl >= 0 ? B.pls[u.pl] : null; }
  function atkE(B, u) {
    var b = bsum(u), a = aura(u), p = pl(B, u), m = 100 + b.atk + a.atk - u.weakP - u.adS * 8;
    if (p) { m += p.towerAtk; if (u.race === 'demon' && !u.monster) m += floor(p.souls * (p.talent === 'honchu' ? 150 : 100) * (p.cores.honchu2 ? 150 : 100) / 10000); }
    if (u.ifx.hillAtk && terAt(B, u.x, u.y) === 2) m += u.ifx.hillAtk;
    if (u.cls === 'xa' && terAt(B, u.x, u.y) === 2) m += 10;
    return Math.max(1, floor(u.atk * Math.max(20, m) / 100));
  }
  function asE(B, u) {
    var b = bsum(u), a = aura(u), m = 100 + b.as + a.as - u.slowAsP;
    if (u.race === 'dragon' && !u.monster) { var lost = 100 - floor(u.hp * 100 / u.mhp), p = pl(B, u); var cap = p && p.talent === 'longhuyet' ? 45 : 30; m += Math.min(cap, p && p.cores.huyetmach ? lost : floor(lost / 2)); }
    if (u.ifx.standAs && u.standT >= sec(2)) m += u.ifx.standAs;
    if (u.ifx.killStack) m += u.stackK * u.ifx.killStack.as;
    if (terAt(B, u.x, u.y) === 4 && u.race !== 'demon' && !u.fly) m -= 15;
    return clamp(floor(u.as * Math.max(25, m) / 100), 15, CFG.maxAS);
  }
  function defE(B, u) { var b = bsum(u), a = aura(u); return Math.max(0, floor(u.def * (100 + b.def + a.def + a.cdef - u.shredP) / 100) + a.fdef); }
  function rngE(B, u) { var r = u.rng + bsum(u).rng * M; if (u.cls === 'xa') { r += aura(u).rng * M; if (terAt(B, u.x, u.y) === 2) r += M; } return r; }
  function spdE(B, u) {
    var b = bsum(u), m = 100 + b.spd - u.slowP; if (m < 25) m = 25;
    var s = floor(u.spd * m / 100);
    if (u.hurry) s = floor(s * 130 / 100);
    if (u.fly) return s;
    var t = terAt(B, u.x, u.y), tf = TSPD[t];
    if (u.ifx.terrainFree && t !== 5) tf = 100;
    else if (t === 3) { if (u.race === 'fairy') tf = 100; else if (u.role === 'ky') tf = 55; }
    else if (t === 4) { if (u.race === 'demon') tf = 100; else if (u.race === 'fairy') tf = 85; }
    return floor(s * tf / 100);
  }

  /* ---------------- sát thương / hồi máu ---------------- */
  function ev(B, o) { B.events.push(o); }
  function heal(B, src, t, v) {
    if (!t.alive || v <= 0) return 0;
    if (t.race === 'demon' && !t.monster && src !== t) v = floor(v / 2);
    if (t.antiT > 0) v = floor(v * (100 - t.antiP) / 100);
    if (B.inp.weather === 'nang') v = floor(v * 80 / 100);
    var got = Math.min(v, t.mhp - t.hp); if (got <= 0) return 0;
    t.hp += got;
    if (src) { src.healDone += got; var p = pl(B, src); if (p) p.healed += got; if (src.sq >= 0) B.squads[src.sq].healed += got; }
    return got;
  }
  function healAmt(src, base, isSkill) { var m = 100 + (src.healPct || 0) + (isSkill ? src.skillDmg : 0); return floor(base * m / 100); }
  // o: {pct, dt(0/1/2 true), skill, aoe, noCrit, noMp, ranged, flat, from}
  function hit(B, src, t, o) {
    if (!t.alive) return 0;
    if (src && t.sq >= 0 && src.team !== t.team) { var hs = B.squads[t.sq]; if (hs) { hs.hurtT = B.tick + sec(6); hs.hurtBy = src.id; } }   // cả đạo quân biết mình đang bị đánh
    var isSkill = !!o.skill;
    if (isSkill && src && t.ifx.spellShield && !t.ssUsed) { t.ssUsed = 1; ev(B, { e: 'fx', k: 'shield', a: t.id }); return 0; }
    var ranged = o.ranged != null ? o.ranged : (src && src.rng > 1500);
    var dmg;
    if (o.flat != null) dmg = o.flat;
    else {
      dmg = floor(atkE(B, src) * o.pct / 100);
      var mult = 100 + bsum(src).dmg;
      var ps = src.ps, fx = src.ifx;
      if (ps.vsCls && ps.vsCls[t.cls]) mult += ps.vsCls[t.cls];
      if (ps.vsItems && t.cap && t.sq >= 0 && B.squads[t.sq].items.length) mult += ps.vsItems;
      if (src.huntP && (t.stun > 0 || t.rootT > 0 || t.slowT > 0 || t.silT > 0)) mult += src.huntP;
      if (fx.berserk && src.hp * 100 < src.mhp * fx.berserk.below) mult += fx.berserk.pct;
      if (fx.execute && t.hp * 100 / t.mhp < src.hp * 100 / src.mhp) mult += fx.execute;
      if (!isSkill && ps.charge && src.moved >= mil(ps.charge.tiles)) mult += ps.charge.pct;
      if (!isSkill && ps.firstStrike && src.lastHit !== t.id) mult += ps.firstStrike.pct;
      if (fx.farDmg && ranged) mult += Math.min(20, floor(dist(src, t) / M) * fx.farDmg);
      if (isSkill) mult += src.skillDmg;
      var tt = terAt(B, t.x, t.y);
      if (ranged && tt === 1 && terAt(B, src.x, src.y) !== 1) mult -= 20;
      if (!ranged && tt === 2 && terAt(B, src.x, src.y) !== 2) mult -= 10;
      if (src.soulBoost && !isSkill) { mult += src.soulBoost; src.soulBoost = 0; }
      dmg = floor(dmg * mult / 100);
      // né / chặn (chỉ đòn thường)
      if (!isSkill) {
        if (t.block > 0 && t.blockT > 0) { t.block--; if (!o.noMp) gainMp(B, t, CFG.mpOnHit); ev(B, { e: 'hit', b: t.id, d: 0, m: 2 }); return 0; }
        var dod = Math.min(CFG.capDodge, t.dodge + (ranged && tt === 1 ? 10 : 0));
        if (dod > 0 && B.R(100) < dod) { if (!o.noMp) gainMp(B, t, CFG.mpOnHit); ev(B, { e: 'hit', b: t.id, d: 0, m: 1 }); return 0; }
        if (!o.noCrit && src.crit > 0 && B.R(100) < Math.min(CFG.capCrit, src.crit)) { dmg = floor(dmg * src.critDmg / 100); o.crit = 1; }
      }
      // giáp
      var dt = o.dt != null ? o.dt : src.dt;
      if (dt !== 2) {
        var df = defE(B, t); if (dt === 1) df = floor(df / 2);
        df = floor(df * (100 - Math.min(90, src.pen + (src.ps.armorPen || 0))) / 100);
        dmg = floor(dmg * 100 / (100 + df));
      }
    }
    // giảm sát thương
    var dr = bsum(t).dr + t.idr;
    if (t.ps.firstHitDR && B.tick - t.firstT >= sec(t.ps.firstHitDR.cd)) { dr += t.ps.firstHitDR.pct; t.firstT = B.tick; }
    else if (t.ifx.firstHitDR && B.tick - t.firstT >= sec(t.ifx.firstHitDR.cd)) { dr += t.ifx.firstHitDR.pct; t.firstT = B.tick; }
    var au = aura(t); if (ranged && src) dr += au.rdr; if (ranged && au.guard) dr += au.guard;
    if (o.aoe && t.race === 'fairy' && !t.monster) dr -= 15;
    if (t.vulnT > 0) dr -= t.vulnP;
    if (dr > CFG.capDR) dr = CFG.capDR;
    if (o.flat == null || o.dt !== 2) dmg = floor(dmg * (100 - dr) / 100);
    if (dmg < 1) dmg = 1;
    // khiên
    var absorbed = 0;
    if (t.shield > 0 && !o.storm) { absorbed = Math.min(t.shield, dmg); t.shield -= absorbed; }
    var real = dmg - absorbed;
    t.hp -= real;
    if (src) {
      src.dmgDone += dmg; t.dmgTaken += dmg;
      var sp = pl(B, src), tp = pl(B, t); if (sp) sp.dmg += dmg; if (tp) tp.taken += dmg;
      if (src.sq >= 0) B.squads[src.sq].dmg += dmg; if (t.sq >= 0) B.squads[t.sq].taken += dmg;
      if (!o.storm) { if (sp) sp.engaged = true; if (tp) tp.engaged = true; }
      // hút máu
      var ls = src.ls + bsum(src).ls + aura(src).ls;
      if (ls > 0 && o.dt !== 2) heal(B, src, src, floor(dmg * ls / 100));
      if (o.drain) heal(B, src, src, floor(dmg * o.drain / 100));
      if (isSkill && src.ifx.svamp) heal(B, src, src, floor(dmg * src.ifx.svamp / 100));
      // phản đòn
      var refl = t.reflect + bsum(t).reflect;
      if (refl > 0 && !ranged && !o.reflected && src.alive) hit(B, t, src, { flat: floor(dmg * refl / 100), dt: 2, reflected: 1, noMp: 1 });
      if (!isSkill && !o.noMp) gainMp(B, src, CFG.mpOnAttack + (src.ifx.mpPerHit || 0));
    }
    if (!o.noMp) gainMp(B, t, CFG.mpOnHit);
    ev(B, { e: 'hit', b: t.id, d: dmg, c: o.crit ? 1 : 0, s: isSkill ? 1 : 0 });
    if (t.hp <= 0) die(B, t, src);
    else if (t.ifx.lowHeal && !t.lowHealUsed && t.hp * 100 < t.mhp * t.ifx.lowHeal.below) { t.lowHealUsed = true; heal(B, t, t, floor(t.mhp * t.ifx.lowHeal.pct / 100)); ev(B, { e: 'fx', k: 'heal', a: t.id }); }
    return dmg;
  }
  function gainMp(B, u, v) { if (!u.alive || !u.mmp) return; var g = floor(v * (u.mpGain + aura(u).mpGain) / 100); if (u.race === 'dragon') g = Math.max(1, g); u.mp = Math.min(u.mmp, u.mp + g); }
  function applySt(B, src, t, st) {
    if (!st || !t.alive) return;
    var p = pl(B, t), cc = bsum(t).cc;
    if (st.slow) { t.slowP = Math.max(t.slowP, st.slow); t.slowT = Math.max(t.slowT, sec(st.dur || 2)); }
    if (st.burn) { var bd = floor(atkE(B, src) * st.burn / 100); if (B.inp.weather === 'mua') bd = floor(bd / 2); if (bd > t.burnD || t.burnT <= 0) { t.burnD = Math.max(1, bd); t.burnS = src.id; } t.burnT = Math.max(t.burnT, sec(st.dur || 3)); }
    if (st.shred) { t.shredP = Math.max(t.shredP, st.shred); t.shredT = Math.max(t.shredT, sec(st.dur)); }
    if (st.vuln) { t.vulnP = Math.max(t.vulnP, st.vuln); t.vulnT = Math.max(t.vulnT, sec(st.dur)); }
    if (st.weak) { t.weakP = Math.max(t.weakP, st.weak); t.weakT = Math.max(t.weakT, sec(st.dur)); }
    if (st.antiheal) { t.antiP = Math.max(t.antiP, st.antiheal); t.antiT = Math.max(t.antiT, sec(st.dur)); }
    var ten = 100 - Math.min(60, (t.ifx.tenacity || 0)); if (src && src.ccAdd) ten = floor(ten * (100 + src.ccAdd) / 100);
    if (st.stun && !cc && !t.monsterBoss) { var sd = floor(sec(st.stun + (src.ifx.stunAdd || 0)) * ten / 100); t.stun = Math.max(t.stun, sd); ev(B, { e: 'fx', k: 'stun', a: t.id }); }
    if (st.air && !cc && !t.monsterBoss && t.role !== 'thanthu') { var ad = floor(sec(st.air) * ten / 100); t.stun = Math.max(t.stun, ad); t.airT = Math.max(t.airT, ad); ev(B, { e: 'fx', k: 'air', a: t.id }); }
    if (st.root && !cc) { t.rootT = Math.max(t.rootT, floor(sec(st.root) * ten / 100)); ev(B, { e: 'fx', k: 'root', a: t.id }); }
    if (st.silence && !cc) { t.silT = Math.max(t.silT, floor(sec(st.silence) * ten / 100)); ev(B, { e: 'fx', k: 'silence', a: t.id }); }
    if (st.pull && !cc && !t.monsterBoss && t.role !== 'thanthu') pull(B, src, t, mil(st.pull));
    if (st.knock && !cc && !t.ps.immuneKnock && t.role !== 'thanthu') knock(B, src, t, mil(st.knock));
  }
  function pull(B, src, t, d) {
    var dx = src.x - t.x, dy = src.y - t.y, l = TT.isqrt(dx * dx + dy * dy) || 1; d = Math.min(d, Math.max(0, l - mil(1)));
    var nx = t.x + floor(dx * d / l), ny = t.y + floor(dy * d / l);
    if (passable(B, floor(nx / M), floor(ny / M)) || t.fly) { t.x = clamp(nx, 300, B.W * M - 300); t.y = clamp(ny, 300, B.H * M - 300); ev(B, { e: 'knock', a: t.id }); }
  }
  function knock(B, src, t, d) {
    var dx = t.x - src.x, dy = t.y - src.y, l = TT.isqrt(dx * dx + dy * dy) || 1;
    var nx = t.x + floor(dx * d / l), ny = t.y + floor(dy * d / l);
    if (passable(B, floor(nx / M), floor(ny / M)) || t.fly) { t.x = clamp(nx, 300, B.W * M - 300); t.y = clamp(ny, 300, B.H * M - 300); ev(B, { e: 'knock', a: t.id }); }
  }
  function die(B, t, src) {
    // hồi sinh (Phượng Hoàng, Ấn Bất Tử, Bất Diệt…)
    if (t.rebirth) { t.rebirth = false; t.hp = floor(t.mhp * t.ps.rebirth.pct / 100); t.shield = 0; ev(B, { e: 'fx', k: 'rebirth', a: t.id }); return; }
    if (t.revive > 0) { t.hp = floor(t.mhp * t.revive / 100); t.revive = 0; ev(B, { e: 'fx', k: 'rebirth', a: t.id }); return; }
    t.alive = false; t.hp = 0;
    ev(B, { e: 'die', a: t.id, k: src ? src.id : -1 });
    var tp = pl(B, t), sp = src ? pl(B, src) : null;
    // tướng chết: lính vẫn đánh tiếp theo chiến thuật của đạo quân, trang bị mất tác dụng
    if (src && src.alive) {
      src.kills++; if (src.sq >= 0) B.squads[src.sq].kills++;
      if (sp && !t.temp) { if (t.monster) sp.mkills += t.pop; else if (tp) sp.kills += t.pop; }
      if (src.ifx.killMp) gainMp(B, src, src.ifx.killMp);
      if (src.ifx.killStack) { if (src.stackK < src.ifx.killStack.max) src.stackK++; heal(B, src, src, floor(src.mhp * src.ifx.killStack.heal / 100)); }
      if (src.ps.killStealth) { heal(B, src, src, floor(src.mhp * src.ps.killStealth.heal / 100)); src.stealthT = sec(src.ps.killStealth.dur); }
      if (src.ps.killSouls && sp) addSouls(sp, src.ps.killSouls);
      if (t.ps.deathRetaliate) hit(B, null, src, { flat: floor(t.mhp * t.ps.deathRetaliate.pct / 100), dt: 2, noMp: 1 });
    }
    if (t.marshal && !t.temp) { // Nguyên soái chết = người chơi thua ngày: toàn bộ quân của họ gục theo
      if (src && src.alive) { var spm = pl(B, src); if (spm) spm.kills += 4; }
      B.units.forEach(function (o) { if (o.alive && o.pl === t.pl && o !== t) { o.alive = false; o.hp = 0; ev(B, { e: 'die', a: o.id, k: -1 }); } });
      ev(B, { e: 'fx', k: 'rebirth', a: t.id });
    }
    if (!t.temp) B.pls.forEach(function (q) { if (q.race === 'demon' && !q.out) addSouls(q, 1); });
    if (tp) {
      tp.deaths++;
      if (tp.race === 'demon') addSouls(tp, t.ps.deathSouls || 0);
      if (t.ps.deathSummon) B.spawnQ.push({ pl: tp, role: t.ps.deathSummon.role, n: t.ps.deathSummon.n, pct: t.ps.deathSummon.pct, x: t.x, y: t.y, sq: t.sq });
      if (tp.cores.vonglinh && !t.temp && tp.deaths % 4 === 0) B.spawnQ.push({ pl: tp, role: 'linh', n: 1, pct: 50, x: t.x, y: t.y, sq: t.sq });
    }
  }
  function addSouls(p, n) { p.souls = Math.min(p.soulMax, p.souls + n); }
  function passCaptain(B, sqd, dead) {
    var nx = null; for (var i = 0; i < sqd.units.length; i++) { var u = sqd.units[i]; if (u.alive && u !== dead && !u.temp) { nx = u; break; } }
    if (!nx || !sqd.items.length) return;
    // chuyển chỉ số trang bị sang đội trưởng mới
    var p = pl(B, nx), add = {}, imul = 100 + (nx.race === 'human' ? (p.talent === 'renkhi' ? 30 : 15) : 0) + (p.cores.thankhi ? 25 : 0);
    sqd.items.forEach(function (k) { var I = TT.ITEMS[k]; if (I.st) sumFx(add, I.st, imul); if (I.fx) { for (var f in I.fx) { if (typeof I.fx[f] === 'number') nx.ifx[f] = (nx.ifx[f] || 0) + I.fx[f]; else nx.ifx[f] = I.fx[f]; } if (I.fx.reflect) nx.reflect += I.fx.reflect; if (I.fx.armorPen) nx.pen += I.fx.armorPen; if (I.fx.skillDmg) nx.skillDmg += I.fx.skillDmg; if (I.fx.dr) nx.idr += I.fx.dr; } });
    if (add.hp) { nx.mhp += add.hp; nx.hp += add.hp; }
    if (add.atk) nx.atk += add.atk; if (add.def) nx.def += add.def;
    if (add.asPct) nx.as = floor(nx.as * (100 + add.asPct) / 100);
    if (add.crit) nx.crit += add.crit; if (add.dodge) nx.dodge += add.dodge; if (add.ls) nx.ls += add.ls; if (add.critDmg) nx.critDmg += add.critDmg;
    if (nx.ifx.revive) nx.revive = Math.max(nx.revive, nx.ifx.revive);
    nx.cap = true; dead.cap = false;
    ev(B, { e: 'cap', a: nx.id });
  }

  /* ---------------- kỹ năng ---------------- */
  function enemiesIn(B, u, x, y, r) { var out = [], r2 = r * r; for (var i = 0; i < B.units.length; i++) { var e = B.units[i]; if (e.alive && isEnemy(B, u, e)) { var dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2 + e.rad * e.rad) out.push(e); } } return out; }
  function alliesIn(B, u, x, y, r) { var out = [], r2 = r * r; for (var i = 0; i < B.units.length; i++) { var e = B.units[i]; if (e.alive && e.team === u.team && !e.monster) { var dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) out.push(e); } } return out; }
  function lowestAlly(B, u, r, excl) { var best = null, bv = 101; alliesIn(B, u, u.x, u.y, r).forEach(function (a) { if (excl && excl.indexOf(a) >= 0) return; var v = floor(a.hp * 100 / a.mhp); if (v < bv) { bv = v; best = a; } }); return bv < 100 ? best : null; }
  function canCast(B, u) {
    if (!u.sk || u.mp < u.mmp || u.mmp <= 0 || u.silT > 0) return false;
    var f = u.sk.fx[0], t = u.tgt >= 0 ? byId(B, u.tgt) : null;
    if (f.t === 'heal' || f.t === 'shield' || f.t === 'buff' || f.t === 'block') { var near = nearestEnemy(B, u, rngE(B, u) + mil(4)); return !!near; }
    if (f.t === 'summon') return f.marshal ? (B.tick > 2 * T && !!nearestEnemy(B, u, null)) : u.tgt >= 0;
    if (f.area === 'self' || f.t === 'taunt') return enemiesIn(B, u, u.x, u.y, mil(f.r || 3)).length > 0;
    if (f.t === 'dash' && f.to !== 'target') return !!nearestEnemy(B, u, mil(f.r || 9));
    if (f.t === 'blink' && f.to === 'captain') return !!t;
    return !!(t && t.alive && d2(u, t) <= sq(rngE(B, u) + (f.t === 'dash' || f.t === 'blink' ? mil(4) : 0) + t.rad + u.rad));
  }
  function tryAct(B, u) {
    if (u.actCd > 0 || u.silT > 0) return false;
    var sk = u.sk, mp = u.mp, mm = u.mmp; u.sk = u.act; u.mmp = u.mp = 100;
    var ok = canCast(B, u); if (ok) { cast(B, u); u.actCd = sec(u.act.cd); }
    u.sk = sk; u.mmp = mm; u.mp = mp; return ok;
  }
  function nearestEnemy(B, u, r) { var best = null, bd = r == null ? 1e18 : r * r; for (var i = 0; i < B.units.length; i++) { var e = B.units[i]; if (!e.alive || !isEnemy(B, u, e)) continue; var dd = d2(u, e); if (dd < bd) { bd = dd; best = e; } } return best; }
  function cast(B, u) {
    var sk = u.sk, t = u.tgt >= 0 ? byId(B, u.tgt) : null, p = pl(B, u);
    u.mp = 0; u.castT = sec(.4);
    var healed = [];
    ev(B, { e: 'sk', a: u.id, n: sk.name, b: t ? t.id : -1, k: sk.fx[0].t + (sk.fx[0].area ? '.' + sk.fx[0].area : ''), r: role2fx(u) });
    sk.fx.forEach(function (f) {
      var o = { pct: f.pct, skill: 1, dt: f.dt === 'magic' ? 1 : f.dt === 'true' ? 2 : undefined, drain: f.drain };
      switch (f.t) {
        case 'dmg': {
          var pct = f.pct;
          if (f.souls === 'all' && p) { pct += f.perSoul * p.souls; p.souls = 0; o.pct = pct; }
          var area = f.area, targets = [];
          if (area === 'target') { if (t && t.alive) targets = [t]; }
          else if (area === 'circle') { var c = t || u; targets = enemiesIn(B, u, c.x, c.y, mil(f.r)); o.aoe = 1; ev(B, { e: 'area', x: c.x, y: c.y, r: mil(f.r), a: u.id, k: u.race }); }
          else if (area === 'self') { targets = enemiesIn(B, u, u.x, u.y, mil(f.r)); o.aoe = 1; ev(B, { e: 'area', x: u.x, y: u.y, r: mil(f.r), a: u.id, k: u.race }); }
          else if (area === 'cone' && t) { targets = coneTargets(B, u, t, mil(f.len)); o.aoe = 1; ev(B, { e: 'cone', a: u.id, x: t.x, y: t.y, r: mil(f.len) }); }
          else if (area === 'line' && t) { targets = lineTargets(B, u, t, mil(f.len), mil(f.w || .8)); o.aoe = 1; ev(B, { e: 'line', a: u.id, x: t.x, y: t.y, r: mil(f.len) }); }
          else if (area === 'multi') { targets = multiTargets(B, u, t, f); targets.forEach(function (x) { ev(B, { e: 'shot', a: u.id, b: x.id }); }); }
          else if (area === 'chain' && t) { var hitL = [t], cur = t, mul = 100; hit(B, u, t, o); ev(B, { e: 'shot', a: u.id, b: t.id, k: 'bolt' }); for (var cN = 0; cN < f.n; cN++) { var nx = null, bd = sq(mil(3.5)); B.units.forEach(function (e) { if (e.alive && isEnemy(B, u, e) && hitL.indexOf(e) < 0) { var dd = d2(cur, e); if (dd < bd) { bd = dd; nx = e; } } }); if (!nx) break; mul = floor(mul * (100 - f.fall) / 100); hitL.push(nx); ev(B, { e: 'shot', a: cur.id, b: nx.id, k: 'bolt' }); hit(B, u, nx, { pct: floor(f.pct * mul / 100), skill: 1, dt: o.dt }); cur = nx; } targets = []; }
          else if (area === 'rain') { var cc = t || u; for (var rn = 0; rn < f.n; rn++) { var ang = B.R(6283), rad = B.R(mil(f.r)); var px = cc.x + floor(rad * icos(ang) / M), py = cc.y + floor(rad * isin(ang) / M); ev(B, { e: 'area', x: px, y: py, r: mil(f.rr), a: u.id, k: 'star' }); enemiesIn(B, u, px, py, mil(f.rr)).forEach(function (e) { hit(B, u, e, { pct: f.pct, skill: 1, dt: o.dt, aoe: 1 }); applySt(B, u, e, f.st); }); } }
          targets.forEach(function (e) { hit(B, u, e, o); applySt(B, u, e, f.st); if (u.ifx.skillCc) applySt(B, u, e, u.ifx.skillCc); });
          break;
        }
        case 'heal': {
          var list = [];
          if (f.pick === 'lowest') { for (var hn = 0; hn < f.n; hn++) { var la = lowestAlly(B, u, mil(f.r), list); if (la) list.push(la); } }
          else if (f.pick === 'cluster') { var lw = lowestAlly(B, u, mil(6)) || u; list = alliesIn(B, u, lw.x, lw.y, mil(f.r)); }
          else list = alliesIn(B, u, u.x, u.y, mil(f.r));
          list.forEach(function (a) { var got = heal(B, u, a, healAmt(u, floor(a.mhp * f.maxPct / 100), true)); healed.push(a); ev(B, { e: 'heal', a: u.id, b: a.id, v: got }); });
          break;
        }
        case 'shield': {
          var sl = f.who === 'self' ? [u] : f.who === 'lowest' ? (function () { var r = []; for (var i = 0; i < f.n; i++) { var x = lowestAlly(B, u, mil(f.r), r) || null; if (x) r.push(x); } if (!r.length) r.push(u); return r; })() : alliesIn(B, u, u.x, u.y, mil(f.r)).sort(function (a, b) { return d2(u, a) - d2(u, b) || a.id - b.id; }).slice(0, f.n);
          sl.forEach(function (a) { var v = healAmt(u, floor(a.mhp * f.maxPct / 100), true); a.shield = Math.max(a.shield, v); a.shieldT = Math.max(a.shieldT, sec(f.dur)); ev(B, { e: 'fx', k: 'shield', a: a.id }); });
          break;
        }
        case 'buff': {
          var who = f.who === 'self' ? [u] : f.who === 'healed' ? healed : alliesIn(B, u, u.x, u.y, mil(f.r));
          var bf = { t: sec(f.dur) }; ['atk', 'as', 'def', 'dr', 'spd', 'ls', 'reflect', 'regenPct', 'dmg', 'cc', 'rng'].forEach(function (k) { if (f[k]) bf[k] = f[k]; });
          who.forEach(function (a) { addBuff(a, bf); ev(B, { e: 'fx', k: 'buff', a: a.id }); });
          break;
        }
        case 'taunt': enemiesIn(B, u, u.x, u.y, mil(f.r)).forEach(function (e) { if (bsum(e).cc) return; e.tauntBy = u.id; e.tauntT = sec(f.dur); e.tgt = u.id; }); ev(B, { e: 'area', x: u.x, y: u.y, r: mil(f.r), a: u.id, k: 'taunt' }); break;
        case 'block': alliesIn(B, u, u.x, u.y, mil(f.r)).sort(function (a, b) { return d2(u, a) - d2(u, b) || a.id - b.id; }).slice(0, f.n).forEach(function (a) { a.block = 1; a.blockT = sec(f.dur); ev(B, { e: 'fx', k: 'shield', a: a.id }); }); break;
        case 'dash': {
          var dt2 = f.to === 'target' ? t : f.to === 'backline' ? pickBack(B, u, mil(10)) : f.to === 'lowest' ? pickLowest(B, u, mil(f.r || 8)) : t;
          if (!dt2) break;
          var x0 = u.x, y0 = u.y, dx = dt2.x - u.x, dy = dt2.y - u.y, l = TT.isqrt(dx * dx + dy * dy) || 1, over = f.through ? mil(1.2) : -(u.rad + dt2.rad);
          var tx = dt2.x + floor(dx * over / l), ty = dt2.y + floor(dy * over / l), pp = placeFree(B, tx, ty);
          if (f.path) lineTargets(B, u, { x: pp[0], y: pp[1] }, l + over, mil(.9), x0, y0).forEach(function (e) { hit(B, u, e, { pct: f.path, skill: 1, aoe: 1 }); applySt(B, u, e, f.st); });
          u.x = pp[0]; u.y = pp[1]; u.tgt = dt2.id;
          ev(B, { e: 'dash', a: u.id, x0: x0, y0: y0, x1: u.x, y1: u.y });
          if (f.pct) { hit(B, u, dt2, o); applySt(B, u, dt2, f.st); }
          break;
        }
        case 'blink': {
          var bt = f.to === 'captain' ? pickCaptain(B, u) || t : t; if (!bt) break;
          var bx = bt.x - u.x, by = bt.y - u.y, bl = TT.isqrt(bx * bx + by * by) || 1, back = bt.rad + u.rad + 200;
          var p2 = placeFree(B, bt.x + floor(bx * back / bl), bt.y + floor(by * back / bl)), ox = u.x, oy = u.y;
          u.x = p2[0]; u.y = p2[1]; u.tgt = bt.id;
          ev(B, { e: 'dash', a: u.id, x0: ox, y0: oy, x1: u.x, y1: u.y, k: 'blink' });
          hit(B, u, bt, o);
          if (f.stealth) u.stealthT = sec(f.stealth);
          if (f.killShield && !bt.alive) { u.shield = Math.max(u.shield, floor(u.mhp * f.killShield / 100)); u.shieldT = sec(3); }
          break;
        }
        case 'summon': {
          var n = f.n; if (f.souls && p) { if (p.souls >= f.souls) p.souls -= f.souls; else n = 1; }
          B.spawnQ.push({ pl: p, role: f.role, n: n, pct: f.pct, x: u.x, y: u.y, sq: u.sq });
          break;
        }
      }
    });
  }
  function role2fx(u) { return u.race + '.' + u.role; }
  function addBuff(a, bf) { var c = {}; for (var k in bf) c[k] = bf[k]; a.buffs.push(c); }
  function coneTargets(B, u, t, len) {
    var fx = t.x - u.x, fy = t.y - u.y, fl = TT.isqrt(fx * fx + fy * fy) || 1, out = [];
    B.units.forEach(function (e) { if (!e.alive || !isEnemy(B, u, e)) return; var dx = e.x - u.x, dy = e.y - u.y, dd = dx * dx + dy * dy; if (dd > sq(len + e.rad)) return; var dot = dx * fx + dy * fy; if (dot <= 0) return; if (2 * dot * dot >= dd * fl * fl || dd < sq(u.rad + e.rad + 200)) out.push(e); });
    return out;
  }
  function lineTargets(B, u, t, len, w, sx, sy) {
    sx = sx == null ? u.x : sx; sy = sy == null ? u.y : sy;
    var fx = t.x - sx, fy = t.y - sy, fl = TT.isqrt(fx * fx + fy * fy) || 1, out = [];
    B.units.forEach(function (e) { if (!e.alive || !isEnemy(B, u, e)) return; var dx = e.x - sx, dy = e.y - sy, proj = floor((dx * fx + dy * fy) / fl); if (proj < 0 || proj > len) return; var perp = Math.abs(floor((dx * fy - dy * fx) / fl)); if (perp <= w + e.rad) out.push(e); });
    return out;
  }
  function multiTargets(B, u, t, f) {
    var r = rngE(B, u) + mil(1), list = enemiesIn(B, u, u.x, u.y, f.pick === 'near' ? mil(f.r || 2) + u.rad : r).filter(function (e) { return e.stealthT <= 0 || d2(u, e) <= sq(mil(2)); });
    if (!list.length) return t ? [t] : [];
    if (f.pick === 'lowest') list.sort(function (a, b) { return a.hp - b.hp || a.id - b.id; });
    else list.sort(function (a, b) { return d2(u, a) - d2(u, b) || a.id - b.id; });
    var out = [];
    for (var i = 0; i < f.n; i++) out.push(f.pick === 'near' ? list[B.R(list.length)] : list[i % list.length]);
    return out;
  }
  function pickBack(B, u, r) { var best = null, bd = 1e18; B.units.forEach(function (e) { if (!e.alive || !isEnemy(B, u, e) || e.cls === 'can' || (e.stealthT > 0)) return; var dd = d2(u, e); if (dd < bd && dd <= r * r * 4) { bd = dd; best = e; } }); return best || (u.tgt >= 0 ? byId(B, u.tgt) : null); }
  function pickLowest(B, u, r) { var best = null, bv = 1e9; B.units.forEach(function (e) { if (!e.alive || !isEnemy(B, u, e) || e.stealthT > 0) return; if (d2(u, e) > r * r) return; if (e.hp < bv) { bv = e.hp; best = e; } }); return best; }
  function pickCaptain(B, u) { var best = null, bv = -1; B.units.forEach(function (e) { if (!e.alive || !isEnemy(B, u, e) || !e.cap || e.sq < 0) return; var v = B.squads[e.sq].items.length * 1000 - floor(dist(u, e) / 100); if (v > bv) { bv = v; best = e; } }); return best; }
  function byId(B, id) { var u = B.byId[id]; return u && u.alive ? u : null; }

  /* ---------------- chọn mục tiêu ---------------- */
  function chooseTarget(B, u, sqd, mode) {
    if (u.tauntT > 0) { var tb = byId(B, u.tauntBy); if (tb) return tb; }
    var best = null, bs = -1e18, myR = rngE(B, u), alert = mode && mode.alert;
    var hunter = ROLEPRI[u.role] || (sqd && sqd.st === 'san'), wantLow = u.role === 'cung' || u.role === 'thichkhach', wantCluster = u.role === 'phapsu' || u.role === 'congthanh';
    var dens = B.dens, W = B.W;
    for (var i = 0; i < B.units.length; i++) {
      var e = B.units[i]; if (!e.alive || !isEnemy(B, u, e)) continue;
      var dd = d2(u, e);
      if (e.stealthT > 0 && dd > sq(mil(2) + e.rad)) continue;
      if (alert && dd > sq(alert)) continue;
      if (u.monster && dd > sq(mil(7))) continue;
      var dm = TT.isqrt(dd), s = -floor(dm / 10);
      var inR = dm <= myR + e.rad + u.rad;
      if (hunter && e.cls !== 'can') s += 450;
      if (u.ps.huntCaptain && e.cap && e.sq >= 0 && B.squads[e.sq].items.length) s += 600;
      if (wantLow && inR) s += 100 - floor(e.hp * 100 / e.mhp);
      if (wantCluster && dens) { var c = cellOf(B, e.x, e.y), cnt = 0, tm = e.team; for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var k = c + oy * W + ox; if (k >= 0 && k < dens.length) cnt += dens[k][tm] || 0; } s += cnt * 30; }
      if (inR) s += 120;
      if (e.id === u.tgt) s += 160;
      if (sqd && sqd.hurtT > B.tick && sqd.hurtBy === e.id) s += 500;
      if (mode && mode.assist === e.id) s += 500;
      if (e.tgt >= 0 && sqd) { var et = B.byId[e.tgt]; if (et && et.sq === u.sq) s += 60; }
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }

  /* ---------------- AI mỗi tick ---------------- */
  function moveToward(B, u, tx, ty, stopAt) {
    var dx = tx - u.x, dy = ty - u.y, l = TT.isqrt(dx * dx + dy * dy);
    if (l <= (stopAt || 0)) return 0;
    var s = Math.min(spdE(B, u), l - (stopAt || 0)); if (s <= 0) return 0;
    var nx = u.x + floor(dx * s / l), ny = u.y + floor(dy * s / l);
    if (!u.fly && !passable(B, floor(nx / M), floor(ny / M))) {
      // trượt theo trục
      if (passable(B, floor(nx / M), floor(u.y / M))) ny = u.y; else if (passable(B, floor(u.x / M), floor(ny / M))) nx = u.x; else return 0;
    }
    u.x = clamp(nx, 200, B.W * M - 200); u.y = clamp(ny, 200, B.H * M - 200);
    if (l > 0) { u.fx = floor(dx * M / l); u.fy = floor(dy * M / l); }
    return s;
  }
  function pathStep(B, u, gx, gy, tx, ty) {
    // tới thẳng nếu gần và không có vật cản
    if (u.fly) return moveToward(B, u, tx, ty, 0);
    var dd = sq(tx - u.x) + sq(ty - u.y);
    if (dd < sq(mil(5)) && losClear(B, u, { x: tx, y: ty })) return moveToward(B, u, tx, ty, 0);
    var free = u.ifx.terrainFree ? 1 : 0;
    var f = getField(B, clamp(gx, 0, B.W - 1), clamp(gy, 0, B.H - 1), profileOf(u), free);
    var cx = floor(u.x / M), cy = floor(u.y / M), ck = cy * B.W + cx, best = f[ck], bk = -1;
    for (var n = 0; n < 8; n++) {
      var nx = cx + DX[n], ny = cy + DY[n]; if (nx < 0 || ny < 0 || nx >= B.W || ny >= B.H) continue;
      var nk = ny * B.W + nx; if (f[nk] < best) { if (DX[n] && DY[n] && (B.grid[cy * B.W + nx] === 6 || B.grid[ny * B.W + cx] === 6)) continue; best = f[nk]; bk = nk; }
    }
    if (bk < 0) return moveToward(B, u, tx, ty, 0);
    return moveToward(B, u, (bk % B.W) * M + 500, ((bk / B.W) | 0) * M + 500, 0);
  }
  function inRange(B, u, t) { var r = rngE(B, u) + t.rad + u.rad; return d2(u, t) <= r * r; }
  function attack(B, u, t) {
    var ranged = u.rng > 1500 || u.healer;
    u.cd = Math.max(1, floor(T * 10000 / asE(B, u) / 100));
    var fx = t.x - u.x, fy = t.y - u.y, l = TT.isqrt(fx * fx + fy * fy) || 1; u.fx = floor(fx * M / l); u.fy = floor(fy * M / l);
    // Thuật sĩ: hồi máu thay vì đánh khi có đồng minh bị thương
    if (u.ps.healAtk) {
      var la = lowestAlly(B, u, rngE(B, u) + mil(.5));
      if (la && la.hp * 100 < la.mhp * 96) {
        var v = healAmt(u, floor(atkE(B, u) * u.ps.healAtk.pct / 100), false), got = heal(B, u, la, v);
        ev(B, { e: 'heal', a: u.id, b: la.id, v: got, k: 'atk' }); gainMp(B, u, CFG.mpOnAttack);
        if (u.ps.healBuff) addBuff(la, { atk: u.ps.healBuff.atk, t: sec(u.ps.healBuff.dur) });
        if (u.ps.healCleanse) { la.slowT = 0; la.burnT = 0; la.weakT = 0; la.shredT = 0; la.antiT = 0; la.vulnT = 0; }
        if (u.ps.healBounce) { var l2 = lowestAlly(B, u, rngE(B, u) + mil(.5), [la]); if (l2) { var g2 = heal(B, u, l2, floor(v * u.ps.healBounce.pct / 100)); ev(B, { e: 'heal', a: la.id, b: l2.id, v: g2, k: 'atk' }); } }
        return;
      }
    }
    ev(B, { e: 'atk', a: u.id, b: t.id, r: ranged ? 1 : 0, k: u.monster ? u.mkind : role2fx(u) });
    var extra = 0;
    if (u.ps.soulShot && pl(B, u) && pl(B, u).souls > 0 && B.tick - (u.soulT || -999) >= sec(u.ps.soulShot.cd)) { pl(B, u).souls--; u.soulT = B.tick; u.soulBoost = u.ps.soulShot.pct; }
    var o = { pct: 100, ranged: ranged };
    if (u.ps.drainHeal) o.dt = 1;
    if (ranged) {
      var travel = Math.max(1, floor(l * T / (CFG.projSpeed * M)));
      B.proj.push({ at: B.tick + travel, src: u.id, tgt: t.id, o: o, x: t.x, y: t.y });
      if (u.ifx.extraShot && B.R(100) < u.ifx.extraShot) { var e2 = nearestOther(B, u, t, rngE(B, u)); if (e2) { B.proj.push({ at: B.tick + travel, src: u.id, tgt: e2.id, o: { pct: 100, ranged: true }, x: e2.x, y: e2.y }); ev(B, { e: 'atk', a: u.id, b: e2.id, r: 1, k: role2fx(u) }); } }
    } else resolveHit(B, u, t, o);
    u.hits++;
    if (u.ifx.everyN && u.hits % u.ifx.everyN.n === 0) u.cd = 1;
    u.moved = 0; u.lastHit = t.id;
    if (u.ps.kite && B.R(100) < u.ps.kite.chance) { u.kiteT = sec(.5); u.kx = -u.fx; u.ky = -u.fy; }
  }
  function nearestOther(B, u, not, r) { var best = null, bd = sq(r + 500); B.units.forEach(function (e) { if (e.alive && e !== not && isEnemy(B, u, e)) { var dd = d2(u, e); if (dd < bd) { bd = dd; best = e; } } }); return best; }
  function resolveHit(B, u, t, o) {
    if (!t.alive) return;
    if (u.ps.drainHeal) { var dd = hit(B, u, t, { pct: u.ps.drainHeal.pct, dt: 1, ranged: true }); var la = lowestAlly(B, u, rngE(B, u) + mil(2)); if (la && dd > 0) { var got = heal(B, u, la, dd); ev(B, { e: 'heal', a: u.id, b: la.id, v: got, k: 'atk' }); } return; }
    var dmg = hit(B, u, t, o);
    if (dmg <= 0) return;
    var ps = u.ps, fx = u.ifx;
    var clv = ps.cleave || fx.cleave;
    if (clv) { var n = 0; B.units.forEach(function (e) { if (n < clv.n && e !== t && e.alive && isEnemy(B, u, e) && d2(t, e) <= sq(mil(1.3))) { n++; hit(B, u, e, { pct: clv.pct, noMp: 1, aoe: 1 }); } }); }
    if (ps.pierce || ps.lineShot) { var lst = lineTargets(B, u, t, rngE(B, u) + mil(2), mil(.6)).filter(function (e) { return e !== t; }).sort(function (a, b) { return d2(u, a) - d2(u, b) || a.id - b.id; }); var cnt = ps.lineShot ? ps.lineShot.n - 1 : 1, pc = ps.pierce ? ps.pierce.pct : 100 - ps.lineShot.fall; lst.slice(0, cnt).forEach(function (e, i) { hit(B, u, e, { pct: ps.lineShot ? 100 - ps.lineShot.fall * (i + 1) : pc, noMp: 1 }); }); }
    if (u.splash) { enemiesIn(B, u, t.x, t.y, u.splash).forEach(function (e) { if (e !== t) hit(B, u, e, { pct: 50, noMp: 1, aoe: 1 }); }); ev(B, { e: 'area', x: t.x, y: t.y, r: u.splash, a: u.id, k: 'boom' }); }
    if (ps.bounce) { var e3 = nearestOther(B, t, null, mil(3)); if (e3 && isEnemy(B, u, e3) && e3 !== t) { ev(B, { e: 'shot', a: t.id, b: e3.id, k: 'bolt' }); hit(B, u, e3, { pct: ps.bounce.pct, noMp: 1 }); } }
    var cch = ps.ccChance || fx.ccChance; if (cch && t.alive && B.R(100) < cch.pct) applySt(B, u, t, cch.st);
    var cn = ps.ccHit || fx.ccHit; if (cn && t.alive && u.hits % cn.n === cn.n - 1) applySt(B, u, t, cn.st);
    if (fx.hpDmg && t.alive) hit(B, u, t, { flat: Math.max(1, floor(t.hp * fx.hpDmg / 100)), dt: 2, noMp: 1 });
    if (fx.thunder && B.R(100) < fx.thunder.chance) { var th = nearestOther(B, u, t, mil(3)) || t; if (th.alive) { hit(B, u, th, { pct: fx.thunder.pct, dt: 1, skill: 0, noMp: 1, noCrit: 1, ranged: true }); ev(B, { e: 'shot', a: u.id, b: th.id, k: 'bolt' }); } }
    var burn = ps.burnOnHit || fx.burnOnHit; if (burn && t.alive) applySt(B, u, t, { burn: burn.pct, dur: burn.dur });
    var slow = ps.slowOnHit || fx.slowOnHit; if (slow && t.alive) applySt(B, u, t, { slow: slow.pct, dur: slow.dur });
    if (ps.atkDownOnHit && t.alive) { t.adS = Math.min(ps.atkDownOnHit.stack, t.adS + 1); t.adT = sec(ps.atkDownOnHit.dur); }
    if (ps.knockChance && t.alive && B.R(100) < ps.knockChance.pct) applySt(B, u, t, { knock: ps.knockChance.dist });
  }

  function unitAct(B, u) {
    if (u.stun > 0) return;
    if (u.castT > 0) return;
    var sqd = u.sq >= 0 ? B.squads[u.sq] : null;
    var mode = squadMode(B, u, sqd);
    u.hurry = !!mode.hurry;
    // thả diều
    if (u.kiteT > 0 && u.rootT <= 0) { moveToward(B, u, u.x + u.kx, u.y + u.ky, 0); u.standT = 0; return; }
    // chọn mục tiêu
    var t = u.tgt >= 0 ? byId(B, u.tgt) : null;
    if (t && t.stealthT > 0 && d2(u, t) > sq(mil(2))) t = null;
    if (u.tauntT > 0) { var tb = byId(B, u.tauntBy); if (tb) t = tb; }
    if (mode.focus) { var ft = (t && t.alive && t.sq === mode.focus.idx && (B.tick + u.id) % 10 !== 0) ? t : focusTarget(B, u, mode.focus); if (ft) t = ft; else { t = null; mode.goal = [mode.focus.cx, mode.focus.cy]; } }
    else if (mode.noFight) t = null;
    else if (!t || (B.tick + u.id) % 10 === 0) { var nt = chooseTarget(B, u, sqd, mode); if (nt) t = nt; else if (mode.alert) t = null; }
    u.tgt = t ? t.id : -1;
    // kỹ năng
    if (!mode.noFight && u.act && tryAct(B, u)) return;
    if (!mode.noFight && canCast(B, u)) { cast(B, u); return; }
    if (t && inRange(B, u, t) && (u.cls !== 'xa' || u.role === 'congthanh' || losClear(B, u, t))) {
      u.standT++;
      if (u.cd <= 0) attack(B, u, t);
      if (u.ps.moveShoot) return;
      return;
    }
    u.standT = 0;
    if (u.ps.moveShoot && t && inRange(B, u, t) && u.cd <= 0) attack(B, u, t);
    // di chuyển
    var gx, gy, tx, ty;
    if (t && !mode.goal) { tx = t.x; ty = t.y; var ts = t.sq >= 0 ? B.squads[t.sq] : null; gx = floor(t.x / M); gy = floor(t.y / M); }
    else if (mode.goal) { tx = mode.goal[0]; ty = mode.goal[1]; gx = floor(tx / M); gy = floor(ty / M); }
    else return;
    if (u.rootT > 0) return;
    var s = pathStep(B, u, gx, gy, tx, ty);
    u.moved += s;
  }
  // Lính đi theo tướng: giữ vị trí tương đối với tướng như lúc xếp đội
  function squadMode(B, u, sqd) {
    var o = squadMode0(B, u, sqd);
    if (!sqd || u.cap || u.monster || B.storm || o.focus) return o;
    var g = sqd.units[0];
    if (!g || g === u || !g.alive || !g.cap) return o;
    var ox = u.spawnX - g.spawnX, oy = u.spawnY - g.spawnY;
    if (o.goal && !o.abs) { var gx = o.goal[0] + ox, gy = o.goal[1] + oy, cx = floor(gx / M), cy = floor(gy / M); if (passable(B, cx, cy)) o.goal = [gx, gy]; }
    else if (!o.noFight) {
      var dg = d2(u, g);
      if (dg > sq(mil(5)) && !nearestEnemy(B, u, rngE(B, u) + mil(1.5))) { var tx = g.x + ox, ty = g.y + oy; o.goal = passable(B, floor(tx / M), floor(ty / M)) ? [tx, ty] : [g.x, g.y]; if (dg > sq(mil(7))) o.hurry = true; }
    }
    return o;
  }
  // Chế độ của đội: tư thế + Cờ Lệnh. Trả {goal:[x,y]|null, noFight, alert}
  function squadMode0(B, u, sqd) {
    var o = { goal: null, noFight: false, alert: 0 };
    if (!sqd) return o;
    if (u.monster) { o.alert = mil(7); if (d2(u, { x: u.spawnX, y: u.spawnY }) > sq(mil(8))) { o.goal = [u.spawnX, u.spawnY]; o.noFight = true; } return o; }
    if (B.storm) return o;
    var st = sqd.st;
    if (sqd.fl.length && sqd.step >= sqd.fl.length && st === 'giu') st = 'tc';   // xong hết cờ → tự động tìm địch gần nhất
    if (sqd.step < sqd.fl.length) {
      var f = sqd.fl[sqd.step];
      if (f.c === 'X') { o.goal = [f.x * M + 500, f.y * M + 500]; o.noFight = sqd.breakT <= 0; if (!o.noFight) { o.goal = null; o.alert = mil(2); } return o; }
      if (f.c === 'D') { o.alert = Math.max(rngE(B, u) + mil(4), mil(9)); if (sqd.hurtT > B.tick) o.alert = mil(99); var near = nearestEnemy(B, u, o.alert); if (!near) o.goal = [f.x * M + 500, f.y * M + 500]; return o; }
      if (f.c === 'T') { // Cờ Tím: dồn lực diệt một đạo quân địch
        var tt = squadBySeat(B, f.seat, f.sq);
        if (tt && tt.alive > 0 && tt.team !== sqd.team) { o.focus = tt; o.alert = mil(99); return o; }
      }
      if (f.c === 'V') {
        var ts = squadById(B, sqd.pl, f.sq);
        if (ts && ts.alive > 0) {
          var k = f.k || 'sat';
          if (k === 'theo') { o.alert = rngE(B, u) + mil(2); if (ts.hurtT > B.tick) { o.alert = mil(99); o.assist = ts.hurtBy; } var dTo = sq(ts.cx - u.x) + sq(ts.cy - u.y); if (dTo > sq(mil(4.5)) && !nearestEnemy(B, u, o.alert)) o.goal = [ts.cx, ts.cy]; if (dTo > sq(mil(7))) o.hurry = true; return o; }
          o.alert = Math.max(rngE(B, u) + mil(3), mil(8));
          if (ts.hurtT > B.tick) { o.alert = mil(99); o.assist = ts.hurtBy; }   // đạo quân được hộ tống bị đánh → lao vào yểm trợ
          var dT = sq(ts.cx - u.x) + sq(ts.cy - u.y);
          if (dT > sq(mil(k === 'bv' ? 3 : 4))) { if (!nearestEnemy(B, u, mil(2.5))) o.goal = [ts.cx, ts.cy]; if (dT > sq(mil(6))) o.hurry = true; }
          return o;
        }
      }
    }
    if (st === 'giu') { o.alert = rngE(B, u) + mil(4); if (sqd.hurtT > B.tick) o.alert = mil(99); if (d2(u, { x: u.spawnX, y: u.spawnY }) > sq(mil(4))) { o.abs = true; o.goal = [u.spawnX, u.spawnY]; o.noFight = !nearestEnemy(B, u, rngE(B, u) + u.rad + 500); } }
    else if (st === 'rut' && sqd.mhp && sqd.hp * 100 < sqd.mhp * 30) { var ne = nearestEnemy(B, u, rngE(B, u) + mil(.5)); if (!ne) { o.abs = true; o.goal = [u.spawnX, u.spawnY]; o.noFight = true; } else o.alert = rngE(B, u) + mil(1); }
    return o;
  }
  function squadBySeat(B, seat, id) { for (var i = 0; i < B.squads.length; i++) { var s = B.squads[i]; if (!s.monster && String(s.seat) === String(seat) && s.id === id) return s; } return null; }
  function focusTarget(B, u, fs) {
    var best = null, bd = 1e18;
    fs.units.forEach(function (e) { if (!e.alive) return; var d = d2(u, e); if (e.stealthT > 0 && d > sq(mil(2))) return; if (d < bd) { bd = d; best = e; } });
    return best;
  }
  function squadById(B, plIdx, id) { for (var i = 0; i < B.squads.length; i++) { var s = B.squads[i]; if (s.pl === plIdx && s.id === id) return s; } return null; }
  // cập nhật bước cờ mỗi 10 tick
  function updateFlags(B) {
    B.squads.forEach(function (s) {
      if (s.monster || s.alive <= 0 || s.step >= s.fl.length) return;
      var f = s.fl[s.step];
      if (s.breakT > 0) s.breakT -= 10;
      if (f.c === 'X' || f.c === 'D') {
        var fx = f.x * M + 500, fy = f.y * M + 500, inR = 0, alive = 0;
        s.units.forEach(function (u) { if (!u.alive) return; alive++; if (sq(u.x - fx) + sq(u.y - fy) <= sq(mil(3))) inR++; });
        var dd = sq(s.cx - fx) + sq(s.cy - fy);
        if (f.c === 'X') {
          if (dd < s.lastD - sq(mil(.3))) { s.lastD = dd; s.blockT = 0; }
          else { s.blockT += 10; var cl = s.units.some(function (u) { return u.alive && nearestEnemy(B, u, mil(1.6)); }); if (s.blockT >= sec(3) && cl) { s.breakT = sec(2); s.blockT = 0; } }
        }
        var fighting = f.c === 'D' && s.units.some(function (u) { return u.alive && u.tgt >= 0; });
        if (alive && inR * 100 >= alive * 60 && !fighting) { s.step++; s.lastD = 1e15; s.blockT = 0; }
      } else if (f.c === 'V') { var ts = squadById(B, s.pl, f.sq); if (!ts || ts.alive <= 0) s.step++; }
      else if (f.c === 'T') { var tt = squadBySeat(B, f.seat, f.sq); if (!tt || tt.alive <= 0 || tt.team === s.team) s.step++; }
    });
  }

  /* ---------------- hào quang, mật độ, tháp, lệnh soái ---------------- */
  function updateAuras(B) {
    var us = B.units;
    us.forEach(function (u) { if (u.alive) u.au = { atk: 0, def: 0, as: 0, ls: 0, rng: 0, mpGain: 0, regenPct: 0, rdr: 0, fdef: 0, cdef: 0, guard: 0 }; });
    us.forEach(function (s) {
      if (!s.alive || s.monster) return;
      var ps = s.ps, p = pl(B, s);
      if (ps.aura) {
        var a = ps.aura, mul = 100, r = mil(a.r);
        if (s.role === 'chihuy' && p && p.cores.uydanh) { mul = 150; r += mil(2); }
        us.forEach(function (x) {
          if (!x.alive || x.team !== s.team || x.monster || d2(s, x) > r * r) return;
          var au = x.au;
          if (a.atk) au.atk = Math.max(au.atk, floor(a.atk * mul / 100)); if (a.def) au.def = Math.max(au.def, floor(a.def * mul / 100)); if (a.as) au.as = Math.max(au.as, floor(a.as * mul / 100));
          if (a.ls) au.ls = Math.max(au.ls, floor(a.ls * mul / 100)); if (a.rngAdd) au.rng = Math.max(au.rng, a.rngAdd); if (a.mpGain) au.mpGain = Math.max(au.mpGain, floor(a.mpGain * mul / 100));
          if (a.regenPct) au.regenPct = Math.max(au.regenPct, a.regenPct); if (a.rangedDR) au.rdr = Math.max(au.rdr, a.rangedDR);
        });
      }
      if (ps.guardRanged) { var gr = mil(ps.guardRanged.r); us.forEach(function (x) { if (x.alive && x.team === s.team && x.cls !== 'can' && d2(s, x) <= gr * gr) x.au.guard = Math.max(x.au.guard, ps.guardRanged.pct); }); }
      if (ps.formation) { var fr = mil(ps.formation.r), c = 0; us.forEach(function (x) { if (x !== s && x.alive && x.team === s.team && x.role === s.role && x.race === s.race && d2(s, x) <= fr * fr) c++; }); s.au.fdef = Math.min(ps.formation.max, c * ps.formation.def); }
      if (ps.crowdDef) { var cr = mil(1.6) + s.rad, n = 0; us.forEach(function (x) { if (x.alive && isEnemy(B, s, x) && d2(s, x) <= cr * cr) n++; }); if (n >= ps.crowdDef.n) s.au.cdef = ps.crowdDef.def; }
    });
    // mật độ mỗi ô theo đội (cho Pháp sư/Công thành chọn cụm)
    var dens = B.dens || (B.dens = []), N = B.W * B.H;
    for (var i = 0; i < N; i++) dens[i] = null;
    us.forEach(function (u) { if (!u.alive) return; var k = cellOf(B, u.x, u.y), d = dens[k] || (dens[k] = {}); d[u.team] = (d[u.team] || 0) + 1; });
    for (var j = 0; j < N; j++) if (!dens[j]) dens[j] = ZD;
    // trạng thái đội
    B.squads.forEach(function (s) { var a = 0, x = 0, y = 0, hp = 0, mhp = 0; s.units.forEach(function (u) { mhp += u.mhp; if (u.alive) { a++; x += u.x; y += u.y; hp += u.hp; } }); s.alive = a; s.hp = hp; s.mhp = mhp; if (a) { s.cx = floor(x / a); s.cy = floor(y / a); } });
  }
  var ZD = {};
  function updateTowers(B) {
    B.towers.forEach(function (tw, i) {
      var cx = tw.x * M + 500, cy = tw.y * M + 500, teams = {}, nT = 0, tm = -1;
      B.units.forEach(function (u) { if (u.alive && !u.monster && sq(u.x - cx) + sq(u.y - cy) <= sq(mil(1.6))) { if (!teams[u.team]) { teams[u.team] = 1; nT++; tm = u.team; } } });
      if (nT === 1) {
        if (tw.cap !== tm) { tw.cap = tm; tw.capT = 0; }
        var fast = B.pls.some(function (p) { return p.team === tm && p.cores.lacochien; });
        tw.capT += fast ? 20 : 10;
        if (tw.capT >= sec(CFG.towerSec) && tw.team !== tm) { tw.team = tm; ev(B, { e: 'tower', i: i, team: tm }); }
      } else { tw.capT = 0; tw.cap = -1; }
    });
    B.pls.forEach(function (p) { var n = 0; B.towers.forEach(function (tw) { if (tw.team === p.team) n++; }); p.towerAtk = n * (CFG.towerAtk + (p.cores.lacochien ? 5 : 0)); });
  }
  function updateOrders(B) {
    B.pls.forEach(function (p) {
      var ords = TT.ORDERS[p.race]; if (!ords || p.out) return;
      var mine = B.units.filter(function (u) { return u.alive && u.pl === p.idx; }); if (!mine.length) return;
      var hp = 0; mine.forEach(function (u) { hp += u.hp; });
      ords.forEach(function (o, i) {
        if (p.used[i] || p.lv < o.age) return;
        var ok = false, w = o.when;
        if (w === 'start') ok = true;
        else if (w === 'engage') ok = p.engaged;
        else if (w === 'hp50') ok = p.engaged && hp * 100 < p.totalMax * 50;
        else if (w === 'hp60') ok = p.engaged && hp * 100 < p.totalMax * 60;
        else if (w === 't15') ok = B.tick >= sec(15);
        else if (w === 'souls5') ok = p.souls >= 5;
        else if (w === 'souls6') ok = p.souls >= 6;
        else if (w === 'crowd') ok = mine.some(function (u) { return u.cap && enemiesIn(B, u, u.x, u.y, mil(4)).length >= 8; });
        if (!ok) return;
        p.used[i] = true; runOrder(B, p, o, mine);
      });
    });
  }
  function runOrder(B, p, o, mine) {
    var f = o.fx;
    ev(B, { e: 'order', seat: p.seat, n: o.name, race: p.race });
    var engagedSquad = function () { var best = null, bv = -1; B.squads.forEach(function (s) { if (s.pl !== p.idx || s.alive <= 0) return; var v = s.units.filter(function (u) { return u.alive && u.tgt >= 0; }).length * 10 + s.alive; if (v > bv) { bv = v; best = s; } }); return best; };
    var bf = { t: sec(f.dur || 5) }; ['atk', 'as', 'def', 'dr', 'spd', 'dmg', 'cc', 'rng'].forEach(function (k) { if (f[k]) bf[k] = f[k]; });
    if (f.t === 'buffSquad') {
      var s = f.pick === 'items' ? (function () { var b = null, bv = -1; B.squads.forEach(function (q) { if (q.pl === p.idx && q.alive > 0 && q.items.length * 100 + q.alive > bv) { bv = q.items.length * 100 + q.alive; b = q; } }); return b; })() : engagedSquad();
      if (s) s.units.forEach(function (u) { if (u.alive) { addBuff(u, bf); ev(B, { e: 'fx', k: 'buff', a: u.id }); } });
    } else if (f.t === 'buffAll') { mine.forEach(function (u) { if (f.cls && u.cls !== f.cls) return; addBuff(u, bf); ev(B, { e: 'fx', k: 'buff', a: u.id }); }); }
    else if (f.t === 'debuffArea') {
      var es = engagedSquad(); if (!es) return; var cx = es.cx, cy = es.cy;
      B.units.forEach(function (e) { if (e.alive && e.team !== p.team && sq(e.x - cx) + sq(e.y - cy) <= sq(mil(f.r + 2))) { if (f.weak) { e.weakP = Math.max(e.weakP, f.weak); e.weakT = sec(f.dur); } if (f.slowAs) { e.slowAsP = Math.max(e.slowAsP, f.slowAs); e.slowAsT = sec(f.dur); } } });
      ev(B, { e: 'area', x: cx, y: cy, r: mil(f.r + 2), k: 'curse', a: -1 });
    } else if (f.t === 'ccArea') {
      var es2 = engagedSquad(); if (!es2) return; var src2 = null; es2.units.forEach(function (x) { if (x.alive && !src2) src2 = x; }); if (!src2) return;
      B.units.forEach(function (e) { if (e.alive && e.team !== p.team && sq(e.x - es2.cx) + sq(e.y - es2.cy) <= sq(mil(f.r + 2))) applySt(B, src2, e, f.st); });
      ev(B, { e: 'area', x: es2.cx, y: es2.cy, r: mil(f.r + 2), k: 'curse', a: -1 });
    } else if (f.t === 'healAll') { mine.forEach(function (u) { var g = heal(B, u, u, floor(u.mhp * f.maxPct / 100)); ev(B, { e: 'heal', a: u.id, b: u.id, v: g }); }); }
    else if (f.t === 'shieldAll') { mine.forEach(function (u) { u.shield = Math.max(u.shield, floor(u.mhp * f.maxPct / 100)); u.shieldT = sec(f.dur); ev(B, { e: 'fx', k: 'shield', a: u.id }); }); }
    else if (f.t === 'summonBase') { var z = TT.zoneOf(B.inp.mode, p.side), zx = ((z.x0 + z.x1 + 1) / 2) * M, zy = ((z.y0 + z.y1 + 1) / 2) * M; B.spawnQ.push({ pl: p, role: f.role, n: f.n, pct: f.pct, x: floor(zx), y: floor(zy), sq: -1 }); }
    else if (f.t === 'sacrifice') {
      var low = null; mine.forEach(function (u) { if (!low || u.hp * 100 / u.mhp < low.hp * 100 / low.mhp) low = u; });
      if (low) { var dmg = floor(low.mhp * f.pct / 100) + f.flat; enemiesIn(B, low, low.x, low.y, mil(f.r)).forEach(function (e) { hit(B, null, e, { flat: dmg, dt: 2, noMp: 1, aoe: 1 }); }); ev(B, { e: 'area', x: low.x, y: low.y, r: mil(f.r), k: 'blood', a: low.id }); low.revive = 0; low.rebirth = false; die(B, low, null); addSouls(p, f.souls); }
    } else if (f.t === 'summonSouls') {
      if (p.souls < f.souls) return; p.souls -= f.souls;
      var big = null; B.squads.forEach(function (q) { if (q.pl === p.idx && q.alive > 0 && (!big || q.alive > big.alive)) big = q; });
      if (big) B.spawnQ.push({ pl: p, role: f.role, n: f.n, pct: f.pct, x: big.cx, y: big.cy, sq: -1 });
    }
  }
  function processSpawns(B) {
    var q = B.spawnQ; B.spawnQ = [];
    q.forEach(function (s) {
      if (!s.pl) return;
      var sqd = s.sq >= 0 ? B.squads[s.sq] : null;
      if (!sqd) { sqd = { idx: B.squads.length, id: -100 - B.squads.length, pl: s.pl.idx, seat: s.pl.seat, team: s.pl.team, role: s.role, n0: s.n, items: [], st: 'tc', fl: [], step: 0, ax: s.x, ay: s.y, units: [], temp: 1, name: TT.unitName(s.pl.race, s.role), cx: s.x, cy: s.y, alive: 0, hp: 0, mhp: 0, dmg: 0, taken: 0, healed: 0, kills: 0 }; B.squads.push(sqd); }
      for (var i = 0; i < s.n; i++) {
        var u = makeUnit(B, s.pl, null, s.role, { pct: s.pct, temp: true }); u.sq = sqd.idx;
        var ang = (i * 2094 + B.tick * 7) % 6283, p = placeFree(B, s.x + floor(700 * icos(ang) / M), s.y + floor(700 * isin(ang) / M));
        u.x = u.px = p[0]; u.y = u.py = p[1]; u.spawnX = u.x; u.spawnY = u.y; u.stealthT = 0;
        B.units.push(u); sqd.units.push(u); B.byId[u.id] = u;
        ev(B, { e: 'spawn', a: u.id });
      }
    });
  }

  /* ---------------- va chạm ---------------- */
  function separate(B) {
    var cell = 1000, W = B.W, grid = {}, us = B.units;
    for (var i = 0; i < us.length; i++) { var u = us[i]; if (!u.alive) continue; var k = floor(u.x / cell) + floor(u.y / cell) * W; (grid[k] || (grid[k] = [])).push(u); }
    for (var a = 0; a < us.length; a++) {
      var A = us[a]; if (!A.alive || A.pass) continue;
      var gx = floor(A.x / cell), gy = floor(A.y / cell);
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var lst = grid[(gx + ox) + (gy + oy) * W]; if (!lst) continue;
        for (var b = 0; b < lst.length; b++) {
          var Bu = lst[b]; if (Bu.id <= A.id || Bu.pass) continue;
          var dx = Bu.x - A.x, dy = Bu.y - A.y, rr = A.rad + Bu.rad, dd = dx * dx + dy * dy;
          if (dd >= rr * rr) continue;
          var l = TT.isqrt(dd); if (l === 0) { dx = (A.id % 7) - 3 || 1; dy = (Bu.id % 5) - 2 || 1; l = TT.isqrt(dx * dx + dy * dy); }
          var ov = rr - l, wa = Bu.rad * Bu.rad, wb = A.rad * A.rad, wt = wa + wb;
          if (A.stun > 0 && Bu.stun <= 0) { wa = wt; wb = 0; }
          var pa = floor(ov * wa / wt / 2), pb = floor(ov * wb / wt / 2);
          var ax = A.x - floor(dx * pa / l), ay = A.y - floor(dy * pa / l), bx = Bu.x + floor(dx * pb / l), by = Bu.y + floor(dy * pb / l);
          if (A.fly || passable(B, floor(ax / M), floor(ay / M))) { A.x = clamp(ax, 200, B.W * M - 200); A.y = clamp(ay, 200, B.H * M - 200); }
          if (Bu.fly || passable(B, floor(bx / M), floor(by / M))) { Bu.x = clamp(bx, 200, B.W * M - 200); Bu.y = clamp(by, 200, B.H * M - 200); }
        }
      }
    }
  }

  /* ---------------- vòng tick ---------------- */
  function step(B) {
    if (B.ended) return false;
    if (B.tick === 0) { B.byId = {}; B.units.forEach(function (u) { B.byId[u.id] = u; }); updateAuras(B); updateOrders(B); }
    B.tick++;
    var us = B.units, i, u;
    for (i = 0; i < us.length; i++) { u = us[i]; u.px = u.x; u.py = u.y; }
    if (B.tick % 10 === 0) { updateAuras(B); updateTowers(B); updateFlags(B); updateOrders(B); }
    // đạn bay tới
    if (B.proj.length) {
      var keep = [];
      for (i = 0; i < B.proj.length; i++) { var pj = B.proj[i]; if (pj.at > B.tick) { keep.push(pj); continue; } var s = B.byId[pj.src], t = B.byId[pj.tgt]; if (s && t && t.alive) resolveHit(B, s, t, pj.o); }
      B.proj = keep;
    }
    // trạng thái
    var perSec = B.tick % T;
    for (i = 0; i < us.length; i++) {
      u = us[i]; if (!u.alive) continue;
      if (u.cd > 0) u.cd--; if (u.castT > 0) u.castT--; if (u.actCd > 0) u.actCd--; if (u.stun > 0) u.stun--; if (u.rootT > 0) u.rootT--; if (u.silT > 0) u.silT--; if (u.airT > 0) u.airT--; if (u.kiteT > 0) u.kiteT--;
      if (u.slowT > 0 && --u.slowT === 0) u.slowP = 0; if (u.slowAsT > 0 && --u.slowAsT === 0) u.slowAsP = 0;
      if (u.shieldT > 0 && --u.shieldT === 0) u.shield = 0; if (u.tauntT > 0 && --u.tauntT === 0) u.tauntBy = -1;
      if (u.stealthT > 0) u.stealthT--; if (u.blockT > 0 && --u.blockT === 0) u.block = 0;
      if (u.vulnT > 0 && --u.vulnT === 0) u.vulnP = 0; if (u.weakT > 0 && --u.weakT === 0) u.weakP = 0; if (u.shredT > 0 && --u.shredT === 0) u.shredP = 0;
      if (u.antiT > 0 && --u.antiT === 0) u.antiP = 0; if (u.adT > 0 && --u.adT === 0) u.adS = 0;
      // buff
      if (u.buffs.length) {
        var bs = { atk: 0, as: 0, def: 0, dr: 0, spd: 0, ls: 0, rng: 0, dmg: 0, reflect: 0, regenPct: 0, cc: 0 }, nb = [];
        for (var k = 0; k < u.buffs.length; k++) { var b = u.buffs[k]; if (--b.t <= 0) continue; nb.push(b); for (var key in b) if (key !== 't') bs[key] += b[key]; }
        u.buffs = nb; u.bs = nb.length ? bs : null;
      } else u.bs = null;
      if ((perSec + u.id) % T === 0) {
        // mỗi giây: đốt, hồi máu, đầm lầy
        if (u.burnT > 0) { u.burnT -= T; var src = B.byId[u.burnS]; hit(B, src && src.alive ? src : null, u, { flat: u.burnD, dt: 2, noMp: 1 }); if (!u.alive) continue; }
        if (u.ifx.pulse) { var pls = u.ifx.pulse; enemiesIn(B, u, u.x, u.y, mil(pls.r)).forEach(function (e) { hit(B, u, e, { pct: pls.pct, dt: 1, noMp: 1, noCrit: 1, aoe: 1 }); }); }
        if (u.mpRegen && u.mmp > 0 && u.mp < u.mmp) u.mp = Math.min(u.mmp, u.mp + u.mpRegen);
        var reg = u.regen + floor(u.mhp * ((u.au ? u.au.regenPct : 0) + (u.bs ? u.bs.regenPct : 0) + (u.ifx.regenPct || 0)) / 100);
        if (u.ps.regenLow && u.hp * 100 < u.mhp * u.ps.regenLow.below) reg += floor(u.mhp * u.ps.regenLow.pct / 100);
        if (reg > 0 && u.hp < u.mhp) heal(B, u.race === 'demon' ? u : null, u, reg);
        if (!u.fly && u.race !== 'demon' && terAt(B, u.x, u.y) === 4) { hit(B, null, u, { flat: Math.max(1, floor(u.mhp / 100)), dt: 2, noMp: 1 }); if (!u.alive) continue; }
      }
    }
    // hành động
    for (i = 0; i < us.length; i++) { u = us[i]; if (u.alive) unitAct(B, u); }
    separate(B);
    if (B.spawnQ.length) processSpawns(B);
    // bão sau 5 phút
    if (B.tick > B.maxTick && (B.tick - B.maxTick) % T === 0) {
      B.storm++; var sd = CFG.stormBase * Math.pow(2, Math.min(40, B.storm - 1));
      ev(B, { e: 'storm', k: B.storm, d: sd });
      teamHpSnap(B);
      for (i = 0; i < us.length; i++) { u = us[i]; if (u.alive) hit(B, null, u, { flat: sd, dt: 2, noMp: 1, storm: 1 }); }
    }
    checkEnd(B);
    return !B.ended;
  }
  function teamHpSnap(B) { var h = {}; B.units.forEach(function (u) { if (u.alive && !u.monster) h[u.team] = (h[u.team] || 0) + u.hp; }); B.hpSnap = h; }
  function checkEnd(B) {
    var alive = {}, teams = [];
    B.units.forEach(function (u) { if (u.alive && !u.monster && !alive[u.team]) { alive[u.team] = 1; } });
    var allTeams = []; B.pls.forEach(function (p) { if (allTeams.indexOf(p.team) < 0) allTeams.push(p.team); });
    allTeams.forEach(function (tm) { if (!alive[tm] && B.elimAt[tm] == null) { B.elimAt[tm] = B.tick; B.elimHp[tm] = B.hpSnap ? (B.hpSnap[tm] || 0) : 0; } });
    teams = allTeams.filter(function (tm) { return alive[tm]; });
    if (teams.length <= 1 || B.tick >= B.maxTick + 60 * T) {
      B.ended = true;
      teams.forEach(function (tm) { B.elimAt[tm] = 1e9; var h = 0; B.units.forEach(function (u) { if (u.alive && u.team === tm) h += u.hp; }); B.elimHp[tm] = h; });
      ev(B, { e: 'end' });
    }
  }
  function result(B) {
    var teams = []; B.pls.forEach(function (p) { if (teams.indexOf(p.team) < 0) teams.push(p.team); });
    // hạng: bị loại muộn hơn → cao hơn; cùng lúc thì máu trước đó nhiều hơn; rồi số hạ gục
    var tk = {}; B.pls.forEach(function (p) { tk[p.team] = (tk[p.team] || 0) + p.kills; });
    teams.sort(function (a, b) { return (B.elimAt[b] - B.elimAt[a]) || (B.elimHp[b] - B.elimHp[a]) || (tk[b] - tk[a]) || (a - b); });
    var rankOf = {}; teams.forEach(function (tm, i) { rankOf[tm] = i + 1; });
    var res = {
      ticks: B.tick, sec: Math.ceil(B.tick / T), teamRank: rankOf, nTeams: teams.length,
      players: B.pls.map(function (p) {
        var alive = 0, hp = 0; B.units.forEach(function (u) { if (u.alive && u.pl === p.idx) { alive++; hp += u.hp; } });
        return { seat: p.seat, team: p.team, rank: rankOf[p.team], kills: p.kills, mkills: p.mkills, dmg: p.dmg, taken: p.taken, healed: p.healed, alive: alive, hp: hp, souls: p.souls, orders: p.used.slice() };
      }),
      squads: B.squads.filter(function (s) { return !s.monster && !s.temp; }).map(function (s) { return { seat: s.seat, id: s.id, role: s.role, name: s.name, n: s.n0, alive: s.units.filter(function (u) { return u.alive; }).length, dmg: s.dmg, taken: s.taken, healed: s.healed, kills: s.kills }; })
    };
    var sum = B.units.map(function (u) { return [u.id, u.alive ? 1 : 0, u.hp, u.x >> 4, u.y >> 4]; });
    res.hash = TT.fnv64(TT.stable({ r: res.players, t: B.tick, u: sum }));
    return res;
  }
  /* Chỉ số thực của một quân (đội trưởng hoặc lính thường) với Lõi, trang bị, thiên phú, ngày/đêm — cho bảng đội và tooltip */
  Battle.previewStats = function (ctx, p, q, cap) {
    var cf = {}; (p.cores || []).forEach(function (c) { if (TT.CORES[c]) cf[c] = TT.CORES[c]; });
    var items = 0; (p.squads || []).forEach(function (s) { items += s.it.length; });
    var pl = { idx: 0, seat: p.seat, team: 0, race: p.race, talent: p.talent, mar: R_MAR(p), cores: cf, itemsTotal: items };
    var B = { inp: { day: ctx.day || 1, event: ctx.event, weather: ctx.weather }, nid: 1 };
    var sqd = { idx: 0, items: q.it || [], n0: q.n, up: q.up || [0, 0, 0, 0], sm: q.sm };
    var u = makeUnit(B, pl, sqd, q.t, { cap: !!cap });
    var bs = null, au = null; u.bs = bs; u.au = au;
    return { hp: u.mhp, atk: u.atk, def: u.def, as: u.as / 100, rng: u.rng / 1000, spd: Math.round(u.spd * T / 10) / 100, mp: u.mmp, mp0: u.mp, crit: u.crit, dodge: u.dodge, ls: u.ls, dt: u.dt };
  };
  Battle._internal = { makeUnit: makeUnit, atkE: atkE, asE: asE, defE: defE };
  if (typeof module !== 'undefined') module.exports = Battle;
})(typeof window !== 'undefined' ? window : global);
