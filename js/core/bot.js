/* Bot heuristic — sinh lệnh hợp lệ bằng chính lõi luật. Chạy trên máy chủ phòng. */
(function (G) {
  'use strict';
  var TT = G.TT, E = TT.Engine, U = TT.UNITS, CFG = TT.CONFIG;
  var Bot = TT.Bot = {};

  function tryApply(ctx, cmd) {
    var r = E.apply(ctx.st, cmd);
    if (r.ok) { ctx.st = r.state; ctx.cmds.push(cmd); return true; }
    return false;
  }
  function myTeams(st, p) { return E.teamIds(st).map(function (id) { return st.teams[id]; }).filter(function (t) { return t.o === p; }); }
  function enemyKings(st, p) {
    return E.teamIds(st).map(function (id) { return st.teams[id]; }).filter(function (t) { return t.t === 'king' && !E.ally(st, t.o, p); });
  }
  function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  function workers(st, p) { return myTeams(st, p).filter(function (t) { return t.t === 'worker'; }).reduce(function (s, t) { return s + t.n; }, 0); }
  function jobsCount(st, p) {
    var c = { V: 0, T: 0, G: 0 };
    myTeams(st, p).forEach(function (t) { if (t.t === 'worker') c[t.job] += t.n; });
    return c;
  }
  function freeSpawn(st, p, type, job) {
    var cells = E.spawnCells(st, p), pl = st.players[p];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; if (!E.exists(st, c[0], c[1])) continue;
      var o = E.teamAt(st, c[0], c[1]);
      if (o && o.o === p && o.t === type && o.rest === pl.pturn && o.n < E.cap(st, p) && type !== 'beast' && (!job || o.job === job)) return c;
    }
    // ưu tiên ô giữa hàng
    var order = [3, 4, 2, 5, 1, 6, 0, 7];
    for (var j = 0; j < order.length; j++) {
      var d = cells[order[j]];
      if (E.exists(st, d[0], d[1]) && !E.teamAt(st, d[0], d[1])) return d;
    }
    return null;
  }

  var ARMY_PREF = {
    dragon: ['chariot', 'elephant', 'siege', 'cavalry', 'soldier', 'archer'],
    human: ['chariot', 'siege', 'cavalry', 'archer', 'soldier'],
    fairy: ['chariot', 'siege', 'cavalry', 'archer', 'mage', 'soldier'],
    demon: ['chariot', 'siege', 'cavalry', 'soldier', 'archer']
  };

  Bot.planTurn = function (state, p, level) {
    var ctx = { st: state, cmds: [] };
    var st0 = state, pl0 = st0.players[p];
    tryApply(ctx, { c: 'harvest', p: p });
    var guard = 0;
    // --- mua sắm ---
    function pl() { return ctx.st.players[p]; }
    var targetWorkers = 5 + 2 * pl().age + (pl().pturn > 12 ? 2 : 0);
    if (pl().pturn >= CFG.declineTurn) targetWorkers = 0;
    // lên đời
    var ageGoal = pl().pturn >= 3 ? 2 : 1;
    if (pl().pturn >= 8) ageGoal = 3;
    if (pl().pturn >= 16) ageGoal = 4;
    while (pl().age < ageGoal && guard++ < 5) { if (!tryApply(ctx, { c: 'age', p: p })) break; }
    // dân
    guard = 0;
    while (workers(ctx.st, p) < targetWorkers && pl().res.V >= 2 && guard++ < 12) {
      var jc = jobsCount(ctx.st, p);
      var need = pl().faction === 'dragon' ? { V: 1, T: 1.6, G: 0.9 } : { V: 1, T: 1, G: 1 };
      var job = ['T', 'V', 'G'].sort(function (a, b) { return jc[a] / need[a] - jc[b] / need[b]; })[0];
      var c = freeSpawn(ctx.st, p, 'worker', job);
      if (!c || !tryApply(ctx, { c: 'buy', p: p, u: 'worker', job: job, cell: c })) break;
    }
    // quân
    var reserveAge = pl().age < 4 && pl().pturn >= 6;
    var prefs = ARMY_PREF[pl().faction];
    guard = 0;
    while (guard++ < 10 && pl().pturn >= 2) {
      var bought = false;
      for (var i = 0; i < prefs.length; i++) {
        var u = prefs[i];
        if (U[u].age > pl().age) continue;
        var price = E.price(ctx.st, p, u);
        if (reserveAge) {
          var ac = CFG.ageCosts[pl().age + 1];
          if (pl().res.V - price.V < ac.V * 0.5 && pl().res.T - price.T < ac.T * 0.5) continue;
        }
        var cc = freeSpawn(ctx.st, p, u);
        if (cc && tryApply(ctx, { c: 'buy', p: p, u: u, cell: cc })) { bought = true; break; }
      }
      if (!bought) break;
    }
    if (pl().age >= 4 && !pl().beast) { var bc = freeSpawn(ctx.st, p, 'beast'); if (bc) tryApply(ctx, { c: 'buy', p: p, u: 'beast', cell: bc }); }
    // Quỷ: Oán Hồn / Tái Sinh
    guard = 0;
    while (pl().faction === 'demon' && pl().souls >= 3 && guard++ < 3) {
      var sc = freeSpawn(ctx.st, p, 'none');
      if (!sc) break;
      if (!tryApply(ctx, { c: pl().passive === 'taisinh' ? 'taisinh' : 'oanhon', p: p, cell: sc })) break;
    }
    if (pl().faction === 'human' && E.skillReady(ctx.st, p, 'thuthue') && !E.inPeace(ctx.st)) tryApply(ctx, { c: 'skill', p: p, a: 'thuthue' });

    // --- hành động ---
    guard = 0;
    while (E.actionsLeft(ctx.st) > 0 && guard++ < 8 && !ctx.st.over) {
      var best = bestAction(ctx.st, p);
      if (!best || best.score < 0.5) break;
      // buff trước đòn
      if (best.cmd.tgt) preBuff(ctx, p, best);
      if (!tryApply(ctx, best.cmd)) break;
      resolvePending(ctx, p);
    }
    resolvePending(ctx, p);
    if (!ctx.st.over) tryApply(ctx, { c: 'end', p: p });
    return ctx.cmds;
  };

  function preBuff(ctx, p, best) {
    var st = ctx.st, f = st.players[p].faction, id = best.cmd.id;
    var t = st.teams[id]; if (!t || best.cmd.k && best.cmd.k < t.n) return;
    if (f === 'dragon' && E.skillReady(st, p, 'longluc')) tryApply(ctx, { c: 'skill', p: p, a: 'longluc', id: id });
    if (f === 'dragon' && E.skillReady(ctx.st, p, 'longuy') && E.atkProfile(ctx.st, ctx.st.teams[id]).kind === 'melee') tryApply(ctx, { c: 'skill', p: p, a: 'longuy', id: id });
    if (f === 'demon' && E.skillReady(ctx.st, p, 'haphon') && best.kill) tryApply(ctx, { c: 'skill', p: p, a: 'haphon', id: id });
    if (f === 'human' && E.skillReady(ctx.st, p, 'taitro') && !best.kill) {
      var r = ctx.st.players[p].res; if (r.V + r.T + r.G > 12) tryApply(ctx, { c: 'skill', p: p, a: 'taitro', id: id });
    }
  }

  function resolvePending(ctx, p) {
    var g = 0;
    while (ctx.st.pending.length && g++ < 6) {
      var pd = ctx.st.pending[0], t = ctx.st.teams[pd.team], done = false;
      if (t && pd.k === 'atk') {
        var ats = E.attackTargets(ctx.st, t.id, t.x, t.y, false);
        ats.sort(function (a, b) { return E.teamHP(ctx.st.teams[a.id]) - E.teamHP(ctx.st.teams[b.id]); });
        if (ats.length) done = tryApply(ctx, { c: 'follow', p: p, tgt: [ats[0].x, ats[0].y], opt: { rw: 'T' } });
      }
      if (!done) tryApply(ctx, { c: 'skip', p: p });
    }
  }

  function bestAction(st, p) {
    var best = null, kings = enemyKings(st, p), pl = st.players[p];
    var myKing = E.kingOf(st, p);
    var peace = E.inPeace(st);
    var needRes = 'VTG'.split('').sort(function (a, b) { return pl.res[a] - pl.res[b]; })[0];
    myTeams(st, p).forEach(function (t) {
      if (t.n - t.na <= 0) return;
      if (E.isResting(st, t) && pl.passive !== 'tienphong') return;
      var k = t.n - t.na;
      var opts = [{ x: t.x, y: t.y, steps: 0, stay: true }].concat(E.moveTargets(st, t.id, k));
      opts.forEach(function (m) {
        var baseScore = 0;
        if (m.merge) baseScore = t.t === 'worker' ? 0.2 : 0.6;
        var onTile = function (x, y) { return st.tiles[y * st.W + x]; };
        if (t.t === 'worker') {
          var good = onTile(m.x, m.y) === t.job, was = onTile(t.x, t.y) === t.job;
          if (good && !was) baseScore += 6;
          if (was && !good) baseScore -= 6;
          var sp = E.spawnCells(st, p).some(function (c) { return c[0] === t.x && c[1] === t.y; });
          var dsp = E.spawnCells(st, p).some(function (c) { return c[0] === m.x && c[1] === m.y; });
          if (sp && !dsp && !m.stay) baseScore += 1.2;
          // tìm ô đúng nghề gần hơn
          var tgtTile = nearestTile(st, t, p);
          if (tgtTile && !was) baseScore += (dist(t, tgtTile) - dist(m, tgtTile)) * 1.5;
        } else if (t.t === 'king') {
          baseScore -= 0.3;
          if (!m.stay && E.kingThreat(st, p)) baseScore += 3;
        } else if (kings.length && !m.stay) {
          var nk = kings.slice().sort(function (a, b) { return dist(t, a) - dist(t, b); })[0];
          var gain = dist(t, nk) - dist(m, nk);
          baseScore += gain * (pl.pturn > 6 ? 0.9 : 0.4);
          if (myKing && dist(m, myKing) <= 1 && pl.pturn < 10) baseScore += 0.3;
        }
        var cand = { score: baseScore, cmd: { c: 'act', p: p, id: t.id, k: k, to: m.stay ? null : [m.x, m.y] } };
        if (!m.stay || baseScore > 0) consider(cand);
        if (peace || m.merge) return;
        var tmp = E.clone(st), tt = tmp.teams[t.id]; tt.x = m.x; tt.y = m.y;
        var ats = E.attackTargets(tmp, t.id, m.x, m.y, !m.stay);
        ats.forEach(function (a) {
          var target = st.teams[a.id];
          var pv = E.previewAttack(st, t.id, k, m.x, m.y, !m.stay, m.steps, a.x, a.y);
          if (!pv) return;
          var sc = baseScore * 0.3 + pv.dmg * 1.5;
          if (pv.kill) sc += 4 + pv.hp * 2 + TT.baseValue(target.t);
          if (target.t === 'king' && pv.kill) sc += 10000;
          if (target.t === 'king') sc += 20;
          consider({ score: sc, kill: pv.kill, cmd: { c: 'act', p: p, id: t.id, k: k, to: m.stay ? null : [m.x, m.y], tgt: [a.x, a.y], opt: { rw: target.t === 'worker' ? undefined : needRes, back: true } } });
        });
      });
    });
    function consider(c) { if (!best || c.score > best.score) best = c; }
    return best;
  }
  function nearestTile(st, t, p) {
    var best = null, bd = 99;
    for (var i = 0; i < st.tiles.length; i++) {
      if (st.tiles[i] !== t.job) continue;
      var x = i % st.W, y = (i / st.W) | 0;
      var o = E.teamAt(st, x, y);
      if (o && o.id !== t.id) continue;
      var d = Math.max(Math.abs(x - t.x), Math.abs(y - t.y));
      if (d < bd) { bd = d; best = { x: x, y: y }; }
    }
    return best;
  }
})(typeof window !== 'undefined' ? window : globalThis);
