/* Kiểm thử bắt buộc 2.0 (GDD 17.2). Chạy: node tests/run-tests.js */
var S = require('./sim.js'), TT = S.TT, P = TT.Prep, MT = TT.Match, CFG = TT.CONFIG;
var pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } }
function mk(races, mode) { var M = MT.create({ seed: 4242, mode: mode || 2, players: races.map(function (r, i) { return { seat: i + 1, name: 'P' + (i + 1), race: r, start: 'gold' }; }) }); MT.beginDay(M); return M; }
function C(M, p) { return MT.ctx(M, p); }

// mua 1 đạo quân: tướng + (n-1) lính
function army(p, ctx, role, n, x, y) { var r = P.apply(p, { c: 'buyGen', t: role, x: x, y: y }, ctx); if (!r.ok) return r; if (n > 1) P.apply(p, { c: 'buySol', sq: r.sq, k: n - 1 }, ctx); return r; }
console.log('— Kinh tế (Vàng)');
(function () {
  var M = mk(['dragon', 'human']), a = M.players[0], b = M.players[1];
  ok(a.gold === CFG.goldIncome[1] && b.gold === CFG.goldIncome[1], 'vốn Vàng ngày 1 bằng nhau (' + a.gold + ')');
  ok(a.lv === 1 && a.inv[0] === 'kiem', 'Đời I, trang bị khởi đầu trong tủ đồ');
  var z = C(M, a).zone, v0 = a.gold + P.armyValue(a);
  var r = army(a, C(M, a), 'linh', 3, z.x0, z.y0);
  ok(r.ok && a.squads[0].n === 3 && a.gold === v0 - TT.genCost('dragon', 'linh') - 2 * TT.unitCost('dragon', 'linh'), 'mua tướng + 2 lính đúng giá');
  P.apply(a, { c: 'sell', sq: a.squads[0].id, k: 1 }, C(M, a));
  ok(a.squads[0].n === 2 && a.gold + P.armyValue(a) === v0, 'bán 1 lính hoàn đúng giá');
  P.apply(a, { c: 'sell', sq: a.squads[0].id }, C(M, a));
  ok(a.gold === v0 && a.squads.length === 0, 'bán cả đạo quân (tướng) hoàn đúng giá');
  ok(TT.genCost('dragon', 'linh') === TT.genCost('human', 'linh') + 1, 'tướng Rồng đắt hơn 1 Vàng');
  // dư giữ sang ngày sau + lãi
  a.gold = 7; MT.beginDay(M);
  ok(a.gold === 7 + CFG.goldIncome[2] && a.xp === CFG.xpDaily, 'Vàng dư cộng dồn (dưới 10 không lãi), EXP +2');
  a.gold = 37; MT.beginDay(M);
  ok(a.gold === 37 + CFG.goldIncome[3] + 3, 'lãi Vàng: 37 → +3');
  a.gold = 90; MT.beginDay(M);
  ok(a.gold === 90 + CFG.goldIncome[4] + CFG.interestMax, 'lãi Vàng tối đa 5');
  var inc = CFG.goldIncome.slice(1); ok(inc.slice(1).every(function (v, i) { return i === 0 || v >= inc[i]; }), 'thu nhập mỗi ngày tăng dần');
})();

console.log('— Đời (EXP) không bao giờ mất');
(function () {
  var M = mk(['fairy', 'demon']), p = M.players[0];
  p.gold = 40;
  var r = P.apply(p, { c: 'xp' }, C(M, p));
  ok(r.ok && p.lv === 1 && p.xp === 4 && p.gold === 36, 'mua 4 EXP giá 4 Vàng');
  P.apply(p, { c: 'xp' }, C(M, p));
  ok(p.lv === 2 && p.xp === 2, 'đủ 6 EXP lên Đời II (dư 2)');
  ok(P.capacity(p) === CFG.capacity[2] && P.unitUnlocked(p, 'y') && !P.unitUnlocked(p, 'phapsu'), 'Sức chứa tăng, mở Thuật sĩ');
  MT.beginDay(M); MT.beginDay(M);
  ok(p.lv === 2, 'sang ngày mới vẫn giữ Đời II');
})();

