/* Tứ Tộc Kỳ Chiến 2.0 — Bot chuẩn bị đội hình (Dễ / Trung bình / Khó). Xác định theo seed. */
(function (G) {
  'use strict';
  var TT = G.TT, CFG = TT.CONFIG, P = TT.Prep;
  var Bot = TT.Bot = {};
  Bot.LEVELS = {
    easy: { name: 'Dễ', ageDay: [0, 1, 4, 8, 99], items: .25, coreTier: 2, noise: 60, sim: 0, flags: 0, reserve: 0, spend: .8, sloppy: 1 },
    medium: { name: 'Trung bình', ageDay: [0, 1, 3, 5, 8], items: .8, coreTier: 3, noise: 15, sim: 0, flags: 1, reserve: 10 },
    hard: { name: 'Khó', ageDay: [0, 1, 2, 4, 7], items: 1, coreTier: 4, noise: 0, sim: 5, flags: 1, reserve: 10, aura: 1 }
  };
  Bot.levelName = function (lv) { return (Bot.LEVELS[lv] || Bot.LEVELS.medium).name; };

  /* Thiết lập ngẫu nhiên cho bot (tộc, thiên phú, trang bị khởi đầu) theo seed + ghế */
  Bot.loadout = function (seed, seat) {
    var h = TT.hash32(seed, 'bot', seat), race = TT.FACTION_ORDER[h % 4];
    var tal = TT.TALENTS[race][(h >>> 3) % 3].id, start = ['gold', 'food', 'wood'][(h >>> 6) % 3];
    return { race: race, talent: tal, start: start };
  };

  // trọng số thành phần quân theo tộc
  var MIX = {
    dragon: { linh: 4, thuan: 2.5, cung: 2.5, y: 1, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1, tuong: 1.2, thanthu: 1 },
    human: { linh: 4, thuan: 2.5, cung: 3, y: 1.2, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1.2, tuong: 1, thanthu: 1 },
    fairy: { linh: 2.5, thuan: 2.5, cung: 4, y: 1.2, ky: 1.5, chihuy: 1, thichkhach: 1.2, phapsu: 2, congthanh: 1, tuong: 1, thanthu: 1 },
    demon: { linh: 5, thuan: 2, cung: 2.5, y: 1.2, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1, tuong: 1, thanthu: 1 }
  };
  var SQ_MAX = { linh: 10, thuan: 8, cung: 8, y: 4, ky: 6, chihuy: 2, thichkhach: 4, phapsu: 5, congthanh: 3, tuong: 2, thanthu: 1 };
  var MAXCOUNT = { y: 4, chihuy: 2, thanthu: 1 };

  function score(rng, noise) { return noise ? (rng() % (noise * 2 + 1)) - noise : 0; }

  /* Lên kế hoạch cả ngày cho bot: trả về {cmds (đã áp lên p), cry (nhật ký tinh thể)} */
  Bot.plan = function (M, p, level, opts) {
    var L = Bot.LEVELS[level] || Bot.LEVELS.medium, ctx = TT.Match.ctx(M, p), rng = TT.mulberry(TT.hash32(M.seed, 'botplan', p.seat, M.day));
    var cry = [];
    function doCry(c) { var r = P.apply(p, c, ctx); if (r.ok) cry.push(c); return r; }
    // 1) Tinh thể: lên Đời theo lịch, rồi Lõi
    var want = 1; for (var a = 1; a <= 4; a++) if (M.day >= L.ageDay[a]) want = a;
    var guard = 0;
    while (p.lv < want && p.cry >= CFG.xpBuyCost && guard++ < 10) doCry({ c: 'xp' });
    // Lõi
    var mixShare = shareOf(p.race, p.lv);
    for (var tries = 0; tries < 3; tries++) {
      var best = -1, bv = 0;
      p.board.forEach(function (id, i) {
        if (!id) return; var C = TT.CORES[id]; if (C.tier > L.coreTier) return;
        var cost = CFG.coreCost[C.tier]; if (p.cry - cost < (p.lv < want ? CFG.xpBuyCost : 0)) return;
        var v = coreValue(C, mixShare, p, M.day) + score(rng, L.noise / 10);
        if (v > bv) { bv = v; best = i; }
      });
      if (best >= 0 && p.cores.length < P.coreSlots(p) && bv >= 2) doCry({ c: 'core', slot: best });
      else if (L.sim && p.cry >= 6 && p.cores.length < P.coreSlots(p) && tries === 0) doCry({ c: 'reroll' });
      else break;
    }
    // dư nhiều thì lên Đời sớm hơn (khó)
    if (level === 'hard') while (p.lv < 4 && p.cry >= CFG.xpBuyCost + L.reserve && guard++ < 20) doCry({ c: 'xp' });
    if (level !== 'easy' && p.lv < 4 && p.cry >= 24) doCry({ c: 'xp' });
    // 2) Quân: bán hết rồi mua lại theo kế hoạch (hoàn 100% nên không mất gì)
    var candidates = [];
    var nCand = L.sim ? L.sim : 1;
    for (var k = 0; k < nCand; k++) candidates.push(buildArmy(p, ctx, L, rng, k));
    var pick = candidates[0];
    if (candidates.length > 1 && opts && opts.simulate !== false) {
      var bestS = -1e18;
      candidates.forEach(function (cand) { var s = simEval(M, p, cand); if (s > bestS) { bestS = s; pick = cand; } });
    }
    p.squads = pick.squads; p.inv = pick.inv; p.res = pick.res; p.nid = pick.nid;
    return { cry: cry };
  };
  function shareOf(race, lv) {
    var mx = MIX[race], s = { can: 0, trung: 0, xa: 0, roles: {} }, tot = 0;
    TT.ROLE_ORDER.forEach(function (r) { if (TT.ROLES[r].age <= lv) { tot += mx[r]; } });
    TT.ROLE_ORDER.forEach(function (r) { if (TT.ROLES[r].age <= lv) { var w = mx[r] / tot; s[TT.ROLES[r].cls] += w; s.roles[r] = w; } });
    return s;
  }
  function coreValue(C, sh, p, day) {
    var base = { 1: 3, 2: 5, 3: 7.5, 4: 11 }[C.tier], sc = C.scope, rel = 1;
    if (sc === 'econ') rel = day <= 5 ? .9 : .2;
    else if (sc.indexOf('cls:') === 0) rel = sh[sc.slice(4)] * 2.2;
    else if (sc.indexOf('role:') === 0) rel = (sh.roles[sc.slice(5)] || 0) * 4;
    else if (sc.indexOf('race:') === 0) rel = 1.2;
    if (C.fx.flagAdd || C.fx.towerX2 || C.fx.hillAtk) rel *= .5;
    return base * rel - CFG.coreCost[C.tier] * .8;
  }
  /* Dựng đạo quân mới từ toàn bộ ngân sách */
  function buildArmy(p0, ctx, L, rng, variant) {
    var p = P.clone(p0);
    // bán hết
    p.squads.slice().forEach(function (q) { P.apply(p, { c: 'sell', sq: q.id, k: q.n }, ctx); });
    p.inv.slice().forEach(function () { P.apply(p, { c: 'sellItem', idx: 0 }, ctx); });
    var mx = {}; for (var r in MIX[p.race]) mx[r] = MIX[p.race][r];
    if (variant === 1) { mx.cung *= 1.6; mx.phapsu *= 1.6; mx.linh *= .7; }
    if (variant === 2) { mx.linh *= 1.4; mx.thuan *= 1.4; mx.ky *= 1.5; mx.cung *= .7; }
    if (variant === 3) { mx.thuan *= 1.8; mx.y *= 2; mx.cung *= 1.2; mx.linh *= .6; }
    if (variant === 4) { mx.ky *= 2; mx.thichkhach *= 2; mx.tuong *= 1.5; mx.cung *= .8; }
    var cap = P.capacity(p), counts = {}, budget = TT.costSum(p.res);
    var itemShare = p.lv >= 2 ? L.items * (.12 + p.lv * .03) : L.items * .06;
    var unitBudget = budget * (1 - itemShare) * (L.spend || 1);
    var spent = 0, guard = 0, used = 0;
    while (guard++ < 300) {
      var free = cap - used; if (free <= 0) break;
      var best = null, bv = -1e9;
      TT.ROLE_ORDER.forEach(function (r) {
        var R = TT.ROLES[r]; if (R.age > p.lv || R.pop > free) return;
        if (MAXCOUNT[r] && (counts[r] || 0) >= MAXCOUNT[r]) return;
        var c = TT.unitCost(p.race, r); if (p.res.V < c.V || p.res.T < c.T || p.res.G < c.G) return;
        if (spent + TT.costSum(c) > unitBudget && spent > 0) return;
        var have = (counts[r] || 0) * R.pop, v = mx[r] * 10 / (have + R.pop) + score(rng, L.noise / 10) * .3;
        if (R.age === p.lv && p.lv > 1) v *= 1.25;
        if (v > bv) { bv = v; best = r; }
      });
      if (!best) break;
      var cst = TT.unitCost(p.race, best); p.res = P.addC(p.res, cst, -1); spent += TT.costSum(cst); counts[best] = (counts[best] || 0) + 1; used += TT.ROLES[best].pop;
    }
    // chia thành đội
    var z = ctx.zone;
    TT.ROLE_ORDER.forEach(function (r) {
      var n = counts[r] || 0;
      while (n > 0) {
        var k = Math.min(n, SQ_MAX[r]); if (n - k > 0 && n - k < 3 && r !== 'thanthu') k = n; // tránh đội lẻ quá nhỏ
        var pos = P.freeNear(p, z, z.x0 + 12, z.y0 + 6) || [z.x0, z.y0];
        p.squads.push({ id: p.nid++, t: r, n: k, x: pos[0], y: pos[1], st: (r === 'thichkhach' || r === 'ky') ? 'san' : 'tc', it: [], fl: [] });
        n -= k;
      }
    });
    // trang bị cho đội trưởng các đội lớn/mạnh
    var order = p.squads.slice().sort(function (a, b) { return squadVal(b) - squadVal(a) || a.id - b.id; });
    var tiers = TT.ITEM_ORDER.filter(function (k) { return TT.ITEMS[k].tier <= p.lv; }).sort(function (a, b) { return TT.ITEMS[b].tier - TT.ITEMS[a].tier || TT.costSum(TT.ITEMS[b].cost) - TT.costSum(TT.ITEMS[a].cost); });
    if (L.aura) order.forEach(function (q) { if (q.n < 6) return; var au = tiers.filter(function (k) { return TT.ITEMS[k].aura; }); for (var ai = 0; ai < au.length && q.it.length < slots; ai++) { var I0 = TT.ITEMS[au[ai]]; if (q.it.indexOf(au[ai]) >= 0 || p.res.V < I0.cost.V || p.res.T < I0.cost.T || p.res.G < I0.cost.G) continue; p.res = P.addC(p.res, I0.cost, -1); q.it.push(au[ai]); } });
    var slots = P.itemSlots(p), giveN = Math.ceil(order.length * L.items);
    for (var oi = 0; oi < Math.min(order.length, giveN); oi++) {
      var q = order[oi];
      for (var s = q.it.length; s < slots; s++) {
        var pick = null;
        for (var ti = 0; ti < tiers.length; ti++) {
          var I = TT.ITEMS[tiers[ti]];
          if (p.res.V < I.cost.V || p.res.T < I.cost.T || p.res.G < I.cost.G) continue;
          if (q.it.indexOf(tiers[ti]) >= 0) continue;
          if (!itemFits(tiers[ti], q.t)) continue;
          pick = tiers[ti]; break;
        }
        if (!pick) break;
        p.res = P.addC(p.res, TT.ITEMS[pick].cost, -1); q.it.push(pick);
      }
    }
    // dùng nốt tài nguyên dư để mua quân rẻ nếu còn chỗ
    var g2 = 0;
    while (!L.sloppy && g2++ < 60) {
      var free2 = cap - P.usedPop(p); if (free2 <= 0) break;
      var r2 = ['linh', 'cung', 'thuan'].filter(function (r) { var c = TT.unitCost(p.race, r); return p.res.V >= c.V && p.res.T >= c.T && p.res.G >= c.G; })[0];
      if (!r2) break;
      var sq = p.squads.filter(function (q) { return q.t === r2; })[0];
      p.res = P.addC(p.res, TT.unitCost(p.race, r2), -1);
      if (sq) sq.n++; else { var pos2 = P.freeNear(p, z, z.x0 + 12, z.y0 + 6); if (!pos2) break; p.squads.push({ id: p.nid++, t: r2, n: 1, x: pos2[0], y: pos2[1], st: 'tc', it: [], fl: [] }); }
    }
    if (!L.sloppy) P.apply(p, { c: 'auto' }, ctx);
    // cờ: kỵ/thích khách đi vòng sườn (trung bình/khó)
    if (L.flags) {
      var side = p.side, cx = (ctx.W - 1) >> 1, cy = (ctx.H - 1) >> 1, flip = 0;
      p.squads.forEach(function (q) {
        if (q.t !== 'ky' && q.t !== 'thichkhach') return;
        var lat = (flip++ % 2 ? 1 : -1) * (ctx.mode === 2 ? 14 : 18);
        var a1 = TT.rotPoint(ctx.mode, side, Math.max(1, Math.min(ctx.W - 2, cx + lat)), cy + 4), a2 = TT.rotPoint(ctx.mode, side, cx, cy);
        var fl = [{ c: 'X', x: a1[0], y: a1[1] }];
        if (P.flagSteps(p) >= 2) fl.push({ c: 'D', x: a2[0], y: a2[1] });
        if (!P.validFlags(p, q, fl, ctx)) q.fl = fl;
      });
      // thuật sĩ đi sát đội tiền tuyến lớn nhất
      var front = p.squads.filter(function (q) { return q.t === 'linh' || q.t === 'thuan'; }).sort(function (a, b) { return b.n - a.n; })[0];
      if (front) p.squads.forEach(function (q) { if (q.t === 'y' || q.t === 'chihuy') { var fl2 = [{ c: 'V', sq: front.id, k: q.t === 'y' ? 'theo' : 'sat' }]; if (!P.validFlags(p, q, fl2, ctx)) q.fl = fl2; } });
    }
    return { squads: p.squads, inv: p.inv, res: p.res, nid: p.nid };
  }
  function squadVal(q) { var R = TT.ROLES[q.t]; return R.pop * q.n * (R.unique ? 3 : 1) + (R.cls === 'can' ? 2 : 0); }
  function itemFits(k, role) {
    var I = TT.ITEMS[k], st = I.st || {}, R = TT.ROLES[role];
    if (role === 'y' || role === 'chihuy') return !st.atk && !st.crit;
    if (R.cls === 'can' && (role === 'thuan' || role === 'tuong')) return !st.crit && !st.asPct;
    if (k === 'ngoc' || k === 'truonglinh') return role === 'phapsu' || role === 'congthanh' || role === 'thanthu';
    return true;
  }
  /* Bot Khó: thử đạo quân bằng mô phỏng thật với đội hình hiện tại của đối thủ */
  function simEval(M, p, cand) {
    var inp = TT.Match.battleInput(M);
    inp.players.forEach(function (x) { if (x.seat === p.seat) { x.squads = P.clone(cand.squads); x.cores = p.cores.slice(); x.lv = p.lv; } });
    if (!inp.players.some(function (x) { return x.seat !== p.seat && x.squads.length; })) return 0;
    var B = TT.Battle.create(inp), res = B.run(20 * 90);
    var me = res.players.filter(function (x) { return x.seat === p.seat; })[0];
    return -me.rank * 10000 + me.hp + me.kills * 50 + me.dmg / 10;
  }

  /* Tạo gói đội hình cho bot (áp lên bản sao p0 rồi đóng gói) */
  Bot.makePackage = function (M, seat, level) {
    var p0 = TT.Match.player(M, seat), p = P.clone(p0);
    var r = Bot.plan(M, p, level, {});
    return P.makePackage(p, r.cry);
  };
  if (typeof module !== 'undefined') module.exports = Bot;
})(typeof window !== 'undefined' ? window : global);
