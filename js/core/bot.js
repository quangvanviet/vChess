/* Bot — 3 mức độ khó, sinh lệnh hợp lệ bằng chính lõi luật. Chạy trên máy chủ phòng
 * (lệnh của bot được ghi vào sổ lệnh như người thật, nên các máy khác không cần biết độ khó).
 *  - easy   : kinh tế chậm, chọn nước có nhiễu, hay bỏ lỡ cơ hội, không dùng kỹ năng.
 *  - medium : tham lam có tính an toàn Vua, dùng kỹ năng tăng sát thương, kinh tế ổn định.
 *  - hard   : mô phỏng từng nước bằng lõi luật, đánh giá trạng thái (vật chất, kinh tế, Đời,
 *             bản đồ đe dọa lượt sau của đối thủ, áp lực lên Vua địch), kết hợp kỹ năng + đòn,
 *             mua quân khắc chế, giữ quân hộ vệ Vua, lên Đời đúng nhịp.
 */
(function (G) {
  'use strict';
  var TT = G.TT, E = TT.Engine, U = TT.UNITS, CFG = TT.CONFIG;
  var Bot = TT.Bot = {};

  Bot.LEVELS = {
    easy:   { name: 'Dễ', noise: 6, skipChance: .22, skills: false, threat: false, sim: false, workerBase: 4, ageDelay: 4, reserve: false, maxActs: 9 },
    medium: { name: 'Trung bình', noise: .8, skipChance: 0, skills: true, threat: 'king', sim: false, workerBase: 5, ageDelay: 0, reserve: true, maxActs: 9 },
    hard:   { name: 'Khó', noise: 0, skipChance: 0, skills: true, threat: 'full', sim: true, workerBase: 6, ageDelay: -1, reserve: true, maxActs: 9, simTop: 18 }
  };
  Bot.levelName = function (lv) { return (Bot.LEVELS[lv] || Bot.LEVELS.medium).name; };

  /* ---------------- tiện ích ---------------- */
  function teams(st) { return E.teamIds(st).map(function (id) { return st.teams[id]; }); }
  function mine(st, p) { return teams(st).filter(function (t) { return t.o === p; }); }
  function foes(st, p) { return teams(st).filter(function (t) { return !E.ally(st, t.o, p); }); }
  function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  function apply(ctx, cmd) {
    var r = E.apply(ctx.st, Object.assign({ p: ctx.p }, cmd));
    if (r.ok) { ctx.st = r.state; ctx.cmds.push(Object.assign({ p: ctx.p }, cmd)); return true; }
    return false;
  }
  function sim(st, p, cmds) {
    var s = st;
    for (var i = 0; i < cmds.length; i++) { var r = E.apply(s, Object.assign({ p: p }, cmds[i])); if (!r.ok) return null; s = r.state; }
    return s;
  }
  function unitVal(t) {
    if (t.t === 'king') return 0;
    if (t.t === 'worker') return 2.6;
    if (t.t === 'beast') return 4 * (t.hp || 1);
    return TT.baseValue(t.t);
  }
  function enemyKings(st, p) { return foes(st, p).filter(function (t) { return t.t === 'king'; }); }
  function nearestKing(st, p, t) { var ks = enemyKings(st, p); var best = null, bd = 99; ks.forEach(function (k) { var d = dist(t, k); if (d < bd) { bd = d; best = k; } }); return best; }

  /* Bản đồ đe dọa: sát thương tối đa mà đối thủ có thể gây lên từng đội của p ở lượt kế. */
  Bot.threatMap = function (st, p) {
    var out = {};
    foes(st, p).forEach(function (et) {
      var ep = st.players[et.o];
      if (!ep.alive || ep.pturn + 1 <= CFG.peaceTurns) return;
      var prof = E.atkProfile(st, et); if (prof.kind === 'none') return;
      var ox = et.x, oy = et.y, base = et.t === 'beast' ? 1 : et.n;
      var opts = [{ x: ox, y: oy, moved: false }];
      E.moveTargets(st, et.id, et.n).forEach(function (m) { if (!m.merge) opts.push({ x: m.x, y: m.y, moved: true }); });
      opts.forEach(function (m) {
        et.x = m.x; et.y = m.y;
        var dmg = base * (et.t === 'siege' && !m.moved ? 2 : 1);
        E.attackTargets(st, et.id, m.x, m.y, m.moved).forEach(function (a) {
          var tt = st.teams[a.id]; if (!tt || tt.o !== p) return;
          var d = dmg - (tt.t === 'shield' && prof.kind === 'ranged' ? 1 : 0);
          if (!out[a.id] || out[a.id] < d) out[a.id] = d;
        });
      });
      et.x = ox; et.y = oy;
    });
    return out;
  };

  /* số quân địch có thể vươn tới Vua trong 1–2 hành động (bỏ qua vật cản) */
  Bot.exposure = function (st, p, king) {
    var n = 0;
    foes(st, p).forEach(function (t) {
      var pr = E.atkProfile(st, t); if (pr.kind === 'none') return;
      var mv = U[t.t].move.dirs === 'knight' ? 2 : U[t.t].move.range;
      var reach = mv + Math.max(1, pr.range) + 1;
      var d = dist(t, king);
      if (d <= reach) n += d <= mv + pr.range ? 1.5 : 1;
    });
    return n;
  };
  function income(st, p) {
    var inc = 0;
    mine(st, p).forEach(function (t) { if (t.t === 'worker') inc += t.n * (st.tiles[t.y * st.W + t.x] === t.job ? 2 : 1); });
    return inc;
  }

  /* Hàm đánh giá trạng thái theo góc nhìn p (dùng cho bot Khó) */
  Bot.evaluate = function (st, p) {
    var pl = st.players[p];
    if (!pl.alive) return -1e6;
    if (st.over) return (st.winner || []).indexOf(p) >= 0 ? 1e6 : -1e5;
    var s = 0, myKing = null, enemiesAlive = 0;
    st.players.forEach(function (o, i) { if (o.alive && !E.ally(st, i, p)) enemiesAlive++; });
    var foeVal = 0;
    teams(st).forEach(function (t) {
      var v = unitVal(t) * (t.t === 'beast' ? 1 : t.n);
      if (t.o === p) { s += v * 1.1; if (t.t === 'king') myKing = t; if (t.t === 'worker' && st.tiles[t.y * st.W + t.x] === t.job) s += 1.4 * t.n; }
      else if (!E.ally(st, t.o, p)) foeVal += v;
    });
    s -= foeVal / Math.max(1, enemiesAlive) * 1.05;
    s -= enemiesAlive * 40;
    s += (pl.res.V + pl.res.T + pl.res.G) * .3 + pl.souls * .7;
    s += pl.age * 9 + income(st, p) * 1.3;
    // đe dọa lượt sau: đối thủ chỉ có số hành động hữu hạn → tính các tổn thất lớn nhất
    var th = Bot.threatMap(st, p), losses = [], kingHit = false;
    Object.keys(th).forEach(function (id) {
      var t = st.teams[id]; if (!t) return;
      if (t.t === 'king') { kingHit = true; return; }
      var hp = E.teamHP(t), lost = Math.min(hp, th[id]);
      losses.push(lost * (t.t === 'beast' ? 4 : unitVal(t)) * (lost >= hp ? 1.25 : .9));
    });
    if (kingHit) s -= 3000;
    var eActs = 0; st.players.forEach(function (o, i) { if (o.alive && !E.ally(st, i, p)) eActs = Math.max(eActs, CFG.actionsByAge[o.age]); });
    losses.sort(function (a, b) { return b - a; }).slice(0, eActs).forEach(function (l) { s -= l * .75; });
    // áp lực tấn công: Vua địch nằm trong tầm đánh của ta
    var myTh = 0;
    st.players.forEach(function (o, i) {
      if (!o.alive || E.ally(st, i, p)) return;
      var ek = E.kingOf(st, i); if (!ek) return;
      teams(st).forEach(function (t) { if (t.o === p && E.attackTargets(st, t.id, t.x, t.y, false).some(function (a) { return a.id === ek.id; })) myTh++; });
    });
    s += Math.min(2, myTh) * 25;
    // áp lực lên Vua địch + hộ vệ Vua mình
    var combat = mine(st, p).filter(function (t) { return U[t.t].combat && t.t !== 'king'; });
    combat.forEach(function (t) {
      var k = nearestKing(st, p, t); if (k) s -= dist(t, k) * .22 * Math.min(3, t.n);
      if (myKing && dist(t, myKing) <= 1) s += 1.2;
    });
    if (myKing) {
      var guards = combat.filter(function (t) { return dist(t, myKing) <= 1; }).length;
      s += Math.min(3, guards) * 6;
      s -= Bot.exposure(st, p, myKing) * 34;
      if (E.spawnCells(st, p).some(function (c) { return c[0] === myKing.x && c[1] === myKing.y; })) s += 6;
    }
    st.players.forEach(function (o, i) { if (!o.alive || E.ally(st, i, p)) return; var ek = E.kingOf(st, i); if (ek) s += Bot.exposure(st, i, ek) * 10; });
    return s;
  };

  /* ---------------- kinh tế ---------------- */
  function workers(st, p) { return mine(st, p).filter(function (t) { return t.t === 'worker'; }).reduce(function (a, t) { return a + t.n; }, 0); }
  function jobs(st, p) { var c = { V: 0, T: 0, G: 0 }; mine(st, p).forEach(function (t) { if (t.t === 'worker') c[t.job] += t.n; }); return c; }
  function freeSpawn(st, p, type, job) {
    var cells = E.spawnCells(st, p), pl = st.players[p];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; if (!E.exists(st, c[0], c[1])) continue;
      var o = E.teamAt(st, c[0], c[1]);
      if (o && o.o === p && o.t === type && o.rest === pl.pturn && o.n < E.cap(st, p) && type !== 'beast' && (!job || o.job === job)) return c;
    }
    var order = type === 'worker' ? [1, 6, 0, 7, 2, 5, 3, 4] : [3, 4, 2, 5, 1, 6, 0, 7];
    for (var j = 0; j < order.length; j++) { var d = cells[order[j]]; if (E.exists(st, d[0], d[1]) && !E.teamAt(st, d[0], d[1])) return d; }
    return null;
  }
  var PREF = {
    dragon: ['chariot', 'elephant', 'siege', 'cavalry', 'soldier', 'archer', 'shield'],
    human: ['chariot', 'siege', 'cavalry', 'archer', 'soldier', 'shield'],
    fairy: ['chariot', 'siege', 'cavalry', 'archer', 'mage', 'soldier'],
    demon: ['chariot', 'siege', 'cavalry', 'soldier', 'archer', 'shield']
  };
  function armyPlan(st, p, L) {
    var f = st.players[p].faction, list = PREF[f].slice();
    if (L.sim) {
      // khắc chế: nhiều tầm xa → Kỵ/Thích khách; đội đông → Công thành; nhiều cận chiến → Thuẫn/Cung
      var ranged = 0, big = 0, melee = 0;
      foes(st, p).forEach(function (t) { if (TT.RANGED[t.t]) ranged += t.n; else if (U[t.t].combat && t.t !== 'king') melee += t.n; if (t.n >= 4) big++; });
      var front = [];
      if (ranged >= 3) front.push('cavalry', 'assassin');
      if (big >= 2) front.push('siege');
      if (melee >= 5) front.push('archer', 'shield');
      list = front.concat(list).filter(function (u, i, a) { return a.indexOf(u) === i; });
    }
    return list;
  }
  function economy(ctx) {
    var L = ctx.L, p = ctx.p;
    var pl = function () { return ctx.st.players[p]; };
    var turn = pl().pturn, dec = turn >= CFG.declineTurn;
    // lên Đời
    var goals = [0, 0, 3, 8, 15].map(function (t) { return t + L.ageDelay; });
    var wk = workers(ctx.st, p);
    var g = 0;
    while (pl().age < 4 && g++ < 3) {
      var nx = pl().age + 1;
      if (turn < goals[nx]) break;
      if (L.sim && wk < [0, 0, 4, 8, 11][nx]) break;
      if (!apply(ctx, { c: 'age' })) break;
    }
    // Dân
    var target = dec ? 0 : L.workerBase + 2 * pl().age + (turn > 12 ? 2 : 0);
    var nextAge = CFG.ageCosts[pl().age + 1];
    g = 0;
    while (workers(ctx.st, p) < target && pl().res.V >= 2 && g++ < 14) {
      var jc = jobs(ctx.st, p);
      var need = { V: 1, T: pl().faction === 'dragon' ? 1.6 : 1.1, G: .9 };
      if (L.sim && nextAge) { need.V += nextAge.V / 10; need.T += nextAge.T / 10; need.G += nextAge.G / 10; }
      var job;
      if (L.sim) {
        var want = { V: 2, T: pl().faction === 'dragon' ? 3 : 2, G: 1.5 };
        armyPlan(ctx.st, p, L).slice(0, 3).forEach(function (u) { if (U[u].age <= pl().age) { var pr = E.price(ctx.st, p, u); want.V += pr.V; want.T += pr.T; want.G += pr.G; } });
        if (nextAge) { want.V += nextAge.V * .6; want.T += nextAge.T * .6; want.G += nextAge.G * .6; }
        job = ['V', 'T', 'G'].sort(function (a, b) { return (pl().res[a] + 4 * jc[a]) / want[a] - (pl().res[b] + 4 * jc[b]) / want[b]; })[0];
      } else job = ['T', 'V', 'G'].sort(function (a, b) { return jc[a] / need[a] - jc[b] / need[b]; })[0];
      var c = freeSpawn(ctx.st, p, 'worker', job);
      if (!c || !apply(ctx, { c: 'buy', u: 'worker', job: job, cell: c })) break;
    }
    // Quân
    if (turn < 2) return;
    var list = armyPlan(ctx.st, p, L);
    g = 0;
    while (g++ < 12) {
      var bought = false;
      for (var i = 0; i < list.length; i++) {
        var u = list[i]; if (U[u].age > pl().age) continue;
        var price = E.price(ctx.st, p, u);
        if (L.reserve && pl().age < 4 && turn >= goals[pl().age + 1] - 2) {
          var ac = CFG.ageCosts[pl().age + 1];
          if (pl().res.V - price.V < ac.V * .6 || pl().res.T - price.T < ac.T * .6) continue;
        }
        var cc = freeSpawn(ctx.st, p, u);
        if (cc && apply(ctx, { c: 'buy', u: u, cell: cc })) { bought = true; break; }
      }
      if (!bought) break;
    }
    if (pl().age >= 4 && !pl().beast) { var bc = freeSpawn(ctx.st, p, 'beast'); if (bc) apply(ctx, { c: 'buy', u: 'beast', cell: bc }); }
    // Quỷ: Oán Hồn / Tái Sinh
    g = 0;
    while (pl().faction === 'demon' && pl().souls >= 3 && g++ < 3) {
      var sc = freeSpawn(ctx.st, p, 'none'); if (!sc) break;
      if (!apply(ctx, { c: pl().passive === 'taisinh' ? 'taisinh' : 'oanhon', cell: sc })) break;
    }
  }

  /* ---------------- ứng viên hành động ---------------- */
  function candidates(st, p, L) {
    var out = [], pl = st.players[p], peace = E.inPeace(st);
    var myKing = E.kingOf(st, p), threat = L.threat === 'king' || L.threat === 'full' ? Bot.threatMap(st, p) : {};
    var kingThreat = myKing && threat[myKing.id];
    var needRes = 'VTG'.split('').sort(function (a, b) { return pl.res[a] - pl.res[b]; })[0];
    mine(st, p).forEach(function (t) {
      var k = t.n - t.na; if (k <= 0) return;
      if (E.isResting(st, t) && pl.passive !== 'tienphong') return;
      var opts = [{ x: t.x, y: t.y, steps: 0, stay: true }].concat(E.moveTargets(st, t.id, k));
      opts.forEach(function (m) {
        var base = 0;
        if (m.merge) base = t.t === 'worker' ? .2 : .7;
        var tile = function (x, y) { return st.tiles[y * st.W + x]; };
        if (t.t === 'worker') {
          var good = tile(m.x, m.y) === t.job, was = tile(t.x, t.y) === t.job;
          if (good && !was) base += 6; if (was && !good) base -= 6;
          var onSp = E.spawnCells(st, p).some(function (c) { return c[0] === t.x && c[1] === t.y; });
          var toSp = E.spawnCells(st, p).some(function (c) { return c[0] === m.x && c[1] === m.y; });
          if (onSp && !toSp && !m.stay) base += 1.2;
          var nt = nearestTile(st, t); if (nt && !was) base += (dist(t, nt) - dist(m, nt)) * 1.5;
        } else if (t.t === 'king') {
          base -= .4; if (!m.stay && kingThreat) base += 4;
        } else if (!m.stay) {
          var nk = nearestKing(st, p, t);
          if (nk) base += (dist(t, nk) - dist(m, nk)) * (pl.pturn > 6 ? .9 : .4);
          if (myKing && dist(m, myKing) <= 1 && pl.pturn < 12) base += .3;
          if (threat[t.id]) base += 1.5; // tránh đòn
        }
        if (!m.stay || base > 0) out.push({ q: base, cmds: [{ c: 'act', id: t.id, k: k, to: m.stay ? null : [m.x, m.y] }] });
        if (peace || m.merge) return;
        var tmp = E.clone(st); tmp.teams[t.id].x = m.x; tmp.teams[t.id].y = m.y;
        E.attackTargets(tmp, t.id, m.x, m.y, !m.stay).forEach(function (a) {
          var target = st.teams[a.id];
          var pv = E.previewAttack(st, t.id, k, m.x, m.y, !m.stay, m.steps, a.x, a.y); if (!pv) return;
          var q = base * .3 + pv.dmg * 1.5;
          if (pv.kill) q += 4 + pv.hp * 2 + TT.baseValue(target.t);
          if (target.t === 'king') q += pv.kill ? 10000 : 25;
          var rw = target.t === 'worker' ? undefined : needRes;
          var act = { c: 'act', id: t.id, k: k, to: m.stay ? null : [m.x, m.y], tgt: [a.x, a.y], opt: { rw: rw, back: true } };
          out.push({ q: q, kill: pv.kill, cmds: [act], tgtId: a.id, dmg: pv.dmg, hp: pv.hp });
          if (L.skills) buffVariants(st, p, t, act, pv, target).forEach(function (v) { out.push(v); });
        });
      });
    });
    return out;
  }
  // kết hợp kỹ năng + đòn khi giúp hạ gục
  function buffVariants(st, p, t, act, pv, target) {
    var pl = st.players[p], f = pl.faction, out = [], ready = function (a) { return E.skillReady(st, p, a); };
    var whole = act.k === t.n;
    var add = function (pre, extraQ) { out.push({ q: (pv.kill ? 0 : 6) + 4 + pv.hp * 2 + TT.baseValue(target.t) + extraQ + (target.t === 'king' ? 10000 : 0), cmds: pre.concat([act]), buff: true }); };
    if (pv.kill) {
      if (f === 'demon' && ready('haphon') && whole) add([{ c: 'skill', a: 'haphon', id: t.id }], 3);
      if (f === 'dragon' && ready('longuy') && whole && E.atkProfile(st, t).kind === 'melee') add([{ c: 'skill', a: 'longuy', id: t.id }], 2);
      return out;
    }
    var need = pv.hp - pv.dmg;
    if (f === 'dragon' && ready('longluc') && whole && need <= Math.ceil(pv.dmg / 2)) add([{ c: 'skill', a: 'longluc', id: t.id }], 0);
    if (f === 'human' && ready('taitro') && whole && need <= 1 && pl.res.V + pl.res.T + pl.res.G >= 8) add([{ c: 'skill', a: 'taitro', id: t.id }], -2);
    if (f === 'demon' && t.t === 'siege' && pl.souls >= 1 && need <= 2) { var a2 = JSON.parse(JSON.stringify(act)); a2.opt.honphao = true; out.push({ q: 4 + pv.hp * 2 + TT.baseValue(target.t) + (target.t === 'king' ? 10000 : 0), cmds: [a2], buff: true }); }
    return out;
  }
  function nearestTile(st, t) {
    var best = null, bd = 99;
    for (var i = 0; i < st.tiles.length; i++) {
      if (st.tiles[i] !== t.job) continue;
      var x = i % st.W, y = (i / st.W) | 0, o = E.teamAt(st, x, y);
      if (o && o.id !== t.id) continue;
      var d = Math.max(Math.abs(x - t.x), Math.abs(y - t.y)); if (d < bd) { bd = d; best = { x: x, y: y }; }
    }
    return best;
  }

  /* kỹ năng độc lập (không gắn đòn) */
  function utilitySkills(ctx) {
    var st = ctx.st, p = ctx.p, pl = st.players[p], f = pl.faction, peace = E.inPeace(st);
    if (!ctx.L.skills) return;
    if (f === 'human' && !peace && E.skillReady(st, p, 'thuthue')) apply(ctx, { c: 'skill', a: 'thuthue' });
    var th = Bot.threatMap(ctx.st, p), king = E.kingOf(ctx.st, p);
    if (f === 'fairy' && king && th[king.id] && E.skillReady(ctx.st, p, 'thienmac')) apply(ctx, { c: 'skill', a: 'thienmac', id: king.id });
    if (peace) return;
    // Lời Nguyền lên đội địch mạnh nhất gần Vua mình
    if (f === 'demon' && pl.souls >= 2 && king && E.skillReady(ctx.st, p, 'loinguyen')) {
      var tgt = foes(ctx.st, p).filter(function (t) { return t.t !== 'worker' && dist(t, king) <= 4; }).sort(function (a, b) { return b.n - a.n; })[0];
      if (tgt) apply(ctx, { c: 'skill', a: 'loinguyen', id: tgt.id });
    }
    // Long Hống khi có ≥2 đội địch quanh đội Rồng
    if (f === 'dragon' && E.skillReady(ctx.st, p, 'longhong')) {
      var best = null, bn = 1;
      mine(ctx.st, p).forEach(function (t) { var n = foes(ctx.st, p).filter(function (o) { return o.t !== 'worker' && dist(o, t) <= 2; }).length; if (n > bn) { bn = n; best = t; } });
      if (best) apply(ctx, { c: 'skill', a: 'longhong', id: best.id });
    }
    // Huyết Tế: hy sinh Dân để hạ / gây hại
    if (f === 'demon' && E.skillReady(ctx.st, p, 'huyette')) {
      var done = false;
      mine(ctx.st, p).forEach(function (s) {
        if (done || s.t === 'king' || s.t === 'beast' || (s.t !== 'worker' && s.t !== 'soldier')) return;
        foes(ctx.st, p).forEach(function (o) {
          if (done || dist(o, s) > 2) return;
          if (o.t === 'king' || E.teamHP(o) <= 2) { if (apply(ctx, { c: 'skill', a: 'huyette', id: s.id, tgt: [o.x, o.y] })) done = true; }
        });
      });
    }
    // Hối Lộ quân lẻ giá trị cao
    if (f === 'human' && E.skillReady(ctx.st, p, 'hoilo')) {
      foes(ctx.st, p).filter(function (o) { return o.n === 1 && TT.baseValue(o.t) >= 5; }).some(function (o) { return apply(ctx, { c: 'skill', a: 'hoilo', id: o.id }); });
    }
  }

  function resolvePending(ctx) {
    var g = 0;
    while (ctx.st.pending.length && g++ < 6) {
      var pd = ctx.st.pending[0], t = ctx.st.teams[pd.team], done = false;
      if (t && pd.k === 'atk') {
        var ats = E.attackTargets(ctx.st, t.id, t.x, t.y, false);
        ats.sort(function (a, b) { var A = ctx.st.teams[a.id], B = ctx.st.teams[b.id]; return (B.t === 'king') - (A.t === 'king') || E.teamHP(A) - E.teamHP(B); });
        if (ats.length) done = apply(ctx, { c: 'follow', tgt: [ats[0].x, ats[0].y], opt: { rw: 'T' } });
      } else if (t && pd.k === 'mv' && ctx.L.sim) {
        // rút về ô ít bị đe dọa nhất
        var mv = E.moveTargets(ctx.st, t.id, t.n, { range: pd.range, dirs: 'orth', noMerge: true });
        var best = null, bs = -1e9;
        mv.forEach(function (m) { var s2 = sim(ctx.st, ctx.p, [{ c: 'follow', to: [m.x, m.y] }]); if (s2) { var v = Bot.evaluate(s2, ctx.p); if (v > bs) { bs = v; best = m; } } });
        if (best && bs > Bot.evaluate(ctx.st, ctx.p)) done = apply(ctx, { c: 'follow', to: [best.x, best.y] });
      }
      if (!done) apply(ctx, { c: 'skip' });
    }
  }

  /* ---------------- chọn hành động theo mức độ ---------------- */
  function chooseSimple(ctx) {
    var L = ctx.L, list = candidates(ctx.st, ctx.p, L);
    if (!list.length) return null;
    if (L.noise) list.forEach(function (c) { c.q += (Math.random() - .5) * L.noise * 2; if (c.kill && Math.random() < L.skipChance) c.q -= 20; });
    // mức Trung bình: loại nước làm Vua mình bị đe dọa
    if (L.threat === 'king') {
      list.sort(function (a, b) { return b.q - a.q; });
      for (var i = 0; i < Math.min(list.length, 10); i++) {
        var c = list[i]; if (c.q < .5) break;
        if (c.q > 5000) return c;
        var s2 = sim(ctx.st, ctx.p, c.cmds); if (!s2) continue;
        var k = E.kingOf(s2, ctx.p); if (!k) continue;
        if (!Bot.threatMap(s2, ctx.p)[k.id]) return c;
      }
      return list[0].q >= .5 ? list[0] : null;
    }
    var best = null; list.forEach(function (c) { if (!best || c.q > best.q) best = c; });
    return best && best.q >= .5 ? best : null;
  }
  function chooseHard(ctx) {
    var L = ctx.L, p = ctx.p, list = candidates(ctx.st, p, L);
    if (!list.length) return null;
    var win = list.filter(function (c) { return c.q > 5000; })[0]; if (win) return win;
    list.sort(function (a, b) { return b.q - a.q; });
    // giữ đa dạng: lấy top theo q + mọi nước di chuyển Vua khi bị đe dọa
    var top = list.slice(0, L.simTop);
    var base = Bot.evaluate(ctx.st, p), best = null, bv = -1e18;
    top.forEach(function (c) {
      var s2 = sim(ctx.st, p, c.cmds); if (!s2) return;
      var v = Bot.evaluate(s2, p) + c.q * .25;
      if (v > bv) { bv = v; best = c; }
    });
    return best && bv > base - .3 ? best : null;
  }

  /* ---------------- lượt đầy đủ ---------------- */
  Bot.planTurn = function (state, p, level) {
    var L = Bot.LEVELS[level] || Bot.LEVELS.medium;
    var ctx = { st: state, cmds: [], p: p, L: L };
    var pl = function () { return ctx.st.players[p]; };
    // Nhân tộc (Khó): đổi nghề Dân trước thu hoạch theo nhu cầu
    if (L.sim && pl().faction === 'human' && ctx.st.phase === 'start') {
      mine(ctx.st, p).forEach(function (t) {
        if (t.t !== 'worker') return;
        var on = ctx.st.tiles[t.y * ctx.st.W + t.x];
        if (on && on !== t.job) apply(ctx, { c: 'job', id: t.id, job: on });
      });
    }
    apply(ctx, { c: 'harvest' });
    economy(ctx);
    utilitySkills(ctx);
    var g = 0;
    while (E.actionsLeft(ctx.st) > 0 && g++ < L.maxActs && !ctx.st.over && ctx.st.active === p) {
      if (L.skipChance && Math.random() < L.skipChance * .5) break;
      var c = L.sim ? chooseHard(ctx) : chooseSimple(ctx);
      if (!c) break;
      var ok = true;
      for (var i = 0; i < c.cmds.length && ok; i++) ok = apply(ctx, c.cmds[i]);
      if (!ok) break;
      resolvePending(ctx);
    }
    resolvePending(ctx);
    if (!ctx.st.over && ctx.st.active === p) apply(ctx, { c: 'end' });
    return ctx.cmds.map(function (c) { var d = Object.assign({}, c); delete d.p; return d; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