console.log('— Tướng & lính');
(function () {
  var M = mk(['human', 'dragon']), p = M.players[0], ctx = C(M, p), z = ctx.zone;
  p.gold = 999;
  var g = army(p, ctx, 'linh', 1, z.x0 + 5, z.y0 + 2);
  ok(g.ok && p.squads[0].n === 1, 'mua tướng tạo đạo quân mới');
  ok(!P.apply(p, { c: 'buyGen', t: 'linh', x: z.x0 + 5, y: z.y0 + 2 }, ctx).ok, 'không đặt 2 tướng chung một chỗ');
  var g2 = army(p, ctx, 'linh', 1, z.x0 + 7, z.y0 + 2);
  P.apply(p, { c: 'move', sq: g2.sq, x: z.x0 + 5, y: z.y0 + 2 }, ctx);
  ok(p.squads.length === 2 && p.squads[1].x === z.x0 + 5, 'kéo tướng đè lên tướng khác = đổi chỗ, không gộp');
  P.apply(p, { c: 'buySol', sq: g.sq, k: 99 }, ctx);
  ok(P.usedPop(p) === P.capacity(p), 'lính không vượt Sức chứa (' + P.capacity(p) + ')');
  ok(!P.apply(p, { c: 'buyGen', t: 'cung', x: z.x0 - 1, y: z.y0 }, ctx).ok, 'không đặt ngoài vùng xuất quân');
  ok(!P.apply(p, { c: 'buyGen', t: 'tuong', x: z.x0, y: z.y0 }, ctx).ok, 'chưa mở khóa Tượng binh ở Đời I');
  p.lv = 4;
  var t = P.apply(p, { c: 'buyGen', t: 'thanthu', x: z.x0 + 1, y: z.y0 }, ctx);
  ok(t.ok && !P.apply(p, { c: 'buySol', sq: t.sq, k: 1 }, ctx).ok, 'Thần thú chỉ có tướng, không có lính');
  ok(!P.apply(p, { c: 'buyGen', t: 'thanthu', x: z.x0 + 3, y: z.y0 }, ctx).ok, 'chỉ 1 Thần thú');
  P.apply(p, { c: 'buySol', sq: g.sq, k: 40 }, ctx);
  ok(p.squads[0].n > 30, 'một đạo quân có thể rất đông (' + p.squads[0].n + ' quân)');
})();

console.log('— Trang bị (chỉ tướng, 3 món) & tủ đồ 9 ô');
(function () {
  var M = mk(['human', 'dragon']), p = M.players[0], ctx = C(M, p), z = ctx.zone;
  p.gold = 200;
  var sq = army(p, ctx, 'linh', 2, z.x0, z.y0).sq;
  ok(P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx).ok && p.squads[0].it[0] === 'kiem', 'đeo trang bị khởi đầu cho tướng');
  p.ishop = ['giap', 'bua', 'nhan', 'kiem', 'kiem', 'kiem'];
  ok(!P.apply(p, { c: 'buyItem', slot: 9 }, ctx).ok, 'ô cửa hàng không tồn tại không mua được');
  var g0 = p.gold; P.apply(p, { c: 'buyItem', slot: 0 }, ctx);
  ok(p.gold === g0 - CFG.itemPrice[1], 'mua Giáp Da ' + CFG.itemPrice[1] + ' Vàng');
  P.apply(p, { c: 'sellItem', idx: 0 }, ctx);
  ok(p.gold === g0, 'bán trang bị bằng giá mua');
  p.ishop = ['giap', 'bua', 'nhan', 'kiem', 'kiem', 'kiem'];
  [0, 1, 2].forEach(function (k) { P.apply(p, { c: 'buyItem', slot: k }, ctx); });
  P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx); P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx);
  ok(p.squads[0].it.length === 3 && !P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx).ok, 'tướng đeo tối đa 3 món');
  for (var i = 0; i < 12; i++) { p.ishop = ['kiem', 'kiem', 'kiem', 'kiem', 'kiem', 'kiem']; P.apply(p, { c: 'buyItem', slot: 0 }, ctx); }
  ok(P.invUsed(p) === CFG.invSize, 'tủ đồ tối đa ' + CFG.invSize + ' ô');
  // tủ đầy: mua khi đang chọn tướng còn ô đồ → vào thẳng tướng; tướng đầy ô → báo lỗi
  var sq3 = army(p, ctx, 'cung', 1, z.x0 + 6, z.y0 + 4).sq; p.squads.forEach(function (q) { if (q.id === sq3) q.it = []; });
  p.ishop = ['kiem', 'kiem', 'kiem', 'kiem', 'kiem', 'kiem']; p.gold = 99;
  var rb = P.apply(p, { c: 'buyItem', slot: 0, sq: sq3 }, ctx);
  ok(P.invFree(p) <= 0 && rb.ok && rb.eq === sq3 && P.squadById(p, sq3).it.length === 1, 'tủ đồ đầy vẫn mua thẳng vào ô đồ của tướng còn trống');
  P.apply(p, { c: 'buyItem', slot: 1, sq: sq3 }, ctx); P.apply(p, { c: 'buyItem', slot: 2, sq: sq3 }, ctx);
  ok(!P.apply(p, { c: 'buyItem', slot: 3, sq: sq3 }, ctx).ok, 'tướng đủ 3 món và tủ đầy thì không mua được');
  p.squads = p.squads.filter(function (q) { return q.id !== sq3; });
  ok(CFG.itemPrice[4] > CFG.itemPrice[3] && CFG.itemPrice[3] > CFG.itemPrice[2] && CFG.itemPrice[2] > CFG.itemPrice[1], 'bậc cao đắt hơn');
  var g1 = p.gold, eq = p.squads[0].it.reduce(function (s, k) { return s + TT.ITEMS[k].price; }, 0), val = P.squadCost(p, p.squads[0]);
  P.apply(p, { c: 'sell', sq: sq }, ctx);
  ok(p.squads.length === 0 && p.gold === g1 + val + eq, 'bán tướng: hoàn 100% tướng, lính và trang bị đang đeo');
})();

