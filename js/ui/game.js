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
      tab: 'gen', shop: false, speed: +(lsGet('ttkc.speed') || 1), log: [], results: [], botPk: {}, revealed: {}, lockTry: {}, finTry: {}, revTry: {},
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
    if (S.P && S.pending && ls.indexOf(S.seat) >= 0 && !r[S.seat] && !S.revTry[n]) { S.revTry[n] = 1; Net.reveal(S.code, n, S.seat, S.pending.payload, S.pending.nonce).catch(function (e) { console.warn(e); setTimeout(function () { if (S) S.revTry[n] = 0; }, 1500); }); }
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
    if (payload.length > 11800) { App.toast('Đội hình quá lớn để gửi — hãy bớt đạo quân', 'err'); return; }
    // tự kiểm trước khi gửi: gói phải mở ra đúng trạng thái đang thấy (Vàng, Đời, quân)
    var chk = P.applyPackage(me(), JSON.parse(payload), ctxOf(me()));
    if (!chk.ok || chk.p.lv !== S.P.lv || chk.p.gold !== S.P.gold) { console.warn('Gói tự kiểm lỗi', chk.errs); log('Cảnh báo: đội hình có thể không hợp lệ (' + esc(chk.errs.join(', ')) + ')', 'warn'); }
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
      if (fs.indexOf(p.seat) < 0 || !rv || !cm) { if (p.seat === S.seat) { log('Đội hình của bạn chưa được gửi kịp — giữ đội hình hôm trước', 'warn'); App.toast('Đội hình hôm nay chưa gửi kịp, đang dùng đội hình hôm trước', 'err', 5000); } else if (!p.bot) log(esc(p.name) + ' giữ đội hình hôm trước', 'muted'); return; }
      if (TT.fnv64(rv.p + '|' + rv.n) !== cm) { log('Gói của ' + esc(p.name) + ' không khớp mã băm — dùng đội hình cũ', 'warn'); return; }
      try {
        var res = P.applyPackage(p, JSON.parse(rv.p), ctxOf(p));
        if (res.ok) M.players[i] = Object.assign(res.p, { side: p.side, team: p.team, bot: p.bot, name: p.name });
        else { log('Gói của ' + esc(p.name) + ' sai luật (' + res.errs.join(', ') + ') — dùng đội hình cũ', 'warn'); if (p.seat === S.seat) App.toast('Đội hình của bạn bị từ chối: ' + res.errs.join(', '), 'err', 6000); }
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
    S.field.setHL({}); S.sel = null; S.tab = 'gen'; unpinTip();
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
    f.onClick = onFieldClick; f.onRight = function () { clearModes(); S.sel = null; renderAll(); };
    f.onDragStart = onDragStart; f.onDragMove = onDragMove; f.onDragEnd = onDragEnd;
    f.onHover = onHover; f.onHoverMove = onHover;
    $('#board').addEventListener('mouseleave', function () { if (!S.pinTip) hideTip(); });
    if (S.M.day > 0) setupFieldForDay();
    requestAnimationFrame(followLoop);
  }
  function setupFieldForDay() {
    var f = S.field, M = S.M; if (!f) return;
    var p = me(), side = p ? p.side : 0;
    if (f.map !== M.map) f.setMap(M.map, { mode: M.mode, zones: M.players.filter(function (x) { return !x.out; }).map(function (x) { return Object.assign({ color: TT.SEAT_COLORS[x.seat], mine: x.seat === S.seat }, TT.zoneOf(M.mode, x.side)); }) });
    if (S.phase !== 'battle') { f.stopBattle(); f.mode = 'prep'; f.setView(side, TT.zoneOf(M.mode, side)); }
    refreshField();
  }
  function prepUnits() {
    var list = [], M = S.M; S.genPos = {};
    var addSquads = function (p, ghost) {
      p.squads.forEach(function (q) {
        var pos = TT.Battle.formation(M.map, p.side, q.t, q.n, q.x, q.y), face = Math.atan2(TT.sideFwd[p.side][0], TT.sideFwd[p.side][1]);
        if (!ghost) S.genPos[q.id] = [pos[0][0] / 1000, pos[0][1] / 1000];
        var hl = !ghost && (S.sel === q.id || (S.solRole && q.t === S.solRole) || (S.itemSel != null && S.hoverSq === q.id));
        pos.forEach(function (ps, i) { list.push({ id: p.seat + ':' + q.id + ':' + i, race: p.race, role: q.t, x: ps[0] / 1000, y: ps[1] / 1000, face: face, seat: p.seat, cap: i === 0, items: i === 0 ? q.it : null, sel: hl, ghost: ghost, sq: ghost ? null : q.id, rad: ROLES[q.t].rad }); });
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
    if (S.hoverCell) { hl.hover = S.hoverCell; hl.hoverOk = S.hoverOk; hl.hoverColor = S.moveSq != null ? '#7ff0ff' : '#ffffff'; }
    if (S.P) S.P.squads.forEach(function (q) {
      if (!q.fl.length || (S.sel != null && S.sel !== q.id && !S.showAllFlags)) return;
      var pts = [[q.x + .5, q.y + .5]], cols = [], flags = [], dash = [];
      q.fl.forEach(function (fl) {
        if (fl.c === 'V') { var t = P.squadById(S.P, fl.sq); if (!t) return; pts.push([t.x + .5, t.y + .5]); cols.push('#ffd23a'); dash.push(1); }
        else { pts.push([fl.x + .5, fl.y + .5]); cols.push(fl.c === 'X' ? '#3d9cf0' : '#ff5d5d'); flags.push([fl.x + .5, fl.y + .5, fl.c === 'X' ? '#3d9cf0' : '#ff5d5d']); dash.push(0); }
      });
      hl.paths.push({ pts: pts, cols: cols, flags: flags, dash: dash });
    });
    // tướng có thể nhận lính / trang bị đang chọn
    if (S.P && (S.solRole || S.itemSel != null)) S.P.squads.forEach(function (q) { if ((S.solRole && q.t === S.solRole) || (S.itemSel != null && q.it.length < CFG.genItems)) { var gp = S.genPos[q.id]; if (gp) hl.circles.push({ x: gp[0], y: gp[1], r: .75, color: S.solRole ? '#7ff0ff' : '#ffd34d' }); } });
    var sq = S.P && S.sel != null ? P.squadById(S.P, S.sel) : null;
    if (sq && S.genPos[sq.id]) hl.circles.push({ x: S.genPos[sq.id][0], y: S.genPos[sq.id][1], r: .85, color: '#ffffff' });
    f.setHL(hl);
  }

  /* ================= thao tác chuẩn bị (mọi thao tác chỉ cần chuột trái / chạm) ================= */
  function canPrep() { return S && S.P && S.phase === 'prep' && !S.committed && !(S.days[S.M.day] || {}).lock; }
  function doOp(c, quiet) {
    if (!canPrep()) { if (!quiet) App.toast(S.committed ? 'Bạn đã Sẵn sàng — bấm lại để sửa' : 'Đã hết giờ chuẩn bị', 'err'); return { ok: false }; }
    var snap = P.clone(S.P), n0 = S.cryLog.length;
    var r = P.apply(S.P, c, ctxOf(S.P));
    if (!r.ok) { S.P = snap; if (!quiet) { App.toast(r.err, 'err'); TT.Sound.play('err'); } return r; }
    S.undo.push({ p: snap, n: n0 }); if (S.undo.length > 80) S.undo.shift();
    if (r.log) S.cryLog = S.cryLog.concat(r.log);
    if (r.up) { var z = TT.zoneOf(S.M.mode, S.P.side); if (S.field) S.field.fxAt('level', (z.x0 + z.x1) / 2 + .5, (z.y0 + z.y1) / 2 + .5); centerMsg('Đời ' + TT.AGE_ROMAN[S.P.lv] + ' · ' + TT.AGE_NAME[S.P.lv], 'Mở khóa quân và trang bị mới', 1600); TT.Sound.play('age'); }
    if (S.sel != null && !P.squadById(S.P, S.sel)) S.sel = null;
    renderAll();
    return r;
  }
  function undo() {
    if (!canPrep() || !S.undo.length) return;
    var u = S.undo.pop(); S.P = u.p; S.cryLog.length = u.n;
    if (S.sel != null && !P.squadById(S.P, S.sel)) S.sel = null;
    renderAll();
  }
  function clearModes() { S.placeRole = null; S.solRole = null; S.itemSel = null; S.flagMode = null; S.moveSq = null; S.hoverCell = null; S.dragSq = null; S.actSub = null; }
  function inMyZone(cell) { return cell && S.P && TT.inZone(TT.zoneOf(S.M.mode, S.P.side), cell[0], cell[1]); }
  function unitAtE(e) { return S.field ? S.field.unitAt(e, 30) : null; }
  function myUnitAt(e) { var v = unitAtE(e); return v && v.sq != null && !v.ghost ? v : null; }
  function buyGenAt(role, cell) {
    if (!inMyZone(cell)) { App.toast('Đặt tướng trong vùng xuất quân của bạn (vùng viền sáng)', 'err'); return; }
    var r = doOp({ c: 'buyGen', t: role, x: cell[0], y: cell[1] });
    if (r.ok) { TT.Sound.play('buy'); S.field.fxAt('buy', cell[0] + .5, cell[1] + .5, F[S.P.race].color); S.sel = r.sq; S.tab = 'sol'; S.placeRole = null; renderAll(); }
  }
  function addSoldier(sqId, k) {
    var r = doOp({ c: 'buySol', sq: sqId, k: k || 1 });
    if (r.ok) { TT.Sound.play('buy'); var gp = S.genPos[sqId]; if (gp && S.field) S.field.fxAt('buy', gp[0], gp[1], '#7ff0ff'); }
    return r;
  }
  function onFieldClick(cell, e) {
    if (!S || S.phase === 'over') return;
    if (S.phase === 'battle') { var bv = unitAtE(e); if (bv) { pinTip(unitTip(bv), e.clientX, e.clientY); } else unpinTip(); return; }
    if (S.flagMode) { flagClick(cell, e); return; }
    if (S.placeRole) { buyGenAt(S.placeRole, cell); return; }
    var v = unitAtE(e);
    if (S.moveSq != null) {
      if (cell && inMyZone(cell)) { doOp({ c: 'move', sq: S.moveSq, x: cell[0], y: cell[1] }); TT.Sound.play('click'); }
      else App.toast('Chọn chỗ trong vùng xuất quân của bạn', 'err');
      S.moveSq = null; S.hoverCell = null; renderAll(); return;
    }
    if (S.solRole) {
      if (v && v.sq != null && !v.ghost) { var q0 = P.squadById(S.P, v.sq); if (q0 && q0.t === S.solRole) { addSoldier(q0.id); return; } }
      App.toast('Chạm vào một tướng ' + TT.unitName(S.P.race, S.solRole) + ' (vòng xanh) để thêm lính', 'err'); return;
    }
    if (S.itemSel != null) { if (v && v.sq != null && !v.ghost) equipItem(v.sq); else { S.itemSel = null; renderAll(); } return; }
    if (v && v.sq != null && !v.ghost) {
      if (v.cap) { if (S.sel !== v.sq) { S.actSub = null; S.tab = 'sol'; } S.sel = v.sq; unpinTip(); TT.Sound.play('click'); }
      else { S.sel = null; pinTip(unitTip(v), e.clientX, e.clientY); }
    } else if (v && v.ghost) { S.sel = null; pinTip(unitTip(v), e.clientX, e.clientY); }
    else { S.sel = null; unpinTip(); if (cell && S.field.map) { var t = S.field.map.g[cell[1] * S.field.map.W + cell[0]], T0 = TT.TERRAIN[t]; if (T0 && t !== '.') pinTip(terrainTip(t), e.clientX, e.clientY); } }
    renderAll();
  }
  function onDragStart(cell, e) {
    if (!canPrep() || S.flagMode) return false;
    var v = myUnitAt(e); if (!v) return false;
    S.dragSq = v.sq; S.sel = v.sq; unpinTip(); renderAll(); return true;
  }
  function onDragMove(cell) { S.hoverCell = cell; S.hoverOk = inMyZone(cell); refreshField(); }
  function onDragEnd(cell) {
    var id = S.dragSq; S.dragSq = null; S.hoverCell = null;
    if (id != null && cell && inMyZone(cell)) doOp({ c: 'move', sq: id, x: cell[0], y: cell[1] });
    renderAll();
  }
  function equipItem(sqId) {
    var it = S.itemSel; S.itemSel = null;
    if (it == null) return;
    var r = doOp({ c: 'equip', idx: it, sq: sqId }); if (r.ok) TT.Sound.play('coin');
  }
  /* Hành quân (cắm cờ) — lính trong đạo quân đi theo tướng */
  function flagClick(cell, e) {
    var fm = S.flagMode, q = P.squadById(S.P, fm.sq); if (!q) { S.flagMode = null; renderAll(); return; }
    var fl = q.fl.slice();
    if (fm.type === 'V') {
      var v = myUnitAt(e); if (!v || v.sq === q.id) { App.toast('Chạm vào một tướng khác của bạn để hộ tống', 'err'); return; }
      fl.push({ c: 'V', sq: v.sq, k: fm.k || 'sat' });
    } else { if (!cell) return; fl.push({ c: fm.type, x: cell[0], y: cell[1] }); }
    var r = doOp({ c: 'flags', sq: q.id, fl: fl }); if (r.ok) TT.Sound.play('click');
  }

  /* ================= kéo hoặc chạm: thẻ quân, trang bị trong tủ ================= */
  function startDrag(e, kind, val, html) {
    if (!canPrep()) { App.toast(S.committed ? 'Bạn đã Sẵn sàng — bấm lại để sửa' : 'Chưa tới giờ chuẩn bị', 'err'); return; }
    e.preventDefault();
    var ghost = $('#drag-ghost'), sx = e.clientX, sy = e.clientY, moved = false;
    var mv = function (ev) {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) { moved = true; ghost.innerHTML = html; ghost.classList.remove('hidden'); document.body.classList.add('dragging'); hideTip(); }
      if (!moved) return;
      ghost.style.transform = 'translate(' + (ev.clientX - 27) + 'px,' + (ev.clientY - 27) + 'px)';
      var over = document.elementFromPoint(ev.clientX, ev.clientY), onField = over && over.id === 'board';
      var cell = onField && S.field ? S.field.cellAt(ev) : null;
      if (kind === 'gen') { S.hoverCell = cell; S.hoverOk = inMyZone(cell); ghost.classList.toggle('ok', !!S.hoverOk); refreshField(); }
      else { var v = onField ? myUnitAt(ev) : null, q = v && P.squadById(S.P, v.sq), ok = !!q && (kind === 'item' || q.t === val); S.hoverSq = ok ? q.id : null; ghost.classList.toggle('ok', ok); refreshField(); }
    };
    var up = function (ev) {
      G.removeEventListener('pointermove', mv); G.removeEventListener('pointerup', up);
      ghost.classList.add('hidden'); document.body.classList.remove('dragging');
      var over = document.elementFromPoint(ev.clientX, ev.clientY), onField = over && over.id === 'board';
      S.hoverCell = null; S.hoverSq = null;
      if (!moved) { tapCard(kind, val); return; }
      if (onField && S.field) {
        if (kind === 'gen') buyGenAt(val, S.field.cellAt(ev));
        else { var v = myUnitAt(ev), q = v && P.squadById(S.P, v.sq); if (!q) App.toast(kind === 'item' ? 'Thả trang bị lên một tướng của bạn' : 'Thả lính lên một tướng cùng binh chủng', 'err'); else if (kind === 'item') { S.itemSel = val; equipItem(q.id); } else if (q.t !== val) App.toast('Lính ' + TT.unitName(S.P.race, val) + ' chỉ nhập vào tướng ' + TT.unitName(S.P.race, val), 'err'); else addSoldier(q.id); }
      }
      renderAll();
    };
    G.addEventListener('pointermove', mv); G.addEventListener('pointerup', up);
  }
  // chạm (không kéo) vào thẻ: chế độ đặt tướng / nhập lính / chọn trang bị
  function tapCard(kind, val) {
    var p = S.P;
    if ((kind === 'gen' || kind === 'sol') && lastPT === 'touch') { var cel = $('#gb-cards .bcard[data-r="' + val + '"]'); if (cel) { var rc0 = cel.getBoundingClientRect(); setTimeout(function () { pinTip(cardTip(val, kind === 'gen'), rc0.left, rc0.top - 6, true); }, 0); } }
    if (kind === 'gen') { var on = S.placeRole !== val; clearModes(); S.placeRole = on ? val : null; S.sel = null; if (on) App.toast('Chạm vào vùng xuất quân để đặt tướng', 'ok', 1600); }
    else if (kind === 'sol') {
      var gens = p.squads.filter(function (q) { return q.t === val; });
      if (!gens.length) { App.toast('Chưa có tướng ' + TT.unitName(p.race, val) + ' — mua tướng trước (thẻ Tướng)', 'err'); return; }
      var selQ = S.sel != null ? P.squadById(p, S.sel) : null;
      if (selQ && selQ.t === val) addSoldier(selQ.id);
      else if (gens.length === 1) { addSoldier(gens[0].id); }
      else { var on2 = S.solRole !== val; clearModes(); S.solRole = on2 ? val : null; if (on2) App.toast('Chạm vào tướng muốn thêm lính (vòng xanh)', 'ok', 1600); }
    } else if (kind === 'item') {
      if (S.sel != null) { S.itemSel = val; equipItem(S.sel); return; }
      var on3 = S.itemSel !== val; clearModes(); S.itemSel = on3 ? val : null;
      if (on3) { var r = $('.inv-slot[data-i="' + val + '"]'); if (r) { var rc = r.getBoundingClientRect(); pinTip(itemTip(p.inv[val], 'Chạm vào một tướng để đeo · hoặc bán', true, val), rc.left, rc.top - 10, true); } }
      else unpinTip();
    }
    renderAll();
  }

  /* ================= tooltip ================= */
  function onHover(cell, e) {
    if (!S || !S.field || !e || S.pinTip) return;
    if (e.pointerType === 'touch') return;
    var v = S.field.unitAt(e, 22), html = '';
    if (v) html = unitTip(v);
    else if (cell && S.field.map) { var t = S.field.map.g[cell[1] * S.field.map.W + cell[0]]; if (TT.TERRAIN[t] && (t !== '.' || S.placeRole || S.moveSq != null)) html = terrainTip(t); }
    if ((S.placeRole || S.moveSq != null) && cell) { S.hoverCell = cell; S.hoverOk = inMyZone(cell); refreshField(); }
    if (html) showTip(html, e.clientX, e.clientY); else hideTip();
  }
  function terrainTip(t) { var T0 = TT.TERRAIN[t]; return '<div class="tt-h">' + I.ui('map', 16) + '<b>' + T0.name + '</b></div><div class="tt-d">' + T0.desc + '</div>'; }
  function unitTip(v) {
    var race = v.race, role = v.role, u = v.u, R = ROLES[role] || {};
    if (u && u.monster) return '<b>' + esc(u.name) + '</b><div class="tt-d">Quái trung lập — đánh mọi bên tới gần. Ai hạ nhiều quái nhất được thêm Vàng.</div><div class="tt-s"><span>' + I.ui('heart', 11) + ' ' + u.hp + '/' + u.mhp + '</span></div>';
    var ud = TT.UNITS[race + '.' + role] || {}, f = F[race], gen = !!v.cap;
    var owner = v.ghost ? MT.player(S.M, v.seat) : (u ? null : S.P);
    var h = '<div class="tt-h" style="--fc:' + f.color + '">' + I.role(role, '#fff', 18) + '<b>' + esc(ud.name || R.name) + '</b><span>' + (gen ? '<em class="gen-tag">Tướng</em>' : 'Lính') + ' · ' + f.short + ' · ' + TT.CLS_NAME[R.cls] + '</span></div>';
    var st;
    if (u) st = { hp: u.hp + '/' + u.mhp, atk: u.atk, def: u.def, as: (u.as / 100).toFixed(2), rng: (u.rng / 1000).toFixed(1), mp: u.mmp ? u.mp + '/' + u.mmp : '—' };
    else { var q = owner && P.squadById(owner, +String(v.id).split(':')[1]); if (owner && q) { var ps = TT.Battle.previewStats(ctxOf(owner), owner, q, gen); st = { hp: ps.hp, atk: ps.atk, def: ps.def, as: ps.as.toFixed(2), rng: ps.rng.toFixed(1), mp: gen ? ps.mp0 + '/' + ps.mp : '—', n: q.n, it: q.it }; } }
    if (st) h += '<div class="tt-s"><span>' + I.ui('heart', 11) + ' ' + st.hp + '</span><span>' + I.ui('swords', 11) + ' ' + st.atk + '</span><span>' + I.ui('shield', 11) + ' ' + st.def + '</span><span>Tốc ' + st.as + '</span><span>Tầm ' + st.rng + '</span>' + (gen ? '<span>MP ' + st.mp + '</span>' : '') + '</div>';
    if (st && st.n) h += '<div class="tt-d">Đạo quân: 1 tướng + ' + (st.n - 1) + ' lính' + (v.ghost ? ' · <i>đội hình hôm qua của đối thủ</i>' : '') + '</div>';
    if (ud.psd) h += '<div class="tt-p"><b>Nội tại:</b> ' + esc(ud.psd) + '</div>';
    if (gen && ud.sk) h += '<div class="tt-p"><b>' + esc(ud.sk.name) + '</b> (đầy MP): ' + esc(ud.sk.desc) + '</div>';
    if (!gen) h += '<div class="tt-d muted">Lính đi theo tướng và không dùng kỹ năng.</div>';
    return h;
  }
  function showTip(html, x, y) {
    var t = $('#tip-box'); t.innerHTML = html; t.classList.remove('hidden', 'pinned');
    var w = t.offsetWidth, h = t.offsetHeight, vw = innerWidth, vh = innerHeight;
    t.style.left = Math.max(6, Math.min(vw - w - 6, x + 16)) + 'px'; t.style.top = Math.max(6, Math.min(vh - h - 6, y + 18)) + 'px';
  }
  function pinTip(html, x, y, above) {
    showTip(html, x, y); var t = $('#tip-box'); t.classList.add('pinned'); S.pinTip = true;
    if (above) { t.style.top = Math.max(6, y - t.offsetHeight - 8) + 'px'; t.style.left = Math.max(6, Math.min(innerWidth - t.offsetWidth - 6, x - 20)) + 'px'; }
    $$('#tip-box [data-act]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); tipAction(b.dataset.act, b.dataset.v); }; });
  }
  function unpinTip() { if (S) S.pinTip = false; hideTip(); }
  function hideTip() { var t = $('#tip-box'); if (t) t.classList.add('hidden'); }
  function tipFor(el, html) {
    el.addEventListener('mouseenter', function (e) { if (S && S.pinTip) return; showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY); });
    el.addEventListener('mousemove', function (e) { if (S && S.pinTip) return; showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY); });
    el.addEventListener('mouseleave', function () { if (!S || !S.pinTip) hideTip(); });
  }
  function tipAction(act, v) {
    if (act === 'buy') { var f = S.tipBuy; S.tipBuy = null; unpinTip(); if (f) f(); return; }
    unpinTip();
    if (act === 'sellInv') { doOp({ c: 'sellItem', idx: +v }); TT.Sound.play('coin'); S.itemSel = null; }
    else if (act === 'sellCore') { doOp({ c: 'sellCore', idx: +v }); TT.Sound.play('coin'); }
    else if (act === 'unequip') { var a = v.split(','); doOp({ c: 'unequip', sq: +a[0], slot: +a[1] }); }
    else if (act === 'sellEq') { var b = v.split(','); doOp({ c: 'sellItem', sq: +b[0], slot: +b[1] }); TT.Sound.play('coin'); }
    renderAll();
  }
  var lastPT = 'mouse';
  document.addEventListener('pointerdown', function (e) { lastPT = e.pointerType || 'mouse'; }, true);
  document.addEventListener('pointerdown', function (e) { if (!S || !S.pinTip) return; if (e.target.closest('#tip-box') || e.target.id === 'board' || e.target.closest('.inv-slot,.gi-it')) return; unpinTip(); if (S.itemSel != null) { S.itemSel = null; renderAll(); } }, true);

  /* ================= HUD ================= */
  function renderAll() {
    if (!S || App.screen !== 'game') return;
    var battle = S.phase === 'battle';
    document.body.classList.toggle('in-battle', battle || S.phase === 'over');
    document.body.classList.toggle('prep-locked', !canPrep());
    renderTop(); renderPlayers(); renderBar(); renderInfo(); renderAct(); renderFlagBar(); refreshField();
    var bar = $('#g-bar'); if (bar && !bar.classList.contains('hidden')) document.documentElement.style.setProperty('--barh', (bar.offsetHeight + 16) + 'px');
    $('#g-mode').classList.toggle('hidden', !(S.placeRole || S.solRole || S.moveSq != null));
    if (S.placeRole) $('#g-mode').innerHTML = I.ui('plus', 14) + ' Chạm vùng xuất quân để đặt tướng <b>' + esc(TT.unitName(S.P.race, S.placeRole)) + '</b><button class="btn small ghost" id="mode-x">Hủy</button>';
    else if (S.solRole) $('#g-mode').innerHTML = I.ui('plus', 14) + ' Chạm tướng <b>' + esc(TT.unitName(S.P.race, S.solRole)) + '</b> để thêm lính<button class="btn small ghost" id="mode-x">Xong</button>';
    else if (S.moveSq != null) $('#g-mode').innerHTML = I.ui('move', 14) + ' Chạm chỗ mới trong vùng xuất quân<button class="btn small ghost" id="mode-x">Hủy</button>';
    var mx = $('#mode-x'); if (mx) mx.onclick = function () { clearModes(); renderAll(); };
  }
  function renderTop() {
    var M = S.M, di = MT.dayInfo(M, Math.max(1, M.day)), wt = TT.WEATHER[M.weather] || TT.WEATHER.quang;
    var parts = '<span class="dn">Ngày <b>' + Math.max(1, M.day) + '</b>/10</span>';
    if (di.kind !== 'normal') parts += '<span class="ph kind-' + di.kind + '">' + esc(di.name) + '</span>';
    parts += '<span class="ph ic" data-tip="night" title="' + (di.night ? 'Đêm' : 'Ngày') + '">' + I.ui(di.night ? 'moon' : 'sun', 14) + '</span>';
    parts += '<span class="ph ic" data-tip="weather">' + I.ui(M.weather === 'mua' ? 'rain' : M.weather === 'gio' ? 'wind' : 'sun', 14) + '<em>' + wt.name + '</em></span>';
    if (M.event) parts += '<span class="ph ev" data-tip="event">' + I.ui('star', 12) + '<em>' + TT.EVENTS[M.event].name + '</em></span>';
    if (M.map) parts += '<span class="ph map" data-tip="map">' + I.ui('map', 12) + '<em>' + esc(M.map.name) + '</em></span>';
    $('#day-banner').innerHTML = parts;
    $$('#day-banner [data-tip]').forEach(function (el) {
      var k = el.dataset.tip, html = function () { if (k === 'weather') return '<b>' + wt.name + '</b><div class="tt-d">' + wt.desc + '</div>'; if (k === 'event') return '<b>' + TT.EVENTS[M.event].name + '</b><div class="tt-d">' + TT.EVENTS[M.event].desc + '</div>'; if (k === 'map') return '<b>' + esc(M.map.name) + '</b><div class="tt-d">' + ((TT.MAPS[M.map.key] || {}).desc || '') + '</div>'; return '<b>' + (di.night ? 'Ban đêm' : 'Ban ngày') + '</b><div class="tt-d">' + (di.night ? 'Tiên và Quỷ +4% ATK.' : 'Rồng và Nhân +4% ATK.') + '</div>'; };
      tipFor(el, html); el.onclick = function (e) { pinTip(html(), e.clientX, e.clientY); };
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
      else if (dd.lock) { span.textContent = 'Đang mở đội hình…'; fill.style.width = '0%'; }
      else { var left = Math.max(0, S.deadline - t), tot = S.deadline - S.prepStart; span.textContent = 'Chuẩn bị ' + fmtS(left); fill.style.width = Math.max(0, left / tot * 100) + '%'; tm.classList.toggle('low', left < 10000); }
      if (t % 1000 < 260) renderPlayers();
    } else if (S.phase === 'result' || S.phase === 'over-wait') {
      var l2 = Math.max(0, S.nextPrep - t); span.textContent = S.M.over ? 'Kết thúc ván' : 'Ngày mới sau ' + fmtS(l2); fill.style.width = (l2 / RESULT * 100) + '%'; tm.classList.remove('low');
      var rc = $('#res-count'); if (rc) rc.textContent = S.M.over ? '' : fmtS(l2);
    } else { span.textContent = S.M.over ? 'Kết thúc ván' : 'Đang chờ trận bắt đầu…'; fill.style.width = '100%'; }
  }
  function fmtS(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }
  function priceB(n, bad) { return '<i class="price-b' + (bad ? ' no' : '') + '">' + n + '</i>'; } // giá: số trong nền tròn, góc trên trái icon
  function gold(n, sz) { return '<span class="gold-v">' + I.svg('coin2', null, sz || 13) + '<b>' + n + '</b></span>'; }

  /* ---------- người chơi: thẻ nhỏ ở góc, chạm để xem đầy đủ ---------- */
  function renderPlayers() {
    var M = S.M, B = S.phase === 'battle' ? S.battle : null, dd = S.days[M.day] || {}, c = dd.c || {};
    var st = MT.standings(M);
    var html = st.map(function (s, i) {
      var p = MT.player(M, s.seat), extra = '';
      if (B) { var hp = 0, mh = 0; B.units.forEach(function (u) { if (u.seat === p.seat && !u.monster) { mh += u.mhp; if (u.alive) hp += u.hp; } }); extra = '<i class="pc-hp"><i style="width:' + (mh ? hp / mh * 100 : 0) + '%"></i></i>'; }
      else if (M.phase === 'prep' && !p.out) extra = c[p.seat] ? '<span class="pc-rd">' + I.ui('check', 10) + '</span>' : '';
      return '<button class="pchip' + (p.out ? ' dead' : '') + (p.seat === S.seat ? ' me' : '') + '" data-seat="' + p.seat + '" style="--pc:' + TT.SEAT_COLORS[p.seat] + '" title="' + esc(p.name) + '">' +
        '<span class="pc-rank">' + (i + 1) + '</span>' + I.crest(p.race, 22) + '<span class="pc-name">' + esc(p.name) + '</span><b class="pc-pts">' + s.pts + '</b>' + extra + '</button>';
    }).join('');
    var key = st.map(function (s) { var p = MT.player(M, s.seat); return s.seat + ':' + s.pts + ':' + (p.out ? 1 : 0) + ':' + (c[p.seat] ? 1 : 0); }).join('|') + (B ? 'B' : '');
    var box = $('#g-players');
    if (box._k === key && !B) return; box._k = key;
    if (B && box._k2 === key) { // giữa trận: chỉ cập nhật thanh máu
      st.forEach(function (s) { var hp = 0, mh = 0; B.units.forEach(function (u) { if (u.seat === s.seat && !u.monster) { mh += u.mhp; if (u.alive) hp += u.hp; } }); var bar = box.querySelector('.pchip[data-seat="' + s.seat + '"] .pc-hp i'); if (bar) bar.style.width = (mh ? hp / mh * 100 : 0) + '%'; });
      return;
    }
    box._k2 = B ? key : null; box.innerHTML = html; // chỉ vẽ lại khi đổi (không làm mất cú chạm)
    $$('#g-players .pchip').forEach(function (b) { b.onclick = function () { playerPopup(b.dataset.seat); }; });
  }
  function playerPopup(seat) {
    var M = S.M, p = seat === S.seat && S.P ? S.P : MT.player(M, seat), sc = M.scores[seat], f = F[p.race];
    var tal = TT.TALENTS[p.race].filter(function (t) { return t.id === p.talent; })[0];
    var army = p.squads.map(function (q) { return '<div class="pp-sq">' + I.role(q.t, '#fff', 16) + '<span>' + esc(TT.unitName(p.race, q.t)) + '</span><small>1 tướng + ' + (q.n - 1) + ' lính</small>' + q.it.map(function (k) { return I.item(k, 14); }).join('') + '</div>'; }).join('') || '<span class="muted small">Chưa có quân</span>';
    var cores = p.cores.map(function (id) { return '<span class="pp-core" title="' + esc(TT.CORES[id].desc) + '">' + I.coreIcon(id, 14) + esc(TT.CORES[id].name) + '</span>'; }).join('') || '<span class="muted small">Chưa có Lõi</span>';
    var days = sc.dayPts.map(function (v, i) { return '<span class="pp-day"><small>N' + (i + 1) + '</small><b>' + v + '</b><em>#' + sc.ranks[i] + '</em></span>'; }).join('') || '<span class="muted small">Chưa có ngày nào</span>';
    App.modal('<div class="pp-head" style="--pc:' + TT.SEAT_COLORS[seat] + '">' + I.crest(p.race, 56) + '<div><h2>' + esc(p.name) + '</h2><div class="muted">' + f.name + ' · Đời ' + TT.AGE_ROMAN[p.lv] + ' · ' + (tal ? tal.name : '') + '</div></div><div class="pp-pts"><b>' + sc.pts + '</b><small>điểm</small></div></div>' +
      '<div class="pp-grid"><div><label>Điểm hạng</label><b>' + sc.rank + '</b></div><div><label>Điểm hạ gục</label><b>' + sc.kill + '</b></div><div><label>Vàng</label><b>' + p.gold + '</b></div><div><label>Dân số</label><b>' + P.usedPop(p) + '/' + P.capacity(p) + '</b></div></div>' +
      '<h3>Quân trên sân</h3><div class="pp-army">' + army + '</div><h3>Lõi</h3><div class="pp-cores">' + cores + '</div><h3>Từng ngày</h3><div class="pp-days">' + days + '</div>' +
      (seat !== S.seat ? '<p class="muted small">Đội hình hôm nay của đối thủ chỉ hiện khi giao tranh bắt đầu.</p>' : ''), [['Đóng', 'ghost', false]]);
  }

  /* ---------- thanh dưới: bản thân · tab Tướng/Lính · tủ đồ 9 ô · nút cửa hàng ---------- */
  function renderBar() {
    var p = S.P, bar = $('#g-bar');
    if (!p) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    var need = P.xpNeed(p), cap = P.capacity(p), used = P.usedPop(p), free = cap - used, intr = P.interest(p);
    $('#gb-me').innerHTML = '<button class="age-ring" id="btn-xp" ' + (need && canPrep() && p.gold >= CFG.xpBuyCost ? '' : 'disabled') + ' title="Mua ' + CFG.xpBuyAmount + ' EXP (' + CFG.xpBuyCost + ' Vàng)" style="--xp:' + (need ? Math.round(p.xp / need * 100) : 100) + '%"><span class="ar-lv">' + TT.AGE_ROMAN[p.lv] + '</span><span class="ar-l">Đời</span>' + (need ? '<span class="ar-buy">' + I.ui('arrowup', 10) + CFG.xpBuyCost + '</span>' : '') + '</button>' +
      '<div class="me-stats"><div class="me-gold" id="me-gold">' + I.svg('coin2', null, 18) + '<b>' + p.gold + '</b><small>+' + intr + ' lãi</small></div><div class="me-pop' + (free <= 0 ? ' full' : '') + '" id="me-pop">' + I.ui('worker', 12) + ' ' + used + '/' + cap + '</div>' + (need ? '<div class="me-xp">' + p.xp + '/' + need + ' EXP</div>' : '<div class="me-xp">Đời tối đa</div>') + '</div>';
    var bx = $('#btn-xp'); bx.onclick = function () { if (!need) return; doOp({ c: 'xp' }); TT.Sound.play('coin'); };
    tipFor(bx, '<b>Lên Đời</b><div class="tt-d">Mua ' + CFG.xpBuyAmount + ' EXP với ' + CFG.xpBuyCost + ' Vàng. Mỗi ngày tự nhận ' + CFG.xpDaily + ' EXP. Đời giữ mãi qua các ngày, mở quân mới, trang bị bậc cao và thêm Sức chứa.</div>');
    tipFor($('#me-gold'), '<b>Vàng</b><div class="tt-d">Dùng mua tướng, lính, trang bị, Lõi, EXP. Mỗi ngày ai cũng nhận như nhau và tăng dần; dư giữ lại. Lãi: mỗi ' + CFG.interestPer + ' Vàng đang giữ +1 (tối đa +' + (CFG.interestMax + P.hasCoreFx(p, 'interestAdd')) + '). Lãi ngày mai: <b>+' + intr + '</b>. Bán lại mọi thứ bằng giá mua (trừ EXP).</div>');
    tipFor($('#me-pop'), '<b>Dân số / Sức chứa</b><div class="tt-d">Mỗi tướng và lính chiếm dân số theo binh chủng. Lên Đời để tăng Sức chứa.</div>');
    // ---- khu mua hàng gộp: Tướng · Lõi · Trang bị (chọn tướng → chuyển sang Lính của tướng đó) ----
    var selQ = S.sel != null && canPrep() ? P.squadById(p, S.sel) : null;
    if (!selQ && S.tab === 'sol') S.tab = 'gen';
    var tabs = selQ ? [['sol', 'soldier2', 'Lính'], ['item', 'shield', 'Trang bị'], ['core', 'diamond', 'Lõi']] : [['gen', 'crown', 'Tướng'], ['core', 'diamond', 'Lõi'], ['item', 'shield', 'Trang bị']];
    if (!tabs.some(function (t) { return t[0] === S.tab; })) S.tab = tabs[0][0];
    $('#gb-tabs').innerHTML = (selQ ? '<span class="gb-ctx" style="--fc:' + F[p.race].color + '">' + I.role(selQ.t, '#fff', 14) + '<b>' + esc(TT.unitName(p.race, selQ.t)) + '</b><button id="gb-ctx-x" title="Bỏ chọn tướng">' + I.ui('close', 10) + '</button></span>' : '') +
      tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'active' : '') + '">' + I.ui(t[1], 13) + ' ' + t[2] + '</button>'; }).join('');
    $$('#gb-tabs [data-t]').forEach(function (b) {
      b.onclick = function () { S.tab = b.dataset.t; var keep = S.sel; clearModes(); S.sel = keep; unpinTip(); renderAll(); };
      tipFor(b, TAB_TIP[b.dataset.t]);
    });
    var cx = $('#gb-ctx-x'); if (cx) cx.onclick = function () { S.sel = null; S.tab = 'gen'; clearModes(); renderAll(); };
    var cards = $('#gb-cards'), sx = cards.scrollLeft, tabKey = S.tab + (selQ ? selQ.id : '');
    cards.className = 'gb-cards t-' + S.tab;
    if (S.tab === 'gen') cards.innerHTML = genCards(p, free);
    else if (S.tab === 'sol') cards.innerHTML = solCards(p, selQ, free);
    else if (S.tab === 'core') cards.innerHTML = coreCards(p);
    else cards.innerHTML = itemCards(p, selQ);
    cards.scrollLeft = S.cardsKey === tabKey ? sx : 0; S.cardsKey = tabKey;
    bindCards(p, selQ);
    // tủ đồ 9 ô: trang bị chưa đeo + Lõi đang có hiệu lực
    var slots = [];
    p.cores.forEach(function (id, i) { slots.push('<div class="inv-slot core t' + TT.CORES[id].tier + '" data-c="' + i + '">' + I.coreIcon(id, 22) + '</div>'); });
    p.inv.forEach(function (k, i) { slots.push('<div class="inv-slot item' + (S.itemSel === i ? ' on' : '') + '" data-i="' + i + '">' + I.item(k, 26) + '</div>'); });
    while (slots.length < CFG.invSize) slots.push('<div class="inv-slot free"></div>');
    $('#gb-inv').innerHTML = slots.join('');
    $$('#gb-inv .inv-slot.item').forEach(function (d) { var i = +d.dataset.i; d.addEventListener('pointerdown', function (e) { startDrag(e, 'item', i, '<div class="dg-ic">' + I.item(p.inv[i], 30) + '</div>'); }); tipFor(d, function () { return itemTip(p.inv[i], 'Kéo hoặc chạm rồi chạm vào tướng để đeo.'); }); });
    $$('#gb-inv .inv-slot.core').forEach(function (d) { var i = +d.dataset.c; d.onclick = function (e) { var rc = d.getBoundingClientRect(); pinTip(coreTip(p.cores[i], true, i), rc.left, rc.top - 10, true); }; tipFor(d, function () { return coreTip(p.cores[i]); }); });
  }
  var TAB_TIP = {
    gen: '<b>Tướng</b><div class="tt-d">Mỗi tướng mở một đạo quân: to, mạnh, dùng kỹ năng, đeo 3 trang bị. Chạm thẻ rồi chạm vùng xuất quân (hoặc kéo thả).</div>',
    sol: '<b>Lính của tướng đang chọn</b><div class="tt-d">Chạm icon lính để mua — lính tự nhập vào đạo quân của tướng này, đi và đánh theo tướng.</div>',
    core: '<b>Lõi</b><div class="tt-d">Mua là có hiệu lực ngay (nằm trong tủ đồ). Cộng chỉ số cho toàn quân hoặc một binh chủng. Khóa để giữ qua lần đổi.</div>',
    item: '<b>Trang bị</b><div class="tt-d">Chỉ tướng đeo được, mỗi tướng 3 món. Đang chọn tướng thì mua xong đeo ngay; không thì vào tủ đồ.</div>'
  };
  function genCards(p, free) {
    return TT.ROLE_ORDER.map(function (r) {
      var R = ROLES[r], lock = R.age > p.lv, cost = TT.genCost(p.race, r), room = free >= R.pop;
      var has = p.squads.filter(function (q) { return q.t === r; }).length;
      var bad = lock || p.gold < cost || !room || (R.unique && has);
      return '<div class="bcard gen' + (lock ? ' lock' : '') + (!lock && bad ? ' no' : '') + (S.placeRole === r ? ' on' : '') + '" data-r="' + r + '" style="--fc:' + F[p.race].color + '">' +
        '<div class="bc-ic">' + I.role(r, '#fff', 28) + '</div><i class="bc-crown">' + I.ui('crown', 10) + '</i>' + (has ? '<i class="bc-has">' + has + '</i>' : '') + (lock ? '<i class="bc-lk">' + I.ui('lock', 12) + '<b>' + TT.AGE_ROMAN[R.age] + '</b></i>' : priceB(cost, p.gold < cost)) + '</div>';
    }).join('');
  }
  function solCards(p, q, free) {
    var R = ROLES[q.t];
    if (R.unique) return '<div class="gb-note">' + I.ui('info', 14) + ' Thần thú chiến đấu một mình, không có lính. Mua trang bị cho thần thú ở tab Trang bị.</div>';
    var cost = TT.unitCost(p.race, q.t), maxBuy = Math.max(0, Math.min(Math.floor(p.gold / cost), Math.floor(free / R.pop)));
    var bad = maxBuy < 1;
    return '<div class="bcard sol big' + (bad ? ' no' : '') + '" data-r="' + q.t + '" style="--fc:' + F[p.race].color + '"><div class="bc-ic">' + I.role(q.t, '#fff', 30) + '</div>' + priceB(cost, p.gold < cost) + '<i class="bc-has">' + (q.n - 1) + '</i></div>' +
      '<div class="sol-info"><b>' + (q.n - 1) + ' lính</b><small>' + esc(TT.unitName(p.race, q.t)) + ' · ' + R.pop + ' dân/lính</small><small>Mua được thêm: <b>' + maxBuy + '</b></small></div>' +
      '<button class="sol-q" data-k="5" ' + (maxBuy >= 2 ? '' : 'disabled') + '>+5</button>' +
      '<button class="sol-q" data-k="max" ' + (maxBuy >= 1 ? '' : 'disabled') + '>Tối đa</button>' +
      (q.n > 1 ? '<button class="sol-q sell" id="gb-sellsol">' + I.svg('coin2', null, 12) + ' Bán lính</button>' : '');
  }
  function coreCards(p) {
    var h = '<button class="bcard rr" id="btn-reroll" title="Đổi bảng Lõi"><div class="bc-ic">' + I.ui('rotr', 22) + '</div><small>' + (p.freeRr > 0 ? 'Miễn phí' : 'Đổi') + '</small>' + (p.freeRr > 0 ? '' : priceB(CFG.rerollCost, p.gold < CFG.rerollCost)) + '</button>';
    return h + p.board.map(function (id, i) {
      if (!id) return '<div class="bcard core empty"></div>';
      var C = TT.CORES[id], cost = CFG.corePrice[C.tier];
      return '<div class="bcard core t' + C.tier + (p.gold < cost ? ' no' : '') + '" data-s="' + i + '">' + priceB(cost, p.gold < cost) + I.coreIcon(id, 30) + '<button class="lk' + (p.locks[i] ? ' on' : '') + '" data-lk="' + i + '" title="Khóa giữ qua lần đổi">' + I.ui('lock', 10) + '</button></div>';
    }).join('');
  }
  function itemCards(p, q) {
    var full = q && q.it.length >= CFG.genItems;
    var h = (q ? '<div class="gb-note sm">' + (full ? I.ui('warn', 12) + ' Tướng đã đủ 3 món — mua sẽ vào tủ đồ' : I.ui('check', 12) + ' Mua xong đeo ngay cho tướng') + '</div>' : '');
    [1, 2, 3, 4].forEach(function (t) {
      if (t > p.lv) return;
      h += '<span class="tier-sep" title="Trang bị bậc ' + TT.AGE_ROMAN[t] + '">' + TT.AGE_ROMAN[t] + '</span>';
      TT.ITEM_ORDER.forEach(function (k) { var it = TT.ITEMS[k]; if (it.tier !== t) return; h += '<div class="bcard item' + (p.gold < it.price ? ' no' : '') + '" data-k="' + k + '">' + priceB(it.price, p.gold < it.price) + I.item(k, 28) + '</div>'; });
    });
    if (p.lv < 4) h += '<span class="tier-sep lockd">' + I.ui('lock', 11) + ' ' + TT.AGE_ROMAN[p.lv + 1] + ' · Đời ' + TT.AGE_ROMAN[p.lv + 1] + '</span>';
    return h;
  }
  // mua: chuột bấm là mua; chạm trên điện thoại thì hiện thông tin + nút Mua (trừ lính: chạm là mua ngay)
  function buyTap(d, html, price, buy) {
    if (lastPT === 'touch') { var rc = d.getBoundingClientRect(); S.tipBuy = buy; pinTip(html + '<div class="tt-act"><button class="btn small gold" data-act="buy">' + I.svg('coin2', null, 12) + ' Mua ' + price + '</button></div>', rc.left, rc.top - 6, true); }
    else buy();
  }
  function bindCards(p, q) {
    $$('#gb-cards .bcard.gen').forEach(function (b) {
      var r = b.dataset.r;
      b.addEventListener('pointerdown', function (e) { if (b.classList.contains('lock')) { App.toast('Cần Đời ' + TT.AGE_ROMAN[ROLES[r].age] + ' — bấm nút Đời để mua EXP', 'err'); return; } startDrag(e, 'gen', r, '<div class="dg-ic gen" style="--fc:' + F[p.race].color + '">' + I.role(r, '#fff', 32) + '</div>'); });
      tipFor(b, function () { return cardTip(r, true); });
    });
    var sc = $('#gb-cards .bcard.sol');
    if (sc && q) {
      sc.onclick = function () { addSoldier(q.id); };
      tipFor(sc, function () { return cardTip(q.t, false); });
      $$('#gb-cards .sol-q[data-k]').forEach(function (b) {
        b.onclick = function () {
          var R = ROLES[q.t], cost = TT.unitCost(p.race, q.t), free = P.capacity(S.P) - P.usedPop(S.P), mx = Math.min(Math.floor(S.P.gold / cost), Math.floor(free / R.pop));
          var k = b.dataset.k === 'max' ? mx : Math.min(5, mx); if (k > 0) addSoldier(q.id, k);
        };
      });
      var sl = $('#gb-sellsol'); if (sl) sl.onclick = function () { sellSoldiersPopup(q.id); };
    }
    $$('#gb-cards .bcard.core[data-s]').forEach(function (d) {
      var sl = +d.dataset.s, id = p.board[sl], buy = function () { var r = doOp({ c: 'core', slot: sl }); unpinTip(); if (r.ok) { TT.Sound.play('coin'); flyToInv(d); } };
      d.onclick = function (e) { if (e.target.closest('.lk')) return; buyTap(d, coreTip(id), CFG.corePrice[TT.CORES[id].tier], buy); };
      tipFor(d, function () { return coreTip(id) + '<div class="tt-d muted">Bấm để mua.</div>'; });
    });
    $$('#gb-cards [data-lk]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); doOp({ c: 'lock', slot: +b.dataset.lk }); }; tipFor(b, '<b>Khóa Lõi</b><div class="tt-d">Giữ Lõi này khi đổi bảng.</div>'); });
    var rr = $('#btn-reroll'); if (rr) { rr.onclick = function () { doOp({ c: 'reroll' }); TT.Sound.play('dice'); }; tipFor(rr, '<b>Đổi bảng Lõi</b><div class="tt-d">' + (p.freeRr > 0 ? 'Còn ' + p.freeRr + ' lần miễn phí hôm nay.' : 'Tốn ' + CFG.rerollCost + ' Vàng.') + ' Lõi đã khóa được giữ lại.</div>'); }
    $$('#gb-cards .bcard.item').forEach(function (d) {
      var k = d.dataset.k;
      var buyI = function () {
        var r = doOp({ c: 'buyItem', it: k }); unpinTip(); if (!r.ok) return; TT.Sound.play('coin');
        var qq = S.sel != null ? P.squadById(S.P, S.sel) : null;
        if (qq && qq.it.length < CFG.genItems) { doOp({ c: 'equip', idx: r.idx, sq: qq.id }); var gp = S.genPos[qq.id]; if (gp && S.field) S.field.fxAt('buy', gp[0], gp[1], '#ffd36b'); } else flyToInv(d);
      };
      d.onclick = function () { buyTap(d, itemTip(k), TT.ITEMS[k].price, buyI); };
      tipFor(d, function () { return itemTip(k, S.sel != null ? 'Bấm để mua và đeo ngay cho tướng đang chọn.' : 'Bấm để mua vào tủ đồ.'); });
    });
  }
  function cardTip(r, gen) {
    var p = S.P, R = ROLES[r], ud = TT.UNITS[p.race + '.' + r] || {}, gm = gen ? CFG.gen : { hp: 100, atk: 100, def: 100 }, fm = F[p.race].mods;
    return '<div class="tt-h" style="--fc:' + F[p.race].color + '">' + I.role(r, '#fff', 18) + '<b>' + esc(ud.name || R.name) + '</b><span>' + (gen ? '<em class="gen-tag">Tướng</em>' : 'Lính') + ' · ' + R.name + ' · ' + TT.CLS_NAME[R.cls] + '</span></div>' +
      '<div class="tt-s"><span>' + I.ui('heart', 11) + ' ' + Math.round(R.hp * fm.hp / 100 * gm.hp / 100) + '</span><span>' + I.ui('swords', 11) + ' ' + Math.round(R.atk * fm.atk / 100 * gm.atk / 100) + '</span><span>' + I.ui('shield', 11) + ' ' + Math.round(R.def * fm.def / 100 * gm.def / 100) + '</span><span>Tầm ' + R.rng + '</span><span>' + R.pop + ' dân</span><span>' + gold(gen ? TT.genCost(p.race, r) : TT.unitCost(p.race, r), 11) + '</span></div>' +
      (ud.psd ? '<div class="tt-p"><b>Nội tại:</b> ' + esc(ud.psd) + '</div>' : '') + (gen && ud.sk ? '<div class="tt-p"><b>' + esc(ud.sk.name) + ':</b> ' + esc(ud.sk.desc) + '</div>' : '') +
      '<div class="tt-d muted">' + (gen ? 'Tướng: to, mạnh, dùng kỹ năng, đeo 3 trang bị. Chạm thẻ rồi chạm vùng xuất quân (hoặc kéo thả). Mỗi tướng là một đạo quân riêng.' : 'Lính nhập vào tướng cùng binh chủng, đi và đánh theo tướng, không dùng kỹ năng. Chạm thẻ để thêm vào tướng.') + ' Bán lại bằng giá mua.</div>';
  }
  function itemTip(k, hint, actions, idx) {
    var it = TT.ITEMS[k];
    return '<div class="tt-h">' + I.item(k, 18) + '<b>' + it.name + '</b><span>Bậc ' + TT.AGE_ROMAN[it.tier] + ' · ' + (it.aura ? 'Hào quang cả đạo quân' : 'Cho tướng') + '</span></div><div class="tt-d">' + it.desc + '</div><div class="tt-d">Giá ' + gold(it.price, 11) + ' · bán lại bằng giá mua</div>' + (hint ? '<div class="tt-d muted">' + hint + '</div>' : '') +
      (actions ? '<div class="tt-act"><button class="btn small red" data-act="sellInv" data-v="' + idx + '">' + I.svg('coin2', null, 12) + ' Bán +' + it.price + '</button></div>' : '');
  }
  function coreTip(id, actions, idx) {
    var C = TT.CORES[id];
    return '<div class="tt-h">' + I.coreIcon(id, 18) + '<b>' + esc(C.name) + '</b><span>Lõi ' + TT.TIER_NAME[C.tier] + '</span></div><div class="tt-d">' + esc(C.desc) + '</div><div class="tt-d muted">Nằm trong tủ đồ là có hiệu lực. Bán lại bằng giá mua (' + CFG.corePrice[C.tier] + ' Vàng).</div>' +
      (actions ? '<div class="tt-act"><button class="btn small red" data-act="sellCore" data-v="' + idx + '">' + I.svg('coin2', null, 12) + ' Bán +' + (CFG.corePrice[C.tier] - (C.fx.goldNow || 0)) + '</button></div>' : '');
  }

  function flyToInv(from) {
    var inv = $('#gb-inv'); if (!inv || !from) return;
    var a = from.getBoundingClientRect(), b = inv.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'fly-dot'; d.style.left = (a.left + a.width / 2) + 'px'; d.style.top = (a.top + a.height / 2) + 'px'; document.body.appendChild(d);
    requestAnimationFrame(function () { d.style.transform = 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' + (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(.4)'; d.style.opacity = '.2'; });
    setTimeout(function () { d.remove(); }, 520);
  }

  /* ---------- bảng thông tin tướng: tự đặt trái/phải để không che tướng ---------- */
  function renderInfo() {
    var el = $('#g-info'), p = S.P, q = p && S.sel != null ? P.squadById(p, S.sel) : null;
    if (!q || /battle|over/.test(S.phase)) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var R = ROLES[q.t], ud = TT.UNITS[p.race + '.' + q.t] || {}, ctx = ctxOf(p), g = TT.Battle.previewStats(ctx, p, q, true), s = TT.Battle.previewStats(ctx, p, q, false);
    var slots = ''; for (var i = 0; i < CFG.genItems; i++) slots += q.it[i] ? '<button class="gi-it" data-slot="' + i + '">' + I.item(q.it[i], 26) + '</button>' : '<div class="gi-it empty" title="Chạm trang bị trong tủ đồ rồi chạm tướng">+</div>';
    var refund = P.squadCost(p, q) + 0;
    el.innerHTML = '<div class="gi-head" style="--fc:' + F[p.race].color + '"><div class="gi-ic">' + I.role(q.t, '#fff', 30) + '<i>' + I.ui('crown', 10) + '</i></div><div><div class="gi-n">' + esc(ud.name || R.name) + '</div><div class="gi-s">Tướng ' + R.name + ' · ' + TT.CLS_NAME[R.cls] + ' · ' + R.pop * q.n + ' dân</div></div><button class="gi-more" id="gi-more" title="Chi tiết">' + I.ui(S.infoMore ? 'close' : 'info', 12) + '<span>' + (S.infoMore ? 'Thu gọn' : 'Chi tiết') + '</span></button><button class="win-x" id="gi-x">' + I.ui('close', 12) + '</button></div>' +
      '<div class="gi-stats"><span>' + I.ui('heart', 11) + ' ' + g.hp + '</span><span>' + I.ui('swords', 11) + ' ' + g.atk + '</span><span>' + I.ui('shield', 11) + ' ' + g.def + '</span><span>Tốc ' + g.as.toFixed(2) + '</span><span>Tầm ' + g.rng + '</span><span>MP ' + g.mp0 + '/' + g.mp + '</span></div>' +
      '<div class="gi-items">' + slots + '</div>' +
      (ud.sk ? '<div class="gi-txt"><b>' + esc(ud.sk.name) + '</b> (đầy MP): ' + esc(ud.sk.desc) + '</div>' : '') + (ud.psd ? '<div class="gi-txt"><b>Nội tại:</b> ' + esc(ud.psd) + '</div>' : '') +
      '<div class="gi-sol"><div><b>' + (q.n - 1) + ' lính</b><small>' + I.ui('heart', 10) + ' ' + s.hp + ' · ' + I.ui('swords', 10) + ' ' + s.atk + ' · ' + I.ui('shield', 10) + ' ' + s.def + '</small></div>' +
      (R.unique ? '<small class="muted">Không có lính</small>' : '<button class="btn small teal pb-host" id="gi-add">' + priceB(TT.unitCost(p.race, q.t), p.gold < TT.unitCost(p.race, q.t)) + '+ Lính</button>') + '</div>' +
      '<div class="gi-row"><span>Chiến thuật</span><b>' + TT.STANCES[q.st].name + '</b></div><div class="gi-row"><span>Hành quân</span><b>' + (q.fl.length ? q.fl.length + ' cờ' : 'Tự do') + '</b></div>' +
      '<div class="gi-sell"><button class="btn small" id="gi-sellsol" ' + (q.n > 1 ? '' : 'disabled') + '>' + I.svg('coin2', null, 12) + ' Bán lính</button><button class="btn small red" id="gi-sell">' + I.ui('crown', 12) + ' Bán tướng</button></div>';
    $('#gi-x').onclick = function () { S.sel = null; renderAll(); };
    el.classList.toggle('more', !!S.infoMore);
    $('#gi-more').onclick = function () { S.infoMore = !S.infoMore; renderInfo(); };
    var ad = $('#gi-add'); if (ad) ad.onclick = function () { addSoldier(q.id); };
    var ss = $('#gi-sellsol'); if (ss) ss.onclick = function () { sellSoldiersPopup(q.id); };
    $('#gi-sell').onclick = function () { sellGeneralPopup(q.id); };
    $$('#g-info .gi-it[data-slot]').forEach(function (d) { var sl = +d.dataset.slot; d.onclick = function () { var rc = d.getBoundingClientRect(), k = q.it[sl], it = TT.ITEMS[k]; pinTip(itemTip(k) + '<div class="tt-act"><button class="btn small" data-act="unequip" data-v="' + q.id + ',' + sl + '">Tháo vào tủ</button><button class="btn small red" data-act="sellEq" data-v="' + q.id + ',' + sl + '">Bán +' + it.price + '</button></div>', rc.right + 6, rc.top); }; tipFor(d, function () { return itemTip(q.it[sl], 'Chạm để tháo hoặc bán'); }); });
    placeInfo();
  }
  /* bán lính: kéo hoặc gõ số lượng, có nút bán hết */
  function sellSoldiersPopup(id) {
    var p = S.P, q = P.squadById(p, id); if (!q || q.n < 2) return;
    var max = q.n - 1, cost = TT.unitCost(p.race, q.t), k0 = Math.max(1, Math.floor(max / 2));
    App.modal('<h2>' + I.svg('coin2', null, 20) + ' Bán lính · ' + esc(TT.unitName(p.race, q.t)) + '</h2><p class="muted">Đạo quân có ' + max + ' lính. Hoàn lại 100% giá mua (' + cost + ' Vàng mỗi lính).</p>' +
      '<div class="sell-row"><input type="range" id="sell-k" min="1" max="' + max + '" value="' + k0 + '"><input type="number" id="sell-n" min="1" max="' + max + '" value="' + k0 + '"></div>' +
      '<div class="sell-quick">' + [1, 5, 10].filter(function (v) { return v < max; }).map(function (v) { return '<button class="btn small ghost" data-k="' + v + '">' + v + '</button>'; }).join('') + '<button class="btn small ghost" data-k="' + max + '">Tất cả</button></div>' +
      '<div class="sell-sum">Nhận lại <b id="sell-g">' + k0 * cost + '</b> Vàng</div>', [['Hủy', 'ghost', false], ['Bán hết lính', 'red', 'all'], ['Bán', 'gold', 'k']]).then(function (r) {
      if (!r) return;
      var n = r === 'all' ? max : Math.max(1, Math.min(max, +($('#sell-n') || {}).value || 1));
      doOp({ c: 'sell', sq: id, k: n }); TT.Sound.play('coin');
    });
    var rg = $('#sell-k'), nb = $('#sell-n'), g = $('#sell-g');
    var sync = function (v) { v = Math.max(1, Math.min(max, v | 0)); rg.value = v; nb.value = v; g.textContent = v * cost; };
    rg.oninput = function () { sync(+rg.value); }; nb.oninput = function () { sync(+nb.value); };
    $$('.sell-quick button').forEach(function (b) { b.onclick = function () { sync(+b.dataset.k); }; });
  }
  /* bán tướng: bán cả đạo quân và mọi trang bị đang đeo, hoàn 100% */
  function sellGeneralPopup(id) {
    var p = S.P, q = P.squadById(p, id); if (!q) return;
    var gc = TT.genCost(p.race, q.t), sc = (q.n - 1) * TT.unitCost(p.race, q.t), ic = q.it.reduce(function (a, k) { return a + TT.ITEMS[k].price; }, 0);
    App.modal('<h2>' + I.ui('crown', 18) + ' Bán tướng ' + esc(TT.unitName(p.race, q.t)) + '?</h2><p class="muted">Bán cả đạo quân: tướng, toàn bộ lính và trang bị tướng đang đeo. Hoàn lại 100%.</p>' +
      '<table class="sell-tbl"><tr><td>Tướng</td><td>' + gold(gc, 12) + '</td></tr><tr><td>' + (q.n - 1) + ' lính</td><td>' + gold(sc, 12) + '</td></tr>' + q.it.map(function (k) { return '<tr><td>' + I.item(k, 16) + ' ' + esc(TT.ITEMS[k].name) + '</td><td>' + gold(TT.ITEMS[k].price, 12) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Tổng nhận</td><td>' + gold(gc + sc + ic, 14) + '</td></tr></table>', [['Hủy', 'ghost', false], ['Bán tướng', 'red', true]]).then(function (ok) {
      if (!ok) return; doOp({ c: 'sell', sq: id }); S.sel = null; TT.Sound.play('coin'); renderAll();
    });
  }
  function placeInfo() {
    var el = $('#g-info'); if (!el || el.classList.contains('hidden') || !S.field) return;
    var gp = S.genPos[S.sel]; if (!gp) return;
    var pt = S.field.project(gp[0], gp[1], 1), right = pt.x < innerWidth * .42;
    el.classList.toggle('right', right);
    // điện thoại: bảng nằm dưới → nếu tướng bị che thì lia camera đẩy tướng lên phần trống phía trên (một lần mỗi lần chọn)
    if (innerWidth <= 760 && S.focusSel !== S.sel) {
      S.focusSel = S.sel;
      var top = el.getBoundingClientRect().top, want = Math.max(150, top * .55);
      if (pt.y > top - 80) S.field.panBy(0, -(pt.y - want));
    }
  }
  /* ---------- menu ngang nổi trên đầu tướng ---------- */
  function renderAct() {
    var el = $('#g-act'), p = S.P, q = p && S.sel != null && canPrep() && !S.flagMode && S.moveSq == null ? P.squadById(p, S.sel) : null;
    if (!q) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (S.actSub === 'st') {
      el.innerHTML = TT.STANCE_ORDER.map(function (k) { return '<button class="ga-b st' + (q.st === k ? ' on' : '') + '" data-st="' + k + '">' + I.ui({ tc: 'swords', giu: 'shield', san: 'target', rut: 'heart' }[k], 16) + '<span>' + TT.STANCES[k].name + '</span></button>'; }).join('') + '<button class="ga-b back" id="ga-back">' + I.ui('close', 14) + '</button>';
      $$('#g-act [data-st]').forEach(function (b) { b.onclick = function () { doOp({ c: 'stance', sq: q.id, s: b.dataset.st }); S.actSub = null; TT.Sound.play('click'); renderAll(); }; tipFor(b, '<b>' + TT.STANCES[b.dataset.st].name + '</b><div class="tt-d">' + TT.STANCES[b.dataset.st].desc + ' Lính trong đạo quân đánh theo tướng.</div>'); });
      $('#ga-back').onclick = function () { S.actSub = null; renderAll(); };
    } else {
      el.innerHTML = '<button class="ga-b" data-a="move">' + I.ui('move', 18) + '<span>Di chuyển</span></button>' +
        '<button class="ga-b" data-a="st">' + I.ui('swords', 18) + '<span>Chiến thuật</span></button>' +
        '<button class="ga-b" data-a="flag">' + I.ui('flag', 18) + '<span>Hành quân</span></button>' +
        (ROLES[q.t].unique ? '' : '<button class="ga-b teal" data-a="sol">' + priceB(TT.unitCost(p.race, q.t), p.gold < TT.unitCost(p.race, q.t)) + I.ui('plus', 18) + '<span>+ Lính</span></button>');
      $$('#g-act [data-a]').forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.a; unpinTip();
          if (a === 'move') { S.moveSq = q.id; App.toast('Chạm chỗ mới trong vùng xuất quân (hoặc kéo thẳng tướng)', 'ok', 1500); }
          else if (a === 'st') S.actSub = 'st';
          else if (a === 'flag') { S.flagMode = { sq: q.id, type: q.fl.length ? q.fl[q.fl.length - 1].c === 'V' ? 'D' : q.fl[q.fl.length - 1].c : 'D', k: 'sat' }; }
          else if (a === 'sol') { addSoldier(q.id); return; }
          renderAll();
        };
      });
      tipFor($('#g-act [data-a=move]'), '<b>Di chuyển</b><div class="tt-d">Đổi vị trí xuất phát của cả đạo quân. Chạm chỗ mới, hoặc kéo thẳng tướng. Chạm lên tướng khác để đổi chỗ.</div>');
      tipFor($('#g-act [data-a=st]'), '<b>Chiến thuật</b><div class="tt-d">Cách đánh của đạo quân: ' + TT.STANCES[q.st].name + '. Lính làm theo tướng.</div>');
      tipFor($('#g-act [data-a=flag]'), '<b>Hành quân</b><div class="tt-d">Cắm cờ chỉ đường cho tướng; lính đi theo tướng. Xanh: đi thẳng không đánh · Đỏ: vừa đi vừa đánh · Vàng: hộ tống tướng khác.</div>');
    }
    placeAct();
  }
  function placeAct() {
    var el = $('#g-act'); if (!el || el.classList.contains('hidden') || !S.field) return;
    var gp = S.genPos[S.sel]; if (!gp) return;
    var pt = S.field.project(gp[0], gp[1], 2.6), w = el.offsetWidth, h = el.offsetHeight;
    var x = Math.max(6, Math.min(innerWidth - w - 6, pt.x - w / 2)), y = pt.y - h - 6;
    var topLim = $('.hud-top').getBoundingClientRect().bottom + 6;
    if (y < topLim) y = S.field.project(gp[0], gp[1], -.2).y + 14;
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function followLoop() { if (!S || !S.field) return; requestAnimationFrame(followLoop); if (S.sel != null && S.phase !== 'battle') { placeAct(); if ((S.fl0 = (S.fl0 || 0) + 1) % 10 === 0) placeInfo(); } }

  function renderFlagBar() {
    var el = $('#flag-bar'), fm = S.flagMode;
    if (!fm || !S.P || !canPrep()) { el.classList.add('hidden'); return; }
    var q = P.squadById(S.P, fm.sq); if (!q) { S.flagMode = null; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '<div class="fb-top">' + I.ui('flag', 14) + ' Hành quân: <b>' + esc(TT.unitName(S.P.race, q.t)) + '</b> <span class="fb-cnt">' + q.fl.length + '/' + P.flagSteps(S.P) + ' cờ</span></div><div class="fb-types">' +
      ['X', 'D', 'V'].map(function (t) { return '<button class="fb-b ' + t + (fm.type === t ? ' on' : '') + '" data-t="' + t + '"><i></i><span>' + TT.FLAGS[t].name.split(' · ')[1] + '</span></button>'; }).join('') + '</div>' +
      (fm.type === 'V' ? '<div class="seg fb-k">' + [['sat', 'Sát cánh'], ['bv', 'Bảo vệ'], ['theo', 'Theo sau']].map(function (k) { return '<button data-k="' + k[0] + '" class="' + (fm.k === k[0] ? 'active' : '') + '">' + k[1] + '</button>'; }).join('') + '</div>' : '') +
      '<div class="fb-h">' + (fm.type === 'V' ? 'Chạm vào tướng muốn hộ tống' : 'Chạm lên bản đồ để cắm cờ tiếp theo') + '</div>' +
      '<div class="fb-act"><button class="btn small ghost" id="fb-undo" ' + (q.fl.length ? '' : 'disabled') + '>' + I.ui('undo', 12) + ' Bỏ cờ cuối</button><button class="btn small ghost" id="fb-clear" ' + (q.fl.length ? '' : 'disabled') + '>Xóa hết</button><button class="btn small gold" id="fb-done">' + I.ui('check', 12) + ' Xong</button></div>';
    $$('.fb-b', el).forEach(function (b) { b.onclick = function () { fm.type = b.dataset.t; renderFlagBar(); }; tipFor(b, '<b>' + TT.FLAGS[b.dataset.t].name + '</b><div class="tt-d">' + TT.FLAGS[b.dataset.t].desc + '</div>'); });
    $$('.fb-k button', el).forEach(function (b) { b.onclick = function () { fm.k = b.dataset.k; renderFlagBar(); }; });
    $('#fb-undo').onclick = function () { doOp({ c: 'flags', sq: q.id, fl: q.fl.slice(0, -1) }); };
    $('#fb-clear').onclick = function () { doOp({ c: 'flags', sq: q.id, fl: [] }); };
    $('#fb-done').onclick = function () { S.flagMode = null; renderAll(); };
  }

  /* ================= kết quả / tổng kết ================= */
  function showResult() {
    var r = S.lastRes, sum = S.lastSummary, M = S.M; if (!r) return;
    var rows = r.players.slice().sort(function (a, b) { return a.rank - b.rank; }).map(function (x) {
      var p = MT.player(M, x.seat);
      return '<tr class="' + (x.seat === S.seat ? 'me' : '') + '"><td><b class="rk r' + x.rank + '">' + x.rank + '</b></td><td style="color:' + TT.SEAT_COLORS[x.seat] + '">' + I.crest(p.race, 22) + ' ' + esc(p.name) + '</td><td>+' + (sum.pts[x.seat] || 0) + '</td><td>' + x.kills + '</td><td>' + x.dmg + '</td><td>' + M.scores[x.seat].pts + '</td></tr>';
    }).join('');
    var mine = r.squads.filter(function (q) { return q.seat === S.seat; }).sort(function (a, b) { return b.dmg - a.dmg; }).slice(0, 5);
    var my = r.players.filter(function (x) { return x.seat === S.seat; })[0];
    var hints = [];
    if (my) {
      if (my.rank === 1) hints.push('Chiến thắng! Đội hình đang hiệu quả.');
      var dead = mine.filter(function (q) { return q.alive === 0; });
      if (dead.length) hints.push('Bị diệt sạch: ' + dead.map(function (q) { return esc(q.name); }).join(', ') + '.');
      var me0 = me(); if (me0 && P.usedPop(me0) < P.capacity(me0) - 3) hints.push('Bạn còn Sức chứa trống — mua thêm lính.');
      if (me0 && me0.squads.length && me0.squads.every(function (q) { return !q.it.length; })) hints.push('Chưa có tướng nào đeo trang bị — mở Cửa hàng.');
    }
    var o = $('#result-overlay');
    o.innerHTML = '<div class="win result-box"><button class="win-x" id="res-x">' + I.ui('close', 12) + '</button><h2>Kết quả ngày ' + sum.day + '</h2>' + (sum.monster ? '<p class="muted">' + esc(MT.player(M, sum.monster.seat).name) + ' hạ nhiều quái nhất: +' + sum.monster.gold + ' Vàng</p>' : '') +
      '<table class="over-table"><tr><th>Hạng</th><th>Người chơi</th><th>Điểm</th><th>Hạ gục</th><th>Sát thương</th><th>Tổng</th></tr>' + rows + '</table>' +
      (mine.length ? '<h3>Đạo quân của bạn</h3><div class="rep">' + mine.map(function (q) { return '<div class="rep-r">' + I.role(q.role, '#fff', 16) + '<span>' + esc(q.name) + ' ×' + q.n + '</span><b>' + q.dmg + '</b><small>sát thương · ' + q.kills + ' hạ · còn ' + q.alive + '</small></div>'; }).join('') + '</div>' : '') +
      (hints.length ? '<div class="hints">' + hints.map(function (h) { return '<div>' + I.ui('info', 12) + ' ' + h + '</div>'; }).join('') + '</div>' : '') +
      (S.M.over ? '' : '<p class="muted">Ngày mới sau <b id="res-count"></b></p>') + '</div>';
    o.classList.remove('hidden');
    $('#res-x').onclick = function () { o.classList.add('hidden'); };
    o.onclick = function (e) { if (e.target === o) o.classList.add('hidden'); };
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
  function leave() { Game.stop(); try { localStorage.removeItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { } App.cleanupRoom(); App.enterLobby(); }

  /* ================= menu ================= */
  function openMenu() {
    var o = $('#menu-overlay'), low = lsGet('ttkc.gfx') === 'low';
    o.innerHTML = '<div class="win menu-box"><h2>Menu</h2>' +
      '<button class="btn wide" id="mn-close">Tiếp tục</button>' +
      '<button class="btn wide ghost" id="mn-guide">' + I.ui('info', 14) + ' Cách chơi nhanh</button>' +
      '<button class="btn wide ghost" id="mn-gfx">Đồ họa: ' + (low ? 'Nhẹ (điện thoại)' : 'Đẹp') + '</button>' +
      '<button class="btn wide ghost" id="mn-snd">' + (TT.Sound.on ? I.ui('sound') + ' Âm thanh: Bật' : I.ui('mute') + ' Âm thanh: Tắt') + '</button>' +
      (S.seat && !S.M.over ? '<button class="btn wide red" id="mn-quit">' + I.ui('flag', 14) + ' Đầu hàng</button>' : '<button class="btn wide red" id="mn-leave">Về sảnh</button>') + '</div>';
    o.classList.remove('hidden');
    o.onclick = function (e) { if (e.target === o) o.classList.add('hidden'); };
    $('#mn-close').onclick = function () { o.classList.add('hidden'); };
    $('#mn-guide').onclick = function () { o.classList.add('hidden'); quickGuide(); };
    $('#mn-gfx').onclick = function () { lsSet('ttkc.gfx', low ? 'high' : 'low'); App.toast('Áp dụng từ lần vào trận sau', 'ok'); openMenu(); };
    $('#mn-snd').onclick = function () { TT.Sound.toggle(); openMenu(); };
    var q = $('#mn-quit'); if (q) q.onclick = function () { App.confirm('Đầu hàng?', 'Bạn sẽ bị loại khỏi ván và không thể quay lại. Điểm đã có vẫn hiện trên bảng.', 'Đầu hàng').then(function (ok) { if (!ok) return; Net.quit(S.code, S.seat, S.M.day).then(leave, leave); }); };
    var lv = $('#mn-leave'); if (lv) lv.onclick = leave;
  }
  function quickGuide() {
    App.modal('<h2>' + I.ui('info', 18) + ' Cách chơi nhanh</h2><ol class="qg">' +
      '<li><b>Mua tướng:</b> thẻ <b>Tướng</b> ở đáy màn hình → chạm thẻ rồi chạm vùng xuất quân (hoặc kéo thả). Mỗi tướng là một đạo quân.</li>' +
      '<li><b>Mua lính:</b> thẻ <b>Lính</b> → chạm thẻ để thêm lính vào tướng cùng binh chủng. Lính đi và đánh theo tướng.</li>' +
      '<li><b>Chạm vào tướng</b> để mở menu: <b>Di chuyển</b>, <b>Chiến thuật</b>, <b>Hành quân</b> (cắm cờ), <b>+ Lính</b>.</li>' +
      '<li>Thanh dưới có 3 tab: <b>Tướng</b> · <b>Lõi</b> (cộng chỉ số cho quân, có hiệu lực ngay) · <b>Trang bị</b> (tướng đeo 3 món). Chạm một tướng trên sân → thanh chuyển sang <b>Lính</b>: chạm icon lính là lính nhập ngay vào đạo quân đó. Tủ đồ 9 ô bên phải.</li>' +
      '<li><b>Vàng</b> mua được mọi thứ; giữ Vàng thì có lãi. Bấm nút <b>Đời</b> để mua EXP.</li>' +
      '<li>Bấm <b>Sẵn sàng</b>. Giao tranh tự động; sau 5 phút sát thương bão tăng gấp đôi mỗi giây. 10 ngày, nhiều điểm nhất thắng.</li></ol>' +
      '<p class="muted small">Mọi thao tác chỉ cần chạm / chuột trái. Camera: kéo chỗ trống để dời, hai ngón (hoặc lăn chuột) để phóng to, nút xoay ở cạnh phải.</p>', [['Đã hiểu', 'gold', true]]);
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
    $('#btn-chat').onclick = function () { var c = $('#g-chatbox'); c.classList.toggle('open'); $('#btn-chat').classList.remove('ping'); };
    $('#chat-x').onclick = function () { $('#g-chatbox').classList.remove('open'); };
    $$('#log-tabs button').forEach(function (b) { b.onclick = function () { $$('#log-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); }); var chat = b.dataset.t === 'chat'; $('#g-log').classList.toggle('hidden', chat); $('#g-chat').classList.toggle('hidden', !chat); $('#g-chat-form').classList.toggle('hidden', !chat); }; });
    $('#g-chat-form').onsubmit = function (e) { e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v || !S) return; inp.value = ''; Net.sendRoomChat(S.code, v).catch(function () { App.toast('Chat chưa khả dụng', 'err'); }); };
  }
  document.addEventListener('keydown', function (e) {
    if (!S || App.screen !== 'game' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { clearModes(); S.sel = null; unpinTip(); renderAll(); }
    else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    else if (k === ' ' && S.P && S.phase === 'prep') { e.preventDefault(); if (S.committed) uncommit(); else commitMine(); }
    else if (k === 'd') { S.tab = S.tab === 'core' ? 'item' : 'core'; renderAll(); }
    else if (k === 'f' && S.P) { doOp({ c: 'xp' }); }
    else if (k === 'q') { var ts = S.sel != null ? ['sol', 'item', 'core'] : ['gen', 'core', 'item']; S.tab = ts[(ts.indexOf(S.tab) + 1) % 3]; renderAll(); }
    else if (/^arrow/.test(k) && S.field) { e.preventDefault(); var d = 60; S.field.panBy(k === 'arrowleft' ? d : k === 'arrowright' ? -d : 0, k === 'arrowup' ? d : k === 'arrowdown' ? -d : 0); }
    else if (k === 'h' && S.field) S.field.resetCam();
    else if ((k === '1' || k === '2' || k === '4') && S.phase === 'battle') { S.speed = +k; if (S.field) S.field.setSpeed(S.speed); renderTop(); }
    else if ((k === 'delete' || k === 'backspace') && S.sel != null) { doOp({ c: 'sell', sq: S.sel }); S.sel = null; renderAll(); }
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
    if (!$('#g-chatbox').classList.contains('open')) $('#btn-chat').classList.add('ping');
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
  Game.layout = function () { };
  G.addEventListener('resize', function () { if (S) { renderAll(); } });
})(window);
