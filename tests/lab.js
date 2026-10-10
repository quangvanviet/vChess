/* Phòng thí nghiệm cân bằng: đấu cặp có kiểm soát (gương), chỉ thay đổi một yếu tố.
   Chạy: node tests/lab.js <thí nghiệm> [N]
   Thí nghiệm: races | roles | marshals | summons | cores | items | talents | storm
   Mỗi trận chạy cả hai phía ghế và nhiều bản đồ/seed; báo tỉ lệ thắng của bên A và chênh lệch máu còn lại. */
var S = require('./sim.js'), TT = S.TT, P = TT.Prep, MT = TT.Match;
var N = +process.argv[3] || 6;
var MAPS = ['binhnguyen', 'caonguyen', 'rungsau', 'thunglung', 'thaptu', 'hemnui'];

// đội hình chuẩn Đời IV (~38 dân số) — n = tổng quân của đạo (kể cả tướng)
var STD = [['linh', 6], ['thuan', 5], ['cung', 6], ['y', 2], ['ky', 3], ['phapsu', 3], ['chihuy', 1], ['congthanh', 1]];
var STD2 = [['linh', 6], ['thuan', 4], ['cung', 5], ['ky', 2]];   // Đời II ~ 20 dân số

function setup(p, cfg, ctx) {
  p.lv = cfg.lv || 4; p.gold = 999; p.cores = (cfg.cores || []).slice(); p.mar = cfg.mar || 'thongsoai';
  if (cfg.talent) p.talent = cfg.talent;
  var ms = p.squads.filter(function (q) { return TT.ROLES[q.t].marshal; })[0];
  p.squads = [ms]; ms.sm = cfg.sm || 'linh'; ms.it = (cfg.marIt || []).slice();
  (cfg.army || STD).forEach(function (a, i) {
    p.squads.push({ id: p.nid++, t: a[0], n: a[1], x: 0, y: 0, st: a[3] || 'tc', fm: 'khoi', lp: 4, it: (a[2] || []).slice(), fl: [], up: (a[4] || [0, 0, 0, 0]).slice() });
  });
  if (cfg.items) cfg.items.forEach(function (it, i) { var gs = p.squads.filter(function (q) { return !TT.ROLES[q.t].marshal && q.it.length < 3; }); var q = gs[i % gs.length]; if (q) q.it.push(it); });
  P.apply(p, { c: 'auto' }, ctx);
}
function one(A, B, seed, map) {
  var M = MT.create({ seed: seed, mode: 2, players: [{ seat: 1, name: 'A', race: A.race, start: 'gold' }, { seat: 2, name: 'B', race: B.race, start: 'gold' }] });
  MT.beginDay(M); M.map = TT.buildMap(2, map, seed); M.weather = 'quang'; M.event = null;
  setup(M.players[0], A, MT.ctx(M, M.players[0])); setup(M.players[1], B, MT.ctx(M, M.players[1]));
  var B0 = TT.Battle.create(MT.battleInput(M));
  var hp0 = [0, 0]; B0.units.forEach(function (u) { if (!u.monster) hp0[u.pl] += u.mhp; });
  var r = B0.run();
  var hp = [0, 0]; B0.units.forEach(function (u) { if (u.alive && !u.monster) hp[u.pl] += u.hp; });
  var ra = r.players[0].rank, rb = r.players[1].rank;
  return { w: ra < rb ? 1 : ra > rb ? 0 : .5, m: hp[0] / hp0[0] - hp[1] / hp0[1], sec: r.sec };
}
/* A vs B: trung bình qua N seed × bản đồ × đổi ghế */
function duel(A, B, n) {
  n = n || N; var w = 0, m = 0, k = 0, sec = 0;
  for (var s = 0; s < n; s++) {
    var map = MAPS[s % MAPS.length], seed = 9000 + s * 131;
    var x = one(A, B, seed, map), y = one(B, A, seed + 7, map);
    w += x.w + (1 - y.w); m += x.m - y.m; sec += x.sec + y.sec; k += 2;
  }
  return { w: Math.round(w * 100 / k), m: Math.round(m * 100 / k), sec: Math.round(sec / k) };
}
/* cấu hình "công bằng" theo đặc tính kinh tế của tộc: cùng dân số + cùng ngân sách trang bị; Nhân +4 dân, Rồng tướng đắt hơn 1 Vàng (≈ bớt 8 Vàng trang bị) */
var FAIR_IT = ['daidao', 'cutam', 'huyetkiem', 'thanhtri', 'kiemda', 'aogiaplon'];
function fairCfg(race) {
  var arm = STD.map(function (a) { return a.slice(); });
  if (race === 'human') arm[0][1] += 4;
  return { race: race, army: arm, items: race === 'dragon' ? FAIR_IT.slice(0, 4) : FAIR_IT.slice() };
}
exports.fairCfg = fairCfg;
exports.duel = duel; exports.one = one; exports.STD = STD;
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function line(name, r, extra) { console.log(pad(name, 30) + ' thắng ' + pad(r.w + '%', 5) + ' máu±' + pad(r.m, 5) + ' ' + pad(r.sec + 's', 6) + (extra || '')); }