console.log('— Nâng cấp lính (Vàng)');
(function () {
  var M = mk(['human', 'dragon']), p = M.players[0], ctx = C(M, p), z = ctx.zone, U = CFG.solUp;
  p.gold = 200;
  var sq = army(p, ctx, 'linh', 6, z.x0, z.y0).sq, q = P.squadById(p, sq), g0 = p.gold, v0 = p.gold + P.armyValue(p);
  var s0 = TT.Battle.previewStats(ctx, p, q, false), c0 = TT.Battle.previewStats(ctx, p, q, true);
  ok(P.apply(p, { c: 'solUp', sq: sq, k: 0, d: 1 }, ctx).ok && q.up[0] === 1 && p.gold === g0 - U.cost[0], 'nâng Máu lính cấp 1 tốn ' + U.cost[0] + ' Vàng');
  for (var ui = 1; ui < U.max; ui++) P.apply(p, { c: 'solUp', sq: sq, k: 0, d: 1 }, ctx);
  ok(q.up[0] === U.max && !P.apply(p, { c: 'solUp', sq: sq, k: 0, d: 1 }, ctx).ok, 'tối đa ' + U.max + ' cấp mỗi chỉ số');
  var s1 = TT.Battle.previewStats(ctx, p, q, false), c1 = TT.Battle.previewStats(ctx, p, q, true);
  ok(s1.hp > s0.hp && c1.hp === c0.hp, 'nâng cấp chỉ tăng chỉ số lính, không áp cho tướng');
  ok(p.gold + P.armyValue(p) === v0, 'tiền nâng cấp tính vào giá trị đạo quân');
  ok(P.apply(p, { c: 'solUp', sq: sq, k: 0, d: -1 }, ctx).ok && q.up[0] === U.max - 1 && p.gold + P.armyValue(p) === v0, 'hạ cấp hoàn đúng giá');
  P.apply(p, { c: 'solUp', sq: sq, k: 1, d: 1 }, ctx);
  var pkg = P.makePackage(p, []), base = TT.Prep.clone(p); base.squads = []; base.gold = v0;
  var ap = P.applyPackage(base, pkg, ctx);
  ok(ap.ok && ap.p.squads[0].up.join() === q.up.join() && ap.p.gold === p.gold, 'gói đội hình mang theo cấp nâng lính, đúng ngân sách');
  var bad = JSON.parse(JSON.stringify(pkg)); bad.a[0][10] = '99,1,1,1';
  ok(!P.applyPackage(base, bad, ctx).ok, 'gói khai cấp nâng lính sai bị từ chối');
  var poor = JSON.parse(JSON.stringify(pkg)); base.gold = v0 - p.gold - 1;
  ok(!P.applyPackage(base, poor, ctx).ok, 'nâng cấp vượt ngân sách bị từ chối');
  var g1 = p.gold, val = P.squadCost(p, q); P.apply(p, { c: 'sell', sq: sq }, ctx);
  ok(p.gold === g1 + val && val > TT.genCost(p.race, 'linh') + 5 * TT.unitCost(p.race, 'linh'), 'bán tướng hoàn cả tiền nâng cấp lính');
  p.lv = 4; var tq = P.apply(p, { c: 'buyGen', t: 'thanthu', x: z.x0 + 2, y: z.y0 }, ctx);
  ok(tq.ok && !P.apply(p, { c: 'solUp', sq: tq.sq, k: 0, d: 1 }, ctx).ok, 'Thần thú không có lính nên không nâng cấp lính');
})();

console.log('— Mua dân, shop trang bị theo ngày, MP khi bị đánh, cờ vô hạn');
(function () {
  var M = mk(['human', 'dragon']), p = M.players[0], ctx = C(M, p);
  p.gold = 100; var cap0 = P.capacity(p), pr0 = P.popPrice(p), g = p.gold;
  ok(P.apply(p, { c: 'pop' }, ctx).ok && P.capacity(p) === cap0 + CFG.popBuy.amount && p.gold === g - pr0, 'mua dân: +' + CFG.popBuy.amount + ' Sức chứa, tốn ' + pr0 + ' Vàng');
  var prices = []; for (var i = 1; i < CFG.popBuy.max; i++) { prices.push(P.popPrice(p)); P.apply(p, { c: 'pop' }, ctx); }
  ok(prices[prices.length - 1] > prices[0] && !P.apply(p, { c: 'pop' }, ctx).ok, 'giá mua dân tăng dần, có giới hạn ' + CFG.popBuy.max + ' lần');
  // cửa hàng trang bị: cùng seed → cùng kết quả; khác ngày → khác tỉ lệ bậc
  var q1 = TT.Prep.newPlayer({ seat: 0, name: 'a', race: 'human' }), q2 = TT.Prep.clone(q1);
  q1.lv = q2.lv = 4; TT.Prep.dayStart(q1, { seed: 7, day: 3 }); TT.Prep.dayStart(q2, { seed: 7, day: 3 });
  ok(JSON.stringify(q1.ishop) === JSON.stringify(q2.ishop) && q1.ishop.every(Boolean), 'cửa hàng trang bị xác định theo seed + ngày');
  function avgTier(day) { var s = 0, n = 0; for (var sd = 1; sd < 60; sd++) { var x = TT.Prep.newPlayer({ seat: 0, name: 'a', race: 'human' }); x.lv = 4; TT.Prep.dayStart(x, { seed: sd, day: day }); x.ishop.forEach(function (k) { s += TT.ITEMS[k].tier; n++; }); } return s / n; }
  ok(avgTier(9) > avgTier(2) + .8, 'ngày sau ra trang bị bậc cao hơn ngày đầu');
  var q3 = TT.Prep.newPlayer({ seat: 0, name: 'a', race: 'human' }); TT.Prep.dayStart(q3, { seed: 3, day: 5 });
  ok(q3.ishop.every(function (k) { return TT.ITEMS[k].tier <= 1; }), 'Đời I chỉ thấy trang bị bậc Đồng');
  var old = q1.ishop.join(); q1.gold = 20; ok(TT.Prep.apply(q1, { c: 'ireroll' }, { seed: 7, day: 3, zone: ctx.zone }).ok && q1.ishop.join() !== old, 'đổi cửa hàng trang bị');
  // cờ không bị Đời hạn chế
  var f = []; for (var j = 0; j < 12; j++) f.push({ c: 'X', x: 10 + j, y: 10 });
  var sq = army(p, ctx, 'linh', 1, ctx.zone.x0, ctx.zone.y0).sq;
  ok(P.apply(p, { c: 'flags', sq: sq, fl: f }, ctx).ok, 'cắm 12 cờ ở Đời ' + p.lv + ' vẫn được');
})();

