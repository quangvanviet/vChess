/* Tứ Tộc Kỳ Chiến 2.0 — màn trận đấu: chuẩn bị đồng thời (commit–reveal qua Firebase), giao tranh tự động,
   kết quả ngày, tổng kết 10 ngày. Lõi luật: prep.js / battle.js / match.js (xác định). */
(function (G) {
  'use strict';
  var TT = G.TT, App = TT.App, Net = TT.Net, I = TT.Icons, P = TT.Prep, MT = TT.Match, CFG = TT.CONFIG, F = TT.FACTIONS;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return App.esc(s); };
  var Game = TT.Game = {}, S = null;
  var INTRO = 4500, RESULT = CFG.resultSec * 1000;
  var ROLES = TT.ROLES;

  /* ================= khởi động ================= */
  Game.start = function (code, room) {
    Game.stop();
    var setup = Net.buildSetup(room), uid = Net.user.uid;
    var M = MT.create(setup);
    var mine = setup.players.filter(function (p) { return p.uid === uid && !p.bot; })[0];
    S = {
      code: code, room: room, setup: setup, M: M, host: room.meta.hostUid === uid, seat: mine ? mine.seat : null,
      prepMs: room.meta.turnLimitMs || 90000, days: {}, quit: {}, unsub: [], phase: 'load', field: null,
      P: null, cryLog: [], undo: [], sel: null, flagMode: null, buyRole: null, itemSel: null, committed: false, pending: null,
      dock: 'item', speed: +(lsGet('ttkc.speed') || 1), log: [], results: [], botPk: {}, revealed: {}, lockTry: {}, finTry: {}, revTry: {},
      bots: setup.players.filter(function (p) { return p.bot; }).map(function (p) { return p.seat; })
    };
    renderLoading();
    App.show('loading');
    setTimeout(function () { if (!S) return; App.show('game'); initField(); bindUI(); renderAll(); }, 1600);
    S.unsub.push(Net.watchDays(code, function (v, err) { if (!S) return; S.days = v || {}; process(); }));
    S.unsub.push(Net.watchQuit(code, function (v) { if (!S) return; S.quit = v || {}; process(); }));
    S.tick = setInterval(function () { process(); tickUI(); }, 250);
    document.addEventListener('visibilitychange', onVis);
  };
  Game.stop = function () {
    if (!S) return;
    clearInterval(S.tick); S.unsub.forEach(function (f) { try { f(); } catch (e) { } });
    if (S.field) S.field.destroy();
    document.removeEventListener('visibilitychange', onVis);
    S = null;
  };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function onVis() { if (document.hidden && S && S.field && S.field.B && !S.field.ended) S.field.skipBattle(); }
  function now() { return Net.B.now(); }
  function me() { return S.seat ? MT.player(S.M, S.seat) : null; }
  function alive() { return S.M.players.filter(function (p) { return !p.out; }); }
  function ctxOf(p) { var c = MT.ctx(S.M, p); c.weather = S.M.weather; return c; }

  function renderLoading() {
    var M = S.M;
    $('#loading-cards').innerHTML = M.players.map(function (p) {
      var f = F[p.race], tal = TT.TALENTS[p.race].filter(function (t) { return t.id === p.talent; })[0];
      return '<div class="lcard" style="--fc:' + f.color + ';--pc:' + TT.SEAT_COLORS[p.seat] + '">' + I.crest(p.race, 120) + '<div class="ln">' + esc(p.name) + '</div><div class="lf">' + f.name + '</div><div class="lp">' + (tal ? tal.name : '') + '</div></div>';
    }).join('');
    $('#loading-tip').textContent = '';
    var fill = $('#loading-fill'); fill.style.transition = 'none'; fill.style.width = '0%'; setTimeout(function () { fill.style.transition = 'width 1.4s ease'; fill.style.width = '100%'; }, 30);
  }

  /* ================= vòng điều phối ngày ================= */
  function process() {
    if (!S || S.busy) return;
    var d0 = S.days[0] && S.days[0].fin; if (!d0) return;
    S.busy = true;
    try {
      for (var guard = 0; guard < 25 && S; guard++) {
        applyQuits();
        if (S.M.over) { if (S.phase !== 'over' && S.phase !== 'battle') showOver(); break; }
        if (S.M.day === 0) { beginDay(d0.at + INTRO); continue; }
        var n = S.M.day, dd = S.days[n] || {};
        if (S.M.phase === 'prep') {
          if (dd.fin) { resolveDay(n, dd); continue; }
          prepDuties(n, dd);
          break;
        }
        if (S.M.phase === 'result') {
          if (now() >= S.nextPrep && S.phase !== 'battle') { beginDay(S.nextPrep); continue; }
          break;
        }
        break;
      }
    } catch (e) { console.error(e); }
    if (S) S.busy = false;
  }
  function applyQuits() {
    Object.keys(S.quit || {}).forEach(function (seat) {
      var p = MT.player(S.M, seat); if (!p || p.out) return;
      if (S.quit[seat] < S.M.day || (S.M.phase !== 'prep' && S.quit[seat] <= S.M.day)) { MT.forfeit(S.M, seat); log(esc(p.name) + ' đã đầu hàng', 'warn'); }
    });
  }
  function beginDay(startAt) {
    var M = S.M, di = MT.beginDay(M), n = M.day;
    S.prepStart = startAt; S.deadline = startAt + S.prepMs + (n === 1 ? CFG.prepDay1Bonus * 1000 : 0);
    S.committed = false; S.pending = null; S.botPk = {}; S.botStarted = false; S.revealed = {}; S.sel = null; S.flagMode = null; S.buyRole = null; S.itemSel = null;
    var p = me();
    if (p && !p.out) { S.P = P.clone(p); S.P.side = p.side; S.P.team = p.team; } else S.P = null;
    S.cryLog = []; S.undo = [];
    // nạp lại gói chưa mở (khi tải lại trang)
    var pend = sessionGet('ttkc.pend.' + S.code + '.' + n); if (pend && S.P) { S.pending = pend; S.committed = true; try { var pr = P.applyPackage(p, JSON.parse(pend.payload), ctxOf(p)); if (pr.ok) { S.P = Object.assign(pr.p, { side: p.side, team: p.team }); S.cryLog = JSON.parse(pend.payload).c || []; } } catch (e) { } }
    S.phase = 'prep';
    if (S.field) setupFieldForDay();
    var parts = ['<b>Ngày ' + n + '</b>', di.name, M.map.name];
    if (di.event) parts.push('Sự kiện: ' + TT.EVENTS[di.event].name);
    log(parts.join(' · '), 'day');
    if (now() < S.deadline) { centerMsg('Ngày ' + n + (di.kind !== 'normal' ? ' · ' + di.name : ''), di.event ? TT.EVENTS[di.event].desc : M.map.name); TT.Sound.play('turn'); }
    hideResult();
    renderAll();
  }
  function prepDuties(n, dd) {
    var t = now(), c = dd.c || {}, r = dd.r || {}, lock = dd.lock, al = alive().map(function (p) { return p.seat; });
    // bot (chỉ máy chủ phòng)
    if (S.host && !S.botStarted) { S.botStarted = true; setTimeout(function () { prepBots(n); }, 300); }
    if (!lock) {
      if (S.P && !S.committed && t >= S.deadline - 1500) commitMine();
      var allIn = al.every(function (s) { return c[s]; });
      if (((S.host && (allIn || t >= S.deadline + 2000)) || t >= S.deadline + 12000) && !S.lockTry[n]) {
        S.lockTry[n] = 1; Net.lockDay(S.code, n, al.filter(function (s) { return c[s]; })).catch(function () { S.lockTry[n] = 0; });
      }
      return;
    }
    var ls = lock.seats ? lock.seats.split(',').filter(Boolean) : [];
    if (S.P && S.pending && ls.indexOf(S.seat) >= 0 && !r[S.seat] && !S.revTry[n]) { S.revTry[n] = 1; Net.reveal(S.code, n, S.seat, S.pending.payload, S.pending.nonce).catch(function (e) { console.warn(e); }); }
    if (S.host) ls.forEach(function (s) { var bp = S.botPk[s]; if (bp && !r[s] && !S.revealed[s]) { S.revealed[s] = 1; Net.reveal(S.code, n, s, bp.payload, bp.nonce).catch(function () { }); } });
    var allRev = ls.every(function (s) { return r[s]; });
    if (((S.host && (allRev || t >= lock.at + 10000)) || t >= lock.at + 20000) && !S.finTry[n]) {
      S.finTry[n] = 1; Net.finDay(S.code, n, ls.filter(function (s) { return r[s]; })).catch(function () { S.finTry[n] = 0; });
    }
    if (S.phase === 'prep') { S.phase = 'locked'; renderAll(); }
  }
  function prepBots(n) {
    if (!S || S.M.day !== n) return;
    S.bots.forEach(function (seat, i) {
      setTimeout(function () {
        if (!S || S.M.day !== n) return;
        var p = MT.player(S.M, seat); if (!p || p.out) return;
        var lv = Net.botLevels(S.code)[seat] || 'medium';
        var pk = TT.Bot.makePackage(S.M, seat, lv), payload = JSON.stringify(pk), nonce = rndHex();
        S.botPk[seat] = { payload: payload, nonce: nonce };
        Net.commit(S.code, n, seat, TT.fnv64(payload + '|' + nonce)).catch(function (e) { console.warn('bot commit', e); });
      }, i * 120);
    });
  }
  function rndHex() { var a = new Uint32Array(3); (G.crypto || G.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (x) { return x.toString(16); }).join(''); }
  function sessionGet(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function sessionSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function commitMine() {
    if (!S.P || S.committed) return;
    var n = S.M.day, pk = P.makePackage(S.P, S.cryLog), payload = JSON.stringify(pk);
    if (payload.length > 11800) { App.toast('Đội hình quá lớn để gửi — hãy gộp bớt đội', 'err'); return; }
    var nonce = rndHex(); S.pending = { payload: payload, nonce: nonce }; S.committed = true;
    sessionSet('ttkc.pend.' + S.code + '.' + n, S.pending);
    Net.commit(S.code, n, S.seat, TT.fnv64(payload + '|' + nonce)).catch(function (e) { S.committed = false; App.toast('Không gửi được: ' + (e.message || e), 'err'); renderAll(); });
    clearModes(); renderAll(); TT.Sound.play('click');
  }
  function uncommit() {
    var dd = S.days[S.M.day] || {}; if (dd.lock || !S.committed) return;
    S.committed = false; S.pending = null; sessionSet('ttkc.pend.' + S.code + '.' + S.M.day, null);
    Net.uncommit(S.code, S.M.day, S.seat).catch(function () { });
    renderAll();
  }
  /* mở gói, kiểm tra, mô phỏng giao tranh */
  function resolveDay(n, dd) {
    var M = S.M, fin = dd.fin, fs = fin.seats ? fin.seats.split(',').filter(Boolean) : [];
    M.players.forEach(function (p, i) {
      if (p.out) return;
      var rv = dd.r && dd.r[p.seat], cm = dd.c && dd.c[p.seat];
      if (fs.indexOf(p.seat) < 0 || !rv || !cm) { if (!p.bot && p.seat !== S.seat) log(esc(p.name) + ' giữ đội hình hôm trước', 'muted'); return; }
      if (TT.fnv64(rv.p + '|' + rv.n) !== cm) { log('Gói của ' + esc(p.name) + ' không khớp mã băm — dùng đội hình cũ', 'warn'); return; }
      try {
        var res = P.applyPackage(p, JSON.parse(rv.p), ctxOf(p));
        if (res.ok) M.players[i] = Object.assign(res.p, { side: p.side, team: p.team, bot: p.bot, name: p.name });
        else log('Gói của ' + esc(p.name) + ' sai luật (' + res.errs.join(', ') + ') — dùng đội hình cũ', 'warn');
      } catch (e) { log('Gói của ' + esc(p.name) + ' lỗi — dùng đội hình cũ', 'warn'); }
    });
    sessionSet('ttkc.pend.' + S.code + '.' + n, null);
    var input = MT.battleInput(M), Bh = TT.Battle.create(input), res = Bh.run();
    var summary = MT.endDay(M, res);
    S.lastRes = res; S.lastSummary = summary; S.results.push({ res: res, sum: summary });
    S.finAt = fin.at; S.dur = res.ticks * 50; S.nextPrep = fin.at + S.dur + RESULT;
    var t = now();
    if (t > S.nextPrep - 1500 || !S.field) { S.phase = 'result'; return; } // đang bắt kịp (tải lại trang)
    // phát lại có hình
    S.phase = 'battle'; clearModes();
    var B = TT.Battle.create(input), lag = Math.floor((t - fin.at) / 50);
    if (lag > 40) { for (var k = 0; k < lag && !B.ended; k++) { B.step(); B.events = []; } }
    S.battle = B; S.battleInput = input;
    S.field.setSpeed(S.speed);
    S.field.startBattle(B, { speed: S.speed, onEvent: onBattleEvent, onEnd: function () { if (S && S.battle === B) battleDone(); } });
    log('Giao tranh bắt đầu!', 'day');
    TT.Sound.play('turn');
    renderAll();
  }
  function onBattleEvent(e) {
    if (e.e === 'order') { var p = MT.player(S.M, e.seat); log((p ? esc(p.name) : '') + ' — Lệnh Soái: <b>' + esc(e.n) + '</b>', 'order'); if (e.seat === S.seat) centerMsg(e.n, 'Lệnh Soái', 1400); TT.Sound.play('skill'); }
    else if (e.e === 'tower') { var tp = S.M.players.filter(function (x) { return x.team === e.team; })[0]; if (tp) log(esc(tp.name) + ' chiếm tháp canh', 'order'); }
    else if (e.e === 'storm') { if (e.k === 1) { log('Hết 5 phút — sát thương bão tăng dần mỗi giây!', 'warn'); centerMsg('Bão chiến trường', 'Mỗi giây gây sát thương gấp đôi', 1600); } }
    else if (e.e === 'die' && Math.random() < .25) TT.Sound.play('hit');
  }
  function battleDone() {
    S.battle = null;
    // chơi một mình với bot: không cần chờ đồng hồ chung, bỏ qua giao tranh thì sang ngày sớm
    if (S.setup.players.filter(function (x) { return !x.bot; }).length === 1) S.nextPrep = Math.min(S.nextPrep, now() + RESULT);
    S.phase = S.M.over ? 'over-wait' : 'result';
    showResult();
    if (S.M.over) setTimeout(function () { if (S) showOver(); }, 2600);
    renderAll();
  }

  /* ================= sân 3D ================= */
  function initField() {
    if (!TT.webglOK || !TT.Field3D) { App.toast('Trình duyệt không hỗ trợ WebGL — không hiển thị được chiến trường 3D', 'err', 8000); return; }
    var f = S.field = new TT.Field3D($('#board'), $('#board-wrap'), { lowRes: lsGet('ttkc.gfx') === 'low' });
    f.seatColor = TT.SEAT_COLORS;
    f.onClick = onFieldClick; f.onRight = function () { clearModes(); renderAll(); };
    f.onDragStart = onDragStart; f.onDragMove = onDragMove; f.onDragEnd = onDragEnd;
    f.onHover = onHover; f.onHoverMove = onHover;
    $('#board').addEventListener('mouseleave', hideTip);
    if (S.M.day > 0) setupFieldForDay();
  }
  function setupFieldForDay() {
    var f = S.field, M = S.M; if (!f) return;
    var p = me(), side = p ? p.side : 0;
    if (f.map !== M.map) f.setMap(M.map, { mode: M.mode, zones: M.players.filter(function (x) { return !x.out; }).map(function (x) { return Object.assign({ color: TT.SEAT_COLORS[x.seat], mine: x.seat === S.seat }, TT.zoneOf(M.mode, x.side)); }) });
    if (S.phase !== 'battle') { f.stopBattle(); f.mode = 'prep'; f.setView(side, TT.zoneOf(M.mode, side)); }
    refreshField();
  }
  function prepUnits() {
    var list = [], M = S.M;
    var addSquads = function (p, ghost) {
      p.squads.forEach(function (q) {
        var pos = TT.Battle.formation(M.map, p.side, q.t, q.n, q.x, q.y), face = Math.atan2(TT.sideFwd[p.side][0], TT.sideFwd[p.side][1]);
        pos.forEach(function (ps, i) { list.push({ id: p.seat + ':' + q.id + ':' + i, race: p.race, role: q.t, x: ps[0] / 1000, y: ps[1] / 1000, face: face, seat: p.seat, cap: i === 0, sel: !ghost && S.sel === q.id, ghost: ghost, sq: ghost ? null : q.id, rad: ROLES[q.t].rad }); });
      });
    };
    M.players.forEach(function (p) { if (p.out || p.seat === S.seat) return; addSquads(p, true); });
    if (S.P) addSquads(S.P, false);
    return list;
  }
  function refreshField() {
    var f = S.field; if (!f || !f.map || S.phase === 'battle') return;
    f.setPrepUnits(prepUnits());
    f.showZones(true);
    var hl = { cells: [], paths: [], circles: [] };
    if (S.hoverCell) hl.hover = S.hoverCell, hl.hoverOk = S.hoverOk;
    // đường cờ của mọi đội ta (đội đang chọn rõ hơn)
    if (S.P) S.P.squads.forEach(function (q) {
      if (!q.fl.length) return;
      var pts = [[q.x + .5, q.y + .5]], cols = [], flags = [], dash = [];
      q.fl.forEach(function (fl) {
        if (fl.c === 'V') { var t = P.squadById(S.P, fl.sq); if (!t) return; pts.push([t.x + .5, t.y + .5]); cols.push('#ffd23a'); dash.push(1); }
        else { pts.push([fl.x + .5, fl.y + .5]); cols.push(fl.c === 'X' ? '#3d9cf0' : '#ff5d5d'); flags.push([fl.x + .5, fl.y + .5, fl.c === 'X' ? '#3d9cf0' : '#ff5d5d']); dash.push(0); }
      });
      if (S.sel !== q.id) cols = cols.map(function (c) { return c; });
      hl.paths.push({ pts: pts, cols: cols, flags: flags, dash: dash });
    });
    var sq = S.P && S.sel != null ? P.squadById(S.P, S.sel) : null;
    if (sq) { var n = sq.n, r = Math.max(1.2, Math.sqrt(n) * ROLES[sq.t].rad * 1.6 + .6); hl.circles.push({ x: sq.x + .5, y: sq.y + .5, r: r, color: '#ffffff' }); }
    f.setHL(hl);
  }

  /* ================= thao tác chuẩn bị ================= */
  function canPrep() { return S && S.P && S.phase === 'prep' && !S.committed && !(S.days[S.M.day] || {}).lock; }
  function doOp(c, quiet) {
    if (!canPrep()) { if (!quiet) App.toast(S.committed ? 'Bạn đã Sẵn sàng — bấm lại để sửa' : 'Đã hết giờ chuẩn bị', 'err'); return { ok: false }; }
    var snap = P.clone(S.P), n0 = S.cryLog.length;
    var r = P.apply(S.P, c, ctxOf(S.P));
    if (!r.ok) { S.P = snap; if (!quiet) { App.toast(r.err, 'err'); TT.Sound.play('err'); } return r; }
    S.undo.push({ p: snap, n: n0 }); if (S.undo.length > 60) S.undo.shift();
    if (P.CRY_CMDS[c.c]) S.cryLog.push(c);
    if (r.up) { var z = TT.zoneOf(S.M.mode, S.P.side); if (S.field) S.field.fxAt('level', (z.x0 + z.x1) / 2 + .5, (z.y0 + z.y1) / 2 + .5); centerMsg('Đời ' + TT.AGE_ROMAN[S.P.lv] + ' · ' + TT.AGE_NAME[S.P.lv], 'Mở khóa quân và trang bị mới', 1600); TT.Sound.play('age'); }
    renderAll();
    return r;
  }
  function undo() {
    if (!canPrep() || !S.undo.length) return;
    var u = S.undo.pop(); S.P = u.p; S.cryLog.length = u.n;
    if (S.sel != null && !P.squadById(S.P, S.sel)) S.sel = null;
    renderAll();
  }
  function clearModes() { S.buyRole = null; S.itemSel = null; S.flagMode = null; S.hoverCell = null; S.dragSq = null; $$('.bench .bcard.on, #g-items .on').forEach(function (e) { e.classList.remove('on'); }); }
  function inMyZone(cell) { return cell && S.P && TT.inZone(TT.zoneOf(S.M.mode, S.P.side), cell[0], cell[1]); }
  function myUnitAt(e) { var v = S.field && S.field.unitAt(e, 30); return v && v.sq != null && !v.ghost ? v : null; }
  function onFieldClick(cell, e) {
    if (!S || S.phase === 'battle' || S.phase === 'over') return;
    if (S.flagMode) { flagClick(cell, e); return; }
    if (S.buyRole) { if (cell && inMyZone(cell)) { var r = doOp({ c: 'buy', t: S.buyRole, k: e.shiftKey ? 5 : 1, x: cell[0], y: cell[1] }); if (r.ok) { TT.Sound.play('buy'); S.field.fxAt('buy', cell[0] + .5, cell[1] + .5, F[S.P.race].color); S.sel = r.sq; renderAll(); } } return; }
    var v = myUnitAt(e);
    if (S.itemSel != null) { if (v) equipItem(v.sq); return; }
    if (v) { S.sel = v.sq; TT.Sound.play('click'); }
    else S.sel = null;
    renderAll();
  }
  function onDragStart(cell, e) {
    if (!canPrep() || S.flagMode) return false;
    var v = myUnitAt(e); if (!v) return false;
    S.dragSq = v.sq; S.sel = v.sq; renderAll(); return true;
  }
  function onDragMove(cell) { S.hoverCell = cell; S.hoverOk = inMyZone(cell); refreshField(); }
  function onDragEnd(cell) {
    var id = S.dragSq; S.dragSq = null; S.hoverCell = null;
    if (id != null && cell && inMyZone(cell)) { var r = doOp({ c: 'move', sq: id, x: cell[0], y: cell[1] }); if (r.merged != null) { S.sel = r.merged; App.toast('Đã gộp đội', 'ok'); } }
    refreshField();
  }
  function equipItem(sqId) {
    var it = S.itemSel; S.itemSel = null;
    if (it == null) return;
    if (typeof it === 'number') doOp({ c: 'equip', idx: it, sq: sqId });
    else { var r = doOp({ c: 'buyItem', it: it, sq: sqId }); if (r.ok && r.warn) App.toast(r.warn, 'err'); }
    TT.Sound.play('coin');
  }
  /* Cờ Lệnh */
  function flagClick(cell, e) {
    var fm = S.flagMode, q = P.squadById(S.P, fm.sq); if (!q) { S.flagMode = null; renderAll(); return; }
    var fl = q.fl.slice();
    if (fm.type === 'V') {
      var v = myUnitAt(e); if (!v || v.sq === q.id) { App.toast('Bấm vào một đội khác của bạn để hộ tống', 'err'); return; }
      fl.push({ c: 'V', sq: v.sq, k: fm.k || 'sat' });
    } else { if (!cell) return; fl.push({ c: fm.type, x: cell[0], y: cell[1] }); }
    var r = doOp({ c: 'flags', sq: q.id, fl: fl }); if (r.ok) TT.Sound.play('click');
  }

  /* ================= kéo từ băng ghế / kho đồ ================= */
  function startDrag(e, kind, val, html) {
    if (!canPrep()) { App.toast(S.committed ? 'Bạn đã Sẵn sàng — bấm lại để sửa' : 'Chưa tới giờ chuẩn bị', 'err'); return; }
    e.preventDefault();
    var ghost = $('#drag-ghost'), sx = e.clientX, sy = e.clientY, moved = false;
    ghost.innerHTML = html; ghost.classList.remove('hidden'); ghost.style.transform = 'translate(' + (sx - 26) + 'px,' + (sy - 26) + 'px)';
    document.body.classList.add('dragging');
    var mv = function (ev) {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) moved = true;
      ghost.style.transform = 'translate(' + (ev.clientX - 26) + 'px,' + (ev.clientY - 26) + 'px)';
      var over = document.elementFromPoint(ev.clientX, ev.clientY), onField = over && over.id === 'board';
      var cell = onField && S.field ? S.field.cellAt(ev) : null;
      if (kind === 'unit') { S.hoverCell = cell; S.hoverOk = inMyZone(cell); ghost.classList.toggle('ok', !!S.hoverOk); refreshField(); }
      else { var v = onField ? myUnitAt(ev) : null; ghost.classList.toggle('ok', !!v); S.field && S.field.setPrepUnits(prepUnits().map(function (u) { if (v && u.sq === v.sq) u.sel = true; return u; })); }
    };
    var up = function (ev) {
      G.removeEventListener('pointermove', mv); G.removeEventListener('pointerup', up);
      ghost.classList.add('hidden'); document.body.classList.remove('dragging');
      var over = document.elementFromPoint(ev.clientX, ev.clientY), onField = over && over.id === 'board';
      S.hoverCell = null;
      if (!moved) { // bấm (không kéo): chọn chế độ đặt liên tục
        if (kind === 'unit') { S.buyRole = S.buyRole === val ? null : val; S.itemSel = null; }
        else { S.itemSel = S.itemSel === val ? null : val; S.buyRole = null; if (S.itemSel != null && S.sel != null) { equipItem(S.sel); } }
        renderAll(); return;
      }
      if (onField && S.field) {
        if (kind === 'unit') { var cell = S.field.cellAt(ev); if (inMyZone(cell)) { var r = doOp({ c: 'buy', t: val, k: ev.shiftKey ? 5 : 1, x: cell[0], y: cell[1] }); if (r.ok) { TT.Sound.play('buy'); S.field.fxAt('buy', cell[0] + .5, cell[1] + .5, F[S.P.race].color); S.sel = r.sq; } } else App.toast('Thả quân vào vùng xuất quân của bạn (ô sáng màu)', 'err'); }
        else { var v = myUnitAt(ev); if (v) { S.itemSel = val; equipItem(v.sq); } else App.toast('Thả trang bị lên một đội của bạn', 'err'); }
      }
      renderAll();
    };
    G.addEventListener('pointermove', mv); G.addEventListener('pointerup', up);
  }

  /* ================= tooltip ================= */
  function onHover(cell, e) {
    if (!S || !S.field || !e) { hideTip(); return; }
    var v = S.field.unitAt(e, 22), html = '';
    if (v) html = unitTip(v);
    else if (cell && S.field.map) { var t = S.field.map.g[cell[1] * S.field.map.W + cell[0]], T0 = TT.TERRAIN[t]; if (T0 && (t !== '.' || S.buyRole || S.dragSq != null)) html = '<b>' + T0.name + '</b><div class="tt-d">' + T0.desc + '</div>'; }
    if (S.buyRole || S.dragSq != null) { if (cell) { S.hoverCell = cell; S.hoverOk = inMyZone(cell); refreshField(); } }
    if (html) showTip(html, e.clientX, e.clientY); else hideTip();
  }
  function unitTip(v) {
    var race = v.race, role = v.role, u = v.u, R = ROLES[role] || {};
    if (u && u.monster) return '<b>' + esc(u.name) + '</b><div class="tt-d">Quái trung lập — đánh mọi bên tới gần. Hạ quái nhiều nhất nhận Tinh thể.</div><div class="tt-s">Máu ' + u.hp + '/' + u.mhp + '</div>';
    var ud = TT.UNITS[race + '.' + role] || {}, f = F[race];
    var h = '<div class="tt-h" style="--fc:' + f.color + '">' + I.role(role, '#fff', 18) + '<b>' + esc(ud.name || R.name) + '</b><span>' + f.short + ' · ' + R.name + ' · ' + TT.CLS_NAME[R.cls] + '</span></div>';
    var st;
    if (u) st = { hp: u.hp + '/' + u.mhp, atk: u.atk, def: u.def, as: (u.as / 100).toFixed(2), rng: (u.rng / 1000).toFixed(1), mp: u.mp + '/' + u.mmp };
    else {
      var owner = v.ghost ? MT.player(S.M, v.seat) : S.P, q = owner && P.squadById(owner, +String(v.id).split(':')[1]);
      if (owner && q) { var ps = TT.Battle.previewStats(ctxOf(owner), owner, q, v.cap); st = { hp: ps.hp, atk: ps.atk, def: ps.def, as: ps.as.toFixed(2), rng: ps.rng.toFixed(1), mp: ps.mp0 + '/' + ps.mp, n: q.n, it: q.it }; }
    }
    if (st) h += '<div class="tt-s"><span>' + I.ui('heart', 11) + ' ' + st.hp + '</span><span>' + I.ui('swords', 11) + ' ' + st.atk + '</span><span>' + I.ui('shield', 11) + ' ' + st.def + '</span><span>Tốc ' + st.as + '</span><span>Tầm ' + st.rng + '</span><span>MP ' + st.mp + '</span></div>';
    if (st && st.n) h += '<div class="tt-d">Đội ' + st.n + ' quân' + (v.cap ? ' · <b style="color:#ffcf3a">đội trưởng</b>' : '') + (st.it && st.it.length ? ' · ' + st.it.map(function (k) { return TT.ITEMS[k].name; }).join(', ') : '') + (v.ghost ? ' · <i>đội hình hôm qua</i>' : '') + '</div>';
    h += '<div class="tt-p"><b>Nội tại:</b> ' + esc(ud.psd || '') + '</div>';
    if (ud.sk) h += '<div class="tt-p"><b>' + esc(ud.sk.name) + '</b> (đầy MP): ' + esc(ud.sk.desc) + '</div>';
    return h;
  }
  function showTip(html, x, y) {
    var t = $('#tip-box'); t.innerHTML = html; t.classList.remove('hidden');
    var w = t.offsetWidth, h = t.offsetHeight, vw = innerWidth, vh = innerHeight;
    t.style.left = Math.max(6, Math.min(vw - w - 6, x + 16)) + 'px'; t.style.top = Math.max(6, Math.min(vh - h - 6, y + 18)) + 'px';
  }
  function hideTip() { var t = $('#tip-box'); if (t) t.classList.add('hidden'); }
  function tipFor(el, html) {
    el.addEventListener('mouseenter', function (e) { showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY); });
    el.addEventListener('mousemove', function (e) { showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY); });
    el.addEventListener('mouseleave', hideTip);
  }

  /* ================= HUD ================= */
  function renderAll() {
    if (!S || App.screen !== 'game') return;
    renderTop(); renderMe(); renderPlayers(); renderBench(); renderDock(); renderSquad(); renderFlagBar(); refreshField();
    document.body.classList.toggle('in-battle', S.phase === 'battle');
    document.body.classList.toggle('prep-locked', !canPrep());
    if (Game.layout) Game.layout();
  }
  function renderTop() {
    var M = S.M, di = MT.dayInfo(M, Math.max(1, M.day)), wt = TT.WEATHER[M.weather] || TT.WEATHER.quang;
    var parts = '<span class="dn">Ngày <b>' + Math.max(1, M.day) + '</b>/10</span>';
    if (di.kind !== 'normal') parts += '<span class="ph kind-' + di.kind + '">' + esc(di.name) + '</span>';
    parts += '<span class="ph" data-tip="night">' + I.ui(di.night ? 'moon' : 'sun', 13) + (di.night ? ' Đêm' : ' Ngày') + '</span>';
    parts += '<span class="ph" data-tip="weather">' + I.ui(M.weather === 'mua' ? 'rain' : M.weather === 'gio' ? 'wind' : 'sun', 13) + ' ' + wt.name + '</span>';
    if (M.event) parts += '<span class="ph ev" data-tip="event">' + I.ui('star', 12) + ' ' + TT.EVENTS[M.event].name + '</span>';
    if (M.map) parts += '<span class="ph map" data-tip="map">' + esc(M.map.name) + '</span>';
    $('#day-banner').innerHTML = parts;
    $$('#day-banner [data-tip]').forEach(function (el) {
      var k = el.dataset.tip;
      tipFor(el, function () { if (k === 'weather') return '<b>' + wt.name + '</b><div class="tt-d">' + wt.desc + '</div>'; if (k === 'event') return '<b>' + TT.EVENTS[M.event].name + '</b><div class="tt-d">' + TT.EVENTS[M.event].desc + '</div>'; if (k === 'map') return '<b>' + esc(M.map.name) + '</b><div class="tt-d">' + ((TT.MAPS[M.map.key] || {}).desc || '') + '</div>'; return '<b>' + (di.night ? 'Ban đêm' : 'Ban ngày') + '</b><div class="tt-d">' + (di.night ? 'Tiên và Quỷ +4% ATK.' : 'Rồng và Nhân +4% ATK.') + '</div>'; });
    });
    var prep = S.phase === 'prep' || S.phase === 'locked' || S.phase === 'load';
    $('#prep-ctrl').classList.toggle('hidden', !prep || !S.P);
    $('#battle-ctrl').classList.toggle('hidden', S.phase !== 'battle');
    var rb = $('#btn-go'), dd = S.days[S.M.day] || {};
    if (S.P) {
      rb.disabled = !!dd.lock;
      rb.innerHTML = dd.lock ? 'Đã khóa' : S.committed ? I.ui('check', 16) + ' Sẵn sàng' : 'Sẵn sàng';
      rb.className = 'btn end-btn ' + (S.committed ? 'teal' : 'gold');
      rb.title = S.committed ? 'Bấm để bỏ sẵn sàng và sửa đội hình' : 'Khóa đội hình (Space)';
    }
    $('#btn-undo').disabled = !canPrep() || !S.undo.length;
    $('#btn-auto').disabled = !canPrep();
    $$('#speed-btns button').forEach(function (b) { b.classList.toggle('active', +b.dataset.s === S.speed); });
  }
  function tickUI() {
    if (!S || App.screen !== 'game') return;
    var t = now(), tm = $('#phase-timer'), fill = tm.querySelector('.fill'), span = tm.querySelector('span');
    if (S.phase === 'battle' && S.battle && S.field && !S.field.ended && t > S.finAt + S.dur + 600) S.field.skipBattle(); // máy chậm: bắt kịp đồng hồ chung
    if (S.phase === 'battle' && S.battle) {
      var sec = Math.floor(S.battle.tick / 20), m = Math.floor(sec / 60), s = sec % 60;
      span.textContent = 'Giao tranh ' + m + ':' + ('0' + s).slice(-2) + (S.battle.storm ? ' · Bão ×' + S.battle.storm : '');
      fill.style.width = Math.min(100, sec / CFG.battleMaxSec * 100) + '%'; tm.classList.toggle('low', !!S.battle.storm);
      if (t % 1000 < 260) renderPlayers();
    } else if (S.M.day > 0 && (S.phase === 'prep' || S.phase === 'locked')) {
      var dd = S.days[S.M.day] || {};
      if (t < S.prepStart) { span.textContent = 'Chuẩn bị bắt đầu…'; fill.style.width = '100%'; }
      else if (dd.lock) { span.textContent = 'Đang chờ mọi người mở đội hình…'; fill.style.width = '0%'; }
      else { var left = Math.max(0, S.deadline - t), tot = S.deadline - S.prepStart; span.textContent = 'Chuẩn bị ' + fmtS(left); fill.style.width = Math.max(0, left / tot * 100) + '%'; tm.classList.toggle('low', left < 10000); }
      if (t % 1000 < 260) renderPlayers();
    } else if (S.phase === 'result' || S.phase === 'over-wait') {
      var l2 = Math.max(0, S.nextPrep - t); span.textContent = S.M.over ? 'Kết thúc ván' : 'Ngày mới sau ' + fmtS(l2); fill.style.width = (l2 / RESULT * 100) + '%'; tm.classList.remove('low');
      var rc = $('#res-count'); if (rc) rc.textContent = S.M.over ? '' : fmtS(l2);
    } else { span.textContent = S.M.over ? 'Kết thúc ván' : 'Đang chờ trận bắt đầu…'; fill.style.width = '100%'; }
  }
  function fmtS(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }
  function resPills(res) { return '<span class="rp cV">' + I.svg('resV', null, 16) + '<b>' + res.V + '</b></span><span class="rp cT">' + I.svg('resT', null, 16) + '<b>' + res.T + '</b></span><span class="rp cG">' + I.svg('resG', null, 16) + '<b>' + res.G + '</b></span>'; }
  function renderMe() {
    var el = $('#g-me'), p = S.P || me();
    if (!p) { el.innerHTML = '<div class="me-top"><b>Đang xem</b></div>'; return; }
    var f = F[p.race], need = P.xpNeed(p), cap = P.capacity(p), used = P.usedPop(p);
    var interest = Math.min(CFG.cryInterestMax + P.hasCoreFx(p, 'interestAdd'), Math.floor(p.cry / CFG.cryInterestPer));
    el.innerHTML = '<div class="me-top">' + I.crest(p.race, 40) + '<div><div class="me-name">' + esc(p.name) + '</div><div class="me-sub" style="color:' + f.color + '">' + f.name + '</div></div>' +
      '<div class="age-box" title="Đời quyết định Sức chứa, quân và trang bị được mở"><div class="age-pill">Đời ' + TT.AGE_ROMAN[p.lv] + ' · ' + TT.AGE_NAME[p.lv] + '</div>' + (need ? '<div class="xpbar"><i style="width:' + Math.round(p.xp / need * 100) + '%"></i><span>' + p.xp + '/' + need + ' EXP</span></div>' : '<div class="xpbar max"><span>Tối đa</span></div>') + '</div></div>' +
      '<div class="me-res">' + resPills(p.res) + '<span class="rp cC" id="cry-pill">' + I.svg('cry', null, 16) + '<b>' + p.cry + '</b></span></div>' +
      '<div class="me-row"><span class="pop' + (used >= cap ? ' full' : '') + '" id="pop-pill">' + I.ui('worker', 13) + ' Dân số <b>' + used + '/' + cap + '</b></span>' +
      (need ? '<button class="btn small gold" id="btn-xp" ' + (canPrep() && p.cry >= CFG.xpBuyCost ? '' : 'disabled') + '>' + I.ui('arrowup', 12) + ' +' + CFG.xpBuyAmount + ' EXP · ' + CFG.xpBuyCost + I.svg('cry', null, 12) + '</button>' : '') + '</div>';
    var bx = $('#btn-xp'); if (bx) bx.onclick = function () { doOp({ c: 'xp' }); TT.Sound.play('coin'); };
    tipFor($('#cry-pill'), '<b>Tinh thể</b><div class="tt-d">Dùng để mua EXP lên Đời, mua và đổi Lõi. Mỗi ngày +' + CFG.cryDaily + ' và lãi: mỗi ' + CFG.cryInterestPer + ' Tinh thể đang giữ +1 (tối đa +' + CFG.cryInterestMax + '). Lãi ngày mai: <b>+' + interest + '</b>.</div>');
    tipFor($('#pop-pill'), '<b>Dân số / Sức chứa</b><div class="tt-d">Tổng dân số quân trên sân. Lên Đời để tăng Sức chứa (12 / 20 / 30 / 42' + (p.race === 'human' ? ', Nhân tộc thêm' : '') + ').</div>');
    tipFor($$('.me-res .rp')[0], '<b>Tài nguyên</b><div class="tt-d">Mọi người nhận như nhau mỗi ngày và tăng dần theo ngày. Dư được giữ sang ngày sau (không có lãi). Bán quân hay trang bị hoàn lại 100%.</div>');
  }
  function renderPlayers() {
    var M = S.M, B = S.phase === 'battle' ? S.battle : null, dd = S.days[M.day] || {}, c = dd.c || {};
    var st = MT.standings(M);
    $('#g-players').innerHTML = st.map(function (s, i) {
      var p = MT.player(M, s.seat), f = F[p.race], extra = '';
      if (B) { var al = 0, hp = 0, mh = 0; B.units.forEach(function (u) { if (u.seat === p.seat && !u.monster) { mh += u.mhp; if (u.alive) { al++; hp += u.hp; } } }); extra = '<div class="pc-hp"><i style="width:' + (mh ? hp / mh * 100 : 0) + '%;background:' + TT.SEAT_COLORS[p.seat] + '"></i></div><span class="pc-al">' + al + ' quân</span>'; }
      else if (M.phase === 'prep') extra = c[p.seat] ? '<span class="pc-rd">' + I.ui('check', 12) + '</span>' : '<span class="pc-rd no">' + I.ui('sleep', 12) + '</span>';
      return '<div class="pchip' + (p.out ? ' dead' : '') + (p.seat === S.seat ? ' me' : '') + '" style="--pc:' + TT.SEAT_COLORS[p.seat] + '">' +
        '<span class="pc-rank">' + (i + 1) + '</span>' + I.crest(p.race, 26) + '<div class="pc-body"><div class="pc-name">' + esc(p.name) + '</div><div class="pc-sub">' + f.short + ' · Đời ' + TT.AGE_ROMAN[p.lv] + (s.last ? ' · hôm qua hạng ' + s.last : '') + '</div>' + (B ? extra : '') + '</div>' +
        '<div class="pc-pts"><b>' + s.pts + '</b><small>điểm</small></div>' + (!B ? extra : '') + '</div>';
    }).join('');
  }
  function costHtml(c, res) { return ['V', 'T', 'G'].filter(function (k) { return c[k]; }).map(function (k) { return '<span class="c' + k + (res && res[k] < c[k] ? ' no' : '') + '">' + c[k] + I.svg('res' + k, null, 11) + '</span>'; }).join(''); }
  function renderBench() {
    var el = $('#g-bench'), p = S.P;
    if (!p || /battle|over/.test(S.phase)) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var free = P.capacity(p) - P.usedPop(p);
    el.innerHTML = '<div class="bench-title">' + I.ui('swords', 13) + ' Băng ghế · kéo quân thả lên sân</div><div class="bench-row">' + TT.ROLE_ORDER.map(function (r) {
      var R = ROLES[r], lock = R.age > p.lv, cost = TT.unitCost(p.race, r), aff = p.res.V >= cost.V && p.res.T >= cost.T && p.res.G >= cost.G, room = free >= R.pop;
      var uniq = R.unique && p.squads.some(function (q) { return q.t === r; });
      return '<div class="bcard' + (lock ? ' lock' : '') + (!lock && (!aff || !room || uniq) ? ' no' : '') + (S.buyRole === r ? ' on' : '') + '" data-r="' + r + '" style="--fc:' + F[p.race].color + '">' +
        '<div class="bc-ic">' + I.role(r, '#fff', 30) + '</div><div class="bc-n">' + esc(TT.unitName(p.race, r)) + '</div><div class="bc-c">' + costHtml(cost, p.res) + '</div><div class="bc-pop">' + R.pop + ' dân</div>' +
        (lock ? '<div class="bc-lock">' + I.ui('lock', 12) + ' Đời ' + TT.AGE_ROMAN[R.age] + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    $$('.bcard', el).forEach(function (b) {
      var r = b.dataset.r;
      b.addEventListener('pointerdown', function (e) { if (b.classList.contains('lock')) { App.toast('Cần Đời ' + TT.AGE_ROMAN[ROLES[r].age] + ' — mua EXP để lên Đời', 'err'); return; } startDrag(e, 'unit', r, '<div class="dg-ic" style="--fc:' + F[p.race].color + '">' + I.role(r, '#fff', 32) + '</div>'); });
      tipFor(b, function () { return benchTip(r); });
    });
  }
  function benchTip(r) {
    var p = S.P, R = ROLES[r], ud = TT.UNITS[p.race + '.' + r] || {};
    return '<div class="tt-h" style="--fc:' + F[p.race].color + '">' + I.role(r, '#fff', 18) + '<b>' + esc(ud.name || R.name) + '</b><span>' + R.name + ' · Đời ' + TT.AGE_ROMAN[R.age] + ' · ' + TT.CLS_NAME[R.cls] + '</span></div>' +
      '<div class="tt-s"><span>' + I.ui('heart', 11) + ' ' + R.hp + '</span><span>' + I.ui('swords', 11) + ' ' + R.atk + '</span><span>' + I.ui('shield', 11) + ' ' + R.def + '</span><span>Tầm ' + R.rng + '</span><span>Tốc di ' + R.spd + '</span><span>' + R.pop + ' dân</span></div>' +
      '<div class="tt-p"><b>Nội tại:</b> ' + esc(ud.psd || '') + '</div>' + (ud.sk ? '<div class="tt-p"><b>' + esc(ud.sk.name) + ':</b> ' + esc(ud.sk.desc) + '</div>' : '') +
      '<div class="tt-d muted">Kéo thả vào vùng xuất quân để mua 1 quân (giữ Shift: 5 quân). Thả lên đội cùng loại để gộp. Bán hoàn 100%.</div>';
  }
  function renderDock() {
    var p = S.P, dk = $('#g-dock');
    if (!p || /battle|over/.test(S.phase)) { dk.classList.add('hidden'); return; }
    dk.classList.remove('hidden');
    $$('#g-dock .dock-tabs [data-d]').forEach(function (b) { b.classList.toggle('active', b.dataset.d === S.dock); });
    $('#g-items').classList.toggle('hidden', S.dock !== 'item'); $('#g-cores').classList.toggle('hidden', S.dock !== 'core');
    // trang bị
    var inv = p.inv.map(function (k, i) { return '<div class="inv-it' + (S.itemSel === i ? ' on' : '') + '" data-i="' + i + '">' + I.item(k, 22) + '<button class="x" data-sell="' + i + '" title="Bán (hoàn 100%)">' + I.ui('coin', 10) + '</button></div>'; }).join('');
    var shop = [1, 2, 3, 4].map(function (t) {
      var lock = t > p.lv;
      return '<div class="it-tier' + (lock ? ' lock' : '') + '"><div class="it-th">Bậc ' + TT.AGE_ROMAN[t] + (lock ? ' · ' + I.ui('lock', 10) + ' Đời ' + TT.AGE_ROMAN[t] : '') + '</div><div class="it-row">' +
        TT.ITEM_ORDER.filter(function (k) { return TT.ITEMS[k].tier === t; }).map(function (k) { var it = TT.ITEMS[k], aff = p.res.V >= it.cost.V && p.res.T >= it.cost.T && p.res.G >= it.cost.G; return '<div class="shop-it' + (lock ? ' lock' : !aff ? ' no' : '') + (S.itemSel === k ? ' on' : '') + '" data-k="' + k + '">' + I.item(k, 22) + '<div class="si-c">' + costHtml(it.cost) + '</div></div>'; }).join('') + '</div></div>';
    }).join('');
    $('#g-items').innerHTML = '<div class="inv"><span class="inv-l">Kho đồ</span>' + (inv || '<span class="muted small">trống — mua trang bị rồi kéo lên đội</span>') + '</div>' + shop;
    $$('#g-items .inv-it').forEach(function (d) { var i = +d.dataset.i; d.addEventListener('pointerdown', function (e) { if (e.target.closest('.x')) return; startDrag(e, 'item', i, '<div class="dg-ic">' + I.item(p.inv[i], 30) + '</div>'); }); tipFor(d, function () { return itemTip(p.inv[i], 'Kéo lên một đội để gắn cho đội trưởng.'); }); });
    $$('#g-items [data-sell]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); doOp({ c: 'sellItem', idx: +b.dataset.sell }); TT.Sound.play('coin'); hideTip(); }; });
    $$('#g-items .shop-it').forEach(function (d) {
      var k = d.dataset.k;
      d.addEventListener('pointerdown', function (e) { if (d.classList.contains('lock')) { App.toast('Cần Đời ' + TT.AGE_ROMAN[TT.ITEMS[k].tier], 'err'); return; } startDrag(e, 'item', k, '<div class="dg-ic">' + I.item(k, 30) + '</div>'); });
      d.addEventListener('dblclick', function () { doOp({ c: 'buyItem', it: k }); });
      tipFor(d, function () { return itemTip(k, 'Kéo lên đội để mua và gắn ngay; bấm đúp để mua vào kho.'); });
    });
    // lõi
    var slots = P.coreSlots(p);
    var owned = p.cores.map(function (id, i) { var C = TT.CORES[id]; return '<div class="core-own t' + C.tier + '" data-i="' + i + '">' + I.coreIcon(id, 18) + '<span>' + esc(C.name) + '</span><button class="x" data-csell="' + i + '" title="Bán (hoàn 50%)">' + I.ui('coin', 10) + '</button></div>'; }).join('');
    for (var e = p.cores.length; e < slots; e++) owned += '<div class="core-own empty">trống</div>';
    var board = p.board.map(function (id, i) {
      if (!id) return '<div class="core-card empty"></div>';
      var C = TT.CORES[id], cost = CFG.coreCost[C.tier];
      return '<div class="core-card t' + C.tier + (p.cry < cost ? ' no' : '') + '" data-s="' + i + '"><div class="cc-top">' + I.coreIcon(id, 22) + '<span class="cc-tier">' + TT.TIER_NAME[C.tier] + '</span><button class="lk' + (p.locks[i] ? ' on' : '') + '" data-lk="' + i + '" title="Khóa giữ qua lần đổi">' + I.ui('lock', 11) + '</button></div><div class="cc-n">' + esc(C.name) + '</div><div class="cc-d">' + esc(C.desc) + '</div><div class="cc-c">' + cost + I.svg('cry', null, 12) + '</div></div>';
    }).join('');
    $('#g-cores').innerHTML = '<div class="core-owned"><span class="inv-l">Lõi ' + p.cores.length + '/' + slots + '</span>' + owned + '</div><div class="core-board">' + board + '</div>' +
      '<div class="core-act"><button class="btn small" id="btn-reroll">' + I.ui('rotr', 12) + ' Đổi bảng · ' + (p.freeRr > 0 ? 'miễn phí (' + p.freeRr + ')' : CFG.rerollCost + I.svg('cry', null, 11)) + '</button><span class="muted small">Lõi tự áp dụng cho quân phù hợp</span></div>';
    $$('#g-cores .core-card[data-s]').forEach(function (d) { d.onclick = function (e) { if (e.target.closest('.lk')) return; var r = doOp({ c: 'core', slot: +d.dataset.s }); if (r.ok) TT.Sound.play('coin'); hideTip(); }; tipFor(d, function () { var C = TT.CORES[p.board[+d.dataset.s]]; return C ? '<b>' + esc(C.name) + '</b> · ' + TT.TIER_NAME[C.tier] + '<div class="tt-d">' + esc(C.desc) + '</div><div class="tt-d muted">Bấm để mua. Bán lại hoàn 50%.</div>' : ''; }); });
    $$('#g-cores [data-lk]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); doOp({ c: 'lock', slot: +b.dataset.lk }); }; });
    $$('#g-cores [data-csell]').forEach(function (b) { b.onclick = function () { doOp({ c: 'sellCore', idx: +b.dataset.csell }); hideTip(); }; });
    $$('#g-cores .core-own[data-i]').forEach(function (d) { tipFor(d, function () { var C = TT.CORES[p.cores[+d.dataset.i]]; return C ? '<b>' + esc(C.name) + '</b><div class="tt-d">' + esc(C.desc) + '</div>' : ''; }); });
    var rr = $('#btn-reroll'); if (rr) rr.onclick = function () { doOp({ c: 'reroll' }); TT.Sound.play('dice'); };
  }
  function itemTip(k, hint) { var it = TT.ITEMS[k]; return '<div class="tt-h">' + I.item(k, 18) + '<b>' + it.name + '</b><span>Bậc ' + TT.AGE_ROMAN[it.tier] + ' · ' + (it.aura ? 'Hào quang cả đội' : 'Cho đội trưởng') + '</span></div><div class="tt-d">' + it.desc + '</div><div class="tt-d">Giá ' + costHtml(it.cost) + ' · bán hoàn 100%</div>' + (hint ? '<div class="tt-d muted">' + hint + '</div>' : ''); }
  function renderSquad() {
    var el = $('#g-squad'), p = S.P, q = p && S.sel != null ? P.squadById(p, S.sel) : null;
    if (!q || /battle|over/.test(S.phase)) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var R = ROLES[q.t], ud = TT.UNITS[p.race + '.' + q.t] || {}, ps = TT.Battle.previewStats(ctxOf(p), p, q, true), pn = TT.Battle.previewStats(ctxOf(p), p, q, false), slots = P.itemSlots(p), cost = TT.unitCost(p.race, q.t);
    var items = ''; for (var i = 0; i < slots; i++) items += q.it[i] ? '<div class="sq-it" data-slot="' + i + '" title="Bấm: tháo về kho · Shift+bấm: bán">' + I.item(q.it[i], 22) + '</div>' : '<div class="sq-it empty" title="Kéo trang bị vào đây (lên đội)">+</div>';
    var flags = q.fl.map(function (f, i) { return '<span class="fl-chip ' + f.c + '">' + (i + 1) + '. ' + (f.c === 'X' ? 'Xanh' : f.c === 'D' ? 'Đỏ' : 'Vàng → ' + esc(TT.unitName(p.race, (P.squadById(p, f.sq) || {}).t || 'linh'))) + '</span>'; }).join('');
    el.innerHTML = '<div class="sq-head" style="--fc:' + F[p.race].color + '"><div class="sq-ic">' + I.role(q.t, '#fff', 30) + '</div><div><div class="sq-n">' + esc(ud.name || R.name) + ' <b>×' + q.n + '</b></div><div class="sq-s">' + R.name + ' · ' + TT.CLS_NAME[R.cls] + ' · ' + R.pop * q.n + ' dân</div></div><button class="win-x" id="sq-close">' + I.ui('close', 12) + '</button></div>' +
      '<div class="sq-stats"><span>' + I.ui('heart', 11) + ' ' + pn.hp + '</span><span>' + I.ui('swords', 11) + ' ' + pn.atk + '</span><span>' + I.ui('shield', 11) + ' ' + pn.def + '</span><span>Tốc ' + pn.as.toFixed(2) + '</span><span>Tầm ' + pn.rng + '</span><span>Di ' + pn.spd + '</span></div>' +
      (q.it.length ? '<div class="sq-cap">Đội trưởng: ' + I.ui('heart', 10) + ' ' + ps.hp + ' · ' + I.ui('swords', 10) + ' ' + ps.atk + ' · ' + I.ui('shield', 10) + ' ' + ps.def + '</div>' : '') +
      '<div class="sq-items"><span class="inv-l">Trang bị</span>' + items + '</div>' +
      '<div class="sq-txt"><b>Nội tại:</b> ' + esc(ud.psd || '') + '</div>' + (ud.sk ? '<div class="sq-txt"><b>' + esc(ud.sk.name) + ':</b> ' + esc(ud.sk.desc) + '</div>' : '') +
      '<div class="sq-lbl">Tư thế</div><div class="seg sq-stance">' + TT.STANCE_ORDER.map(function (k) { return '<button data-st="' + k + '" class="' + (q.st === k ? 'active' : '') + '" title="' + TT.STANCES[k].desc + '">' + TT.STANCES[k].name + '</button>'; }).join('') + '</div>' +
      (q.n > 1 ? '<div class="sq-lbl">Tách đội</div><div class="sq-split"><input type="range" min="1" max="' + (q.n - 1) + '" value="' + Math.floor(q.n / 2) + '" id="sq-k"><b id="sq-kv">' + Math.floor(q.n / 2) + '</b><button class="btn small" id="sq-split">' + I.ui('split', 12) + ' Tách</button></div>' : '') +
      '<div class="sq-lbl">Cờ Lệnh <small class="muted">' + q.fl.length + '/' + P.flagSteps(p) + ' bước</small></div><div class="sq-flags">' + (flags || '<span class="muted small">Không cắm cờ: đội tự đánh theo tư thế.</span>') + '</div>' +
      '<div class="sq-act"><button class="btn small" id="sq-flag">' + I.ui('flag', 12) + ' Cắm cờ</button>' + (q.fl.length ? '<button class="btn small ghost" id="sq-unflag">Xóa cờ</button>' : '') +
      '<button class="btn small" id="sq-buy1" title="Mua thêm 1">+1</button><button class="btn small" id="sq-sell1" title="Bán 1 (hoàn ' + TT.costSum(cost) + ')">−1</button><button class="btn small red" id="sq-sellall">' + I.ui('coin', 12) + ' Bán hết</button></div>';
    $('#sq-close').onclick = function () { S.sel = null; renderAll(); };
    $$('.sq-stance button', el).forEach(function (b) { b.onclick = function () { doOp({ c: 'stance', sq: q.id, s: b.dataset.st }); }; tipFor(b, '<b>' + TT.STANCES[b.dataset.st].name + '</b><div class="tt-d">' + TT.STANCES[b.dataset.st].desc + '</div>'); });
    var k = $('#sq-k'); if (k) { k.oninput = function () { $('#sq-kv').textContent = k.value; }; $('#sq-split').onclick = function () { var r = doOp({ c: 'split', sq: q.id, k: +k.value }); if (r.ok) S.sel = r.sq, renderAll(); }; }
    $('#sq-flag').onclick = function () { S.flagMode = { sq: q.id, type: 'D', k: 'sat' }; S.buyRole = null; S.itemSel = null; renderAll(); };
    var uf = $('#sq-unflag'); if (uf) uf.onclick = function () { doOp({ c: 'flags', sq: q.id, fl: [] }); };
    $('#sq-buy1').onclick = function () { var r = doOp({ c: 'buy', t: q.t, k: 1, x: q.x, y: q.y }); if (r.ok) TT.Sound.play('buy'); };
    $('#sq-sell1').onclick = function () { doOp({ c: 'sell', sq: q.id, k: 1 }); if (!P.squadById(S.P, q.id)) S.sel = null; TT.Sound.play('coin'); renderAll(); };
    $('#sq-sellall').onclick = function () { doOp({ c: 'sell', sq: q.id, k: q.n }); S.sel = null; TT.Sound.play('coin'); renderAll(); };
    $$('.sq-it[data-slot]', el).forEach(function (d) { d.onclick = function (e) { doOp({ c: e.shiftKey ? 'sellEquip' : 'unequip', sq: q.id, slot: +d.dataset.slot }); hideTip(); }; tipFor(d, function () { return itemTip(q.it[+d.dataset.slot], 'Bấm: tháo về kho · Shift+bấm: bán'); }); });
  }
  function renderFlagBar() {
    var el = $('#flag-bar'), fm = S.flagMode;
    if (!fm || !S.P) { el.classList.add('hidden'); return; }
    var q = P.squadById(S.P, fm.sq); if (!q) { S.flagMode = null; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '<span class="fb-t">' + I.ui('flag', 14) + ' Cờ cho <b>' + esc(TT.unitName(S.P.race, q.t)) + ' ×' + q.n + '</b> · ' + q.fl.length + '/' + P.flagSteps(S.P) + '</span>' +
      ['X', 'D', 'V'].map(function (t) { return '<button class="fb-b ' + t + (fm.type === t ? ' on' : '') + '" data-t="' + t + '">' + TT.FLAGS[t].name.split(' · ')[0] + '<small>' + TT.FLAGS[t].name.split(' · ')[1] + '</small></button>'; }).join('') +
      (fm.type === 'V' ? '<div class="seg fb-k">' + [['sat', 'Sát cánh'], ['bv', 'Bảo vệ'], ['theo', 'Theo sau']].map(function (k) { return '<button data-k="' + k[0] + '" class="' + (fm.k === k[0] ? 'active' : '') + '">' + k[1] + '</button>'; }).join('') + '</div>' : '') +
      '<span class="fb-h">' + (fm.type === 'V' ? 'Bấm vào đội được hộ tống' : 'Bấm lên bản đồ để cắm cờ') + '</span>' +
      '<button class="btn small ghost" id="fb-undo">Bỏ cờ cuối</button><button class="btn small gold" id="fb-done">Xong</button>';
    $$('.fb-b', el).forEach(function (b) { b.onclick = function () { fm.type = b.dataset.t; renderFlagBar(); }; tipFor(b, '<b>' + TT.FLAGS[b.dataset.t].name + '</b><div class="tt-d">' + TT.FLAGS[b.dataset.t].desc + '</div>'); });
    $$('.fb-k button', el).forEach(function (b) { b.onclick = function () { fm.k = b.dataset.k; renderFlagBar(); }; });
    $('#fb-undo').onclick = function () { doOp({ c: 'flags', sq: q.id, fl: q.fl.slice(0, -1) }); };
    $('#fb-done').onclick = function () { S.flagMode = null; renderAll(); };
  }

  /* ================= kết quả / tổng kết ================= */
  function showResult() {
    var r = S.lastRes, sum = S.lastSummary, M = S.M; if (!r) return;
    var rows = r.players.slice().sort(function (a, b) { return a.rank - b.rank; }).map(function (x) {
      var p = MT.player(M, x.seat);
      return '<tr class="' + (x.seat === S.seat ? 'me' : '') + '"><td><b class="rk r' + x.rank + '">' + x.rank + '</b></td><td style="color:' + TT.SEAT_COLORS[x.seat] + '">' + I.crest(p.race, 22) + ' ' + esc(p.name) + '</td><td>+' + (sum.pts[x.seat] || 0) + '</td><td>' + x.kills + '</td><td>' + x.dmg + '</td><td>' + x.healed + '</td><td>' + M.scores[x.seat].pts + '</td></tr>';
    }).join('');
    var mine = r.squads.filter(function (q) { return q.seat === S.seat; }).sort(function (a, b) { return b.dmg - a.dmg; }).slice(0, 5);
    var my = r.players.filter(function (x) { return x.seat === S.seat; })[0];
    var hints = [];
    if (my) {
      if (my.rank === 1) hints.push('Chiến thắng! Đội hình đang hiệu quả.');
      var dead = mine.filter(function (q) { return q.alive === 0; });
      if (dead.length) hints.push('Bị diệt sạch: ' + dead.map(function (q) { return esc(q.name); }).join(', ') + '.');
      var me0 = me(); if (me0 && P.usedPop(me0) < P.capacity(me0) - 3) hints.push('Bạn còn Sức chứa trống — mua thêm quân.');
      if (me0 && me0.squads.every(function (q) { return !q.it.length; })) hints.push('Chưa gắn trang bị nào cho đội trưởng.');
    }
    var o = $('#result-overlay');
    o.innerHTML = '<div class="win result-box"><h2>Kết quả ngày ' + sum.day + '</h2>' + (sum.monster ? '<p class="muted">' + esc(MT.player(M, sum.monster.seat).name) + ' hạ nhiều quái nhất: +' + sum.monster.cry + ' Tinh thể</p>' : '') +
      '<table class="over-table"><tr><th>Hạng</th><th>Người chơi</th><th>Điểm</th><th>Hạ gục</th><th>Sát thương</th><th>Hồi máu</th><th>Tổng</th></tr>' + rows + '</table>' +
      (mine.length ? '<h3>Đội của bạn</h3><div class="rep">' + mine.map(function (q) { return '<div class="rep-r">' + I.role(q.role, '#fff', 16) + '<span>' + esc(q.name) + ' ×' + q.n + '</span><b>' + q.dmg + '</b><small>sát thương · ' + q.kills + ' hạ · còn ' + q.alive + '</small></div>'; }).join('') + '</div>' : '') +
      (hints.length ? '<div class="hints">' + hints.map(function (h) { return '<div>' + I.ui('info', 12) + ' ' + h + '</div>'; }).join('') + '</div>' : '') +
      (S.M.over ? '' : '<p class="muted">Ngày mới sau <b id="res-count"></b></p>') + '<div class="btns"><button class="btn ghost" id="res-close">Xem chiến trường</button></div></div>';
    o.classList.remove('hidden');
    $('#res-close').onclick = function () { o.classList.add('hidden'); };
    if (my) TT.Sound.play(my.rank === 1 ? 'win' : 'turn');
  }
  function hideResult() { var o = $('#result-overlay'); if (o) o.classList.add('hidden'); }
  function showOver() {
    if (!S || S.phase === 'over') return;
    S.phase = 'over'; hideResult();
    var M = S.M, st = MT.standings(M), win = M.winner || [st[0].seat], meWin = S.seat && win.indexOf(S.seat) >= 0;
    var o = $('#over-overlay');
    o.innerHTML = '<div class="win over-box"><h1 class="over-title' + (meWin ? '' : ' lose') + '">' + (S.seat ? (meWin ? 'Chiến thắng!' : 'Thất bại') : 'Kết thúc') + '</h1>' +
      '<table class="over-table"><tr><th>#</th><th>Người chơi</th><th>Tộc</th><th>Điểm hạng</th><th>Điểm hạ gục</th><th>Tổng</th></tr>' + st.map(function (s, i) { var p = MT.player(M, s.seat); return '<tr class="' + (s.seat === S.seat ? 'me' : '') + '"><td>' + (win.indexOf(s.seat) >= 0 ? I.ui('trophy', 16, '#e0a000') : i + 1) + '</td><td style="color:' + TT.SEAT_COLORS[s.seat] + '">' + esc(s.name) + (p.out ? ' <small class="muted">(đầu hàng)</small>' : '') + '</td><td>' + F[s.race].short + '</td><td>' + s.rank + '</td><td>' + s.kill + '</td><td><b>' + s.pts + '</b></td></tr>'; }).join('') + '</table>' +
      '<div class="btns" style="justify-content:center"><button class="btn gold big" id="over-lobby">Về sảnh</button></div></div>';
    o.classList.remove('hidden');
    $('#over-lobby').onclick = function () { leave(); };
    TT.Sound.play(meWin ? 'win' : 'lose');
    if (S.seat && !S.recorded) {
      S.recorded = true;
      var sc = M.scores[S.seat], p = me();
      Net.recordResult(meWin, { mode: M.mode, faction: p ? p.race : '', days: M.day, pts: sc ? sc.pts : 0 });
    }
    if (S.host) Net.finish(S.code, win[0]);
    renderAll();
  }
  function leave() { var code = S && S.code; Game.stop(); try { localStorage.removeItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { } App.cleanupRoom(); App.enterLobby(); }

  /* ================= menu ================= */
  function openMenu() {
    var o = $('#menu-overlay'), low = lsGet('ttkc.gfx') === 'low';
    o.innerHTML = '<div class="win menu-box"><h2>Menu</h2>' +
      '<button class="btn wide" id="mn-close">Tiếp tục</button>' +
      '<button class="btn wide ghost" id="mn-guide">' + I.ui('info', 14) + ' Hướng dẫn nhanh</button>' +
      '<button class="btn wide ghost" id="mn-gfx">Đồ họa: ' + (low ? 'Nhẹ (điện thoại)' : 'Đẹp') + '</button>' +
      '<button class="btn wide ghost" id="mn-snd">' + (TT.Sound.on ? I.ui('sound') + ' Âm thanh: Bật' : I.ui('mute') + ' Âm thanh: Tắt') + '</button>' +
      (S.seat && !S.M.over ? '<button class="btn wide red" id="mn-quit">' + I.ui('flag', 14) + ' Đầu hàng</button>' : '<button class="btn wide red" id="mn-leave">Về sảnh</button>') + '</div>';
    o.classList.remove('hidden');
    $('#mn-close').onclick = function () { o.classList.add('hidden'); };
    $('#mn-guide').onclick = function () { o.classList.add('hidden'); quickGuide(); };
    $('#mn-gfx').onclick = function () { lsSet('ttkc.gfx', low ? 'high' : 'low'); App.toast('Áp dụng từ lần vào trận sau', 'ok'); openMenu(); };
    $('#mn-snd').onclick = function () { TT.Sound.toggle(); openMenu(); };
    var q = $('#mn-quit'); if (q) q.onclick = function () { App.confirm('Đầu hàng?', 'Bạn sẽ bị loại khỏi ván và không thể quay lại. Điểm đã có vẫn hiện trên bảng.', 'Đầu hàng').then(function (ok) { if (!ok) return; Net.quit(S.code, S.seat, S.M.day).then(leave, leave); }); };
    var lv = $('#mn-leave'); if (lv) lv.onclick = leave;
  }
  function quickGuide() {
    App.modal('<h2>' + I.ui('info', 18) + ' Cách chơi nhanh</h2><ol class="qg">' +
      '<li><b>Chuẩn bị:</b> kéo quân từ <b>băng ghế</b> (đáy màn hình) thả vào vùng xuất quân sáng màu. Thả lên đội cùng loại để gộp. Bán hoàn 100%.</li>' +
      '<li><b>Lên Đời</b> bằng Tinh thể (+4 EXP mỗi lần) để có thêm Sức chứa, quân và trang bị mới.</li>' +
      '<li><b>Cửa hàng</b> (góc phải): mua trang bị rồi kéo lên đội (gắn cho đội trưởng); tab Lõi để mua nâng cấp toàn quân.</li>' +
      '<li>Bấm một đội để đổi <b>tư thế</b>, tách đội, cắm <b>Cờ Lệnh</b> (Xanh: hành quân · Đỏ: tiến công · Vàng: hộ tống).</li>' +
      '<li>Bấm <b>Sẵn sàng</b>. Giao tranh hoàn toàn tự động; sau 5 phút sát thương bão tăng gấp đôi mỗi giây.</li>' +
      '<li>Mỗi ngày tính điểm hạng + điểm hạ gục. Sau 10 ngày ai nhiều điểm nhất thắng.</li></ol>' +
      '<p class="muted small">Camera: kéo chỗ trống để dời · chuột phải/Shift kéo để xoay · lăn để zoom · phím H về mặc định.</p>', [['Đã hiểu', 'gold', true]]);
  }

  /* ================= gắn sự kiện ================= */
  var bound = false;
  function bindUI() {
    if (bound) return; bound = true;
    $('#btn-menu').onclick = openMenu;
    $('#btn-go').onclick = function () { if (!S) return; if (S.committed) uncommit(); else commitMine(); };
    $('#btn-undo').onclick = function () { undo(); };
    $('#btn-auto').onclick = function () { doOp({ c: 'auto' }); };
    $$('#speed-btns button').forEach(function (b) { b.onclick = function () { S.speed = +b.dataset.s; lsSet('ttkc.speed', S.speed); if (S.field) S.field.setSpeed(S.speed); renderTop(); }; });
    $('#btn-skip').onclick = function () { if (S && S.field && S.field.B) S.field.skipBattle(); };
    $$('#g-dock .dock-tabs [data-d]').forEach(function (b) { b.onclick = function () { S.dock = b.dataset.d; $('#g-dock').classList.remove('collapsed'); $('#dock-hide').innerHTML = I.ui('down', 12); renderDock(); if (Game.layout) Game.layout(); }; });
    if (G.innerWidth < 700) { $('#g-dock').classList.add('collapsed'); $('#dock-hide').innerHTML = I.ui('up', 12); }
    $('#dock-hide').onclick = function () { var c = !$('#g-dock').classList.contains('collapsed'); $('#g-dock').classList.toggle('collapsed', c); $('#dock-hide').innerHTML = I.ui(c ? 'up' : 'down', 12); if (Game.layout) Game.layout(); };
    $('#chat-toggle').onclick = function () { var c = !$('#g-chatbox').classList.contains('collapsed'); $('#g-chatbox').classList.toggle('collapsed', c); $('#chat-toggle').innerHTML = I.ui(c ? 'up' : 'down', 12); if (Game.layout) Game.layout(); };
    $$('#log-tabs button').forEach(function (b) { b.onclick = function () { $$('#log-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); }); var chat = b.dataset.t === 'chat'; $('#g-log').classList.toggle('hidden', chat); $('#g-chat').classList.toggle('hidden', !chat); $('#g-chat-form').classList.toggle('hidden', !chat); }; });
    $('#g-chat-form').onsubmit = function (e) { e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v || !S) return; inp.value = ''; Net.sendRoomChat(S.code, v).catch(function () { App.toast('Chat chưa khả dụng', 'err'); }); };
    if (innerWidth <= 760) { $('#g-chatbox').classList.add('collapsed'); $('#chat-toggle').innerHTML = I.ui('up', 12); }
  }
  document.addEventListener('keydown', function (e) {
    if (!S || App.screen !== 'game' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { clearModes(); S.sel = null; renderAll(); }
    else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    else if (k === ' ' && S.P && S.phase === 'prep') { e.preventDefault(); if (S.committed) uncommit(); else commitMine(); }
    else if (/^arrow/.test(k) && S.field) { e.preventDefault(); var d = 60; S.field.panBy(k === 'arrowleft' ? d : k === 'arrowright' ? -d : 0, k === 'arrowup' ? d : k === 'arrowdown' ? -d : 0); }
    else if (k === 'h' && S.field) S.field.resetCam();
    else if ((k === '1' || k === '2' || k === '4') && S.phase === 'battle') { S.speed = +k; if (S.field) S.field.setSpeed(S.speed); renderTop(); }
    else if ((k === 'delete' || k === 'backspace') && S.sel != null) { var q = P.squadById(S.P, S.sel); if (q) { doOp({ c: 'sell', sq: q.id, k: q.n }); S.sel = null; renderAll(); } }
  });

  /* ================= nhật ký / chat / thông báo giữa màn ================= */
  function log(html, kind) {
    var el = $('#g-log'); if (!el) return;
    var d = document.createElement('div'); d.className = 'm ' + (kind || ''); d.innerHTML = html; el.appendChild(d);
    while (el.children.length > 160) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }
  Game.onChat = function (m) {
    if (!S) return; var el = $('#g-chat'); if (!el) return;
    var d = document.createElement('div'); d.className = 'm'; d.innerHTML = '<b>' + esc(m.name) + ':</b> ' + esc(m.text); el.appendChild(d); el.scrollTop = el.scrollHeight;
    if ($('#g-chat').classList.contains('hidden')) { var b = $('#log-tabs [data-t=chat]'); if (b) b.classList.add('ping'); }
    TT.Sound.play('msg');
  };
  Game.onRoom = function (room) { if (S) S.room = room; };
  Game._s = function () { return S; }; Game._op = function (c) { return doOp(c); };
  Game.onBotLv = function () { };
  function centerMsg(title, sub, ms) {
    var el = $('#center-msg'); if (!el) return;
    el.innerHTML = '<div class="cm-t">' + esc(title) + '</div>' + (sub ? '<div class="cm-s">' + esc(sub) + '</div>' : '');
    el.classList.remove('hidden'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.add('hidden'); }, ms || 2200);
  }

  /* ================= bố cục HUD tự né (giữ từ 1.2) ================= */
  var lq = 0;
  Game.layout = function () { if (lq) return; lq = requestAnimationFrame(function () { lq = 0; layoutHud(); }); };
  function layoutHud() {
    if (!S || App.screen !== 'game') return;
    var H = innerHeight, phone = innerWidth <= 760, gap = phone ? 5 : 8;
    var top = $('.hud-top'), meEl = $('#g-me'), pl = $('#g-players'), sq = $('#g-squad'), chat = $('#g-chatbox'), dock = $('#g-dock'), bench = $('#g-bench'), fb = $('#flag-bar');
    var R = function (el) { return el.getBoundingClientRect(); }, vis = function (el) { return el && !el.classList.contains('hidden') && R(el).height > 0; };
    var tR = R(top), benchTop = vis(bench) ? R(bench).top : H;
    if (fb) fb.style.top = Math.round(tR.bottom + gap) + 'px';
    if (phone) {
      meEl.style.top = Math.round(tR.bottom + gap) + 'px';
      var mR = R(meEl); pl.style.top = Math.round(mR.bottom + gap) + 'px';
      var below = R(pl).bottom + gap;
      [dock.querySelector('.dock-body'), sq].forEach(function (el) { if (el) el.style.maxHeight = Math.max(140, benchTop - below - 60) + 'px'; });
      if (S.field && S.field.camBar) { S.field.camBar.style.top = Math.round(below) + 'px'; }
      return;
    }
    meEl.style.top = ''; pl.style.top = '';
    var mR2 = R(meEl), pR = R(pl);
    if (mR2.right + gap > tR.left && mR2.top < tR.bottom) { meEl.style.top = Math.round(tR.bottom + gap) + 'px'; mR2 = R(meEl); }
    if (pR.left - gap < tR.right && pR.top < tR.bottom) { pl.style.top = Math.round(tR.bottom + gap) + 'px'; pR = R(pl); }
    // bảng đội dưới bảng bản thân, dừng trước khung chat/băng ghế
    if (vis(sq)) { var uTop = mR2.bottom + gap; sq.style.top = Math.round(uTop) + 'px'; var bottomLim = Math.min(vis(chat) ? R(chat).top : H, benchTop) - gap; sq.style.maxHeight = Math.max(160, Math.round(bottomLim - uTop)) + 'px'; }
    // chat và dock đứng trên băng ghế
    var bOff = vis(bench) ? (H - benchTop + gap) : 10;
    chat.style.bottom = bOff + 'px'; dock.style.bottom = bOff + 'px';
    var db = dock.querySelector('.dock-body'); if (db) { var dTop = pR.bottom + gap + 40; db.style.maxHeight = Math.max(160, Math.round(H - bOff - dTop - 40)) + 'px'; }
    // chat không chạm dock
    var cR = R(chat), dR = R(dock); chat.style.width = '';
    if (cR.right + gap > dR.left && !dock.classList.contains('hidden')) chat.style.width = Math.max(220, Math.round(dR.left - gap - cR.left)) + 'px';
    if (S.field && S.field.camBar) { var cb = S.field.camBar; cb.style.bottom = (bOff + (vis(chat) ? 0 : 0)) + 'px'; cb.style.left = '50%'; cb.style.transform = 'translateX(-50%)'; cb.style.top = ''; var cbR = R(cb); if (cbR.left < R(chat).right + gap || cbR.right > R(dock).left - gap) { cb.style.left = 'auto'; cb.style.transform = 'none'; cb.style.right = '10px'; cb.style.bottom = ''; cb.style.top = Math.round(pR.bottom + gap) + 'px'; cb.style.flexDirection = 'column'; } else cb.style.flexDirection = 'row'; }
  }
  G.addEventListener('resize', function () { if (S) { renderAll(); } });
})(window);
