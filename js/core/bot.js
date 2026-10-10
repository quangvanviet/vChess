/* vChess 2.0 — Bot chuẩn bị đội hình (Dễ / Trung bình / Khó). Xác định theo seed. */
(function (G) {
  'use strict';
  var TT = G.TT, CFG = TT.CONFIG, P = TT.Prep;
  var Bot = TT.Bot = {};
  Bot.LEVELS = {
    easy: { name: 'Dễ', ageDay: [0, 1, 5, 9, 99], items: .2, coreTier: 2, coreMax: 1, noise: 60, sim: 0, flags: 0, save: [], spend: .8, sloppy: 1, popRate: .25 },
    medium: { name: 'Trung bình', ageDay: [0, 1, 4, 6, 9], items: .7, coreTier: 3, coreMax: 3, noise: 15, sim: 0, flags: 1, save: [0, 0, 10, 10, 10, 10, 10, 10, 0, 0], popRate: .5 },
    hard: { name: 'Khó', ageDay: [0, 1, 4, 6, 9], items: .75, coreTier: 4, coreMax: 3, noise: 0, sim: 5, flags: 1, save: [0, 0, 0, 10, 10, 10, 10, 0, 0, 0], aura: 1, popRate: .7 }
  };
  Bot.levelName = function (lv) { return (Bot.LEVELS[lv] || Bot.LEVELS.medium).name; };

  /* Thiết lập ngẫu nhiên cho bot (tộc, thiên phú, trang bị khởi đầu) theo seed + ghế */
  Bot.loadout = function (seed, seat) {
    var h = TT.hash32(seed, 'bot', seat), race = TT.FACTION_ORDER[h % TT.FACTION_ORDER.length];
    var tal = TT.TALENTS[race][(h >>> 3) % 3].id, start = ['gold', 'food', 'wood'][(h >>> 6) % 3];
    var ml = TT.MARSHAL_LIST;
    return { race: race, talent: tal, start: start, mar: ml[(h >>> 9) % ml.length] };
  };

  // trọng số thành phần quân theo tộc
  var MIX = {
    dragon: { linh: 4, thuan: 2.5, cung: 2.5, y: 1, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1, tuong: 1.2, thanthu: 1 },
    human: { linh: 4, thuan: 2.5, cung: 3, y: 1.2, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1.2, tuong: 1, thanthu: 1 },
    fairy: { linh: 2.5, thuan: 2.5, cung: 4, y: 1.2, ky: 1.5, chihuy: 1, thichkhach: 1.2, phapsu: 2, congthanh: 1, tuong: 1, thanthu: 1 },
    beast: { linh: 4, thuan: 2.5, cung: 2.5, y: 1.5, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1, tuong: 1.2, thanthu: 1 },
    demon: { linh: 5, thuan: 2, cung: 2.5, y: 1.2, ky: 1.5, chihuy: 1, thichkhach: 1, phapsu: 1.5, congthanh: 1, tuong: 1, thanthu: 1 }
  };
  var SQ_MAX = { linh: 10, thuan: 8, cung: 8, y: 4, ky: 6, chihuy: 2, thichkhach: 4, phapsu: 5, congthanh: 3, tuong: 2, thanthu: 1 };
  var MAXCOUNT = { y: 4, chihuy: 2, thanthu: 1 };

  function score(rng, noise) { return noise ? (rng() % (noise * 2 + 1)) - noise : 0; }

  /* Lên kế hoạch cả ngày cho bot: áp lên p, trả {log: lệnh kinh tế để đóng gói} */
  Bot.plan = function (M, p, level, opts) {
    var L = Bot.LEVELS[level] || Bot.LEVELS.medium, ctx = TT.Match.ctx(M, p), rng = TT.mulberry(TT.hash32(M.seed, 'botplan', p.seat, M.day));
    var log = [];
    function econ(c) { var r = P.apply(p, c, ctx); if (r.ok && r.log) log = log.concat(r.log); return r; }
    // 0) bán (ảo) toàn bộ quân: Vàng = Vàng còn + giá trị quân; gom trang bị của tướng vào kho tạm
    p.gold += P.armyValue(p);
    var pool = []; p.squads.forEach(function (q) { pool = pool.concat(q.it); });
    var mar = P.marshal(p); if (mar) mar.it = []; p.squads = mar ? [mar] : [];   // Nguyên soái luôn ở lại (không bán được)
    var last = M.day >= CFG.days, reserve = last ? 0 : Math.min(L.save[M.day] || 0, Math.floor(p.gold * .25));
    // 1) lên Đời theo lịch
    var want = 1; for (var a = 1; a <= 4; a++) if (M.day >= L.ageDay[a]) want = a;
    var guard = 0;
    while (p.lv < want && p.gold >= CFG.xpBuyCost + 4 && guard++ < 12) econ({ c: 'xp' });
    // 1b) mua dân (nới Sức chứa) theo nhịp của từng cấp bot
    var popTarget = Math.min(CFG.popBuy.max, Math.floor(M.day * L.popRate));
    guard = 0;
    while (p.pop < popTarget && p.gold >= P.popPrice(p) + 10 + M.day && guard++ < 6) econ({ c: 'pop' });
    // 2) Lõi
    var mixShare = shareOf(p.race, p.lv);
    for (var tries = 0; tries < 3; tries++) {
      if (p.cores.length >= L.coreMax || P.invFree(p) <= 0) break;
      var best = -1, bv = 0;
      p.board.forEach(function (id, i) {
        if (!id) return; var C = TT.CORES[id]; if (C.tier > L.coreTier) return;
        var cost = CFG.corePrice[C.tier]; if (p.gold - cost < reserve + 6 + M.day * 2) return;
        var v = coreValue(C, mixShare, p, M.day) + score(rng, L.noise / 10);
        if (v > bv) { bv = v; best = i; }
      });
      if (best >= 0 && bv >= 2) econ({ c: 'core', slot: best });
      else if (L.sim && p.gold >= reserve + 30 && tries === 0) econ({ c: 'reroll' });
      else break;
    }
    // 3) quân + trang bị: thử vài phương án, chọn bằng mô phỏng (Khó)
    var nCand = L.sim ? L.sim : 1, candidates = [];
    for (var k = 0; k < nCand; k++) candidates.push(buildArmy(p, pool, ctx, L, rng, k, reserve));
    var pick = candidates[0];
    if (candidates.length > 1 && (!opts || opts.simulate !== false)) {
      var bestS = -1e18;
      candidates.forEach(function (cand) { var s = simEval(M, p, cand); if (s > bestS) { bestS = s; pick = cand; } });
    }
    // áp phương án: mua trang bị mới (ghi log), gắn cho tướng, phần thừa vào tủ, quá tủ thì bán
    pick.buy.forEach(function (it) { var sl = p.ishop.indexOf(it); if (sl >= 0) econ({ c: 'buyItem', slot: sl }); });
    p.squads = pick.squads; p.nid = pick.nid;
    var msh = P.marshal(p); if (msh) { var sl2 = P.summonList(p), pref = ['cung', 'linh', 'thuan'].filter(function (r) { return sl2.indexOf(r) >= 0; }); msh.sm = pref[(+p.seat + M.day) % pref.length] || 'linh'; msh.st = 'rut'; }
    p.gold -= P.armyValue(p);
    var all = pool.concat(p.inv); p.inv = [];
    var order = p.squads.slice().sort(function (x, y) { return squadVal(y) - squadVal(x) || x.id - y.id; });
    all.sort(function (x, y) { return TT.ITEMS[y].tier - TT.ITEMS[x].tier || (x < y ? -1 : 1); });
    all.forEach(function (it) {
      var q = null; for (var i = 0; i < order.length; i++) { var o = order[i]; if (o.it.length < CFG.genItems && o.it.indexOf(it) < 0 && itemFits(it, o.t)) { q = o; break; } }
      if (!q) for (var j = 0; j < order.length; j++) if (order[j].it.length < CFG.genItems) { q = order[j]; break; }
      if (q && (L.items >= .5 || q === order[0])) q.it.push(it); else p.inv.push(it);
    });
    while (P.invUsed(p) > CFG.invSize && p.inv.length) econ({ c: 'sellItem', idx: p.inv.length - 1 });
    // 3b) Vàng dư (thường do hết Sức chứa) → nâng cấp lính cho các đạo quân đông nhất, nâng đều các chỉ số
    if (!L.sloppy) {
      var ups = p.squads.filter(function (q) { return !TT.ROLES[q.t].unique && q.n >= 5; }).sort(function (x, y) { return y.n * TT.unitCost(p.race, y.t) - x.n * TT.unitCost(p.race, x.t) || x.id - y.id; });
      guard = 0;
      while (ups.length && guard++ < 160) {
        var done = false;
        for (var ui = 0; ui < ups.length && !done; ui++) {
          var uq = ups[ui], ord = TT.ROLES[uq.t].cls === 'can' ? [0, 2, 1, 3] : [1, 3, 0, 2], lvs = uq.up || [0, 0, 0, 0], bi = -1;
          ord.forEach(function (si) { if ((lvs[si] | 0) < CFG.solUp.max && (bi < 0 || (lvs[si] | 0) < (lvs[bi] | 0))) bi = si; });
          if (bi >= 0 && p.gold - CFG.solUp.cost[lvs[bi] | 0] >= reserve + 2) done = P.apply(p, { c: 'solUp', sq: uq.id, k: bi, d: 1 }, ctx).ok;
        }
        if (!done) break;
      }
    }
    if (!L.sloppy) P.apply(p, { c: 'auto' }, ctx);
    if (L.flags) { setFlags(p, ctx); setForms(p); }
    return { log: log };
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
    if (C.fx.towerX2 || C.fx.hillAtk) rel *= .5;
    return base * rel - CFG.corePrice[C.tier] * .5;
  }
  /* Dựng đạo quân từ ngân sách Vàng: chọn binh chủng theo tỉ lệ, mỗi đạo = 1 tướng + lính */
  function buildArmy(p0, pool, ctx, L, rng, variant, reserve) {
    var p = P.clone(p0); p.squads = p0.squads.filter(function (q) { return TT.ROLES[q.t].marshal; }).map(function (q) { return P.clone(q); });
    var mx = {}; for (var r in MIX[p.race]) mx[r] = MIX[p.race][r];
    if (variant === 1) { mx.cung *= 1.6; mx.phapsu *= 1.6; mx.linh *= .7; }
    if (variant === 2) { mx.linh *= 1.4; mx.thuan *= 1.4; mx.ky *= 1.5; mx.cung *= .7; }
    if (variant === 3) { mx.thuan *= 1.8; mx.y *= 2; mx.cung *= 1.2; mx.linh *= .6; }
    if (variant === 4) { mx.ky *= 2; mx.thichkhach *= 2; mx.tuong *= 1.5; mx.cung *= .8; }
    var cap = P.capacity(p), counts = {}, gold = Math.max(0, p.gold - reserve);
    var itemShare = (p.lv >= 2 ? L.items * (.08 + p.lv * .04) : L.items * .04);
    var unitBudget = Math.floor(gold * (1 - itemShare) * (L.spend || 1)), spent = 0, used = 0, guard = 0, z = ctx.zone;
    function squadOf(role) { var best = null; p.squads.forEach(function (q) { if (q.t === role && q.n < SQ_MAX[role] && (!best || q.n < best.n)) best = q; }); return best; }
    while (guard++ < 300) {
      var free = cap - used; if (free <= 0) break;
      var best = null, bv = -1e9, bGen = false;
      TT.ROLE_ORDER.forEach(function (r) {
        var R = TT.ROLES[r]; if (R.age > p.lv || R.pop > free) return;
        var sq = R.unique ? null : squadOf(r), gen = !sq;
        if (gen && MAXCOUNT[r] && p.squads.filter(function (q) { return q.t === r; }).length >= MAXCOUNT[r]) return;
        var c = gen ? TT.genCost(p.race, r) : TT.unitCost(p.race, r);
        if (spent + c > unitBudget) return;
        var have = (counts[r] || 0) * R.pop, v = mx[r] * 10 / (have + R.pop) + score(rng, L.noise / 10) * .3;
        if (R.age === p.lv && p.lv > 1) v *= 1.25;
        if (gen && have > 0) v *= .8;
        if (v > bv) { bv = v; best = r; bGen = gen; }
      });
      if (!best) break;
      if (bGen) {
        var pos = P.freeNear(p, z, (z.x0 + z.x1) >> 1, (z.y0 + z.y1) >> 1); if (!pos) break;
        p.squads.push({ id: p.nid++, t: best, n: 1, x: pos[0], y: pos[1], st: (best === 'thichkhach' || best === 'ky') ? 'san' : 'tc', it: [], fl: [] });
        spent += TT.genCost(p.race, best);
      } else { squadOf(best).n++; spent += TT.unitCost(p.race, best); }
      counts[best] = (counts[best] || 0) + 1; used += TT.ROLES[best].pop;
    }
    // trang bị: mua món tốt nhất vừa túi cho các tướng mạnh
    var left = gold - spent, buy = [], have = pool.concat(p.inv).length;
    var slotsWanted = Math.min(p.squads.length * CFG.genItems, Math.ceil(p.squads.length * CFG.genItems * L.items));
    var space = P.invFree(p) - p.inv.length * 0;
    var tiers = TT.ITEM_ORDER.filter(function (k) { return p.ishop.indexOf(k) >= 0; }).sort(function (a, b) { return TT.ITEMS[b].tier - TT.ITEMS[a].tier || (TT.ITEMS[b].aura ? 1 : 0) - (TT.ITEMS[a].aura ? 1 : 0) || (a < b ? -1 : 1); });
    var gi = 0;
    while (have + buy.length < slotsWanted && space > buy.length && gi++ < 30) {
      var pickI = null;
      for (var ti = 0; ti < tiers.length; ti++) { var I = TT.ITEMS[tiers[ti]]; if (I.price <= left && (L.aura || !I.aura || ti % 2 === 0) && buy.indexOf(tiers[ti]) < 0) { pickI = tiers[ti]; break; } }
      if (!pickI) for (var t2 = 0; t2 < tiers.length; t2++) if (TT.ITEMS[tiers[t2]].price <= left) { pickI = tiers[t2]; break; }
      if (!pickI) break;
      buy.push(pickI); left -= TT.ITEMS[pickI].price;
    }
    // Vàng thừa: thêm lính rẻ nếu còn chỗ
    var g2 = 0;
    while (!L.sloppy && g2++ < 60 && left > 0) {
      var free2 = cap - P.usedPop(p); if (free2 <= 0) break;
      var tgt = p.squads.filter(function (q) { var R = TT.ROLES[q.t]; return !R.unique && R.pop <= free2 && TT.unitCost(p.race, q.t) <= left; }).sort(function (a, b) { return a.n - b.n || a.id - b.id; })[0];
      if (!tgt) break;
      tgt.n++; left -= TT.unitCost(p.race, tgt.t);
    }
    return { squads: p.squads, nid: p.nid, buy: buy };
  }
  /* Bot trung bình/khó chọn đội hình theo binh chủng */
  function setForms(p) {
    var FM = { ky: ['non', 4], thichkhach: ['non', 4], cung: ['cung', 7], phapsu: ['cung', 7], congthanh: ['ngang', 7], linh: ['ngang', 4], thuan: ['ngang', 1], tuong: ['non', 1] };
    p.squads.forEach(function (q) { var f = FM[q.t]; if (f && q.n >= 4) { q.fm = f[0]; q.lp = f[1]; } });
  }
  function setFlags(p, ctx) {
    var side = p.side, cx = (ctx.W - 1) >> 1, cy = (ctx.H - 1) >> 1, flip = 0;
    p.squads.forEach(function (q) {
      if (q.t !== 'ky' && q.t !== 'thichkhach') return;
      var lat = (flip++ % 2 ? 1 : -1) * (ctx.mode === 2 ? 14 : 18);
      var a1 = TT.rotPoint(ctx.mode, side, Math.max(1, Math.min(ctx.W - 2, cx + lat)), cy + 4), a2 = TT.rotPoint(ctx.mode, side, cx, cy);
      var fl = [{ c: 'X', x: a1[0], y: a1[1] }];
      fl.push({ c: 'D', x: a2[0], y: a2[1] });
      if (!P.validFlags(p, q, fl, ctx)) q.fl = fl;
    });
    var front = p.squads.filter(function (q) { return q.t === 'linh' || q.t === 'thuan'; }).sort(function (a, b) { return b.n - a.n; })[0];
    if (front) p.squads.forEach(function (q) { if (q.t === 'y' || q.t === 'chihuy') { var fl2 = [{ c: 'V', sq: front.id, k: q.t === 'y' ? 'theo' : 'sat' }]; if (!P.validFlags(p, q, fl2, ctx)) q.fl = fl2; } });
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
    // trang bị dự kiến: gắn tạm món mua cho tướng mạnh nhất để ước lượng
    inp.players.forEach(function (x) { if (x.seat === p.seat && cand.buy.length && x.squads.length) { var o = x.squads.slice().sort(function (a, b) { return squadVal(b) - squadVal(a); }); cand.buy.forEach(function (it, i) { var q = o[Math.floor(i / CFG.genItems) % o.length]; if (q.it.length < CFG.genItems) q.it.push(it); }); } });
    if (!inp.players.some(function (x) { return x.seat !== p.seat && x.squads.length; })) return 0;
    var B = TT.Battle.create(inp), res = B.run(20 * 90);
    var me = res.players.filter(function (x) { return x.seat === p.seat; })[0];
    return -me.rank * 10000 + me.hp + me.kills * 50 + me.dmg / 10;
  }

  /* Tạo gói đội hình cho bot (áp lên bản sao p0 rồi đóng gói) */
  Bot.makePackage = function (M, seat, level) {
    var p0 = TT.Match.player(M, seat), p = P.clone(p0);
    var r = Bot.plan(M, p, level, {});
    return P.makePackage(p, r.log);
  };
  if (typeof module !== 'undefined') module.exports = Bot;
})(typeof window !== 'undefined' ? window : global);