console.log('— Lõi');
(function () {
  var M = mk(['fairy', 'demon']), p = M.players[0], ctx = C(M, p);
  ok(p.board.filter(Boolean).length === 5, 'bảng Lõi 5 ô');
  p.gold = 30;
  var id = p.board[0], cost = CFG.corePrice[TT.CORES[id].tier];
  P.apply(p, { c: 'core', slot: 0 }, ctx);
  ok(p.cores[0] === id && p.gold === 30 - cost + (TT.CORES[id].fx.goldNow || 0), 'mua Lõi đúng giá, vào tủ đồ');
  var c1 = p.gold; P.apply(p, { c: 'reroll' }, ctx);
  ok(p.gold === c1, 'đổi bảng lần đầu miễn phí');
  P.apply(p, { c: 'lock', slot: 1 }, ctx); var keep = p.board[1];
  P.apply(p, { c: 'reroll' }, ctx);
  ok(p.board[1] === keep && p.gold === c1 - 1, 'khóa giữ ô qua lần đổi, lần sau tốn 1');
  var c2 = p.gold; P.apply(p, { c: 'sellCore', idx: 0 }, ctx);
  ok(p.gold === c2 + cost - (TT.CORES[id].fx.goldNow || 0), 'bán Lõi bằng giá mua');
  var bad = TT.CORE_ORDER.filter(function (k) { return /^race:/.test(TT.CORES[k].scope) && TT.CORES[k].scope !== 'race:fairy'; });
  var seen = false; for (var i = 0; i < 30; i++) { p.gold = 50; P.apply(p, { c: 'reroll' }, ctx); p.board.forEach(function (b) { if (bad.indexOf(b) >= 0) seen = true; }); }
  ok(!seen, 'không ra Lõi riêng của tộc khác');
})();

console.log('— Gói đội hình & chống gian lận');
(function () {
  var M = mk(['dragon', 'fairy']), p0 = M.players[0]; p0.gold = 40; p0.ishop = ['bua', 'giap', 'nhan', 'kiem', 'kiem', 'kiem']; var ctx = C(M, p0), p = P.clone(p0), z = ctx.zone, log = [];
  army(p, ctx, 'linh', 3, z.x0 + 3, z.y0 + 2);
  [{ c: 'xp' }, { c: 'buyItem', slot: 0 }].forEach(function (c) { var r = P.apply(p, c, ctx); if (r.log) log = log.concat(r.log); });
  P.apply(p, { c: 'equip', idx: 1, sq: p.squads[0].id }, ctx);
  var pkg = P.makePackage(p, log);
  var r = P.applyPackage(p0, pkg, ctx);
  ok(r.ok && r.p.squads[0].n === 3 && r.p.gold === p.gold && r.p.xp === p.xp && r.p.squads[0].it[0] === 'bua', 'áp gói hợp lệ ra đúng trạng thái (Vàng, EXP, trang bị)');
  var cheat = JSON.parse(JSON.stringify(pkg)); cheat.a[0][2] = 30;
  ok(!P.applyPackage(p0, cheat, ctx).ok, 'gói vượt ngân sách bị từ chối');
  var cheat2 = JSON.parse(JSON.stringify(pkg)); cheat2.a[0][1] = 'thanthu'; cheat2.a[0][2] = 1;
  ok(!P.applyPackage(p0, cheat2, ctx).ok, 'gói dùng quân chưa mở khóa bị từ chối');
  var cheat3 = JSON.parse(JSON.stringify(pkg)); cheat3.a[0][3] = 0; cheat3.a[0][4] = 30;
  ok(!P.applyPackage(p0, cheat3, ctx).ok, 'gói đặt quân ngoài vùng bị từ chối');
  var cheat4 = JSON.parse(JSON.stringify(pkg)); cheat4.a[0][6] = 'bua|thankiem';
  ok(!P.applyPackage(p0, cheat4, ctx).ok, 'gói tự thêm trang bị bị từ chối');
  ok(JSON.stringify(pkg).length < 12000, 'gói nhỏ gọn');
  // bán quân lấy Vàng rồi mua đồ: phát lại vẫn hợp lệ
  var p2 = P.clone(r.p); MT.beginDay(M); var p3 = MT.player(M, '1'); M.players[0] = Object.assign(r.p, { side: p0.side, team: p0.team }); MT.player(M, '1');
})();

