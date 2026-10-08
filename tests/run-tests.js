/* Kiểm thử bắt buộc 2.0 (GDD 17.2). Chạy: node tests/run-tests.js */
var S = require('./sim.js'), TT = S.TT, P = TT.Prep, MT = TT.Match, CFG = TT.CONFIG;
var pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } }
function mk(races, mode) { var M = MT.create({ seed: 4242, mode: mode || 2, players: races.map(function (r, i) { return { seat: i + 1, name: 'P' + (i + 1), race: r, start: 'gold' }; }) }); MT.beginDay(M); return M; }
function C(M, p) { return MT.ctx(M, p); }

console.log('— Kinh tế');
(function () {
  var M = mk(['dragon', 'human']), a = M.players[0], b = M.players[1];
  ok(a.res.V === CFG.resIncome[1] && b.res.T === CFG.resIncome[1], 'vốn đầu ngày 1 bằng nhau');
  ok(a.cry === CFG.cryStart && a.lv === 1 && a.inv[0] === 'kiem', 'Tinh thể khởi đầu, Đời I, trang bị khởi đầu');
  var z = C(M, a).zone, v0 = TT.costSum(P.addC(a.res, P.armyValue(a)));
  var r = P.apply(a, { c: 'buy', t: 'linh', k: 3, x: z.x0, y: z.y0 }, C(M, a));
  ok(r.ok && a.squads[0].n === 3, 'mua 3 lính');
  P.apply(a, { c: 'sell', sq: a.squads[0].id, k: 3 }, C(M, a));
  ok(TT.costSum(P.addC(a.res, P.armyValue(a))) === v0 && a.squads.length === 0, 'bán hoàn 100%');
  // tài nguyên dư giữ sang ngày sau, không lãi
  var before = a.res.V; MT.beginDay(M);
  ok(a.res.V === before + CFG.resIncome[2], 'dư cộng sang ngày sau, không lãi');
  ok(a.cry === CFG.cryStart + CFG.cryDaily + 0 && a.xp === CFG.xpDaily, 'Tinh thể ngày 2 = khởi đầu + 5, EXP +2');
  a.cry = 37; MT.beginDay(M);
  ok(a.cry === 37 + CFG.cryDaily + 3, 'lãi Tinh thể: 37 → +3');
  a.cry = 90; MT.beginDay(M);
  ok(a.cry === 90 + CFG.cryDaily + CFG.cryInterestMax, 'lãi Tinh thể tối đa 5');
  // tổng tài nguyên 10 ngày bằng nhau
  var tot = 0; for (var d = 1; d <= 10; d++) tot += CFG.resIncome[d];
  ok(tot * 3 === 201, 'tổng tài nguyên 10 ngày = 201 cho mọi người');
})();

console.log('— Đời (EXP)');
(function () {
  var M = mk(['fairy', 'demon']), p = M.players[0];
  p.cry = 40;
  var r = P.apply(p, { c: 'xp' }, C(M, p));
  ok(r.ok && p.lv === 1 && p.xp === 4 && p.cry === 36, 'mua 4 EXP giá 4 Tinh thể');
  P.apply(p, { c: 'xp' }, C(M, p));
  ok(p.lv === 2 && p.xp === 2, 'đủ 6 EXP lên Đời II (dư 2)');
  ok(P.capacity(p) === CFG.capacity[2], 'Sức chứa tăng ngay khi lên Đời');
  ok(P.unitUnlocked(p, 'y') && !P.unitUnlocked(p, 'phapsu'), 'Đời II mở Thuật sĩ, chưa mở Pháp sư');
  var need = 0; for (var i = 1; i < 4; i++) need += CFG.xpToNext[i];
  ok(need === 44, 'tổng EXP lên Đời IV = 44');
})();

