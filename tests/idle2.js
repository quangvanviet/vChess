/* Dò đơn vị đứng im: đo thời gian tối đa mỗi đơn vị còn sống mà không di chuyển, không đánh trong khi địch vẫn còn. */
var S = require('./sim.js'), TT = S.TT, P = TT.Prep, MT = TT.Match, Bot = TT.Bot;
function run(seed, mode, races, levels, teamMode) {
  var players = races.map(function (r, i) { var lo = Bot.loadout(seed, i + 1); return { seat: i + 1, name: 'B' + i, race: r, talent: TT.TALENTS[r][(seed + i) % 3].id, start: lo.start, bot: levels[i] }; });
  var M = MT.create({ seed: seed, mode: mode, teamMode: teamMode, players: players });
  var worst = 0, worstSec = 0, endSec = [], idleFrac = [];
  for (var d = 1; d <= 6 && !M.over; d++) {
    MT.beginDay(M);
    var pk = {};
    M.players.forEach(function (p) { if (!p.out) pk[p.seat] = JSON.parse(JSON.stringify(Bot.makePackage(M, p.seat, p.bot))); });
    M.players.forEach(function (p, i) { if (p.out) return; var r = P.applyPackage(p, pk[p.seat], MT.ctx(M, p)); M.players[i] = Object.assign(r.p, { side: p.side, team: p.team }); if (process.env.STANCE) M.players[i].squads.forEach(function (q) { q.st = process.env.STANCE; if (process.env.NOFL) q.fl = []; }); });
    var B = TT.Battle.create(MT.battleInput(M)); B.run(1);
    var win = {}, stuckN = 0, winN = 0, idle = {}, last = {}, hits = {}, maxIdle = 0, idleUnits = 0, fightIdleTicks = 0, totalTicks = 0;
    while (!B.ended) {
      B.run(20);
      var teamsAlive = {}; B.units.forEach(function (u) { if (u.alive && !u.monster) teamsAlive[u.team] = 1; });
      var multi = Object.keys(teamsAlive).length > 1;
      if (B.tick % 200 === 1 && multi) B.units.forEach(function (u) { if (!u.alive || u.monster) return; var w = win[u.id]; var q = u.sq >= 0 ? B.squads[u.sq] : null; if (w && w.alive && u.alive && q && q.st !== 'rut' && q.st !== 'giu' && !(q.fl && q.fl.length) && u.stun <= 0 && u.rootT <= 0) { winN++; if (Math.hypot(u.x - w.x, u.y - w.y) < 1500 && u.hits === w.h) { stuckN++; if (process.env.DBG4) var tg = B.byId[u.tgt]; console.log('STUCK', u.role, 'team', u.team, 'tgt', u.tgt, 'idleT', u.idleT, 'tick', B.tick, 'dist', tg ? Math.round(Math.hypot(tg.x - u.x, tg.y - u.y)) : -1, 'rng', u.rng, 'rad', u.rad + (tg ? tg.rad : 0), 'standT', u.standT, 'cd', u.cd, 'moved', u.moved, 'sq st', q.st, 'seek', q.seek, 'tgtAlive', tg && tg.alive, 'tstealth', tg && tg.stealthT, 'castT', u.castT); } } win[u.id] = { x: u.x, y: u.y, h: u.hits, alive: 1 }; });
      B.units.forEach(function (u) {
        if (!u.alive || u.monster) return;
        var k = u.id, moved = last[k] && (last[k].x !== u.x || last[k].y !== u.y), hh = last[k] && last[k].h !== u.hits;
        if (!multi || moved || hh || u.stun > 0 || u.castT > 0 || u.rootT > 0) idle[k] = 0; else idle[k] = (idle[k] || 0) + 20;
        last[k] = { x: u.x, y: u.y, h: u.hits };
        if (idle[k] > maxIdle) maxIdle = idle[k];
        if (process.env.DBG3 && idle[k] === 600) { var q = u.sq >= 0 ? B.squads[u.sq] : null, e = B.byId[u.tgt]; console.log('IDLE30', 'day', d, u.role, u.marshal ? 'MARSHAL' : '', 'team', u.team, 'tgt', e ? e.role + '/' + e.team + ' d=' + Math.round(Math.sqrt(Math.pow(e.x - u.x, 2) + Math.pow(e.y - u.y, 2)) / 100) / 10 : '-', 'st', q && q.st, 'step', q && (q.step + '/' + q.fl.length + ':' + (q.fl[q.step] ? q.fl[q.step].c : '')), 'seek', q && q.seek, 'idleT', u.idleT, 'pos', (u.x / 1000).toFixed(1), (u.y / 1000).toFixed(1), 'tick', B.tick, 'fightAgo', (B.tick - B.fightT) / 20); }
      });
      if (process.env.DBG && B.tick === 3001) { B.units.forEach(function (u) { if (u.alive && !u.monster && (idle[u.id] || 0) >= 200) { var q = u.sq >= 0 ? B.squads[u.sq] : null; console.log('IDLE', u.role, u.race, 'team', u.team, 'tgt', u.tgt, 'st', q && q.st, 'step', q && q.step + '/' + q.fl.length, 'seek', q && q.seek, 'idleT', u.idleT, 'stealth', u.stealthT, 'rooted', u.rootT, 'fly', u.fly, 'pos', u.x >> 10, u.y >> 10, 'fight', B.fightT); } }); }
      if (process.env.DBG2 && (B.tick - 1) % 600 === 0 && B.tick >= 2400 && d === 1) { var c = {}; B.units.forEach(function (u) { if (u.alive && !u.monster) { var k = u.team + ':' + u.role; c[k] = (c[k] || 0) + 1; } }); console.log('t', B.tick / 20, JSON.stringify(c), 'fight', B.fightT / 20); B.units.filter(function (u) { return u.alive && !u.monster; }).slice(0, 4).forEach(function (u) { var e = B.byId[u.tgt]; console.log('  ', u.role, u.team, 'tgt', e && (e.role + ' ' + e.team + ' d=' + Math.round(Math.sqrt(Math.pow(e.x - u.x, 2) + Math.pow(e.y - u.y, 2)) / 1000)), 'pos', u.x >> 10, u.y >> 10, 'idleT', u.idleT, 'rng', u.rng); }); }
      var cnt = 0, tot = 0; B.units.forEach(function (u) { if (u.alive && !u.monster) { tot++; if ((idle[u.id] || 0) >= 20 * 10) cnt++; } });
      if (multi) { totalTicks += 20; fightIdleTicks += 20 * cnt / Math.max(1, tot); }
    }
    if (!global.__st) global.__st = [0, 0]; global.__st[0] += stuckN; global.__st[1] += winN; idleFrac.push(Math.round(100 * fightIdleTicks / Math.max(1, totalTicks)));
    endSec.push(Math.ceil(B.tick / 20));
    worst = Math.max(worst, maxIdle / 20);
    var res = B.result(); MT.endDay(M, res);
  }
  return { worst: worst, endSec: endSec, idlePct: idleFrac };
}
var modes = (process.argv[2] || '3,4').split(',');
var n = +process.argv[3] || 4;
modes.forEach(function (m) {
  var np = +m.replace(/\D/g, '') || 3, races = ['dragon', 'human', 'fairy', 'demon', 'beast'].slice(0, np);
  for (var s = 1; s <= n; s++) {
    var r = run(s * 7, np, races, races.map(function () { return 'medium'; }), false);
    console.log(m, 'seed', s * 7, 'worstIdle', r.worst + 's', 'end', r.endSec.join(','), 'idle%', r.idlePct.join(','));
  }
});

console.log('STUCK windows', global.__st[0], '/', global.__st[1]);