console.log('— Giao tranh');
function battleOf(build, opts) {
  var M = mk(opts && opts.races || ['human', 'human']); M.map = TT.buildMap(2, 'binhnguyen', 1);
  M.players.forEach(function (p, i) { p.lv = 4; p.gold = 999; build(p, MT.ctx(M, p), i); });
  return { M: M, B: TT.Battle.create(MT.battleInput(M)) };
}
(function () {
  var mkb = function () { return battleOf(function (p, ctx) { var z = ctx.zone; army(p, ctx, 'linh', 6, z.x0 + 10, z.y0 + 3); army(p, ctx, 'cung', 4, z.x0 + 12, z.y0 + 8); P.apply(p, { c: 'auto' }, ctx); }); };
  var a = mkb().B.run(), b = mkb().B.run();
  ok(a.hash === b.hash && a.ticks === b.ticks, 'cùng đội hình + seed → cùng kết quả');
  ok(a.players.some(function (x) { return x.rank === 1; }) && a.players.some(function (x) { return x.rank === 2; }), 'xếp hạng 1 và 2');
  // bão sau 5 phút: hai đội "giữ vị trí" không gặp nhau vẫn kết thúc
  var t = battleOf(function (p, ctx) { var z = ctx.zone; army(p, ctx, 'thuan', 3, z.x0 + 2, z.y0 + 5); P.apply(p, { c: 'stance', sq: p.squads[0].id, s: 'giu' }, ctx); });
  var r = t.B.run();
  ok(t.B.ended && r.sec > CFG.battleMaxSec && r.sec < CFG.battleMaxSec + 30, 'sau 5 phút sát thương tăng dần kết thúc trận (' + r.sec + 's)');
  // cờ Xanh: không tấn công khi đang hành quân
  var fx = battleOf(function (p, ctx, i) {
    var z = ctx.zone; army(p, ctx, 'cung', 4, z.x0 + 10, i ? z.y1 : z.y0);
    if (i === 0) { var q = p.squads[0]; var flag = TT.rotPoint(2, 0, 19, 40); q.fl = [{ c: 'X', x: z.x0 + 10, y: z.y1 }]; }
    else P.apply(p, { c: 'stance', sq: p.squads[0].id, s: 'giu' }, ctx);
  });
  var B = fx.B, attacked = false; for (var k = 0; k < 200; k++) { B.step(); B.events.forEach(function (e) { if (e.e === 'atk') { var u = B.byId[e.a]; if (u && u.pl === 0 && B.squads[u.sq].step === 0) attacked = true; } }); B.events = []; }
  ok(!attacked, 'Cờ Xanh: đội không bắn khi đang đi tới cờ');
  // cờ Tím: đội tấn công đúng đạo quân địch bị cắm cờ (bỏ qua đạo quân gần hơn)
  var ft = battleOf(function (p, ctx, i) {
    var z = ctx.zone;
    if (i === 0) { army(p, ctx, 'ky', 3, z.x0 + 10, z.y0 + 2); }
    else { army(p, ctx, 'linh', 4, z.x0 + 3, z.y0 + 6); army(p, ctx, 'cung', 3, z.x0 + 16, z.y0 + 9); P.apply(p, { c: 'stance', sq: p.squads[0].id, s: 'giu' }, ctx); P.apply(p, { c: 'stance', sq: p.squads[1].id, s: 'giu' }, ctx); }
  });
  var tgtSeat = ft.M.players[1].seat, tgtSq = ft.M.players[1].squads[1].id;
  ft.M.players[0].squads[0].fl = [{ c: 'T', seat: tgtSeat, sq: tgtSq }];
  ok(P.validateArmy(ft.M.players[0], MT.ctx(ft.M, ft.M.players[0])) === null && !P.applyPackage(ft.M.players[0], { c: [], a: [[1, 'ky', 3, 0, 0, 'tc', '', 'T' + ft.M.players[0].seat + ':1']], i: '', n: 5 }, MT.ctx(ft.M, ft.M.players[0])).ok, 'Cờ Tím hợp lệ; cắm vào đội của chính mình bị từ chối');
  var Bt = TT.Battle.create(MT.battleInput(ft.M)), hitSq = {};
  for (var kt = 0; kt < 900; kt++) { Bt.step(); Bt.events.forEach(function (e) { if (e.e === 'atk') { var u = Bt.byId[e.a], v = Bt.byId[e.b]; if (u && v && u.pl === 0 && Bt.squads[0].step === 0) hitSq[v.sq] = (hitSq[v.sq] || 0) + 1; } }); Bt.events = []; }
  var tgtIdx = Bt.squads.filter(function (q) { return String(q.seat) === String(tgtSeat) && q.id === tgtSq; })[0].idx, other = Bt.squads.filter(function (q) { return String(q.seat) === String(tgtSeat) && q.id !== tgtSq; })[0].idx;
  ok((hitSq[tgtIdx] || 0) > 0 && (hitSq[tgtIdx] || 0) > (hitSq[other] || 0), 'Cờ Tím: dồn đánh đạo quân bị cắm cờ (' + (hitSq[tgtIdx] || 0) + ' đòn so với ' + (hitSq[other] || 0) + ')');
  ok(Bt.squads[0].step >= 1, 'Cờ Tím: diệt xong mục tiêu thì chuyển sang cờ kế tiếp');
  // cờ Vàng: Thuật sĩ đi theo đội Lính
  var fv = battleOf(function (p, ctx, i) {
    var z = ctx.zone; army(p, ctx, 'linh', 6, z.x0 + 4, z.y0 + 2); army(p, ctx, 'y', 2, z.x0 + 20, z.y0 + 9);
    var y = p.squads[1]; y.fl = [{ c: 'V', sq: p.squads[0].id, k: 'sat' }];
  });
  for (var k2 = 0; k2 < 240; k2++) fv.B.step();
  var s0 = fv.B.squads[0], s1 = fv.B.squads[1], dd = Math.sqrt(Math.pow(s0.cx - s1.cx, 2) + Math.pow(s0.cy - s1.cy, 2)) / 1000;
  ok(dd < 7, 'Cờ Vàng: đội hộ tống bám sát đội đích (' + dd.toFixed(1) + ' ô)');
  // chỉ tướng dùng kỹ năng; tướng to và mạnh hơn lính
  var casters = {}; fv.B.units.forEach(function (u) { if (u.sk) casters[u.cap ? 'g' : 's'] = 1; });
  ok(casters.g && !casters.s, 'chỉ tướng có kỹ năng');
  var gU = fv.B.squads[0].units[0], sU = fv.B.squads[0].units[1];
  ok(gU.cap && gU.mhp > sU.mhp * 2 && gU.rad > sU.rad, 'tướng máu cao gấp đôi và to hơn lính');
  // thuật sĩ hồi máu
  var heals = 0; for (var k3 = 0; k3 < 600 && !fv.B.ended; k3++) { fv.B.step(); fv.B.events.forEach(function (e) { if (e.e === 'heal' && e.v > 0) heals++; }); fv.B.events = []; }
  ok(heals > 0, 'Thuật sĩ hồi máu đồng minh (' + heals + ' lần)');
  // không vòng tròn hộ tống
  var M = mk(['human', 'fairy']), p = M.players[0], ctx = C(M, p), z = ctx.zone;
  p.gold = 99; army(p, ctx, 'linh', 2, z.x0, z.y0); army(p, ctx, 'cung', 2, z.x0 + 2, z.y0);
  P.apply(p, { c: 'flags', sq: p.squads[0].id, fl: [{ c: 'V', sq: p.squads[1].id }] }, ctx);
  ok(!P.apply(p, { c: 'flags', sq: p.squads[1].id, fl: [{ c: 'V', sq: p.squads[0].id }] }, ctx).ok, 'chặn hộ tống vòng tròn');
  var many = []; for (var q = 0; q <= CFG.flagMax; q++) many.push({ c: 'X', x: 1 + q % 20, y: 1 });
  ok(!P.apply(p, { c: 'flags', sq: p.squads[1].id, fl: many }, ctx).ok, 'giới hạn an toàn ' + CFG.flagMax + ' cờ mỗi đội');
})();