console.log('— Sức chứa, tách/gộp');
(function () {
  var M = mk(['human', 'dragon']), p = M.players[0], ctx = C(M, p), z = ctx.zone;
  p.res = { V: 99, T: 99, G: 99 };
  P.apply(p, { c: 'buy', t: 'linh', k: 99, x: z.x0 + 5, y: z.y0 + 2 }, ctx);
  ok(P.usedPop(p) === P.capacity(p), 'không mua vượt Sức chứa (' + P.capacity(p) + ')');
  var q = p.squads[0], n0 = q.n;
  var r = P.apply(p, { c: 'split', sq: q.id, k: 4 }, ctx);
  ok(r.ok && p.squads.length === 2 && p.squads[0].n + p.squads[1].n === n0, 'tách bảo toàn số quân');
  P.apply(p, { c: 'move', sq: p.squads[1].id, x: q.x, y: q.y }, ctx);
  ok(p.squads.length === 1 && p.squads[0].n === n0, 'kéo đè lên đội cùng loại = gộp');
  ok(!P.apply(p, { c: 'buy', t: 'cung', k: 1, x: z.x0 - 1, y: z.y0 }, ctx).ok, 'không đặt ngoài vùng xuất quân');
  ok(!P.apply(p, { c: 'buy', t: 'tuong', k: 1, x: z.x0, y: z.y0 }, ctx).ok, 'chưa mở khóa Tượng binh ở Đời I');
  // số quân mỗi đội không giới hạn (ngoài Sức chứa)
  p.lv = 4; p.res = { V: 999, T: 999, G: 999 };
  P.apply(p, { c: 'buy', t: 'linh', k: 40, x: q.x, y: q.y }, ctx);
  ok(p.squads[0].n > 30, 'một đội có thể rất đông (' + p.squads[0].n + ' quân)');
  ok(!P.apply(p, { c: 'buy', t: 'thanthu', k: 2, x: z.x0 + 1, y: z.y0 }, ctx).ok, 'chỉ 1 Thần thú');
})();

console.log('— Trang bị');
(function () {
  var M = mk(['human', 'dragon']), p = M.players[0], ctx = C(M, p), z = ctx.zone;
  P.apply(p, { c: 'buy', t: 'linh', k: 2, x: z.x0, y: z.y0 }, ctx);
  var sq = p.squads[0].id;
  ok(P.apply(p, { c: 'equip', idx: 0, sq: sq }, ctx).ok && p.squads[0].it[0] === 'kiem', 'gắn trang bị khởi đầu cho đội trưởng');
  ok(!P.apply(p, { c: 'buyItem', it: 'daidao' }, ctx).ok, 'trang bị bậc II cần Đời II');
  var res0 = TT.costSum(p.res); P.apply(p, { c: 'buyItem', it: 'giap' }, ctx);
  ok(TT.costSum(p.res) === res0 - 3, 'mua Giáp Da 3 tài nguyên');
  P.apply(p, { c: 'sellItem', idx: 0 }, ctx);
  ok(TT.costSum(p.res) === res0, 'bán trang bị hoàn 100%');
  ok(P.itemSlots(p) === CFG.itemSlots[1] + 1, 'Nhân tộc +1 ô trang bị');
  P.apply(p, { c: 'sell', sq: sq, k: 2 }, ctx);
  ok(p.inv.indexOf('kiem') >= 0, 'bán hết đội thì trang bị về kho');
})();

console.log('— Lõi');
(function () {
  var M = mk(['fairy', 'demon']), p = M.players[0], ctx = C(M, p);
  ok(p.board.filter(Boolean).length === 5, 'bảng Lõi 5 ô');
  p.cry = 20;
  var id = p.board[0], cost = CFG.coreCost[TT.CORES[id].tier];
  P.apply(p, { c: 'core', slot: 0 }, ctx);
  ok(p.cores[0] === id && p.cry === 20 - cost + (TT.CORES[id].fx.cryNow || 0), 'mua Lõi đúng giá');
  var c1 = p.cry; P.apply(p, { c: 'reroll' }, ctx);
  ok(p.cry === c1, 'đổi bảng lần đầu miễn phí');
  P.apply(p, { c: 'lock', slot: 1 }, ctx); var keep = p.board[1];
  P.apply(p, { c: 'reroll' }, ctx);
  ok(p.board[1] === keep && p.cry === c1 - 1, 'khóa giữ ô qua lần đổi, lần sau tốn 1');
  var c2 = p.cry; P.apply(p, { c: 'sellCore', idx: 0 }, ctx);
  ok(p.cry === c2 + Math.floor(cost / 2), 'bán Lõi hoàn 50%');
  var bad = TT.CORE_ORDER.filter(function (k) { return /^race:/.test(TT.CORES[k].scope) && TT.CORES[k].scope !== 'race:fairy'; });
  var seen = false; for (var i = 0; i < 30; i++) { P.apply(p, { c: 'reroll' }, ctx); p.cry = 50; p.board.forEach(function (b) { if (bad.indexOf(b) >= 0) seen = true; }); }
  ok(!seen, 'không ra Lõi riêng của tộc khác');
})();

