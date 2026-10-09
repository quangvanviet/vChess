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
      tab: 'gen', shop: false, speed: 1, log: [], results: [], botPk: {}, revealed: {}, lockTry: {}, finTry: {}, revTry: {},
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
    document.body.classList.remove('chat-open', 'info-open'); var cb = $('#g-chatbox'); if (cb) cb.classList.remove('open');
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
    S.speed = 1; S.field.setSpeed(1);
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
    S.battle = null; S.speed = 1; if (S.field) S.field.setSpeed(1); renderTop();
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
    var f = S.field = new TT.Field3D($('#board'), $('#board-wrap'), { lowRes: autoLow() });
    f.seatColor = TT.SEAT_COLORS;
    f.onClick = onFieldClick; f.onRight = function () { clearModes(); S.sel = null; renderAll(); };
    f.onDragStart = onDragStart; f.onDragMove = onDragMove; f.onDragEnd = onDragEnd;
    f.onHover = onHover; f.onHoverMove = onHover;
    $('#board').addEventListener('mouseleave', function () { if (!S.pinTip) hideTip(); });
    if (S.M.day > 0) setupFieldForDay();
    requestAnimationFrame(followLoop);
  }
  // chất lượng đồ họa: 'low' / 'high' do người chơi chọn, mặc định tự nhận máy yếu (cảm ứng, ít nhân CPU, ít RAM)
  function autoLow() {
    var pref = lsGet('ttkc.gfx'); if (pref === 'low') return true; if (pref === 'high') return false;
    var touch = matchMedia && matchMedia('(pointer: coarse)').matches;
    return !!(touch || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4));
  }
  function setupFieldForDay() {
    var f = S.field, M = S.M; if (!f) return;
    var p = me(), side = p ? p.side : 0;
    var sks = {}; M.players.forEach(function (x) { if (x.skin && TT.SKINS[x.skin]) sks[x.seat] = TT.SKINS[x.skin].c; }); f.seatSkin = sks;
    if (f.map !== M.map) f.setMap(M.map, { mode: M.mode, zones: M.players.filter(function (x) { return !x.out; }).map(function (x) { return Object.assign({ color: TT.SEAT_COLORS[x.seat], mine: x.seat === S.seat }, TT.zoneOf(M.mode, x.side)); }) });
    if (S.phase !== 'battle') { f.stopBattle(); f.mode = 'prep'; f.setView(side, TT.zoneOf(M.mode, side)); S.spec = null; }
    refreshField();
  }
  function prepUnits() {
    var list = [], M = S.M; S.genPos = {};
    var addSquads = function (p, ghost) {
      p.squads.forEach(function (q) {
        var pos = TT.Battle.formation(M.map, p.side, q.t, q.n, q.x, q.y, q.fm, q.lp, q.sp, q.cu), face = Math.atan2(TT.sideFwd[p.side][0], TT.sideFwd[p.side][1]);
        if (!ghost) S.genPos[q.id] = [pos[0][0] / 1000, pos[0][1] / 1000];
        var hl = !ghost && (S.sel === q.id || (S.solRole && q.t === S.solRole) || (S.itemSel != null && S.hoverSq === q.id));
        pos.forEach(function (ps, i) { list.push({ id: p.seat + ':' + q.id + ':' + i, race: p.race, role: q.t, x: ps[0] / 1000, y: ps[1] / 1000, face: face, seat: p.seat, cap: i === 0, items: i === 0 ? q.it : null, sel: hl, ghost: ghost, sq: ghost ? null : q.id, rad: ROLES[q.t].rad, mid: ROLES[q.t].marshal ? p.mar : undefined }); });
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
      if (!q.fl.length || !(S.sel === q.id || (S.flagMode && S.flagMode.sq === q.id))) return;   // cờ chỉ hiện khi chọn đúng tướng đó
      hl.flagKey = q.id;
      var pts = [[q.x + .5, q.y + .5]], cols = [], flags = [], dash = [];
      q.fl.forEach(function (fl) {
        var tp = flagTarget(fl); if (!tp) return;
        pts.push(tp); cols.push(FLAG_COL[fl.c]); dash.push(fl.c === 'V' || fl.c === 'T' ? 1 : 0);
        flags.push([tp[0], tp[1], FLAG_COL[fl.c], fl.c === 'V' || fl.c === 'T' ? 2.4 : 1]);
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
  function clearModes() { S.tac = null; S.placeRole = null; S.solRole = null; S.itemSel = null; S.flagMode = null; S.flagMenu = null; S.moveSq = null; S.hoverCell = null; S.dragSq = null; S.actSub = null; }
  function inMyZone(cell) { return cell && S.P && TT.inZone(TT.zoneOf(S.M.mode, S.P.side), cell[0], cell[1]); }
  /* lính không chọn riêng được: chạm / rê vào lính = chạm vào tướng của đạo quân đó */
  function genOf(v) {
    if (!v || v.cap || (v.u && v.u.monster) || !S.field) return v;
    var vis = S.field.vis || {};
    if (!v.u) { var pr = String(v.id).split(':'), g = vis[pr[0] + ':' + pr[1] + ':0']; return g && g.alive ? g : v; }
    for (var k in vis) { var w = vis[k]; if (w.alive && w.cap && w.u && w.u.sq === v.u.sq && w.u.pl === v.u.pl) return w; }
    return v;
  }
  function unitAtE(e) { return S.field ? genOf(S.field.unitAt(e, 30)) : null; }
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
    if (S.tac) { // bảng Chiến thuật đang mở: chạm tướng khác để chuyển, chạm chỗ trống để đóng bảng
      var vt = unitAtE(e);
      if (vt && vt.sq != null && !vt.ghost && vt.cap && vt.sq !== S.tac.sq) { S.tac.sq = vt.sq; S.sel = vt.sq; S.tacFocus = false; }
      else if (!(vt && vt.sq === S.tac.sq)) S.tac = null;
      renderAll(); return;
    }
    if (S.flagMode) { flagClick(cell, e); return; }
    if (S.placeRole) { buyGenAt(S.placeRole, cell); return; }
    var v = unitAtE(e);
    if (S.sel != null && S.moveSq == null && !S.solRole && S.itemSel == null) {
      var qf = P.squadById(S.P, S.sel), fh = qf && qf.fl.length ? flagAt(qf, cell, null, e, false, true) : -1;
      if (fh >= 0) { S.flagMode = { sq: qf.id }; S.flagMenu = { sq: qf.id, i: fh, x: e.clientX, y: e.clientY }; TT.Sound.play('click'); renderAll(); return; }
    }
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
  /* ---------- chế độ Cắm cờ: chạm đất = cờ đỏ · chạm tướng mình = cờ vàng · chạm địch = cờ tím · chạm cờ = sửa / xóa ---------- */
  var FLAG_COL = { D: '#ff4d4d', X: '#3d9cf0', V: '#ffd23a', T: '#a54dff' }, FLAG_NAME = { D: 'đỏ', X: 'xanh', V: 'vàng', T: 'tím' };
  function flagTarget(fl) { // vị trí hiển thị của một cờ trên bản đồ (ô); null nếu không còn mục tiêu
    if (fl.c === 'D' || fl.c === 'X') return [fl.x + .5, fl.y + .5];
    if (fl.c === 'V') { var t = P.squadById(S.P, fl.sq); return t ? [t.x + .5, t.y + .5] : null; }
    var gv = S.field && S.field.vis[fl.seat + ':' + fl.sq + ':0']; return gv ? [gv.x, gv.y] : null;
  }
  function flagAt(q, cell, v, e, byUnit, onlyDX) { // cờ nào của đội đang bị chạm? (vùng chạm là cả cột cờ trên màn hình)
    var best = -1, bd = 1e9, f0 = S.field, th = (matchMedia && matchMedia('(pointer: coarse)').matches) ? 30 : 22;
    if (e && f0) {
      var rc = f0.c.getBoundingClientRect(), mx = e.clientX, my = e.clientY;
      q.fl.forEach(function (f, i) {
        if (onlyDX && f.c !== 'D' && f.c !== 'X') return;   // ngoài chế độ cắm cờ: chỉ cờ đỏ/xanh chạm vào được
        var tp = flagTarget(f); if (!tp) return;
        var sc = (f.c === 'V' || f.c === 'T') ? 2.4 : 1, a = f0.project(tp[0], tp[1], 0), b = f0.project(tp[0], tp[1], 1.45 * sc);
        var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((mx - a.x) * dx + (my - a.y) * dy) / l2)), px = a.x + dx * t, py = a.y + dy * t, d = Math.hypot(mx - px, my - py);
        if (d <= th + 4 && d < bd) { bd = d; best = i; }
      });
      if (best >= 0) return best;
    }
    if (byUnit) q.fl.forEach(function (f, i) {
      if (f.c === 'V') { if (v && !v.ghost && v.sq === f.sq) best = i; return; }
      if (f.c === 'T') { if (v && v.ghost) { var pr = String(v.id).split(':'); if (String(pr[0]) === String(f.seat) && +pr[1] === f.sq) best = i; } }
    });
    return best;
  }
  function flagClick(cell, e) {
    var fm = S.flagMode, q = P.squadById(S.P, fm.sq); if (!q) { S.flagMode = null; renderAll(); return; }
    var v = unitAtE(e), hit = flagAt(q, cell, v, e, true);
    if (hit < 0 && v && v.sq === q.id && !v.ghost) { S.flagMode = null; S.flagMenu = null; renderFlagMenu(); TT.Sound.play('click'); renderAll(); return; }   // chạm lại chính tướng này → thoát chế độ cắm cờ
    if (hit >= 0) { S.flagMenu = { sq: q.id, i: hit, x: e.clientX, y: e.clientY }; TT.Sound.play('click'); renderFlagMenu(); return; }
    S.flagMenu = null; renderFlagMenu();
    var fl = q.fl.slice();
    if (v && v.ghost) {
      var pr = String(v.id).split(':'), mp = MT.player(S.M, pr[0]);
      if (!mp || mp.team === S.P.team) { App.toast('Cờ tím chỉ cắm vào đạo quân của đối thủ', 'err'); return; }
      fl.push({ c: 'T', seat: pr[0], sq: +pr[1] });
    } else if (v && v.sq != null) {
      if (v.sq === q.id) { App.toast('Không thể hộ tống chính mình', 'err'); return; }
      fl.push({ c: 'V', sq: v.sq, k: 'sat' });
    } else { if (!cell) return; fl.push({ c: 'D', x: cell[0], y: cell[1] }); }
    var r = doOp({ c: 'flags', sq: q.id, fl: fl }); if (r.ok) TT.Sound.play('click');
  }
  function renderFlagMenu() {
    var el = $('#flag-menu'); if (!el) { el = document.createElement('div'); el.id = 'flag-menu'; el.className = 'hud flag-menu hidden'; $('#screen-game').appendChild(el); }
    var m = S && S.flagMenu, q = m && S.flagMode && P.squadById(S.P, m.sq), f = q && q.fl[m.i];
    if (!f || !canPrep()) { if (S) S.flagMenu = null; el.classList.add('hidden'); return; }
    var btns = '';
    if (f.c === 'D') btns += '<button data-a="X" style="--c:' + FLAG_COL.X + '"><i></i>Đổi cờ xanh</button>';
    if (f.c === 'X') btns += '<button data-a="D" style="--c:' + FLAG_COL.D + '"><i></i>Đổi cờ đỏ</button>';
    btns += '<button data-a="del" class="del">' + I.ui('trash', 12) + 'Xóa cờ</button>';
    el.innerHTML = '<div class="fm-h" style="--c:' + FLAG_COL[f.c] + '"><i></i>Cờ ' + FLAG_NAME[f.c] + ' · bước ' + (m.i + 1) + '/' + q.fl.length + '</div>' + btns;
    el.classList.remove('hidden');
    var w = el.offsetWidth, h = el.offsetHeight, x = Math.max(4, Math.min(innerWidth - w - 4, m.x - w / 2)), y = m.y - h - 14; if (y < 4) y = m.y + 18;
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    $$('button', el).forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var nf = q.fl.slice(), a = b.dataset.a;
        if (a === 'del') nf.splice(m.i, 1); else nf[m.i] = { c: a, x: f.x, y: f.y }; // xóa: các cờ hai bên tự nối với nhau
        S.flagMenu = null; doOp({ c: 'flags', sq: q.id, fl: nf }); TT.Sound.play('click');
      };
    });
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
    var v = genOf(S.field.unitAt(e, 22)), html = '', key = null, ms = 2000;
    if (v) { html = unitTip(v); key = 'u' + v.id; }
    else if (cell && S.field.map) { var t = S.field.map.g[cell[1] * S.field.map.W + cell[0]]; if (TT.TERRAIN[t] && (t !== '.' || S.placeRole || S.moveSq != null)) { html = terrainTip(t); key = 't' + cell[0] + ',' + cell[1]; ms = 3000; } }
    if ((S.placeRole || S.moveSq != null) && cell) { S.hoverCell = cell; S.hoverOk = inMyZone(cell); refreshField(); }
    if (html) queueTip(key, html, e.clientX, e.clientY, null, ms); else hideTip();
  }
  function terrainTip(t) { var T0 = TT.TERRAIN[t]; return '<div class="tt-h">' + I.ui('map', 16) + '<b>' + T0.name + '</b></div><div class="tt-d">' + T0.desc + '</div>'; }
  function udOf(race, role, mar) {
    var ud = TT.UNITS[race + '.' + role] || {};
    if (ROLES[role] && ROLES[role].marshal && mar) { var m = TT.marshalOf(race, mar); return Object.assign({}, ud, { name: m.name, psd: m.psd + (m.act ? ' · ' + m.act.name + ' (hồi ' + m.act.cd + 's): ' + m.act.desc : '') }); }
    return ud;
  }
  function unitTip(v) {
    var race = v.race, role = v.role, u = v.u, R = ROLES[role] || {};
    if (u && u.monster) return '<b>' + esc(u.name) + '</b><div class="tt-d">Quái trung lập — đánh mọi bên tới gần. Ai hạ nhiều quái nhất được thêm Vàng.</div><div class="tt-s"><span>' + I.ui('heart', 11) + ' ' + u.hp + '/' + u.mhp + '</span></div>';
    var f = F[race], gen = !!v.cap;
    var owner = v.ghost ? MT.player(S.M, v.seat) : (u ? null : S.P);
    var ud = udOf(race, role, u ? u.mid : owner ? owner.mar : S.P.mar);
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
  /* Tooltip thông minh: hiện ngay trên con trỏ, nghiêng trái/phải theo vị trí con trỏ, tự né các nút / bảng
     (chọn vị trí ít chồng lên nút nhất) và hơi trong suốt để vẫn thấy cảnh phía sau. */
  var AVOID = '#g-bar, #g-act, #g-info, #flag-bar, #tac-pop, #solup-pop, .top-ctrl, .day-banner, .hud-btn, #g-players, #g-mode, .act-menu';
  var avoidC = { t: 0, r: [] };
  function avoidRects() {
    var n = Date.now(); if (n - avoidC.t < 160) return avoidC.r;
    avoidC.t = n; avoidC.r = [];
    $$(AVOID).forEach(function (el) { if (el.classList.contains('hidden') || !el.offsetParent && getComputedStyle(el).position !== 'fixed') return; var r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight) avoidC.r.push(r); });
    return avoidC.r;
  }
  function ovl(a, b) { var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return w > 0 && h > 0 ? w * h : 0; }
  function placeTip(t, cx, cy, el) {
    var w = t.offsetWidth, h = t.offsetHeight, vw = innerWidth, vh = innerHeight, g = 14, av = avoidRects(), c = [];
    var er = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null, right = cx < vw / 2;
    var xs = right ? [cx + g, cx - g - w] : [cx - g - w, cx + g], ys = [cy - g - h, cy + g + 8];
    xs.forEach(function (x, i) { ys.forEach(function (y, j) { c.push({ x: x, y: y, pen: i * 30 + j * 22 }); }); });
    if (er) { var ex = cx - w / 2; c.push({ x: ex, y: er.top - 8 - h, pen: 6 }); c.push({ x: ex, y: er.bottom + 8, pen: 50 }); c.push({ x: er.right + 8, y: cy - h / 2, pen: 70 }); c.push({ x: er.left - 8 - w, y: cy - h / 2, pen: 70 }); }
    av.forEach(function (r) { // con trỏ đang nằm trong một bảng/thanh: đặt tooltip ngay trên (hoặc dưới) cả bảng đó
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { var ax = cx - w / 2; c.push({ x: ax, y: r.top - 8 - h, pen: 4 }); c.push({ x: ax, y: r.bottom + 8, pen: 40 }); }
    });
    var cur = { left: cx - 10, right: cx + 10, top: cy - 10, bottom: cy + 10 }, best = null;
    c.forEach(function (o) {
      var x = Math.max(6, Math.min(vw - w - 6, o.x)), y = Math.max(6, Math.min(vh - h - 6, o.y)), r = { left: x, top: y, right: x + w, bottom: y + h };
      var sc = o.pen + (Math.abs(x - o.x) + Math.abs(y - o.y)) * 1.5 + ovl(r, cur) * 4;
      for (var k = 0; k < av.length; k++) sc += ovl(r, av[k]) * .3;
      if (!best || sc < best.sc) best = { sc: sc, x: x, y: y };
    });
    t.style.left = Math.round(best.x) + 'px'; t.style.top = Math.round(best.y) + 'px';
  }
  function showTip(html, x, y, el) {
    var t = $('#tip-box'); if (!t) return;
    if (t._h !== html) { t.innerHTML = html; t._h = html; }
    t.classList.remove('hidden', 'pinned');
    placeTip(t, x, y, el);
  }
  function pinTip(html, x, y, above) {
    if (!S) return;
    var t = $('#tip-box'); t._h = null; showTip(html, x, y); t.classList.add('pinned'); S.pinTip = true;
    $$('#tip-box [data-act]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); tipAction(b.dataset.act, b.dataset.v); }; });
  }
  function unpinTip() { if (S) S.pinTip = false; hideTip(); }
  function hideTip() { if (tipTimer) { clearTimeout(tipTimer); tipTimer = 0; } tipKey = null; var t = $('#tip-box'); if (t) { t.classList.add('hidden'); t._h = null; } }
  /* tooltip trễ: chỉ hiện khi con trỏ dừng trên cùng một thứ đủ lâu (địa hình 3s, còn lại 2s) — tránh rối khi di chuột */
  var tipTimer = 0, tipKey = null, tipShown = false, tipLast = null;
  function queueTip(key, html, x, y, el, ms) {
    tipLast = { html: html, x: x, y: y, el: el };
    var t = $('#tip-box');
    if (tipKey === key) { if (tipShown && t && !t.classList.contains('hidden')) { if (typeof html !== 'function') showTip(html, x, y, el); } return; }
    if (tipTimer) clearTimeout(tipTimer);
    tipKey = key; tipShown = false;
    if (t) { t.classList.add('hidden'); t._h = null; }
    tipTimer = setTimeout(function () { tipTimer = 0; if (!S || S.pinTip || tipKey !== key) return; tipShown = true; var L = tipLast; showTip(typeof L.html === 'function' ? L.html() : L.html, L.x, L.y, L.el); }, ms);
  }
  function tipFor(el, html, ms) {
    var on = function (e) { if (S && S.pinTip) return; queueTip(el, html, e.clientX, e.clientY, el, ms == null ? 2000 : ms); };
    el.addEventListener('mouseenter', on); el.addEventListener('mousemove', on);
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
    renderTop(); renderPlayers(); renderBar(); renderInfo(); renderAct(); renderTac(); renderFlagBar(); refreshField();
    // chế độ tập trung: giao diện khác trượt/mờ đi để dễ thao tác trên bản đồ
    var focus = S.scoreOpen ? 'score' : S.tac ? 'tac' : S.flagMode ? 'flag' : (S.moveSq != null || S.dragSq != null) ? 'move' : '';
    document.body.dataset.focus = focus; document.body.classList.toggle('flag-top', focus === 'flag' && !!S.flagTop);
    var bar = $('#g-bar'); if (bar && !bar.classList.contains('hidden')) document.documentElement.style.setProperty('--barh', Math.round(bar.offsetHeight + (parseFloat(getComputedStyle(bar).bottom) || 8) + 8) + 'px');
    $('#g-mode').classList.toggle('hidden', !(S.placeRole || S.solRole || S.moveSq != null));
    document.body.classList.toggle('mode-bottom', S.moveSq != null);
    if (S.placeRole) $('#g-mode').innerHTML = I.ui('plus', 14) + ' Chạm vùng xuất quân để đặt tướng <b>' + esc(TT.unitName(S.P.race, S.placeRole)) + '</b><button class="x-circ" id="mode-x" title="Hủy" aria-label="Hủy">' + I.ui('close', 11) + '</button>';
    else if (S.solRole) $('#g-mode').innerHTML = I.ui('plus', 14) + ' Chạm tướng <b>' + esc(TT.unitName(S.P.race, S.solRole)) + '</b> để thêm lính<button class="x-circ" id="mode-x" title="Xong" aria-label="Xong">' + I.ui('close', 11) + '</button>';
    else if (S.moveSq != null) $('#g-mode').innerHTML = I.ui('move', 14) + ' Chạm chỗ mới trong vùng xuất quân<button class="x-circ" id="mode-x" title="Hủy" aria-label="Hủy">' + I.ui('close', 11) + '</button>';
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
    var sb = $('#btn-speed'); if (sb) { sb.textContent = 'x' + S.speed; sb.dataset.s = S.speed; sb.classList.toggle('active', S.speed > 1); }
  }
  function tickUI() {
    if (!S || App.screen !== 'game') return;
    var t = now(), tm = $('#phase-timer'), fill = tm.querySelector('.fill'), span = tm.querySelector('span');
    if (S.phase === 'battle' && S.battle && S.field && !S.field.ended && t > S.finAt + S.dur + 600) S.field.skipBattle(); // máy chậm: bắt kịp đồng hồ chung
    if (S.phase === 'battle' && S.battle) {
      var sec = Math.floor(S.battle.tick / 20), m = Math.floor(sec / 60), s = sec % 60;
      span.textContent = m + ':' + ('0' + s).slice(-2);
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
  function fmtS(ms) { // luôn là số nguyên: m:ss hoặc g:mm:ss
    ms = +ms; if (!isFinite(ms) || ms < 0) ms = 0;
    var s = Math.ceil(Math.round(ms) / 1000) | 0;
    if (s > 359999) return '99:59:59';
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60, p2 = function (x) { return ('0' + x).slice(-2); };
    return h ? h + ':' + p2(m) + ':' + p2(ss) : m + ':' + p2(ss);
  }
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
      return '<button class="pchip' + (S.spec === p.seat || (!S.spec && p.seat === S.seat) ? ' active' : '') + (p.out ? ' dead' : '') + (p.seat === S.seat ? ' me' : '') + '" data-seat="' + p.seat + '" style="--pc:' + TT.SEAT_COLORS[p.seat] + '" title="' + esc(p.name) + '">' +
        '<span class="pc-rank">' + (i + 1) + '</span>' + I.crest(p.race, 22) + '<span class="pc-name">' + esc(p.name) + '</span><b class="pc-pts">' + s.pts + '</b>' + extra + '</button>';
    }).join('');
    var key = (S.spec || '') + '#' + st.map(function (s) { var p = MT.player(M, s.seat); return s.seat + ':' + s.pts + ':' + (p.out ? 1 : 0) + ':' + (c[p.seat] ? 1 : 0); }).join('|') + (B ? 'B' : '');
    var box = $('#g-players');
    if (box._k === key && !B) return; box._k = key;
    if (B && box._k2 === key) { // giữa trận: chỉ cập nhật thanh máu
      st.forEach(function (s) { var hp = 0, mh = 0; B.units.forEach(function (u) { if (u.seat === s.seat && !u.monster) { mh += u.mhp; if (u.alive) hp += u.hp; } }); var bar = box.querySelector('.pchip[data-seat="' + s.seat + '"] .pc-hp i'); if (bar) bar.style.width = (mh ? hp / mh * 100 : 0) + '%'; });
      return;
    }
    box._k2 = B ? key : null; box.innerHTML = '<button class="pl-score" id="pl-score" title="Bảng điểm" aria-label="Bảng điểm">' + I.ui('trophy', 16) + '<span>Bảng điểm</span></button>' + html;
    $('#pl-score').onclick = scoreboard; // chỉ vẽ lại khi đổi (không làm mất cú chạm)
    $$('#g-players .pchip').forEach(function (b) { b.onclick = function () { peekPlayer(b.dataset.seat); }; });
  }
  // bấm người chơi: camera bay sang khu của họ (bấm chính mình để về)
  function peekPlayer(seat) {
    var M = S.M, p = MT.player(M, seat), f = S.field; if (!f || !p) return;
    if (p.out) { App.toast('Người chơi này đã rời trận.'); return; }
    S.spec = seat === S.seat ? null : seat; TT.Sound.play('click');
    f.peekZone(TT.zoneOf(M.mode, p.side)); renderPlayers();
    if (S.spec) App.toast('Đang xem đội hình của ' + p.name + '. Bấm tên bạn để quay về.');
  }
  // bảng điểm: mở ra thì mọi giao diện khác trượt khỏi màn hình, đóng lại mới quay về
  function scoreboard() {
    var M = S.M, st = MT.standings(M); S.scoreOpen = true; renderAll(); TT.Sound.play('click');
    var rows = st.map(function (s, i) { var p = MT.player(M, s.seat); return '<tr class="' + (s.seat === S.seat ? 'me' : '') + '"><td>' + (i + 1) + '</td><td style="color:' + TT.SEAT_COLORS[s.seat] + '">' + I.crest(p.race, 22) + ' ' + esc(s.name) + (p.out ? ' <small class="muted">(đã rời)</small>' : '') + '</td><td>' + F[s.race].short + '</td><td>' + s.rank + '</td><td>' + s.kill + '</td><td><b>' + s.pts + '</b></td></tr>'; }).join('');
    App.modal('<h2>Bảng điểm · Ngày ' + M.day + '</h2><table class="over-table"><tr><th>#</th><th>Người chơi</th><th>Tộc</th><th>Điểm hạng</th><th>Điểm hạ gục</th><th>Tổng</th></tr>' + rows + '</table>', [['Đóng', 'gold', true]]).then(function () { S.scoreOpen = false; if (S && App.screen === 'game') renderAll(); });
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
      '<button class="pop-btn' + (canPrep() && P.popLeft(p) > 0 && p.gold >= P.popPrice(p) ? '' : ' off') + '" id="btn-pop">' + I.ui('worker', 16) + '<b>+' + CFG.popBuy.amount + '</b>' + (P.popLeft(p) > 0 ? priceB(P.popPrice(p), p.gold < P.popPrice(p)) : '<small>Tối đa</small>') + '</button>' +
      '<div class="me-stats"><div class="me-gold" id="me-gold">' + I.svg('coin2', null, 18) + '<b>' + p.gold + '</b><small>+' + intr + ' lãi</small></div><div class="me-pop' + (free <= 0 ? ' full' : '') + '" id="me-pop">' + I.ui('worker', 12) + ' ' + used + '/' + cap + '</div>' + (need ? '<div class="me-xp">' + p.xp + '/' + need + ' EXP</div>' : '<div class="me-xp">Đời tối đa</div>') + '</div>';
    var bp = $('#btn-pop'); if (bp) { bp.onclick = function () { var r = doOp({ c: 'pop' }); if (r.ok) { TT.Sound.play('coin'); var z = TT.zoneOf(S.M.mode, S.P.side); if (S.field) S.field.fxAt('level', (z.x0 + z.x1) / 2 + .5, (z.y0 + z.y1) / 2 + .5); } }; tipFor(bp, popTip()); }
    var bx = $('#btn-xp'); bx.onclick = function () { if (!need) return; doOp({ c: 'xp' }); TT.Sound.play('coin'); };
    tipFor(bx, '<b>Lên Đời</b><div class="tt-d">Mua ' + CFG.xpBuyAmount + ' EXP với ' + CFG.xpBuyCost + ' Vàng. Mỗi ngày tự nhận ' + CFG.xpDaily + ' EXP. Đời giữ mãi qua các ngày, mở quân mới, trang bị bậc cao và thêm Sức chứa.</div>');
    tipFor($('#me-gold'), '<b>Vàng</b><div class="tt-d">Dùng mua tướng, lính, trang bị, Lõi, EXP. Mỗi ngày ai cũng nhận như nhau và tăng dần; dư giữ lại. Lãi: mỗi ' + CFG.interestPer + ' Vàng đang giữ +1 (tối đa +' + (CFG.interestMax + P.hasCoreFx(p, 'interestAdd')) + '). Lãi ngày mai: <b>+' + intr + '</b>. Bán lại mọi thứ bằng giá mua (trừ EXP).</div>');
    tipFor($('#me-pop'), '<b>Dân số / Sức chứa</b><div class="tt-d">Mỗi tướng và lính chiếm dân số theo binh chủng. Lên Đời để tăng Sức chứa.</div>');
    // ---- khu mua hàng gộp: Tướng · Lõi · Trang bị (chọn tướng → chuyển sang Lính của tướng đó) ----
    var selQ = S.sel != null && canPrep() ? P.squadById(p, S.sel) : null;
    if (!selQ && S.tab === 'sol') S.tab = 'gen';
    var tabs = selQ ? [['sol', 'soldier2', selQ && ROLES[selQ.t].marshal ? 'Triệu hồi' : 'Lính'], ['item', 'shield', 'Trang bị'], ['core', 'diamond', 'Lõi']] : [['gen', 'crown', 'Tướng'], ['core', 'diamond', 'Lõi'], ['item', 'shield', 'Trang bị']];
    if (!tabs.some(function (t) { return t[0] === S.tab; })) S.tab = tabs[0][0];
    $('#gb-tabs').innerHTML = (selQ ? '<span class="gb-ctx" style="--fc:' + F[p.race].color + '">' + I.role(selQ.t, '#fff', 14) + '<b>' + esc(TT.unitName(p.race, selQ.t)) + '</b><button id="gb-ctx-x" title="Bỏ chọn tướng">' + I.ui('close', 10) + '</button></span>' : '') +
      tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'active' : '') + '">' + I.ui(t[1], 13) + ' ' + t[2] + '</button>'; }).join('');
    $$('#gb-tabs [data-t]').forEach(function (b) {
      b.onclick = function () { S.tab = b.dataset.t; var keep = S.sel; clearModes(); S.sel = keep; unpinTip(); renderAll(); };
      tipFor(b, b.dataset.t === 'item' ? function () { return TAB_TIP.item + '<div class="odds">' + oddsHtml(S.P) + '</div>'; } : TAB_TIP[b.dataset.t]);
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
  function popTip() {
    var p = S.P, left = P.popLeft(p);
    return '<b>Mua dân</b><div class="tt-d">Mỗi lần +' + CFG.popBuy.amount + ' Sức chứa để đặt thêm quân trên sân. ' + (left > 0 ? 'Lần này <b>' + P.popPrice(p) + ' Vàng</b> (giá tăng dần, còn ' + left + ' lần). ' : 'Bạn đã mua tối đa. ') + 'Không hoàn lại khi bán quân.</div><div class="tt-d muted">Đã mua ' + (p.pop | 0) + '/' + CFG.popBuy.max + ' lần · Sức chứa ' + P.capacity(p) + '.</div>';
  }
  /* tỉ lệ bậc trang bị của cửa hàng hôm nay (đã loại bậc cao hơn Đời) */
  function itemOdds(p) {
    var w = (TT.ITEM_DAY_W[Math.min(S.M.day, CFG.days)] || TT.ITEM_DAY_W[1]).map(function (v, i) { return i + 1 > p.lv ? 0 : v; }), t = w.reduce(function (a, b) { return a + b; }, 0) || 1;
    return w.map(function (v) { return Math.round(v * 100 / t); });
  }
  function oddsHtml(p) {
    var o = itemOdds(p); return o.map(function (v, i) { return v ? '<span class="od t' + (i + 1) + '"><i></i>' + TT.TIER_NAME[i + 1] + ' ' + v + '%</span>' : ''; }).join('');
  }
  var TAB_TIP = {
    gen: '<b>Tướng</b><div class="tt-d">Mỗi tướng mở một đạo quân: to, mạnh, dùng kỹ năng, đeo 3 trang bị. Chạm thẻ rồi chạm vùng xuất quân (hoặc kéo thả).</div>',
    sol: '<b>Lính của tướng đang chọn</b><div class="tt-d">Chạm icon lính để mua — lính tự nhập vào đạo quân của tướng này, đi và đánh theo tướng.</div>',
    core: '<b>Lõi</b><div class="tt-d">Mua là có hiệu lực ngay (nằm trong tủ đồ). Cộng chỉ số cho toàn quân hoặc một binh chủng. Khóa để giữ qua lần đổi.</div>',
    item: '<b>Cửa hàng trang bị</b><div class="tt-d">Mỗi ngày một bảng trang bị ngẫu nhiên; tỉ lệ bậc cao thay đổi theo ngày và theo Đời. Chỉ tướng đeo được, mỗi tướng 3 món. Đang chọn tướng thì mua xong đeo ngay.</div>'
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
    if (R.marshal) {
      var MS = CFG.marshal.summon, cur = q.sm || 'linh', smd = P.hasCoreFx(p, 'summonMp') || 0;
      return TT.ROLE_ORDER.filter(function (r) { return MS[r]; }).map(function (r) {
        var lock = ROLES[r].age > p.lv, mp = Math.max(10, Math.floor(MS[r].mp * (100 - Math.min(60, smd)) / 100));
        return '<div class="bcard sm' + (lock ? ' lock' : '') + (cur === r && !lock ? ' on' : '') + '" data-sm="' + r + '" style="--fc:' + F[p.race].color + '"><div class="bc-ic">' + I.role(r, '#fff', 28) + '</div>' +
          (lock ? '<i class="bc-lk">' + I.ui('lock', 12) + '<b>' + TT.AGE_ROMAN[ROLES[r].age] + '</b></i>' : '<span class="sm-mp">' + I.ui('bolt', 10) + mp + '</span><i class="bc-has">x' + MS[r].n + '</i>') + '</div>';
      }).join('');
    }
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
    var h = '<button class="bcard rr" id="btn-ireroll" title="Đổi cửa hàng trang bị"><div class="bc-ic">' + I.ui('rotr', 22) + '</div><small>' + (p.freeIr > 0 ? 'Miễn phí' : 'Đổi') + '</small>' + (p.freeIr > 0 ? '' : priceB(CFG.rerollCost, p.gold < CFG.rerollCost)) + '</button>';
    h += p.ishop.map(function (k, i) {
      if (!k) return '<div class="bcard item empty"></div>';
      var it = TT.ITEMS[k];
      return '<div class="bcard item t' + it.tier + (p.gold < it.price ? ' no' : '') + '" data-s="' + i + '">' + priceB(it.price, p.gold < it.price) + I.item(k, 28) + '</div>';
    }).join('');
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
    $$('#gb-cards .bcard.sm').forEach(function (b) {
      var r = b.dataset.sm;
      b.onclick = function () { if (b.classList.contains('lock')) { App.toast('Cần Đời ' + TT.AGE_ROMAN[ROLES[r].age] + ' để triệu hồi loại này', 'err'); return; } if (q && doOp({ c: 'summon', sq: q.id, r: r }).ok) TT.Sound.play('click'); };
      tipFor(b, function () { var M = CFG.marshal.summon[r]; return '<b>Triệu hồi ' + esc(TT.unitName(p.race, r)) + '</b><div class="tt-d">Khi đủ ' + M.mp + ' MP, Nguyên soái triệu hồi ' + M.n + ' lính (sức mạnh ' + M.pct + '%) đứng cạnh, tồn tại trong ngày. Lính càng mạnh càng tốn nhiều MP.</div>'; });
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
      var sl = +d.dataset.s, id = p.board[sl], buy = function () { var ic = iconOf(d), rc = d.getBoundingClientRect(), r = doOp({ c: 'core', slot: sl }); unpinTip(); if (r.ok) { TT.Sound.play('coin'); flyTo(ic, rc, $('#gb-inv .inv-slot.core[data-c="' + (S.P.cores.length - 1) + '"]')); } };
      d.onclick = function (e) { if (e.target.closest('.lk')) return; buyTap(d, coreTip(id), CFG.corePrice[TT.CORES[id].tier], buy); };
      tipFor(d, function () { return coreTip(id) + '<div class="tt-d muted">Bấm để mua.</div>'; });
    });
    $$('#gb-cards [data-lk]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); doOp({ c: 'lock', slot: +b.dataset.lk }); }; tipFor(b, '<b>Khóa Lõi</b><div class="tt-d">Giữ Lõi này khi đổi bảng.</div>'); });
    var rr = $('#btn-reroll'); if (rr) { rr.onclick = function () { doOp({ c: 'reroll' }); TT.Sound.play('dice'); }; tipFor(rr, '<b>Đổi bảng Lõi</b><div class="tt-d">' + (p.freeRr > 0 ? 'Còn ' + p.freeRr + ' lần miễn phí hôm nay.' : 'Tốn ' + CFG.rerollCost + ' Vàng.') + ' Lõi đã khóa được giữ lại.</div>'); }
    $$('#gb-cards .bcard.item[data-s]').forEach(function (d) {
      var sl = +d.dataset.s, k = p.ishop[sl];
      var buyI = function () {
        var ic = iconOf(d), rc = d.getBoundingClientRect(), qq = S.sel != null ? P.squadById(S.P, S.sel) : null;
        var r = doOp({ c: 'buyItem', slot: sl, sq: qq && qq.it.length < CFG.genItems ? qq.id : null }); unpinTip(); if (!r.ok) return; TT.Sound.play('coin');
        if (r.eq != null) { // mua thẳng vào ô đồ của tướng (kể cả khi tủ đồ đã đầy)
          var q2 = P.squadById(S.P, r.eq), gp = S.genPos[r.eq], tg = $('#g-info .gi-it[data-slot="' + (q2.it.length - 1) + '"]'), fb = null;
          if (!tg || !tg.offsetParent || getComputedStyle($('#g-info')).opacity < .5) { tg = null; if (gp && S.field) { var pt = S.field.project(gp[0], gp[1], 1.2); fb = { left: pt.x - 8, top: pt.y - 8, width: 16, height: 16 }; } }
          flyTo(ic, rc, tg, fb);
          if (gp && S.field) setTimeout(function () { if (S && S.field) S.field.fxAt('buy', gp[0], gp[1], '#ffd36b'); }, 600);
        } else flyTo(ic, rc, $('#gb-inv .inv-slot.item[data-i="' + r.idx + '"]'));
      };
      d.onclick = function () { buyTap(d, itemTip(k), TT.ITEMS[k].price, buyI); };
      tipFor(d, function () { return itemTip(k, S.sel != null ? 'Bấm để mua và đeo ngay cho tướng đang chọn.' : 'Bấm để mua vào tủ đồ.'); });
    });
    var ir = $('#btn-ireroll'); if (ir) { ir.onclick = function () { doOp({ c: 'ireroll' }); TT.Sound.play('dice'); }; tipFor(ir, function () { return '<b>Đổi cửa hàng trang bị</b><div class="tt-d">' + (p.freeIr > 0 ? 'Còn ' + p.freeIr + ' lần miễn phí hôm nay.' : 'Tốn ' + CFG.rerollCost + ' Vàng.') + '</div><div class="tt-d">Tỉ lệ bậc hôm nay (Ngày ' + S.M.day + '):</div><div class="odds">' + oddsHtml(p) + '</div>'; }); }
  }
  function cardTip(r, gen) {
    var p = S.P, R = ROLES[r], ud = udOf(p.race, r, p.mar), gm = gen ? CFG.gen : { hp: 100, atk: 100, def: 100 }, fm = F[p.race].mods;
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

  /* icon bay (cung cong, phóng to rồi thu nhỏ, có vệt sáng) từ thẻ vừa mua vào ô đích; ô đích ẩn tới khi icon chạm */
  function iconOf(el) { var i = el && el.querySelector('.it-ic, .core-ic'); return i ? i.outerHTML : ''; }
  function flyTo(html, a, target, fallbackRect) {
    var b = target ? target.getBoundingClientRect() : fallbackRect; if (!html || !a || !b) return;
    var sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2, dx = ex - sx, dy = ey - sy;
    var d = document.createElement('div'); d.className = 'fly-ic'; d.innerHTML = html; d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.appendChild(d);
    if (target) target.style.visibility = 'hidden';
    var lift = -Math.min(140, 50 + Math.hypot(dx, dy) * .22), T = 720;
    var fin = function () { d.remove(); if (target) { target.style.visibility = ''; target.classList.remove('pop-in'); void target.offsetWidth; target.classList.add('pop-in'); } };
    if (!d.animate) { setTimeout(fin, 50); return; }
    d.animate([
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(calc(-50% + ' + dx * .3 + 'px),calc(-50% + ' + (dy * .3 + lift) + 'px)) scale(1.5) rotate(-10deg)', opacity: 1, offset: .4 },
      { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) scale(.75) rotate(0deg)', opacity: 1, offset: 1 }
    ], { duration: T, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = fin;
    for (var i = 1; i <= 5; i++) (function (k) { // vệt sáng mờ dần phía sau
      setTimeout(function () { var q = k / 6, t = document.createElement('div'); t.className = 'fly-trail'; t.style.left = (sx + dx * q) + 'px'; t.style.top = (sy + dy * q + lift * 4 * q * (1 - q)) + 'px'; document.body.appendChild(t); if (t.animate) t.animate([{ opacity: .9, transform: 'scale(1.2)' }, { opacity: 0, transform: 'scale(.2)' }], { duration: 360 }).onfinish = function () { t.remove(); }; else t.remove(); }, T * (k / 6) * .85);
    })(i);
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
    if (!q || /battle|over/.test(S.phase)) { el.classList.add('hidden'); document.body.classList.remove('info-open'); S.solUp = null; renderSolUp(); return; }
    el.classList.remove('hidden'); document.body.classList.add('info-open');
    if (innerHeight <= 520) { var cbx = $('#g-chatbox'); if (cbx && cbx.classList.contains('open')) { cbx.classList.remove('open'); document.body.classList.remove('chat-open'); } } // bảng tướng mở → chat tự thu gọn
    var R = ROLES[q.t], ud = udOf(p.race, q.t, p.mar), ctx = ctxOf(p), g = TT.Battle.previewStats(ctx, p, q, true), s = TT.Battle.previewStats(ctx, p, q, false);
    var slots = ''; for (var i = 0; i < CFG.genItems; i++) slots += q.it[i] ? '<button class="gi-it" data-slot="' + i + '">' + I.item(q.it[i], 26) + '</button>' : '<div class="gi-it empty" title="Chạm trang bị trong tủ đồ rồi chạm tướng">+</div>';
    var upN = (q.up || []).reduce(function (a, b) { return a + (b | 0); }, 0), upMax = CFG.solUp.max * CFG.solUp.stats.length;
    if (!R.unique) slots += '<button class="gi-up' + (S.solUp === q.id ? ' on' : '') + '" id="gi-up" title="Nâng cấp lính">' + I.ui('up', 16) + '<span>Lính</span><i>' + upN + '/' + upMax + '</i></button>';
    el.innerHTML = '<div class="gi-c1"><div class="gi-head" style="--fc:' + F[p.race].color + '"><div class="gi-ic">' + I.role(q.t, '#fff', 30) + '<i>' + I.ui('crown', 10) + '</i></div><div><div class="gi-n">' + esc(ud.name || R.name) + '</div><div class="gi-s">' + (R.marshal ? 'Ngã là thua ngày · ' : 'Tướng ' + R.name + ' · ') + TT.CLS_NAME[R.cls] + (R.marshal ? '' : ' · ' + R.pop * q.n + ' dân') + '</div></div><button class="gi-more" id="gi-more" title="Chi tiết">' + I.ui(S.infoMore ? 'close' : 'info', 12) + '<span>' + (S.infoMore ? 'Thu gọn' : 'Chi tiết') + '</span></button><button class="win-x" id="gi-x">' + I.ui('close', 12) + '</button></div>' +
      '<div class="gi-stats"><span>' + I.ui('heart', 11) + ' ' + g.hp + '</span><span>' + I.ui('swords', 11) + ' ' + g.atk + '</span><span>' + I.ui('shield', 11) + ' ' + g.def + '</span><span>Tốc ' + g.as.toFixed(2) + '</span><span>Tầm ' + g.rng + '</span><span>MP ' + g.mp0 + '/' + g.mp + '</span></div>' +
      '<div class="gi-items">' + slots + '</div></div><div class="gi-c2">' +
      (ud.sk ? '<div class="gi-txt"><b>' + esc(ud.sk.name) + '</b> (đầy MP): ' + esc(ud.sk.desc) + '</div>' : '') + (ud.psd ? '<div class="gi-txt"><b>Nội tại:</b> ' + esc(ud.psd) + '</div>' : '') + '</div><div class="gi-c3">' +
      '<div class="gi-sol"><div><b>' + (q.n - 1) + ' lính</b><small>' + (R.unique ? '' : (upN ? 'Đã nâng ' + upN + ' cấp · ' : '') + 'chạm <b>Lính</b> ở trên để xem và nâng cấp') + '</small></div>' +
      (R.marshal ? '<small class="muted">Chọn lính triệu hồi ở thanh dưới</small>' : R.unique ? '<small class="muted">Không có lính</small>' : '<button class="btn small teal pb-host" id="gi-add">' + priceB(TT.unitCost(p.race, q.t), p.gold < TT.unitCost(p.race, q.t)) + '+ Lính</button>') + '</div>' +
      '<div class="gi-row"><span>Chiến thuật</span><b>' + TT.STANCES[q.st].name + ' · ' + TT.FORMATIONS[q.fm || 'khoi'].name + '</b></div><div class="gi-row"><span>Hành quân</span><b>' + (q.fl.length ? q.fl.length + ' cờ' : 'Tự do') + '</b></div>' +
      (R.marshal ? '' : '<div class="gi-sell"><button class="btn small" id="gi-sellsol" ' + (q.n > 1 ? '' : 'disabled') + '>' + I.svg('coin2', null, 12) + ' Bán lính</button><button class="btn small red" id="gi-sell">' + I.ui('crown', 12) + ' Bán tướng</button></div>') + '</div>';
    $('#gi-x').onclick = function () { S.sel = null; renderAll(); };
    el.classList.toggle('more', !!S.infoMore);
    $('#gi-more').onclick = function () { S.infoMore = !S.infoMore; renderInfo(); };
    var ad = $('#gi-add'); if (ad) ad.onclick = function () { addSoldier(q.id); };
    var gu = $('#gi-up'); if (gu) { gu.onclick = function () { S.solUp = S.solUp === q.id ? null : q.id; TT.Sound.play('click'); renderInfo(); }; tipFor(gu, '<b>Nâng cấp lính</b><div class="tt-d">Xem chỉ số lính và dùng Vàng nâng Máu, Tấn công, Giáp, Tốc đánh cho mọi lính của tướng này.</div>'); }
    var ss = $('#gi-sellsol'); if (ss) ss.onclick = function () { sellSoldiersPopup(q.id); };
    var gsl = $('#gi-sell'); if (gsl) gsl.onclick = function () { sellGeneralPopup(q.id); };
    $$('#g-info .gi-it[data-slot]').forEach(function (d) { var sl = +d.dataset.slot; d.onclick = function () { var rc = d.getBoundingClientRect(), k = q.it[sl], it = TT.ITEMS[k]; pinTip(itemTip(k) + '<div class="tt-act"><button class="btn small" data-act="unequip" data-v="' + q.id + ',' + sl + '">Tháo vào tủ</button><button class="btn small red" data-act="sellEq" data-v="' + q.id + ',' + sl + '">Bán +' + it.price + '</button></div>', rc.right + 6, rc.top); }; tipFor(d, function () { return itemTip(q.it[sl], 'Chạm để tháo hoặc bán'); }); });
    placeInfo();
    if (S.solUp != null && S.solUp !== q.id) S.solUp = null;
    renderSolUp();
  }
  /* ---------- bảng Nâng cấp lính (gọn): thông tin lính + 4 chỉ số nâng bằng Vàng ---------- */
  function renderSolUp() {
    var el = $('#solup-pop');
    if (!el) { el = document.createElement('div'); el.id = 'solup-pop'; el.className = 'hud win solup-pop hidden'; $('#screen-game').appendChild(el); }
    var p = S && S.P, q = p && S.solUp != null && canPrep() ? P.squadById(p, S.solUp) : null;
    if (!q || ROLES[q.t].unique || $('#g-info').classList.contains('hidden')) { if (S) S.solUp = null; el.classList.add('hidden'); return; }
    var R = ROLES[q.t], U = CFG.solUp, up = q.up || [0, 0, 0, 0], st = TT.Battle.previewStats(ctxOf(p), p, q, false), uc = TT.unitCost(p.race, q.t);
    var rows = U.stats.map(function (X, i) {
      var lv = up[i] | 0, max = lv >= U.max, price = max ? 0 : U.cost[lv], pips = '<b style="width:' + (lv / U.max * 100) + '%"></b><em>' + lv + '/' + U.max + '</em>';
      return '<div class="su-row"><span class="su-ic">' + I.ui(X.ic, 14) + '</span><span class="su-nm">' + X.name + '</span><span class="su-pips">' + pips + '</span><span class="su-v">' + (lv ? '+' + lv * X.pct + '%' : '—') + '</span>' +
        '<button class="su-m" data-k="' + i + '" ' + (lv ? '' : 'disabled') + ' title="Hạ 1 cấp, hoàn ' + (lv ? U.cost[lv - 1] : 0) + ' Vàng">−</button>' +
        (max ? '<button class="su-p max" disabled>Tối đa</button>' : '<button class="su-p pb-host' + (p.gold < price ? ' no' : '') + '" data-k="' + i + '">' + priceB(price, p.gold < price) + '+' + X.pct + '%</button>') + '</div>';
    }).join('');
    var maxBuy = Math.max(0, Math.min(Math.floor((P.capacity(p) - P.usedPop(p)) / R.pop), Math.floor(p.gold / uc)));
    el.innerHTML = '<div class="su-head" style="--fc:' + F[p.race].color + '"><span class="su-role">' + I.role(q.t, '#fff', 16) + '</span><div><b>Lính ' + esc(TT.unitName(p.race, q.t)) + '</b><small>' + (q.n - 1) + ' lính · ' + R.pop + ' dân/lính · ' + uc + ' Vàng/lính</small></div><button class="win-x" id="su-x" title="Đóng">' + I.ui('close', 12) + '</button></div>' +
      '<div class="su-stats" title="Chỉ số mỗi lính (đã tính nâng cấp, Lõi, trang bị hào quang)"><span>' + I.ui('heart', 11) + ' ' + st.hp + '</span><span>' + I.ui('swords', 11) + ' ' + st.atk + '</span><span>' + I.ui('shield', 11) + ' ' + st.def + '</span><span>' + I.ui('bolt', 11) + ' ' + st.as.toFixed(2) + '</span><span>Tầm ' + st.rng + '</span></div>' +
      '<div class="su-rows">' + rows + '</div>' +
      '<div class="su-foot"><small>Áp cho mọi lính của tướng này, cả lính mua sau. Bán tướng hoàn lại tiền.</small><button class="btn small teal pb-host" id="su-add1" ' + (maxBuy ? '' : 'disabled') + '>' + priceB(uc, p.gold < uc) + '+1 lính</button><button class="btn small ghost" id="su-add5" ' + (maxBuy >= 2 ? '' : 'disabled') + '>+5</button></div>';
    el.classList.remove('hidden');
    $('#su-x').onclick = function () { S.solUp = null; renderInfo(); };
    $$('#solup-pop .su-p[data-k]').forEach(function (b) {
      var X = U.stats[+b.dataset.k];
      b.onclick = function () { var r = doOp({ c: 'solUp', sq: q.id, k: +b.dataset.k, d: 1 }); if (r.ok) { TT.Sound.play('coin'); var gp = S.genPos[q.id]; if (gp && S.field) S.field.fxAt('buy', gp[0], gp[1], '#7ff0ff'); var nb = $('#solup-pop .su-row:nth-child(' + (+b.dataset.k + 1) + ')'); if (nb) { nb.classList.remove('pop-in'); void nb.offsetWidth; nb.classList.add('pop-in'); } } };
      tipFor(b, '<b>' + X.name + ' lính +' + X.pct + '%</b><div class="tt-d">Mỗi cấp +' + X.pct + '% ' + X.name.toLowerCase() + ' cho mọi lính của tướng này (tối đa ' + U.max + ' cấp). Không áp cho tướng.</div>');
    });
    $$('#solup-pop .su-m[data-k]').forEach(function (b) { b.onclick = function () { if (doOp({ c: 'solUp', sq: q.id, k: +b.dataset.k, d: -1 }).ok) TT.Sound.play('coin'); }; });
    $('#su-add1').onclick = function () { addSoldier(q.id, 1); };
    $('#su-add5').onclick = function () { addSoldier(q.id, 5); };
    placeSolUp();
  }
  function placeSolUp() {
    var el = $('#solup-pop'), gi = $('#g-info'); if (!el || el.classList.contains('hidden') || !gi) return;
    var r = gi.getBoundingClientRect(), bt = $('#gi-up'), br = bt ? bt.getBoundingClientRect() : r, w = el.offsetWidth, h = el.offsetHeight;
    if (innerWidth <= 760) { el.style.left = '6px'; el.style.right = '6px'; el.style.top = 'auto'; el.style.bottom = Math.max(8, innerHeight - r.top + 6) + 'px'; return; }
    var x = r.right + 8, y = Math.max(64, Math.min(br.top - 10, innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barh')) || 150) - h - 8));
    if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 8);
    el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.left = x + 'px'; el.style.top = y + 'px';
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
    if ((innerWidth <= 760 || innerHeight <= 520) && S.focusSel !== S.sel) {
      S.focusSel = S.sel;
      var top = el.getBoundingClientRect().top, want = Math.max(150, top * .55);
      if (pt.y > top - 80) S.field.panBy(0, -(pt.y - want));
    }
  }
  /* ---------- menu ngang nổi trên đầu tướng ---------- */
  function renderAct() {
    var el = $('#g-act'), p = S.P, q = p && S.sel != null && canPrep() && !S.flagMode && S.moveSq == null && !S.tac ? P.squadById(p, S.sel) : null;
    if (!q) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = '<button class="ga-b" data-a="move">' + I.ui('move', 18) + '</button>' +
      '<button class="ga-b" data-a="st">' + I.ui('swords', 18) + '</button>' +
      '<button class="ga-b" data-a="flag">' + I.ui('flag', 18) + '</button>' +
      (ROLES[q.t].unique ? '' : '<button class="ga-b teal" data-a="sol">' + priceB(TT.unitCost(p.race, q.t), p.gold < TT.unitCost(p.race, q.t)) + I.ui('plus', 18) + '</button>');
    $$('#g-act [data-a]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.a; unpinTip();
        if (a === 'move') { S.moveSq = q.id; }
        else if (a === 'st') { S.tac = { sq: q.id, tab: 'st' }; S.tacFocus = false; }
        else if (a === 'flag') { S.flagMode = { sq: q.id }; S.flagMenu = null; }
        else if (a === 'sol') { addSoldier(q.id); return; }
        renderAll();
      };
    });
    var cs = TT.unitCost(p.race, q.t);
    tipFor($('#g-act [data-a=move]'), '<b>Di chuyển</b><div class="tt-d">Đổi chỗ xuất phát của đạo quân.</div>', 350);
    tipFor($('#g-act [data-a=st]'), '<b>Chiến thuật</b><div class="tt-d">Cách đánh, đội hình, vị trí tướng.</div>', 350);
    tipFor($('#g-act [data-a=flag]'), '<b>Hành quân</b><div class="tt-d">Cắm cờ chỉ đường cho đạo quân.</div>', 350);
    if ($('#g-act [data-a=sol]')) tipFor($('#g-act [data-a=sol]'), '<b>Thêm lính</b><div class="tt-d">Giá ' + cs + ' vàng.</div>', 350);
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

  /* ---------- bảng Chiến thuật (đầu màn hình): Cách đánh · Đội hình · Vị trí tướng ---------- */
  var ST_IC = { tc: 'swords', giu: 'shield', san: 'target', rut: 'heart' };
  function shapeSvg(fm, n, lp, w, h, big) {
    var pts = TT.Battle.shape(fm, n, lp), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    var pad = big ? 14 : 5, sw = Math.max(1, x1 - x0), sh = Math.max(1, y1 - y0), sc = Math.min((w - pad * 2) / sw, (h - pad * 2) / sh);
    var r = Math.max(big ? 2.2 : 1.6, Math.min(big ? 5.5 : 3.2, 1000 * sc * .42));
    var ox = (w - sw * sc) / 2 - x0 * sc, oy = (h - sh * sc) / 2 - y0 * sc, d = '';
    pts.slice(1).forEach(function (p) { d += '<circle cx="' + (p[0] * sc + ox).toFixed(1) + '" cy="' + (p[1] * sc + oy).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="#3d84e0"/>'; });
    d += '<circle cx="' + (pts[0][0] * sc + ox).toFixed(1) + '" cy="' + (pts[0][1] * sc + oy).toFixed(1) + '" r="' + (r * 1.45).toFixed(1) + '" fill="#ffc83a" stroke="#a86a00" stroke-width="1.2"/>';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' + d + '</svg>';
  }
  /* ---------- giãn cách lính + bảng kéo thả vị trí ---------- */
  var POS_W = 220, POS_H = 150;
  function spaceSliderHtml(q) {
    var has = q.cu && q.cu.length, v = q.sp || 100;
    return '<div class="tc-space' + (has ? ' off' : '') + '"><span>' + I.ui('move', 11) + ' Khoảng cách lính</span><input type="range" id="tc-sp" min="' + CFG.spaceMin + '" max="' + CFG.spaceMax + '" step="5" value="' + v + '"' + (has ? ' disabled' : '') + '><b id="tc-sp-v">' + v + '%</b>' + (has ? '<small>Đang dùng vị trí tự kéo</small>' : '') + '</div>';
  }
  function bindSpace(q) {
    var inp = $('#tc-sp'); if (!inp) return; var old = q.sp || 100, lab = $('#tc-sp-v');
    inp.oninput = function () { q.sp = +inp.value; lab.textContent = inp.value + '%'; refreshField(); };
    inp.onchange = function () { var v = +inp.value; q.sp = old === 100 ? undefined : old; doOp({ c: 'formation', sq: q.id, sp: v }); TT.Sound.play('click'); };
    tipFor($('.tc-space'), '<b>Khoảng cách lính</b><div class="tt-d">Kéo để lính đứng thưa hoặc sát nhau hơn. 100% là mặc định.</div>');
  }
  function bindBoard(q) {
    var svg = $('#pos-board'); if (!svg) return;
    var nn = Math.min(q.n, CFG.cuMax + 1), fm = q.fm || 'khoi', lp = q.lp == null ? 4 : q.lp;
    var loc = TT.Battle.layout(q.t, q.n, fm, lp, q.sp, q.cu).slice(0, nn).map(function (a) { return [a[0] / 1000, a[1] / 1000]; }); // ô, tướng ở gốc
    var T = S.tac, key = q.id + ':' + fm + ':' + lp + ':' + (q.sp || 100) + ':' + (q.cu && q.cu.length ? 'c' : 'a') + ':' + q.n;
    if (!T.view || T.view.id !== q.id || T.view.nn !== q.n || (T.view.key !== key && !T.view.keep)) { // khung nhìn: ôm vừa các chấm
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; loc.forEach(function (a) { x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); });
      var pad = 1.6, ex = Math.max(3, x1 - x0 + pad * 2), ey = Math.max(3, y1 - y0 + pad * 2);
      T.view = { id: q.id, nn: q.n, key: key, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, sc: Math.min(POS_W / ex, POS_H / ey, 46) };
    }
    T.view.key = key; T.view.keep = false;
    var V = T.view, abs = loc.map(function (a) { return [a[0], a[1]]; }), G = abs[0], gen = abs[0];
    function px(x) { return POS_W / 2 + (x - V.cx) * V.sc; } function py(y) { return POS_H / 2 + (y - V.cy) * V.sc; }
    var rs = Math.max(2.6, Math.min(6, V.sc * .26)), rg = Math.max(6, Math.min(11, V.sc * .5));
    var grid = ''; var gx0 = Math.floor(V.cx - POS_W / 2 / V.sc), gx1 = Math.ceil(V.cx + POS_W / 2 / V.sc), gy0 = Math.floor(V.cy - POS_H / 2 / V.sc), gy1 = Math.ceil(V.cy + POS_H / 2 / V.sc);
    for (var gx = gx0; gx <= gx1; gx++) grid += '<line x1="' + px(gx).toFixed(1) + '" y1="0" x2="' + px(gx).toFixed(1) + '" y2="' + POS_H + '"/>';
    for (var gy = gy0; gy <= gy1; gy++) grid += '<line x1="0" y1="' + py(gy).toFixed(1) + '" x2="' + POS_W + '" y2="' + py(gy).toFixed(1) + '"/>';
    var dots = ''; for (var i = nn - 1; i >= 0; i--) dots += i ? '<circle class="pd s" data-i="' + i + '" cx="' + px(abs[i][0]).toFixed(1) + '" cy="' + py(abs[i][1]).toFixed(1) + '" r="' + rs.toFixed(1) + '"/>' : '<circle class="pd g" data-i="0" cx="' + px(abs[0][0]).toFixed(1) + '" cy="' + py(abs[0][1]).toFixed(1) + '" r="' + rg.toFixed(1) + '"/>';
    svg.innerHTML = '<g class="pg">' + grid + '</g>' + dots;
    var dragI = -1, snap = null, n0 = 0, moved = false;
    function toTile(ev) { var r = svg.getBoundingClientRect(); return [V.cx + ((ev.clientX - r.left) / r.width * POS_W - POS_W / 2) / V.sc, V.cy + ((ev.clientY - r.top) / r.height * POS_H - POS_H / 2) / V.sc]; }
    function cuOf() { return abs.slice(1).map(function (a) { return [Math.max(-CFG.cuRange, Math.min(CFG.cuRange, Math.round((a[0] - abs[0][0]) * 100))), Math.max(-CFG.cuRange, Math.min(CFG.cuRange, Math.round((a[1] - abs[0][1]) * 100)))]; }); }
    function paint(i) { var c = svg.querySelector('[data-i="' + i + '"]'); if (c) { c.setAttribute('cx', px(abs[i][0]).toFixed(1)); c.setAttribute('cy', py(abs[i][1]).toFixed(1)); } }
    svg.onpointerdown = function (ev) {
      var t = ev.target.closest && ev.target.closest('.pd'); if (!t || !canPrep()) return; ev.preventDefault();
      dragI = +t.dataset.i; snap = P.clone(S.P); n0 = S.cryLog.length; moved = false; svg.setPointerCapture(ev.pointerId); t.classList.add('drag'); hideTip();
    };
    svg.onpointermove = function (ev) {
      if (dragI < 0) return; var tp = toTile(ev), lim = CFG.cuRange / 100;
      if (dragI === 0) { abs[0] = [tp[0], tp[1]]; paint(0); }
      else { abs[dragI] = [Math.max(abs[0][0] - lim, Math.min(abs[0][0] + lim, tp[0])), Math.max(abs[0][1] - lim, Math.min(abs[0][1] + lim, tp[1]))]; paint(dragI); }
      var cu = cuOf(); q.cu = cu; moved = true; refreshField();
    };
    function endDrag(ev) {
      if (dragI < 0) return; var was = dragI; dragI = -1; svg.querySelectorAll('.drag').forEach(function (c) { c.classList.remove('drag'); });
      if (!moved) return;
      var cu = cuOf(); S.P = snap; // khôi phục rồi áp bằng lệnh để có hoàn tác + kiểm tra hợp lệ
      if (was === 0) { V.cx -= abs[0][0]; V.cy -= abs[0][1]; } // gốc toạ độ đổi theo tướng → giữ nguyên hình trên bảng
      V.keep = true;
      doOp({ c: 'formation', sq: q.id, cu: cu }); TT.Sound.play('click');
    }
    svg.onpointerup = endDrag; svg.onpointercancel = endDrag;
    var rs2 = $('#pos-reset'); if (rs2) rs2.onclick = function () { T.view = null; doOp({ c: 'formation', sq: q.id, cu: null }); TT.Sound.play('click'); };
    tipFor($('.lp-front'), '<b>Hướng địch</b><div class="tt-d">Phía trên bảng là hướng về địch; phía dưới là hậu phương.</div>');
  }
  function renderTac() {
    var el = $('#tac-pop'), q = S.tac && S.P && canPrep() ? P.squadById(S.P, S.tac.sq) : null;
    if (!q) { S.tac = null; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var p = S.P, tab = S.tac.tab, fm = q.fm || 'khoi', lp = q.lp == null ? 4 : q.lp, body = '', nn = Math.max(2, Math.min(q.n, 40));
    var tabs = [['st', 'swords', 'Cách đánh'], ['fm', 'crown', 'Đội hình'], ['lp', 'target', 'Vị trí tướng']];
    if (tab === 'st') {
      body = '<div class="tc-grid st">' + TT.STANCE_ORDER.map(function (k) { return '<button class="tc-b' + (q.st === k ? ' on' : '') + '" data-st="' + k + '">' + I.ui(ST_IC[k], 20) + '<span>' + TT.STANCES[k].name + '</span></button>'; }).join('') + '</div><div class="tc-desc">' + esc(TT.STANCES[q.st].desc) + ' Lính làm theo tướng.</div>';
    } else if (tab === 'fm') {
      body = '<div class="tc-grid fm">' + TT.FORM_ORDER.map(function (k) { return '<button class="tc-b' + (fm === k && !(q.cu && q.cu.length) ? ' on' : '') + '" data-fm="' + k + '">' + shapeSvg(k, 15, k === 'vong' ? 4 : lp, 54, 40) + '<span>' + TT.FORMATIONS[k].name + '</span></button>'; }).join('') + '</div><div class="tc-desc">' + (q.cu && q.cu.length ? 'Đang dùng <b>vị trí tự kéo</b>. Chọn một hình mẫu để xếp lại tự động.' : esc(TT.FORMATIONS[fm].desc)) + '</div>' + spaceSliderHtml(q);
    } else {
      body = '<div class="tc-lp"><div class="lp-wrap"><svg class="pos-board" id="pos-board" viewBox="0 0 ' + POS_W + ' ' + POS_H + '"></svg><i class="lp-front">Hướng địch ▲</i></div>' +
        '<div class="lp-side"><div class="tc-desc"><b>Kéo thả chấm</b> để tự xếp trận hình: <span class="dg">●</span> chấm vàng lớn là tướng, <span class="db">●</span> chấm xanh là lính. Lính và tướng ngoài sân di chuyển theo ngay.' + (q.n - 1 > CFG.cuMax ? ' Chỉ kéo được ' + CFG.cuMax + ' lính đầu, số còn lại tự xếp theo hình.' : '') + '</div>' +
        '<div class="lp-btns"><button class="btn small ghost" id="pos-reset"' + (q.cu && q.cu.length ? '' : ' disabled') + '>' + I.ui('undo', 11) + ' Về hình mẫu</button><span class="lp-fm">Hình mẫu: <b>' + TT.FORMATIONS[fm].name + '</b></span></div>' + spaceSliderHtml(q) + '</div></div>';
    }
    el.innerHTML = '<div class="tc-head" style="--fc:' + F[p.race].color + '">' + I.role(q.t, '#fff', 18) + '<b>' + esc(TT.unitName(p.race, q.t)) + '</b><div class="tc-tabs">' +
      tabs.map(function (t) { return '<button data-tt="' + t[0] + '" class="' + (tab === t[0] ? 'active' : '') + '">' + I.ui(t[1], 12) + '<span>' + t[2] + '</span></button>'; }).join('') + '</div><button class="x-circ tc-x" aria-label="Đóng" id="tc-x" title="Xong">' + I.ui('close', 12) + '</button></div><div class="tc-body">' + body + '</div>';
    $('#tc-x').onclick = function () { S.tac = null; renderAll(); };
    $$('#tac-pop [data-tt]').forEach(function (b) { b.onclick = function () { S.tac.tab = b.dataset.tt; renderTac(); }; });
    $$('#tac-pop [data-st]').forEach(function (b) { b.onclick = function () { doOp({ c: 'stance', sq: q.id, s: b.dataset.st }); TT.Sound.play('click'); }; tipFor(b, '<b>' + TT.STANCES[b.dataset.st].name + '</b><div class="tt-d">' + TT.STANCES[b.dataset.st].desc + ' Lính làm theo tướng.</div>'); });
    $$('#tac-pop [data-fm]').forEach(function (b) { b.onclick = function () { doOp({ c: 'formation', sq: q.id, fm: b.dataset.fm }); TT.Sound.play('click'); }; tipFor(b, '<b>' + TT.FORMATIONS[b.dataset.fm].name + '</b><div class="tt-d">' + TT.FORMATIONS[b.dataset.fm].desc + '</div>'); });
    bindSpace(q);
    if (tab === 'lp') bindBoard(q);
    if (!S.tacFocus && S.field && S.genPos[q.id]) { // đẩy tướng xuống dưới bảng để không bị che
      S.tacFocus = true; var pt = S.field.project(S.genPos[q.id][0], S.genPos[q.id][1], 1), bot = el.getBoundingClientRect().bottom;
      var rc0 = el.getBoundingClientRect();
      if (innerHeight <= 520 && innerWidth > innerHeight) { if (pt.x < rc0.right + 70) S.field.panBy(rc0.right + 120 - pt.x, 0); }
      else if (pt.y < bot + 90) S.field.panBy(0, bot + 130 - pt.y);
    }
  }

  /* ---------- bảng Hành quân (cắm cờ không giới hạn): đáy hoặc đầu màn hình, tránh che tướng ---------- */
  function renderFlagBar() {
    var el = $('#flag-bar'), fm = S.flagMode;
    if (!fm || !S.P || !canPrep()) { el.classList.add('hidden'); S.flagMenu = null; renderFlagMenu(); return; }
    var q = P.squadById(S.P, fm.sq); if (!q) { S.flagMode = null; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var gp = S.genPos[q.id], atTop = false;
    if (S.field && gp) { var pt = S.field.project(gp[0], gp[1], 1); atTop = pt.y > innerHeight * .5 && pt.x < innerWidth * .5; }
    S.flagTop = atTop; el.classList.toggle('at-top', atTop);
    var leg = [['D', 'Chạm đất', 'tiến công'], ['V', 'Chạm tướng mình', 'hộ tống'], ['T', 'Chạm địch', 'diệt mục tiêu']].map(function (l) { return '<span class="fb-lg" style="--c:' + FLAG_COL[l[0]] + '"><i></i>' + l[1] + ': <b>cờ ' + FLAG_NAME[l[0]] + '</b></span>'; }).join('');
    el.innerHTML = '<div class="fb-top">' + I.ui('flag', 13) + '<span class="fb-t">Cắm cờ · <b>' + esc(TT.unitName(S.P.race, q.t)) + '</b></span><span class="fb-cnt">' + q.fl.length + ' cờ</span><button class="x-circ" id="fb-done" title="Thoát chế độ cắm cờ" aria-label="Thoát">' + I.ui('close', 11) + '</button></div>' +
      '<div class="fb-legend">' + leg + '<span class="fb-lg" style="--c:' + FLAG_COL.X + '"><i></i>Chạm cờ: <b>sửa / xóa</b></span></div>' +
      '<div class="fb-act"><button class="btn small ghost" id="fb-undo" ' + (q.fl.length ? '' : 'disabled') + '>' + I.ui('undo', 11) + ' Bỏ cờ cuối</button><button class="btn small ghost" id="fb-clear" ' + (q.fl.length ? '' : 'disabled') + '>' + I.ui('trash', 11) + ' Xóa hết</button></div>';
    $$('.fb-lg', el).forEach(function (b, k) { var t = ['D', 'V', 'T', 'X'][k]; tipFor(b, '<b>' + TT.FLAGS[t].name + '</b><div class="tt-d">' + TT.FLAGS[t].desc + (t === 'D' ? ' Cờ xanh (đi thẳng không đánh) đổi được trong menu của cờ.' : '') + '</div>'); });
    $('#fb-undo').onclick = function () { S.flagMenu = null; doOp({ c: 'flags', sq: q.id, fl: q.fl.slice(0, -1) }); };
    $('#fb-clear').onclick = function () { S.flagMenu = null; doOp({ c: 'flags', sq: q.id, fl: [] }); };
    $('#fb-done').onclick = function () { S.flagMode = null; S.flagMenu = null; renderAll(); };
    renderFlagMenu();
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
      '<div class="btns" style="justify-content:center"><button class="btn gold big" id="over-room">' + I.ui('check', 16) + ' Xác nhận · Về phòng chờ</button><button class="btn ghost" id="over-lobby">Ra sảnh</button></div></div>';
    o.classList.remove('hidden');
    $('#over-lobby').onclick = function () { leave(); };
    $('#over-room').onclick = function () { backToRoom(); };
    TT.Sound.play(meWin ? 'win' : 'lose');
    if (S.seat && !S.recorded) {
      S.recorded = true;
      var sc = M.scores[S.seat], p = me();
      Net.recordResult(meWin, { mode: M.mode, faction: p ? p.race : '', days: M.day, pts: sc ? sc.pts : 0 });
    }
    if (S.host) Net.finish(S.code, win[0]);
    renderAll();
  }
  /* sau ván: xem kết quả → xác nhận → về lại phòng chờ của chính phòng này (không ra sảnh) */
  function backToRoom() {
    var code = S.code; try { localStorage.setItem('ttkc.lastRoom.' + Net.user.uid, code); } catch (e) { }
    Game.stop(); App.showRoom(code);
  }
  function leave() { Game.stop(); try { localStorage.removeItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { } App.cleanupRoom(); App.enterLobby(); }

  /* ================= menu ================= */
  function openMenu() {
    var o = $('#menu-overlay'), low = autoLow();
    o.innerHTML = '<div class="win menu-box"><div class="mn-head"><h2>Menu</h2><button class="x-circ" id="mn-close" title="Đóng" aria-label="Đóng">' + I.ui('close', 12) + '</button></div>' +
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
      '<li><b>Mua tướng</b> ở thanh dưới, đặt vào vùng xuất quân.</li>' +
      '<li><b>Chạm tướng</b> để thêm lính, đổi chiến thuật hoặc cắm cờ hành quân.</li>' +
      '<li>Dùng <b>Lõi</b> và <b>Trang bị</b> để mạnh hơn; giữ Vàng để có lãi.</li>' +
      '<li>Bấm <b>Sẵn sàng</b> và xem quân tự đánh. Sau 10 ngày, nhiều điểm nhất thắng.</li></ol>', [['Đã hiểu', 'gold', true]]);
  }

  /* ================= gắn sự kiện ================= */
  var bound = false;
  function bindUI() {
    if (bound) return; bound = true;
    $('#btn-menu').onclick = openMenu;
    $('#btn-go').onclick = function () { if (!S) return; if (S.committed) uncommit(); else commitMine(); };
    $('#btn-undo').onclick = function () { undo(); };
    $('#btn-auto').onclick = function () { doOp({ c: 'auto' }); };
    var spb = $('#btn-speed'); if (spb) spb.onclick = function () { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; if (S.field) S.field.setSpeed(S.speed); renderTop(); };
    $('#btn-skip').onclick = function () { if (S && S.field && S.field.B) S.field.skipBattle(); };
    $('#btn-chat').onclick = function () { var c = $('#g-chatbox'); c.classList.toggle('open'); document.body.classList.toggle('chat-open', c.classList.contains('open')); $('#btn-chat').classList.remove('ping'); };
    $('#chat-x').onclick = function () { $('#g-chatbox').classList.remove('open'); document.body.classList.remove('chat-open'); };
    $$('#log-tabs button').forEach(function (b) { b.onclick = function () { $$('#log-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); }); var chat = b.dataset.t === 'chat'; $('#g-log').classList.toggle('hidden', chat); $('#g-chat').classList.toggle('hidden', !chat); $('#g-chat-form').classList.toggle('hidden', !chat); }; });
    $('#g-chat-form').onsubmit = function (e) { e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v || !S) return; inp.value = ''; Net.sendRoomChat(S.code, v).catch(function () { App.toast('Chat chưa khả dụng', 'err'); }); };
  }
  document.addEventListener('keydown', function (e) {
    if (!S || App.screen !== 'game' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { clearModes(); S.sel = null; S.tac = null; unpinTip(); renderAll(); }
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
  Game._r = function () { if (S) renderAll(); }; Game._s = function () { return S; }; Game._op = function (c) { return doOp(c); };
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
