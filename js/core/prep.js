/* Tứ Tộc Kỳ Chiến 2.0 — logic giai đoạn Chuẩn bị (thuần, xác định). */
(function (G) {
  'use strict';
  var TT = G.TT, CFG = TT.CONFIG;
  var P = TT.Prep = {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  P.clone = clone;
  function addC(a, b, k) { k = k || 1; return { V: a.V + (b.V || 0) * k, T: a.T + (b.T || 0) * k, G: a.G + (b.G || 0) * k }; }
  function geC(a, b) { return a.V >= (b.V || 0) && a.T >= (b.T || 0) && a.G >= (b.G || 0); }
  P.addC = addC;

  /* ---------- người chơi ---------- */
  P.newPlayer = function (o) {
    // o: {seat, name, race, talent, start(gold|food|wood), bot}
    var p = {
      seat: String(o.seat), name: o.name, race: o.race, talent: o.talent || TT.TALENTS[o.race][0].id, bot: o.bot || null,
      res: { V: 0, T: 0, G: 0 }, cry: 0, xp: 0, lv: 1,
      squads: [], inv: [], cores: [], board: [null, null, null, null, null], locks: [0, 0, 0, 0, 0], rr: 0, freeRr: 0, rrIdx: 0, nid: 1,
      out: 0
    };
    var si = TT.START_ITEMS[o.start] || 'kiem'; p.inv.push(si);
    return p;
  };
  P.capacity = function (p) {
    var c = CFG.capacity[p.lv];
    if (p.race === 'human') c += CFG.humanCapBonus[p.lv] + (p.talent === 'quanluong' ? 2 : 0);
    return c;
  };
  P.usedPop = function (p) { var s = 0; p.squads.forEach(function (q) { s += q.n * TT.ROLES[q.t].pop; }); return s; };
  P.itemSlots = function (p) { return CFG.itemSlots[p.lv] + (p.race === 'human' ? 1 : 0); };
  P.coreSlots = function (p) { return CFG.coreSlots[p.lv]; };
  P.hasCoreFx = function (p, k) { var s = 0; p.cores.forEach(function (c) { var f = TT.CORES[c].fx; if (f[k]) s += f[k] === true ? 1 : f[k]; }); return s; };
  P.flagSteps = function (p) { return CFG.flagSteps[p.lv] + P.hasCoreFx(p, 'flagAdd'); };
  P.xpNeed = function (p) { return p.lv >= 4 ? 0 : CFG.xpToNext[p.lv]; };
  function gainXp(p, n) { p.xp += n; while (p.lv < 4 && p.xp >= CFG.xpToNext[p.lv]) { p.xp -= CFG.xpToNext[p.lv]; p.lv++; } if (p.lv >= 4) p.xp = 0; }
  P.unitUnlocked = function (p, role) { return TT.ROLES[role].age <= p.lv; };
  P.armyValue = function (p) {
    var c = { V: 0, T: 0, G: 0 };
    p.squads.forEach(function (q) { c = addC(c, TT.unitCost(p.race, q.t), q.n); q.it.forEach(function (it) { c = addC(c, TT.ITEMS[it].cost); }); });
    p.inv.forEach(function (it) { c = addC(c, TT.ITEMS[it].cost); });
    return c;
  };
  P.squadAt = function (p, x, y) { for (var i = 0; i < p.squads.length; i++) if (p.squads[i].x === x && p.squads[i].y === y) return p.squads[i]; return null; };
  P.squadById = function (p, id) { for (var i = 0; i < p.squads.length; i++) if (p.squads[i].id === id) return p.squads[i]; return null; };
  P.defaultStance = function (role) { return 'tc'; };

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

  /* ---------- đầu ngày ---------- */
  P.dayStart = function (p, ctx) {
    var d = ctx.day, inc = CFG.resIncome[d] || 0;
    p.res = addC(p.res, { V: inc, T: inc, G: inc });
    if (d === 1) { p.cry = CFG.cryStart; }
    else {
      var imax = CFG.cryInterestMax + P.hasCoreFx(p, 'interestAdd');
      var interest = Math.min(imax, Math.floor(p.cry / CFG.cryInterestPer));
      p.lastIncome = { base: CFG.cryDaily, interest: interest, core: P.hasCoreFx(p, 'cryDaily') };
      p.cry += CFG.cryDaily + interest + p.lastIncome.core;
      gainXp(p, CFG.xpDaily);
    }
    if (ctx.event === 'vanmay') p.cry += 3;
    p.rr = 0; p.freeRr = CFG.freeRerolls + P.hasCoreFx(p, 'freeReroll');
    rollBoard(p, ctx);
  };

  /* ---------- lệnh chuẩn bị ----------
     Mọi lệnh trả {ok, err}. Lệnh tinh thể (xp/core/sellCore/reroll/lock) được ghi vào nhật ký để gửi đi. */
  P.CRY_CMDS = { xp: 1, core: 1, sellCore: 1, reroll: 1, lock: 1 };
  P.apply = function (p, c, ctx) {
    var z = ctx.zone, err = function (m) { return { ok: false, err: m }; };
    switch (c.c) {
      case 'buy': {
        var role = c.t, R = TT.ROLES[role], k = Math.max(1, c.k | 0);
        if (!R) return err('Không có binh chủng này');
        if (!P.unitUnlocked(p, role)) return err('Cần Đời ' + TT.AGE_ROMAN[R.age] + ' để mua ' + TT.unitName(p.race, role));
        if (!TT.inZone(z, c.x, c.y)) return err('Chỉ đặt quân trong vùng xuất quân của bạn');
        var q = P.squadAt(p, c.x, c.y);
        if (q && q.t !== role) return err('Ô này đã có đội khác loại');
        if (R.unique && (k > 1 || p.squads.some(function (s) { return s.t === role; }))) return err('Mỗi người chỉ có 1 Thần thú');
        var free = P.capacity(p) - P.usedPop(p), cost = TT.unitCost(p.race, role);
        k = Math.min(k, Math.floor(free / R.pop));
        if (k <= 0) return err('Hết Sức chứa — lên Đời để chứa thêm quân');
        var aff = k; ['V', 'T', 'G'].forEach(function (r) { if (cost[r]) aff = Math.min(aff, Math.floor(p.res[r] / cost[r])); });
        if (aff <= 0) return err('Không đủ tài nguyên');
        p.res = addC(p.res, cost, -aff);
        if (q) q.n += aff; else { q = { id: p.nid++, t: role, n: aff, x: c.x, y: c.y, st: P.defaultStance(role), it: [], fl: [] }; p.squads.push(q); }
        return { ok: true, sq: q.id, n: aff };
      }
      case 'sell': {
        var s = P.squadById(p, c.sq); if (!s) return err('Không thấy đội');
        var n = Math.min(s.n, Math.max(1, c.k | 0)); var cst = TT.unitCost(p.race, s.t);
        p.res = addC(p.res, cst, n); s.n -= n;
        if (s.n <= 0) { removeSquad(p, s); }
        return { ok: true, n: n };
      }
      case 'move': {
        var m = P.squadById(p, c.sq); if (!m) return err('Không thấy đội');
        if (!TT.inZone(z, c.x, c.y)) return err('Chỉ đặt quân trong vùng xuất quân của bạn');
        var o = P.squadAt(p, c.x, c.y);
        if (o && o !== m) {
          if (o.t !== m.t || TT.ROLES[m.t].unique) { o.x = m.x; o.y = m.y; m.x = c.x; m.y = c.y; return { ok: true, swap: o.id }; }
          return merge(p, m, o);
        }
        m.x = c.x; m.y = c.y; return { ok: true };
      }
      case 'merge': { var a = P.squadById(p, c.a), b = P.squadById(p, c.b); if (!a || !b || a === b || a.t !== b.t) return err('Chỉ gộp được hai đội cùng loại'); return merge(p, a, b); }
      case 'split': {
        var sp = P.squadById(p, c.sq); if (!sp) return err('Không thấy đội');
        var kk = c.k | 0; if (kk < 1 || kk >= sp.n) return err('Số quân tách không hợp lệ');
        var pos = c.x != null ? [c.x, c.y] : freeNear(p, z, sp.x, sp.y);
        if (!pos || !TT.inZone(z, pos[0], pos[1]) || P.squadAt(p, pos[0], pos[1])) return err('Không còn ô trống để đặt đội mới');
        sp.n -= kk; var ns = { id: p.nid++, t: sp.t, n: kk, x: pos[0], y: pos[1], st: sp.st, it: [], fl: [] }; p.squads.push(ns);
        return { ok: true, sq: ns.id };
      }
      case 'stance': { var st = P.squadById(p, c.sq); if (!st || !TT.STANCES[c.s]) return err('Tư thế không hợp lệ'); st.st = c.s; return { ok: true }; }
      case 'buyItem': {
        var I = TT.ITEMS[c.it]; if (!I) return err('Không có trang bị này');
        if (I.tier > p.lv) return err('Cần Đời ' + TT.AGE_ROMAN[I.tier]);
        if (!geC(p.res, I.cost)) return err('Không đủ tài nguyên');
        p.res = addC(p.res, I.cost, -1); p.inv.push(c.it);
        if (c.sq != null) { var eq = P.apply(p, { c: 'equip', idx: p.inv.length - 1, sq: c.sq }, ctx); if (!eq.ok) return { ok: true, warn: eq.err }; }
        return { ok: true };
      }
      case 'sellItem': {
        var key = p.inv[c.idx]; if (!key) return err('Không có trang bị');
        p.inv.splice(c.idx, 1); p.res = addC(p.res, TT.ITEMS[key].cost); return { ok: true };
      }
      case 'equip': {
        var ik = p.inv[c.idx], tq = P.squadById(p, c.sq); if (!ik || !tq) return err('Không gắn được');
        if (tq.it.length >= P.itemSlots(p)) return err('Đội trưởng đã đầy ô trang bị');
        p.inv.splice(c.idx, 1); tq.it.push(ik); return { ok: true };
      }
      case 'unequip': {
        var uq = P.squadById(p, c.sq); if (!uq || !uq.it[c.slot]) return err('Không có trang bị');
        p.inv.push(uq.it.splice(c.slot, 1)[0]); return { ok: true };
      }
      case 'sellEquip': {
        var sq2 = P.squadById(p, c.sq); if (!sq2 || !sq2.it[c.slot]) return err('Không có trang bị');
        var k2 = sq2.it.splice(c.slot, 1)[0]; p.res = addC(p.res, TT.ITEMS[k2].cost); return { ok: true };
      }
      case 'flags': {
        var fq = P.squadById(p, c.sq); if (!fq) return err('Không thấy đội');
        var v = validFlags(p, fq, c.fl || [], ctx); if (v) return err(v);
        fq.fl = clone(c.fl || []); return { ok: true };
      }
      case 'xp': {
        if (p.lv >= 4) return err('Đã đạt Đời cao nhất');
        if (p.cry < CFG.xpBuyCost) return err('Không đủ Tinh thể');
        p.cry -= CFG.xpBuyCost; var lv0 = p.lv; gainXp(p, CFG.xpBuyAmount);
        return { ok: true, up: p.lv > lv0 };
      }
      case 'core': {
        var id = p.board[c.slot]; if (!id) return err('Ô Lõi trống');
        var cost2 = CFG.coreCost[TT.CORES[id].tier];
        if (p.cores.length >= P.coreSlots(p)) return err('Đã đủ số Lõi của Đời này — bán bớt hoặc lên Đời');
        if (p.cry < cost2) return err('Không đủ Tinh thể');
        p.cry -= cost2; p.cores.push(id); p.board[c.slot] = null; p.locks[c.slot] = 0;
        var fx = TT.CORES[id].fx;
        if (fx.cryNow) p.cry += fx.cryNow;
        if (fx.freeReroll) p.freeRr += fx.freeReroll;
        return { ok: true, id: id };
      }
      case 'sellCore': {
        var cid = p.cores[c.idx]; if (!cid) return err('Không có Lõi');
        p.cores.splice(c.idx, 1); p.cry += Math.floor(CFG.coreCost[TT.CORES[cid].tier] * CFG.coreSellPct / 100);
        return { ok: true };
      }
      case 'reroll': {
        if (p.freeRr > 0) p.freeRr--; else { if (p.cry < CFG.rerollCost) return err('Không đủ Tinh thể'); p.cry -= CFG.rerollCost; }
        p.rr++; rollBoard(p, ctx); return { ok: true };
      }
      case 'lock': {
        var sl = c.slot | 0; if (!p.board[sl]) return err('Ô trống');
        if (!p.locks[sl] && p.locks.filter(Boolean).length >= CFG.coreLocks) return err('Chỉ khóa tối đa ' + CFG.coreLocks + ' ô');
        p.locks[sl] = p.locks[sl] ? 0 : 1; return { ok: true };
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
  function merge(p, a, b) { // a nhập vào b
    b.n += a.n; var slots = P.itemSlots(p);
    a.it.forEach(function (it) { if (b.it.length < slots) b.it.push(it); else p.inv.push(it); }); a.it = [];
    p.squads.splice(p.squads.indexOf(a), 1);
    p.squads.forEach(function (q) { q.fl.forEach(function (f) { if (f.c === 'V' && f.sq === a.id) f.sq = b.id; }); q.fl = q.fl.filter(function (f) { return !(f.c === 'V' && f.sq === q.id); }); });
    return { ok: true, merged: b.id };
  }
  function freeNear(p, z, x, y) {
    for (var r = 1; r < 8; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      var nx = x + dx, ny = y + dy; if (TT.inZone(z, nx, ny) && !P.squadAt(p, nx, ny)) return [nx, ny];
    }
    return null;
  }
  P.freeNear = freeNear;
  function validFlags(p, q, fl, ctx) {
    if (!Array.isArray(fl)) return 'Cờ không hợp lệ';
    if (fl.length > P.flagSteps(p)) return 'Đời ' + TT.AGE_ROMAN[p.lv] + ' chỉ cho tối đa ' + P.flagSteps(p) + ' bước cờ mỗi đội';
    var total = fl.length; p.squads.forEach(function (s) { if (s !== q) total += s.fl.length; });
    if (total > CFG.flagTotal) return 'Tối đa ' + CFG.flagTotal + ' cờ cho cả đạo quân';
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
      if (r === 'thichkhach' || r === 'ky') rows.wing.push(q);
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
  P.makePackage = function (p, cryLog) {
    return {
      c: cryLog.slice(),
      a: p.squads.map(function (q) { return [q.id, q.t, q.n, q.x, q.y, q.st, q.it.join('|'), q.fl.length ? q.fl.map(function (f) { return f.c === 'V' ? 'V' + f.sq + (f.k ? ':' + f.k : '') : f.c + f.x + ',' + f.y; }).join(';') : '']; }),
      i: p.inv.join('|'), n: p.nid
    };
  };
  function parseFlags(s) {
    if (!s) return [];
    return s.split(';').map(function (t) {
      if (t[0] === 'V') { var pr = t.slice(1).split(':'); return { c: 'V', sq: +pr[0], k: pr[1] || 'sat' }; }
      var xy = t.slice(1).split(','); return { c: t[0], x: +xy[0], y: +xy[1] };
    });
  }
  /* Áp gói lên trạng thái đầu ngày; sai luật thì giữ đội hình cũ (vẫn áp phần Tinh thể hợp lệ). */
  P.applyPackage = function (p0, pkg, ctx) {
    var p = clone(p0), errs = [];
    try {
      (pkg.c || []).forEach(function (c) { if (!P.CRY_CMDS[c.c]) { errs.push('lệnh lạ'); return; } var r = P.apply(p, c, ctx); if (!r.ok) errs.push(r.err); });
      var budget = addC(p0.res, P.armyValue(p0));
      var np = clone(p);
      np.squads = (pkg.a || []).map(function (a) { return { id: a[0] | 0, t: String(a[1]), n: a[2] | 0, x: a[3] | 0, y: a[4] | 0, st: String(a[5] || 'tc'), it: a[6] ? String(a[6]).split('|') : [], fl: parseFlags(a[7]) }; });
      np.inv = pkg.i ? String(pkg.i).split('|') : [];
      np.nid = Math.max(p.nid, pkg.n | 0);
      var e = P.validateArmy(np, ctx);
      if (e) throw new Error(e);
      var val = P.armyValue(np), left = { V: budget.V - val.V, T: budget.T - val.T, G: budget.G - val.G };
      if (left.V < 0 || left.T < 0 || left.G < 0) throw new Error('vượt ngân sách');
      np.res = left;
      return { ok: true, p: np, errs: errs };
    } catch (ex) {
      errs.push(ex.message);
      return { ok: false, p: p, errs: errs };
    }
  };
  P.validateArmy = function (p, ctx) {
    var ids = {}, pos = {}, beast = 0, slots = P.itemSlots(p), totalFlags = 0;
    for (var i = 0; i < p.squads.length; i++) {
      var q = p.squads[i], R = TT.ROLES[q.t];
      if (!R) return 'binh chủng lạ';
      if (R.age > p.lv) return 'chưa mở khóa ' + q.t;
      if (!(q.n >= 1) || q.n > 999) return 'số quân sai';
      if (ids[q.id]) return 'trùng id'; ids[q.id] = 1;
      if (!TT.inZone(ctx.zone, q.x, q.y)) return 'ngoài vùng xuất quân';
      var k = q.x + ',' + q.y; if (pos[k]) return 'trùng ô'; pos[k] = 1;
      if (R.unique) { beast += q.n; }
      if (!TT.STANCES[q.st]) return 'tư thế sai';
      if (q.it.length > slots) return 'quá ô trang bị';
      for (var j = 0; j < q.it.length; j++) { var I = TT.ITEMS[q.it[j]]; if (!I || I.tier > p.lv) return 'trang bị sai'; }
      totalFlags += q.fl.length;
    }
    for (var m = 0; m < p.inv.length; m++) { var I2 = TT.ITEMS[p.inv[m]]; if (!I2 || I2.tier > p.lv) return 'kho đồ sai'; }
    if (beast > 1) return 'quá 1 Thần thú';
    if (P.usedPop(p) > P.capacity(p)) return 'vượt Sức chứa';
    if (totalFlags > CFG.flagTotal) return 'quá số cờ';
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
      s += Math.sqrt(ehp * dps) * q.n + q.it.length * 25;
    });
    s *= 1 + p.cores.length * .05;
    return Math.round(s);
  };
  if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : global);
