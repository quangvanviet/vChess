/* Tứ Tộc Kỳ Chiến 2.0 — logic giai đoạn Chuẩn bị (thuần, xác định). Một loại tiền: Vàng. Mỗi đạo quân = 1 tướng + lính cùng binh chủng. */
(function (G) {
  'use strict';
  var TT = G.TT, CFG = TT.CONFIG;
  var P = TT.Prep = {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  P.clone = clone;
  
  /* ---------- người chơi ---------- */
  P.newPlayer = function (o) {
    // o: {seat, name, race, talent, start(gold|food|wood), bot}
    var p = {
      seat: String(o.seat), name: o.name, race: o.race, talent: o.talent || TT.TALENTS[o.race][0].id, mar: TT.marshalOf(o.race, o.mar).id, bot: o.bot || null,
      gold: 0, xp: 0, lv: 1,
      squads: [], inv: [], cores: [], board: [null, null, null, null, null], locks: [0, 0, 0, 0, 0], rr: 0, freeRr: 0, rrIdx: 0, nid: 1,
      pop: 0, ishop: [null, null, null, null, null, null], irIdx: 0, freeIr: 0,
      out: 0
    };
    p.squads.push({ id: p.nid++, t: 'nguyensoai', n: 1, x: 0, y: 0, st: 'tc', fm: 'khoi', lp: 4, it: [], fl: [], up: [0, 0, 0, 0], sm: 'linh' });
    p.inv.push(TT.START_ITEMS[o.start] || 'kiem');
    return p;
  };
  P.capacity = function (p) {
    var c = CFG.capacity[p.lv] + (p.pop | 0) * CFG.popBuy.amount + P.hasCoreFx(p, 'capAdd');
    if (p.race === 'human') c += CFG.humanCapBonus[p.lv] + (p.talent === 'quanluong' ? 2 : 0);
    return c;
  };
  P.usedPop = function (p) { var s = 0; p.squads.forEach(function (q) { s += q.n * TT.ROLES[q.t].pop; }); return s; };
  P.invUsed = function (p) { return p.inv.length + p.cores.length; };
  P.invFree = function (p) { return CFG.invSize - P.invUsed(p); };
  P.hasCoreFx = function (p, k) { var s = 0; p.cores.forEach(function (c) { var f = TT.CORES[c].fx; if (f[k]) s += f[k] === true ? 1 : f[k]; }); return s; };
  P.flagSteps = function () { return CFG.flagMax; };
  /* Mua dân: giá tăng dần theo số lần đã mua */
  P.popPrice = function (p) { var B = CFG.popBuy; return B.base + Math.floor((p.pop | 0) / B.every) * B.step; };
  P.popLeft = function (p) { return CFG.popBuy.max - (p.pop | 0); };
  P.xpNeed = function (p) { return p.lv >= 4 ? 0 : CFG.xpToNext[p.lv]; };
  function gainXp(p, n) { p.xp += n; while (p.lv < 4 && p.xp >= CFG.xpToNext[p.lv]) { p.xp -= CFG.xpToNext[p.lv]; p.lv++; } if (p.lv >= 4) p.xp = 0; }
  P.unitUnlocked = function (p, role) { return TT.ROLES[role].age <= p.lv; };
  P.upCost = function (q) { var U = CFG.solUp, s = 0; (q.up || []).forEach(function (lv) { for (var i = 0; i < lv; i++) s += U.cost[i]; }); return s; };
  P.squadCost = function (p, q) { return TT.genCost(p.race, q.t) + (q.n - 1) * TT.unitCost(p.race, q.t) + P.upCost(q); };
  /* Giá trị quân trên sân (Vàng) — dùng kiểm tra ngân sách khi mở gói đội hình */
  P.armyValue = function (p) { var s = 0; p.squads.forEach(function (q) { s += P.squadCost(p, q); }); return s; };
  P.interest = function (p) { return Math.min(CFG.interestMax + P.hasCoreFx(p, 'interestAdd'), Math.floor(Math.max(0, p.gold) / CFG.interestPer)); };
  P.squadAt = function (p, x, y) { for (var i = 0; i < p.squads.length; i++) if (p.squads[i].x === x && p.squads[i].y === y) return p.squads[i]; return null; };
  P.marshal = function (p) { for (var i = 0; i < p.squads.length; i++) if (TT.ROLES[p.squads[i].t].marshal) return p.squads[i]; return null; };
  /* lính Nguyên soái có thể triệu hồi theo Đời hiện tại */
  P.summonList = function (p) { return TT.ROLE_ORDER.filter(function (r) { return CFG.marshal.summon[r] && TT.ROLES[r].age <= p.lv; }); };
  P.squadById = function (p, id) { for (var i = 0; i < p.squads.length; i++) if (p.squads[i].id === id) return p.squads[i]; return null; };

  /* ---------- bảng Lõi ---------- */
  function rollBoard(p, ctx) {
    var rng = TT.mulberry(TT.hash32(ctx.seed, 'core', p.seat, ctx.day, p.rrIdx)), w = TT.CORE_WEIGHTS[p.lv];
    p.rrIdx++;
    var taken = {}; p.cores.forEach(function (c) { taken[c] = 1; }); p.board.forEach(function (c, i) { if (c && p.locks[i]) taken[c] = 1; });
    for (var i = 0; i < CFG.coreBoard; i++) {
      if (p.locks[i] && p.board[i]) continue;
      var r = rng() % 100, tier = 1, acc = 0;
      for (var t = 0; t < 4; t++) { acc += w[t]; if (r < acc) { tier = t + 1; break; } }
      var pool = TT.CORE_ORDER.filter(function (id) { var c = TT.CORES[id]; if (taken[id] || c.tier !== tier) return false; if (/^race:/.test(c.scope) && c.scope.slice(5) !== p.race) return false; return true; });
      if (!pool.length) pool = TT.CORE_ORDER.filter(function (id) { var c = TT.CORES[id]; return !taken[id] && c.tier <= Math.max(1, tier) && (!/^race:/.test(c.scope) || c.scope.slice(5) === p.race); });
      var pick = pool.length ? pool[rng() % pool.length] : null;
      p.board[i] = pick; p.locks[i] = 0; if (pick) taken[pick] = 1;
    }
  }
  P.rollBoard = rollBoard;

  /* ---------- cửa hàng trang bị: ngẫu nhiên theo ngày, tỉ lệ bậc khác nhau mỗi ngày ---------- */
  function rollItems(p, ctx) {
    var rng = TT.mulberry(TT.hash32(ctx.seed, 'item', p.seat, ctx.day, p.irIdx)), w = TT.ITEM_DAY_W[Math.min(ctx.day, CFG.days)] || TT.ITEM_DAY_W[1];
    p.irIdx++;
    var ww = w.map(function (v, i) { return i + 1 > p.lv ? 0 : v; }), tot = ww.reduce(function (a, b) { return a + b; }, 0), taken = {};
    for (var i = 0; i < CFG.itemBoard; i++) {
      var r = rng() % tot, tier = 1, acc = 0;
      for (var t = 0; t < 4; t++) { acc += ww[t]; if (r < acc) { tier = t + 1; break; } }
      var pool = TT.ITEM_ORDER.filter(function (k) { return TT.ITEMS[k].tier === tier && !taken[k]; });
      if (!pool.length) pool = TT.ITEM_ORDER.filter(function (k) { return TT.ITEMS[k].tier === tier; });
      var pick = pool[rng() % pool.length]; taken[pick] = 1; p.ishop[i] = pick;
    }
  }
  P.rollItems = rollItems;

  /* ---------- đầu ngày: nhận Vàng (+lãi), EXP; Đời, quân, đồ, Lõi giữ nguyên ---------- */
  P.dayStart = function (p, ctx) {
    var d = ctx.day, inc = CFG.goldIncome[d] || 0;
    var interest = d > 1 ? P.interest(p) : 0, core = d > 1 ? P.hasCoreFx(p, 'goldDaily') : 0;
    p.lastIncome = { base: inc, interest: interest, core: core, event: ctx.event === 'vanmay' ? 5 : 0 };
    p.gold += inc + interest + core + p.lastIncome.event;
    if (d > 1) gainXp(p, CFG.xpDaily);
    p.rr = 0; p.freeRr = CFG.freeRerolls + P.hasCoreFx(p, 'freeReroll');
    p.freeIr = CFG.freeItemRerolls;
    rollBoard(p, ctx); rollItems(p, ctx);
  };

  /* ---------- lệnh chuẩn bị ----------
     Mọi lệnh trả {ok, err, log}. "log" là các lệnh KINH TẾ (tiêu/nhận Vàng ngoài quân lính: EXP, trang bị, Lõi, đổi bảng)
     cần gửi đi để máy khác phát lại. Quân lính được kiểm bằng ngân sách nên không cần ghi. */
  P.ECON = { xp: 1, pop: 1, ireroll: 1, buyItem: 1, sellItem: 1, core: 1, sellCore: 1, reroll: 1, lock: 1 };
  function pay(p, n, ctx) { if (!ctx.replay && p.gold < n) return false; p.gold -= n; return true; }
  P.apply = function (p, c, ctx) {
    var z = ctx.zone, err = function (m) { return { ok: false, err: m }; }, rp = !!ctx.replay;
    switch (c.c) {
      case 'buyGen': {
        var role = c.t, R = TT.ROLES[role];
        if (!R) return err('Không có binh chủng này');
        if (!P.unitUnlocked(p, role)) return err('Cần Đời ' + TT.AGE_ROMAN[R.age] + ' để mua tướng ' + TT.unitName(p.race, role));
        if (!TT.inZone(z, c.x, c.y)) return err('Chỉ đặt tướng trong vùng xuất quân của bạn');
        if (P.squadAt(p, c.x, c.y)) return err('Chỗ này đã có đạo quân khác');
        if (R.unique && p.squads.some(function (s) { return s.t === role; })) return err('Mỗi người chỉ có 1 Thần thú');
        if (P.capacity(p) - P.usedPop(p) < R.pop) return err('Hết Sức chứa — lên Đời để chứa thêm quân');
        if (!pay(p, TT.genCost(p.race, role), ctx)) return err('Không đủ Vàng');
        var q = { id: p.nid++, t: role, n: 1, x: c.x, y: c.y, st: 'tc', fm: 'khoi', lp: 4, it: [], fl: [], up: [0, 0, 0, 0] }; p.squads.push(q);
        return { ok: true, sq: q.id };
      }
      case 'buySol': {
        var g = P.squadById(p, c.sq); if (!g) return err('Lính phải nhập vào đạo quân của một tướng');
        var RS = TT.ROLES[g.t], k = Math.max(1, c.k | 0);
        if (RS.unique) return err(RS.marshal ? 'Nguyên soái không mua lính — hãy chọn lính để triệu hồi' : TT.unitName(p.race, g.t) + ' không có lính');
        k = Math.min(k, Math.floor((P.capacity(p) - P.usedPop(p)) / RS.pop));
        if (k <= 0) return err('Hết Sức chứa — lên Đời để chứa thêm quân');
        var cs = TT.unitCost(p.race, g.t); k = Math.min(k, Math.floor(p.gold / cs));
        if (k <= 0) return err('Không đủ Vàng');
        p.gold -= k * cs; g.n += k;
        return { ok: true, sq: g.id, n: k };
      }
      case 'sell': {
        var s = P.squadById(p, c.sq); if (!s) return err('Không thấy đạo quân');
        if (TT.ROLES[s.t].marshal) return err('Không thể bán Nguyên soái');
        var kk = c.k == null ? s.n : c.k | 0;
        if (kk < s.n) { // bán lính
          kk = Math.max(1, Math.min(kk, s.n - 1));
          p.gold += kk * TT.unitCost(p.race, s.t); s.n -= kk; return { ok: true, n: kk };
        }
        // bán cả tướng: hoàn 100% giá tướng + lính + mọi trang bị đang đeo trên tướng
        p.gold += P.squadCost(p, s);
        var log = [];
        s.it.forEach(function (it) { p.gold += TT.ITEMS[it].price; log.push({ c: 'sellItem', it: it }); });
        s.it = []; removeSquad(p, s);
        return { ok: true, all: 1, log: log };
      }
      case 'move': {
        var m = P.squadById(p, c.sq); if (!m) return err('Không thấy đạo quân');
        if (!TT.inZone(z, c.x, c.y)) return err('Chỉ đặt quân trong vùng xuất quân của bạn');
        var o = P.squadAt(p, c.x, c.y);
        if (o && o !== m) { o.x = m.x; o.y = m.y; m.x = c.x; m.y = c.y; return { ok: true, swap: o.id }; }
        m.x = c.x; m.y = c.y; return { ok: true };
      }
      case 'solUp': { // nâng cấp (d=1) hoặc hạ cấp hoàn tiền (d=-1) một chỉ số của lính trong đạo quân
        var uq = P.squadById(p, c.sq), U = CFG.solUp, si = c.k | 0; if (!uq) return err('Không thấy đạo quân');
        if (TT.ROLES[uq.t].unique) return err(TT.unitName(p.race, uq.t) + ' không có lính để nâng cấp');
        if (!(si >= 0 && si < U.stats.length)) return err('Chỉ số không hợp lệ');
        if (!uq.up) uq.up = [0, 0, 0, 0];
        var lvU = uq.up[si] | 0;
        if (c.d === -1) { if (lvU <= 0) return err('Chưa nâng cấp'); uq.up[si] = lvU - 1; p.gold += U.cost[lvU - 1]; return { ok: true, sq: uq.id }; }
        if (lvU >= U.max) return err('Đã nâng tối đa');
        if (!pay(p, U.cost[lvU], ctx)) return err('Không đủ Vàng');
        uq.up[si] = lvU + 1; return { ok: true, sq: uq.id, lv: lvU + 1 };
      }
      case 'summon': { // chọn loại lính Nguyên soái sẽ triệu hồi
        var ms = P.squadById(p, c.sq); if (!ms || !TT.ROLES[ms.t].marshal) return err('Chỉ Nguyên soái mới triệu hồi');
        if (!CFG.marshal.summon[c.r]) return err('Không triệu hồi được loại này');
        if (!P.unitUnlocked(p, c.r)) return err('Cần Đời ' + TT.AGE_ROMAN[TT.ROLES[c.r].age] + ' để triệu hồi ' + TT.unitName(p.race, c.r));
        ms.sm = c.r; return { ok: true };
      }
      case 'stance': { var st = P.squadById(p, c.sq); if (!st || !TT.STANCES[c.s]) return err('Chiến thuật không hợp lệ'); st.st = c.s; return { ok: true }; }
      case 'formation': {
        var fz = P.squadById(p, c.sq); if (!fz) return err('Không thấy đạo quân');
        if (c.fm != null) { if (!TT.FORMATIONS[c.fm]) return err('Đội hình không hợp lệ'); fz.fm = c.fm; fz.cu = null; } // chọn lại hình mẫu = bỏ vị trí tự kéo
        if (c.lp != null) { if (!(c.lp >= 0 && c.lp <= 8)) return err('Vị trí tướng không hợp lệ'); fz.lp = c.lp | 0; fz.cu = null; }
        if (c.sp != null) { if (!(c.sp >= CFG.spaceMin && c.sp <= CFG.spaceMax) || c.sp !== Math.floor(c.sp)) return err('Khoảng cách không hợp lệ'); fz.sp = c.sp; }
        if (c.cu !== undefined) { var cv = cuError(c.cu, fz.n); if (cv) return err(cv); fz.cu = c.cu && c.cu.length ? clone(c.cu) : null; }
        return { ok: true };
      }
      case 'flags': {
        var fq = P.squadById(p, c.sq); if (!fq) return err('Không thấy đạo quân');
        var v = validFlags(p, fq, c.fl || [], ctx); if (v) return err(v);
        fq.fl = clone(c.fl || []); return { ok: true };
      }
      case 'equip': {
        var ik = p.inv[c.idx], tq = P.squadById(p, c.sq); if (!ik || !tq) return err('Không đeo được');
        if (tq.it.length >= CFG.genItems) return err('Tướng đã đeo đủ ' + CFG.genItems + ' trang bị');
        p.inv.splice(c.idx, 1); tq.it.push(ik); return { ok: true };
      }
      case 'unequip': {
        var uq = P.squadById(p, c.sq); if (!uq || !uq.it[c.slot]) return err('Không có trang bị');
        if (P.invFree(p) <= 0) return err('Tủ đồ đã đầy');
        p.inv.push(uq.it.splice(c.slot, 1)[0]); return { ok: true };
      }
      /* ----- kinh tế (ghi log) ----- */
      case 'xp': {
        if (p.lv >= 4) return err('Đã đạt Đời cao nhất');
        if (!pay(p, CFG.xpBuyCost, ctx)) return err('Không đủ Vàng');
        var lv0 = p.lv; gainXp(p, CFG.xpBuyAmount);
        return { ok: true, up: p.lv > lv0, log: [{ c: 'xp' }] };
      }
      case 'buyItem': {
        var sl = c.slot | 0, key0 = p.ishop[sl], I = key0 && TT.ITEMS[key0]; if (!I) return err('Ô cửa hàng trống');
        var eq = c.sq != null && !rp ? P.squadById(p, c.sq) : null;
        if (eq && eq.it.length >= CFG.genItems) eq = null;
        if (!eq && !rp && P.invFree(p) <= 0) return err('Tủ đồ đã đầy (' + CFG.invSize + ' ô)' + (c.sq != null ? ' và tướng đã đủ ' + CFG.genItems + ' trang bị' : ''));
        if (!pay(p, I.price, ctx)) return err('Không đủ Vàng');
        p.ishop[sl] = null;
        if (eq) { eq.it.push(key0); return { ok: true, idx: -1, eq: eq.id, log: [{ c: 'buyItem', slot: sl }] }; } // mua thẳng vào ô đồ của tướng, không qua tủ đồ
        p.inv.push(key0);
        return { ok: true, idx: p.inv.length - 1, log: [{ c: 'buyItem', slot: sl }] };
      }
      case 'ireroll': {
        if (p.freeIr > 0) p.freeIr--; else if (!pay(p, CFG.rerollCost, ctx)) return err('Không đủ Vàng');
        rollItems(p, ctx); return { ok: true, log: [{ c: 'ireroll' }] };
      }
      case 'pop': {
        if (P.popLeft(p) <= 0) return err('Đã mua tối đa ' + CFG.popBuy.max + ' lần');
        if (!pay(p, P.popPrice(p), ctx)) return err('Không đủ Vàng');
        p.pop = (p.pop | 0) + 1; return { ok: true, log: [{ c: 'pop' }] };
      }
      case 'sellItem': {
        var key = null;
        if (!rp && c.sq != null) { var sq2 = P.squadById(p, c.sq); if (!sq2 || !sq2.it[c.slot]) return err('Không có trang bị'); key = sq2.it.splice(c.slot, 1)[0]; }
        else if (!rp && c.idx != null) { key = p.inv[c.idx]; if (!key) return err('Không có trang bị'); p.inv.splice(c.idx, 1); }
        else { // phát lại: bỏ một món cùng loại ở bất kỳ đâu
          key = c.it; var ii = p.inv.indexOf(key);
          if (ii >= 0) p.inv.splice(ii, 1);
          else { var found = false; for (var a = 0; a < p.squads.length && !found; a++) { var j = p.squads[a].it.indexOf(key); if (j >= 0) { p.squads[a].it.splice(j, 1); found = true; } } if (!found && !rp) return err('Không có trang bị'); if (!found) p._ghost = (p._ghost || 0) + 1; }
        }
        if (!TT.ITEMS[key]) return err('Trang bị lạ');
        p.gold += TT.ITEMS[key].price;
        return { ok: true, log: [{ c: 'sellItem', it: key }] };
      }
      case 'core': {
        var id = p.board[c.slot]; if (!id) return err('Ô Lõi trống');
        if (!rp && P.invFree(p) <= 0) return err('Tủ đồ đã đầy (' + CFG.invSize + ' ô) — bán bớt để mua Lõi');
        if (!pay(p, CFG.corePrice[TT.CORES[id].tier], ctx)) return err('Không đủ Vàng');
        p.cores.push(id); p.board[c.slot] = null; p.locks[c.slot] = 0;
        var fx = TT.CORES[id].fx;
        if (fx.goldNow) p.gold += fx.goldNow;
        if (fx.freeReroll) p.freeRr += fx.freeReroll;
        return { ok: true, id: id, log: [{ c: 'core', slot: c.slot }] };
      }
      case 'sellCore': {
        var ci = c.id != null ? p.cores.indexOf(c.id) : c.idx, cid = p.cores[ci]; if (!cid) return err('Không có Lõi');
        var cf = TT.CORES[cid].fx;
        p.cores.splice(ci, 1); p.gold += CFG.corePrice[TT.CORES[cid].tier] - (cf.goldNow || 0); if (cf.freeReroll) p.freeRr = Math.max(0, p.freeRr - cf.freeReroll);
        return { ok: true, log: [{ c: 'sellCore', id: cid }] };
      }
      case 'reroll': {
        if (p.freeRr > 0) p.freeRr--; else if (!pay(p, CFG.rerollCost, ctx)) return err('Không đủ Vàng');
        p.rr++; rollBoard(p, ctx); return { ok: true, log: [{ c: 'reroll' }] };
      }
      case 'lock': {
        var sl = c.slot | 0; if (!p.board[sl]) return err('Ô trống');
        if (!p.locks[sl] && p.locks.filter(Boolean).length >= CFG.coreLocks) return err('Chỉ khóa tối đa ' + CFG.coreLocks + ' ô');
        p.locks[sl] = p.locks[sl] ? 0 : 1; return { ok: true, log: [{ c: 'lock', slot: sl }] };
      }
      case 'auto': { autoArrange(p, ctx); return { ok: true }; }
    }
    return err('Lệnh không hợp lệ');
  };
  function removeSquad(p, s) {
    s.it.forEach(function (it) { p.inv.push(it); });
    p.squads.splice(p.squads.indexOf(s), 1);
    p.squads.forEach(function (q) { q.fl = q.fl.filter(function (f) { return !(f.c === 'V' && f.sq === s.id); }); });
  }
  P.removeSquad = removeSquad;
  function freeNear(p, z, x, y) {
    if (TT.inZone(z, x, y) && !P.squadAt(p, x, y)) return [x, y];
    for (var r = 1; r < 14; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      var nx = x + dx, ny = y + dy; if (TT.inZone(z, nx, ny) && !P.squadAt(p, nx, ny)) return [nx, ny];
    }
    return null;
  }
  P.freeNear = freeNear;
  /* vị trí tự kéo của lính: tối đa CFG.cuMax lính, mỗi toạ độ nguyên trong ±CFG.cuRange (1/100 ô) */
  function cuError(cu, n) {
    if (cu == null) return null;
    if (!Array.isArray(cu) || cu.length > CFG.cuMax || cu.length > Math.max(0, n - 1)) return 'Vị trí lính không hợp lệ';
    for (var i = 0; i < cu.length; i++) { var a = cu[i]; if (!Array.isArray(a) || a.length !== 2 || !(Math.abs(a[0]) <= CFG.cuRange && Math.abs(a[1]) <= CFG.cuRange) || a[0] !== Math.floor(a[0]) || a[1] !== Math.floor(a[1])) return 'Vị trí lính không hợp lệ'; }
    return null;
  }
  function validFlags(p, q, fl, ctx) {
    if (!Array.isArray(fl)) return 'Cờ không hợp lệ';
    if (fl.length > CFG.flagMax) return 'Tối đa ' + CFG.flagMax + ' cờ mỗi đội';
    for (var i = 0; i < fl.length; i++) {
      var f = fl[i];
      if (f.c === 'X' || f.c === 'D') { if (!(f.x >= 0 && f.y >= 0 && f.x < ctx.W && f.y < ctx.H)) return 'Cờ nằm ngoài bản đồ'; }
      else if (f.c === 'V') {
        if (f.sq === q.id) return 'Không thể hộ tống chính mình';
        var t = P.squadById(p, f.sq); if (!t) return 'Đội được hộ tống không còn';
        // không vòng tròn
        var seen = {}; seen[q.id] = 1; var cur = t, depth = 0;
        while (cur && depth < 5) { if (seen[cur.id]) return 'Hai đội không thể hộ tống vòng tròn'; seen[cur.id] = 1; var nx = cur.fl.filter(function (x) { return x.c === 'V'; })[0]; cur = nx ? P.squadById(p, nx.sq) : null; depth++; }
        if (depth > 3) return 'Chuỗi hộ tống tối đa 3 đội';
      } else if (f.c === 'T') {
        if (!(f.sq >= 0) || f.sq !== Math.floor(f.sq) || !/^[\w-]{1,24}$/.test(String(f.seat)) || String(f.seat) === String(p.seat)) return 'Cờ tím phải cắm vào đạo quân của đối thủ';
      } else return 'Loại cờ không hợp lệ';
    }
    return null;
  }
  P.validFlags = validFlags;

  /* Xếp tự động: cận chiến phía trước, tầm trung giữa, tầm xa phía sau, thích khách/kỵ hai cánh */
  function autoArrange(p, ctx) {
    var z = ctx.zone, side = ctx.side, W = z.x1 - z.x0 + 1, D = z.y1 - z.y0 + 1;
    var w = (side === 0 || side === 2) ? W : D, dpt = (side === 0 || side === 2) ? D : W;
    function toMap(lx, ly) { // lx: ngang 0..w-1, ly: độ sâu 0 (sát tiền tuyến)..dpt-1
      if (side === 0) return [z.x0 + lx, z.y0 + ly];
      if (side === 2) return [z.x1 - lx, z.y1 - ly];
      if (side === 1) return [z.x1 - ly, z.y0 + lx];
      return [z.x0 + ly, z.y1 - lx];
    }
    var rows = { front: [], mid: [], back: [], wing: [] };
    p.squads.forEach(function (q) {
      var r = q.t;
      if (TT.ROLES[r].marshal) rows.back.push(q);
      else if (r === 'thichkhach' || r === 'ky') rows.wing.push(q);
      else if (r === 'linh' || r === 'thuan' || r === 'tuong' || r === 'thanthu') rows.front.push(q);
      else if (r === 'y' || r === 'chihuy') rows.mid.push(q);
      else rows.back.push(q);
    });
    var used = {};
    function place(list, depth) {
      var n = list.length; if (!n) return;
      list.forEach(function (q, i) {
        var lx = Math.round((i + 1) * w / (n + 1)) - 1; lx = Math.max(0, Math.min(w - 1, lx));
        for (var t = 0; t < 30; t++) {
          var tryX = lx + (t % 2 ? 1 : -1) * Math.ceil(t / 2), ly = depth + Math.floor(t / 12);
          tryX = Math.max(0, Math.min(w - 1, tryX)); ly = Math.min(dpt - 1, ly);
          var m = toMap(tryX, ly), key = m[0] + ',' + m[1];
          if (!used[key]) { used[key] = 1; q.x = m[0]; q.y = m[1]; return; }
        }
      });
    }
    place(rows.front, 2); place(rows.mid, 5);
    place(rows.back, Math.min(dpt - 2, 8));
    var wl = rows.wing; wl.forEach(function (q, i) { var lx = i % 2 ? w - 3 - (i >> 1) * 2 : 2 + (i >> 1) * 2; var m = toMap(Math.max(0, Math.min(w - 1, lx)), 3 + (i >> 2)); var key = m[0] + ',' + m[1]; if (used[key]) { var f = freeNear({ squads: p.squads.filter(function (s) { return s !== q; }) }, z, m[0], m[1]); if (f) m = f; } used[m[0] + ',' + m[1]] = 1; q.x = m[0]; q.y = m[1]; });
  }

  /* ---------- gói đội hình (gửi qua mạng) ---------- */
  P.makePackage = function (p, econLog) {
    return {
      c: econLog.slice(),
      a: p.squads.map(function (q) { return [q.id, q.t, q.n, q.x, q.y, q.st, q.it.join('|'), q.fl.length ? q.fl.map(function (f) { return f.c === 'V' ? 'V' + f.sq + (f.k ? ':' + f.k : '') : f.c === 'T' ? 'T' + f.seat + ':' + f.sq : f.c + f.x + ',' + f.y; }).join(';') : '', q.fm || 'khoi', q.lp == null ? 4 : q.lp, (q.up || []).some(Boolean) ? q.up.join(',') : '', q.sp && q.sp !== 100 ? q.sp : 0, q.cu && q.cu.length ? q.cu.map(function (v) { return v[0] + ',' + v[1]; }).join(';') : '', q.sm || '']; }),
      i: p.inv.join('|'), n: p.nid
    };
  };
  function parseFlags(s) {
    if (!s) return [];
    return s.split(';').map(function (t) {
      if (t[0] === 'V') { var pr = t.slice(1).split(':'); return { c: 'V', sq: +pr[0], k: pr[1] || 'sat' }; }
      if (t[0] === 'T') { var pt = t.slice(1).split(':'); return { c: 'T', seat: pt[0], sq: +pt[1] }; }
      var xy = t.slice(1).split(','); return { c: t[0], x: +xy[0], y: +xy[1] };
    });
  }
  function bag(list) { var m = {}; list.forEach(function (k) { m[k] = (m[k] || 0) + 1; }); return m; }
  function ownedItems(p) { var l = p.inv.slice(); p.squads.forEach(function (q) { l = l.concat(q.it); }); return l; }
  /* Áp gói lên trạng thái đầu ngày.
     1) phát lại lệnh kinh tế (EXP, trang bị, Lõi, đổi bảng) → Vàng còn lại, Đời, Lõi, tập trang bị sở hữu;
     2) đội hình trong gói phải hợp lệ, đúng tập trang bị, và không vượt ngân sách Vàng. */
  P.applyPackage = function (p0, pkg, ctx) {
    var p = clone(p0), errs = [], rctx = Object.assign({}, ctx, { replay: true });
    try {
      (pkg.c || []).forEach(function (c) { if (!P.ECON[c.c]) throw new Error('lệnh lạ'); var r = P.apply(p, c, rctx); if (!r.ok) throw new Error(r.err); });
      if (p._ghost) throw new Error('bán trang bị không có');
      var np = clone(p);
      np.squads = (pkg.a || []).map(function (a) { return { id: a[0] | 0, t: String(a[1]), n: a[2] | 0, x: a[3] | 0, y: a[4] | 0, st: String(a[5] || 'tc'), it: a[6] ? String(a[6]).split('|') : [], fl: parseFlags(a[7]), fm: String(a[8] || 'khoi'), lp: a[9] == null ? 4 : a[9] | 0, up: a[10] ? String(a[10]).split(',').map(function (v) { return +v; }) : [0, 0, 0, 0], sp: a[11] ? +a[11] : 100, cu: a[12] ? String(a[12]).split(';').map(function (t) { var xy = t.split(','); return [+xy[0], +xy[1]]; }) : null, sm: a[13] ? String(a[13]) : (TT.ROLES[String(a[1])] && TT.ROLES[String(a[1])].marshal ? 'linh' : undefined) }; });
      np.inv = pkg.i ? String(pkg.i).split('|') : [];
      np.nid = Math.max(p.nid, pkg.n | 0);
      var e = P.validateArmy(np, ctx); if (e) throw new Error(e);
      var want = bag(ownedItems(p)), got = bag(ownedItems(np)), keys = Object.keys(want).concat(Object.keys(got));
      for (var i = 0; i < keys.length; i++) if ((want[keys[i]] || 0) !== (got[keys[i]] || 0)) throw new Error('trang bị không khớp');
      var left = p.gold + P.armyValue(p0) - P.armyValue(np);
      if (left < 0) throw new Error('vượt ngân sách Vàng');
      np.gold = left;
      return { ok: true, p: np, errs: errs };
    } catch (ex) {
      errs.push(ex.message);
      return { ok: false, p: clone(p0), errs: errs };
    }
  };
  P.validateArmy = function (p, ctx) {
    var ids = {}, pos = {}, beast = 0, totalFlags = 0, marshals = 0;
    for (var i = 0; i < p.squads.length; i++) {
      var q = p.squads[i], R = TT.ROLES[q.t];
      if (!R) return 'binh chủng lạ';
      if (R.age > p.lv) return 'chưa mở khóa ' + q.t;
      if (!(q.n >= 1) || q.n > 999) return 'số quân sai';
      if (R.unique && q.n > 1) return 'Thần thú không có lính';
      if (ids[q.id]) return 'trùng id'; ids[q.id] = 1;
      if (!TT.inZone(ctx.zone, q.x, q.y)) return 'ngoài vùng xuất quân';
      var k = q.x + ',' + q.y; if (pos[k]) return 'trùng ô'; pos[k] = 1;
      if (R.marshal) { marshals++; if (!CFG.marshal.summon[q.sm || 'linh'] || TT.ROLES[q.sm || 'linh'].age > p.lv) return 'lính triệu hồi sai'; } else if (R.unique) beast++;
      if (!TT.STANCES[q.st]) return 'chiến thuật sai';
      if (!TT.FORMATIONS[q.fm || 'khoi'] || !((q.lp == null ? 4 : q.lp) >= 0 && (q.lp == null ? 4 : q.lp) <= 8)) return 'đội hình sai';
      if (q.it.length > CFG.genItems) return 'quá ' + CFG.genItems + ' trang bị';
      if (!(((q.sp == null ? 100 : q.sp) >= CFG.spaceMin) && ((q.sp == null ? 100 : q.sp) <= CFG.spaceMax)) || ((q.sp == null ? 100 : q.sp) !== Math.floor(q.sp == null ? 100 : q.sp))) return 'khoảng cách sai';
      var cuE = cuError(q.cu, q.n); if (cuE) return cuE;
      var up = q.up || [0, 0, 0, 0];
      if (up.length !== CFG.solUp.stats.length) return 'nâng cấp lính sai';
      for (var u2 = 0; u2 < up.length; u2++) if (!(up[u2] >= 0 && up[u2] <= CFG.solUp.max && up[u2] === Math.floor(up[u2]))) return 'nâng cấp lính sai';
      if (R.unique && up.some(Boolean)) return 'Thần thú không có lính';
      for (var j = 0; j < q.it.length; j++) { var I = TT.ITEMS[q.it[j]]; if (!I) return 'trang bị sai'; }
      totalFlags += q.fl.length;
    }
    for (var m = 0; m < p.inv.length; m++) if (!TT.ITEMS[p.inv[m]]) return 'tủ đồ sai';
    if (P.invUsed(p) > CFG.invSize) return 'tủ đồ quá ' + CFG.invSize + ' ô';
    if (beast > 1) return 'quá 1 Thần thú';
    if (marshals !== 1) return 'phải có đúng 1 Nguyên soái';
    if (P.usedPop(p) > P.capacity(p)) return 'vượt Sức chứa';
    for (var n = 0; n < p.squads.length; n++) { var v = validFlags(p, p.squads[n], p.squads[n].fl, ctx); if (v) return v; }
    return null;
  };
  /* Ước lượng sức mạnh đội hình (thanh "Sức mạnh" — chỉ để tham khảo) */
  P.power = function (p) {
    var s = 0;
    p.squads.forEach(function (q) {
      var R = TT.ROLES[q.t], f = TT.FACTIONS[p.race].mods;
      var hp = R.hp * f.hp / 100, atk = R.atk * f.atk / 100, def = R.def * f.def / 100, as = R.as * f.as / 100;
      var ehp = hp * (1 + def / 100), dps = atk * as * (1 + R.crit / 200) * (R.cls === 'xa' ? 1.25 : 1);
      s += Math.sqrt(ehp * dps) * (q.n + 1.6) + q.it.length * 40;
    });
    s *= 1 + p.cores.length * .05;
    return Math.round(s);
  };
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : global);
