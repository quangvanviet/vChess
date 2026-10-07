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
      var bs = buttons || [['OK', 'gold', true]], cancel = bs.map(function (b) { return b[2]; }).indexOf(false);
      $('#modal').onclick = function (e) { if (e.target === $('#modal')) { $('#modal').classList.add('hidden'); res(cancel >= 0 ? false : bs[0][2]); } };
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
    if (Net.B.kind === 'firebase') Net.B.onConnected(function (on) { if (!on && App.screen !== 'auth') App.toast('Mất kết nối mạng — đang thử lại…', 'err'); });
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
    $('#btn-create').onclick = function () { App.createRoomPopup(); };
    $('#btn-join-code').onclick = function () { App.joinPopup(); };
    $('#btn-practice').onclick = function () { App.practice(); };
    $('#room-search').oninput = renderRoomList; $('#room-filter').onchange = renderRoomList;
    $('#lobby-chat-form').onsubmit = function (e) {
      e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v) return;
      inp.value = ''; Net.sendLobbyChat(v).catch(function () { App.toast('Kênh thế giới chưa khả dụng', 'err'); });
    };
  }
  /* ---------- chế độ chơi + bong bóng thông tin (i) ---------- */
  App.MODES = [
    { k: 'duel', mode: 2, team: false, n: '1 đấu 1', s: 'Bàn 8×8' },
    { k: 'three', mode: 3, team: false, n: '3 người', s: 'Chữ thập' },
    { k: 'ffa', mode: 4, team: false, n: 'Hỗn chiến', s: '4 người' },
    { k: 'team', mode: 4, team: true, n: '2 đấu 2', s: 'Đồng đội' }
  ];
  App.modeOf = function (mode, team) { return App.MODES.filter(function (m) { return m.mode === mode && m.team === !!team; })[0] || App.MODES[0]; };
  App.INFO = {
    duel: ['1 đấu 1', 'Bàn 8×8, hai người đối mặt. Hạ Vua đối thủ để thắng. Chế độ cân bằng nhất, hợp để luyện tập và đấu xếp hạng.'],
    three: ['3 người', 'Bàn chữ thập 14×14, một cánh bỏ trống (Hoang Địa). Người ngồi đối diện cánh trống chịu hai mặt nên được +2 vàng khởi đầu. Người cuối cùng còn Vua thắng.'],
    ffa: ['Hỗn chiến 4 người', 'Bàn chữ thập 14×14, mỗi người một cánh: hai hàng xóm hai bên và một đối thủ đối diện. Hạ Vua ai thì nhận 3 tài nguyên thưởng; quân của người thua biến mất khỏi bàn. Người cuối cùng còn Vua thắng.'],
    team: ['2 đấu 2', 'Bốn người chia hai đội, đồng đội ngồi đối diện nhau. Đồng đội không đánh nhau, đi xuyên qua quân của nhau và không bị Thu Thuế/Hối Lộ. Hạ cả hai Vua đội bạn để thắng.'],
    turn: ['Thời gian mỗi lượt', 'Hết giờ mà chưa kết thúc lượt thì lượt đó bị bỏ qua. Hết giờ 3 lần sẽ bị loại khỏi trận. Chọn 10 phút hoặc 24 giờ để chơi thong thả.'],
    ranked: ['Giới hạn 80 vòng', 'Hết vòng 80 mà chưa phân thắng bại thì tính điểm: tổng giá trị quân trên bàn cộng tài nguyên còn lại. Ai cao nhất thắng, bằng điểm thì hòa.'],
    second: ['Bù người đi sau', 'Chỉ áp dụng cho 1 đấu 1: người đi sau nhận thêm +1 vàng khởi đầu để bù lợi thế đi trước.'],
    priv: ['Phòng riêng', 'Phòng không hiện ở danh sách sảnh. Bạn bè vào bằng mã 6 ký tự.'],
    easy: ['Bot Dễ', 'Hay đi chưa tối ưu, đôi khi bỏ lỡ nước đánh. Hợp để làm quen luật.'],
    medium: ['Bot Trung bình', 'Mua quân hợp lý, biết giữ an toàn cho Vua và dùng kỹ năng tộc.'],
    hard: ['Bot Khó', 'Tính trước từng nước bằng chính lõi luật, mua quân khắc chế đội hình của bạn và săn Vua có tính toán.']
  };
  App.infoBtn = function (key) { return '<span class="info-i" role="button" tabindex="0" data-info="' + key + '" title="Xem luật">i</span>'; };
  function closeInfo() { var p = $('#info-pop'); if (p) p.remove(); }
  App.showInfo = function (anchor, key) {
    var inf = App.INFO[key]; if (!inf) return;
    var had = $('#info-pop'); var same = had && had.dataset.k === key; closeInfo(); if (same) return;
    var p = document.createElement('div'); p.id = 'info-pop'; p.className = 'info-pop'; p.dataset.k = key;
    p.innerHTML = '<b>' + inf[0] + '</b><p>' + inf[1] + '</p>';
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight, vw = innerWidth, vh = innerHeight;
    var x = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2)), y = r.bottom + 8;
    if (y + h > vh - 8) { y = r.top - h - 8; p.classList.add('up'); }
    p.style.left = x + 'px'; p.style.top = Math.max(8, y) + 'px';
    p.style.setProperty('--ax', Math.max(12, Math.min(w - 12, r.left + r.width / 2 - x)) + 'px');
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.info-i');
    if (b) { e.preventDefault(); e.stopPropagation(); App.showInfo(b, b.dataset.info); return; }
    if (!e.target.closest('#info-pop')) closeInfo();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeInfo(); });
  addEventListener('resize', closeInfo);
  function segHtml(name, opts, cur) { return '<div class="seg" data-name="' + name + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'active' : '') + '">' + o[1] + (o[2] ? App.infoBtn(o[2]) : '') + '</button>'; }).join('') + '</div>'; }
  function wireSeg(pick, cb) {
    $$('#modal-box .seg').forEach(function (sg) {
      $$('button', sg).forEach(function (b) {
        b.onclick = function () { $$('button', sg).forEach(function (x) { x.classList.toggle('active', x === b); }); var v = b.dataset.v; pick[sg.dataset.name] = /^\d+$/.test(v) ? +v : v; if (cb) cb(); };
      });
    });
  }
  App.createRoomPopup = function () {
    var pick = { m: 'duel', turn: 90000, ranked: false, second: true, priv: false, name: '' };
    try { pick = Object.assign(pick, JSON.parse(localStorage.getItem('ttkc.create') || '{}')); } catch (e) { }
    var tog = function (k, label) { return '<div class="opt-row"><label class="switch"><input type="checkbox" data-k="' + k + '"' + (pick[k] ? ' checked' : '') + '><span></span>' + label + '</label>' + App.infoBtn(k) + '</div>'; };
    App.modal('<h2>' + I.ui('plus', 18) + ' Tạo phòng</h2>' +
      '<label class="fl">Tên phòng</label><input id="cr-name" maxlength="28" placeholder="Phòng của ' + esc(Net.user.name) + '" value="' + esc(pick.name || '') + '">' +
      '<label class="fl">Chế độ</label><div class="mode-grid seg" data-name="m">' + App.MODES.map(function (m) { return '<button type="button" data-v="' + m.k + '" class="mode-card' + (pick.m === m.k ? ' active' : '') + '"><b>' + m.n + '</b><small>' + m.s + '</small>' + App.infoBtn(m.k) + '</button>'; }).join('') + '</div>' +
      '<label class="fl">Thời gian lượt ' + App.infoBtn('turn') + '</label>' + segHtml('turn', [[60000, '60s'], [90000, '90s'], [180000, '3 phút'], [600000, '10 phút'], [86400000, '24 giờ']], pick.turn) +
      '<div class="opt-list">' + tog('ranked', 'Giới hạn 80 vòng') + '<div id="cr-second">' + tog('second', 'Bù người đi sau') + '</div>' + tog('priv', 'Phòng riêng') + '</div>',
      [['Hủy', 'ghost', false], ['Tạo phòng', 'gold', true]]).then(function (ok) {
      if (!ok) return;
      pick.name = ($('#cr-name') || {}).value || pick.name;
      try { localStorage.setItem('ttkc.create', JSON.stringify(pick)); } catch (e) { }
      var md = App.MODES.filter(function (m) { return m.k === pick.m; })[0] || App.MODES[0];
      var o = { name: String(pick.name || '').trim() || ('Phòng của ' + Net.user.name), mode: md.mode, turnLimitMs: +pick.turn, teamMode: md.team, ranked: !!pick.ranked, secondBonus: md.mode === 2 && !!pick.second, private: !!pick.priv };
      var btn = $('#btn-create'); busy(btn, true);
      Net.createRoom(o).then(function (code) { try { localStorage.setItem('ttkc.roomName.' + code, o.name); } catch (x) { } App.enterRoom(code); })
        .catch(function (err) { App.toast('Không tạo được phòng: ' + (err.message || err), 'err', 5000); }).then(function () { busy(btn, false); });
    });
    var upd = function () { $('#cr-second').classList.toggle('hidden', pick.m !== 'duel'); };
    wireSeg(pick, upd); upd();
    $$('#modal-box .switch input').forEach(function (c) { c.onchange = function () { pick[c.dataset.k] = c.checked; }; });
    $('#cr-name').oninput = function () { pick.name = this.value; };
    $('#cr-name').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#modal-box .btns .gold').click(); } };
  };
  App.joinPopup = function () {
    App.modal('<h2>' + I.ui('lock', 18) + ' Vào bằng mã</h2><input id="jn-code" class="code-input" maxlength="6" placeholder="MÃ PHÒNG" autocomplete="off">',
      [['Hủy', 'ghost', false], ['Vào phòng', 'gold', true]]).then(function (ok) { if (ok) App.join(App._jcode); });
    var inp = $('#jn-code'); App._jcode = '';
    inp.oninput = function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); App._jcode = inp.value; };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#modal-box .btns .gold').click(); } };
    setTimeout(function () { inp.focus(); }, 50);
  };
  App.join = function (code) {
    code = String(code || '').trim().toUpperCase();
    if (code.length !== 6) { App.toast('Mã phòng gồm 6 ký tự', 'err'); return; }
    Net.joinRoom(code).then(function (r) { App.enterRoom(r.code); }).catch(function (err) { App.toast(err.message || String(err), 'err', 4000); });
  };
  App.LV = [['easy', 'Dễ'], ['medium', 'Trung bình'], ['hard', 'Khó']];
  App.practice = function () {
    var pick = { n: 1, lv: 'medium' };
    try { pick = Object.assign(pick, JSON.parse(localStorage.getItem('ttkc.practice') || '{}')); } catch (e) { }
    App.modal('<h2>' + I.ui('swords', 18) + ' Đấu với Bot</h2>' +
      '<label class="fl">Số đối thủ</label>' + segHtml('n', [[1, '1 bot', 'duel'], [2, '2 bot', 'three'], [3, '3 bot', 'ffa']], pick.n) +
      '<label class="fl">Độ khó</label>' + segHtml('lv', App.LV.map(function (l) { return [l[0], l[1], l[0]]; }), pick.lv) +
      '', [['Hủy', 'ghost', false], ['Bắt đầu', 'gold', true]]).then(function (ok) {
      if (!ok) return;
      try { localStorage.setItem('ttkc.practice', JSON.stringify(pick)); } catch (e) { }
      var btn = $('#btn-practice'); busy(btn, true);
      var mode = pick.n + 1;
      Net.createRoom({ name: 'Đấu Bot (' + TT.Bot.levelName(pick.lv) + ')', mode: mode, turnLimitMs: 600000, secondBonus: true, private: true })
        .then(function (code) {
          var seats = []; for (var s = 2; s <= mode; s++) seats.push(String(s));
          return seats.reduce(function (pr, s) { return pr.then(function () { return Net.addBot(code, s); }).then(function () { return Net.setBotLevel(code, s, pick.lv); }); }, Promise.resolve())
            .then(function () { App.autoStart = code; App.enterRoom(code); });
        })
        .catch(function (err) { App.toast('Không tạo được phòng luyện tập: ' + (err.message || err), 'err', 5000); })
        .then(function () { busy(btn, false); });
    });
    wireSeg(pick);
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
    if (lobbyErr && !Net.ext.lobby) { el.innerHTML = '<div class="empty">Chưa tải được danh sách phòng.<br><small class="muted">Bạn vẫn có thể vào phòng bằng mã 6 ký tự.</small></div>'; return; }
    var q = ($('#room-search').value || '').trim().toLowerCase(), m = $('#room-filter').value;
    var list = lobbyList.filter(function (r) {
      var tm = !!(r.opts || {}).teamMode;
      if (m === 'team' ? !tm : (m && (String(r.mode) !== m || tm))) return false;
      if (q && (String(r.name || '').toLowerCase().indexOf(q) < 0 && r.code.toLowerCase().indexOf(q) < 0 && String(r.hostName || '').toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    if (!list.length) { el.innerHTML = '<div class="empty">Chưa có phòng nào đang mở</div>'; return; }
    el.innerHTML = list.map(function (r) {
      var pips = ''; for (var i = 0; i < r.mode; i++) pips += '<span class="pip' + (i < (r.count || 0) ? ' on' : '') + '"></span>';
      var o = r.opts || {};
      var full = (r.count || 0) >= r.mode;
      var md = App.modeOf(r.mode, o.teamMode);
      return '<div class="room-row"><div class="mode">' + r.mode + '<small>người</small></div>' +
        '<div><div class="rn">' + esc(r.name || r.code) + '</div><div class="rm">' + esc(r.hostName || '') + ' · <b>' + r.code + '</b> · ' + fmtTurn(r.turnLimitMs) + '/lượt ' +
        (r.status === 'playing' ? '<span class="tag live">Đang đấu</span>' : '<span class="tag open">Chờ</span>') + '<span class="tag">' + md.n + App.infoBtn(md.k) + '</span>' + (o.ranked ? '<span class="tag">80 vòng</span>' : '') + '</div></div>' +
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
      if (!list) { el.innerHTML = '<div class="panel"><h2>Bảng xếp hạng</h2><p class="muted">Bảng xếp hạng chưa khả dụng.</p></div>'; return; }
      el.innerHTML = '<div class="panel"><h2>Bảng xếp hạng — Top 20</h2><table class="rank-table"><tr><th>#</th><th>Người chơi</th><th>Điểm</th><th>Thắng</th><th>Số trận</th><th>Tỉ lệ</th></tr>' +
        (list.length ? list.map(function (r, i) { return '<tr><td><b>' + (i + 1) + '</b></td><td>' + esc(r.name) + (Net.user && r.uid === Net.user.uid ? ' <span class="tag open">bạn</span>' : '') + '</td><td>' + (r.rating || 1000) + '</td><td>' + (r.wins || 0) + '</td><td>' + (r.games || 0) + '</td><td>' + (r.games ? Math.round(100 * (r.wins || 0) / r.games) + '%' : '—') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="muted">Chưa có dữ liệu</td></tr>') + '</table></div>';
    });
  }
  function renderProfile() {
    var el = $('#view-profile');
    Promise.all([Net.getProfile(), Net.history()]).then(function (r) {
      var p = r[0] || {}, h = r[1] || []; App.profile = p; renderMe();
      var av = (p.avatar || 0) % I.AVATARS.length;
      el.innerHTML = '<div class="panel profile-card"><div class="profile-hero"><div class="avatar">' + I.avatar(av) + '</div><h2>' + esc(Net.user.name) + '</h2><div class="muted small">' + (Net.user.guest ? 'Tài khoản khách' : esc(Net.user.email)) + '</div>' +
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
      inp.value = ''; Net.sendRoomChat(App.code, v).catch(function () { App.toast('Chat chưa khả dụng', 'err'); });
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
    App.remoteBotLv = {};
    App.unsubs.push(Net.B.on('lobby/' + code + '/bots', function (v) { App.remoteBotLv = v || {}; if (App.room) renderRoom(App.room); if (TT.Game && TT.Game.onBotLv) TT.Game.onBotLv(App.remoteBotLv); }));
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
    var rmd = App.modeOf(meta.mode, opt.teamMode);
    $('#room-opts').innerHTML = '<span class="tag">' + rmd.n + App.infoBtn(rmd.k) + '</span><span class="tag">' + fmtTurn(meta.turnLimitMs) + '/lượt' + App.infoBtn('turn') + '</span>' + (opt.ranked ? '<span class="tag">80 vòng' + App.infoBtn('ranked') + '</span>' : '') + (opt.secondBonus && meta.mode === 2 ? '<span class="tag">Bù +1V' + App.infoBtn('second') + '</span>' : '') + '<span class="tag">' + esc(meta.ruleVersion) + '</span>';
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
        '<div class="ready ' + (ready ? 'yes' : 'no') + '">' + (o.kind === 'bot' ? 'Bot · ' + TT.Bot.levelName(App.botLv(s)) : ready ? 'Sẵn sàng' : 'Chưa sẵn') + '</div>' +
        (o.kind === 'bot' && host ? '<div class="bot-lv">' + App.LV.map(function (l) { return '<button data-lv="' + l[0] + '" data-s="' + s + '" class="' + (App.botLv(s) === l[0] ? 'active' : '') + '">' + l[1] + '</button>'; }).join('') + '</div>' : '') +
        '<div class="info"><div class="fac">' + fd.name + '</div><div class="pname">' + esc(name) + (stale ? ' <small class="muted" title="Mất kết nối">' + I.ui('warn', 14, '#e0a000') + '</small>' : '') + '</div>' +
        '<div class="chips"><span class="chip">' + I.ui('diamond', 10) + ' ' + (pd ? pd.name : '') + '</span><span class="chip">' + I.svg('res' + home, null, 12) + ' Ô nhà: ' + TT.RES_NAME[home] + '</span></div></div>' + t2 + '</div>';
    }
    $('#seats').innerHTML = html;
    $$('#seats [data-act]').forEach(function (b) {
      b.onclick = function () {
        var s = b.dataset.s, a = b.dataset.act;
        var p = a === 'sit' ? Net.changeSeat(App.code, me.seat, s) : a === 'bot' ? Net.addBot(App.code, s).then(function () { return Net.setBotLevel(App.code, s, App.botLv(s)); }) : Net.freeSeat(App.code, s);
        p.catch(function (e) { App.toast(e.message || String(e), 'err'); });
      };
    });
    $$('#seats .bot-lv button').forEach(function (b) { b.onclick = function () { Net.setBotLevel(App.code, b.dataset.s, b.dataset.lv).then(function () { renderRoom(App.room); }); renderRoom(App.room); }; });
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
    $('#room-status').innerHTML = filled < meta.mode ? 'Đang chờ người chơi ' + filled + '/' + meta.mode + ' · mã <b>' + App.code + '</b>'  :
      !allReady ? 'Chờ mọi người sẵn sàng' : host ? '<span style="color:#1f8a49">Đã đủ người</span>' : 'Chờ chủ phòng bắt đầu';
    $('#btn-start').classList.toggle('btn-end-pulse', canStart);
  }

  App.botLv = function (seat) { var loc = Net.botLevels(App.code)[seat]; return loc || (App.remoteBotLv || {})[seat] || 'medium'; };
  function renderLoadout(room, me, host) {
    var el = $('#loadout');
    if (!me) { el.innerHTML = '<p class="muted">Đang tải…</p>'; return; }
    var f = Net.RACE_INV[me.race], fd = F[f], home = Net.HOME_INV[me.homeTileType];
    var locked = me.ready && !host;
    var key = f + me.passive + home + locked;
    if (el.dataset.key === key) return; el.dataset.key = key;
    el.innerHTML = '<div class="lo-grid' + (locked ? ' locked' : '') + '"><div>' +
      '<h3>Chọn tộc</h3><div class="fac-pick">' + TT.FACTION_ORDER.map(function (k) { return '<div class="fac-opt' + (k === f ? ' active' : '') + '" data-f="' + k + '">' + I.crest(k, 58) + '<div class="n">' + F[k].short + '</div></div>'; }).join('') + '</div>' +
      '<div class="weak">Điểm yếu — <b>' + fd.weakness.name + '</b>: ' + fd.weakness.text + '</div>' +
      '<h3>Ô nhà</h3><div class="home-pick">' + ['V', 'T', 'G'].map(function (r) { return '<div class="home-opt' + (r === home ? ' active' : '') + '" data-h="' + r + '">' + I.svg('res' + r, null, 34) + TT.RES_NAME[r] + '</div>'; }).join('') + '</div>' +
      '</div><div><h3>Nội tại</h3><div class="rune-row">' + fd.passives.map(function (p) { return '<div class="rune' + (p.id === me.passive ? ' active' : '') + '" data-p="' + p.id + '"><div class="rn">' + p.name + '</div><div class="rt">' + p.text + '</div></div>'; }).join('') + '</div>' +
      '<h3>Kích hoạt</h3><div class="spells">' + fd.actives.map(function (a) { return '<div class="spell"><div class="k">' + a.key + '</div><div><div class="sn">' + a.name + ' <small class="muted">· hồi ' + a.cd + '</small></div><div class="sd">' + a.text + '</div></div></div>'; }).join('') + '</div>' +
      (locked ? '<p class="muted small" style="margin:0">' + I.ui('lock', 12) + ' Đã khóa lựa chọn</p>' : '') + '</div></div>';
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