console.log('— Đội hình (hình dạng + vị trí tướng) & chiến thuật AI');
(function () {
  TT.FORM_ORDER.forEach(function (fm) {
    var b = battleOf(function (p, ctx, i) { var z = ctx.zone; if (i === 0) { army(p, ctx, 'linh', 18, z.x0 + 10, z.y0 + 6); p.squads[0].fm = fm; p.squads[0].lp = fm === 'vong' ? 4 : 1; } else army(p, ctx, 'linh', 2, z.x0 + 10, z.y0 + 6); });
    var us = b.B.squads[0].units, pos = {}, dup = 0; us.forEach(function (u) { var k = u.spawnX + ',' + u.spawnY; if (pos[k]) dup++; pos[k] = 1; });
    var ax = b.B.squads[0].ax, ay = b.B.squads[0].ay;
    ok(us.length === 18 && dup === 0 && us[0].cap && Math.abs(us[0].spawnX - ax) < 50 && Math.abs(us[0].spawnY - ay) < 50, 'đội hình "' + TT.FORMATIONS[fm].name + '": 18 quân không trùng, tướng đứng đúng ô đặt');
  });
  // vị trí tướng: Trước (lp=1) đứng phía trước lính, Sau (lp=7) đứng phía sau (hướng theo phe)
  function depthOf(lp) { var b = battleOf(function (p, ctx, i) { var z = ctx.zone; army(p, ctx, 'linh', 12, z.x0 + 10, z.y0 + 6); p.squads[0].fm = 'vuong'; p.squads[0].lp = lp; }); var sq0 = b.B.squads[0], fw = TT.sideFwd[b.M.players[0].side], g = sq0.units[0], d = 0; sq0.units.slice(1).forEach(function (u) { d += ((g.spawnX - u.spawnX) * fw[0] + (g.spawnY - u.spawnY) * fw[1]); }); return d; }
  ok(depthOf(1) > 0 && depthOf(7) < 0, 'chọn vị trí tướng: Trước → tướng đứng đầu, Sau → tướng đứng cuối');
  // tư thế
  function run(stF, ticks, mod) { var b = battleOf(function (p, ctx, i) { var z = ctx.zone; if (i === 0) { army(p, ctx, 'linh', 6, z.x0 + 10, z.y0 + 2); p.squads[0].st = stF; } else army(p, ctx, 'linh', 3, z.x0 + 10, z.y0 + 2); }); for (var k = 0; k < ticks; k++) { if (mod) mod(b.B, k); b.B.step(); } return b.B; }
  function drift(B) { var m = 0; B.squads[0].units.forEach(function (u) { m = Math.max(m, Math.hypot(u.x - u.spawnX, u.y - u.spawnY) / 1000); }); return m; }
  var gi = run('giu', 160), tc = run('tc', 160);
  ok(drift(gi) < 5.5 && drift(tc) > 8, 'Giữ vị trí: cả lính lẫn tướng không rời điểm đứng (' + drift(gi).toFixed(1) + ' ô) còn Tấn công thì tiến (' + drift(tc).toFixed(1) + ' ô)');
  var ru = run('rut', 60, function (B, k) { if (k === 20) B.squads[0].units.forEach(function (u) { u.hp = Math.max(1, Math.floor(u.mhp * .2)); }); });
  var dBefore = drift(run('rut', 20)), dAfter = drift(ru);
  ok(dAfter < dBefore + 3, 'Rút khi yếu: dưới 30% máu thì lùi về điểm xuất phát (' + dBefore.toFixed(1) + ' → ' + dAfter.toFixed(1) + ' ô)');
  // Săn hậu tuyến: kỵ binh nhắm cung thủ phía sau thay vì Lính đứng trước
  function hunts(stF) {
    var b = battleOf(function (p, ctx, i) { var z = ctx.zone; if (i === 0) { army(p, ctx, 'ky', 4, z.x0 + 10, z.y0 + 5); p.squads[0].st = stF; } else { army(p, ctx, 'linh', 4, z.x0 + 10, z.y0 + 5); army(p, ctx, 'cung', 4, z.x0 + 13, z.y0 + 5); } });
    var B = b.B, hit = 0, tot = 0;
    for (var k = 0; k < 400 && !B.ended; k++) { B.step(); B.events.forEach(function (e) { if (e.e === 'atk') { var u = B.byId[e.a], t = B.byId[e.b]; if (u && t && u.pl === 0 && !u.monster && t.pl === 1) { tot++; if (t.role === 'cung') hit++; } } }); B.events = []; }
    return tot ? hit / tot : 0;
  }
  var hs = hunts('san'), ht = hunts('tc');
  ok(hs >= ht, 'Săn hậu tuyến: tỉ lệ đòn nhắm tầm xa ' + Math.round(hs * 100) + '% ≥ Tấn công ' + Math.round(ht * 100) + '%');
  // gói mạng mang theo đội hình + vị trí tướng
  var M2 = mk(['human', 'dragon']), pp = M2.players[0], cx2 = C(M2, pp); pp.gold = 60; var a2 = army(pp, cx2, 'linh', 5, cx2.zone.x0 + 3, cx2.zone.y0 + 2);
  P.apply(pp, { c: 'formation', sq: a2.sq, fm: 'non', lp: 7 }, cx2);
  var pk = P.makePackage(pp, []), ap = P.applyPackage(M2.players[0], pk, cx2);
  ok(ap.ok && ap.p.squads[0].fm === 'non' && ap.p.squads[0].lp === 7 && !P.apply(pp, { c: 'formation', sq: a2.sq, fm: 'lạ' }, cx2).ok, 'gói mang đội hình + vị trí tướng; đội hình lạ bị từ chối');
  var bad = JSON.parse(JSON.stringify(pk)); bad.a[0][8] = 'xyz'; ok(!P.applyPackage(M2.players[0], bad, cx2).ok, 'gói có đội hình lạ bị từ chối');
})();

