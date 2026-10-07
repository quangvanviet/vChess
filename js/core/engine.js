/* Tứ Tộc Kỳ Chiến — LÕI LUẬT xác định.
 * state + command → state mới + events. Không dùng số thực, không Math.random,
 * duyệt theo thứ tự id/tọa độ ổn định. Mọi máy chạy cùng chuỗi lệnh ra cùng hash.
 */
(function (G) {
  'use strict';
  var TT = G.TT;
  var CFG = TT.CONFIG, U = TT.UNITS, F = TT.FACTIONS;
  var E = TT.Engine = {};

  /* ---------------- tiện ích ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  E.clone = clone;
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0);
    };
  }
  E.rng = rng;
  function ri(r, n) { return r() % n; }
  function shuffle(r, arr) { for (var i = arr.length - 1; i > 0; i--) { var j = ri(r, i + 1); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  var ORTH = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  var DIAG = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
  var ALL8 = ORTH.concat(DIAG);
  var KNIGHT = [[1, -2], [2, -1], [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2]];
  E.DIRS = { orth: ORTH, diag: DIAG, all: ALL8 };

  function stable(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    var ks = Object.keys(o).sort(), s = [];
    for (var i = 0; i < ks.length; i++) { if (o[ks[i]] === undefined) continue; s.push(JSON.stringify(ks[i]) + ':' + stable(o[ks[i]])); }
    return '{' + s.join(',') + '}';
  }
  E.stable = stable;
  E.hash = function (state) {
    var s = stable(state), h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  };

  /* ---------------- bàn cờ ---------------- */
  // side: 0 Nam, 1 Tây, 2 Bắc, 3 Đông. frame: origin, forward f, right r
  function frames(mode) {
    if (mode === 2) return [
      { o: [0, 7], f: [0, -1], r: [1, 0] }, null,
      { o: [7, 0], f: [0, 1], r: [-1, 0] }, null];
    return [
      { o: [3, 13], f: [0, -1], r: [1, 0] },
      { o: [0, 3], f: [1, 0], r: [0, 1] },
      { o: [10, 0], f: [0, 1], r: [-1, 0] },
      { o: [13, 10], f: [-1, 0], r: [0, -1] }];
  }
  function local(fr, c, k) { return [fr.o[0] + c * fr.r[0] + k * fr.f[0], fr.o[1] + c * fr.r[1] + k * fr.f[1]]; }
  E.local = local;

  E.boardMode = function (mode) { return (mode === 2) ? 2 : 4; };

  /* ---------------- khởi tạo ---------------- */
  // setup: {seed, mode: 2|3|4, teamMode, ranked, secondBonus,
  //         players:[{seat, uid, name, faction, passive, home, bot}]}
  E.init = function (setup) {
    var mode = setup.mode | 0;
    var bm = E.boardMode(mode);
    var W = bm === 2 ? 8 : 14, H = W;
    var r = rng(setup.seed);
    var ex = [], tiles = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var e = 1;
      if (bm === 4 && (x < 3 || x > 10) && (y < 3 || y > 10)) e = 0;
      ex.push(e); tiles.push('');
    }
    var fr = frames(bm);
    var seats = setup.players.map(function (p) { return p.seat; }).sort(function (a, b) { return a - b; });
    var pl = seats.map(function (seat) {
      var sp = setup.players.filter(function (q) { return q.seat === seat; })[0];
      return {
        seat: seat, uid: sp.uid || '', name: String(sp.name || ('Người chơi ' + (seat + 1))).slice(0, 24),
        faction: sp.faction, passive: sp.passive, home: sp.home, bot: !!sp.bot,
        alive: true, age: 1, res: { V: CFG.startingGold, T: 0, G: 0 }, souls: sp.faction === 'demon' ? 1 : 0,
        pturn: 0, used: 0, ready: {}, beast: false, cnt: {}, rcnt: {}, firstBuy: false,
        team: setup.teamMode ? (seat % 2) : seat, elimRound: 0, kills: 0, lost: 0
      };
    });
    var st = {
      v: TT.RULE_VERSION, seed: setup.seed >>> 0, mode: mode, bm: bm, teamMode: !!setup.teamMode,
      ranked: !!setup.ranked, W: W, H: H, ex: ex, tiles: tiles, mids: [], wild: -1,
      players: pl, teams: {}, nextId: 1, order: [], cur: 0, active: 0, phase: 'start',
      round: 1, turnNo: 0, pending: [], deaths: [], dice: [], winner: null, over: false, draw: false
    };
    // ô nhà + vua
    pl.forEach(function (p, i) {
      var f = fr[p.seat];
      var h = local(f, 1, 1);
      st.tiles[h[1] * W + h[0]] = p.home;
      var k = local(f, 3, 0);
      addTeam(st, i, 'king', k[0], k[1], 1, null, -99);
    });
    // ô ngẫu nhiên đối xứng
    var types = shuffle(r, ['V', 'T', 'G']);
    if (bm === 2) {
      var reps = [];
      for (var yy = 2; yy <= 3; yy++) for (var xx = 0; xx < 8; xx++) reps.push([xx, yy]);
      shuffle(r, reps);
      for (var q = 0; q < 3; q++) {
        var a = reps[q], b = [7 - a[0], 7 - a[1]];
        [a, b].forEach(function (c) { st.tiles[c[1] * W + c[0]] = types[q]; st.mids.push(c[1] * W + c[0]); });
      }
    } else {
      var orb = shuffle(r, [[5, 5], [6, 5], [5, 6], [6, 6]]);
      for (var s2 = 0; s2 < 2; s2++) {
        var c0 = orb[s2], cc = c0;
        for (var rot = 0; rot < 4; rot++) {
          st.tiles[cc[1] * W + cc[0]] = types[s2]; st.mids.push(cc[1] * W + cc[0]);
          cc = [13 - cc[1], cc[0]];
        }
      }
      if (mode === 3) {
        var used = pl.map(function (p) { return p.seat; });
        for (var s3 = 0; s3 < 4; s3++) if (used.indexOf(s3) < 0) st.wild = s3;
      }
    }
    st.mids.sort(function (a, b) { return a - b; });
    // tung xúc xắc chọn người đi trước (xác định từ seed)
    var cand = pl.map(function (p, i) { return i; }), guard = 0;
    while (cand.length > 1 && guard++ < 20) {
      var rolls = {}, best = 0;
      cand.forEach(function (i) { var v = ri(r, 6) + 1; rolls[pl[i].seat] = v; if (v > best) best = v; });
      st.dice.push(rolls);
      cand = cand.filter(function (i) { return rolls[pl[i].seat] === best; });
    }
    var first = cand[0];
    // thứ tự theo chiều kim đồng hồ: Nam → Tây → Bắc → Đông
    var idxs = pl.map(function (p, i) { return i; });
    var fi = idxs.indexOf(first);
    st.order = idxs.slice(fi).concat(idxs.slice(0, fi));
    // bù
    if (mode === 3 && st.wild >= 0) {
      var opp = (st.wild + 2) % 4;
      pl.forEach(function (p) { if (p.seat === opp) p.res.V += CFG.threeSeatBonusGold; });
    }
    if (mode === 2 && setup.secondBonus) pl[st.order[1]].res.V += CFG.secondPlayerBonusGold;
    st.cur = 0; st.active = st.order[0];
    beginTurn(st, []);
    return st;
  };

  /* ---------------- truy vấn cơ bản ---------------- */
  function exists(st, x, y) { return x >= 0 && y >= 0 && x < st.W && y < st.H && st.ex[y * st.W + x] === 1; }
  E.exists = exists;
  function teamIds(st) { return Object.keys(st.teams).map(Number).sort(function (a, b) { return a - b; }); }
  E.teamIds = teamIds;
  function teamAt(st, x, y) {
    var ids = teamIds(st);
    for (var i = 0; i < ids.length; i++) { var t = st.teams[ids[i]]; if (t.x === x && t.y === y) return t; }
    return null;
  }
  E.teamAt = teamAt;
  function occMap(st) {
    var m = {};
    teamIds(st).forEach(function (id) { var t = st.teams[id]; m[t.y * st.W + t.x] = t; });
    return m;
  }
  function P(st, i) { return st.players[i]; }
  function fac(st, t) { return P(st, t.o).faction; }
  function ally(st, a, b) { return a === b || (st.teamMode && P(st, a).team === P(st, b).team); }
  E.ally = ally;
  function enemy(st, a, b) { return !ally(st, a, b); }
  function cap(st, p) { return P(st, p).faction === 'fairy' ? CFG.fairyStackCap : CFG.stackCap; }
  E.cap = cap;
  function teamHP(t) { return t.t === 'beast' ? t.hp : t.n; }
  E.teamHP = teamHP;
  function isResting(st, t) { return t.rest === P(st, t.o).pturn; }
  E.isResting = isResting;
  function frameOf(st, p) { return frames(st.bm)[P(st, p).seat]; }
  function spawnCells(st, p) {
    var f = frameOf(st, p), out = [];
    for (var c = 0; c < 8; c++) out.push(local(f, c, 0));
    return out;
  }
  E.spawnCells = spawnCells;
  function isSpawn(st, p, x, y) { return spawnCells(st, p).some(function (c) { return c[0] === x && c[1] === y; }); }
  E.homeCell = function (st, p) { return local(frameOf(st, p), 1, 1); };
  function peace(st) { return P(st, st.active).pturn <= CFG.peaceTurns; }
  E.inPeace = peace;
  function declined(st, p) { return P(st, p).pturn >= CFG.declineTurn; }

  function addTeam(st, o, t, x, y, n, job, rest) {
    var id = st.nextId++;
    var tm = { id: id, o: o, t: t, x: x, y: y, n: n, na: 0, rest: rest, st: {} };
    if (job) tm.job = job;
    if (t === 'beast') tm.hp = (P(st, o).faction === 'fairy') ? 2 : 3;
    st.teams[id] = tm;
    return tm;
  }

  function nm(st, t) { return (U[t.t].name) + (t.t === 'worker' ? ' (' + TT.JOB[t.job] + ')' : '') + (t.n > 1 ? ' ×' + t.n : ''); }
  function pn(st, i) { return P(st, i).name; }
  function cellName(st, x, y) {
    var cols = 'ABCDEFGHIJKLMN';
    return cols[x] + (st.H - y);
  }
  E.cellName = cellName;

  /* ---------------- giá ---------------- */
  E.price = function (st, p, type) {
    var pl = P(st, p), base = U[type].cost, c = { V: base.V, T: base.T, G: base.G, any: 0 };
    if (pl.faction === 'dragon' && type !== 'worker') c.T += 1;
    if (pl.faction === 'demon' && type === 'soldier') { c.V = 1; c.T = 1; c.G = 0; }
    if (pl.faction === 'human' && type === 'soldier') { c.V = 0; c.T = 0; c.G = 0; c.any = 2; }
    if (pl.faction === 'human' && type === 'siege') c.G = Math.max(0, c.G - 1);
    if (pl.passive === 'baothau' && !pl.firstBuy) {
      var tot = c.V + c.T + c.G + c.any;
      if (tot > 1) {
        if (c.any > 0) c.any -= 1;
        else { var k = ['V', 'T', 'G'].filter(function (r) { return c[r] > 0; }).sort(function (a, b) { return c[b] - c[a]; })[0]; c[k] -= 1; }
      }
    }
    return c;
  };
  function canPay(res, c) { return res.V >= c.V && res.T >= c.T && res.G >= c.G && (res.V - c.V + res.T - c.T + res.G - c.G) >= (c.any || 0); }
  E.canPay = canPay;
  function autoAny(res, c, amount) {
    var left = { V: res.V - c.V, T: res.T - c.T, G: res.G - c.G }, pay = { V: 0, T: 0, G: 0 };
    for (var i = 0; i < amount; i++) {
      var k = ['V', 'T', 'G'].sort(function (a, b) { return (left[b] - left[a]) || (a < b ? -1 : 1); })[0];
      pay[k]++; left[k]--;
    }
    return pay;
  }
  E.autoAny = autoAny;
  function payAny(pl, amount, pay) {
    if (!pay) pay = autoAny(pl.res, { V: 0, T: 0, G: 0 }, amount);
    var v = pay.V | 0, t = pay.T | 0, g = pay.G | 0;
    if (v < 0 || t < 0 || g < 0 || v + t + g !== amount) return 'Thanh toán không hợp lệ';
    if (pl.res.V < v || pl.res.T < t || pl.res.G < g) return 'Không đủ tài nguyên';
    pl.res.V -= v; pl.res.T -= t; pl.res.G -= g;
    return null;
  }

  /* ---------------- trạng thái (status) ---------------- */
  function setSt(t, key, val, exp) { t.st[key] = { v: val, e: exp }; }
  function expireStatuses(st, p, at) {
    var pt = P(st, p).pturn;
    teamIds(st).forEach(function (id) {
      var t = st.teams[id];
      Object.keys(t.st).sort().forEach(function (k) {
        var s = t.st[k];
        if (s.e && s.e.p === p && s.e.at === at && s.e.t <= pt) delete t.st[k];
      });
    });
  }
  var OFFENSIVE = ['pct50', 'plus', 'longuy', 'haphon', 'linhnhan', 'enraged'];

  /* ---------------- lượt ---------------- */
  function beginTurn(st, ev) {
    var p = st.active, pl = P(st, p);
    pl.pturn += 1; pl.used = 0; pl.cnt = {}; pl.firstBuy = false;
    st.turnNo += 1;
    teamIds(st).forEach(function (id) { var t = st.teams[id]; if (t.o === p) { t.na = 0; delete t.mv; delete t.jobDone; } });
    expireStatuses(st, p, 'start');
    st.phase = 'start';
    st.pending = [];
    ev.push({ e: 'turn', p: p, pturn: pl.pturn, round: st.round, log: '— Lượt ' + pl.pturn + ' của ' + pl.name + ' (vòng ' + st.round + ')' });
  }

  function harvest(st, ev) {
    var p = st.active, pl = P(st, p), dec = declined(st, p);
    var inc = { V: 0, T: 0, G: 0 };
    if (!dec) inc.V += CFG.baseGoldIncome;
    teamIds(st).forEach(function (id) {
      var t = st.teams[id];
      if (t.o !== p) return;
      if (t.t === 'worker') {
        var on = st.tiles[t.y * st.W + t.x] === t.job;
        if (on) inc[t.job] += 2 * t.n; else if (!dec) inc[t.job] += t.n;
      }
      if (t.t === 'beast' && pl.faction === 'human' && !dec) inc.V += 2;
    });
    pl.res.V += inc.V; pl.res.T += inc.T; pl.res.G += inc.G;
    st.phase = 'buy';
    ev.push({ e: 'income', p: p, inc: inc, log: pl.name + ' thu hoạch +' + inc.V + 'V +' + inc.T + 'T +' + inc.G + 'G' + (dec ? ' (Suy Tàn)' : '') });
  }

  function endTurn(st, ev) {
    var p = st.active, pl = P(st, p);
    st.pending = [];
    if (pl.alive) {
      var dec = declined(st, p);
      if (pl.passive === 'laisuat' && !dec) {
        var g = Math.min(CFG.humanInterestCap, Math.floor(pl.res.V / 10));
        if (g > 0) { pl.res.V += g; ev.push({ e: 'gain', p: p, res: { V: g }, log: 'Lãi Suất +' + g + 'V' }); }
      }
      if (pl.faction === 'human' && !dec) {
        teamIds(st).forEach(function (id) {
          var t = st.teams[id], idx = t.y * st.W + t.x;
          if (t.o === p && t.t === 'cavalry' && st.mids.indexOf(idx) >= 0) {
            var k = st.tiles[idx]; pl.res[k] += 1;
            ev.push({ e: 'gain', p: p, res: { k: 1 }, log: 'Thương Kỵ +1' + k });
          }
        });
      }
      expireStatuses(st, p, 'end');
    }
    ev.push({ e: 'endturn', p: p });
    advance(st, ev);
  }

  function advance(st, ev) {
    if (st.over) return;
    var n = st.order.length, i = st.cur, steps = 0;
    do {
      i = (i + 1) % n; steps++;
      if (i === 0) {
        st.round += 1;
        st.players.forEach(function (pl) { pl.rcnt = {}; });
        if (st.ranked && st.round > CFG.rankedRoundLimit) { finishByScore(st, ev); return; }
      }
    } while (!P(st, st.order[i]).alive && steps <= n + 1);
    st.cur = i; st.active = st.order[i];
    beginTurn(st, ev);
  }

  function finishByScore(st, ev) {
    var best = -1, win = [];
    st.players.forEach(function (pl, i) {
      if (!pl.alive) return;
      var s = pl.res.V + pl.res.T + pl.res.G;
      teamIds(st).forEach(function (id) { var t = st.teams[id]; if (t.o === i && t.t !== 'king') s += TT.baseValue(t.t) * t.n; });
      pl.score = s;
      if (s > best) { best = s; win = [i]; } else if (s === best) win.push(i);
    });
    st.over = true; st.phase = 'over';
    if (win.length === 1) st.winner = win; else st.draw = true;
    ev.push({ e: 'over', winner: st.winner, draw: st.draw, log: st.draw ? 'Hết giới hạn vòng — hòa điểm.' : 'Hết giới hạn vòng — ' + pn(st, win[0]) + ' thắng điểm (' + best + ').' });
  }

  function checkWin(st, ev) {
    if (st.over) return;
    var alive = st.players.map(function (p, i) { return i; }).filter(function (i) { return P(st, i).alive; });
    var groups = {};
    alive.forEach(function (i) { groups[P(st, i).team] = true; });
    if (Object.keys(groups).length <= 1) {
      st.over = true; st.phase = 'over';
      st.winner = st.teamMode ? st.players.map(function (p, i) { return i; }).filter(function (i) { return alive.length && P(st, i).team === P(st, alive[0]).team; }) : alive;
      ev.push({ e: 'over', winner: st.winner, log: '🏆 ' + (st.winner.map(function (i) { return pn(st, i); }).join(' & ') || '—') + ' chiến thắng!' });
    }
  }

  function eliminate(st, p, by, ev) {
    var pl = P(st, p); if (!pl.alive) return;
    pl.alive = false; pl.elimRound = st.round;
    teamIds(st).forEach(function (id) { if (st.teams[id].o === p) delete st.teams[id]; });
    st.pending = st.pending.filter(function (pd) { return !!st.teams[pd.team]; });
    ev.push({ e: 'elim', p: p, by: by, log: '☠ ' + pl.name + ' bị loại' + (by != null && by >= 0 ? ' bởi ' + pn(st, by) : '') + '. Toàn bộ quân biến mất.' });
    checkWin(st, ev);
  }

  /* ---------------- di chuyển ---------------- */
  function moveRange(st, t, k, firstAction) {
    var f = fac(st, t), pl = P(st, t.o), r = U[t.t].move.range;
    if (t.t === 'king' && (f === 'fairy' || f === 'demon')) r = 1;
    if (f === 'fairy') {
      if (t.t === 'worker') r = 2;
      if (t.t === 'elephant') r = 3;
      if (t.t === 'beast') r = 4;
      if (pl.passive === 'giothuan' && U[t.t].combat && t.t !== 'king') r += 1;
      if (pl.passive === 'linhdong' && firstAction && k === 1 && t.t !== 'king') r += 1;
    }
    if (f === 'dragon' && pl.passive === 'cuonghuyet' && k >= CFG.dragonLargeTeam) r += 1;
    return r;
  }
  function passThrough(st, t) {
    var f = fac(st, t);
    if (t.t === 'beast' && (f === 'dragon' || f === 'fairy')) return true;
    if (f === 'fairy' && (t.t === 'cavalry' || t.t === 'chariot' || t.t === 'elephant')) return true;
    return false;
  }
  function canMergeInto(st, mover, dest, k) {
    if (!dest || dest.o !== mover.o || dest.t !== mover.t || dest.t === 'king' || dest.t === 'beast') return false;
    if (mover.t === 'worker' && dest.job !== mover.job) return false;
    var c = cap(st, mover.o);
    if (dest.n + k > c) return false;
    var mr = isResting(st, mover), dr = isResting(st, dest);
    if (mr !== dr) return false;
    return true;
  }

  // Trả về danh sách ô đến: {x,y,steps,dir,merge}
  E.moveTargets = function (st, teamId, k, opts) {
    var t = st.teams[teamId]; if (!t) return [];
    var pl = P(st, t.o); k = k || (t.n - t.na);
    var first = pl.used === 0;
    var range = (opts && opts.range != null) ? opts.range : moveRange(st, t, k, first);
    var occ = occMap(st), out = [], seen = {};
    var pass = passThrough(st, t);
    var md = U[t.t].move.dirs;
    var noMerge = opts && opts.noMerge;
    function consider(x, y, steps, dir) {
      if (!exists(st, x, y)) return false;
      var o = occ[y * st.W + x];
      var key = x + ',' + y;
      if (!o) { if (!seen[key]) { seen[key] = 1; out.push({ x: x, y: y, steps: steps, dir: dir }); } return true; }
      if (!noMerge && canMergeInto(st, t, o, k) && o.id !== t.id) {
        if (!seen[key]) { seen[key] = 1; out.push({ x: x, y: y, steps: steps, dir: dir, merge: o.id }); }
      }
      return false;
    }
    if (md === 'knight' && !(opts && opts.range != null)) {
      KNIGHT.forEach(function (d) { consider(t.x + d[0], t.y + d[1], 1, d); });
      if (fac(st, t) === 'fairy') { // Ảnh Bộ
        teamIds(st).forEach(function (id) {
          var a = st.teams[id]; if (a.o !== t.o || a.id === t.id) return;
          ORTH.forEach(function (d) {
            var x = a.x + d[0], y = a.y + d[1];
            if (exists(st, x, y) && !occ[y * st.W + x]) consider(x, y, 1, null);
          });
        });
      }
      return out;
    }
    var dirs = (opts && opts.dirs) ? E.DIRS[opts.dirs] : E.DIRS[md === 'knight' ? 'orth' : md];
    dirs.forEach(function (d) {
      for (var s = 1; s <= range; s++) {
        var x = t.x + d[0] * s, y = t.y + d[1] * s;
        if (!exists(st, x, y)) break;
        var o = occ[y * st.W + x];
        if (!o) { consider(x, y, s, d); continue; }
        consider(x, y, s, d);
        var passable = pass || (st.teamMode && o.o !== t.o && ally(st, o.o, t.o));
        if (!passable) break;
      }
    });
    return out;
  };

  /* ---------------- tấn công ---------------- */
  function atkProfile(st, t) {
    var f = fac(st, t), a = U[t.t].atk, pr = { kind: a.kind, dirs: a.dirs, range: a.range || 0, lob: !!a.lob, extraOrth1: false };
    if (t.t === 'worker' && f === 'dragon') { pr.kind = 'melee'; pr.dirs = 'orth'; pr.range = 1; }
    if (t.t === 'soldier' && f === 'dragon') pr.dirs = 'all';
    if (t.t === 'archer' && f === 'fairy') pr.range = 3;
    if (t.t === 'mage' && f === 'dragon') pr.range = 3;
    if (t.t === 'mage' && f === 'fairy') pr.extraOrth1 = true;
    if (t.t === 'siege' && f === 'fairy') pr.range = 4;
    if (pr.kind === 'ranged') {
      if (t.st.linhnhan) pr.range += 1;
      // Quân Sư (Chỉ Huy Tiên) kề
      if (hasAdjCommander(st, t, 'fairy')) pr.range += 1;
    }
    return pr;
  }
  E.atkProfile = atkProfile;
  function hasAdjCommander(st, t, needFac) {
    var ids = teamIds(st);
    for (var i = 0; i < ids.length; i++) {
      var c = st.teams[ids[i]];
      if (c.o !== t.o || c.t !== 'commander' || c.id === t.id) continue;
      if (needFac && fac(st, c) !== needFac) continue;
      var dx = Math.abs(c.x - t.x), dy = Math.abs(c.y - t.y);
      var eight = fac(st, c) === 'dragon';
      if (eight ? (Math.max(dx, dy) === 1) : (dx + dy === 1)) return true;
    }
    return false;
  }
  function protectedFromRanged(st, target) {
    if (target.t !== 'worker') return false;
    var ids = teamIds(st);
    for (var i = 0; i < ids.length; i++) {
      var s = st.teams[ids[i]];
      if (s.o === target.o && s.t === 'shield' && fac(st, s) === 'human' && Math.abs(s.x - target.x) + Math.abs(s.y - target.y) === 1) return true;
    }
    return false;
  }

  // ô có thể đánh từ (fx,fy). Trả [{x,y,id,dir}]
  E.attackTargets = function (st, teamId, fx, fy, moved) {
    var t = st.teams[teamId]; if (!t) return [];
    if (fx == null) { fx = t.x; fy = t.y; }
    var pr = atkProfile(st, t), out = [];
    if (pr.kind === 'none') return out;
    if (t.t === 'siege' && moved && fac(st, t) !== 'fairy') return out;
    var occ = occMap(st);
    function ok(o) { return o && o.id !== t.id && enemy(st, o.o, t.o); }
    function scan(dirs, range, ranged) {
      dirs.forEach(function (d) {
        var skips = (ranged && t.st.linhnhan) ? 1 : 0;
        for (var s = 1; s <= range; s++) {
          var x = fx + d[0] * s, y = fy + d[1] * s;
          if (!exists(st, x, y)) break;
          var o = occ[y * st.W + x];
          if (o && o.id === t.id) o = null;
          if (o) {
            if (ok(o) && !(ranged && protectedFromRanged(st, o))) out.push({ x: x, y: y, id: o.id, dir: d });
            if (!ranged) break;
            if (pr.lob) continue;
            if (skips > 0) { skips--; continue; }
            break;
          }
        }
      });
    }
    var ranged = pr.kind === 'ranged';
    scan(E.DIRS[pr.dirs], pr.range, ranged);
    if (pr.extraOrth1) scan(ORTH, 1, true);
    // khử trùng
    var seen = {};
    return out.filter(function (c) { var k = c.x + ',' + c.y; if (seen[k]) return false; seen[k] = 1; return true; });
  };

  function isRangedType(type) { return !!TT.RANGED[type]; }

  // Tính sát thương (thuần, không đổi state)
  function computeDamage(st, atk, k, target, ctx) {
    var f = fac(st, atk), tf = fac(st, target), pr = atkProfile(st, atk), ranged = pr.kind === 'ranged';
    var parts = [];
    var dmg = (atk.t === 'beast') ? 1 : k;
    parts.push('cơ bản ' + dmg);
    if (atk.t === 'siege' && !ctx.moved) { dmg *= 2; parts.push('×2 Công thành'); }
    if (atk.st.pct50) { dmg = Math.floor((dmg * 3 + 1) / 2); parts.push('+50% Long Lực'); }
    var add = 0;
    if (hasAdjCommander(st, atk, null)) { add += 1; parts.push('+1 Chỉ Huy'); }
    if (f === 'dragon' && atk.t === 'cavalry' && ctx.steps === 3) { add += 1; parts.push('+1 Xung Phong'); }
    if (atk.st.plus) { add += atk.st.plus.v; parts.push('+' + atk.st.plus.v + ' Tài Trợ'); }
    if (f === 'dragon' && atk.t === 'assassin' && isRangedType(target.t)) { add += 1; parts.push('+1 Long Trảo'); }
    if (atk.st.enraged) { add += 1; parts.push('+1 Long Nộ'); }
    if (f === 'dragon' && atk.t === 'elephant' && target.n >= 3 && target.t !== 'beast') { add += 1; parts.push('+1 Long Tượng'); }
    if (ctx.honphao) { add += 2; parts.push('+2 Hồn Pháo'); }
    dmg += add;
    // giảm phía người đánh (tối thiểu 1)
    var red1 = 0;
    if (atk.st.hong) { red1 += 1; parts.push('−1 Long Hống'); }
    if (atk.st.weak) { red1 += 1; parts.push('−1 Nguyền Yếu'); }
    if (ctx.extraMinus) { red1 += ctx.extraMinus; parts.push('−' + ctx.extraMinus + ' đòn thêm'); }
    if (red1 > 0 && dmg > 1) dmg = Math.max(1, dmg - red1);
    // giảm phía mục tiêu
    var red = 0, flags = {};
    if (target.t === 'shield' && ranged) { red += 1; parts.push('−1 Thuẫn'); }
    if (tf === 'dragon') {
      var scale = 0;
      if (target.t === 'shield' && target.st.vayR !== st.round) { scale += 1; flags.vay = 1; }
      if (P(st, target.o).passive === 'longgiap' && target.t !== 'worker' && target.st.giapR !== st.round) { scale += 1; flags.giap = 1; }
      scale = Math.min(2, scale);
      if (scale) { red += scale; parts.push('−' + scale + ' Giáp Rồng'); }
    }
    if (ranged && tf === 'fairy' && target.st.hophapR !== st.round) {
      var ids = teamIds(st);
      for (var i = 0; i < ids.length; i++) {
        var s = st.teams[ids[i]];
        if (s.id !== target.id && s.o === target.o && s.t === 'shield' && Math.abs(s.x - target.x) + Math.abs(s.y - target.y) === 1) { red += 1; flags.hophap = 1; parts.push('−1 Hộ Pháp'); break; }
      }
    }
    dmg = Math.max(0, dmg - red);
    if (target.st.shield) { dmg = 0; flags.shield = 1; parts.push('Thiên Mạc chặn'); }
    return { dmg: dmg, parts: parts, flags: flags, ranged: ranged };
  }

  // Áp sát thương lên đội. Trả {hpBefore, lost, destroyed}
  function damageTeam(st, target, dmg, src, srcTeam, ev, ctx) {
    ctx = ctx || {};
    var hpBefore = teamHP(target), lost = 0, destroyed = false, tf = fac(st, target), owner = target.o;
    if (dmg <= 0) { ev.push({ e: 'dmg', id: target.id, x: target.x, y: target.y, amt: 0 }); return { hpBefore: hpBefore, lost: 0, destroyed: false }; }
    if (target.t === 'beast') {
      target.hp -= dmg;
      if (target.hp <= 0) { destroyed = true; lost = 1; }
    } else {
      lost = Math.min(dmg, target.n); target.n -= lost;
      if (target.n <= 0) destroyed = true;
      if (target.na > target.n) target.na = target.n;
    }
    ev.push({ e: 'dmg', id: target.id, x: target.x, y: target.y, amt: dmg, lost: lost });
    P(st, owner).lost += lost;
    // Hồn cho Quỷ
    if (tf === 'demon' && lost > 0 && !ctx.noSoul && target.t !== 'king') {
      var pl = P(st, owner);
      pl.souls += lost;
      ev.push({ e: 'soul', p: owner, n: lost, log: pl.name + ' +' + lost + ' Hồn' });
      // Hồn Soái
      if (!pl.rcnt.honsoai) {
        var hs = teamIds(st).some(function (id) { var c = st.teams[id]; return c.o === owner && c.t === 'commander' && cheb(c.x, c.y, target.x, target.y) <= 2; });
        if (hs) { pl.rcnt.honsoai = 1; pl.souls += 1; ev.push({ e: 'soul', p: owner, n: 1, log: 'Hồn Soái +1 Hồn' }); }
      }
      for (var d = 0; d < lost; d++) st.deaths.push({ did: st.deaths.length + 1, o: owner, t: target.t, job: target.job || null, round: st.round, rv: 0 });
    }
    // Long Nộ
    if (!destroyed && tf === 'dragon' && P(st, owner).passive === 'longno' && lost > 0 && src >= 0 && enemy(st, src, owner)) {
      setSt(target, 'enraged', 1, { p: owner, t: P(st, owner).pturn + 1, at: 'end' });
    }
    if (destroyed) {
      delete st.teams[target.id];
      ev.push({ e: 'destroy', id: target.id, x: target.x, y: target.y, t: target.t, o: owner, log: (src >= 0 ? pn(st, src) + ' tiêu diệt ' : '') + nm(st, { t: target.t, job: target.job, n: hpBefore }) + ' của ' + pn(st, owner) });
      if (src >= 0 && enemy(st, src, owner)) {
        var sp = P(st, src), pref = ctx.rw && 'VTG'.indexOf(ctx.rw) >= 0 ? ctx.rw : 'V';
        sp.kills += lost;
        if (target.t === 'king') {
          sp.res[pref] += CFG.kingReward;
          ev.push({ e: 'reward', p: src, res: pref, n: CFG.kingReward, x: target.x, y: target.y, log: pn(st, src) + ' nhận ' + CFG.kingReward + pref + ' (diệt Vua)' });
        } else {
          var rk = target.t === 'worker' ? target.job : pref;
          sp.res[rk] += hpBefore;
          ev.push({ e: 'reward', p: src, res: rk, n: hpBefore, x: target.x, y: target.y, log: pn(st, src) + ' nhận ' + hpBefore + rk + ' thưởng kết liễu' });
          if (srcTeam && fac(st, srcTeam) === 'human') {
            if (srcTeam.t === 'archer' && target.t === 'worker') { sp.res[target.job] += 1; ev.push({ e: 'reward', p: src, res: target.job, n: 1, log: 'Săn Thưởng +1' + target.job }); }
            if (srcTeam.t === 'assassin' && !sp.cnt.sathu) { sp.cnt.sathu = 1; sp.res[pref] += 1; ev.push({ e: 'reward', p: src, res: pref, n: 1, log: 'Sát Thủ Thuê +1' + pref }); }
          }
          if (srcTeam && fac(st, srcTeam) === 'demon' && srcTeam.t === 'cavalry' && !ctx.dakyUsed) { ctx.dakyUsed = 1; sp.souls += 1; ev.push({ e: 'soul', p: src, n: 1, log: 'Dạ Kỵ +1 Hồn' }); }
        }
      }
      if (target.t === 'king') { ctx.kingDied = ctx.kingDied || []; ctx.kingDied.push({ p: owner, by: src }); }
      // hiệu ứng khi chết (không áp dụng khi xóa người thua)
      if (tf === 'demon') {
        if (target.t === 'shield' && srcTeam && st.teams[srcTeam.id]) { ctx.phanOan = ctx.phanOan || []; ctx.phanOan.push({ team: srcTeam.id, src: owner }); }
        if (target.t === 'beast') { ctx.spawns = ctx.spawns || []; ctx.spawns.push({ o: owner, x: target.x, y: target.y, n: 2, around: true, why: 'Ma Vương' }); }
        if (target.t === 'elephant') { ctx.spawns = ctx.spawns || []; ctx.spawns.push({ o: owner, x: target.x, y: target.y, n: 1, around: false, why: 'Tượng Xương' }); }
      }
    }
    return { hpBefore: hpBefore, lost: lost, destroyed: destroyed };
  }

  function doSpawns(st, ctx, ev) {
    (ctx.spawns || []).forEach(function (sp) {
      if (!P(st, sp.o).alive) return;
      var cells = [];
      if (!sp.around) cells.push([sp.x, sp.y]);
      if (sp.around || sp.alsoAround) ALL8.forEach(function (d) { cells.push([sp.x + d[0], sp.y + d[1]]); });
      if (sp.alsoAround) ORTH.forEach(function () { });
      var made = 0;
      for (var i = 0; i < cells.length && made < sp.n; i++) {
        var c = cells[i];
        if (!exists(st, c[0], c[1]) || teamAt(st, c[0], c[1])) continue;
        addTeam(st, sp.o, 'soldier', c[0], c[1], 1, null, P(st, sp.o).pturn);
        made++;
        ev.push({ e: 'spawn', o: sp.o, x: c[0], y: c[1], t: 'soldier', log: sp.why + ': Lính Quỷ xuất hiện tại ' + cellName(st, c[0], c[1]) });
      }
    });
    ctx.spawns = [];
  }

  function pushTeam(st, t, d, ev) {
    if (!t || !st.teams[t.id]) return;
    var x = t.x + d[0], y = t.y + d[1];
    if (!exists(st, x, y) || teamAt(st, x, y)) return;
    ev.push({ e: 'move', id: t.id, from: [t.x, t.y], to: [x, y], push: 1, log: nm(st, t) + ' bị đẩy lùi' });
    t.x = x; t.y = y;
  }

  // Giải quyết một đòn đánh hoàn chỉnh theo GDD 8.7
  function resolveAttack(st, atk, k, target, ctx, ev) {
    var p = atk.o;
    var dir = [sgn(target.x - atk.x), sgn(target.y - atk.y)];
    var cd = computeDamage(st, atk, k, target, ctx);
    // tiêu thụ buff
    delete atk.st.pct50; delete atk.st.plus; delete atk.st.enraged; delete atk.st.hong; delete atk.st.weak;
    if (cd.flags.vay) target.st.vayR = st.round;
    if (cd.flags.giap) target.st.giapR = st.round;
    if (cd.flags.hophap) target.st.hophapR = st.round;
    if (cd.flags.shield) delete target.st.shield;
    var tx = target.x, ty = target.y, tOwner = target.o, tType = target.t;
    ev.push({ e: 'attack', id: atk.id, from: [atk.x, atk.y], to: [tx, ty], ranged: cd.ranged, t: atk.t, dmg: cd.dmg, log: pn(st, p) + ': ' + nm(st, { t: atk.t, job: atk.job, n: k }) + ' đánh ' + nm(st, target) + ' — ' + cd.dmg + ' sát thương (' + cd.parts.join(', ') + ')' });
    var res = damageTeam(st, target, cd.dmg, p, atk, ev, ctx);
    var f = fac(st, atk);
    // Phun Lửa
    if (f === 'dragon' && atk.t === 'siege' && cd.dmg > 0) {
      var aux = null;
      if (ctx.aux) { var a0 = teamAt(st, ctx.aux[0], ctx.aux[1]); if (a0 && enemy(st, a0.o, p) && Math.abs(a0.x - tx) + Math.abs(a0.y - ty) === 1) aux = a0; }
      if (!aux) ORTH.some(function (d) { var a1 = teamAt(st, tx + d[0], ty + d[1]); if (a1 && enemy(st, a1.o, p) && a1.id !== atk.id) { aux = a1; return true; } return false; });
      if (aux) { ev.push({ e: 'fx', kind: 'fire', x: aux.x, y: aux.y, log: 'Phun Lửa lan 1 sát thương' }); damageTeam(st, aux, 1, p, atk, ev, ctx); }
    }
    // Tên Xuyên Giáp
    if (f === 'dragon' && atk.t === 'archer' && res.destroyed && cd.dmg > res.hpBefore) {
      var over = cd.dmg - res.hpBefore, bx = tx + dir[0], by = ty + dir[1];
      var bt = exists(st, bx, by) ? teamAt(st, bx, by) : null;
      if (bt && enemy(st, bt.o, p)) { ev.push({ e: 'fx', kind: 'pierce', x: bx, y: by, log: 'Tên Xuyên Giáp tràn ' + over + ' sát thương' }); damageTeam(st, bt, over, p, atk, ev, ctx); }
    }
    // Phản Oán
    (ctx.phanOan || []).forEach(function (po) {
      var tt = st.teams[po.team];
      if (tt) { ev.push({ e: 'fx', kind: 'curse', x: tt.x, y: tt.y, log: 'Phản Oán: kẻ diệt nhận 1 sát thương' }); damageTeam(st, tt, 1, po.src, null, ev, ctx); }
    });
    ctx.phanOan = [];
    // Vua chết → loại ngay
    (ctx.kingDied || []).forEach(function (kd) { eliminate(st, kd.p, kd.by, ev); });
    ctx.kingDied = [];
    if (st.over) return res;
    var alive = !!st.teams[atk.id];
    var occupied = false;
    if (alive && !cd.ranged && res.destroyed && ctx.occ !== false && !teamAt(st, tx, ty)) {
      ev.push({ e: 'move', id: atk.id, from: [atk.x, atk.y], to: [tx, ty], log: 'Chiếm ô ' + cellName(st, tx, ty) });
      atk.x = tx; atk.y = ty; occupied = true;
    }
    // Đẩy lùi
    var tgtAlive = st.teams[target.id];
    if (alive && tgtAlive && cd.dmg > 0) {
      if (f === 'dragon' && atk.t === 'chariot' && !(fac(st, tgtAlive) === 'dragon' && tgtAlive.t === 'elephant')) pushTeam(st, tgtAlive, dir, ev);
      else if (f === 'human' && atk.t === 'elephant' && ctx.phatran && tgtAlive.t !== 'king' && !(fac(st, tgtAlive) === 'dragon' && tgtAlive.t === 'elephant')) pushTeam(st, tgtAlive, dir, ev);
    }
    // Du Kích
    if (alive && f === 'fairy' && atk.t === 'soldier' && !res.destroyed && ctx.retreat !== false) {
      var rx = atk.x - dir[0], ry = atk.y - dir[1];
      if (exists(st, rx, ry) && !teamAt(st, rx, ry)) { ev.push({ e: 'move', id: atk.id, from: [atk.x, atk.y], to: [rx, ry], log: 'Du Kích lùi 1 ô' }); atk.x = rx; atk.y = ry; }
    }
    // Bóng Ma
    var returned = false;
    if (alive && f === 'demon' && atk.t === 'assassin' && ctx.back && ctx.start && !(atk.x === ctx.start[0] && atk.y === ctx.start[1]) && !teamAt(st, ctx.start[0], ctx.start[1])) {
      ev.push({ e: 'move', id: atk.id, from: [atk.x, atk.y], to: ctx.start, log: 'Bóng Ma trở về' });
      atk.x = ctx.start[0]; atk.y = ctx.start[1]; returned = true;
    }
    // Đoạt Sinh
    var pl = P(st, p);
    if (alive && occupied && !returned && f === 'demon' && pl.passive === 'doatsinh' && (pl.ready.doatsinh || 0) <= pl.pturn &&
      atk.t !== 'king' && atk.t !== 'beast' && atk.t !== 'commander' && atk.x === tx && atk.y === ty) {
      atk.n += CFG.demonGrowthAmount; atk.na += CFG.demonGrowthAmount;
      pl.ready.doatsinh = pl.pturn + CFG.demonGrowthCooldown;
      ev.push({ e: 'grow', id: atk.id, x: atk.x, y: atk.y, n: atk.n, log: 'Đoạt Sinh: đội tăng lên ' + atk.n + ' quân' });
    }
    // Hấp Hồn
    if (alive && res.destroyed && atk.st.haphon) {
      delete atk.st.haphon;
      ctx.spawns = ctx.spawns || [];
      ctx.spawns.unshift({ o: p, x: tx, y: ty, n: CFG.absorbSpawnMax, around: !!teamAt(st, tx, ty), alsoAround: !teamAt(st, tx, ty), why: 'Hấp Hồn' });
    }
    doSpawns(st, ctx, ev);
    // Nguyền Yếu
    if (f === 'demon' && atk.t === 'mage' && st.teams[target.id]) setSt(st.teams[target.id], 'weak', 1, { p: tOwner, t: P(st, tOwner).pturn + 1, at: 'end' });
    // đòn/di chuyển thêm
    if (alive && st.teams[atk.id]) {
      if (occupied && atk.st.longuy) { delete atk.st.longuy; st.pending.push({ k: 'atk', team: atk.id, why: 'Long Uy' }); }
      if (occupied && f === 'demon' && atk.t === 'chariot') st.pending.push({ k: 'mv', team: atk.id, range: 2, why: 'Quỷ Xa' });
      if (f === 'demon' && atk.t === 'archer' && !ctx.isExtra) st.pending.push({ k: 'mv', team: atk.id, range: 1, why: 'Ma Tiễn' });
      if (ctx.tamung) st.pending.push({ k: 'atk', team: atk.id, minus: 1, why: 'Phép Tạm Ứng' });
    }
    return res;
  }

  /* ---------------- áp lệnh ---------------- */
  var H = {};

  E.apply = function (state, cmd) {
    var st = clone(state), ev = [];
    try {
      var err = applyInner(st, cmd, ev);
      if (err) return { ok: false, err: err, state: state, events: [] };
      return { ok: true, state: st, events: ev };
    } catch (ex) {
      return { ok: false, err: 'Lỗi nội bộ: ' + (ex && ex.message), state: state, events: [] };
    }
  };

  function applyInner(st, cmd, ev) {
    if (!cmd || typeof cmd.c !== 'string') return 'Lệnh rỗng';
    if (st.over) return 'Ván đã kết thúc';
    var h = H[cmd.c];
    if (!h) return 'Lệnh không rõ: ' + cmd.c;
    if (cmd.c !== 'resign' && cmd.c !== 'timeout') {
      if (cmd.p !== st.active) return 'Chưa tới lượt';
    }
    var r = h(st, cmd, ev);
    if (r) return r;
    // người đang đi bị loại giữa lượt
    if (!st.over && !P(st, st.active).alive) advance(st, ev);
    return null;
  }

  function ensureHarvest(st, ev) { if (st.phase === 'start') harvest(st, ev); }
  function needWindow(st, ev, allowAct) {
    ensureHarvest(st, ev);
    if (st.pending.length) return 'Hãy giải quyết hiệu ứng đang chờ (' + st.pending[0].why + ') trước';
    if (!allowAct && st.phase !== 'buy') return 'Đã qua pha mua sắm';
    return null;
  }
  function own(st, id, p) { var t = st.teams[id]; return t && t.o === p ? t : null; }
  function cellOf(a) { return Array.isArray(a) && a.length === 2 ? [a[0] | 0, a[1] | 0] : null; }

  H.harvest = function (st, cmd, ev) { if (st.phase !== 'start') return 'Đã thu hoạch'; harvest(st, ev); };

  H.job = function (st, cmd, ev) {
    if (st.phase !== 'start') return 'Chỉ đổi nghề trước thu hoạch';
    var pl = P(st, cmd.p); if (pl.faction !== 'human') return 'Chỉ Dân Nhân tộc đổi nghề';
    var t = own(st, cmd.id, cmd.p); if (!t || t.t !== 'worker') return 'Không phải đội Dân';
    if (t.jobDone) return 'Đội này đã đổi nghề lượt này';
    if (['V', 'T', 'G'].indexOf(cmd.job) < 0 || cmd.job === t.job) return 'Nghề không hợp lệ';
    t.job = cmd.job; t.jobDone = 1;
    ev.push({ e: 'job', id: t.id, log: 'Đổi nghề thành ' + TT.JOB[cmd.job] });
  };

  H.buy = function (st, cmd, ev) {
    var m = Math.max(1, Math.min(48, cmd.m | 0 || 1));
    for (var i = 0; i < m; i++) { var r = buyOne(st, cmd, ev); if (r) return r; }
    return null;
  };
  function buyOne(st, cmd, ev) {
    var e = needWindow(st, ev); if (e) return e;
    var p = cmd.p, pl = P(st, p), type = cmd.u, def = U[type];
    if (!def || type === 'king') return 'Loại quân không hợp lệ';
    if (def.age > pl.age) return 'Cần Đời ' + TT.AGE_ROMAN[def.age];
    if (type === 'beast' && pl.beast) return 'Thần thú chỉ mua 1 lần cả trận';
    var job = type === 'worker' ? cmd.job : null;
    if (type === 'worker' && ['V', 'T', 'G'].indexOf(job) < 0) return 'Chọn nghề cho Dân';
    var c = cellOf(cmd.cell); if (!c || !isSpawn(st, p, c[0], c[1]) || !exists(st, c[0], c[1])) return 'Phải đặt ở hàng spawn';
    var o = teamAt(st, c[0], c[1]);
    if (o) {
      if (o.o !== p || o.t !== type || o.rest !== pl.pturn || type === 'beast' || (job && o.job !== job)) return 'Ô spawn đã có quân';
      if (o.n + 1 > cap(st, p)) return 'Đội đã đủ ' + cap(st, p);
    }
    var price = E.price(st, p, type);
    if (!canPay(pl.res, price)) return 'Không đủ tài nguyên';
    pl.res.V -= price.V; pl.res.T -= price.T; pl.res.G -= price.G;
    if (price.any) { var er = payAny(pl, price.any, cmd.pay); if (er) return er; }
    pl.firstBuy = true;
    if (type === 'beast') pl.beast = true;
    var tm;
    if (o) { o.n += 1; tm = o; } else tm = addTeam(st, p, type, c[0], c[1], 1, job, pl.pturn);
    ev.push({ e: 'buy', id: tm.id, x: c[0], y: c[1], t: type, log: pl.name + ' mua ' + def.name + (job ? ' (' + TT.JOB[job] + ')' : '') });
    return null;
  }

  /* nén gói lượt: gộp các lệnh mua giống nhau liên tiếp */
  E.compact = function (cmds) {
    var out = [];
    cmds.forEach(function (c) {
      var d = {}; Object.keys(c).forEach(function (k) { if (k !== 'p' && c[k] !== undefined && c[k] !== null) d[k] = c[k]; });
      var last = out[out.length - 1];
      if (last && d.c === 'buy' && last.c === 'buy' && !d.pay && !last.pay && last.u === d.u && last.job === d.job && last.cell[0] === d.cell[0] && last.cell[1] === d.cell[1]) { last.m = (last.m || 1) + 1; return; }
      out.push(d);
    });
    return out;
  };

  H.age = function (st, cmd, ev) {
    var e = needWindow(st, ev); if (e) return e;
    var pl = P(st, cmd.p); if (pl.age >= 4) return 'Đã ở Đời cao nhất';
    var c = CFG.ageCosts[pl.age + 1];
    if (!canPay(pl.res, c)) return 'Không đủ tài nguyên lên đời';
    pl.res.V -= c.V; pl.res.T -= c.T; pl.res.G -= c.G;
    pl.age += 1;
    ev.push({ e: 'age', p: cmd.p, age: pl.age, log: pl.name + ' lên Đời ' + TT.AGE_ROMAN[pl.age] + ' — ' + TT.AGE_NAME[pl.age] });
  };

  H.trade = function (st, cmd, ev) {
    var e = needWindow(st, ev, true); if (e) return e;
    var pl = P(st, cmd.p); if (pl.passive !== 'chotroi') return 'Cần nội tại Chợ Trời';
    var get = cmd.get; if (['V', 'T', 'G'].indexOf(get) < 0) return 'Chọn tài nguyên nhận';
    var er = payAny(pl, 2, cmd.give); if (er) return er;
    pl.res[get] += 1;
    ev.push({ e: 'trade', p: cmd.p, log: 'Chợ Trời: đổi 2 lấy 1' + get });
  };

  H.end = function (st, cmd, ev) {
    ensureHarvest(st, ev);
    endTurn(st, ev);
  };
  H.skip = function (st, cmd, ev) {
    if (!st.pending.length) return 'Không có hiệu ứng chờ';
    var pd = st.pending.shift();
    ev.push({ e: 'skip', log: 'Bỏ qua ' + pd.why });
  };
  H.resign = function (st, cmd, ev) {
    var p = cmd.p; if (!P(st, p) || !P(st, p).alive) return 'Không hợp lệ';
    ev.push({ e: 'log', log: pn(st, p) + ' đầu hàng.' });
    var wasActive = st.active === p;
    eliminate(st, p, -1, ev);
    if (wasActive && !st.over) advance(st, ev);
  };
  H.timeout = function (st, cmd, ev) {
    if (cmd.target !== st.active) return 'Không phải người đang đi';
    ev.push({ e: 'log', log: pn(st, st.active) + ' hết giờ — bỏ lượt.' });
    var pl = P(st, st.active); pl.timeouts = (pl.timeouts || 0) + 1;
    if (pl.timeouts >= 3) { var p = st.active; eliminate(st, p, -1, ev); if (!st.over) advance(st, ev); return; }
    endTurn(st, ev);
  };

  /* hành động: đi rồi đánh */
  H.act = function (st, cmd, ev) {
    ensureHarvest(st, ev);
    if (st.pending.length) return 'Hãy giải quyết ' + st.pending[0].why + ' trước';
    var p = cmd.p, pl = P(st, p);
    if (pl.used >= CFG.actionsByAge[pl.age]) return 'Hết hành động';
    var t = own(st, cmd.id, p); if (!t) return 'Không phải quân của bạn';
    var avail = t.n - t.na; if (avail <= 0) return 'Đội đã hành động';
    var resting = isResting(st, t);
    if (resting && !(pl.passive === 'tienphong' && t.t !== 'king')) return 'Quân mới mua đang nghỉ';
    var k = cmd.k == null ? avail : (cmd.k | 0);
    if (t.t === 'beast' || t.t === 'king') k = 1;
    if (k < 1 || k > avail) return 'Số quân không hợp lệ';
    var to = cmd.to ? cellOf(cmd.to) : null;
    if (to && to[0] === t.x && to[1] === t.y) to = null;
    var tgt = cmd.tgt ? cellOf(cmd.tgt) : null;
    if (!to && !tgt) return 'Hành động trống';
    var opt = cmd.opt || {};
    var mv = null;
    if (to) {
      var mts = E.moveTargets(st, t.id, k);
      mv = mts.filter(function (m) { return m.x === to[0] && m.y === to[1]; })[0];
      if (!mv) return 'Không đi tới ô đó được';
      if (mv.merge && tgt) return 'Gộp đội kết thúc hành động, không đánh được';
    }
    if (tgt) {
      if (peace(st)) return 'Đang trong ' + CFG.peaceTurns + ' lượt miễn chiến';
      if (resting) return 'Quân mới mua không được đánh trong lượt mua';
      if (t.st.curse && to) return 'Bị Lời Nguyền: không được đánh sau khi di chuyển';
      var fx = to ? to[0] : t.x, fy = to ? to[1] : t.y;
      // kiểm tra mục tiêu với vị trí giả định
      var ox = t.x, oy = t.y; t.x = fx; t.y = fy;
      var ats = E.attackTargets(st, t.id, fx, fy, !!to);
      t.x = ox; t.y = oy;
      if (!ats.some(function (a) { return a.x === tgt[0] && a.y === tgt[1]; })) return 'Mục tiêu ngoài tầm';
    }
    // tùy chọn có phí
    var f = pl.faction;
    if (opt.tamung && !(f === 'human' && t.t === 'mage' && tgt)) opt.tamung = false;
    if (opt.honphao && !(f === 'demon' && t.t === 'siege' && tgt)) opt.honphao = false;
    if (opt.phatran && !(f === 'human' && t.t === 'elephant' && tgt)) opt.phatran = false;
    if (opt.tamung && pl.res.V < 2) return 'Phép Tạm Ứng cần 2V';
    if (opt.honphao && pl.souls < 1) return 'Hồn Pháo cần 1 Hồn';
    if (opt.phatran && pl.res.G < CFG.elephantPushCost) return 'Phá Trận cần 2G';
    var carry = null;
    if (opt.carry != null) {
      carry = own(st, opt.carry, p);
      if (!(f === 'human' && t.t === 'chariot' && carry && carry.t === 'worker' && carry.n <= 2 && carry.na === 0 && !isResting(st, carry) &&
        Math.abs(carry.x - t.x) + Math.abs(carry.y - t.y) === 1 && to && mv && mv.steps >= 2 && !mv.merge)) return 'Thương Xa: không chở được';
    }
    // --- bắt đầu giải quyết ---
    if (opt.tamung) pl.res.V -= 2;
    if (opt.honphao) pl.souls -= 1;
    if (opt.phatran) pl.res.G -= CFG.elephantPushCost;
    pl.used += 1;
    st.phase = 'act';
    var start = [t.x, t.y];
    var actor = t;
    if (k < t.n) {
      // tách: phần hành động thành đội mới
      t.n -= k;
      actor = addTeam(st, p, t.t, t.x, t.y, k, t.job, t.rest);
      // chuyển buff tấn công, sao chép giáp/hiệu ứng xấu
      Object.keys(t.st).sort().forEach(function (key) {
        if (OFFENSIVE.indexOf(key) >= 0) { actor.st[key] = t.st[key]; delete t.st[key]; }
        else actor.st[key] = clone(t.st[key]);
      });
      if (!to) { // đánh tại chỗ: không tách thật, chỉ đánh dấu
        t.n += k; delete st.teams[actor.id]; st.nextId -= 1;
        Object.keys(actor.st).forEach(function (key) { if (OFFENSIVE.indexOf(key) >= 0) t.st[key] = actor.st[key]; });
        actor = t;
      }
    }
    var cursed = !!actor.st.curse; delete actor.st.curse;
    if (cursed && t !== actor) delete t.st.curse;
    if (to) {
      if (mv.merge) {
        var dest = st.teams[mv.merge];
        ev.push({ e: 'move', id: actor.id, from: [actor.x, actor.y], to: to, merge: dest.id, log: pl.name + ': ' + nm(st, actor) + ' gộp vào đội tại ' + cellName(st, to[0], to[1]) });
        dest.n += actor.n; dest.na += actor.n;
        Object.keys(actor.st).sort().forEach(function (key) { if (!dest.st[key]) dest.st[key] = actor.st[key]; });
        delete st.teams[actor.id];
        if (actor === t) { /* đã xóa */ }
        return null;
      }
      ev.push({ e: 'move', id: actor.id, from: [actor.x, actor.y], to: to, log: pl.name + ': ' + nm(st, actor) + ' → ' + cellName(st, to[0], to[1]) });
      if (carry) {
        var bx = to[0] - mv.dir[0], by = to[1] - mv.dir[1];
        if (teamAt(st, bx, by)) return 'Thương Xa: không còn chỗ thả Dân';
        ev.push({ e: 'move', id: carry.id, from: [carry.x, carry.y], to: [bx, by], log: 'Thương Xa chở Dân' });
        carry.x = bx; carry.y = by; carry.na = carry.n;
      }
      actor.x = to[0]; actor.y = to[1];
    }
    actor.na += (actor === t && k < t.n) ? k : actor.n - actor.na;
    if (actor !== t) actor.na = actor.n;
    if (tgt) {
      var target = teamAt(st, tgt[0], tgt[1]);
      var ctx = { moved: !!to, steps: mv ? mv.steps : 0, occ: opt.occ !== false, back: !!opt.back, retreat: opt.retreat !== false, rw: opt.rw, start: start, honphao: !!opt.honphao, phatran: !!opt.phatran, tamung: !!opt.tamung, aux: opt.aux };
      resolveAttack(st, actor, k, target, ctx, ev);
    }
    return null;
  };

  /* hiệu ứng đang chờ: đòn thêm / đi thêm */
  H.follow = function (st, cmd, ev) {
    if (!st.pending.length) return 'Không có hiệu ứng chờ';
    var pd = st.pending[0], t = own(st, pd.team, cmd.p);
    if (!t) { st.pending.shift(); return null; }
    if (pd.k === 'mv') {
      var to = cellOf(cmd.to); if (!to) return 'Chọn ô';
      var ok = E.moveTargets(st, t.id, t.n, { range: pd.range, dirs: 'orth', noMerge: true }).some(function (m) { return m.x === to[0] && m.y === to[1]; });
      if (!ok) return 'Không đi tới ô đó được';
      ev.push({ e: 'move', id: t.id, from: [t.x, t.y], to: to, log: pd.why + ': đi thêm' });
      t.x = to[0]; t.y = to[1];
      st.pending.shift();
      return null;
    }
    var tgt = cellOf(cmd.tgt); if (!tgt) return 'Chọn mục tiêu';
    if (!E.attackTargets(st, t.id, t.x, t.y, false).some(function (a) { return a.x === tgt[0] && a.y === tgt[1]; })) return 'Mục tiêu ngoài tầm';
    st.pending.shift();
    var target = teamAt(st, tgt[0], tgt[1]);
    var opt = cmd.opt || {};
    resolveAttack(st, t, t.t === 'beast' ? 1 : t.n, target, { moved: false, steps: 0, occ: opt.occ !== false, rw: opt.rw, extraMinus: pd.minus || 0, isExtra: true, start: [t.x, t.y] }, ev);
    return null;
  };

  /* kỹ năng kích hoạt */
  E.skillReady = function (st, p, id) { return (P(st, p).ready[id] || 0) <= P(st, p).pturn; };
  E.findActive = function (fid, aid) { return F[fid].actives.filter(function (a) { return a.id === aid; })[0]; };

  H.skill = function (st, cmd, ev) {
    var e = needWindow(st, ev, true); if (e) return e;
    var p = cmd.p, pl = P(st, p), a = E.findActive(pl.faction, cmd.a);
    if (!a) return 'Kỹ năng không thuộc tộc';
    if (!E.skillReady(st, p, a.id)) return a.name + ' đang hồi (' + ((pl.ready[a.id] || 0) - pl.pturn) + ' lượt)';
    if (a.hostile && peace(st)) return 'Miễn chiến: không dùng kỹ năng nhắm đối thủ';
    var t = cmd.id != null ? st.teams[cmd.id] : null;
    var exEnd = { p: p, t: pl.pturn, at: 'end' };
    switch (a.id) {
      case 'longluc':
        if (!t || t.o !== p || U[t.t].atk.kind === 'none' && !(t.t === 'worker')) return 'Chọn đội của bạn';
        setSt(t, 'pct50', 1, exEnd); break;
      case 'longuy':
        if (!t || t.o !== p || atkProfile(st, t).kind !== 'melee') return 'Chọn đội cận chiến của bạn';
        setSt(t, 'longuy', 1, exEnd); break;
      case 'longhong':
        if (!t || t.o !== p) return 'Chọn đội Rồng của bạn';
        teamIds(st).forEach(function (id) {
          var o = st.teams[id];
          if (enemy(st, o.o, p) && cheb(o.x, o.y, t.x, t.y) <= 2) { setSt(o, 'hong', 1, { p: o.o, t: P(st, o.o).pturn + 1, at: 'end' }); ev.push({ e: 'fx', kind: 'roar', x: o.x, y: o.y }); }
        });
        break;
      case 'taitro':
        if (!t || t.o !== p) return 'Chọn đội của bạn';
        var er = payAny(pl, 3, cmd.pay); if (er) return er;
        setSt(t, 'plus', 1, exEnd); break;
      case 'hoilo':
        if (!t || !enemy(st, t.o, p)) return 'Chọn quân địch';
        if (t.n !== 1 || t.t === 'king' || t.t === 'beast' || t.t === 'commander') return 'Chỉ quân lẻ, không Vua/Thần thú/Chỉ Huy';
        var val = TT.baseValue(t.t); if (val > 7) return 'Giá trị cơ bản phải ≤7';
        var adj = teamIds(st).some(function (id) { var o = st.teams[id]; return o.o === p && Math.abs(o.x - t.x) + Math.abs(o.y - t.y) === 1; });
        if (!adj) return 'Phải kề quân Nhân';
        var er2 = payAny(pl, 2 * val, cmd.pay); if (er2) return er2;
        var from = t.o;
        t.o = p; t.rest = pl.pturn; t.na = 0; t.st = {};
        if (t.t === 'beast') t.hp = Math.min(t.hp, 3);
        ev.push({ e: 'convert', id: t.id, x: t.x, y: t.y, from: from, log: 'Hối Lộ: ' + U[t.t].name + ' của ' + pn(st, from) + ' đổi chủ' });
        break;
      case 'thuthue':
        st.players.forEach(function (o, i) {
          if (!o.alive || !enemy(st, i, p)) return;
          var k = ['V', 'T', 'G'].sort(function (x, y) { return (o.res[y] - o.res[x]) || ('VTG'.indexOf(x) - 'VTG'.indexOf(y)); })[0];
          if (o.res[k] > 0) { o.res[k] -= 1; pl.res[k] += 1; ev.push({ e: 'gain', p: p, log: 'Thu Thuế: lấy 1' + k + ' từ ' + o.name }); }
        });
        break;
      case 'linhnhan':
        if (!t || t.o !== p || !isRangedType(t.t)) return 'Chọn đội tầm xa của bạn';
        setSt(t, 'linhnhan', 1, exEnd); break;
      case 'hoanvi':
        var t2 = cmd.id2 != null ? st.teams[cmd.id2] : null;
        if (!t || !t2 || t.o !== p || t2.o !== p || t.id === t2.id) return 'Chọn hai đội của bạn';
        if (t.t === 'king' || t2.t === 'king') return 'Không chọn Vua';
        if (cheb(t.x, t.y, t2.x, t2.y) > 3) return 'Hai đội phải cách nhau ≤3 ô';
        var x = t.x, y = t.y; t.x = t2.x; t.y = t2.y; t2.x = x; t2.y = y;
        ev.push({ e: 'swap', a: t.id, b: t2.id, log: 'Hoán Vị hai đội' });
        break;
      case 'thienmac':
        if (!t || t.o !== p) return 'Chọn đội của bạn';
        setSt(t, 'shield', 1, { p: p, t: pl.pturn + 1, at: 'start' }); break;
      case 'loinguyen':
        if (!t || !enemy(st, t.o, p)) return 'Chọn đội địch';
        if (pl.souls < 1) return 'Cần 1 Hồn';
        pl.souls -= 1;
        setSt(t, 'curse', 1, { p: t.o, t: P(st, t.o).pturn + 1, at: 'end' });
        ev.push({ e: 'fx', kind: 'curse', x: t.x, y: t.y }); break;
      case 'huyette':
        if (!t || t.o !== p || t.t === 'king' || t.t === 'beast') return 'Chọn quân Quỷ để hy sinh (không Vua/Thần thú)';
        var tg = cmd.tgt ? teamAt(st, cmd.tgt[0], cmd.tgt[1]) : null;
        if (!tg || !enemy(st, tg.o, p) || cheb(tg.x, tg.y, t.x, t.y) > 2) return 'Chọn đội địch trong phạm vi 2';
        var sx = t.x, sy = t.y;
        t.n -= 1; if (t.na > t.n) t.na = t.n;
        if (t.n <= 0) delete st.teams[t.id];
        pl.souls += 1; pl.lost += 1;
        st.deaths.push({ did: st.deaths.length + 1, o: p, t: t.t, job: t.job || null, round: st.round, rv: 0 });
        ev.push({ e: 'sacrifice', x: sx, y: sy, log: 'Huyết Tế: hy sinh 1 ' + U[t.t].name + ' (+1 Hồn)' });
        var ctx = { rw: cmd.rw };
        damageTeam(st, tg, 2, p, null, ev, ctx);
        (ctx.phanOan || []).forEach(function () { });
        (ctx.kingDied || []).forEach(function (kd) { eliminate(st, kd.p, kd.by, ev); });
        doSpawns(st, ctx, ev);
        break;
      case 'haphon':
        if (!t || t.o !== p || t.t === 'king') return 'Chọn đội của bạn (không Vua)';
        setSt(t, 'haphon', 1, exEnd); break;
      default: return 'Kỹ năng chưa hỗ trợ';
    }
    pl.ready[a.id] = pl.pturn + a.cd;
    ev.push({ e: 'skill', p: p, a: a.id, id: t ? t.id : null, x: t ? t.x : null, y: t ? t.y : null, log: pl.name + ' dùng ' + a.name });
    return null;
  };

  /* nội tại/đặc tính chủ động */
  H.oanhon = function (st, cmd, ev) {
    var e = needWindow(st, ev, true); if (e) return e;
    var pl = P(st, cmd.p); if (pl.passive !== 'oanhon') return 'Cần nội tại Oán Hồn';
    if (pl.souls < CFG.soulSpawnCost) return 'Cần 3 Hồn';
    var c = cellOf(cmd.cell); if (!c || !isSpawn(st, cmd.p, c[0], c[1]) || teamAt(st, c[0], c[1])) return 'Chọn ô spawn trống';
    pl.souls -= CFG.soulSpawnCost;
    addTeam(st, cmd.p, 'soldier', c[0], c[1], 1, null, pl.pturn);
    ev.push({ e: 'spawn', o: cmd.p, x: c[0], y: c[1], t: 'soldier', log: 'Oán Hồn: triệu 1 Lính Quỷ' });
  };
  E.taisinhCandidate = function (st, p) {
    var bad = { king: 1, beast: 1, chariot: 1, elephant: 1, commander: 1 };
    for (var i = st.deaths.length - 1; i >= 0; i--) {
      var d = st.deaths[i];
      if (d.o !== p || d.rv || bad[d.t] || d.round < st.round - 1 || TT.baseValue(d.t) > 7) continue;
      return d;
    }
    return null;
  };
  H.taisinh = function (st, cmd, ev) {
    var e = needWindow(st, ev, true); if (e) return e;
    var pl = P(st, cmd.p); if (pl.passive !== 'taisinh') return 'Cần nội tại Tái Sinh';
    if (pl.souls < CFG.soulSpawnCost) return 'Cần 3 Hồn';
    var d = E.taisinhCandidate(st, cmd.p); if (!d) return 'Không có quân hợp lệ để hồi';
    var c = cellOf(cmd.cell); if (!c || !isSpawn(st, cmd.p, c[0], c[1]) || teamAt(st, c[0], c[1])) return 'Chọn ô spawn trống';
    pl.souls -= CFG.soulSpawnCost; d.rv = 1;
    addTeam(st, cmd.p, d.t, c[0], c[1], 1, d.job, pl.pturn);
    ev.push({ e: 'spawn', o: cmd.p, x: c[0], y: c[1], t: d.t, log: 'Tái Sinh: hồi ' + U[d.t].name });
  };
  H.hiente = function (st, cmd, ev) {
    var e = needWindow(st, ev, true); if (e) return e;
    var pl = P(st, cmd.p); if (pl.faction !== 'demon') return 'Chỉ Quỷ tộc';
    var t = own(st, cmd.id, cmd.p); if (!t || t.t !== 'worker') return 'Chọn đội Dân';
    t.n -= 1; if (t.na > t.n) t.na = t.n;
    var x = t.x, y = t.y;
    if (t.n <= 0) delete st.teams[t.id];
    pl.souls += CFG.sacrificeSouls; pl.lost += 1;
    ev.push({ e: 'sacrifice', x: x, y: y, log: 'Hiến Tế: +2 Hồn' });
  };
  H.dieubinh = function (st, cmd, ev) {
    var e = needWindow(st, ev, true); if (e) return e;
    var p = cmd.p, pl = P(st, p);
    var c = own(st, cmd.cmdId, p); if (!c || c.t !== 'commander' || pl.faction !== 'human') return 'Cần Chỉ Huy Nhân tộc';
    if (pl.cnt.dieubinh) return 'Điều Binh 1 lần mỗi lượt';
    var t = own(st, cmd.id, p);
    if (!t || t.t === 'king' || t.id === c.id || isResting(st, t) || Math.abs(t.x - c.x) + Math.abs(t.y - c.y) !== 1) return 'Chọn đội kề Chỉ Huy (không Vua, không nghỉ)';
    var to = cellOf(cmd.to); if (!to || Math.abs(to[0] - t.x) + Math.abs(to[1] - t.y) !== 1 || !exists(st, to[0], to[1]) || teamAt(st, to[0], to[1])) return 'Ô đến phải trống, kề 1 ô';
    if (pl.res.V < CFG.commanderRepositionCost) return 'Cần 2V';
    pl.res.V -= CFG.commanderRepositionCost; pl.cnt.dieubinh = 1;
    ev.push({ e: 'move', id: t.id, from: [t.x, t.y], to: to, log: 'Điều Binh: dịch đội 1 ô' });
    t.x = to[0]; t.y = to[1];
  };

  /* ---------------- tiện ích cho UI/bot ---------------- */
  E.actionsLeft = function (st) { var pl = P(st, st.active); return CFG.actionsByAge[pl.age] - pl.used; };
  E.previewAttack = function (st, teamId, k, fx, fy, moved, steps, tx, ty) {
    var t = st.teams[teamId], target = teamAt(st, tx, ty);
    if (!t || !target) return null;
    var tmp = clone(st), tt = tmp.teams[teamId];
    tt.x = fx; tt.y = fy;
    var cd = computeDamage(tmp, tt, k, tmp.teams[target.id], { moved: moved, steps: steps });
    var hp = teamHP(target);
    return { dmg: cd.dmg, parts: cd.parts, kill: cd.dmg >= hp, hp: hp, reward: target.t === 'king' ? CFG.kingReward : (cd.dmg >= hp ? hp : 0) };
  };
  E.score = function (st, i) {
    var pl = P(st, i), s = pl.res.V + pl.res.T + pl.res.G;
    teamIds(st).forEach(function (id) { var t = st.teams[id]; if (t.o === i && t.t !== 'king') s += TT.baseValue(t.t) * t.n; });
    return s;
  };
  E.kingOf = function (st, p) {
    var ids = teamIds(st);
    for (var i = 0; i < ids.length; i++) { var t = st.teams[ids[i]]; if (t.o === p && t.t === 'king') return t; }
    return null;
  };
  // Vua có bị đe dọa trực tiếp (tầm đánh hiện tại, không tính di chuyển)
  E.kingThreat = function (st, p) {
    var k = E.kingOf(st, p); if (!k) return false;
    return teamIds(st).some(function (id) {
      var t = st.teams[id]; if (!enemy(st, t.o, p)) return false;
      return E.attackTargets(st, t.id, t.x, t.y, false).some(function (a) { return a.id === k.id; });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
