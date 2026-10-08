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
  ok(!P.apply(p, { c: 'buyItem', it: 'daidao' }, ctx).ok, 'trang bị bậc II cần Đời II');
  var g0 = p.gold; P.apply(p, { c: 'buyItem', it: 'giap' }, ctx);
  ok(p.gold === g0 - CFG.itemPrice[1], 'mua Giáp Da ' + CFG.itemPrice[1] + ' Vàng');
  P.apply(p, { c: 'sellItem', idx: 0 }, ctx);
  ok(p.gold === g0, 'bán trang bị bằng giá mua');
  ['giap', 'bua', 'nhan'].forEach(function (k) { P.apply(p, { c: 'buyItem', it: k }, ctx); });
  P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx); P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx);
  ok(p.squads[0].it.length === 3 && !P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx).ok, 'tướng đeo tối đa 3 món');
  for (var i = 0; i < 12; i++) P.apply(p, { c: 'buyItem', it: 'kiem' }, ctx);
  ok(P.invUsed(p) === CFG.invSize, 'tủ đồ tối đa ' + CFG.invSize + ' ô');
  ok(CFG.itemPrice[4] > CFG.itemPrice[3] && CFG.itemPrice[3] > CFG.itemPrice[2] && CFG.itemPrice[2] > CFG.itemPrice[1], 'bậc cao đắt hơn');
  var g1 = p.gold, eq = p.squads[0].it.reduce(function (s, k) { return s + TT.ITEMS[k].price; }, 0), val = P.squadCost(p, p.squads[0]);
  P.apply(p, { c: 'sell', sq: sq }, ctx);
  ok(p.squads.length === 0 && p.gold === g1 + val + eq, 'bán tướng: hoàn 100% tướng, lính và trang bị đang đeo');
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
  var M = mk(['dragon', 'fairy']), p0 = M.players[0]; p0.gold = 40; var ctx = C(M, p0), p = P.clone(p0), z = ctx.zone, log = [];
  army(p, ctx, 'linh', 3, z.x0 + 3, z.y0 + 2);
  [{ c: 'xp' }, { c: 'buyItem', it: 'bua' }].forEach(function (c) { var r = P.apply(p, c, ctx); if (r.log) log = log.concat(r.log); });
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
  ok(!P.apply(p, { c: 'flags', sq: p.squads[1].id, fl: [{ c: 'X', x: 1, y: 1 }, { c: 'D', x: 2, y: 2 }, { c: 'D', x: 3, y: 3 }] }, ctx).ok, 'giới hạn bước cờ theo Đời');
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

console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi');
process.exit(fail ? 1 : 0);
