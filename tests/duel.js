/* Đấu tay đôi cùng ngân sách/sức chứa giữa các tộc, thành phần quân cố định. node tests/duel.js */
var S = require('./sim.js'), TT = S.TT, P = TT.Prep, MT = TT.Match;
exports.duel = function (ra, rb, comp, lv, budget, seed, items) {
  var M = MT.create({ seed: seed, mode: 2, players: [{ seat: 1, name: 'a', race: ra, start: 'gold' }, { seat: 2, name: 'b', race: rb, start: 'gold' }] });
  M.day = 1; M.map = TT.buildMap(2, 'binhnguyen', seed);
  M.players.forEach(function (p) {
    p.lv = lv; p.res = { V: budget, T: budget, G: budget }; p.inv = [];
    var ctx = MT.ctx(M, p), z = ctx.zone, i = 0, guard = 0;
    while (guard++ < 400) { var role = comp[i % comp.length]; i++; var r = P.apply(p, { c: 'buy', t: role, k: 1, x: z.x0 + 2 + (TT.ROLE_ORDER.indexOf(role) * 2), y: z.y0 + 3 }, ctx); if (!r.ok && /Sức chứa/.test(r.err)) break; if (!r.ok && guard > 200) break; }
    P.apply(p, { c: 'auto' }, ctx);
  });
  var B = TT.Battle.create(MT.battleInput(M)), res = B.run();
  return res.players[0].rank === 1 ? 1 : 0;
};
if (require.main === module) {
  var races = TT.FACTION_ORDER, comps = { 'lính+cung+thuẫn': ['linh', 'cung', 'thuan'], 'chỉ lính': ['linh'], 'chỉ cung': ['cung'] }, lv = +process.argv[2] || 1, budget = +process.argv[3] || 15;
  Object.keys(comps).forEach(function (cn) {
    var w = {}; races.forEach(function (r) { w[r] = 0; });
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) if (i !== j) for (var s = 0; s < 3; s++) { var x = exports.duel(races[i], races[j], comps[cn], lv, budget, 50 + s); w[x ? races[i] : races[j]]++; }
    console.log(cn, 'Đời', lv, 'ngân sách', budget, races.map(function (r) { return r + ' ' + Math.round(w[r] * 100 / 36) + '%'; }).join(' · '));
  });
}