console.log('— Điểm & kết thúc');
(function () {
  var M = mk(['dragon', 'demon', 'human', 'fairy'], 4);
  var res = { nTeams: 4, players: [{ seat: '1', rank: 1, kills: 9, mkills: 0 }, { seat: '2', rank: 2, kills: 4, mkills: 0 }, { seat: '3', rank: 3, kills: 0, mkills: 0 }, { seat: '4', rank: 4, kills: 0, mkills: 0 }] };
  MT.endDay(M, res);
  ok(M.scores['1'].pts === 20 + 2 && M.scores['2'].pts === 12 + 1 && M.scores['4'].pts === 2, 'điểm hạng 20/12/6/2 + điểm hạ gục (mỗi 4 dân = 1)');
  M.day = 10; MT.endDay(M, res);
  ok(M.scores['1'].rank === 20 + 30, 'Chung Kết điểm hạng ×1.5');
  var M2 = mk(['dragon', 'demon', 'human'], 3);
  MT.forfeit(M2, '2'); ok(!M2.over, 'còn 2 người thì chơi tiếp');
  MT.forfeit(M2, '3'); ok(M2.over && M2.winner[0] === '1', 'còn 1 người → thắng ngay');
})();

console.log('— Cả ván với bot (2/3/4 người, 3 mức)');
(function () {
  var r1 = S.playMatch({ seed: 11, mode: 2, races: ['dragon', 'fairy'], levels: ['medium', 'easy'] });
  var r2 = S.playMatch({ seed: 11, mode: 2, races: ['dragon', 'fairy'], levels: ['medium', 'easy'] });
  ok(r1.hashes.join() === r2.hashes.join(), 'ván 10 ngày phát lại cho cùng mã băm');
  ok(r1.M.over && r1.M.winner.length === 1, 'kết thúc sau 10 ngày có người thắng');
  var r3 = S.playMatch({ seed: 12, mode: 3, races: ['human', 'demon', 'fairy'], levels: ['easy', 'medium', 'easy'] });
  ok(r3.M.over && r3.maxSec < 400, 'ván 3 người hoàn tất (giao tranh dài nhất ' + r3.maxSec + 's)');
  var r4 = S.playMatch({ seed: 13, mode: 4, races: ['dragon', 'human', 'fairy', 'demon'], levels: ['hard', 'medium', 'easy', 'medium'], teamMode: true });
  ok(r4.M.over && r4.M.winner.length === 2, 'ván 2 đấu 2 có 2 người thắng cùng đội');
  var t0 = Date.now(), M = r4.M; var B = TT.Battle.create(MT.battleInput(M)); B.run();
  ok(Date.now() - t0 < 3000, 'giao tranh 4 người chạy nhanh hơn thời gian thực (' + (Date.now() - t0) + 'ms)');
  var hard = 0, n = 0; for (var s = 0; s < 4; s++) { var m = S.playMatch({ seed: 500 + s, mode: 2, races: [TT.FACTION_ORDER[s], TT.FACTION_ORDER[(s + 1) % 4]], levels: s % 2 ? ['easy', 'hard'] : ['hard', 'easy'] }); m.M.history.forEach(function (h) { n++; var hs = s % 2 ? '2' : '1'; if (h.ranks[hs] === 1) hard++; }); }
  ok(hard > n * .6, 'bot Khó thắng bot Dễ phần lớn số ngày (' + hard + '/' + n + ')');
})();

