/* Bộ chạy ván headless dùng chung cho kiểm thử & cân bằng. */
global.window = undefined;
var R = __dirname + '/../js/core/';
['data', 'maps', 'prep', 'battle', 'match', 'bot'].forEach(function (f) { require(R + f + '.js'); });
var TT = global.TT, P = TT.Prep, MT = TT.Match, Bot = TT.Bot;
exports.TT = TT;
/* o: {seed, mode, races:[], levels:[], teamMode} → {M, hashes, days} */
exports.playMatch = function (o) {
  var players = o.races.map(function (r, i) { var lo = Bot.loadout(o.seed, i + 1); return { seat: i + 1, name: 'Bot' + (i + 1), race: r || lo.race, talent: (o.talents && o.talents[i]) || TT.TALENTS[r || lo.race][(o.seed + i) % 3].id, start: lo.start, bot: o.levels[i] }; });
  var M = MT.create({ seed: o.seed, mode: o.mode, teamMode: o.teamMode, players: players });
  var hashes = [], t0 = Date.now(), maxSec = 0;
  for (var d = 1; d <= TT.CONFIG.days; d++) {
    MT.beginDay(M);
    var pk = {};
    M.players.forEach(function (p) { if (!p.out) pk[p.seat] = JSON.parse(JSON.stringify(Bot.makePackage(M, p.seat, p.bot))); });
    M.players.forEach(function (p, i) {
      if (p.out) return;
      var r = P.applyPackage(p, pk[p.seat], MT.ctx(M, p));
      if (!r.ok) throw new Error('gói lỗi ngày ' + d + ' ghế ' + p.seat + ': ' + r.errs.join(','));
      M.players[i] = Object.assign(r.p, { side: p.side, team: p.team });
    });
    var B = TT.Battle.create(MT.battleInput(M)), res = B.run();
    maxSec = Math.max(maxSec, res.sec);
    MT.endDay(M, res);
    hashes.push(res.hash);
  }
  return { M: M, hashes: hashes, ms: Date.now() - t0, maxSec: maxSec, standings: MT.standings(M) };
};
