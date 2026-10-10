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
      var onlyClose = buttons && buttons.length === 1 && buttons[0][2] === false;   // chỉ có nút Đóng → thay bằng dấu X tròn ở góc
      if (onlyClose) buttons = [];
      box.innerHTML = '<button class="x-circ modal-x" type="button" title="Đóng" aria-label="Đóng">' + I.ui('close', 12) + '</button>' + html + (buttons && !buttons.length ? '' : '<div class="btns">') + (buttons || [['OK', 'gold', true]]).map(function (b, i) { return '<button class="btn ' + (b[1] || '') + '" data-i="' + i + '">' + b[0] + '</button>'; }).join('') + (buttons && !buttons.length ? '' : '</div>');
      $('#modal').classList.remove('hidden');
      var bs = buttons || [['OK', 'gold', true]], cancel = bs.map(function (b) { return b[2]; }).indexOf(false);
      var mx = box.querySelector('.modal-x'); if (mx) mx.onclick = function () { $('#modal').classList.add('hidden'); res(onlyClose ? false : cancel >= 0 ? false : (bs[0] ? bs[0][2] : false)); };
      $('#modal').onclick = function (e) { if (e.target === $('#modal')) { $('#modal').classList.add('hidden'); res(cancel >= 0 || onlyClose ? false : bs[0][2]); } };
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
    var bt = $('#btn-tutorial'); if (bt) bt.onclick = function () { App.tutorial(); };
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
    // lớp mờ phía sau (chỉ hiện trên màn hình nhỏ, khung chat nằm giữa) — chạm ra ngoài để thu gọn
    var dim = document.createElement('div'); dim.className = 'chat-dim hidden'; pop.parentNode.insertBefore(dim, pop); dim.onclick = function () { toggle(false); };
    var xb = $('#' + k + '-chat-x'); if (xb) { xb.innerHTML = I.ui('down', 14); xb.title = 'Thu gọn'; xb.setAttribute('aria-label', 'Thu gọn khung chat'); }
    function toggle(on) {
      pop.classList.toggle('hidden', !on); btn.classList.toggle('on', on); dim.classList.toggle('hidden', !on);
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
    var b = e.target.closest('.info-i'); if (b && b.dataset.info == null) b = null;   // nút (i) của ghế mở bảng xem thiết lập riêng
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

  /* Hướng dẫn tân thủ: ván 1 đấu 1 với Bot Dễ, hướng dẫn từng bước (tutor.js) */
  App.tutorial = function () {
    var btn = $('#btn-tutorial'); busy(btn, true);
    Net.createRoom({ name: 'Hướng dẫn tân thủ', mode: 2, turnLimitMs: 180000, private: true })
      .then(function (code) { return Net.addBot(code, '2').then(function () { return Net.setBotLevel(code, '2', 'easy'); }).then(function () { App.tutorialCode = code; App.autoStart = code; App.enterRoom(code); }); })
      .catch(function (err) { App.toast('Không mở được hướng dẫn: ' + (err.message || err), 'err', 5000); })
      .then(function () { busy(btn, false); });
  };
  function offerTutorial() {
    var done = null, asked = null; try { done = localStorage.getItem('ttkc.tutDone'); asked = localStorage.getItem('ttkc.tutAsked'); } catch (e) { }
    if (done || asked) return;
    try { localStorage.setItem('ttkc.tutAsked', '1'); } catch (e) { }
    setTimeout(function () {
      if (App.screen !== 'lobby') return;
      App.modal('<h2>' + I.ui('star', 18) + ' Lần đầu chơi vChess?</h2><p>Hướng dẫn tân thủ sẽ dẫn bạn từng bước qua một ván thật với Bot: mua quân, xếp đội hình, ra lệnh, Nguyên soái, trang bị, Lõi và giao tranh. Mất khoảng 5 phút.</p>',
        [['Để sau', 'ghost', false], ['Bắt đầu hướng dẫn', 'gold', true]]).then(function (ok) { if (ok) App.tutorial(); });
    }, 900);
  }
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
    offerTutorial();
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
  /* Chất lượng đồ họa: 0 rất thấp · 1 thấp · 2 trung bình · 3 cao · 'auto' tự nhận theo máy */
  App.GFX_NAMES = ['Rất thấp', 'Thấp', 'Trung bình', 'Cao'];
  App.gfxPref = function () { var v = null; try { v = localStorage.getItem('ttkc.gfx'); } catch (e) { } if (v === 'low') return '1'; if (v === 'high') return '3'; return v === '0' || v === '1' || v === '2' || v === '3' ? v : 'auto'; };
  App.gfxLevel = function () {
    var pf = App.gfxPref(); if (pf !== 'auto') return +pf;
    var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
    if (touch && (cores <= 6 || mem <= 4)) return 0;
    if (touch || cores <= 4 || mem <= 4) return 1;
    return cores <= 6 ? 2 : 3;
  };
  App.gfxPickerHtml = function () {
    var pf = App.gfxPref(), lv = App.gfxLevel();
    return '<div class="gfx-pick"><div class="gfx-h">' + I.ui('gear', 14) + ' Đồ họa' + (pf === 'auto' ? ' <em>(tự chọn: ' + App.GFX_NAMES[lv] + ')</em>' : '') + '</div><div class="gfx-seg">' +
      ['auto', '0', '1', '2', '3'].map(function (k) { return '<button type="button" data-g="' + k + '" class="' + (pf === k ? 'on' : '') + '">' + (k === 'auto' ? 'Tự động' : App.GFX_NAMES[+k]) + '</button>'; }).join('') + '</div></div>';
  };
  App.gfxPickerBind = function (root, again) {
    Array.prototype.forEach.call(root.querySelectorAll('.gfx-seg button'), function (b) { b.onclick = function () { try { localStorage.setItem('ttkc.gfx', b.dataset.g); } catch (e) { } App.toast('Đồ họa: áp dụng từ lần vào trận sau', 'ok'); if (again) again(); }; });
  };
  App.lobbySettings = function () {
    var draw = function () {
      return '<h2>' + I.ui('gear', 18) + ' Cài đặt</h2><div class="set-list">' +
        '<button class="set-row" id="st-sound">' + (TT.Sound.on ? I.ui('sound', 20) : I.ui('mute', 20)) + '<span>Âm thanh</span><b>' + (TT.Sound.on ? 'Bật' : 'Tắt') + '</b></button>' +
        App.gfxPickerHtml() + '<button class="set-row" id="st-profile">' + I.ui('user', 20) + '<span>Hồ sơ và lịch sử trận</span></button>' +
        '<button class="set-row danger" id="st-logout">' + I.ui('logout', 20) + '<span>Đăng xuất</span></button></div>';
    };
    var open = function () {
      App.modal(draw(), [['Đóng', 'ghost', false]]);
      $('#st-sound').onclick = function () { TT.Sound.toggle(); open(); };
      App.gfxPickerBind($('#modal'), open);
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
    var lo = $('#loadout'); if (lo) { lo.dataset.key = ''; lo.innerHTML = ''; }
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
    var sl0 = []; for (var q0 = 1; q0 <= 4; q0++) { var oq = occ[String(q0)]; if (oq.kind === 'human') sl0.push({ seat: String(q0), race: Net.RACE_INV[oq.p.race] || 'dragon', skin: oq.p.skin }); else if (oq.kind === 'bot') sl0.push({ seat: String(q0), race: oq.b.faction }); }
    var skinMap = TT.assignSkins(sl0), html = ''; App.seatData = {}; App.skinMapNow = skinMap; App.seatMe = me;
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
      var marId;
      if (o.kind === 'human') { f = Net.RACE_INV[o.p.race] || 'dragon'; name = o.p.name; pas = o.p.passive; home = o.p.homeTileType; ready = o.p.ready || isHost; marId = TT.marshalOf(f, o.p.mar).id; }
      else { f = o.b.faction; name = o.b.name + ' ' + s; pas = o.b.talent; home = o.b.start; ready = true; marId = TT.marshalOf(f, o.b.mar).id; }
      var fd = F[f], pd = TT.TALENTS[f].filter(function (x) { return x.id === pas; })[0], hk = TT.START_ITEMS[home] ? home : 'gold', sit = TT.ITEMS[TT.START_ITEMS[hk] || 'kiem'];
      App.seatData[s] = { f: f, name: name, pas: pd ? pd.id : TT.TALENTS[f][0].id, hk: hk, mar: marId, skin: skinMap[s], bot: o.kind === 'bot', host: isHost, ready: ready, me: isMe, side: opt.teamMode ? (n % 2 ? 'Đội A' : 'Đội B') : sideName };
      var stale = o.kind === 'human' && typeof o.p.lastSeen === 'number' && Net.B.now() - o.p.lastSeen > 45000;
      var lv = o.kind === 'bot' ? App.botLv(s) : '', skHex = (TT.SKINS[skinMap[s]] || {}).c, snap = TT.marshalSnap ? TT.marshalSnap(f, marId, skHex, 120, 150) : '';
      App.INFO['seat' + s] = [esc(name) + ' — ' + fd.name,
        '<b>' + fd.base.name + '</b>: ' + fd.base.desc + '</p><p style="color:#b0303c"><b>' + fd.weak.name + '</b>: ' + fd.weak.desc + '</p><p>Thiên phú <b>' + (pd ? pd.name : '') + '</b>: ' + (pd ? pd.desc : '') + '</p><p>Khởi đầu <b>' + sit.name + '</b>: ' + sit.desc + (o.kind === 'bot' ? '</p><p>' + (App.INFO[lv] ? App.INFO[lv][1] : '') : '')];
      var foot = '';
      if (o.kind === 'bot') foot = host && !fin ? '<select class="bot-sel" data-s="' + s + '" title="Độ khó của Bot">' + App.LV.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === lv ? ' selected' : '') + '>Bot · ' + l[1] + '</option>'; }).join('') + '</select>' : '<span class="rchip lv-' + lv + '">Bot · ' + TT.Bot.levelName(lv) + '</span>';
      var kick = host && !isMe && !fin ? '<button class="kick" data-act="free" data-s="' + s + '" title="' + (o.kind === 'bot' ? 'Gỡ Bot' : 'Mời ra') + '">' + I.ui('close', 12) + '</button>' : '';
      html += '<div class="sc filled' + (isMe ? ' me' : '') + (ready ? ' rdy' : '') + '" style="--fc:' + fd.color + ';--sc:' + TT.SEAT_COLORS[s] + '">' +
        '<div class="sc-art pv" data-act="pv" data-s="' + s + '" role="button" tabindex="0" title="Xem thiết lập' + (isMe ? ' của bạn' : ' của ' + esc(name)) + '"' + '>' + (snap ? '<img class="sc-mar" alt="" src="' + snap + '">' : I.crest(f, 60)) + (isMe && !fin && !(me && me.ready && !host) ? '<button type="button" class="mar-btn" data-act="skin" title="Đổi nguyên soái và skin">' + I.ui('rotl', 14) + '</button>' : '') + '<div class="ready ' + (ready ? 'yes' : 'no') + '">' + (o.kind === 'bot' ? 'Bot' : isHost ? 'Chủ phòng' : ready ? 'Sẵn sàng' : 'Chưa sẵn') + '</div></div>' +
        '<div class="sc-body"><div class="pname">' + (isHost ? '<span class="crown" title="Chủ phòng">' + I.ui('crown', 15) + '</span>' : '') + '<span class="pn">' + esc(name) + '</span>' + (stale ? ' <small title="Mất kết nối">' + I.ui('warn', 14, '#e0a000') + '</small>' : '') + '</div>' +
        '<div class="fac">' + fd.name + ' · ' + (opt.teamMode ? (n % 2 ? 'Đội A' : 'Đội B') : sideName) + '</div>' +
        pickRow(f, fd, pd, hk, sit, isMe && !fin, isMe && me && me.ready && !host) +
        (foot ? '<div class="sc-foot">' + foot + '</div>' : '') + '</div>' +
        '<div class="sc-corner"><span class="info-i" role="button" tabindex="0" data-act="pv" data-s="' + s + '" title="Xem thiết lập">i</span>' + kick + '</div></div>';
    }
    var seatsEl = $('#seats');
    seatsEl.style.setProperty('--n', meta.mode);
    seatsEl.innerHTML = html;
    $$('#seats [data-act]').forEach(function (b) {
      b.onclick = function (ev) {
        var s = b.dataset.s, a = b.dataset.act;
        if (a !== 'pv') ev.stopPropagation();
        if (a === 'pv') { App.seatPreview(s); return; }
        if (a === 'skin') { App.skinPopup(me, skinMap); return; }
        if (a === 'race' || a === 'home') { if (me && me.ready && !host) { App.toast('Hủy Sẵn sàng để đổi tộc và trang bị khởi đầu', 'err'); return; } (a === 'race' ? App.racePopup : App.homePopup)(me); return; }
        var p = a === 'sit' ? Net.changeSeat(App.code, me.seat, s) : a === 'bot' ? Net.addBot(App.code, s).then(function () { return Net.setBotLevel(App.code, s, App.botLv(s)); }) : Net.freeSeat(App.code, s);
        p.catch(function (e) { App.toast(e.message || String(e), 'err'); });
      };
    });
    $$('#seats .bot-sel').forEach(function (b) { b.onchange = function () { Net.setBotLevel(App.code, b.dataset.s, b.value).then(function () { renderRoom(App.room); }); renderRoom(App.room); }; });
    // nút
    var humans = Object.keys(occ).filter(function (k) { return occ[k].kind === 'human'; });
    var filled = Object.keys(occ).filter(function (k) { return occ[k].kind === 'human' || occ[k].kind === 'bot'; }).length;
    var allReady = humans.every(function (k) { return occ[k].p.ready || occ[k].uid === meta.hostUid; });
    var canStart = host && !fin && filled === meta.mode && allReady;
    var bs = $('#btn-start'), br = $('#btn-ready');
    bs.style.display = host ? '' : 'none';
    br.style.display = host ? 'none' : '';
    bs.disabled = fin ? App.reopening : !canStart;
    bs.innerHTML = I.ui(fin ? 'undo' : 'play', 14) + '<span>' + (fin ? 'Mở lại phòng' : 'Bắt đầu') + '</span>';
    br.disabled = fin || !me;
    if (me) { br.innerHTML = I.ui(me.ready ? 'close' : 'check', 14) + '<span>' + (me.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng') + '</span>'; br.className = 'btn ' + (me.ready ? 'ghost' : 'teal'); }
    var rdyN = humans.filter(function (k) { return occ[k].p.ready || occ[k].uid === meta.hostUid; }).length;
    var rst = $('#room-status');
    rst.innerHTML = fin ? I.ui('clock', 12) + '<span>' + (host ? 'Đang mở lại…' : 'Chờ chủ phòng mở lại') + '</span>' :
      filled < meta.mode ? I.ui('users', 12) + '<span><em>Người chơi </em><b>' + filled + '/' + meta.mode + '</b></span>' :
      !allReady ? I.ui('check', 12) + '<span><em>Sẵn sàng </em><b>' + rdyN + '/' + humans.length + '</b></span>' : host ? I.ui('check', 12) + '<span class="ok">Đủ người!</span>' : I.ui('clock', 12) + '<span>Chờ chủ phòng</span>';
    rst.title = fin ? '' : filled < meta.mode ? (host ? 'Chờ thêm người chơi — hoặc thêm Bot vào ghế trống để chơi ngay' : 'Chờ thêm người chơi vào phòng') : !allReady ? 'Chờ mọi người bấm Sẵn sàng' : host ? 'Đã đủ người — bấm Bắt đầu' : 'Chờ chủ phòng bắt đầu trận';
    rst.className = 'room-status' + (canStart || (!host && allReady && filled === meta.mode) ? ' ok' : '');
    bs.classList.toggle('btn-end-pulse', canStart);
  }

  App.botLv = function (seat) { var loc = Net.botLevels(App.code)[seat]; return loc || (App.remoteBotLv || {})[seat] || 'medium'; };

  /* ---- nút chọn tộc / trang bị khởi đầu ngay trên khung ghế (người khác chỉ xem) ---- */
  function pickRow(f, fd, pd, hk, sit, mine, locked) {
    var tag = mine ? 'button type="button"' : 'span', end = mine ? 'button' : 'span', cls = mine ? (locked ? ' lk' : ' on') : '';
    var car = mine ? '<i class="pk-car">' + I.ui(locked ? 'lock' : 'down', 10) + '</i>' : '';
    return '<div class="pk-row">' +
      '<' + tag + ' class="pk-btn pk-race' + cls + '"' + (mine ? ' data-act="race"' : '') + ' title="' + esc(fd.name + (pd ? ' · Thiên phú: ' + pd.name : '')) + '">' + I.crest(f, 24) + '<span class="pk-t"><b>' + fd.short + '</b><small>' + (pd ? esc(pd.name) : '') + '</small></span>' + car + '</' + end + '>' +
      '<' + tag + ' class="pk-btn pk-home' + cls + '"' + (mine ? ' data-act="home"' : '') + ' title="' + esc('Trang bị khởi đầu: ' + sit.name + ' — ' + sit.desc) + '">' + I.item(TT.START_ITEMS[hk] || 'kiem', 22) + '<span class="pk-t"><b>' + esc(sit.name) + '</b><small>Khởi đầu</small></span>' + car + '</' + end + '>' +
      '</div>';
  }
  function saveMe(patch) {
    var f0 = Net.RACE_INV[(myRec() || {}).race] || 'dragon';
    try { var sv0 = JSON.parse(localStorage.getItem('ttkc.loadout2') || '{}'); if (patch.race) sv0.faction = Net.RACE_INV[patch.race]; else sv0.faction = sv0.faction || f0; if (patch.passive) sv0.talent = patch.passive; if (patch.homeTileType) sv0.start = patch.homeTileType; localStorage.setItem('ttkc.loadout2', JSON.stringify(sv0)); } catch (e) { }
    return Net.setMe(App.code, patch).catch(function (e) { App.toast(e.message || String(e), 'err'); });
  }
  /* popup Chọn tộc: hàng biểu tượng tộc · mô tả · chọn thiên phú · Lệnh Soái (thu gọn) · Xác nhận */
  App.racePopup = function (me) {
    if (!me) return;
    var f0 = Net.RACE_INV[me.race] || 'dragon', pf = f0, pt = TT.TALENTS[f0].some(function (t) { return t.id === me.passive; }) ? me.passive : TT.TALENTS[f0][0].id;
    App.modal('<div class="rpk"><h2>' + I.ui('crown', 18) + ' Chọn tộc</h2><div id="rp-in"></div></div>', [['Hủy', 'ghost', false], ['Xác nhận', 'gold', true]]).then(function (ok) {
      if (!ok || (pf === f0 && pt === me.passive)) return;
      var patch = { passive: pt }; if (pf !== f0) patch.race = Net.RACE[pf];
      saveMe(patch);
    });
    function paint() {
      var box = $('#rp-in'); if (!box) return;
      var fd = F[pf], tals = TT.TALENTS[pf];
      box.innerHTML = '<div class="rp-facs">' + TT.FACTION_ORDER.map(function (k) { return '<button type="button" class="rp-f' + (k === pf ? ' on' : '') + '" data-f="' + k + '" style="--fc:' + F[k].color + '" title="' + esc(F[k].name) + '">' + I.crest(k, 44) + '<span>' + F[k].short + '</span></button>'; }).join('') + '</div>' +
        '<div class="rp-cols"><div class="rp-desc" style="--fc:' + fd.color + '"><div class="rp-nm"><b>' + fd.name + '</b><small>' + esc(fd.style) + '</small></div>' +
        '' + TT.Acc.wrap('<span class="rp-base"><i>' + I.ui('star', 11) + ' ' + fd.base.name + '</i> ' + fd.base.desc + '</span>', 2) + TT.Acc.wrap('<span class="rp-weak"><i>' + I.ui('warn', 11) + ' ' + fd.weak.name + '</i> ' + fd.weak.desc + '</span>', 2) + '</div>' +
        '<div class="rp-tcol"><div class="rp-h">' + I.ui('diamond', 12) + ' Thiên phú</div><div class="rp-tals">' + tals.map(function (t) { return '<button type="button" class="rp-t' + (t.id === pt ? ' on' : '') + '" data-p="' + t.id + '"><b>' + (t.id === pt ? I.ui('check', 11) + ' ' : '') + t.name + '</b><small>' + t.desc + '</small></button>'; }).join('') + '</div></div></div>' +
        TT.Acc.wrap('<div class="acc-t">' + I.ui('flag', 12) + ' Lệnh Soái của ' + fd.short + ' <small>(tự kích hoạt theo Đời)</small></div>' + TT.ORDERS[pf].map(function (o) { return '<div class="rp-o"><em>' + TT.AGE_ROMAN[o.age] + '</em><div><b>' + o.name + '</b> ' + o.desc + '</div></div>'; }).join(''), 2, 'ord');
      TT.Acc.bind(box, { key: 'race' });
      $$('.rp-f', box).forEach(function (b) { b.onclick = function () { var k = b.dataset.f; if (k === pf) return; pf = k; pt = TT.TALENTS[k][0].id; paint(); }; });
      $$('.rp-t', box).forEach(function (b) { b.onclick = function () { pt = b.dataset.p; paint(); }; });
    }
    paint();
  };
  /* bảng xem thiết lập của một ghế: Nguyên soái 3D (đúng skin), kỹ năng, tộc, thiên phú, trang bị khởi đầu, Lệnh Soái */
  App.seatPreview = function (seat) {
    var d = (App.seatData || {})[seat]; if (!d) return;
    var fd = F[d.f], m = TT.marshalOf(d.f, d.mar), st = marStats(d.f, m), tal = TT.TALENTS[d.f].filter(function (t) { return t.id === d.pas; })[0] || TT.TALENTS[d.f][0];
    var itId = TT.START_ITEMS[d.hk] || 'kiem', it = TT.ITEMS[itId], sk = TT.SKINS[d.skin] || TT.SKINS[TT.SKIN_ORDER[0]];
    var role = d.bot ? 'Bot · ' + TT.Bot.levelName(App.botLv(seat)) : d.host ? 'Chủ phòng' : d.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng';
    var W = TT.Acc.wrap, sec = function (ic, title, body) { return '<div class="sp-sec"><div class="sp-h">' + ic + '<b>' + title + '</b></div>' + body + '</div>'; };
    var orders = TT.ORDERS[d.f].map(function (o) { return '<div class="rp-o"><em>' + TT.AGE_ROMAN[o.age] + '</em><div><b>' + o.name + '</b> ' + o.desc + '</div></div>'; }).join('');
    var html = '<div class="spv" style="--fc:' + fd.color + ';--sc:' + TT.SEAT_COLORS[seat] + '">' +
      '<div class="sp-top"><span class="sp-seat">' + seat + '</span><div class="sp-who"><b>' + esc(d.name) + '</b><small>' + fd.name + ' · ' + esc(d.side || '') + ' · ' + role + '</small></div></div>' +
      '<div class="sp-body"><div class="sp-prev"><canvas id="sp-cv" width="320" height="400"></canvas><div class="sp-skin"><i style="background:' + sk.c + '"></i>' + esc(sk.name) + '</div></div>' +
      '<div class="sp-info">' +
      sec(I.ui('crown', 13), esc(m.name) + ' <small>' + esc(m.tag) + '</small>',
        '<div class="sp-st"><span>' + I.ui('heart', 11) + ' ' + st.hp + '</span><span>' + I.ui('swords', 11) + ' ' + st.atk + '</span><span>' + I.ui('shield', 11) + ' ' + st.def + '</span><span>' + I.ui('bolt', 11) + ' ' + st.as + '/s</span><span>' + I.ui('move', 11) + ' ' + st.spd + '</span><span>' + I.ui('target', 11) + ' ' + st.style + ' ' + st.rng + ' ô</span></div>' +
        W('<i>Nội tại</i> ' + esc(m.psd)) + (m.act ? W('<i>' + esc(m.act.name) + '</i> ' + esc(m.act.desc) + ' <small>(hồi ' + m.act.cd + ' giây)</small>') : '') +
        W('<i>Triệu Hồi</i> Giây thứ ' + (TT.CONFIG.marshal.firstAt || 3) + ' gọi đợt lính đầu, sau đó lặp lại theo loại lính được chọn trong trận. Ngoài giao tranh quá 4 giây thì triệu hồi chậm thêm 3 giây.')) +
      sec(I.crest(d.f, 16), fd.name, W('<i>' + fd.base.name + '</i> ' + fd.base.desc, 2, 'sp-good') + W('<i>' + fd.weak.name + '</i> ' + fd.weak.desc, 2, 'sp-bad')) +
      sec(I.ui('diamond', 13), 'Thiên phú', W('<i>' + tal.name + '</i> ' + tal.desc)) +
      sec(I.ui('bag', 13), 'Khởi đầu', W('<span class="sp-itl">' + I.item(itId, 22) + '</span><i>' + it.name + '</i> ' + it.desc)) +
      sec(I.ui('flag', 13), 'Lệnh Soái của ' + fd.short + ' <small>tự kích hoạt theo Đời</small>', W(orders, 3, 'ord')) +
      '</div></div></div>';
    var mine = d.me && !(d.ready && !d.host) && App.room && !(App.room.meta && App.room.meta.status === 'fin');
    var pv = null;
    App.modal(html, mine ? [['Đóng', 'ghost', false], ['Đổi Nguyên soái / skin', 'gold', 'edit']] : [['Đóng', 'ghost', false]]).then(function (r) { if (pv) pv.dispose(); pv = null; if (r === 'edit') { App.skinPopup(App.seatMe || myRec(), App.skinMapNow || {}); } });
    setTimeout(function () { TT.Acc.bind($('.spv'), {}); var cv = $('#sp-cv'); if (!cv || !TT.marshalPreview) return; pv = TT.marshalPreview(cv, d.f, m.id); if (pv) pv.setSkin(sk.c); }, 30);
  };
  /* popup Trang bị khởi đầu */
  App.homePopup = function (me) {
    if (!me) return;
    var h0 = TT.START_ITEMS[me.homeTileType] ? me.homeTileType : 'gold', ph = h0;
    App.modal('<div class="ipk"><h2>' + I.ui('bag', 18) + ' Trang bị khởi đầu</h2><p class="ip-note">Nằm sẵn trong tủ đồ ngày 1, đeo cho tướng nào cũng được.</p><div id="ip-in"></div></div>', [['Hủy', 'ghost', false], ['Xác nhận', 'gold', true]]).then(function (ok) {
      if (!ok || ph === h0) return;
      saveMe({ homeTileType: ph });
    });
    function paint() {
      var box = $('#ip-in'); if (!box) return;
      box.innerHTML = '<div class="ip-opts">' + ['gold', 'food', 'wood'].map(function (k) { var id = TT.START_ITEMS[k], it = TT.ITEMS[id]; return '<button type="button" class="ip-o' + (k === ph ? ' on' : '') + '" data-h="' + k + '">' + I.item(id, 34) + '<span><b>' + it.name + '</b><small>' + it.desc + '</small></span>' + (k === ph ? '<i class="ip-ck">' + I.ui('check', 12) + '</i>' : '') + '</button>'; }).join('') + '</div>';
      $$('.ip-o', box).forEach(function (b) { b.onclick = function () { ph = b.dataset.h; paint(); }; });
    }
    paint();
  };

  /* ---- popup Nguyên soái: tab 1 chọn mẫu Nguyên soái (kỹ năng, nội tại, chỉ số), tab 2 chọn skin màu quân ---- */
  function marStats(f, m) {
    var R = TT.ROLES.nguyensoai, fm = F[f].mods, G = TT.CONFIG.gen, md = m.mods || {};
    return {
      hp: Math.round(R.hp * (fm.hp + (md.hp || 0)) / 100 * G.hp / 100), atk: Math.round(R.atk * (fm.atk + (md.atk || 0)) / 100 * G.atk / 100),
      def: Math.round(R.def * (fm.def + (md.def || 0)) / 100 * G.def / 100), as: (R.as * (fm.as + (md.as || 0)) / 100).toFixed(2), spd: (R.spd * (fm.spd + (md.spd || 0)) / 100).toFixed(1), rng: ((m.rng || R.rng) + (m.ps && m.ps.rangeAdd || 0)).toFixed(1), style: (m.melee === false || (m.melee == null && (m.rng || R.rng) > 1.5)) ? (m.magic ? 'Đánh xa · phép' : 'Đánh xa') : 'Cận chiến'
    };
  }
  App.skinPopup = App.marshalPopup = function (me, skinMap) {
    if (!me) return;
    var f = Net.RACE_INV[me.race] || 'dragon', curSkin = me.skin && TT.SKINS[me.skin] ? me.skin : null, seat = me.seat;
    var curMar = TT.marshalOf(f, me.mar).id, pickMar = curMar, pickSkin = curSkin, tab = 'mar';
    var taken = {}; Object.keys(skinMap).forEach(function (k) { if (k !== seat) taken[skinMap[k]] = k; });
    var ids = TT.MARSHAL_LIST, per = matchMedia('(max-height: 520px)').matches ? 12 : 18, page = Math.floor(ids.indexOf(pickMar) / per), pages = Math.ceil(ids.length / per);
    var html = '<div class="mp"><div class="mp-tabs"><button type="button" class="on" data-t="mar">' + I.ui('crown', 14) + ' Nguyên soái</button><button type="button" data-t="skin">' + I.ui('palette', 14) + ' Skin</button></div>' +
      '<div class="mp-body"><div class="mp-prev"><canvas id="skin-cv" width="360" height="440"></canvas></div><div class="mp-main" id="mp-main"></div></div></div>';
    var pv = null;
    var done = App.modal(html, [['Hủy', 'ghost', false], ['Xác nhận', 'gold', true]]).then(function (ok) {
      if (pv) pv.dispose(); pv = null; if (!ok) return;
      var patch = { skin: pickSkin || null, mar: pickMar };
      try { var sv = JSON.parse(localStorage.getItem('ttkc.loadout2') || '{}'); sv.skin = pickSkin || null; sv.mar = pickMar; localStorage.setItem('ttkc.loadout2', JSON.stringify(sv)); } catch (e) { }
      Net.setMe(App.code, patch).catch(function (e) { App.toast(e.message || String(e), 'err'); });
    });
    function skHex() { return TT.SKINS[pickSkin || skinMap[seat]].c; }
    function paint() {
      var box = $('#mp-main'); if (!box) return;
      $$('.mp-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
      if (tab === 'mar') {
        var m = TT.MARSHALS[pickMar], st = marStats(f, m);
        var list = ids.slice(page * per, page * per + per).map(function (id) { var mm = TT.MARSHALS[id], img = TT.marshalSnap ? TT.marshalSnap(f, id, skHex(), 96, 120) : ''; return '<button type="button" class="mp-it' + (id === pickMar ? ' on' : '') + '" data-m="' + id + '" title="' + esc(mm.name) + '">' + (img ? '<img alt="" src="' + img + '">' : I.crest(f, 30)) + '</button>'; }).join('');
        var sm = TT.UNITS[f + '.nguyensoai'].sk;
        box.innerHTML = '<div class="mp-list">' + list + '</div><div class="mp-pg"><button type="button" data-d="-1"' + (page <= 0 ? ' disabled' : '') + ' aria-label="Trang trước">' + I.ui('back', 12) + '</button><span>' + (page + 1) + ' / ' + pages + '</span><button type="button" data-d="1"' + (page >= pages - 1 ? ' disabled' : '') + ' aria-label="Trang sau">' + I.ui('back', 12) + '</button></div><div class="mp-info"><div class="mp-nm"><b>' + esc(m.name) + '</b><small>' + esc(m.tag) + '</small></div>' +
          '<div class="mp-st"><span>' + I.ui('heart', 11) + ' ' + st.hp + '</span><span>' + I.ui('swords', 11) + ' ' + st.atk + '</span><span>' + I.ui('shield', 11) + ' ' + st.def + '</span><span>' + I.ui('bolt', 11) + ' ' + st.as + '/s</span><span>' + I.ui('move', 11) + ' ' + st.spd + '</span><span>' + I.ui('target', 11) + ' ' + st.style + ' ' + st.rng + ' ô</span></div>' +
          TT.Acc.wrap('<span class="mp-sk"><i>Nội tại</i> ' + esc(m.psd) + '</span>') +
          (m.act ? TT.Acc.wrap('<span class="mp-sk"><i>' + esc(m.act.name) + '</i> ' + esc(m.act.desc) + ' <small>(hồi ' + m.act.cd + ' giây)</small></span>') : '') +
          TT.Acc.wrap('<span class="mp-sk"><i>' + esc(sm.name) + '</i> Giây thứ ' + (TT.CONFIG.marshal.firstAt || 3) + ' gọi đợt lính đầu tiên, sau đó lặp lại theo thời gian hồi của loại lính đã chọn (không giới hạn). Ngoài giao tranh quá 4 giây thì chậm thêm 3 giây.</span>') + '</div>';
        TT.Acc.bind(box, { key: 'mar' });
        $$('.mp-pg button', box).forEach(function (b) { b.onclick = function () { page = Math.max(0, Math.min(pages - 1, page + (+b.dataset.d))); paint(); }; });
        $$('.mp-it', box).forEach(function (b) { b.onclick = function () { pickMar = b.dataset.m; if (pv) pv.setRace(f, pickMar), pv.setSkin(skHex()); paint(); }; });
      } else {
        var grid = TT.SKIN_ORDER.map(function (k) { var sk = TT.SKINS[k], tk = taken[k]; return '<button type="button" class="skin-opt' + (k === pickSkin ? ' active' : '') + (tk ? ' taken' : '') + '"' + (tk ? ' disabled aria-disabled="true"' : '') + ' data-k="' + k + '" style="--sk:' + sk.c + '" title="' + esc(sk.name) + (tk ? ' — người khác đang dùng' : '') + '" aria-label="' + esc(sk.name) + '"><i></i></button>'; }).join('');
        var sk0 = TT.SKINS[pickSkin || skinMap[seat]];
        box.innerHTML = '<div class="skin-nm"><i style="background:' + sk0.c + '"></i><b>' + esc(sk0.name) + '</b>' + (pickSkin ? '' : '<small>Tự động</small>') + '</div><div class="skin-grid">' + grid + '</div>' +
          '<button type="button" class="skin-auto' + (pickSkin ? '' : ' active') + '" id="skin-auto">' + I.ui('bolt', 14) + ' Tự động</button>';
        $$('.skin-opt', box).forEach(function (b) { b.onclick = function () { if (taken[b.dataset.k]) { App.toast('Skin này đã có người chọn', 'err'); return; } pickSkin = b.dataset.k; if (pv) pv.setSkin(skHex()); paint(); }; });
        $('#skin-auto').onclick = function () { pickSkin = null; if (pv) pv.setSkin(skHex()); paint(); };
      }
    }
    $$('.mp-tabs button').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; paint(); }; });
    setTimeout(function () { var cv = $('#skin-cv'); if (!cv) return; pv = TT.marshalPreview ? TT.marshalPreview(cv, f, pickMar) : null; if (pv) pv.setSkin(skHex()); paint(); }, 30);
    paint();
    return done;
  };

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
