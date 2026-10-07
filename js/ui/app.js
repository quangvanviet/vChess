/* Ứng dụng: màn đăng nhập, sảnh, phòng chờ. */
(function (G) {
  'use strict';
  var TT = G.TT, Net = TT.Net, I = TT.Icons, C = TT.Content, F = TT.FACTIONS;
  var App = TT.App = { room: null, code: null, unsubs: [], profile: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  App.$ = $; App.$$ = $$;
  var esc = App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- tiện ích giao diện ---------- */
  App.show = function (id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'screen-' + id); });
    App.screen = id;
    if (App.showcase) App.showcase.paused = id !== 'auth';
    if (id === 'auth' && !App.showcase && TT.showcase3D) { try { App.showcase = TT.showcase3D($('#auth-3d-canvas'), $('#auth-3d')); } catch (e) { console.warn(e); } }
    document.getElementById('bg-fx').style.opacity = (id === 'game') ? '0' : '1';
  };
  App.toast = function (msg, kind, ms) {
    var t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
    $('#toasts').appendChild(t);
    if (kind === 'err') TT.Sound.play('err');
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, ms || 2800);
  };
  App.modal = function (html, buttons) {
    return new Promise(function (res) {
      var box = $('#modal-box');
      box.innerHTML = html + '<div class="btns">' + (buttons || [['OK', 'gold', true]]).map(function (b, i) { return '<button class="btn ' + (b[1] || '') + '" data-i="' + i + '">' + b[0] + '</button>'; }).join('') + '</div>';
      $('#modal').classList.remove('hidden');
      $$('.btns button', box).forEach(function (b) {
        b.onclick = function () { $('#modal').classList.add('hidden'); res((buttons || [['OK', 'gold', true]])[+b.dataset.i][2]); };
      });
    });
  };
  App.confirm = function (title, text, ok) { return App.modal('<h2>' + title + '</h2><p>' + text + '</p>', [['Hủy', 'ghost', false], [ok || 'Đồng ý', 'gold', true]]); };
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = '…'; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; }

  /* ---------- nền: tàn lửa bay ---------- */
  function bgFx() {
    var c = $('#bg-fx'), g = c.getContext('2d'), clouds = [], sparks = [];
    function rs() { c.width = innerWidth; c.height = innerHeight; }
    rs(); addEventListener('resize', rs);
    for (var i = 0; i < 9; i++) clouds.push({ x: Math.random() * innerWidth, y: 40 + Math.random() * innerHeight * .75, s: .6 + Math.random() * 1.1, v: .12 + Math.random() * .25 });
    for (var j = 0; j < 60; j++) sparks.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, v: .15 + Math.random() * .4, r: 1 + Math.random() * 2.2, a: Math.random() * 6 });
    function cloud(x, y, s) {
      g.fillStyle = 'rgba(255,255,255,.85)';
      [[0, 0, 38], [34, -14, 30], [62, 2, 34], [26, 12, 30], [-30, 8, 26]].forEach(function (p) { g.beginPath(); g.arc(x + p[0] * s, y + p[1] * s, p[2] * s, 0, 7); g.fill(); });
    }
    (function loop() {
      requestAnimationFrame(loop);
      if (App.screen === 'game') return;
      g.clearRect(0, 0, c.width, c.height);
      clouds.forEach(function (k) { k.x += k.v; if (k.x - 120 * k.s > c.width) k.x = -120 * k.s; cloud(k.x, k.y, k.s); });
      sparks.forEach(function (p) {
        p.y -= p.v; p.a += .03; if (p.y < -10) { p.y = c.height + 10; p.x = Math.random() * c.width; }
        var al = .35 + .45 * Math.abs(Math.sin(p.a));
        g.fillStyle = 'rgba(255,248,200,' + al + ')'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
      });
    })();
  }

  /* ---------- khởi động ---------- */
  App.init = function () {
    $$('[data-ic]').forEach(function (el) { el.outerHTML = I.ui(el.dataset.ic, +el.dataset.s || 16); });
    bgFx();
    Net.init();
    $('#logo-crests').innerHTML = TT.FACTION_ORDER.map(function (f) { return I.crest(f, 74); }).join('');
    $('#net-badge').innerHTML = Net.B.kind === 'firebase'
      ? '<span class="dot"></span> Online · Firebase Realtime Database'
      : '<span class="dot warn"></span> Chế độ demo cục bộ — mở thêm tab để chơi nhiều người trên cùng trình duyệt';
    if (Net.B.kind === 'firebase') Net.B.onConnected(function (on) { $('#net-badge').innerHTML = on ? '<span class="dot"></span> Online · Firebase' : '<span class="dot warn"></span> Đang kết nối Firebase…'; });
    // tab đăng nhập
    $$('#auth-tabs button').forEach(function (b) {
      b.onclick = function () {
        $$('#auth-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
        $$('.auth-form').forEach(function (f) { f.classList.toggle('active', f.id === 'form-' + b.dataset.tab); });
        $('#auth-msg').textContent = '';
      };
    });
    function authSubmit(form, fn) {
      form.onsubmit = function (e) {
        e.preventDefault(); var btn = $('button[type=submit]', form); busy(btn, true); $('#auth-msg').textContent = '';
        var d = new FormData(form);
        Promise.resolve().then(function () { return fn(d); }).catch(function (err) { $('#auth-msg').textContent = err.message || String(err); }).then(function () { busy(btn, false); });
      };
    }
    authSubmit($('#form-login'), function (d) { return Net.login(d.get('email'), d.get('password'), !!d.get('remember')); });
    authSubmit($('#form-register'), function (d) {
      var n = String(d.get('name') || '').trim();
      if (n.length < 2) throw new Error('Tên hiển thị cần ít nhất 2 ký tự');
      if (d.get('password') !== d.get('password2')) throw new Error('Mật khẩu nhập lại không khớp');
      return Net.register(d.get('email'), d.get('password'), n, !!d.get('remember'));
    });
    authSubmit($('#form-guest'), function (d) {
      var n = String(d.get('name') || '').trim();
      if (n.length < 2) throw new Error('Tên cần ít nhất 2 ký tự');
      try { localStorage.setItem('ttkc.guestName', n); } catch (e) { }
      return Net.guest(n);
    });
    try { var gn = localStorage.getItem('ttkc.guestName'); if (gn) $('#form-guest [name=name]').value = gn; } catch (e) { }
    Net.onAuth(function (u) {
      if (u) App.enterLobby(); else { App.cleanupRoom(); App.show('auth'); }
    });
    initLobbyUI();
    initRoomUI();
    document.addEventListener('click', function (e) { if (e.target.closest('.btn, .nav button, .tabs button, .rune, .fac-opt, .home-opt, .shop-item, .skill')) TT.Sound.play('click'); }, true);
  };

  /* ---------- SẢNH ---------- */
  var lobbyWired = false;
  function initLobbyUI() {
    $$('#lobby-nav button').forEach(function (b) { b.onclick = function () { App.lobbyView(b.dataset.view); }; });
    $$('#mode-seg button').forEach(function (b) { b.onclick = function () { $$('#mode-seg button').forEach(function (x) { x.classList.toggle('active', x === b); }); }; });
    $('#form-create').onsubmit = function (e) {
      e.preventDefault(); var d = new FormData(e.target), btn = $('button.big', e.target);
      var mode = +$('#mode-seg .active').dataset.mode;
      var o = { name: String(d.get('name') || '').trim() || ('Phòng của ' + Net.user.name), mode: mode, turnLimitMs: +d.get('turn'), teamMode: !!d.get('teamMode') && mode === 4, ranked: !!d.get('ranked'), secondBonus: !!d.get('secondBonus'), private: !!d.get('private') };
      if (d.get('teamMode') && mode !== 4) App.toast('2 đấu 2 chỉ áp dụng cho phòng 4 người', '');
      busy(btn, true);
      Net.createRoom(o).then(function (code) { try { localStorage.setItem('ttkc.roomName.' + code, o.name); } catch (x) { } App.enterRoom(code); })
        .catch(function (err) { App.toast('Không tạo được phòng: ' + (err.message || err), 'err', 5000); }).then(function () { busy(btn, false); });
    };
    $('#form-join').onsubmit = function (e) { e.preventDefault(); App.join(new FormData(e.target).get('code')); };
    $('#btn-practice').onclick = function () { App.practice(); };
    $('#room-search').oninput = renderRoomList; $('#room-filter').onchange = renderRoomList;
    $('#lobby-chat-form').onsubmit = function (e) {
      e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v) return;
      inp.value = ''; Net.sendLobbyChat(v).catch(function () { App.toast('Kênh thế giới chưa được bật trong luật Firebase', 'err'); });
    };
  }
  App.join = function (code) {
    code = String(code || '').trim().toUpperCase();
    if (code.length !== 6) { App.toast('Mã phòng gồm 6 ký tự', 'err'); return; }
    Net.joinRoom(code).then(function (r) { App.enterRoom(r.code); }).catch(function (err) { App.toast(err.message || String(err), 'err', 4000); });
  };
  App.practice = function () {
    var btn = $('#btn-practice'); busy(btn, true);
    Net.createRoom({ name: 'Luyện tập', mode: 2, turnLimitMs: 600000, secondBonus: true, private: true })
      .then(function (code) { return Net.addBot(code, 2).then(function () { App.autoStart = code; App.enterRoom(code); }); })
      .catch(function (err) { App.toast('Không tạo được phòng luyện tập: ' + (err.message || err), 'err', 5000); })
      .then(function () { busy(btn, false); });
  };

  var lobbyList = [], lobbyErr = null;
  App.enterLobby = function () {
    App.show('lobby');
    App.lobbyView('play');
    renderMe();
    Net.getProfile().then(function (p) { App.profile = p; renderMe(); });
    if (!lobbyWired) {
      lobbyWired = true;
      Net.watchLobby(function (list, err) { lobbyList = list || []; lobbyErr = err; renderRoomList(); });
      Net.watchLobbyChat(function (m) { appendChat($('#lobby-chat'), m); });
      Net.watchOnline(function (n) { $('#online-count').textContent = n == null ? '' : n + ' online'; });
      setTimeout(function () { if (!Net.ext.chat) appendSys($('#lobby-chat'), 'Kênh thế giới cần thêm nút lobbyChat vào luật Firebase (xem database.rules.json).'); }, 2500);
    }
    checkRejoin();
  };
  function renderMe() {
    var u = Net.user; if (!u) return;
    var p = App.profile || {};
    $('#me-chip').innerHTML = '<div style="text-align:right"><div class="nm">' + esc(u.name) + '</div><div class="sub">' + (u.guest ? 'Khách' : 'Hạng ' + (p.rating || 1000)) + ' · ' + (p.wins || 0) + ' thắng</div></div><div class="avatar">' + I.avatar(p.avatar) + '</div>';
    $('#me-chip').onclick = function () { App.lobbyView('profile'); };
  }
  App.lobbyView = function (v) {
    $$('#lobby-nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
    $$('.view').forEach(function (x) { x.classList.toggle('active', x.id === 'view-' + v); });
    if (v === 'guide') C.renderGuide($('#view-guide'));
    if (v === 'codex') C.renderCodex($('#view-codex'));
    if (v === 'ranks') renderRanks();
    if (v === 'profile') renderProfile();
  };
  function renderRoomList() {
    var el = $('#room-list');
    if (lobbyErr && !Net.ext.lobby) { el.innerHTML = '<div class="empty">Danh sách phòng cần nút <b>lobby</b> trong luật Firebase.<br><small class="muted">Bạn vẫn có thể vào phòng bằng mã 6 ký tự.</small></div>'; return; }
    var q = ($('#room-search').value || '').trim().toLowerCase(), m = $('#room-filter').value;
    var list = lobbyList.filter(function (r) {
      if (m && String(r.mode) !== m) return false;
      if (q && (String(r.name || '').toLowerCase().indexOf(q) < 0 && r.code.toLowerCase().indexOf(q) < 0 && String(r.hostName || '').toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    if (!list.length) { el.innerHTML = '<div class="empty">Chưa có phòng nào đang mở.<br><small class="muted">Hãy tạo phòng mới hoặc luyện tập với Bot.</small></div>'; return; }
    el.innerHTML = list.map(function (r) {
      var pips = ''; for (var i = 0; i < r.mode; i++) pips += '<span class="pip' + (i < (r.count || 0) ? ' on' : '') + '"></span>';
      var o = r.opts || {};
      var full = (r.count || 0) >= r.mode;
      return '<div class="room-row"><div class="mode">' + r.mode + '<small>người</small></div>' +
        '<div><div class="rn">' + esc(r.name || r.code) + '</div><div class="rm">' + esc(r.hostName || '') + ' · <b>' + r.code + '</b> · ' + fmtTurn(r.turnLimitMs) + '/lượt ' +
        (r.status === 'playing' ? '<span class="tag live">Đang đấu</span>' : '<span class="tag open">Chờ</span>') + (o.teamMode ? '<span class="tag">2v2</span>' : '') + (o.ranked ? '<span class="tag">80 vòng</span>' : '') + '</div></div>' +
        '<div class="pips">' + pips + '</div>' +
        '<button class="btn ' + (full || r.status !== 'lobby' ? 'ghost' : 'gold') + '" data-code="' + r.code + '"' + (r.status !== 'lobby' || full ? ' disabled' : '') + '>Vào</button></div>';
    }).join('');
    $$('button[data-code]', el).forEach(function (b) { b.onclick = function () { App.join(b.dataset.code); }; });
  }
  function fmtTurn(ms) { ms = ms || 90000; if (ms >= 3600e3) return Math.round(ms / 3600e3) + ' giờ'; if (ms >= 60e3 && ms % 60e3 === 0) return (ms / 60e3) + ' phút'; return Math.round(ms / 1000) + ' giây'; }
  App.fmtTurn = fmtTurn;
  function appendChat(el, m) {
    if (!m) return;
    var d = document.createElement('div'); d.className = 'm' + (Net.user && m.uid === Net.user.uid ? ' me' : '');
    var tm = typeof m.ts === 'number' ? new Date(m.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
    d.innerHTML = '<span class="muted small">' + tm + '</span> <b>' + esc(m.name) + ':</b> ' + esc(m.text);
    el.appendChild(d); el.scrollTop = el.scrollHeight;
    if (Net.user && m.uid !== Net.user.uid && typeof m.ts === 'number' && Net.B.now() - m.ts < 5000) TT.Sound.play('msg');
  }
  function appendSys(el, text) { var d = document.createElement('div'); d.className = 'm sys'; d.textContent = text; el.appendChild(d); el.scrollTop = el.scrollHeight; }
  App.appendChat = appendChat; App.appendSys = appendSys;

  function checkRejoin() {
    var code; try { code = localStorage.getItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { }
    var bn = $('#rejoin-banner'); bn.classList.add('hidden');
    if (!code) return;
    Net.B.get('rooms/' + code + '/meta').then(function (m) {
      if (!m || m.status === 'finished') { try { localStorage.removeItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { } return; }
      return Net.B.get('rooms/' + code + '/seats').then(function (s) {
        if (!s || !Object.keys(s).some(function (k) { return s[k] === Net.user.uid; })) return;
        bn.innerHTML = '<span>Bạn đang có ' + (m.status === 'playing' ? '<b>trận đấu dang dở</b>' : 'phòng chờ') + ' <b>' + code + '</b>.</span><span><button class="btn ghost small" id="rj-x">Bỏ qua</button> <button class="btn teal" id="rj-go">Vào lại</button></span>';
        bn.classList.remove('hidden');
        $('#rj-go').onclick = function () { App.enterRoom(code); };
        $('#rj-x').onclick = function () { bn.classList.add('hidden'); try { localStorage.removeItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { } };
      });
    }).catch(function () { });
  }

  function renderRanks() {
    var el = $('#view-ranks');
    el.innerHTML = '<div class="panel"><h2>Bảng xếp hạng</h2><div class="muted">Đang tải…</div></div>';
    Net.leaderboard().then(function (list) {
      if (!list) { el.innerHTML = '<div class="panel"><h2>Bảng xếp hạng</h2><p class="muted">Cần nút <b>users</b> (có .indexOn rating) trong luật Firebase.</p></div>'; return; }
      el.innerHTML = '<div class="panel"><h2>Bảng xếp hạng — Top 20</h2><table class="rank-table"><tr><th>#</th><th>Người chơi</th><th>Điểm</th><th>Thắng</th><th>Số trận</th><th>Tỉ lệ</th></tr>' +
        (list.length ? list.map(function (r, i) { return '<tr><td><b>' + (i + 1) + '</b></td><td>' + esc(r.name) + (Net.user && r.uid === Net.user.uid ? ' <span class="tag open">bạn</span>' : '') + '</td><td>' + (r.rating || 1000) + '</td><td>' + (r.wins || 0) + '</td><td>' + (r.games || 0) + '</td><td>' + (r.games ? Math.round(100 * (r.wins || 0) / r.games) + '%' : '—') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="muted">Chưa có dữ liệu</td></tr>') + '</table></div>';
    });
  }
  function renderProfile() {
    var el = $('#view-profile');
    Promise.all([Net.getProfile(), Net.history()]).then(function (r) {
      var p = r[0] || {}, h = r[1] || []; App.profile = p; renderMe();
      var av = (p.avatar || 0) % I.AVATARS.length;
      el.innerHTML = '<div class="panel profile-card"><div class="profile-hero"><div class="avatar">' + I.AVATARS[av] + '</div><h2>' + esc(Net.user.name) + '</h2><div class="muted small">' + (Net.user.guest ? 'Tài khoản khách' : esc(Net.user.email)) + '</div>' +
        '<div class="avatar-pick">' + I.AVATARS.map(function (a, i) { return '<button data-a="' + i + '" class="' + (i === av ? 'active' : '') + '">' + I.avatar(i) + '</button>'; }).join('') + '</div>' +
        '<form id="rename" class="row" style="margin-top:12px"><input name="n" maxlength="20" value="' + esc(Net.user.name) + '"><button class="btn">Đổi tên</button></form>' +
        '<button class="btn ghost wide" id="btn-sound">' + (TT.Sound.on ? I.ui('sound') + ' Âm thanh: Bật' : I.ui('mute') + ' Âm thanh: Tắt') + '</button>' +
        '<button class="btn red wide" id="btn-logout">Đăng xuất</button></div>' +
        '<div><div class="stat-grid"><div class="stat"><b>' + (p.rating || 1000) + '</b><span>Điểm hạng</span></div><div class="stat"><b>' + (p.games || 0) + '</b><span>Số trận</span></div><div class="stat"><b>' + (p.wins || 0) + '</b><span>Thắng</span></div><div class="stat"><b>' + (p.games ? Math.round(100 * (p.wins || 0) / p.games) : 0) + '%</b><span>Tỉ lệ thắng</span></div></div>' +
        '<h3>Lịch sử trận gần đây</h3>' + (h.length ? '<table class="rank-table"><tr><th>Thời gian</th><th>Chế độ</th><th>Tộc</th><th>Kết quả</th><th>Vòng</th></tr>' + h.map(function (x) {
          return '<tr><td>' + (x.at ? new Date(x.at).toLocaleString('vi-VN') : '') + '</td><td>' + (x.mode || '') + ' người</td><td>' + (F[x.faction] ? F[x.faction].name : '') + '</td><td>' + (x.won ? '<span style="color:var(--green)">Thắng</span>' : x.draw ? 'Hòa' : '<span style="color:var(--red)">Thua</span>') + '</td><td>' + (x.rounds || '') + '</td></tr>';
        }).join('') + '</table>' : '<p class="muted">Chưa có trận nào.</p>') + '</div></div>';
      $$('.avatar-pick button', el).forEach(function (b) { b.onclick = function () { Net.updateProfile({ avatar: +b.dataset.a }).then(renderProfile); }; });
      $('#rename').onsubmit = function (e) { e.preventDefault(); var n = new FormData(e.target).get('n').trim(); if (n.length < 2) return App.toast('Tên quá ngắn', 'err'); Net.updateProfile({ name: n.slice(0, 20) }).then(function () { App.toast('Đã đổi tên', 'ok'); renderProfile(); }); };
      $('#btn-logout').onclick = function () { Net.logout(); };
      $('#btn-sound').onclick = function () { TT.Sound.toggle(); renderProfile(); };
    });
  }

  /* ---------- PHÒNG CHỜ ---------- */
  function initRoomUI() {
    $('#btn-leave-room').onclick = function () { App.leaveRoom(); };
    $('#room-code').onclick = function () {
      var c = App.code; try { navigator.clipboard.writeText(c); App.toast('Đã sao chép mã ' + c, 'ok'); } catch (e) { App.toast('Mã phòng: ' + c); }
    };
    $('#room-chat-form').onsubmit = function (e) {
      e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v) return;
      inp.value = ''; Net.sendRoomChat(App.code, v).catch(function () { App.toast('Chat phòng cần nút chat trong luật Firebase', 'err'); });
    };
    $('#btn-ready').onclick = function () {
      var me = myRec(); if (!me) return;
      Net.setMe(App.code, { ready: !me.ready }).catch(function (e) { App.toast(e.message, 'err'); });
    };
    $('#btn-start').onclick = function () { App.hostStart(); };
  }
  function myRec() { return App.room && App.room.players && Net.user ? App.room.players[Net.user.uid] : null; }
  App.cleanupRoom = function () {
    App.unsubs.forEach(function (f) { try { f(); } catch (e) { } }); App.unsubs = [];
    clearInterval(App.hb); App.room = null;
  };
  App.enterRoom = function (code) {
    App.cleanupRoom();
    App.code = code; App.hadSeat = false; App.started = false; App.lastCount = -1;
    try { localStorage.setItem('ttkc.lastRoom.' + Net.user.uid, code); } catch (e) { }
    $('#room-chat').innerHTML = ''; $('#room-name').textContent = 'Phòng'; $('#room-code').textContent = code;
    App.show('room');
    App.unsubs.push(Net.watchRoom(code, onRoom));
    App.unsubs.push(Net.watchRoomChat(code, function (m) { appendChat($('#room-chat'), m); if (TT.Game && TT.Game.onChat) TT.Game.onChat(m); }));
    App.hb = setInterval(function () { Net.heartbeat(code); }, 15000);
    Net.heartbeat(code);
  };
  App.leaveRoom = function (silent) {
    var room = App.room, code = App.code;
    var go = function () {
      Net.leaveRoom(code, room).catch(function () { });
      try { localStorage.removeItem('ttkc.lastRoom.' + Net.user.uid); } catch (e) { }
      App.cleanupRoom(); App.enterLobby();
    };
    if (silent || !room || !room.meta) return go();
    var host = room.meta.hostUid === Net.user.uid;
    if (host && room.meta.status === 'lobby') App.confirm('Rời phòng?', 'Bạn là chủ phòng — phòng sẽ bị giải tán.', 'Giải tán').then(function (ok) { if (ok) go(); });
    else go();
  };

  function onRoom(room) {
    App.room = room;
    var L = room.loaded;
    if (!L.meta || !L.seats) return;
    if (!room.meta) { App.toast('Phòng đã đóng', 'err'); App.cleanupRoom(); App.enterLobby(); return; }
    var uid = Net.user.uid, mySeats = Object.keys(room.seats).filter(function (s) { return room.seats[s] === uid; });
    var me = room.players[uid];
    if (room.meta.status !== 'lobby') {
      if (!App.started && mySeats.length) { App.started = true; TT.Game.start(App.code, room); }
      else if (!mySeats.length && !App.started) { App.toast('Bạn không có ghế trong trận này', 'err'); App.cleanupRoom(); App.enterLobby(); }
      if (TT.Game && TT.Game.onRoom) TT.Game.onRoom(room);
      return;
    }
    if (me && room.seats[me.seat] === uid) App.hadSeat = true;
    if (App.hadSeat && (!me || room.seats[me.seat] !== uid) && L.players === true) {
      App.toast('Bạn đã bị mời ra khỏi phòng', 'err');
      Net.B.remove('rooms/' + App.code + '/players/' + uid).catch(function () { });
      App.cleanupRoom(); App.enterLobby(); return;
    }
    renderRoom(room);
    // chủ phòng cập nhật chỉ mục sảnh
    var cnt = Object.keys(room.seats).length;
    if (room.meta.hostUid === uid && cnt !== App.lastCount) {
      App.lastCount = cnt;
      Net.publishLobby(App.code, { count: cnt }, false);
    }
    if (App.autoStart === App.code && room.meta.hostUid === uid && me && cnt === room.meta.mode) { App.autoStart = null; setTimeout(App.hostStart, 400); }
  }

  function occupants(room) {
    var mode = room.meta.mode, out = {};
    for (var n = 1; n <= 4; n++) {
      var s = String(n), uid = room.seats[s];
      if (n > mode) { out[s] = { kind: 'off' }; continue; }
      if (!uid) { out[s] = { kind: 'empty' }; continue; }
      var p = room.players[uid];
      if (p && p.seat === s) out[s] = { kind: 'human', uid: uid, p: p };
      else if (uid === room.meta.hostUid) out[s] = { kind: 'bot', uid: uid, b: Net.botLoadout(room.meta.seed, s) };
      else out[s] = { kind: 'joining', uid: uid };
    }
    return out;
  }
  App.occupants = occupants;

  function renderRoom(room) {
    var uid = Net.user.uid, meta = room.meta, host = meta.hostUid === uid, me = room.players[uid];
    var opt = Net.decodeSeed(meta.seed), occ = occupants(room);
    var rn; try { rn = localStorage.getItem('ttkc.roomName.' + App.code); } catch (e) { }
    $('#room-name').textContent = rn || ('Phòng ' + meta.mode + ' người');
    $('#room-opts').innerHTML = '<span class="tag">' + meta.mode + ' người</span><span class="tag">' + fmtTurn(meta.turnLimitMs) + '/lượt</span>' + (opt.teamMode ? '<span class="tag">2 đấu 2</span>' : '') + (opt.ranked ? '<span class="tag">80 vòng</span>' : '') + (opt.secondBonus && meta.mode === 2 ? '<span class="tag">Bù +1V</span>' : '') + '<span class="tag">' + esc(meta.ruleVersion) + '</span>';
    var html = '';
    for (var n = 1; n <= 4; n++) {
      var s = String(n), o = occ[s], side = meta.mode === 2 ? [0, 2][n - 1] : n - 1;
      var sideName = meta.mode === 2 && n > 2 ? '' : TT.SEAT_NAMES[side != null ? side : 0];
      if (o.kind === 'off') {
        html += '<div class="seat empty disabled"><div class="slot"><div class="plus"><span>' + I.ui('close', 22) + '</span></div>' + (meta.mode === 3 && n === 4 ? 'Hoang Địa<br><small>cánh trống</small>' : 'Không dùng') + '</div></div>';
        continue;
      }
      if (o.kind === 'empty' || o.kind === 'joining') {
        var tools = '';
        if (o.kind === 'empty') {
          if (me && !me.ready && me.seat !== s) tools += '<button class="btn small" data-act="sit" data-s="' + s + '">Ngồi đây</button>';
          if (host) tools += '<button class="btn small teal" data-act="bot" data-s="' + s + '">+ Bot</button>';
        } else if (host) tools += '<button class="btn small red" data-act="free" data-s="' + s + '">' + I.ui('close', 12) + '</button>';
        html += '<div class="seat empty"><div class="side">' + sideName + '</div><div class="slot"><div class="plus"><span>+</span></div>' + (o.kind === 'joining' ? 'Đang vào…' : 'Ghế trống') + '<div style="display:flex;gap:6px">' + tools + '</div></div></div>';
        continue;
      }
      var f, name, pas, home, ready, isMe = o.uid === uid && o.kind === 'human';
      if (o.kind === 'human') { f = Net.RACE_INV[o.p.race]; name = o.p.name; pas = o.p.passive; home = Net.HOME_INV[o.p.homeTileType]; ready = o.p.ready || o.uid === meta.hostUid; }
      else { f = o.b.faction; name = o.b.name + ' ' + s; pas = o.b.passive; home = o.b.home; ready = true; }
      var fd = F[f], pd = fd.passives.filter(function (x) { return x.id === pas; })[0];
      var stale = o.kind === 'human' && typeof o.p.lastSeen === 'number' && Net.B.now() - o.p.lastSeen > 45000;
      var t2 = '';
      if (host && !isMe) t2 = '<div class="seat-tools"><button class="btn small red" data-act="free" data-s="' + s + '" title="Mời ra">' + I.ui('close', 12) + '</button></div>';
      html += '<div class="seat filled' + (isMe ? ' me' : '') + '" style="--seat-bg: radial-gradient(circle at 50% 30%, ' + TT.hexA(fd.color, .55) + ', transparent 65%), linear-gradient(transparent, ' + TT.hexA(TT.SEAT_COLORS[side], .25) + ')">' +
        (o.uid === meta.hostUid && o.kind === 'human' ? '<div class="host" title="Chủ phòng">' + I.ui('crown', 26) + '</div>' : '') +
        '<div class="side">' + sideName + '</div>' +
        '<div class="art">' + I.crest(f, 150) + '</div>' +
        (opt.teamMode ? '<span class="tag team-tag" style="top:40px">' + (n % 2 ? 'Đội A' : 'Đội B') + '</span>' : '') +
        '<div class="ready ' + (ready ? 'yes' : 'no') + '">' + (o.kind === 'bot' ? 'Bot' : ready ? 'Sẵn sàng' : 'Chưa sẵn') + '</div>' +
        '<div class="info"><div class="fac">' + fd.name + '</div><div class="pname">' + esc(name) + (stale ? ' <small class="muted" title="Mất kết nối">' + I.ui('warn', 14, '#e0a000') + '</small>' : '') + '</div>' +
        '<div class="chips"><span class="chip">' + I.ui('diamond', 10) + ' ' + (pd ? pd.name : '') + '</span><span class="chip">' + I.svg('res' + home, null, 12) + ' Ô nhà: ' + TT.RES_NAME[home] + '</span></div></div>' + t2 + '</div>';
    }
    $('#seats').innerHTML = html;
    $$('#seats [data-act]').forEach(function (b) {
      b.onclick = function () {
        var s = b.dataset.s, a = b.dataset.act;
        var p = a === 'sit' ? Net.changeSeat(App.code, me.seat, s) : a === 'bot' ? Net.addBot(App.code, s) : Net.freeSeat(App.code, s);
        p.catch(function (e) { App.toast(e.message || String(e), 'err'); });
      };
    });
    renderLoadout(room, me, host);
    // nút
    var humans = Object.keys(occ).filter(function (k) { return occ[k].kind === 'human'; });
    var filled = Object.keys(occ).filter(function (k) { return occ[k].kind === 'human' || occ[k].kind === 'bot'; }).length;
    var allReady = humans.every(function (k) { return occ[k].p.ready || occ[k].uid === meta.hostUid; });
    var canStart = host && filled === meta.mode && allReady;
    $('#btn-start').style.display = host ? '' : 'none';
    $('#btn-ready').style.display = host ? 'none' : '';
    $('#btn-start').disabled = !canStart;
    if (me) { $('#btn-ready').textContent = me.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'; $('#btn-ready').className = 'btn big ' + (me.ready ? 'ghost' : 'teal'); }
    $('#room-status').innerHTML = filled < meta.mode ? 'Đang chờ người chơi (' + filled + '/' + meta.mode + ') — gửi mã <b style="color:var(--gold)">' + App.code + '</b> cho bạn bè' + (host ? ' hoặc thêm Bot.' : '.') :
      !allReady ? 'Chờ mọi người bấm Sẵn sàng…' : host ? '<span style="color:#1f8a49">Tất cả đã sẵn sàng — bắt đầu thôi!</span>' : 'Chờ chủ phòng bắt đầu…';
    $('#btn-start').classList.toggle('btn-end-pulse', canStart);
  }

  function renderLoadout(room, me, host) {
    var el = $('#loadout');
    if (!me) { el.innerHTML = '<p class="muted">Đang tải…</p>'; return; }
    var f = Net.RACE_INV[me.race], fd = F[f], home = Net.HOME_INV[me.homeTileType];
    var locked = me.ready && !host;
    var key = f + me.passive + home + locked;
    if (el.dataset.key === key) return; el.dataset.key = key;
    el.innerHTML = '<div class="lo-grid' + (locked ? ' locked' : '') + '"><div>' +
      '<h3>Chọn tộc</h3><div class="fac-pick">' + TT.FACTION_ORDER.map(function (k) { return '<div class="fac-opt' + (k === f ? ' active' : '') + '" data-f="' + k + '">' + I.crest(k, 58) + '<div class="n">' + F[k].short + '</div></div>'; }).join('') + '</div>' +
      '<div class="fac-desc">' + fd.theme + '</div><div class="weak">Điểm yếu — <b>' + fd.weakness.name + '</b>: ' + fd.weakness.text + '</div>' +
      '<h3>Ô nhà <small class="muted">(như phép bổ trợ)</small></h3><div class="home-pick">' + ['V', 'T', 'G'].map(function (r) { return '<div class="home-opt' + (r === home ? ' active' : '') + '" data-h="' + r + '">' + I.svg('res' + r, null, 34) + TT.RES_NAME[r] + '</div>'; }).join('') + '</div>' +
      '</div><div><h3>Nội tại <small class="muted">(bảng ngọc — chọn 1)</small></h3><div class="rune-row">' + fd.passives.map(function (p) { return '<div class="rune' + (p.id === me.passive ? ' active' : '') + '" data-p="' + p.id + '"><div class="rn">' + p.name + '</div><div class="rt">' + p.text + '</div></div>'; }).join('') + '</div>' +
      '<h3>Kích hoạt <small class="muted">(cố định theo tộc)</small></h3><div class="spells">' + fd.actives.map(function (a) { return '<div class="spell"><div class="k">' + a.key + '</div><div><div class="sn">' + a.name + ' <small class="muted">· hồi ' + a.cd + '</small></div><div class="sd">' + a.text + '</div></div></div>'; }).join('') + '</div>' +
      '<p class="muted small" style="margin:0">' + (locked ? I.ui('lock', 12) + ' Đã sẵn sàng — hủy sẵn sàng để đổi lựa chọn.' : 'Mẹo: xem chi tiết quân từng tộc trong mục Bách khoa ở sảnh.') + '</p></div></div>';
    function save(patch) {
      var nf = patch.race ? Net.RACE_INV[patch.race] : f;
      try { localStorage.setItem('ttkc.loadout', JSON.stringify({ faction: nf, passive: patch.passive || me.passive, home: patch.homeTileType ? Net.HOME_INV[patch.homeTileType] : home })); } catch (e) { }
      Net.setMe(App.code, patch).catch(function (e) { App.toast(e.message, 'err'); });
    }
    $$('.fac-opt', el).forEach(function (d) { d.onclick = function () { var k = d.dataset.f; if (k === f) return; save({ race: Net.RACE[k], passive: F[k].passives[0].id }); }; });
    $$('.rune', el).forEach(function (d) { d.onclick = function () { save({ passive: d.dataset.p }); }; });
    $$('.home-opt', el).forEach(function (d) { d.onclick = function () { save({ homeTileType: Net.HOME[d.dataset.h] }); }; });
  }

  App.hostStart = function () {
    var room = App.room; if (!room || room.meta.hostUid !== Net.user.uid) return;
    var setup = Net.buildSetup(room);
    if (setup.players.length !== room.meta.mode) { App.toast('Chưa đủ người', 'err'); return; }
    var st = TT.Engine.init(setup);
    var first = st.players[st.active];
    $('#btn-start').disabled = true;
    Net.startGame(App.code, Net.seatOfSide(room.meta.mode, first.seat)).catch(function (e) { App.toast('Không bắt đầu được: ' + (e.message || e), 'err', 5000); $('#btn-start').disabled = false; });
  };

  document.addEventListener('DOMContentLoaded', App.init);
})(window);
