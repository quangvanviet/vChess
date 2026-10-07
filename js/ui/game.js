/* Trận đấu: tải bàn, tung xúc xắc, đồng bộ sổ lệnh Firebase, lượt cục bộ có hoàn tác, bot, hết giờ, giao diện HUD. */
(function (G) {
  'use strict';
  var TT = G.TT, E = TT.Engine, Net = TT.Net, I = TT.Icons, U = TT.UNITS, F = TT.FACTIONS, CFG = TT.CONFIG, C = TT.Content;
  var App = TT.App, $ = App.$, $$ = App.$$, esc = App.esc;
  var Game = TT.Game = {};
  var S = null; // trạng thái phiên trận

  function me() { return Net.user.uid; }
  function view() { return S.local ? S.draft : S.state; }
  function roomSeatOf(st, i) { return Net.seatOfSide(st.mode, st.players[i].seat); }

  /* ============ KHỞI ĐỘNG ============ */
  Game.start = function (code, room) {
    if (S && S.code === code) return;
    Game.stop();
    S = { code: code, room: room, seq: 1, queue: [], processing: false, local: false, draft: null, draftCmds: [], ui: { mode: 'idle' }, opts: {}, rw: 'V', log: [], ready: false, warnedHash: false, recorded: false, speed: 1 };
    try { S.rw = localStorage.getItem('ttkc.rw') || 'V'; } catch (e) { }
    App.show('loading');
    var base = 'rooms/' + code;
    Promise.all([Net.B.get(base + '/meta'), Net.B.get(base + '/seats'), Net.B.get(base + '/players')]).then(function (r) {
      var fresh = { meta: r[0], seats: r[1] || {}, players: r[2] || {} };
      S.setup = Net.buildSetup(fresh);
      S.state = E.init(S.setup);
      S.meta = fresh.meta;
      S.meIdx = S.state.players.findIndex(function (p) { return p.uid === me() && !p.bot; });
      S.isHost = fresh.meta.hostUid === me();
      renderLoading(fresh);
    }).catch(function (e) { App.toast('Không tải được trận: ' + (e.message || e), 'err', 6000); App.enterLobby(); });
  };
  Game.stop = function () {
    if (!S) return;
    (S.unsubs || []).forEach(function (f) { try { f(); } catch (e) { } });
    clearInterval(S.timerIv); S = null;
    $('#over-overlay').classList.add('hidden'); $('#dice-overlay').classList.add('hidden'); $('#menu-overlay').classList.add('hidden');
  };
  Game.onRoom = function (room) { if (!S) return; S.room = room; if (S.ready) { renderPlayers(); maybeStartLocal(); } };
  Game.onChat = function (m) {
    if (!S) return;
    App.appendChat($('#g-chat'), m);
    if (m.uid !== me() && $('#g-chat').classList.contains('hidden')) $('#log-tabs [data-t=chat]').textContent = 'Chat •';
  };

  function renderLoading(room) {
    var st = S.state;
    $('#loading-cards').innerHTML = st.players.map(function (p, i) {
      var f = F[p.faction], pas = f.passives.filter(function (x) { return x.id === p.passive; })[0];
      return '<div class="lcard" style="animation-delay:' + (i * 0.12) + 's;--seat-bg: radial-gradient(circle at 50% 30%, ' + TT.hexA(f.color, .6) + ', transparent 70%)">' + I.crest(p.faction, 170) +
        '<div class="lf">' + f.name + '</div><div class="ln">' + esc(p.name) + '</div><div class="lp">' + I.ui('diamond', 10) + ' ' + (pas ? pas.name : '') + ' · Ô nhà ' + TT.RES_NAME[p.home] + '</div><div class="lbar"><i></i></div></div>';
    }).join('');
    $('#loading-tip').textContent = '';
    var prog = 0, fill = $('#loading-fill'), bars = $$('#loading-cards .lbar i');
    // vẽ trước biểu tượng
    TT.FACTION_ORDER.forEach(function () { }); Object.keys(I.paths).forEach(function (k) { I.img(k, '#ffffff'); });
    setupBoardUI();
    // đăng ký sổ lệnh
    S.unsubs = [Net.watchCommands(S.code, function (entry) { if (!S) return; S.queue.push(entry); if (S.ready) pump(); }, function (err) { App.toast('Không đọc được sổ lệnh: ' + (err && err.message), 'err', 6000); })];
    var iv = setInterval(function () {
      prog += 4 + Math.random() * 7;
      bars.forEach(function (b, i) { b.style.width = Math.min(100, prog * (0.9 + i * 0.05)) + '%'; });
      fill.style.width = Math.min(100, prog) + '%';
      if (prog >= 100) {
        clearInterval(iv);
        setTimeout(function () {
          App.show('game');
          S.board.resize();
          // vào lại giữa trận: phát lại nhanh không cần xúc xắc
          if (S.queue.length) { S.ready = true; S.speed = 0; replayFast(); }
          else showDice().then(function () { S.ready = true; pump(); });
        }, 300);
      }
    }, 90);
  }

  function replayFast() {
    // áp dụng mọi lệnh đã có không hoạt ảnh
    var n = 0;
    while (S.queue.length) { var e = S.queue.shift(); if (e.seq === S.seq) { processEntrySync(e); n++; } }
    S.speed = 1; S.board.setState(S.state); refreshAll();
    if (n) App.toast('Đã phát lại ' + n + ' lượt — tiếp tục trận', 'ok');
    if (S.state.over) onGameOver(); else maybeStartLocal();
  }

  /* ============ XÚC XẮC ============ */
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function dieHtml(v) { var s = ''; for (var i = 0; i < 9; i++) s += '<i style="visibility:' + ((PIPS[v] || []).indexOf(i) >= 0 ? 'visible' : 'hidden') + '"></i>'; return s; }
  function showDice() {
    var st = S.state, ov = $('#dice-overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = '<div class="dice-box"><h2>Tung xúc xắc — ai đi trước?</h2><div class="dice-row">' + st.players.map(function (p, i) {
      return '<div class="dice-p" data-i="' + i + '"><div class="die rolling">' + dieHtml(1) + '</div><div class="nm" style="color:' + TT.SEAT_COLORS[p.seat] + '">' + esc(p.name) + '</div><div class="muted small">' + F[p.faction].name + '</div></div>';
    }).join('') + '</div><div class="dice-result"></div></div>';
    var rounds = st.dice, r = 0;
    return new Promise(function (done) {
      function doRound() {
        var rolls = rounds[r], start = Date.now();
        var dies = $$('.dice-p', ov);
        dies.forEach(function (d) { var i = +d.dataset.i; var p = st.players[i]; d.querySelector('.die').classList.toggle('rolling', rolls[p.seat] != null); d.style.opacity = rolls[p.seat] != null ? 1 : .3; });
        var iv = setInterval(function () {
          TT.Sound.play('dice');
          dies.forEach(function (d) { var p = st.players[+d.dataset.i]; if (rolls[p.seat] != null) d.querySelector('.die').innerHTML = dieHtml(1 + Math.floor(Math.random() * 6)); });
          if (Date.now() - start > 1300) {
            clearInterval(iv);
            var best = 0; Object.keys(rolls).forEach(function (k) { best = Math.max(best, rolls[k]); });
            dies.forEach(function (d) {
              var p = st.players[+d.dataset.i], v = rolls[p.seat], die = d.querySelector('.die');
              die.classList.remove('rolling'); if (v != null) { die.innerHTML = dieHtml(v); die.classList.toggle('win', v === best); }
            });
            r++;
            if (r < rounds.length) { $('.dice-result', ov).textContent = 'Hòa ' + best + ' điểm — tung lại!'; setTimeout(doRound, 1300); }
            else {
              var fp = st.players[st.active];
              $('.dice-result', ov).innerHTML = '<span style="color:' + TT.SEAT_COLORS[fp.seat] + '">' + esc(fp.name) + '</span> đi trước! Lượt đi theo chiều kim đồng hồ.';
              TT.Sound.play('turn');
              setTimeout(function () { ov.classList.add('hidden'); done(); }, 2100);
            }
          }
        }, 90);
      }
      if (!rounds.length) { ov.classList.add('hidden'); done(); return; }
      setTimeout(doRound, 500);
    });
  }

  /* ============ ĐỒNG BỘ SỔ LỆNH ============ */
  function pump() {
    if (!S || S.processing || !S.ready) return;
    S.queue.sort(function (a, b) { return a.seq - b.seq; });
    var e = S.queue[0];
    if (!e) { maybeStartLocal(); return; }
    if (e.seq < S.seq) { S.queue.shift(); return pump(); }
    if (e.seq > S.seq) return; // chờ mục còn thiếu
    S.queue.shift();
    S.processing = true;
    processEntry(e).then(function () { S && (S.processing = false); pump(); }, function (err) { console.error(err); S && (S.processing = false); pump(); });
  }
  function parseEntry(e, st) {
    var pk = st.active, owner = st.players[pk];
    var payload; try { payload = JSON.parse(e.payload); } catch (x) { payload = []; }
    if (!Array.isArray(payload)) payload = [];
    var legit = owner && e.uid === owner.uid;
    var isTimeout = payload.length === 1 && payload[0] && payload[0].c === 'timeout';
    if (!legit || isTimeout) payload = [{ c: 'timeout' }];
    return { pk: pk, cmds: payload };
  }
  function runPackage(st, pk, cmds, onStep) {
    for (var i = 0; i < cmds.length; i++) {
      if (st.over || st.active !== pk) break;
      var c = Object.assign({}, cmds[i], { p: pk });
      if (c.c === 'timeout') c.target = pk;
      var r = E.apply(st, c);
      if (r.ok) { if (onStep) onStep(st, r.state, r.events); st = r.state; }
    }
    if (!st.over && st.active === pk) { var r2 = E.apply(st, { c: 'end', p: pk }); if (r2.ok) { if (onStep) onStep(st, r2.state, r2.events); st = r2.state; } }
    return st;
  }
  function processEntrySync(e) {
    var pe = parseEntry(e, S.state);
    S.state = runPackage(S.state, pe.pk, pe.cmds, function (a, b, ev) { logEvents(ev, true); });
    checkHash(e); S.seq = e.seq + 1;
  }
  function checkHash(e) {
    var h = E.hash(S.state);
    if (e.stateHash && h !== e.stateHash && !S.warnedHash) { S.warnedHash = true; App.toast('Cảnh báo: trạng thái bàn cờ lệch với máy gửi (seq ' + e.seq + ')', 'err', 6000); console.warn('desync', e.seq, h, e.stateHash); }
  }
  function processEntry(e) {
    var mine = S.lastSent && S.lastSent.seq === e.seq && e.uid === me();
    var pe = parseEntry(e, S.state);
    if (mine) {
      S.state = runPackage(S.state, pe.pk, pe.cmds, function (a, b, ev) { });
      S.local = false; S.draft = null; S.sending = false; S.lastSent = null;
      checkHash(e); S.seq = e.seq + 1;
      S.board.setState(S.state); setUi({ mode: 'idle' }); refreshAll();
      if (S.state.over) onGameOver();
      return Promise.resolve();
    }
    // phát lại có hoạt ảnh từng lệnh
    var st = S.state, steps = [];
    runPackage(st, pe.pk, pe.cmds, function (a, b, ev) { steps.push([a, b, ev]); });
    var p = Promise.resolve();
    steps.forEach(function (s) {
      p = p.then(function () {
        if (!S) return;
        S.state = s[1];
        if (!S.local) { S.board.setState(s[1]); refreshAll(); }
        logEvents(s[2]);
        var fast = s[2].every(function (x) { return x.e === 'buy' || x.e === 'income' || x.e === 'turn' || x.e === 'endturn' || x.e === 'gain'; });
        return S.board.play(s[0], s[2], fast ? 3 : 1);
      });
    });
    return p.then(function () {
      if (!S) return;
      checkHash(e); S.seq = e.seq + 1;
      S.board.setState(S.state); refreshAll();
      if (S.state.over) onGameOver();
    });
  }

  function maybeStartLocal() {
    if (!S || !S.ready || S.processing || S.local || S.sending || S.queue.length) return;
    var st = S.state; if (st.over) return;
    var turn = S.room && S.room.turn;
    if (!turn || turn.nextSeq !== S.seq) return;
    var a = st.active, pl = st.players[a];
    if (a === S.meIdx) beginLocal();
    else if (pl.bot && S.isHost && !S.botBusy) runBot();
  }

  function beginLocal() {
    S.local = true; S.turnBase = S.state; S.draft = S.state; S.draftCmds = [];
    setUi({ mode: 'idle' });
    var pl = S.draft.players[S.meIdx];
    var hasWorkers = E.teamIds(S.draft).some(function (id) { var t = S.draft.teams[id]; return t.o === S.meIdx && t.t === 'worker'; });
    if (!(pl.faction === 'human' && hasWorkers)) doCmd({ c: 'harvest' }, { quiet: true });
    TT.Sound.play('turn');
    App.toast('Đến lượt bạn!', 'ok', 1800);
    if (S.wantResign) { S.wantResign = false; doCmd({ c: 'resign' }); return; }
    refreshAll();
  }

  function botLevel(i) { var seat = roomSeatOf(S.state, i); return (Net.botLevels(S.code)[seat]) || (S.remoteBotLv || {})[seat] || 'medium'; }
  Game.onBotLv = function (m) { if (S) { S.remoteBotLv = m; renderPlayers(); } };
  function runBot() {
    S.botBusy = true;
    var seqAt = S.seq;
    setTimeout(function () {
      if (!S || S.seq !== seqAt || S.state.over) { if (S) S.botBusy = false; return; }
      var st = S.state, a = st.active;
      var cmds = TT.Bot.planTurn(st, a, botLevel(a));
      var fin = runPackage(st, a, cmds);
      var entry = { seq: S.seq, uid: me(), turnNo: Math.max(1, st.turnNo), payload: JSON.stringify(E.compact(cmds)), stateHash: E.hash(fin), ts: Net.B.TS };
      Net.pushTurn(S.code, entry, { seat: roomSeatOf(fin, fin.active), startedAt: Net.B.TS, nextSeq: S.seq + 1 })
        .catch(function (e) { console.warn('bot push', e); })
        .then(function () { if (S) S.botBusy = false; });
    }, 700);
  }

  /* ============ LƯỢT CỤC BỘ ============ */
  function doCmd(cmd, o) {
    o = o || {};
    if (!S.local || S.sending) return false;
    var full = Object.assign({}, cmd, { p: S.meIdx });
    var r = E.apply(S.draft, full);
    if (!r.ok) { if (!o.silentErr) App.toast(r.err, 'err'); return false; }
    var prev = S.draft;
    S.draft = r.state; S.draftCmds.push(cmd);
    S.board.setState(S.draft);
    logEvents(r.events);
    if (!o.quiet) S.board.play(prev, r.events);
    if (r.events.some(function (x) { return x.e === 'income'; })) popRes();
    refreshAll();
    if (S.draft.over || S.draft.active !== S.meIdx) sendTurn();
    return true;
  }
  function undo() {
    if (!S.local || S.sending || !S.draftCmds.length) return;
    var keep = S.draftCmds.slice(0, -1);
    if (S.draftCmds[S.draftCmds.length - 1].c === 'harvest') return App.toast('Không hoàn tác thu hoạch', '');
    var st = S.turnBase;
    for (var i = 0; i < keep.length; i++) { var r = E.apply(st, Object.assign({}, keep[i], { p: S.meIdx })); if (r.ok) st = r.state; }
    S.draft = st; S.draftCmds = keep;
    S.board.setState(st); setUi({ mode: 'idle' }); refreshAll();
    addLog('Hoàn tác thao tác', 'sys');
  }
  function sendTurn() {
    if (!S.local || S.sending) return;
    var fin = S.draft, cmds = S.draftCmds.slice();
    if (!fin.over && fin.active === S.meIdx) {
      var r = E.apply(fin, { c: 'end', p: S.meIdx }); if (r.ok) { fin = r.state; cmds.push({ c: 'end' }); logEvents(r.events); }
    }
    var payload = JSON.stringify(E.compact(cmds));
    if (payload.length > 6000) { App.toast('Gói lượt quá lớn (' + payload.length + ' ký tự) — hãy hoàn tác bớt thao tác', 'err', 6000); return; }
    S.sending = true; S.lastSent = { seq: S.seq };
    S.draft = fin; S.board.setState(fin); setUi({ mode: 'idle' }); refreshAll();
    var entry = { seq: S.seq, uid: me(), turnNo: Math.max(1, S.state.turnNo), payload: payload, stateHash: E.hash(fin), ts: Net.B.TS };
    Net.pushTurn(S.code, entry, { seat: roomSeatOf(fin, fin.active), startedAt: Net.B.TS, nextSeq: S.seq + 1 }).catch(function (err) {
      App.toast('Gửi lượt thất bại: ' + (err.message || err) + ' — có thể đã hết giờ.', 'err', 6000);
      S.sending = false; S.local = false; S.lastSent = null; S.draft = null;
      S.board.setState(S.state); refreshAll(); pump();
    });
  }

  /* ============ HẾT GIỜ ============ */
  function tick() {
    if (!S || !S.ready) return;
    var turn = S.room && S.room.turn, meta = S.meta, st = S.state, el = $('#turn-timer');
    if (!turn || !meta || st.over) { el.querySelector('span').textContent = st.over ? 'Kết thúc' : '—'; return; }
    var limit = meta.turnLimitMs, start = typeof turn.startedAt === 'number' ? turn.startedAt : Net.B.now();
    var left = start + limit - Net.B.now();
    var pct = Math.max(0, Math.min(100, 100 * left / limit));
    el.querySelector('.fill').style.width = pct + '%';
    el.classList.toggle('low', left < Math.min(20000, limit * 0.2));
    var sec = Math.max(0, Math.ceil(left / 1000));
    el.querySelector('span').textContent = sec >= 3600 ? Math.floor(sec / 3600) + 'g ' + Math.floor(sec % 3600 / 60) + 'p' : sec >= 60 ? Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) : sec + 's';
    if (turn.nextSeq !== S.seq) return;
    if (S.local && left <= 0 && !S.sending) { App.toast('Hết giờ — tự kết thúc lượt', 'err'); sendTurn(); return; }
    if (!S.local && !S.sending && left < -4000 && !S.processing) {
      // người chơi còn kết nối có thứ tự thấp nhất ghi lệnh bỏ lượt trước
      var mine = S.state.players.findIndex(function (p) { return p.uid === me(); });
      var delay = (Math.max(0, mine)) * 3000;
      if (left < -4000 - delay && !S.timeoutTried) {
        S.timeoutTried = S.seq;
        var fin = runPackage(st, st.active, [{ c: 'timeout' }]);
        var entry = { seq: S.seq, uid: me(), turnNo: Math.max(1, st.turnNo), payload: JSON.stringify([{ c: 'timeout' }]), stateHash: E.hash(fin), ts: Net.B.TS };
        Net.pushTurn(S.code, entry, { seat: roomSeatOf(fin, fin.active), startedAt: Net.B.TS, nextSeq: S.seq + 1 }).catch(function () { });
      }
    }
    if (S.timeoutTried && S.timeoutTried !== S.seq) S.timeoutTried = false;
  }

  /* ============ KẾT THÚC ============ */
  function onGameOver() {
    var st = S.state;
    if (S.overShown) return; S.overShown = true;
    var w = st.winner || [];
    Net.finish(S.code, w.length ? roomSeatOf(st, w[0]) : roomSeatOf(st, 0));
    var won = S.meIdx >= 0 ? (st.draw ? null : w.indexOf(S.meIdx) >= 0) : null;
    if (S.meIdx >= 0) {
      var key = 'ttkc.recorded.' + S.code + '.' + me(), done = false;
      try { done = !!localStorage.getItem(key); localStorage.setItem(key, '1'); } catch (e) { }
      if (!done) Net.recordResult(won, { at: Date.now(), mode: st.mode, faction: st.players[S.meIdx].faction, won: won === true, draw: !!st.draw, rounds: st.round, code: S.code });
      try { localStorage.removeItem('ttkc.lastRoom.' + me()); } catch (e) { }
    }
    TT.Sound.play(won === false ? 'lose' : 'win');
    setTimeout(function () { showOver(won); }, 900);
  }
  function showOver(won) {
    var st = S.state, ov = $('#over-overlay');
    var title = won === true ? 'CHIẾN THẮNG' : won === false ? 'THẤT BẠI' : st.draw ? 'HÒA' : 'KẾT THÚC';
    ov.innerHTML = '<div class="panel over-box"><p class="over-title' + (won === false ? ' lose' : '') + '">' + title + '</p><p class="muted">' + (st.winner && st.winner.length ? 'Người thắng: <b style="color:#2a5fae">' + st.winner.map(function (i) { return esc(st.players[i].name); }).join(' & ') + '</b>' : 'Không có người thắng') + ' · ' + st.round + ' vòng</p>' +
      '<table class="over-table"><tr><th></th><th>Người chơi</th><th>Tộc</th><th>Đời</th><th>Hạ gục</th><th>Mất</th><th>Điểm</th></tr>' + st.players.map(function (p, i) {
        return '<tr><td>' + ((st.winner || []).indexOf(i) >= 0 ? I.ui('trophy', 18, '#e0a000') : p.alive ? '' : I.ui('skull', 16, '#8a9ab0')) + '</td><td style="color:' + TT.SEAT_COLORS[p.seat] + '">' + esc(p.name) + '</td><td>' + F[p.faction].short + '</td><td>' + TT.AGE_ROMAN[p.age] + '</td><td>' + p.kills + '</td><td>' + p.lost + '</td><td>' + E.score(st, i) + '</td></tr>';
      }).join('') + '</table><div style="display:flex;gap:10px;justify-content:center"><button class="btn ghost" id="ov-view">Xem bàn cờ</button><button class="btn gold big" id="ov-lobby">Về sảnh</button></div></div>';
    ov.classList.remove('hidden');
    $('#ov-view').onclick = function () { ov.classList.add('hidden'); };
    $('#ov-lobby').onclick = function () { Game.stop(); App.cleanupRoom(); App.enterLobby(); };
  }

  /* ============ GIAO DIỆN BÀN CỜ ============ */
  /* chọn bàn 3D (WebGL) hoặc 2D; đổi kiểu cần canvas mới */
  Game.gfx = function () { var v; try { v = localStorage.getItem('ttkc.gfx'); } catch (e) { } return v === '2d' || !TT.webglOK || !TT.Board3D ? '2d' : '3d'; };
  Game.makeBoard = function () {
    var want = Game.gfx();
    if (Game.board && Game.board._gfx === want) return Game.board;
    if (Game.board && Game.board.destroy) Game.board.destroy();
    var old = $('#board'), cv = document.createElement('canvas'); cv.id = 'board';
    old.parentNode.replaceChild(cv, old);
    var b;
    try { b = want === '3d' ? new TT.Board3D(cv, $('#board-wrap')) : new TT.Board(cv, $('#board-wrap')); }
    catch (e) { console.warn('3D lỗi, dùng 2D', e); try { localStorage.setItem('ttkc.gfx', '2d'); } catch (x) { } return Game.makeBoard(); }
    b._gfx = want; Game.board = b;
    return b;
  };
  function setupBoardUI() {
    S.board = Game.makeBoard();
    S.board.setState(S.state);
    S.board.anims = [];
    S.board.setView(S.meIdx >= 0 ? S.state.players[S.meIdx].seat : S.state.players[0].seat);
    S.board.onClick = onCellClick;
    S.board.onRight = function () { setUi({ mode: 'idle' }); };
    S.board.onHover = onHover; S.board.onHoverMove = onHover;
    S.board.onDragStart = onPieceDragStart; S.board.onDragMove = onPieceDragMove; S.board.onDragEnd = onPieceDragEnd;
    $('#g-log').innerHTML = ''; $('#g-chat').innerHTML = '';
    // dock kỹ năng / cửa hàng
    $$('#g-dock .dock-tabs [data-d]').forEach(function (b) { b.onclick = function () { setDock(b.dataset.d, true); }; });
    $('#dock-hide').onclick = function () { var c = !$('#g-dock').classList.contains('collapsed'); $('#g-dock').classList.toggle('collapsed', c); $('#dock-hide').innerHTML = I.ui(c ? 'up' : 'down', 12); try { localStorage.setItem('ttkc.dockC', c ? '1' : '0'); } catch (e) { } };
    $('#chat-toggle').onclick = function () { var c = !$('#g-chatbox').classList.contains('collapsed'); if (!c && isPhone()) collapseDock(true); $('#g-chatbox').classList.toggle('collapsed', c); $('#chat-toggle').innerHTML = I.ui(c ? 'up' : 'down', 12); try { localStorage.setItem('ttkc.chatC', c ? '1' : '0'); } catch (e) { } };
    var small = G.innerWidth < 900, lsC = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    if ((lsC('ttkc.chatC') || (small ? '1' : '0')) === '1') { $('#g-chatbox').classList.add('collapsed'); $('#chat-toggle').innerHTML = I.ui('up', 12); }
    if (lsC('ttkc.dockC') === '1' || G.innerWidth <= 760) collapseDock(true);
    setDock(lsC('ttkc.dock') || 'skill', false);
    $('#btn-end').onclick = function () { if (S.local) sendTurn(); };
    $('#btn-undo').onclick = undo;
    $('#btn-menu').onclick = openMenu;
    $$('#log-tabs button').forEach(function (b) {
      b.onclick = function () {
        $$('#log-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
        var chat = b.dataset.t === 'chat';
        $('#g-log').classList.toggle('hidden', chat); $('#g-chat').classList.toggle('hidden', !chat); $('#g-chat-form').classList.toggle('hidden', !chat);
        if (chat) b.textContent = 'Chat';
        if ($('#g-chatbox').classList.contains('collapsed')) $('#chat-toggle').click();
      };
    });
    $('#g-chat-form').onsubmit = function (e) { e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v) return; inp.value = ''; Net.sendRoomChat(S.code, v).catch(function () { App.toast('Chat chưa khả dụng', 'err'); }); };
    $('#reward-pref').innerHTML = '<span>Thưởng</span>' + ['V', 'T', 'G'].map(function (r) { return '<button data-r="' + r + '" class="c' + r + (S.rw === r ? ' active' : '') + '" title="Nhận thưởng kết liễu bằng ' + TT.RES_NAME[r] + '">' + r + '</button>'; }).join('');
    $$('#reward-pref button').forEach(function (b) { b.onclick = function () { S.rw = b.dataset.r; try { localStorage.setItem('ttkc.rw', S.rw); } catch (e) { } $$('#reward-pref button').forEach(function (x) { x.classList.toggle('active', x === b); }); }; });
    clearInterval(S.timerIv); S.timerIv = setInterval(tick, 500);
    refreshAll();
  }

  document.addEventListener('keydown', function (e) {
    if (!S || App.screen !== 'game' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    var k = e.key.toLowerCase();
    if (k === 'escape') setUi({ mode: 'idle' });
    else if (k === 'enter' && S.local) { e.preventDefault(); sendTurn(); }
    else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    else if (k === 'q' || k === 'w' || k === 'e') { var pl = view().players[S.meIdx]; if (pl) { var a = F[pl.faction].actives.filter(function (x) { return x.key.toLowerCase() === k; })[0]; if (a) startSkill(a.id); } }
    else if (k === ' ' && S.local && S.draft.pending.length) { e.preventDefault(); doCmd({ c: 'skip' }); }
    else if (/^arrow/.test(k) && S.board && S.board.panBy) { e.preventDefault(); var d = 60; S.board.panBy(k === 'arrowleft' ? d : k === 'arrowright' ? -d : 0, k === 'arrowup' ? d : k === 'arrowdown' ? -d : 0); }
    else if (k === 'h' && S.board && S.board.resetCam) S.board.resetCam();
  });

  function setUi(u) {
    if (!S) return;
    S.ui = u; S.armed = null;
    if (isPhone() && (u.mode === 'selected' || u.mode === 'skill' || u.mode === 'dieubinh')) { collapseDock(true); collapseChat(true); }
    if (u.mode !== 'selected') S.opts = {};
    updateHighlights(); renderUnit(); renderShop(); renderSkills(); renderPrompt(); queueLayout();
  }
  function canAct(st, t) {
    if (!S.local || !t || t.o !== S.meIdx) return false;
    if (E.actionsLeft(st) <= 0 || t.n - t.na <= 0 || st.pending.length) return false;
    if (E.isResting(st, t) && !(st.players[S.meIdx].passive === 'tienphong' && t.t !== 'king')) return false;
    return true;
  }
  function targetsFrom(st, id, x, y, moved, k) {
    if (E.inPeace(st)) return [];
    var t = st.teams[id]; if (!t) return [];
    if (E.isResting(st, t)) return [];
    if (moved && t.st.curse) return [];
    var tmp = E.clone(st); tmp.teams[id].x = x; tmp.teams[id].y = y;
    return E.attackTargets(tmp, id, x, y, moved);
  }
  function selK(st) { var t = st.teams[S.ui.id]; if (!t) return 0; var av = t.n - t.na; return Math.max(1, Math.min(av, S.ui.k || av)); }

  function updateHighlights() {
    var st = view(), u = S.ui, h = {};
    if (!st) return;
    if (S.local && st.pending.length) {
      var pd = st.pending[0], t = st.teams[pd.team];
      if (t) {
        h.select = t.id;
        if (pd.k === 'atk') h.attacks = E.attackTargets(st, t.id, t.x, t.y, false);
        else h.moves = E.moveTargets(st, t.id, t.n, { range: pd.range, dirs: 'orth', noMerge: true });
      }
    } else if (u.mode === 'selected') {
      var tm = st.teams[u.id];
      if (tm) {
        h.select = tm.id;
        if (canAct(st, tm)) {
          var k = selK(st);
          h.moves = E.moveTargets(st, tm.id, k);
          if (u.ghost) { h.ghost = { id: tm.id, x: u.ghost.x, y: u.ghost.y, k: k }; h.attacks = targetsFrom(st, tm.id, u.ghost.x, u.ghost.y, true, k); h.moves = h.moves.filter(function (m) { return !(m.x === u.ghost.x && m.y === u.ghost.y); }); }
          else h.attacks = targetsFrom(st, tm.id, tm.x, tm.y, false, k);
        }
      }
    } else if (u.mode === 'place') {
      h.spawn = E.spawnCells(st, S.meIdx).filter(function (c) { return E.apply(st, { c: 'buy', p: S.meIdx, u: u.u, job: u.job, cell: c }).ok; });
    } else if (u.mode === 'spawn') {
      h.spawn = E.spawnCells(st, S.meIdx).filter(function (c) { return E.exists(st, c[0], c[1]) && !E.teamAt(st, c[0], c[1]); });
    } else if (u.mode === 'skill' || u.mode === 'dieubinh') {
      h.cells = u.cells || [];
      if (u.first != null) h.select = u.first;
    }
    S.board.setHL(h);
    S.hl = h;
  }

  function onCellClick(x, y) {
    if (!S) return;
    var st = view(), t = E.teamAt(st, x, y), u = S.ui, h = S.hl || {};
    function inList(list) { return (list || []).some(function (c) { return (c.x != null ? c.x : c[0]) === x && (c.y != null ? c.y : c[1]) === y; }); }
    if (S.local && st.pending.length) {
      var pd = st.pending[0];
      if (pd.k === 'atk' && inList(h.attacks) && isTouch && S.armed !== x + ',' + y) { S.armed = x + ',' + y; var r1 = S.board.cellRect(x, y); onHover([x, y], { clientX: r1.x, clientY: r1.y }); return; }
      if (pd.k === 'atk' && inList(h.attacks)) doCmd({ c: 'follow', tgt: [x, y], opt: { rw: S.rw } });
      else if (pd.k === 'mv' && inList(h.moves)) doCmd({ c: 'follow', to: [x, y] });
      else App.toast('Chọn ô sáng hoặc bấm "Bỏ qua"', '');
      setUi({ mode: 'idle' });
      return;
    }
    if (u.mode === 'place') { if (inList(h.spawn)) doCmd({ c: 'buy', u: u.u, job: u.job, cell: [x, y] }); else setUi({ mode: 'idle' }); updateHighlights(); return; }
    if (u.mode === 'spawn') { if (inList(h.spawn)) doCmd({ c: u.kind, cell: [x, y] }); setUi({ mode: 'idle' }); return; }
    if (u.mode === 'skill') { return skillClick(x, y, t); }
    if (u.mode === 'dieubinh') { return dieuBinhClick(x, y, t); }
    if (u.mode === 'selected') {
      var tm = st.teams[u.id];
      if (tm && canAct(st, tm)) {
        var k = selK(st), opt = Object.assign({ rw: S.rw }, S.opts);
        if (u.ghost && u.ghost.x === x && u.ghost.y === y) { doCmd({ c: 'act', id: tm.id, k: k, to: [x, y], opt: opt }); setUi({ mode: 'idle' }); return; }
        if (inList(h.attacks)) {
          if (isTouch && S.armed !== x + ',' + y) { S.armed = x + ',' + y; var r0 = S.board.cellRect(x, y); onHover([x, y], { clientX: r0.x, clientY: r0.y }); App.toast('Chạm lần nữa để đánh', '', 1400); return; }
          doCmd({ c: 'act', id: tm.id, k: k, to: u.ghost ? [u.ghost.x, u.ghost.y] : null, tgt: [x, y], opt: opt });
          setUi({ mode: 'idle' }); return;
        }
        var mv = (h.moves || []).filter(function (m) { return m.x === x && m.y === y; })[0];
        if (mv) {
          if (mv.merge) { doCmd({ c: 'act', id: tm.id, k: k, to: [x, y], opt: opt }); setUi({ mode: 'idle' }); return; }
          var ats = targetsFrom(st, tm.id, x, y, true, k);
          if (!ats.length) { doCmd({ c: 'act', id: tm.id, k: k, to: [x, y], opt: opt }); setUi({ mode: 'idle' }); return; }
          S.ui.ghost = { x: x, y: y, steps: mv.steps }; updateHighlights(); renderPrompt(); renderUnit(); return;
        }
      }
    }
    if (t) { var k0 = u.mode === 'selected' && u.id === t.id ? null : 0; if (k0 === null) { setUi({ mode: 'idle' }); return; } setUi({ mode: 'selected', id: t.id }); }
    else setUi({ mode: 'idle' });
  }

  function onHover(c, ev) {
    var tip = $('#board-tip');
    if (!c || !S) { tip.style.display = 'none'; return; }
    var st = view(), t = E.teamAt(st, c[0], c[1]), lines = [];
    var tile = st.tiles[c[1] * st.W + c[0]];
    lines.push('<span class="muted">' + E.cellName(st, c[0], c[1]) + (tile ? ' · ô ' + TT.RES_NAME[tile] : '') + '</span>');
    if (t) {
      var p = st.players[t.o];
      lines.push('<b>' + U[t.t].name + (t.t === 'worker' ? ' (' + TT.JOB[t.job] + ')' : '') + '</b> ×' + (t.t === 'beast' ? 1 : t.n) + ' — <span style="color:' + TT.SEAT_COLORS[p.seat] + '">' + esc(p.name) + '</span>');
      lines.push('HP ' + E.teamHP(t) + (E.isResting(st, t) ? ' · <i>đang nghỉ</i>' : '') + (t.na && st.active === t.o ? ' · đã đi ' + t.na + '/' + t.n : ''));
      var stn = statusNames(t); if (stn) lines.push(stn);
    }
    // xem trước sát thương
    var h = S.hl || {}, u = S.ui;
    if (t && (h.attacks || []).some(function (a) { return a.x === c[0] && a.y === c[1]; })) {
      var src, fx, fy, moved = false, steps = 0, k;
      if (st.pending.length) { src = st.teams[st.pending[0].team]; fx = src.x; fy = src.y; k = src.n; }
      else { src = st.teams[u.id]; k = selK(st); if (u.ghost) { fx = u.ghost.x; fy = u.ghost.y; moved = true; steps = u.ghost.steps; } else { fx = src.x; fy = src.y; } }
      var pv = src && E.previewAttack(st, src.id, k, fx, fy, moved, steps, c[0], c[1]);
      if (pv) {
        lines.push('<hr style="border-color:#333;margin:4px 0"><b style="color:#e0414e">' + I.ui('swords', 13) + ' ' + pv.dmg + ' sát thương</b> <span class="muted">(' + pv.parts.join(', ') + ')</span>');
        if (t.t === 'king' && pv.kill) lines.push('<b style="color:#c97a00">' + I.ui('skull', 13) + ' Hạ Vua! +3 tài nguyên — đối thủ bị loại</b>');
        else if (pv.kill) lines.push('<b style="color:#c97a00">Diệt cả đội · thưởng +' + pv.reward + (t.t === 'worker' ? t.job : S.rw) + '</b>');
        else lines.push('Còn lại ' + (pv.hp - pv.dmg) + ' HP');
      }
    }
    tip.innerHTML = lines.join('<br>'); tip.style.display = 'block';
    var wr = $('#board-wrap').getBoundingClientRect(), cr = S.board.cellRect(c[0], c[1]);
    var left = cr.x - wr.left + cr.w + 8, top = cr.y - wr.top;
    if (left + 260 > wr.width) left = cr.x - wr.left - 268;
    tip.style.left = Math.max(4, left) + 'px'; tip.style.top = Math.max(4, Math.min(top, wr.height - 120)) + 'px';
  }
  function statusNames(t) {
    var n = { pct50: 'Long Lực', plus: 'Tài Trợ', longuy: 'Long Uy', haphon: 'Hấp Hồn', linhnhan: 'Linh Nhãn', enraged: 'Long Nộ', shield: 'Thiên Mạc', curse: 'Lời Nguyền', weak: 'Nguyền Yếu', hong: 'Long Hống' };
    var a = Object.keys(t.st || {}).filter(function (k) { return n[k]; }).map(function (k) { return n[k]; });
    return a.length ? '<span style="color:#7a3cd6">' + I.ui('star', 11) + ' ' + a.join(', ') + '</span>' : '';
  }

  /* ---------- kỹ năng ---------- */
  function teamsWhere(st, fn) { return E.teamIds(st).map(function (id) { return st.teams[id]; }).filter(fn); }
  function startSkill(aid) {
    if (!S.local) return;
    var st = S.draft, p = S.meIdx, pl = st.players[p], a = E.findActive(pl.faction, aid);
    if (!a) return;
    if (!E.skillReady(st, p, aid)) return App.toast(a.name + ' đang hồi chiêu', 'err');
    if (a.hostile && E.inPeace(st)) return App.toast('Đang miễn chiến', 'err');
    if (S.ui.mode === 'skill' && S.ui.a === aid) return setUi({ mode: 'idle' });
    if (a.target === 'none') { doCmd({ c: 'skill', a: aid }); return; }
    var cells;
    if (a.target === 'swap' || a.target === 'sacrifice') {
      cells = teamsWhere(st, function (t) { return t.o === p && t.t !== 'king' && (a.target === 'swap' || t.t !== 'beast'); });
    } else {
      cells = teamsWhere(st, function (t) { return E.apply(st, { c: 'skill', p: p, a: aid, id: t.id }).ok; });
    }
    if (!cells.length) return App.toast('Không có mục tiêu hợp lệ cho ' + a.name, 'err');
    setUi({ mode: 'skill', a: aid, step: 1, cells: cells.map(function (t) { return [t.x, t.y]; }) });
  }
  function skillClick(x, y, t) {
    var u = S.ui, st = S.draft, p = S.meIdx;
    var ok = (u.cells || []).some(function (c) { return c[0] === x && c[1] === y; });
    if (!ok || !t) { setUi({ mode: 'idle' }); return; }
    if (u.a === 'hoanvi' && u.step === 1) {
      var cells = teamsWhere(st, function (o) { return E.apply(st, { c: 'skill', p: p, a: 'hoanvi', id: t.id, id2: o.id }).ok; });
      if (!cells.length) { App.toast('Không có đội nào trong 3 ô để đổi chỗ', 'err'); return setUi({ mode: 'idle' }); }
      return setUi({ mode: 'skill', a: 'hoanvi', step: 2, first: t.id, cells: cells.map(function (o) { return [o.x, o.y]; }) });
    }
    if (u.a === 'hoanvi') { doCmd({ c: 'skill', a: 'hoanvi', id: u.first, id2: t.id }); return setUi({ mode: 'idle' }); }
    if (u.a === 'huyette' && u.step === 1) {
      var tg = teamsWhere(st, function (o) { return E.apply(st, { c: 'skill', p: p, a: 'huyette', id: t.id, tgt: [o.x, o.y] }).ok; });
      if (!tg.length) { App.toast('Không có địch trong phạm vi 2 của quân này', 'err'); return setUi({ mode: 'idle' }); }
      return setUi({ mode: 'skill', a: 'huyette', step: 2, first: t.id, cells: tg.map(function (o) { return [o.x, o.y]; }) });
    }
    if (u.a === 'huyette') { doCmd({ c: 'skill', a: 'huyette', id: u.first, tgt: [x, y], rw: S.rw }); return setUi({ mode: 'idle' }); }
    doCmd({ c: 'skill', a: u.a, id: t.id });
    setUi({ mode: 'idle' });
  }
  function startDieuBinh(cmdId) {
    var st = S.draft, c = st.teams[cmdId];
    var cells = teamsWhere(st, function (t) { return t.o === S.meIdx && t.t !== 'king' && t.id !== cmdId && !E.isResting(st, t) && Math.abs(t.x - c.x) + Math.abs(t.y - c.y) === 1; });
    if (!cells.length) return App.toast('Không có đội kề Chỉ Huy', 'err');
    setUi({ mode: 'dieubinh', cmdId: cmdId, step: 1, cells: cells.map(function (t) { return [t.x, t.y]; }) });
  }
  function dieuBinhClick(x, y, t) {
    var u = S.ui, st = S.draft;
    var ok = (u.cells || []).some(function (c) { return c[0] === x && c[1] === y; });
    if (!ok) return setUi({ mode: 'idle' });
    if (u.step === 1) {
      var cells = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(function (d) { return [t.x + d[0], t.y + d[1]]; }).filter(function (c) { return E.exists(st, c[0], c[1]) && !E.teamAt(st, c[0], c[1]); });
      return setUi({ mode: 'dieubinh', cmdId: u.cmdId, step: 2, first: t.id, cells: cells });
    }
    doCmd({ c: 'dieubinh', cmdId: u.cmdId, id: u.first, to: [x, y] }); setUi({ mode: 'idle' });
  }
  function openTrade() {
    var r = S.draft.players[S.meIdx].res;
    var sel = function (n) { return '<select name="' + n + '">' + ['V', 'T', 'G'].map(function (k) { return '<option value="' + k + '">' + TT.RES_NAME[k] + '</option>'; }).join('') + '</select>'; };
    App.modal('<h2>Chợ Trời — đổi 2 lấy 1</h2><p class="muted">Hiện có: ' + r.V + 'V · ' + r.T + 'T · ' + r.G + 'G</p><form id="trade-f"><div class="row"><label style="flex:1">Đưa 1' + sel('a') + '</label><label style="flex:1">Đưa 2' + sel('b') + '</label><label style="flex:1">Nhận' + sel('g') + '</label></div></form>', [['Hủy', 'ghost', false], ['Đổi', 'gold', true]]).then(function (ok) {
      if (!ok) return;
      var f = document.getElementById('trade-f') || null;
      var a = S._ta, b = S._tb, g = S._tg;
      var give = { V: 0, T: 0, G: 0 }; give[a] += 1; give[b] += 1;
      doCmd({ c: 'trade', give: give, get: g });
    });
    var form = document.getElementById('trade-f');
    S._ta = 'V'; S._tb = 'V'; S._tg = 'T'; form.g.value = 'T';
    form.a.onchange = function () { S._ta = form.a.value; }; form.b.onchange = function () { S._tb = form.b.value; }; form.g.onchange = function () { S._tg = form.g.value; };
  }

  /* ============ HUD ============ */
  function isPhone() { return G.innerWidth <= 760; }
  var isTouch = G.matchMedia && G.matchMedia('(hover: none)').matches;
  function collapseDock(c) { var dk = $('#g-dock'); if (!dk || dk.classList.contains('collapsed') === c) return; dk.classList.toggle('collapsed', c); $('#dock-hide').innerHTML = I.ui(c ? 'up' : 'down', 12); }
  function collapseChat(c) { var cb = $('#g-chatbox'); if (!cb || cb.classList.contains('collapsed') === c) return; cb.classList.toggle('collapsed', c); $('#chat-toggle').innerHTML = I.ui(c ? 'up' : 'down', 12); }
  function setDock(d, user) {
    if (user && isPhone() && S.dock === d && !$('#g-dock').classList.contains('collapsed')) { collapseDock(true); return; }
    S.dock = d;
    $$('#g-dock .dock-tabs [data-d]').forEach(function (b) { b.classList.toggle('active', b.dataset.d === d); });
    $('#g-skills').classList.toggle('hidden', d !== 'skill'); $('#g-shop').classList.toggle('hidden', d !== 'shop');
    if (user) { try { localStorage.setItem('ttkc.dock', d); } catch (e) { } collapseDock(false); if (isPhone()) { collapseChat(true); if (S.ui.mode === 'selected') setUi({ mode: 'idle' }); } }
  }
  function refreshAll() {
    if (!S || !S.state) return;
    renderTop(); renderPlayers(); renderEcon(); renderSkills(); renderShop(); renderUnit(); renderPrompt(); updateHighlights();
    var st = view();
    $('#btn-end').disabled = !S.local || S.sending;
    $('#btn-undo').disabled = !S.local || S.sending || !S.draftCmds.some(function (c) { return c.c !== 'harvest'; });
    $('#btn-end').classList.toggle('btn-end-pulse', S.local && st && E.actionsLeft(st) <= 0 && !st.pending.length);
    $('#btn-end').textContent = S.sending ? 'Đang gửi…' : S.local ? 'Kết thúc lượt' : 'Chờ đối thủ…';
    queueLayout();
  }
  /* ---- bố cục HUD thông minh: đo thực tế để các khung không che nhau ---- */
  var layoutQ = 0;
  function queueLayout() { if (layoutQ) return; layoutQ = requestAnimationFrame(function () { layoutQ = 0; layoutHud(); }); }
  Game.layout = queueLayout;
  function vis(el) { return el && !el.classList.contains('hidden') && el.offsetParent !== null && el.getBoundingClientRect().height > 0; }
  function setS(el, k, v) { if (el && el.style[k] !== v) el.style[k] = v; }
  function layoutHud() {
    if (!S || App.screen !== 'game') return;
    var W = G.innerWidth, H = G.innerHeight, phone = isPhone(), gap = phone ? 5 : 8;
    var top = $('.hud-top'), me = $('#g-econ'), pl = $('#g-players'), unit = $('#g-unit'), chat = $('#g-chatbox'), dock = $('#g-dock'),
      prm = $('#prompt'), toasts = $('#toasts'), bar = S.board && S.board.camBar, dbody = dock && dock.querySelector('.dock-body'), cbody = chat && chat.querySelector('.chat-body');
    var R = function (el) { return el.getBoundingClientRect(); };
    var hit = function (a, b) { return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; };
    var tR = R(top);
    if (phone) {
      // xếp chồng từ trên xuống theo kích thước thật
      setS(me, 'top', Math.round(tR.bottom + gap) + 'px');
      var mR = R(me);
      setS(pl, 'top', Math.round(mR.bottom + gap) + 'px');
      var pR = pl.children.length ? R(pl) : mR, below = pR.bottom + gap;
      setS(prm, 'top', Math.round(below) + 'px');
      var prR = prm.classList.contains('show') ? R(prm) : null, below2 = prR ? prR.bottom + gap : below;
      if (toasts) setS(toasts, 'top', Math.round(below2) + 'px');
      // bottom sheet không được trùm lên dải thông tin phía trên
      var maxSheet = Math.max(120, H - 52 - below - 6) + 'px';
      [dbody, cbody, unit].forEach(function (el) { if (el) setS(el, 'maxHeight', maxSheet); });
      setS(unit, 'top', 'auto');
      if (bar) {
        setS(bar, 'top', Math.round(below2) + 'px'); setS(bar, 'left', 'auto'); setS(bar, 'bottom', 'auto'); setS(bar, 'right', ''); setS(bar, 'transform', ''); setS(bar, 'flexDirection', '');
        var bR = R(bar), sheet = [vis(unit) && unit, !dock.classList.contains('collapsed') && dbody, !chat.classList.contains('collapsed') && cbody].filter(Boolean)[0];
        var low = sheet ? R(sheet).top : H - 52;
        bar.classList.toggle('cam-hide', bR.bottom > low - 4);
      }
      return;
    }
    // ---- máy tính / máy tính bảng ----
    setS(me, 'top', ''); setS(pl, 'top', ''); setS(prm, 'top', ''); if (toasts) setS(toasts, 'top', ''); if (cbody) setS(cbody, 'maxHeight', '');
    var mR = R(me), pR = R(pl);
    if (mR.right + gap > tR.left && mR.top < tR.bottom) { setS(me, 'top', Math.round(tR.bottom + gap) + 'px'); mR = R(me); }
    if (pl.children.length && pR.left - gap < tR.right && pR.top < tR.bottom) { setS(pl, 'top', Math.round(tR.bottom + gap) + 'px'); pR = R(pl); }
    var prTop = tR.bottom + gap;
    setS(prm, 'top', Math.round(prTop) + 'px');
    var prR = prm.classList.contains('show') ? R(prm) : null;
    if (toasts) setS(toasts, 'top', Math.round(prR ? prR.bottom + gap : prTop) + 'px');
    // khung chat (trái dưới) vs dock (phải dưới): thu hẹp chat, nếu vẫn chật thì tự thu gọn
    setS(chat, 'width', '');
    var dR = R(dock), cR = R(chat);
    if (cR.right + gap > dR.left) {
      var w = dR.left - gap - cR.left;
      if (w >= 230) setS(chat, 'width', Math.round(w) + 'px');
      else { setS(chat, 'width', Math.max(200, Math.round(w)) + 'px'); if (S._chatAutoW !== W) { S._chatAutoW = W; collapseChat(true); } }
      cR = R(chat);
    }
    // dock không được chạm hàng đối thủ phía trên
    var ceilD = (pl.children.length && pR.left < dR.right && dR.left < pR.right) ? pR.bottom : (dR.left < tR.right && tR.left < dR.right ? tR.bottom : 0);
    if (prR && prR.left < dR.right && dR.left < prR.right) ceilD = Math.max(ceilD, prR.bottom);
    if (dbody) {
      var tabsH = (dock.querySelector('.dock-tabs') || dock).getBoundingClientRect().height;
      var avail = H - 10 - tabsH - ceilD - gap - 6;
      setS(dbody, 'maxHeight', Math.max(140, Math.min(460, avail)) + 'px');
      setS(dbody, 'overflowY', dbody.scrollHeight > avail + 4 ? 'auto' : '');
    }
    // bảng đơn vị: ngay dưới thông tin bản thân, dừng trước khung chat
    if (vis(unit)) {
      var uTop = Math.max(mR.bottom, prR && prR.left < 280 ? prR.bottom : 0) + gap;
      setS(unit, 'top', Math.round(uTop) + 'px');
      var uMax = cR.top - gap - uTop;
      if (uMax < 140 && !chat.classList.contains('collapsed') && S._unitAuto !== S.ui.id) { S._unitAuto = S.ui.id; collapseChat(true); cR = R(chat); uMax = cR.top - gap - uTop; }
      setS(unit, 'maxHeight', Math.max(120, Math.round(uMax)) + 'px');
    }
    // thanh camera: tìm khoảng trống ở đáy giữa chat và dock, không có thì dựng dọc bên phải
    if (bar) {
      var wrapR = bar.parentNode.getBoundingClientRect();
      setS(bar, 'flexDirection', 'row'); setS(bar, 'top', ''); setS(bar, 'bottom', ''); setS(bar, 'left', ''); setS(bar, 'right', ''); setS(bar, 'transform', '');
      var bR = R(bar), bw = bR.width, bh = bR.height;
      dR = R(dock); cR = R(chat);
      var gapL = cR.right + gap, gapR = dR.left - gap, uR = vis(unit) ? R(unit) : null;
      var cx = Math.max(W / 2, gapL + bw / 2);
      var ok = gapR - gapL >= bw && cx + bw / 2 <= gapR;
      bar.classList.remove('cam-hide');
      if (ok) {
        setS(bar, 'left', Math.round(cx - wrapR.left) + 'px'); setS(bar, 'transform', 'translateX(-50%)');
      } else {
        setS(bar, 'flexDirection', 'column'); bR = R(bar);
        var vTop = (pl.children.length ? pR.bottom : tR.bottom) + gap, vBot = dR.top - gap;
        setS(bar, 'left', 'auto'); setS(bar, 'right', '10px'); setS(bar, 'bottom', 'auto');
        if (vBot - vTop >= bR.height) setS(bar, 'top', Math.round(vTop - wrapR.top) + 'px');
        else {
          // thử khoảng trống bên trái giữa bảng thông tin và chat
          var lTop = (uR ? uR.bottom : mR.bottom) + gap, lBot = cR.top - gap;
          if (lBot - lTop >= bR.height) { setS(bar, 'right', 'auto'); setS(bar, 'left', Math.round((uR ? uR.right : mR.right) + gap - wrapR.left) + 'px'); setS(bar, 'top', Math.round(lTop - wrapR.top) + 'px'); }
          else bar.classList.add('cam-hide');
        }
      }
    }
  }
  G.addEventListener('resize', queueLayout);
  G.addEventListener('orientationchange', function () { setTimeout(queueLayout, 250); });
  if (G.ResizeObserver) {
    var hudRO = new ResizeObserver(queueLayout);
    G.addEventListener('DOMContentLoaded', function () { ['.hud-top', '#g-econ', '#g-players', '#g-unit', '#g-chatbox', '#g-dock', '#prompt'].forEach(function (s) { var el = $(s); if (el) hudRO.observe(el); }); });
    if (document.readyState !== 'loading') ['.hud-top', '#g-econ', '#g-players', '#g-unit', '#g-chatbox', '#g-dock', '#prompt'].forEach(function (s) { var el = $(s); if (el) hudRO.observe(el); });
  }
  function renderTop() {
    var st = view(), pl = st.players[st.active];
    var phase = { start: 'Thu hoạch', buy: 'Mua sắm', act: 'Hành động', over: 'Kết thúc' }[st.phase] || st.phase;
    var tags = '';
    if (E.inPeace(st)) tags += '<span class="ph peace">' + I.ui('leaf', 12) + ' Miễn chiến</span>';
    if (pl.pturn >= CFG.declineTurn) tags += '<span class="ph decline">Suy Tàn</span>';
    var acts = '';
    if (S.local) { var mx = CFG.actionsByAge[pl.age], lf = E.actionsLeft(st); acts = '<span class="ph acts-pill">Hành động <b>' + lf + '/' + mx + '</b></span>'; }
    $('#turn-banner').innerHTML = (S.local ? '<span class="yours">' + I.ui('swords', 18) + ' Lượt của bạn</span>' : '<span class="who" style="--pc:' + TT.SEAT_COLORS[pl.seat] + '">Lượt của ' + esc(pl.name) + (pl.bot ? ' <small class="muted">(đang tính…)</small>' : '') + '</span>') +
      '<span class="ph">Vòng ' + st.round + '</span><span class="ph">' + phase + '</span>' + acts + tags;
  }
  function resPills(p, big) {
    var s = big ? 20 : 14;
    return '<span class="rp cV">' + I.svg('resV', null, s) + '<b>' + p.res.V + '</b></span><span class="rp cT">' + I.svg('resT', null, s) + '<b>' + p.res.T + '</b></span><span class="rp cG">' + I.svg('resG', null, s) + '<b>' + p.res.G + '</b></span>' + (p.faction === 'demon' ? '<span class="rp cS">' + I.svg('soul', null, s) + '<b>' + p.souls + '</b></span>' : '');
  }
  function renderPlayers() {
    var st = view(), room = S.room || {};
    $('#g-players').innerHTML = st.players.map(function (p, i) {
      if (i === S.meIdx) return '';
      var w = 0, army = 0;
      E.teamIds(st).forEach(function (id) { var t = st.teams[id]; if (t.o !== i) return; if (t.t === 'worker') w += t.n; else if (t.t !== 'king') army += t.n; });
      var rp = room.players && room.players[p.uid];
      var off = !p.bot && rp && typeof rp.lastSeen === 'number' && Net.B.now() - rp.lastSeen > 45000;
      return '<div class="pchip' + (st.active === i ? ' active' : '') + (p.alive ? '' : ' dead') + '" style="--pc:' + TT.SEAT_COLORS[p.seat] + '">' + I.crest(p.faction, 40) +
        '<div class="pc-body"><div class="pc-name">' + esc(p.name) + (p.bot ? ' <span class="tag lv-' + botLevel(i) + '">' + TT.Bot.levelName(botLevel(i)) + '</span>' : '') + (off ? ' <span title="Mất kết nối">' + I.ui('warn', 12, '#e0a000') + '</span>' : '') + (st.teamMode ? ' <small>' + (p.team ? 'B' : 'A') + '</small>' : '') + '</div>' +
        '<div class="pc-sub">' + F[p.faction].short + ' · Đời ' + TT.AGE_ROMAN[p.age] + ' · ' + I.ui('worker', 11) + w + ' ' + I.ui('swords', 11) + army + '</div><div class="pc-res">' + resPills(p) + '</div></div>' +
        (st.active === i ? '<div class="pc-turn">' + I.ui('play', 12) + '</div>' : '') + '</div>';
    }).join('');
  }
  function popRes() { $$('#g-econ .rp').forEach(function (d) { d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }); }
  function renderEcon() {
    var el = $('#g-econ');
    if (S.meIdx < 0) { el.innerHTML = '<div class="win-title"><span>Khán giả</span></div><div class="win-body muted">Bạn đang xem trận.</div>'; return; }
    var st = view(), pl = st.players[S.meIdx], mine = st.active === S.meIdx && S.local, f = F[pl.faction];
    var max = CFG.actionsByAge[pl.age], left = mine ? E.actionsLeft(st) : max;
    var gems = ''; for (var k = 0; k < max; k++) gems += '<i class="' + (k < left ? 'on' : '') + '"></i>';
    var next = CFG.ageCosts[pl.age + 1];
    el.innerHTML = '<div class="me-top">' + I.crest(pl.faction, 58) + '<div class="me-info"><div class="me-name">' + esc(pl.name) + '</div><div class="me-sub" style="color:' + f.color + '">' + f.name + '</div>' +
      '<div class="age-pill">Đời ' + TT.AGE_ROMAN[pl.age] + ' · ' + TT.AGE_NAME[pl.age] + '</div></div></div>' +
      '<div class="me-res">' + resPills(pl, true) + '</div>' +
      '<div class="me-acts"><span>Hành động</span><span class="gems">' + gems + '</span></div>' +
      (next ? '<button class="btn gold small wide age-up" id="btn-age"' + (mine && st.phase !== 'act' && E.canPay(pl.res, next) ? '' : ' disabled') + '>' + I.ui('arrowup', 12) + ' Lên Đời ' + TT.AGE_ROMAN[pl.age + 1] + ' ' + C.costHtml(next) + '</button>' : '');
    var b = $('#btn-age'); if (b) b.onclick = function () { doCmd({ c: 'age' }); };
  }
  function renderSkills() {
    var el = $('#g-skills');
    if (S.meIdx < 0) { el.innerHTML = ''; return; }
    var st = view(), pl = st.players[S.meIdx], f = F[pl.faction], mine = S.local;
    var pas = f.passives.filter(function (x) { return x.id === pl.passive; })[0];
    var cards = f.actives.map(function (a, i) {
      var cd = (pl.ready[a.id] || 0) - pl.pturn, lock = !mine || (a.hostile && E.inPeace(st)), on = S.ui.mode === 'skill' && S.ui.a === a.id;
      var cost = a.pay ? a.pay + ' tài nguyên' : a.soul ? a.soul + ' Hồn' : a.id === 'hoilo' ? '2× giá trị' : 'Miễn phí';
      return '<div class="scard' + (cd > 0 ? ' cd' : '') + (lock ? ' lock' : '') + (on ? ' on' : '') + '" data-a="' + a.id + '" style="--fc:' + f.color + ';--fc2:' + f.color2 + ';--cdp:' + (cd > 0 ? Math.round(100 * cd / a.cd) : 0) + '%;--i:' + i + '">' +
        '<div class="sc-key">' + a.key + '</div><div class="sc-art">' + I.skillSvg(a.id, 46) + '</div><div class="sc-name">' + a.name + '</div><div class="sc-meta">Hồi ' + a.cd + ' · ' + cost + '</div>' +
        (cd > 0 ? '<div class="sc-cd"><b>' + cd + '</b><small>lượt</small></div>' : '') +
        '<div class="sc-tip"><b>' + a.name + '</b> <small>(phím ' + a.key + ' · hồi ' + a.cd + ')</small><br>' + a.text + (a.hostile && E.inPeace(st) ? '<br><i>Khóa trong 3 lượt miễn chiến</i>' : '') + '</div></div>';
    }).join('');
    var extras = '';
    if (mine) {
      if (pl.passive === 'oanhon') extras += xcard('oanhon', 'Oán Hồn', '3 Hồn → Lính Quỷ', pl.souls >= 3);
      if (pl.passive === 'taisinh') extras += xcard('taisinh', 'Tái Sinh', '3 Hồn → hồi quân', pl.souls >= 3 && !!E.taisinhCandidate(st, S.meIdx));
      if (pl.passive === 'chotroi') extras += xcard('trade', 'Chợ Trời', 'Đổi 2 lấy 1', true, 'chotroi');
    }
    var dsc = pl.passive === 'doatsinh' ? ((pl.ready.doatsinh || 0) - pl.pturn) : null;
    el.innerHTML = '<div class="hand">' + cards + '</div>' +
      '<div class="passive-card" title="' + esc(pas ? pas.text : '') + '" style="--fc:' + f.color + '"><div class="pc-ic">' + I.skillSvg(pl.passive === 'doatsinh' || I.SKILL[pl.passive] ? pl.passive : 'doatsinh', 30) + '</div><div><b>' + I.ui('diamond', 10) + ' ' + (pas ? pas.name : '') + '</b>' + (dsc != null ? ' <small>' + (dsc > 0 ? '· hồi ' + dsc : '· sẵn sàng') + '</small>' : '') + '<div class="muted small">' + (pas ? pas.text : '') + '</div></div></div>' +
      (extras ? '<div class="xcards">' + extras + '</div>' : '');
    $$('.scard', el).forEach(function (s) { s.onclick = function () { startSkill(s.dataset.a); }; });
    $$('.xcard', el).forEach(function (b) { b.onclick = function () { if (b.classList.contains('no')) return; var x = b.dataset.x; if (x === 'trade') openTrade(); else setUi({ mode: 'spawn', kind: x }); }; });
  }
  function xcard(x, name, sub, ok, icon) { return '<div class="xcard' + (ok ? '' : ' no') + '" data-x="' + x + '">' + I.skillSvg(icon || x, 28) + '<div><b>' + name + '</b><small>' + sub + '</small></div></div>'; }
  function shopItems() {
    var items = [];
    ['V', 'T', 'G'].forEach(function (j) { items.push({ u: 'worker', job: j, name: TT.JOB[j] }); });
    TT.UNIT_ORDER.slice(1).forEach(function (u) { items.push({ u: u, name: U[u].name }); });
    return items;
  }
  function renderShop() {
    var el = $('#g-shop');
    if (S.meIdx < 0) { el.innerHTML = ''; return; }
    var st = view(), pl = st.players[S.meIdx], mine = S.local && st.phase !== 'act' && !st.pending.length;
    var note = !S.local ? 'Chờ tới lượt bạn' : st.phase === 'act' ? 'Đã qua pha mua (đã hành động)' : 'Kéo quân vào ô sáng ở hàng spawn, hoặc bấm rồi chọn ô';
    el.innerHTML = (S.local && st.phase === 'act' ? '<div class="shop-note">Đã qua pha mua</div>' : '') + '<div class="shop">' + shopItems().map(function (it) {
      var price = E.price(st, S.meIdx, it.u), lockAge = U[it.u].age > pl.age, sold = it.u === 'beast' && pl.beast;
      var can = mine && !lockAge && !sold && E.canPay(pl.res, price);
      var on = S.ui.mode === 'place' && S.ui.u === it.u && S.ui.job === it.job;
      var tr = F[pl.faction].traits[it.u];
      return '<div class="shop-item' + (can ? '' : ' no') + (lockAge ? ' locked' : '') + (on ? ' on' : '') + '" data-u="' + it.u + '" data-j="' + (it.job || '') + '">' +
        (lockAge ? '<span class="lk">Đời ' + TT.AGE_ROMAN[U[it.u].age] + '</span>' : '') + '<div class="si-ic" style="--fc:' + F[pl.faction].color + '">' + I.svg(I.unitKey(it.u, it.job), '#fff', 24) + '</div><div class="n">' + it.name + '</div><div class="c">' + C.costHtml(price) + '</div>' +
        '<div class="si-tip"><b>' + it.name + '</b><br>' + (tr ? I.ui('star', 10) + ' ' + tr : '') + '</div></div>';
    }).join('') + '</div>';
    $$('.shop-item', el).forEach(function (d) {
      d.onpointerdown = function (e) { if (d.classList.contains('no') || e.button === 2) return; startShopDrag(e, d.dataset.u, d.dataset.j || undefined, d); };
    });
  }
  /* ---------- kéo-thả: mua từ cửa hàng ---------- */
  function startShopDrag(e, u, job, el) {
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY, moved = false, gh = $('#drag-ghost'), pl = S.draft.players[S.meIdx];
    gh.innerHTML = '<div class="dg-ic" style="--fc:' + F[pl.faction].color + '">' + I.svg(I.unitKey(u, job), '#fff', 34) + '</div>';
    function mv(ev) {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) { moved = true; gh.classList.remove('hidden'); setUi({ mode: 'place', u: u, job: job }); document.body.classList.add('dragging'); }
      if (!moved) return;
      gh.style.transform = 'translate(' + (ev.clientX - 28) + 'px,' + (ev.clientY - 28) + 'px)';
      var cell = S.board.cellAt(ev, true), ok = cell && (S.hl.spawn || []).some(function (c) { return c[0] === cell[0] && c[1] === cell[1]; });
      gh.classList.toggle('ok', !!ok);
      if (S.board.setDragHover) S.board.setDragHover(cell, true); else S.board.hover = cell;
    }
    function up(ev) {
      G.removeEventListener('pointermove', mv); G.removeEventListener('pointerup', up);
      gh.classList.add('hidden'); document.body.classList.remove('dragging');
      if (S.board.setDragHover) S.board.setDragHover(null, false);
      if (!moved) { // bấm thường: chế độ đặt
        if (S.ui.mode === 'place' && S.ui.u === u && S.ui.job === job) setUi({ mode: 'idle' }); else setUi({ mode: 'place', u: u, job: job });
        return;
      }
      var cell = S.board.cellAt(ev, true);
      if (cell && (S.hl.spawn || []).some(function (c) { return c[0] === cell[0] && c[1] === cell[1]; })) doCmd({ c: 'buy', u: u, job: job, cell: cell });
      else if (cell) App.toast('Chỉ đặt được vào ô sáng ở hàng spawn', 'err');
      setUi({ mode: 'idle' });
    }
    G.addEventListener('pointermove', mv); G.addEventListener('pointerup', up);
  }
  /* ---------- kéo-thả: di chuyển quân ---------- */
  function onPieceDragStart(x, y) {
    if (!S || !S.local) return false;
    var st = S.draft, t = E.teamAt(st, x, y);
    if (!t || !canAct(st, t) || st.pending.length) return false;
    setUi({ mode: 'selected', id: t.id, k: S.ui.mode === 'selected' && S.ui.id === t.id ? S.ui.k : undefined });
    document.body.classList.add('dragging');
    return true;
  }
  function onPieceDragMove(cell, e) { if (cell) onHover(cell, e); }
  function onPieceDragEnd(cell) {
    document.body.classList.remove('dragging');
    $('#board-tip').style.display = 'none';
    if (!cell || S.ui.mode !== 'selected') return;
    var st = S.draft, tm = st.teams[S.ui.id], h = S.hl || {};
    if (!tm || (cell[0] === tm.x && cell[1] === tm.y)) return;
    var inList = function (l) { return (l || []).some(function (c) { return c.x === cell[0] && c.y === cell[1]; }); };
    if (inList(h.moves) || inList(h.attacks)) onCellClick(cell[0], cell[1]);
    else App.toast('Không đi tới ô đó được', 'err');
  }
  function renderUnit() {
    var el = $('#g-unit'), st = view(), u = S.ui;
    if (!st) return;
    var t = u.mode === 'selected' ? st.teams[u.id] : null;
    el.classList.toggle('hidden', !t);
    if (!t) { el.innerHTML = ''; return; }
    var p = st.players[t.o], f = F[p.faction], mineT = t.o === S.meIdx, can = canAct(st, t);
    var av = t.n - t.na, k = selK(st);
    var html = '<div class="win-title" style="--pc:' + TT.SEAT_COLORS[p.seat] + '"><span>' + U[t.t].name + (t.t === 'worker' ? ' · ' + TT.JOB[t.job] : '') + '</span><button class="win-x" id="unit-x">' + I.ui('close', 10) + '</button></div><div class="win-body unit-panel">' +
      '<div class="uhead"><div class="uic" style="--fc:' + f.color + ';--pc:' + TT.SEAT_COLORS[p.seat] + '">' + I.svg(I.unitKey(t.t, t.job), '#fff', 30) + '</div><div><div class="un">×' + (t.t === 'beast' ? 1 : t.n) + ' · HP ' + E.teamHP(t) + '</div><div class="us">' + esc(p.name) + ' · ' + f.short + (E.isResting(st, t) ? ' · đang nghỉ' : '') + (st.active === t.o ? ' · sẵn ' + av + '/' + t.n : '') + '</div></div></div>' +
      (f.traits[t.t] ? '<div class="trait">' + I.ui('star', 11) + ' ' + f.traits[t.t] + '</div>' : '') + (statusNames(t) ? '<div class="status-tags">' + statusNames(t) + '</div>' : '');
    if (can && t.t !== 'king' && t.t !== 'beast' && av > 1) html += '<div class="krow">Số quân <input type="range" id="k-range" min="1" max="' + av + '" value="' + k + '"><b id="k-val">' + k + '</b>/' + av + '</div>';
    if (can) {
      var o = S.opts, opts = '', prof = E.atkProfile(st, t);
      if (prof.kind === 'melee') opts += chk('occ', o.occ !== false, 'Chiếm ô khi diệt sạch');
      if (p.faction === 'demon' && t.t === 'assassin') opts += chk('back', !!o.back, 'Bóng Ma: quay về');
      if (p.faction === 'fairy' && t.t === 'soldier') opts += chk('retreat', o.retreat !== false, 'Du Kích: lùi sau đánh');
      if (p.faction === 'human' && t.t === 'mage') opts += chk('tamung', !!o.tamung, 'Phép Tạm Ứng (2V)');
      if (p.faction === 'demon' && t.t === 'siege') opts += chk('honphao', !!o.honphao, 'Hồn Pháo (1 Hồn): +2');
      if (p.faction === 'human' && t.t === 'elephant') opts += chk('phatran', !!o.phatran, 'Phá Trận (2G): đẩy');
      if (p.faction === 'human' && t.t === 'chariot') {
        var ws = teamsWhere(st, function (w) { return w.o === S.meIdx && w.t === 'worker' && w.n <= 2 && w.na === 0 && !E.isResting(st, w) && Math.abs(w.x - t.x) + Math.abs(w.y - t.y) === 1; });
        if (ws.length) opts += '<label>Thương Xa chở Dân<select id="carry"><option value="">— không —</option>' + ws.map(function (w) { return '<option value="' + w.id + '"' + (o.carry === w.id ? ' selected' : '') + '>' + TT.JOB[w.job] + ' ×' + w.n + '</option>'; }).join('') + '</select></label>';
      }
      if (opts) html += '<div class="opts">' + opts + '</div>';
    }
    var btns = '';
    if (S.local && mineT) {
      if (u.ghost) btns += '<button class="btn small teal" id="u-moveonly">Chỉ đi tới ' + E.cellName(st, u.ghost.x, u.ghost.y) + '</button>';
      if (p.faction === 'demon' && t.t === 'worker') btns += '<button class="btn small" id="u-hiente">Hiến Tế (+2 Hồn)</button>';
      if (p.faction === 'human' && t.t === 'commander' && !st.players[S.meIdx].cnt.dieubinh) btns += '<button class="btn small" id="u-dieubinh">Điều Binh (2V)</button>';
      if (p.faction === 'human' && t.t === 'worker' && st.phase === 'start' && !t.jobDone) btns += ['V', 'T', 'G'].filter(function (j) { return j !== t.job; }).map(function (j) { return '<button class="btn small" data-job="' + j + '">→ ' + TT.JOB[j] + '</button>'; }).join('');
    }
    if (btns) html += '<div class="extra-btns">' + btns + '</div>';
    if (!can && mineT && S.local && st.active === S.meIdx) {
      var why = E.actionsLeft(st) <= 0 ? 'Hết hành động lượt này.' : av <= 0 ? 'Đội đã hành động.' : E.isResting(st, t) ? 'Quân mới mua — nghỉ tới lượt sau.' : '';
      if (why) html += '<div class="muted small" style="margin-top:6px">' + why + '</div>';
    }
    el.innerHTML = html + '</div>';
    $('#unit-x').onclick = function () { setUi({ mode: 'idle' }); };
    var kr = $('#k-range');
    if (kr) kr.oninput = function () { S.ui.k = +kr.value; $('#k-val').textContent = kr.value; updateHighlights(); };
    $$('input[data-o]', el).forEach(function (c) { c.onchange = function () { S.opts[c.dataset.o] = c.checked; }; });
    var cs = $('#carry'); if (cs) cs.onchange = function () { S.opts.carry = cs.value ? +cs.value : undefined; };
    var mo = $('#u-moveonly'); if (mo) mo.onclick = function () { doCmd({ c: 'act', id: t.id, k: selK(st), to: [u.ghost.x, u.ghost.y], opt: Object.assign({ rw: S.rw }, S.opts) }); setUi({ mode: 'idle' }); };
    var ht = $('#u-hiente'); if (ht) ht.onclick = function () { doCmd({ c: 'hiente', id: t.id }); setUi({ mode: 'idle' }); };
    var db = $('#u-dieubinh'); if (db) db.onclick = function () { startDieuBinh(t.id); };
    $$('[data-job]', el).forEach(function (b) { b.onclick = function () { doCmd({ c: 'job', id: t.id, job: b.dataset.job }); setUi({ mode: 'selected', id: t.id }); }; });
  }
  function chk(k, v, label) { return '<label class="check"><input type="checkbox" data-o="' + k + '"' + (v ? ' checked' : '') + '> ' + label + '</label>'; }

  function renderPrompt() {
    var el = $('#prompt'), st = view(), u = S.ui, msg = '', btn = '';
    if (!st) return;
    if (S.local && st.pending.length) { var pd = st.pending[0]; msg = '<b>' + pd.why + '</b>: ' + (pd.k === 'atk' ? 'chọn mục tiêu để đánh thêm' : 'chọn ô để đi thêm ' + pd.range + ' ô'); btn = '<button class="btn small" id="pr-skip">Bỏ qua (Space)</button>'; }
    else if (S.local && st.phase === 'start') { msg = 'Đầu lượt: chọn Dân để <b>đổi nghề</b> trước khi thu hoạch (tùy chọn).'; btn = '<button class="btn small gold" id="pr-harvest">Thu hoạch</button>'; }
    else if (u.mode === 'place') msg = 'Chọn ô sáng ở hàng spawn để đặt <b>' + (u.u === 'worker' ? TT.JOB[u.job] : U[u.u].name) + '</b> — bấm tiếp để mua thêm. Chuột phải để thôi.';
    else if (u.mode === 'spawn') msg = 'Chọn ô spawn trống.';
    else if (u.mode === 'skill') { var a = E.findActive(view().players[S.meIdx].faction, u.a); msg = '<b>' + a.name + '</b>: ' + (u.a === 'hoanvi' ? (u.step === 1 ? 'chọn đội thứ nhất' : 'chọn đội để đổi chỗ') : u.a === 'huyette' ? (u.step === 1 ? 'chọn quân để hy sinh' : 'chọn đội địch nhận 2 sát thương') : 'chọn mục tiêu'); }
    else if (u.mode === 'dieubinh') msg = 'Điều Binh: ' + (u.step === 1 ? 'chọn đội kề Chỉ Huy' : 'chọn ô trống để dịch tới');
    else if (u.mode === 'selected' && u.ghost) msg = 'Bấm mục tiêu đỏ để <b>đi rồi đánh</b>, bấm lại bóng mờ để <b>chỉ đi</b>.';
    el.innerHTML = msg + btn; el.classList.toggle('show', !!msg);
    var sk = $('#pr-skip'); if (sk) sk.onclick = function () { doCmd({ c: 'skip' }); };
    var hv = $('#pr-harvest'); if (hv) hv.onclick = function () { doCmd({ c: 'harvest' }); };
  }

  /* ---------- nhật ký ---------- */
  function addLog(text, cls) {
    var el = $('#g-log'), d = document.createElement('div');
    d.className = 'm ' + (cls || ''); d.textContent = text; el.appendChild(d);
    while (el.children.length > 400) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }
  function logEvents(evs, quiet) {
    evs.forEach(function (e) { if (e.log) addLog(e.log, e.e === 'turn' ? 'turn' : (e.e === 'over' || e.e === 'elim') ? 'turn' : ''); });
  }

  /* ---------- menu ---------- */
  function openMenu() {
    var ov = $('#menu-overlay');
    ov.innerHTML = '<div class="panel menu-box"><h2>Tạm dừng</h2><div class="muted small">Phòng <b>' + S.code + '</b> · ' + esc(S.meta.ruleVersion) + '</div>' +
      '<button class="btn" id="mn-back">Tiếp tục</button><button class="btn" id="mn-sound">' + (TT.Sound.on ? I.ui('mute') + ' Tắt âm thanh' : I.ui('sound') + ' Bật âm thanh') + '</button>' +
      '<button class="btn" id="mn-gfx">' + I.ui('dice') + (Game.gfx() === '3d' ? ' Đồ họa: 3D (bấm để đổi 2D)' : ' Đồ họa: 2D (bấm để đổi 3D)') + '</button>' +
      '<button class="btn" id="mn-help">Xem hướng dẫn nhanh</button>' +
      (S.meIdx >= 0 && !S.state.over && S.state.players[S.meIdx].alive ? '<button class="btn red" id="mn-resign">Đầu hàng</button>' : '') +
      '<button class="btn ghost" id="mn-leave">Về sảnh</button></div>';
    ov.classList.remove('hidden');
    $('#mn-back').onclick = function () { ov.classList.add('hidden'); };
    $('#mn-sound').onclick = function () { TT.Sound.toggle(); openMenu(); };
    $('#mn-gfx').onclick = function () {
      if (!TT.webglOK) { App.toast('Trình duyệt không hỗ trợ WebGL — chỉ chơi được 2D', 'err'); return; }
      try { localStorage.setItem('ttkc.gfx', Game.gfx() === '3d' ? '2d' : '3d'); } catch (e) { }
      var st = view(); S.board = Game.makeBoard(); setupBoardUI(); S.board.setState(st); S.board.resize(); refreshAll(); openMenu();
    };
    $('#mn-help').onclick = function () { App.modal('<div class="doc" style="max-height:60vh;overflow:auto">' + C.guideSections[2][1] + C.guideSections[3][1] + '</div>'); };
    var rs = $('#mn-resign');
    if (rs) rs.onclick = function () {
      App.confirm('Đầu hàng?', 'Toàn bộ quân của bạn sẽ biến mất.', 'Đầu hàng').then(function (ok) {
        if (!ok) return; ov.classList.add('hidden');
        if (S.local) doCmd({ c: 'resign' }); else { S.wantResign = true; App.toast('Sẽ đầu hàng khi tới lượt bạn'); }
      });
    };
    $('#mn-leave').onclick = function () {
      var p = S.state.over || S.meIdx < 0 || !S.state.players[S.meIdx].alive ? Promise.resolve(true) :
        App.confirm('Rời trận?', 'Trận vẫn tiếp tục. Nếu không quay lại, lượt của bạn sẽ bị bỏ khi hết giờ và bị xử thua sau 3 lần.', 'Rời trận');
      p.then(function (ok) { if (!ok) return; ov.classList.add('hidden'); Game.stop(); App.cleanupRoom(); App.enterLobby(); });
    };
  }

  // gỡ lỗi / kiểm thử tự động
  Game._s = function () { return S; };
  Game._do = function (c) { return doCmd(c); };
  Game._send = function () { return sendTurn(); };
})(window);