console.log('— Gói đội hình & chống gian lận');
(function () {
  var M = mk(['dragon', 'fairy']), p0 = M.players[0], ctx = C(M, p0), p = P.clone(p0), z = ctx.zone;
  P.apply(p, { c: 'buy', t: 'linh', k: 3, x: z.x0 + 3, y: z.y0 + 2 }, ctx);
  var pkg = P.makePackage(p, []);
  var r = P.applyPackage(p0, pkg, ctx);
  ok(r.ok && r.p.squads[0].n === 3 && r.p.res.T === p.res.T, 'áp gói hợp lệ ra đúng trạng thái');
  var cheat = JSON.parse(JSON.stringify(pkg)); cheat.a[0][2] = 30;
  ok(!P.applyPackage(p0, cheat, ctx).ok, 'gói vượt ngân sách bị từ chối');
  var cheat2 = JSON.parse(JSON.stringify(pkg)); cheat2.a[0][1] = 'thanthu'; cheat2.a[0][2] = 1;
  ok(!P.applyPackage(p0, cheat2, ctx).ok, 'gói dùng quân chưa mở khóa bị từ chối');
  var cheat3 = JSON.parse(JSON.stringify(pkg)); cheat3.a[0][3] = 0; cheat3.a[0][4] = 30;
  ok(!P.applyPackage(p0, cheat3, ctx).ok, 'gói đặt quân ngoài vùng bị từ chối');
  ok(JSON.stringify(pkg).length < 12000, 'gói nhỏ gọn');
})();

