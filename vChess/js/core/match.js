/* Tứ Tộc Kỳ Chiến 2.0 — quản lý ván: ngày, thu nhập, bản đồ, sự kiện, điểm. Thuần và xác định. */
(function (G) {
  'use strict';
  var TT = G.TT, CFG = TT.CONFIG, P = TT.Prep;
  var MT = TT.Match = {};

  /* setup: {seed, mode, teamMode, openFormation, players:[{seat,name,race,talent,start,bot}]} */
  MT.create = function (setup) {
    var M = {
      v: TT.RULE_VERSION, seed: setup.seed >>> 0, mode: setup.mode, team: !!setup.teamMode, lockMap: !!setup.lockMap,
      day: 0, phase: 'prep', players: [], scores: {}, history: [], over: false, winner: null
    };
    setup.players.slice().sort(function (a, b) { return +a.seat - +b.seat; }).forEach(function (o) {
      var p = P.newPlayer(o); p.side = TT.sideOfSeat(M.mode, o.seat);
      p.team = M.team ? (+o.seat % 2) : p.side;
      M.players.push(p);
      M.scores[p.seat] = { pts: 0, rank: 0, kill: 0, killPop: 0, ranks: [], dayPts: [] };
    });
    return M;
  };
  MT.player = function (M, seat) { seat = String(seat); for (var i = 0; i < M.players.length; i++) if (M.players[i].seat === seat) return M.players[i]; return null; };
  MT.ctx = function (M, p) {
    var d = TT.mapDims(M.mode);
    return { seed: M.seed, day: M.day, mode: M.mode, side: p.side, zone: TT.zoneOf(M.mode, p.side), W: d.W, H: d.H, event: M.event };
  };
  MT.dayInfo = function (M, day) {
    var info = TT.DAYS[day] || {}, ev = null, wt = TT.WEATHER_ORDER[TT.hash32(M.seed, 'wx', day) % TT.WEATHER_ORDER.length];
    if (info.kind === 'event') ev = TT.EVENT_ORDER[TT.hash32(M.seed, 'ev', day) % TT.EVENT_ORDER.length];
    return { kind: info.kind, name: info.name, event: ev, weather: wt, monster: info.kind === 'monster' ? info.lvl : 0, night: day % 2 === 0 };
  };
  MT.beginDay = function (M) {
    M.day++; M.phase = 'prep';
    var di = MT.dayInfo(M, M.day);
    M.event = di.event; M.weather = di.weather; M.monster = di.monster;
    M.map = TT.mapForDay(M.seed, M.day, M.mode, M.event, M.lockMap);
    M.players.forEach(function (p) { if (!p.out) P.dayStart(p, MT.ctx(M, p)); });
    return di;
  };
  MT.battleInput = function (M) {
    return {
      seed: M.seed, day: M.day, mode: M.mode, map: M.map, event: M.event, weather: M.weather, monster: M.monster,
      players: M.players.filter(function (p) { return !p.out; }).map(function (p) {
        return { seat: p.seat, name: p.name, side: p.side, team: p.team, race: p.race, talent: p.talent, lv: p.lv, cores: p.cores.slice(), squads: P.clone(p.squads) };
      })
    };
  };
  /* Kết toán ngày: điểm hạng + điểm hạ gục + thưởng Vàng săn quái */
  MT.endDay = function (M, res) {
    var nT = res.nTeams, table;
    if (M.team) table = [15, 4];
    else table = CFG.rankPts[Math.max(2, Math.min(4, nT))] || CFG.rankPts[4];
    var mult = M.day === CFG.days ? CFG.finalMult : 100;
    var summary = { day: M.day, ranks: {}, pts: {}, kills: {} };
    res.players.forEach(function (r) {
      var sc = M.scores[r.seat]; if (!sc) return;
      var rp = Math.floor((table[r.rank - 1] || 0) * mult / 100);
      var kp = Math.floor((sc.killPop + r.kills) / CFG.killPopPerPoint) - Math.floor(sc.killPop / CFG.killPopPerPoint);
      sc.killPop += r.kills; sc.kill += kp; sc.rank += rp; sc.pts += rp + kp;
      sc.ranks.push(r.rank); sc.dayPts.push(rp + kp);
      summary.ranks[r.seat] = r.rank; summary.pts[r.seat] = rp + kp; summary.kills[r.seat] = r.kills;
    });
    // săn quái: người hạ nhiều quái nhất nhận Tinh thể
    if (M.monster) {
      var best = null; res.players.forEach(function (r) { if (r.mkills > 0 && (!best || r.mkills > best.mkills || (r.mkills === best.mkills && +r.seat < +best.seat))) best = r; });
      if (best) { var p = MT.player(M, best.seat); var c = TT.MONSTERS[M.monster].gold; p.gold += c; summary.monster = { seat: best.seat, gold: c }; }
    }
    summary.hash = res.hash;
    M.history.push(summary);
    M.phase = 'result';
    if (M.day >= CFG.days) MT.finish(M);
    return summary;
  };
  MT.standings = function (M) {
    return M.players.map(function (p) { var s = M.scores[p.seat]; return { seat: p.seat, name: p.name, race: p.race, out: p.out, pts: s.pts, rank: s.rank, kill: s.kill, last: s.ranks[s.ranks.length - 1] || 0 }; })
      .sort(function (a, b) { return (a.out - b.out) || (b.pts - a.pts) || (b.rank - a.rank) || (b.kill - a.kill) || (a.last - b.last) || (+a.seat - +b.seat); });
  };
  MT.finish = function (M) {
    M.over = true; M.phase = 'over';
    var st = MT.standings(M);
    if (M.team) {
      var tp = {}; st.forEach(function (s) { var p = MT.player(M, s.seat); tp[p.team] = (tp[p.team] || 0) + s.pts; });
      var bt = null; Object.keys(tp).forEach(function (k) { if (bt === null || tp[k] > tp[bt]) bt = k; });
      M.winner = M.players.filter(function (p) { return String(p.team) === String(bt); }).map(function (p) { return p.seat; });
    } else M.winner = [st[0].seat];
    return M.winner;
  };
  MT.forfeit = function (M, seat) {
    var p = MT.player(M, seat); if (!p || p.out) return;
    p.out = 1;
    var alive = M.players.filter(function (x) { return !x.out; });
    var teams = {}; alive.forEach(function (x) { teams[x.team] = 1; });
    if (Object.keys(teams).length <= 1 && alive.length) { M.over = true; M.phase = 'over'; M.winner = alive.map(function (x) { return x.seat; }); }
  };
  MT.hash = function (M) { return TT.fnv64(TT.stable({ d: M.day, p: M.players, s: M.scores })); };
  if (typeof module !== 'undefined') module.exports = MT;
})(typeof window !== 'undefined' ? window : global);