var X = process.argv[2];
if (require.main === module) {
  var t0 = Date.now();
  if (X === 'races') {
    var R = TT.FACTION_ORDER, tot = {};
    R.forEach(function (a) { tot[a] = [0, 0]; });
    for (var i = 0; i < R.length; i++) for (var j = i + 1; j < R.length; j++) {
      var r = duel(fairCfg(R[i]), fairCfg(R[j])); line(R[i] + ' vs ' + R[j], r);
      tot[R[i]][0] += r.w; tot[R[i]][1]++; tot[R[j]][0] += 100 - r.w; tot[R[j]][1]++;
    }
    R.forEach(function (a) { console.log('  ' + pad(a, 8) + Math.round(tot[a][0] / tot[a][1]) + '%'); });
    if (process.env.EARLY) { console.log('— Đời II'); R.forEach(function (a) { var w = 0; R.forEach(function (b) { if (a !== b) w += duel({ race: a, lv: 2, army: STD2 }, { race: b, lv: 2, army: STD2 }, 4).w; }); console.log('  ' + pad(a, 8) + Math.round(w / (R.length - 1)) + '%'); }); }
  }
  if (X === 'marshals') {
    var race = process.env.RACE || 'human', base = { race: race, mar: 'thongsoai' };
    TT.MARSHAL_LIST.forEach(function (id) { if (id === 'thongsoai') return; line(TT.MARSHALS[id].name + ' vs Thống Soái', duel({ race: race, mar: id }, base)); });
    // vòng tròn rút gọn: mỗi Nguyên soái đấu 4 Nguyên soái khác ngẫu nhiên cố định
  }
  if (X === 'summons') {
    // cùng đội hình, chỉ khác loại lính triệu hồi; so với triệu hồi Lính
    var race2 = process.env.RACE || 'human';
    Object.keys(TT.CONFIG.marshal.summon).forEach(function (k) { if (k === 'linh') return; line('Triệu hồi ' + k + ' vs Lính', duel({ race: race2, sm: k }, { race: race2, sm: 'linh' })); });
    // một mình Nguyên soái + triệu hồi so với đội không có triệu hồi (đo tổng sức triệu hồi)
  }
  if (X === 'roles') {
    // lõi chung + 8 dân số thêm: binh chủng X so với 8 Lính (cùng dân số; X đắt Vàng hơn nên nên nhỉnh hơn một chút)
    var race3 = process.env.RACE || 'human', CORE = [['linh', 6], ['thuan', 4], ['cung', 6], ['y', 2]];
    TT.ROLE_ORDER.forEach(function (rl) {
      var R0 = TT.ROLES[rl]; if (R0.unique || rl === 'linh') return;
      var n = Math.max(1, Math.round(8 / R0.pop)), arm = CORE.concat(n > 4 && R0.pop === 1 ? [[rl, 4], [rl, n - 4]] : [[rl, n]]);
      var g = TT.genCost(race3, rl) + (n - 1) * TT.unitCost(race3, rl);
      line(rl + ' x' + n + ' (' + g + 'v) vs 8 Lính (10v)', duel({ race: race3, army: arm }, { race: race3, army: CORE.concat([['linh', 4], ['linh', 4]]) }));
    });
  }
  if (X === 'rolesrr') {
    // vòng tròn: lõi chung + 8 dân số của một binh chủng; mỗi binh chủng đấu mọi binh chủng khác
    var race6 = process.env.RACE || 'human', CORE6 = [['linh', 6], ['thuan', 4], ['cung', 6], ['y', 2]], rl6 = TT.ROLE_ORDER.filter(function (r) { return !TT.ROLES[r].unique; }), sc = {};
    function addOn(rl) { var R0 = TT.ROLES[rl], n = Math.max(1, Math.round(8 / R0.pop)); return CORE6.concat(n > 4 ? [[rl, 4], [rl, n - 4]] : [[rl, n]]); }
    rl6.forEach(function (r) { sc[r] = [0, 0, 0]; });
    for (var i6 = 0; i6 < rl6.length; i6++) for (var j6 = i6 + 1; j6 < rl6.length; j6++) {
      var r6 = duel({ race: race6, army: addOn(rl6[i6]) }, { race: race6, army: addOn(rl6[j6]) });
      sc[rl6[i6]][0] += r6.w; sc[rl6[i6]][1]++; sc[rl6[i6]][2] += r6.m; sc[rl6[j6]][0] += 100 - r6.w; sc[rl6[j6]][1]++; sc[rl6[j6]][2] -= r6.m;
    }
    rl6.forEach(function (r) { console.log(pad(r, 12) + Math.round(sc[r][0] / sc[r][1]) + '%  máu±' + Math.round(sc[r][2] / sc[r][1])); });
  }
  if (X === 'cores') {
    var race4 = process.env.RACE || 'human', only = process.env.ONLY, res = [];
    TT.CORE_ORDER.forEach(function (id) {
      if (only && only.split(',').indexOf(id) < 0) return;
      var c = TT.CORES[id]; if (c.scope === 'econ') return;
      var rc = c.scope.indexOf('race:') === 0 ? c.scope.slice(5) : race4, arm = STD.map(function (a) { return a.slice(); });
      if (c.scope.indexOf('role:') === 0) { var rl = c.scope.slice(5); if (TT.ROLES[rl].marshal) arm = arm; else if (rl === 'thanthu') arm.push(['thanthu', 1]); else arm.push([rl, rl === 'tuong' ? 2 : 4]); }
      if (c.fx.roleOnly) arm.push([c.fx.roleOnly, 4]);
      var r = duel({ race: rc, cores: [id], army: arm }, { race: rc, army: arm }, +process.env.CN || 4);
      res.push([c.tier, id, c.name, r]);
    });
    res.sort(function (a, b) { return a[0] - b[0] || b[3].m - a[3].m; });
    res.forEach(function (x) { line('T' + x[0] + ' ' + x[2], x[3], ' ' + x[1]); });
  }
  if (X === 'items') {
    var race5 = process.env.RACE || 'human', res2 = [];
    TT.ITEM_ORDER.forEach(function (id) {
      if (process.env.ONLY && process.env.ONLY.split(',').indexOf(id) < 0) return;
      // 3 bản trang bị cho 3 tướng (cận, xa, giữa) so với không trang bị
      var it = TT.ITEMS[id], r = duel({ race: race5, items: [id, id, id] }, { race: race5 }, +process.env.CN || 4);
      res2.push([it.tier, id, it.name, r]);
    });
    res2.sort(function (a, b) { return a[0] - b[0] || b[3].m - a[3].m; });
    res2.forEach(function (x) { line('T' + x[0] + ' ' + x[2], x[3], ' ' + x[1]); });
  }
  if (X === 'talents') {
    TT.FACTION_ORDER.forEach(function (rc) { var ts = TT.TALENTS[rc]; ts.forEach(function (t) { line(rc + ' ' + t.name, duel({ race: rc, talent: t.id }, { race: rc, talent: ts[0].id === t.id ? ts[1].id : ts[0].id }, 4)); }); });
  }
  if (X === 'storm') {
    // đội rất trâu + hồi máu: bo phải kết thúc trận
    var hard = [['thuan', 8, ['longgiap', 'cutam', 'battu'], 'giu'], ['y', 4, [], 'giu']];
    var r9 = duel({ race: 'dragon', army: hard }, { race: 'fairy', army: hard }, 2); line('Trận trâu (giữ vị trí)', r9);
  }
  console.log('(' + Math.round((Date.now() - t0) / 1000) + 's)');
}
