/* Ứng dụng: màn đăng nhập, sảnh, phòng chờ. */
(function (G) {
  'use strict';
  var TT = G.TT, Net = TT.Net, I = TT.Icons, C = TT.Content, F = TT.FACTIONS;
  var App = TT.App = { room: null, code: null, unsubs: [], profile: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  App.$ = $; App.$$ = $$;

  /* ---------- điện thoại: chỉ chơi ngang, chặn bôi đen / menu giữ ---------- */
  (function () {
    var touch = ('ontouchstart' in G) || (navigator.maxTouchPoints > 0), coarse = G.matchMedia && G.matchMedia('(pointer: coarse)').matches;
    if (!(touch && coarse)) return;
    document.documentElement.classList.add('is-touch');
    var hint = document.getElementById('rotate-hint');
    function fs() { var d = document.documentElement; try { var r = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen(); if (r && r.catch) r.catch(function () { }); } catch (e) { } }
    function lock() { try { var o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(function () { }); } catch (e) { } }
    function chk() { var portrait = G.innerHeight > G.innerWidth * 1.05; document.documentElement.classList.toggle('portrait', portrait); if (hint) hint.classList.toggle('on', portrait); }
    G.addEventListener('resize', chk); G.addEventListener('orientationchange', function () { setTimeout(chk, 120); }); chk(); lock();
    var tried = false;
    document.addEventListener('pointerdown', function () { if (tried) return; tried = true; fs(); setTimeout(lock, 250); }, { once: false, passive: true });
    if (hint) hint.querySelector('#rh-go').onclick = function () { fs(); setTimeout(lock, 250); };
    document.addEventListener('contextmenu', function (e) { if (!/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) e.preventDefault(); });
    document.addEventListener('selectstart', function (e) { if (!/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) e.preventDefault(); });
    document.addEventListener('dragstart', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  })();
  var esc = App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- biểu tượng bổ sung (SVG cùng phong cách với TT.Icons.ui) ---------- */
  var EXTRA_IC = {
    search: '<circle cx="27" cy="27" r="16" fill="none" stroke="currentColor" stroke-width="7"/><path d="M39 39 54 54" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    gear: '<path d="M27 6h10l2 8 6 3 7-4 7 7-4 7 3 6 8 2v10l-8 2-3 6 4 7-7 7-7-4-6 3-2 8H27l-2-8-6-3-7 4-7-7 4-7-3-6-8-2V27l8-2 3-6-4-7 7-7 7 4 6-3Z" transform="translate(-4 -4) scale(.88) translate(4 4)" fill="currentColor"/><circle cx="32" cy="32" r="9" fill="#fff"/>',
    book: '<path d="M8 10h20a4 4 0 0 1 4 4v40a4 4 0 0 0-4-4H8ZM56 10H36a4 4 0 0 0-4 4v40a4 4 0 0 1 4-4h20Z" fill="currentColor"/>',
    copy: '<rect x="20" y="20" width="34" height="38" rx="6" fill="currentColor"/><path d="M44 12H16a6 6 0 0 0-6 6v30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    user: '<circle cx="32" cy="20" r="12" fill="currentColor"/><path d="M8 58c0-14 10-22 24-22s24 8 24 22Z" fill="currentColor"/>',
    logout: '<path d="M26 8H12v48h14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 32h30M44 18l14 14-14 14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="6"/><path d="M32 18v15l10 6" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    users: '<circle cx="22" cy="20" r="10" fill="currentColor"/><path d="M2 56c0-13 8-20 20-20s20 7 20 20Z" fill="currentColor"/><circle cx="46" cy="22" r="8" fill="currentColor" opacity=".7"/><path d="M42 38c12 0 20 6 20 18H48c0-8-2-14-6-18Z" fill="currentColor" opacity=".7"/>'
  };
  (function () {
    var base = I.ui;
    I.ui = function (name, size, color) {
      if (!EXTRA_IC[name]) return base.apply(I, arguments);
      return '<svg class="ui-ic" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + (size || 16) + '" height="' + (size || 16) + '"' + (color ? ' style="color:' + color + '"' : '') + ' aria-hidden="true">' + EXTRA_IC[name] + '</svg>';
    };
  })();

  /* ---------- tiện ích giao diện ---------- */
  App.show = function (id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'screen-' + id); });
    App.screen = id;
    if (App.showcase) App.showcase.pausedShow = id !== 'auth';
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
  function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { if (btn.dataset.t == null) btn.dataset.t = btn.innerHTML; btn.classList.add('is-busy'); } else { btn.classList.remove('is-busy'); if (btn.dataset.t != null) { btn.innerHTML = btn.dataset.t; delete btn.dataset.t; } } }

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
    $$('#lobby-nav button[data-view]').forEach(function (b) { b.onclick = function () { App.lobbyView(b.dataset.view); }; });
    $('#btn-lobby-settings').onclick = function () { App.lobbySettings(); };
    $('#lb-sheet-x').onclick = function () { App.lobbyView('play'); };
    $('#lb-sheet').onclick = function (e) { if (e.target === $('#lb-sheet')) App.lobbyView('play'); };
    $('#btn-create').onclick = function () { App.createRoomPopup(); };
    $('#btn-join-code').onclick = function () { App.joinPopup(); };
    $('#btn-practice').onclick = function () { App.practice(); };
    $('#room-search').oninput = renderRoomList; $('#room-filter').onchange = renderRoomList;
    $('#room-filter-btn').onclick = function () {
      var bar = $('#room-filter-bar'), open = bar.classList.toggle('hidden');
      $('#room-filter-btn').classList.toggle('on', !open);
      if (!open) setTimeout(function () { $('#room-search').focus(); }, 30);
    };
    wireChatPop('lobby');
    $('#lobby-chat-form').onsubmit = function (e) {
      e.preventDefault(); var inp = $('input', e.target), v = inp.value.trim(); if (!v) return;
      inp.value = ''; Net.sendLobbyChat(v).catch(function () { App.toast('Kênh thế giới chưa khả dụng', 'err'); });
    };
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || $('#modal') && !$('#modal').classList.contains('hidden')) return;
      if (App.screen === 'lobby' && !$('#lb-sheet').classList.contains('hidden')) App.lobbyView('play');
    });
  }
  /* bong bóng chat có thể thu gọn (sảnh + phòng chờ) */
  var unread = { lobby: 0, room: 0 };
  function wireChatPop(k) {
    var btn = $('#' + k + '-chat-btn'), pop = $('#' + k + '-chat-pop');
    function toggle(on) {
      pop.classList.toggle('hidden', !on); btn.classList.toggle('on', on);
      if (on) { unread[k] = 0; setBadge(k); var lg = $('.chat-log', pop); lg.scrollTop = lg.scrollHeight; setTimeout(function () { $('input', pop).focus(); }, 30); }
    }
    btn.onclick = function () { toggle(pop.classList.contains('hidden')); };
    $('#' + k + '-chat-x').onclick = function () { toggle(false); };
    App['closeChat_' + k] = function () { toggle(false); };
  }
  function setBadge(k) { var b = $('#' + k + '-chat-badge'); b.textContent = unread[k] > 9 ? '9+' : unread[k]; b.classList.toggle('hidden', !unread[k]); }
  function bumpUnread(k, m) {
    if (!Net.user || m.uid === Net.user.uid || !$('#' + k + '-chat-pop').classList.contains('hidden')) return;
    if (typeof m.ts === 'number' && Net.B.now() - m.ts > 5000) return;
    unread[k]++; setBadge(k);
  }
  /* ---------- chế độ chơi + bong bóng thông tin (i) ---------- */
  App.MODES = [
    { k: 'duel', mode: 2, team: false, n: '1 đấu 1', s: 'Bản đồ 40×60' },
    { k: 'three', mode: 3, team: false, n: '3 người', s: 'Bản đồ 68×68' },
    { k: 'ffa', mode: 4, team: false, n: 'Hỗn chiến', s: '4 người' },
    { k: 'team', mode: 4, team: true, n: '2 đấu 2', s: 'Đồng đội' }
  ];
  App.modeOf = function (mode, team) { return App.MODES.filter(function (m) { return m.mode === mode && m.team === !!team; })[0] || App.MODES[0]; };
  App.INFO = {
    duel: ['1 đấu 1', 'Hai đạo quân trên bản đồ 40×60 ô. Mỗi ngày: chuẩn bị rồi giao tranh tự động. Thắng ngày +15 điểm, thua +4, cộng điểm hạ gục. Sau 10 ngày ai nhiều điểm hơn thắng.'],
    three: ['3 người', 'Ba đạo quân cùng một chiến trường 68×68 ô (một cánh bỏ trống). Thứ hạng mỗi ngày theo thứ tự bị diệt: 18 / 9 / 3 điểm, cộng điểm hạ gục. Sau 10 ngày ai nhiều điểm nhất thắng.'],
    ffa: ['Hỗn chiến 4 người', 'Bốn đạo quân cùng lao vào chiến trường 68×68 ô. Điểm hạng mỗi ngày 20 / 12 / 6 / 2, cộng điểm hạ gục; ngày 10 điểm hạng ×1.5. Sau 10 ngày ai nhiều điểm nhất thắng.'],
    team: ['2 đấu 2', 'Bốn người chia hai đội, đồng đội ngồi đối diện. Đồng đội không đánh nhau. Đội còn quân cuối cùng thắng ngày: mỗi người đội thắng +15, đội thua +4. Đội có tổng điểm cao hơn sau 10 ngày thắng.'],
    turn: ['Thời gian chuẩn bị', 'Thời gian mỗi ngày để mua quân, xếp đội hình, gắn trang bị, chọn Lõi và cắm cờ. Ngày 1 được cộng thêm 45 giây. Mọi người bấm Sẵn sàng thì vào trận sớm.'],
    lockmap: ['Khóa bản đồ', 'Bật: mọi ngày đều đánh trên Bình Nguyên Giao Phong (trừ ngày Chung Kết). Tắt (mặc định): mỗi ngày một bản đồ có địa hình khác nhau.'],
    priv: ['Phòng riêng', 'Phòng không hiện ở danh sách sảnh. Bạn bè vào bằng mã 6 ký tự.'],
    easy: ['Bot Dễ', 'Mua quân lộn xộn, ít trang bị, xếp đội hình kém, lên Đời chậm. Hợp để làm quen luật.'],
    medium: ['Bot Trung bình', 'Mua quân cân bằng tiền tuyến – hậu phương, gắn trang bị, lên Đời theo lịch, cắm cờ đánh vòng sườn.'],
    hard: ['Bot Khó', 'Thử nhiều phương án đội hình bằng chính mô phỏng giao tranh với đội hình đối thủ, ưu tiên trang bị hào quang, lên Đời sớm.']
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
    var pick = { m: 'duel', turn: 90000, lockmap: false, priv: false, name: '' };
    try { pick = Object.assign(pick, JSON.parse(localStorage.getItem('ttkc.create2') || '{}')); } catch (e) { }
    if ([30000, 60000, 90000, 120000, 180000].indexOf(+pick.turn) < 0) pick.turn = 90000;
    var tog = function (k, label) { return '<div class="opt-row"><label class="switch"><input type="checkbox" data-k="' + k + '"' + (pick[k] ? ' checked' : '') + '><span></span>' + label + '</label>' + App.infoBtn(k) + '</div>'; };
    App.modal('<h2>' + I.ui('plus', 18) + ' Tạo phòng</h2>' +
      '<label class="fl">Tên phòng</label><input id="cr-name" maxlength="28" placeholder="Phòng của ' + esc(Net.user.name) + '" value="' + esc(pick.name || '') + '">' +
      '<label class="fl">Chế độ</label><div class="mode-grid seg" data-name="m">' + App.MODES.map(function (m) { return '<button type="button" data-v="' + m.k + '" class="mode-card' + (pick.m === m.k ? ' active' : '') + '"><b>' + m.n + '</b><small>' + m.s + '</small>' + App.infoBtn(m.k) + '</button>'; }).join('') + '</div>' +
      '<label class="fl">Thời gian chuẩn bị ' + App.infoBtn('turn') + '</label>' + segHtml('turn', [[30000, '30s'], [60000, '60s'], [90000, '90s'], [120000, '2 phút'], [180000, '3 phút']], pick.turn) +
      '<div class="opt-list">' + tog('lockmap', 'Khóa bản đồ') + tog('priv', 'Phòng riêng') + '</div>',
      [['Hủy', 'ghost', false], ['Tạo phòng', 'gold', true]]).then(function (ok) {
      if (!ok) return;
      pick.name = ($('#cr-name') || {}).value || pick.name;
      try { localStorage.setItem('ttkc.create2', JSON.stringify(pick)); } catch (e) { }
      var md = App.MODES.filter(function (m) { return m.k === pick.m; })[0] || App.MODES[0];
      var o = { name: String(pick.name || '').trim() || ('Phòng của ' + Net.user.name), mode: md.mode, turnLimitMs: +pick.turn, teamMode: md.team, lockMap: !!pick.lockmap, private: !!pick.priv };
      var btn = $('#btn-create'); busy(btn, true);
      Net.createRoom(o).then(function (code) { try { localStorage.setItem('ttkc.roomName.' + code, o.name); localStorage.setItem('ttkc.roomPriv.' + code, o.private ? '1' : '0'); } catch (x) { } App.enterRoom(code); })
        .catch(function (err) { App.toast('Không tạo được phòng: ' + (err.message || err), 'err', 5000); }).then(function () { busy(btn, false); });
    });
    wireSeg(pick);
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
    var pick = { n: 1, lv: 'medium', turn: 90000 };
    try { pick = Object.assign(pick, JSON.parse(localStorage.getItem('ttkc.practice') || '{}')); } catch (e) { }
    if ([60000, 90000, 180000].indexOf(+pick.turn) < 0) pick.turn = 90000;
    App.modal('<h2>' + I.ui('swords', 18) + ' Đấu với Bot</h2>' +
      '<label class="fl">Số đối thủ</label>' + segHtml('n', [[1, '1 bot', 'duel'], [2, '2 bot', 'three'], [3, '3 bot', 'ffa']], pick.n) +
      '<label class="fl">Độ khó</label>' + segHtml('lv', App.LV.map(function (l) { return [l[0], l[1], l[0]]; }), pick.lv) +
      '<label class="fl">Thời gian chuẩn bị ' + App.infoBtn('turn') + '</label>' + segHtml('turn', [[60000, '60s'], [90000, '90s'], [180000, '3 phút']], pick.turn), [['Hủy', 'ghost', false], ['Bắt đầu', 'gold', true]]).then(function (ok) {
      if (!ok) return;
      try { localStorage.setItem('ttkc.practice', JSON.stringify(pick)); } catch (e) { }
      var btn = $('#btn-practice'); busy(btn, true);
      var mode = pick.n + 1;
      Net.createRoom({ name: 'Đấu Bot (' + TT.Bot.levelName(pick.lv) + ')', mode: mode, turnLimitMs: +pick.turn, private: true })
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
      Net.watchLobbyChat(function (m) { appendChat($('#lobby-chat'), m); bumpUnread('lobby', m); });
      Net.watchOnline(function (n) { $('#online-count').textContent = n == null ? '' : n + ' online'; $('#online-pill').classList.toggle('hidden', n == null); });
    }
    checkRejoin();
  };
  function renderMe() {
    var u = Net.user; if (!u) return;
    var p = App.profile || {};
    $('#me-chip').innerHTML = '<div class="me-tx"><div class="nm">' + esc(u.name) + '</div><div class="sub">' + (u.guest ? 'Chơi thử' : 'Hạng ' + (p.rating || 1000)) + ' · ' + (p.wins || 0) + ' thắng</div></div><div class="avatar">' + I.avatar(p.avatar) + '</div>';
    $('#me-chip').onclick = function () { App.lobbyView('profile'); };
  }
  var SHEET_TITLES = { guide: 'Hướng dẫn', codex: 'Bách khoa', ranks: 'Bảng xếp hạng', profile: 'Hồ sơ' };
  App.lobbyView = function (v) {
    var sheet = v !== 'play' && SHEET_TITLES[v];
    $$('#lobby-nav button[data-view]').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
    $('#me-chip').classList.toggle('active', v === 'profile');
    $$('.view').forEach(function (x) { x.classList.toggle('active', x.id === 'view-' + (sheet ? v : 'play')); });
    $('#lb-sheet').classList.toggle('hidden', !sheet);
    $('#lb-sheet').dataset.v = sheet ? v : '';
    if (sheet) { $('#lb-sheet-title').textContent = SHEET_TITLES[v]; $('.lb-sheet-body').scrollTop = 0; }
    if (v === 'guide') C.renderGuide($('#view-guide'));
    if (v === 'codex') C.renderCodex($('#view-codex'));
    if (v === 'ranks') renderRanks();
    if (v === 'profile') renderProfile();
  };
  App.lobbySettings = function () {
    var draw = function () {
      return '<h2>' + I.ui('gear', 18) + ' Cài đặt</h2><div class="set-list">' +
        '<button class="set-row" id="st-sound">' + (TT.Sound.on ? I.ui('sound', 20) : I.ui('mute', 20)) + '<span>Âm thanh</span><b>' + (TT.Sound.on ? 'Bật' : 'Tắt') + '</b></button>' +
        '<button class="set-row" id="st-profile">' + I.ui('user', 20) + '<span>Hồ sơ và lịch sử trận</span></button>' +
        '<button class="set-row danger" id="st-logout">' + I.ui('logout', 20) + '<span>Đăng xuất</span></button></div>';
    };
    var open = function () {
      App.modal(draw(), [['Đóng', 'ghost', false]]);
      $('#st-sound').onclick = function () { TT.Sound.toggle(); open(); };
      $('#st-profile').onclick = function () { $('#modal').classList.add('hidden'); App.lobbyView('profile'); };
      $('#st-logout').onclick = function () { $('#modal').classList.add('hidden'); Net.logout(); };
    };
    open();
  };
  function renderRoomList() {
    var el = $('#room-list');
    if (lobbyErr && !Net.ext.lobby) { $('#room-count').textContent = ''; el.innerHTML = '<div class="empty">Chưa tải được danh sách phòng.<br><small class="muted">Bạn vẫn có thể vào phòng bằng mã 6 ký tự.</small></div>'; return; }
    var q = ($('#room-search').value || '').trim().toLowerCase(), m = $('#room-filter').value;
    var list = lobbyList.filter(function (r) {
      var tm = !!(r.opts || {}).teamMode;
      if (m === 'team' ? !tm : (m && (String(r.mode) !== m || tm))) return false;
      if (q && (String(r.name || '').toLowerCase().indexOf(q) < 0 && r.code.toLowerCase().indexOf(q) < 0 && String(r.hostName || '').toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    $('#room-count').textContent = lobbyList.length ? (list.length === lobbyList.length ? '(' + list.length + ')' : '(' + list.length + '/' + lobbyList.length + ')') : '';
    $('#room-filter-btn').classList.toggle('has', !!(q || m));
    if (!list.length) { el.innerHTML = '<div class="empty">' + (lobbyList.length ? 'Không có phòng khớp bộ lọc' : 'Chưa có phòng nào đang mở<br><small class="muted">Hãy tạo phòng hoặc đấu với Bot để bắt đầu.</small>') + '</div>'; return; }
    el.innerHTML = list.map(function (r) {
      var pips = ''; for (var i = 0; i < r.mode; i++) pips += '<span class="pip' + (i < (r.count || 0) ? ' on' : '') + '"></span>';
      var o = r.opts || {};
      var full = (r.count || 0) >= r.mode, live = r.status !== 'lobby';
      var md = App.modeOf(r.mode, o.teamMode);
      App.INFO['room:' + r.code] = [esc(r.name || r.code),
        '<b>' + md.n + '</b> — ' + md.s + '.</p><p>Chủ phòng: <b>' + esc(r.hostName || '?') + '</b> · Mã: <b>' + r.code + '</b></p><p>Chuẩn bị mỗi ngày: <b>' + fmtTurn(r.turnLimitMs) + '</b>.</p><p>Bản đồ: <b>' + (o.lockMap ? 'khóa — luôn đánh trên Bình Nguyên Giao Phong' : 'đổi mỗi ngày') + '</b>.</p><p>Người chơi: <b>' + (r.count || 0) + '/' + r.mode + '</b>' + (live ? ' — đang đấu, không vào được.' : '.')];
      return '<div class="room-row' + (live ? ' live' : '') + '"><div class="mode">' + r.mode + '<small>người</small></div>' +
        '<div class="rbody"><div class="rn">' + esc(r.name || r.code) + '</div><div class="rm"><span class="who">' + esc(r.hostName || '') + '</span><span class="sep">·</span><span class="tag">' + md.n + '</span><span class="rt">' + I.ui('clock', 12) + ' ' + fmtTurn(r.turnLimitMs) + '</span>' + (o.lockMap ? '<span class="rt" title="Khóa bản đồ">' + I.ui('lock', 12) + '</span>' : '') + (live ? '<span class="tag live">Đang đấu</span>' : '') + '</div></div>' +
        '<div class="pips">' + pips + '</div>' +
        '<span class="info-i" role="button" tabindex="0" data-info="room:' + r.code + '" title="Xem luật phòng">i</span>' +
        '<button class="btn ' + (full || live ? 'ghost' : 'gold') + '" data-code="' + r.code + '"' + (live || full ? ' disabled' : '') + '>' + (live ? 'Đang đấu' : full ? 'Đầy' : 'Vào') + '</button></div>';
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
      el.innerHTML = '<div class="panel profile-card"><div class="profile-hero"><div class="avatar">' + I.avatar(av) + '</div><h2>' + esc(Net.user.name) + '</h2><div class="muted small">' + (Net.user.guest ? 'Tài khoản chơi thử' : esc(Net.user.email)) + '</div>' +
        '<div class="avatar-pick">' + I.AVATARS.map(function (a, i) { return '<button data-a="' + i + '" class="' + (i === av ? 'active' : '') + '">' + I.avatar(i) + '</button>'; }).join('') + '</div>' +
        '<form id="rename" class="row" style="margin-top:12px"><input name="n" maxlength="20" value="' + esc(Net.user.name) + '"><button class="btn">Đổi tên</button></form>' +
        '<button class="btn ghost wide" id="btn-sound">' + (TT.Sound.on ? I.ui('sound') + ' Âm thanh: Bật' : I.ui('mute') + ' Âm thanh: Tắt') + '</button>' +
        '<button class="btn red wide" id="btn-logout">Đăng xuất</button></div>' +
        '<div><div class="stat-grid"><div class="stat"><b>' + (p.rating || 1000) + '</b><span>Điểm hạng</span></div><div class="stat"><b>' + (p.games || 0) + '</b><span>Số trận</span></div><div class="stat"><b>' + (p.wins || 0) + '</b><span>Thắng</span></div><div class="stat"><b>' + (p.games ? Math.round(100 * (p.wins || 0) / p.games) : 0) + '%</b><span>Tỉ lệ thắng</span></div></div>' +
        '<h3>Lịch sử trận gần đây</h3>' + (h.length ? '<table class="rank-table"><tr><th>Thời gian</th><th>Chế độ</th><th>Tộc</th><th>Kết quả</th><th>Ván</th></tr>' + h.map(function (x) {
          return '<tr><td>' + (x.at ? new Date(x.at).toLocaleString('vi-VN') : '') + '</td><td>' + (x.mode || '') + ' người</td><td>' + (F[x.faction] ? F[x.faction].name : '') + '</td><td>' + (x.won ? '<span style="color:var(--green)">Thắng</span>' : x.draw ? 'Hòa' : '<span style="color:var(--red)">Thua</span>') + '</td><td>' + (x.days ? x.days + ' ngày' : '') + (x.pts != null ? ' · ' + x.pts + ' điểm' : '') + '</td></tr>';
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
      var c = App.code, ok = function () { App.toast('Đã sao chép mã ' + c, 'ok'); }, no = function () { App.toast('Mã phòng: ' + c); };
      try { navigator.clipboard.writeText(c).then(ok, no); } catch (e) { no(); }
    };
    $('#btn-room-settings').onclick = function () { App.roomSettings(); };
    wireChatPop('room');
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
    clearInterval(App.hb); App.room = null; App.roomInfo = null; App.returning = false; App.reopening = false;
  };
  /* returning = true: vừa xong một trận, đang về lại phòng chờ (chờ chủ phòng mở lại phòng nếu status còn 'finished') */
  App.enterRoom = function (code, returning) {
    App.cleanupRoom();
    App.code = code; App.hadSeat = false; App.started = false; App.lastCount = -1; App.returning = !!returning; App.reopening = false;
    try { localStorage.setItem('ttkc.lastRoom.' + Net.user.uid, code); } catch (e) { }
    $('#room-chat').innerHTML = ''; $('#room-name').textContent = 'Phòng'; $('#room-code').innerHTML = code + I.ui('copy', 14);
    $('#loadout').dataset.key = ''; $('#loadout').innerHTML = '';
    unread.room = 0; setBadge('room'); App.closeChat_room();
    closeInfo();
    App.show('room');
    App.unsubs.push(Net.watchRoom(code, onRoom));
    App.remoteBotLv = {};
    App.unsubs.push(Net.B.on('lobby/' + code + '/bots', function (v) { App.remoteBotLv = v || {}; refreshRoom(); if (TT.Game && TT.Game.onBotLv) TT.Game.onBotLv(App.remoteBotLv); }));
    App.unsubs.push(Net.B.on('lobby/' + code, function (v) { var nm = v && v.name, pv = v && v.private, o = App.roomInfo || {}; App.roomInfo = v ? { name: v.name, private: !!v.private } : null; if (!v || o.name !== nm || o.private !== pv) refreshRoom(); }));
    App.unsubs.push(Net.watchRoomChat(code, function (m) { appendChat($('#room-chat'), m); bumpUnread('room', m); if (TT.Game && TT.Game.onChat) TT.Game.onChat(m); }));
    App.hb = setInterval(function () { Net.heartbeat(code); }, 15000);
    Net.heartbeat(code);
  };
  /* Về lại phòng chờ sau trận. Chủ phòng tự mở lại phòng (Net.reopenRoom); người khác chờ status về 'lobby'. */
  App.showRoom = function (code) {
    try { if (TT.Game && TT.Game.stop && (App.screen === 'game' || App.screen === 'loading')) TT.Game.stop(); } catch (e) { }
    App.enterRoom(code || App.code, true);
  };
  function refreshRoom() { if (App.room && App.room.meta && App.room.loaded && App.room.loaded.meta && App.room.meta.status !== 'playing' && App.screen === 'room') renderRoom(App.room); }
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
    if (App.returning && room.meta.status !== 'lobby') { // vừa xong trận: chờ chủ phòng ghi 'finished' rồi mở lại phòng (không vào lại trận cũ)
      renderRoom(room);
      if (room.meta.status === 'finished' && room.meta.hostUid === uid && !App.reopening) reopen();
      return;
    }
    if (room.meta.status !== 'lobby') {
      if (!App.started && mySeats.length) { App.started = true; TT.Game.start(App.code, room); }
      else if (!mySeats.length && !App.started) { App.toast('Bạn không có ghế trong trận này', 'err'); App.cleanupRoom(); App.enterLobby(); }
      if (TT.Game && TT.Game.onRoom) TT.Game.onRoom(room);
      return;
    }
    if (App.started) return; // phòng đã được mở lại nhưng mình còn ở màn hình trận: chờ App.showRoom
    App.returning = false;
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
  function reopen() {
    var room = App.room; if (!room || App.reopening) return;
    App.reopening = true;
    Net.reopenRoom(App.code, room).catch(function (e) { App.toast('Không mở lại được phòng chờ: ' + (e.message || e), 'err', 5000); }).then(function () { App.reopening = false; refreshRoomAny(); });
  }
  function refreshRoomAny() { if (App.room && App.room.meta && App.screen === 'room') renderRoom(App.room); }

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

  function chip(ic, txt, key, extra) { return '<span class="rchip' + (extra ? ' ' + extra : '') + '">' + (ic ? I.ui(ic, 12) : '') + txt + (key ? App.infoBtn(key) : '') + '</span>'; }

  function renderRoom(room) {
    var uid = Net.user.uid, meta = room.meta, host = meta.hostUid === uid, me = room.players[uid];
    var opt = Net.decodeSeed(meta.seed), occ = occupants(room), fin = meta.status === 'finished' || (App.returning && meta.status === 'playing');
    var info = App.roomInfo || {}, rn; try { rn = localStorage.getItem('ttkc.roomName.' + App.code); } catch (e) { }
    $('#room-name').textContent = info.name || rn || ('Phòng ' + meta.mode + ' người');
    var rmd = App.modeOf(meta.mode, opt.teamMode);
    $('#room-opts').innerHTML = chip('users', rmd.n, rmd.k) + chip('clock', fmtTurn(meta.turnLimitMs), 'turn') + (opt.lockMap ? chip('lock', 'Khóa bản đồ', 'lockmap') : '') + (info.private ? chip('eye', 'Phòng riêng', 'priv') : '');
    $('#btn-room-settings').classList.toggle('host', host);
    $('#btn-room-settings').title = host ? 'Cài đặt phòng (chủ phòng)' : 'Xem thiết lập phòng';
    var html = '';
    for (var n = 1; n <= 4; n++) {
      var s = String(n), o = occ[s], side = meta.mode === 2 ? [0, 2][n - 1] : n - 1;
      var sideName = meta.mode === 2 && n > 2 ? '' : TT.SIDE_NAMES[side != null ? side : 0];
      if (o.kind === 'off') continue;
      if (o.kind === 'empty' || o.kind === 'joining') {
        var tools = '';
        if (o.kind === 'empty') {
          if (me && !me.ready && me.seat !== s && !fin) tools += '<button class="btn small" data-act="sit" data-s="' + s + '">Ngồi đây</button>';
          if (host && !fin) tools += '<button class="btn small teal" data-act="bot" data-s="' + s + '">' + I.ui('plus', 11) + ' Bot</button>';
        } else if (host) tools += '<button class="btn small red" data-act="free" data-s="' + s + '" title="Mời ra">' + I.ui('close', 12) + '</button>';
        html += '<div class="sc vacant" style="--sc:' + TT.SEAT_COLORS[s] + '"><div class="sc-num">' + n + '</div><div class="sc-vt"><b>' + (o.kind === 'joining' ? 'Đang vào…' : 'Ghế trống') + '</b><small>' + sideName + '</small></div><div class="sc-tools">' + tools + '</div></div>';
        continue;
      }
      var f, name, pas, home, ready, isMe = o.uid === uid && o.kind === 'human', isHost = o.uid === meta.hostUid && o.kind === 'human';
      if (o.kind === 'human') { f = Net.RACE_INV[o.p.race] || 'dragon'; name = o.p.name; pas = o.p.passive; home = o.p.homeTileType; ready = o.p.ready || isHost; }
      else { f = o.b.faction; name = o.b.name + ' ' + s; pas = o.b.talent; home = o.b.start; ready = true; }
      var fd = F[f], pd = TT.TALENTS[f].filter(function (x) { return x.id === pas; })[0], hk = TT.START_ITEMS[home] ? home : 'gold', sit = TT.ITEMS[TT.START_ITEMS[hk] || 'kiem'];
      var stale = o.kind === 'human' && typeof o.p.lastSeen === 'number' && Net.B.now() - o.p.lastSeen > 45000;
      var lv = o.kind === 'bot' ? App.botLv(s) : '';
      App.INFO['seat' + s] = [esc(name) + ' — ' + fd.name,
        '<b>' + fd.base.name + '</b>: ' + fd.base.desc + '</p><p style="color:#b0303c"><b>' + fd.weak.name + '</b>: ' + fd.weak.desc + '</p><p>Thiên phú <b>' + (pd ? pd.name : '') + '</b>: ' + (pd ? pd.desc : '') + '</p><p>Khởi đầu <b>' + sit.name + '</b>: ' + sit.desc + (o.kind === 'bot' ? '</p><p>' + (App.INFO[lv] ? App.INFO[lv][1] : '') : '')];
      var foot = '';
      if (o.kind === 'bot') foot = host && !fin ? '<select class="bot-sel" data-s="' + s + '" title="Độ khó của Bot">' + App.LV.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === lv ? ' selected' : '') + '>Bot · ' + l[1] + '</option>'; }).join('') + '</select>' : '<span class="rchip lv-' + lv + '">Bot · ' + TT.Bot.levelName(lv) + '</span>';
      var kick = host && !isMe && !fin ? '<button class="kick" data-act="free" data-s="' + s + '" title="' + (o.kind === 'bot' ? 'Gỡ Bot' : 'Mời ra') + '">' + I.ui('close', 12) + '</button>' : '';
      html += '<div class="sc filled' + (isMe ? ' me' : '') + (ready ? ' rdy' : '') + '" style="--fc:' + fd.color + ';--sc:' + TT.SEAT_COLORS[s] + '">' +
        '<div class="sc-art">' + I.crest(f, 84) + '<div class="ready ' + (ready ? 'yes' : 'no') + '">' + (o.kind === 'bot' ? 'Bot' : isHost ? 'Chủ phòng' : ready ? 'Sẵn sàng' : 'Chưa sẵn') + '</div></div>' +
        '<div class="sc-body"><div class="pname">' + (isHost ? '<span class="crown" title="Chủ phòng">' + I.ui('crown', 15) + '</span>' : '') + '<span class="pn">' + esc(name) + '</span>' + (stale ? ' <small title="Mất kết nối">' + I.ui('warn', 14, '#e0a000') + '</small>' : '') + '</div>' +
        '<div class="fac">' + fd.name + ' · ' + (opt.teamMode ? (n % 2 ? 'Đội A' : 'Đội B') : sideName) + '</div>' +
        '<div class="chips"><span class="rchip" title="Thiên phú: ' + esc(pd ? pd.desc : '') + '">' + I.ui('diamond', 10) + (pd ? pd.name : '') + '</span><span class="rchip" title="' + esc(sit.desc) + '">' + I.item(TT.START_ITEMS[hk] || 'kiem', 12) + sit.name + '</span></div>' +
        (foot ? '<div class="sc-foot">' + foot + '</div>' : '') + '</div>' +
        '<div class="sc-corner"><span class="info-i" role="button" tabindex="0" data-info="seat' + s + '" title="Chi tiết">i</span>' + kick + '</div></div>';
    }
    var seatsEl = $('#seats');
    seatsEl.style.setProperty('--n', meta.mode);
    seatsEl.innerHTML = html;
    $$('#seats [data-act]').forEach(function (b) {
      b.onclick = function () {
        var s = b.dataset.s, a = b.dataset.act;
        var p = a === 'sit' ? Net.changeSeat(App.code, me.seat, s) : a === 'bot' ? Net.addBot(App.code, s).then(function () { return Net.setBotLevel(App.code, s, App.botLv(s)); }) : Net.freeSeat(App.code, s);
        p.catch(function (e) { App.toast(e.message || String(e), 'err'); });
      };
    });
    $$('#seats .bot-sel').forEach(function (b) { b.onchange = function () { Net.setBotLevel(App.code, b.dataset.s, b.value).then(function () { renderRoom(App.room); }); renderRoom(App.room); }; });
    renderLoadout(room, me, host);
    // nút
    var humans = Object.keys(occ).filter(function (k) { return occ[k].kind === 'human'; });
    var filled = Object.keys(occ).filter(function (k) { return occ[k].kind === 'human' || occ[k].kind === 'bot'; }).length;
    var allReady = humans.every(function (k) { return occ[k].p.ready || occ[k].uid === meta.hostUid; });
    var canStart = host && !fin && filled === meta.mode && allReady;
    var bs = $('#btn-start'), br = $('#btn-ready');
    bs.style.display = host ? '' : 'none';
    br.style.display = host ? 'none' : '';
    bs.disabled = fin ? App.reopening : !canStart;
    bs.textContent = fin ? 'Mở lại phòng chờ' : 'Bắt đầu trận';
    br.disabled = fin || !me;
    if (me) { br.textContent = me.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'; br.className = 'btn big ' + (me.ready ? 'ghost' : 'teal'); }
    var rdyN = humans.filter(function (k) { return occ[k].p.ready || occ[k].uid === meta.hostUid; }).length;
    $('#room-status').innerHTML = fin ? (host ? 'Đang mở lại phòng chờ…' : 'Chờ chủ phòng mở lại phòng chờ…') :
      filled < meta.mode ? 'Chờ người chơi <b>' + filled + '/' + meta.mode + '</b>' + (host ? ' · thêm Bot ở ghế trống để chơi ngay' : '') :
      !allReady ? 'Chờ mọi người sẵn sàng <b>' + rdyN + '/' + humans.length + '</b>' : host ? '<span class="ok">Đã đủ người — bắt đầu thôi!</span>' : 'Chờ chủ phòng bắt đầu';
    bs.classList.toggle('btn-end-pulse', canStart);
  }

  App.botLv = function (seat) { var loc = Net.botLevels(App.code)[seat]; return loc || (App.remoteBotLv || {})[seat] || 'medium'; };

  /* ---- bảng "Chọn tộc": một khung gọn, đổi tab Tộc / Thiên phú / Khởi đầu / Lệnh Soái ---- */
  App.loTab = 'fac';
  function renderLoadout(room, me, host) {
    var el = $('#loadout');
    if (!me) { el.innerHTML = '<p class="muted lo-empty">Bạn đang xem phòng này.</p>'; el.dataset.key = ''; return; }
    var f = Net.RACE_INV[me.race] || 'dragon', fd = F[f], start = TT.START_ITEMS[me.homeTileType] ? me.homeTileType : 'gold';
    var tals = TT.TALENTS[f], tal = tals.some(function (t) { return t.id === me.passive; }) ? me.passive : tals[0].id;
    var fin = room.meta.status === 'finished' || (App.returning && room.meta.status === 'playing');
    var locked = (me.ready && !host) || fin;
    var tab = App.loTab;
    var key = f + tal + start + locked + tab;
    if (el.dataset.key === key) return; el.dataset.key = key;
    var td = tals.filter(function (t) { return t.id === tal; })[0], sit = TT.ITEMS[TT.START_ITEMS[start]];
    var tabs = [['fac', 'Tộc', fd.short], ['tal', 'Thiên phú', td.name], ['home', 'Khởi đầu', sit.name], ['ord', 'Lệnh Soái', '3 lệnh']];
    var body = '';
    if (tab === 'fac') {
      body = '<div class="fac-pick">' + TT.FACTION_ORDER.map(function (k) { return '<div class="fac-opt' + (k === f ? ' active' : '') + '" data-f="' + k + '" title="' + esc(F[k].name) + '">' + I.crest(k, 52) + '<div class="n">' + F[k].short + '</div></div>'; }).join('') + '</div>' +
        '<div class="fac-desc"><div class="base"><b>' + fd.base.name + '</b> — ' + fd.base.desc + '</div><div class="weak"><b>' + fd.weak.name + '</b> — ' + fd.weak.desc + '</div></div>';
    } else if (tab === 'tal') {
      body = '<div class="rune-row">' + tals.map(function (t) { return '<div class="rune' + (t.id === tal ? ' active' : '') + '" data-p="' + t.id + '"><div class="rn">' + t.name + '</div><div class="rt">' + t.desc + '</div></div>'; }).join('') + '</div>';
    } else if (tab === 'home') {
      body = '<div class="home-pick">' + ['gold', 'food', 'wood'].map(function (k) { var it = TT.ITEMS[TT.START_ITEMS[k]]; return '<div class="home-opt' + (k === start ? ' active' : '') + '" data-h="' + k + '" title="' + esc(it.desc) + '">' + I.item(TT.START_ITEMS[k], 30) + '<span>' + it.name + '</span><small>' + it.desc + '</small></div>'; }).join('') + '</div>';
    } else {
      body = '<div class="spells">' + TT.ORDERS[f].map(function (o) { return '<div class="spell"><div class="k">' + TT.AGE_ROMAN[o.age] + '</div><div><div class="sn">' + o.name + ' <small class="muted">· Đời ' + TT.AGE_ROMAN[o.age] + '</small></div><div class="sd">' + o.desc + '</div></div></div>'; }).join('') + '</div><p class="muted small lo-note">Lệnh Soái tự kích hoạt trong giao tranh khi đạt Đời tương ứng.</p>';
    }
    el.innerHTML = '<div class="lo2' + (locked ? ' locked' : '') + '"><div class="lo2-head"><h3>Chọn tộc</h3>' +
      '<div class="lo2-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" class="' + (t[0] === tab ? 'active' : '') + '"><small>' + t[1] + '</small><b>' + t[2] + '</b></button>'; }).join('') + '</div>' +
      (locked ? '<span class="lo2-lock">' + I.ui('lock', 12) + ' Đã khóa</span>' : '') + '</div>' +
      '<div class="lo2-body t-' + tab + '">' + body + '</div></div>';
    function save(patch) {
      var nf = patch.race ? Net.RACE_INV[patch.race] : f;
      try { localStorage.setItem('ttkc.loadout2', JSON.stringify({ faction: nf, talent: patch.passive || tal, start: patch.homeTileType || start })); } catch (e) { }
      Net.setMe(App.code, patch).catch(function (e) { App.toast(e.message, 'err'); });
    }
    $$('.lo2-tabs button', el).forEach(function (b) { b.onclick = function () { App.loTab = b.dataset.tab; renderLoadout(App.room, myRec(), App.room.meta.hostUid === Net.user.uid); }; });
    $$('.fac-opt', el).forEach(function (d) { d.onclick = function () { var k = d.dataset.f; if (k === f) return; save({ race: Net.RACE[k], passive: TT.TALENTS[k][0].id }); }; });
    $$('.rune', el).forEach(function (d) { d.onclick = function () { save({ passive: d.dataset.p }); }; });
    $$('.home-opt', el).forEach(function (d) { d.onclick = function () { save({ homeTileType: d.dataset.h }); }; });
  }

  /* ---- Cài đặt phòng: chủ phòng chỉnh được, người khác xem ---- */
  App.roomSettings = function () {
    var room = App.room; if (!room || !room.meta) return;
    var meta = room.meta, host = meta.hostUid === Net.user.uid, opt = Net.decodeSeed(meta.seed), info = App.roomInfo || {};
    var md = App.modeOf(meta.mode, opt.teamMode);
    if (!host || meta.status !== 'lobby') {
      var row = function (ic, k, v, key) { return '<div class="rs-row">' + I.ui(ic, 16) + '<span class="k">' + k + '</span><b>' + v + '</b>' + (key ? App.infoBtn(key) : '') + '</div>'; };
      App.modal('<h2>' + I.ui('gear', 18) + ' Thiết lập phòng</h2><div class="rs-list">' +
        row('users', 'Chế độ', md.n, md.k) + row('clock', 'Thời gian chuẩn bị', fmtTurn(meta.turnLimitMs), 'turn') + row('map', 'Khóa bản đồ', opt.lockMap ? 'Bật' : 'Tắt', 'lockmap') +
        row('eye', 'Loại phòng', info.private ? 'Phòng riêng' : 'Công khai', 'priv') + row('sun', 'Số ngày', '10 ngày') + '</div>' +
        '<p class="muted small" style="margin:10px 0 0">' + (host ? 'Không đổi được thiết lập khi trận đã diễn ra.' : 'Chỉ chủ phòng được đổi thiết lập.') + '</p>', [['Đóng', 'gold', true]]);
      return;
    }
    var rn; try { rn = localStorage.getItem('ttkc.roomName.' + App.code); } catch (e) { }
    var pick = { m: md.k, turn: meta.turnLimitMs, lockmap: opt.lockMap, priv: !!info.private, name: info.name || rn || '' };
    var turns = [[30000, '30s'], [60000, '60s'], [90000, '90s'], [120000, '2 phút'], [180000, '3 phút']];
    if (!turns.some(function (t) { return t[0] === +pick.turn; })) turns.push([+pick.turn, fmtTurn(pick.turn)]);
    var tog = function (k, label) { return '<div class="opt-row"><label class="switch"><input type="checkbox" data-k="' + k + '"' + (pick[k] ? ' checked' : '') + '><span></span>' + label + '</label>' + App.infoBtn(k) + '</div>'; };
    App.modal('<h2>' + I.ui('gear', 18) + ' Cài đặt phòng</h2>' +
      '<label class="fl">Tên phòng</label><input id="rs-name" maxlength="28" value="' + esc(pick.name) + '" placeholder="Phòng của ' + esc(Net.user.name) + '">' +
      '<label class="fl">Chế độ</label><div class="mode-grid seg" data-name="m">' + App.MODES.map(function (m) { return '<button type="button" data-v="' + m.k + '" class="mode-card' + (pick.m === m.k ? ' active' : '') + '"><b>' + m.n + '</b><small>' + m.s + '</small>' + App.infoBtn(m.k) + '</button>'; }).join('') + '</div>' +
      '<label class="fl">Thời gian chuẩn bị ' + App.infoBtn('turn') + '</label>' + segHtml('turn', turns, pick.turn) +
      '<div class="opt-list">' + tog('lockmap', 'Khóa bản đồ') + tog('priv', 'Phòng riêng') + '</div>',
      [['Hủy', 'ghost', false], ['Lưu thiết lập', 'gold', true]]).then(function (ok) {
      if (!ok) return;
      var nm = (($('#rs-name') || {}).value || pick.name || '').trim();
      var nmd = App.MODES.filter(function (m) { return m.k === pick.m; })[0] || md;
      Net.updateRoomOpts(App.code, App.room, { mode: nmd.mode, teamMode: nmd.team, lockMap: !!pick.lockmap, turnLimitMs: +pick.turn, name: nm || undefined, private: !!pick.priv })
        .then(function () {
          try { if (nm) localStorage.setItem('ttkc.roomName.' + App.code, nm); localStorage.setItem('ttkc.roomPriv.' + App.code, pick.priv ? '1' : '0'); } catch (x) { }
          App.toast('Đã lưu thiết lập phòng', 'ok');
        }).catch(function (err) { App.toast(err.message || String(err), 'err', 5000); });
    });
    wireSeg(pick);
    $$('#modal-box .switch input').forEach(function (c) { c.onchange = function () { pick[c.dataset.k] = c.checked; }; });
    $('#rs-name').oninput = function () { pick.name = this.value; };
  };

  App.hostStart = function () {
    var room = App.room; if (!room || room.meta.hostUid !== Net.user.uid) return;
    if (room.meta.status === 'finished') { App.reopening = false; reopen(); return; }
    var setup = Net.buildSetup(room);
    if (setup.players.length !== room.meta.mode) { App.toast('Chưa đủ người', 'err'); return; }
    $('#btn-start').disabled = true;
    Net.startGame(App.code).catch(function (e) { App.toast('Không bắt đầu được: ' + (e.message || e), 'err', 5000); $('#btn-start').disabled = false; });
  };

  document.addEventListener('DOMContentLoaded', App.init);
})(window);