console.log('— Bản đồ chiến thuật (đối xứng, nối thông, vùng xuất quân sạch)');
(function () {
  function bfs(m, sx, sy) { var W = m.W, H = m.H, d = new Int8Array(W * H), q = [sy * W + sx]; d[q[0]] = 1; for (var i = 0; i < q.length; i++) { var k = q[i], x = k % W, y = (k / W) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) { var nx = x + v[0], ny = y + v[1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; var nk = ny * W + nx; if (d[nk] || m.g[nk] === '#') return; d[nk] = 1; q.push(nk); }); } return d; }
  TT.MAP_ORDER.forEach(function (key) {
    [2, 4].forEach(function (mode) {
      var m = TT.buildMap(mode, key, 777), m2 = TT.buildMap(mode, key, 777), W = m.W, H = m.H, sides = mode === 2 ? [0, 2] : [0, 1, 2, 3], good = true, clean = true;
      for (var y = 0; y < H && good; y++) for (var x = 0; x < W; x++) { var p = mode === 2 ? [W - 1 - x, H - 1 - y] : [W - 1 - y, x]; if (m.g[p[1] * W + p[0]] !== m.g[y * W + x]) { good = false; break; } }
      var zs = sides.map(function (sd) { return TT.zoneOf(mode, sd); });
      zs.forEach(function (z) { for (var y = z.y0; y <= z.y1; y++) for (var x = z.x0; x <= z.x1; x++) if (m.g[y * W + x] !== '.') clean = false; });
      var d = bfs(m, (zs[0].x0 + zs[0].x1) >> 1, (zs[0].y0 + zs[0].y1) >> 1);
      var conn = zs.every(function (z) { return d[((z.y0 + z.y1) >> 1) * W + ((z.x0 + z.x1) >> 1)]; });
      ok(m.g === m2.g && good && clean && conn && m.g.length === W * H, 'bản đồ ' + key + ' (' + mode + ' chế độ) đối xứng, tất định, vùng xuất quân sạch, nối thông');
      ok(m.towers.length >= 1 && m.towers.every(function (t) { return !zs.some(function (z) { return TT.inZone(z, t[0], t[1]); }); }), 'bản đồ ' + key + ' có tháp ngoài vùng xuất quân');
    });
  });
})();

console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi');
process.exit(fail ? 1 : 0);