console.log('— Giao tranh');
function battleOf(build, opts) {
  var M = mk(opts && opts.races || ['human', 'human']); M.map = TT.buildMap(2, 'binhnguyen', 1);
  M.players.forEach(function (p, i) { p.lv = 4; p.res = { V: 999, T: 999, G: 999 }; build(p, MT.ctx(M, p), i); });
  return { M: M, B: TT.Battle.create(MT.battleInput(M)) };
}
(function () {
  var mkb = function () { return battleOf(function (p, ctx) { var z = ctx.zone; P.apply(p, { c: 'buy', t: 'linh', k: 6, x: z.x0 + 10, y: z.y0 + 3 }, ctx); P.apply(p, { c: 'buy', t: 'cung', k: 4, x: z.x0 + 12, y: z.y0 + 8 }, ctx); P.apply(p, { c: 'auto' }, ctx); }); };
  var a = mkb().B.run(), b = mkb().B.run();
  ok(a.hash === b.hash && a.ticks === b.ticks, 'cùng đội hình + seed → cùng kết quả');
  ok(a.players.some(function (x) { return x.rank === 1; }) && a.players.some(function (x) { return x.rank === 2; }), 'xếp hạng 1 và 2');
  // bão sau 5 phút: hai đội "giữ vị trí" không gặp nhau vẫn kết thúc
  var t = battleOf(function (p, ctx) { var z = ctx.zone; P.apply(p, { c: 'buy', t: 'thuan', k: 3, x: z.x0 + 2, y: z.y0 + 5 }, ctx); P.apply(p, { c: 'stance', sq: p.squads[0].id, s: 'giu' }, ctx); });
  var r = t.B.run();
  ok(t.B.ended && r.sec > CFG.battleMaxSec && r.sec < CFG.battleMaxSec + 30, 'sau 5 phút sát thương tăng dần kết thúc trận (' + r.sec + 's)');
  // cờ Xanh: không tấn công khi đang hành quân
  var fx = battleOf(function (p, ctx, i) {
    var z = ctx.zone; P.apply(p, { c: 'buy', t: 'cung', k: 4, x: z.x0 + 10, y: i ? z.y1 : z.y0 }, ctx);
    if (i === 0) { var q = p.squads[0]; var flag = TT.rotPoint(2, 0, 19, 40); q.fl = [{ c: 'X', x: z.x0 + 10, y: z.y1 }]; }
    else P.apply(p, { c: 'stance', sq: p.squads[0].id, s: 'giu' }, ctx);
  });
  var B = fx.B, attacked = false; for (var k = 0; k < 200; k++) { B.step(); B.events.forEach(function (e) { if (e.e === 'atk') { var u = B.byId[e.a]; if (u && u.pl === 0 && B.squads[u.sq].step === 0) attacked = true; } }); B.events = []; }
  ok(!attacked, 'Cờ Xanh: đội không bắn khi đang đi tới cờ');
  // cờ Vàng: Thuật sĩ đi theo đội Lính
  var fv = battleOf(function (p, ctx, i) {
    var z = ctx.zone; P.apply(p, { c: 'buy', t: 'linh', k: 6, x: z.x0 + 4, y: z.y0 + 2 }, ctx); P.apply(p, { c: 'buy', t: 'y', k: 2, x: z.x0 + 20, y: z.y0 + 9 }, ctx);
    var y = p.squads[1]; y.fl = [{ c: 'V', sq: p.squads[0].id, k: 'sat' }];
  });
  for (var k2 = 0; k2 < 240; k2++) fv.B.step();
  var s0 = fv.B.squads[0], s1 = fv.B.squads[1], dd = Math.sqrt(Math.pow(s0.cx - s1.cx, 2) + Math.pow(s0.cy - s1.cy, 2)) / 1000;
  ok(dd < 7, 'Cờ Vàng: đội hộ tống bám sát đội đích (' + dd.toFixed(1) + ' ô)');
  // thuật sĩ hồi máu
  var heals = 0; for (var k3 = 0; k3 < 600 && !fv.B.ended; k3++) { fv.B.step(); fv.B.events.forEach(function (e) { if (e.e === 'heal' && e.v > 0) heals++; }); fv.B.events = []; }
  ok(heals > 0, 'Thuật sĩ hồi máu đồng minh (' + heals + ' lần)');
  // không vòng tròn hộ tống
  var M = mk(['human', 'fairy']), p = M.players[0], ctx = C(M, p), z = ctx.zone;
  P.apply(p, { c: 'buy', t: 'linh', k: 2, x: z.x0, y: z.y0 }, ctx); P.apply(p, { c: 'buy', t: 'cung', k: 2, x: z.x0 + 2, y: z.y0 }, ctx);
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
  var t0 = Date.now(), M = r4.M; MT.beginDay; var B = TT.Battle.create(MT.battleInput(M)); B.run();
  ok(Date.now() - t0 < 3000, 'giao tranh 4 người chạy nhanh hơn thời gian thực (' + (Date.now() - t0) + 'ms)');
  var hard = 0, n = 0; for (var s = 0; s < 4; s++) { var m = S.playMatch({ seed: 500 + s, mode: 2, races: [TT.FACTION_ORDER[s], TT.FACTION_ORDER[(s + 1) % 4]], levels: s % 2 ? ['easy', 'hard'] : ['hard', 'easy'] }); m.M.history.forEach(function (h) { n++; var hs = s % 2 ? '2' : '1'; if (h.ranks[hs] === 1) hard++; }); }
  ok(hard > n * .6, 'bot Khó thắng bot Dễ phần lớn số ngày (' + hard + '/' + n + ')');
})();

console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi');
process.exit(fail ? 1 : 0);
