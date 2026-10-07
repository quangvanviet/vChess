/* Dịch vụ mạng mức cao: tài khoản, hồ sơ, sảnh, phòng, ghế, chat, sổ lệnh.
 * Bám đúng cấu trúc rooms/{mã} của luật Firebase: meta / seats / players / turn / commands / result.
 * Các nút mở rộng (lobby, lobbyChat, users, presence, rooms/{mã}/chat) là tùy chọn:
 * nếu luật chưa cho phép, tính năng tương ứng tự tắt và báo trên giao diện.
 */
(function (G) {
  'use strict';
  var TT = G.TT;
  var Net = TT.Net = { B: null, user: null, ext: { lobby: true, chat: true, users: true, presence: true } };

  Net.RACE = { dragon: 'rong', human: 'nhan', fairy: 'tien', demon: 'quy' };
  Net.RACE_INV = { rong: 'dragon', nhan: 'human', tien: 'fairy', quy: 'demon' };
  Net.HOME = { V: 'gold', T: 'food', G: 'wood' };
  Net.HOME_INV = { gold: 'V', food: 'T', wood: 'G' };

  /* tùy chọn ván nằm ở 4 bit thấp của seed (meta không cho thêm trường) */
  Net.encodeSeed = function (o) {
    var base = Math.floor(Math.random() * 0x7fffffff);
    return base * 16 + (o.teamMode ? 1 : 0) + (o.ranked ? 2 : 0) + (o.secondBonus ? 4 : 0);
  };
  Net.decodeSeed = function (seed) {
    var f = seed % 16;
    return { teamMode: !!(f & 1), ranked: !!(f & 2), secondBonus: !!(f & 4), rngSeed: Math.floor(seed / 16) >>> 0 };
  };
  Net.sideOf = function (mode, seatStr) { var n = +seatStr; return mode === 2 ? [0, 2][n - 1] : n - 1; };
  Net.seatOfSide = function (mode, side) { return String(mode === 2 ? (side === 0 ? 1 : 2) : side + 1); };

  Net.botLoadout = function (seed, seatStr) {
    var r = TT.Engine.rng((Math.floor(seed / 16) ^ (+seatStr * 2654435761)) >>> 0);
    var f = TT.FACTION_ORDER[r() % 4], fd = TT.FACTIONS[f];
    return { faction: f, passive: fd.passives[r() % 3].id, home: 'VTG'[r() % 3], name: 'Bot ' + fd.short };
  };

  function isPerm(e) { return e && /permission|PERMISSION_DENIED/i.test(String(e.code || e.message || e)); }
  Net.isPerm = isPerm;

  Net.init = function () { Net.B = TT.createBackend(); return Net.B; };
  Net.onAuth = function (cb) {
    Net.B.onAuth(function (u) {
      Net.user = u;
      if (u) { Net.ensureProfile(); Net.presence(true); }
      cb(u);
    });
  };
  Net.register = function (e, p, n, r) { return Net.B.register(e, p, n, r); };
  Net.login = function (e, p, r) { return Net.B.login(e, p, r); };
  Net.guest = function (n) { return Net.B.guest(n); };
  Net.logout = function () { Net.presence(false); return Net.B.logout(); };

  /* ---------- hồ sơ (users/{uid}) ---------- */
  Net.defaultProfile = function () {
    return { name: Net.user.name, guest: !!Net.user.guest, avatar: 0, games: 0, wins: 0, losses: 0, rating: 1000, fav: '', createdAt: Net.B.TS };
  };
  Net.ensureProfile = function () {
    var u = Net.user; if (!u) return Promise.resolve(null);
    return Net.B.get('users/' + u.uid).then(function (p) {
      if (!p) { p = Net.defaultProfile(); return Net.B.set('users/' + u.uid, p).then(function () { return p; }); }
      if (p.name !== u.name && u.name) Net.B.update('users/' + u.uid, { name: u.name });
      return p;
    }).catch(function (e) { if (isPerm(e)) Net.ext.users = false; return null; });
  };
  Net.getProfile = function (uid) {
    return Net.B.get('users/' + (uid || Net.user.uid)).catch(function (e) { if (isPerm(e)) Net.ext.users = false; return null; })
      .then(function (p) { return p || (uid && uid !== Net.user.uid ? null : Net.localProfile()); });
  };
  Net.localProfile = function () {
    try { return JSON.parse(localStorage.getItem('ttkc.profile.' + Net.user.uid)) || Object.assign(Net.defaultProfile(), { createdAt: Date.now() }); } catch (e) { return Net.defaultProfile(); }
  };
  Net.updateProfile = function (patch) {
    if (patch.name) { Net.user.name = patch.name; Net.B.rename(patch.name); }
    try { var lp = Net.localProfile(); localStorage.setItem('ttkc.profile.' + Net.user.uid, JSON.stringify(Object.assign(lp, patch))); } catch (e) { }
    return Net.B.update('users/' + Net.user.uid, patch).catch(function () { });
  };
  Net.recordResult = function (won, summary) {
    var uid = Net.user.uid;
    var apply = function (p) {
      p = p || Net.defaultProfile();
      p.games = (p.games || 0) + 1;
      if (won === true) { p.wins = (p.wins || 0) + 1; p.rating = (p.rating || 1000) + 25; }
      else if (won === false) { p.losses = (p.losses || 0) + 1; p.rating = Math.max(0, (p.rating || 1000) - 15); }
      return p;
    };
    try { var lp = apply(Net.localProfile()); lp.createdAt = lp.createdAt && lp.createdAt['.sv'] ? Date.now() : lp.createdAt; localStorage.setItem('ttkc.profile.' + uid, JSON.stringify(lp)); } catch (e) { }
    if (summary) Net.B.push('users/' + uid + '/history', summary).catch(function () { });
    return Net.B.txn('users/' + uid, function (p) { return apply(p); }).catch(function () { });
  };
  Net.history = function () {
    return Net.B.get('users/' + Net.user.uid + '/history').then(function (h) {
      return h ? Object.keys(h).map(function (k) { return h[k]; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, 20) : [];
    }).catch(function () { return []; });
  };
  Net.leaderboard = function () {
    if (Net.B.kind === 'firebase') {
      return Net.B.ref('users').orderByChild('rating').limitToLast(20).once('value').then(function (s) {
        var out = []; s.forEach(function (c) { var v = c.val(); out.push({ uid: c.key, name: v.name, rating: v.rating, wins: v.wins, games: v.games }); });
        return out.reverse();
      }).catch(function (e) { if (isPerm(e)) Net.ext.users = false; return null; });
    }
    return Net.B.get('users').then(function (u) {
      return Object.keys(u || {}).map(function (k) { var v = u[k]; return { uid: k, name: v.name, rating: v.rating, wins: v.wins, games: v.games }; })
        .sort(function (a, b) { return b.rating - a.rating; }).slice(0, 20);
    });
  };

  /* ---------- hiện diện ---------- */
  Net.presence = function (on) {
    var u = Net.user; if (!u) return;
    var p = 'presence/' + u.uid;
    if (on) { Net.B.set(p, { name: u.name, at: Net.B.TS }).then(function () { Net.B.onDisconnectRemove(p); }).catch(function (e) { if (isPerm(e)) Net.ext.presence = false; }); }
    else Net.B.remove(p).catch(function () { });
  };
  Net.watchOnline = function (cb) { return Net.B.on('presence', function (v, err) { if (err) { Net.ext.presence = false; cb(null); return; } cb(v ? Object.keys(v).length : 0); }); };

  /* ---------- sảnh ---------- */
  Net.watchLobby = function (cb) {
    return Net.B.on('lobby', function (v, err) {
      if (err) { Net.ext.lobby = false; cb(null, err); return; }
      var now = Net.B.now();
      var list = Object.keys(v || {}).map(function (k) { var r = v[k]; r.code = k; return r; })
        .filter(function (r) { return !r.private && (typeof r.createdAt !== 'number' || now - r.createdAt < 12 * 3600e3); })
        .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      cb(list, null);
    });
  };
  Net.watchLobbyChat = function (cb) {
    return Net.B.onAdded('lobbyChat', function (k, m) { cb(m); }, { limitToLast: 40, onError: function () { Net.ext.chat = false; } });
  };
  Net.sendLobbyChat = function (text) {
    return Net.B.push('lobbyChat', { uid: Net.user.uid, name: Net.user.name.slice(0, 24), text: String(text).slice(0, 200), ts: Net.B.TS });
  };

  /* ---------- phòng ---------- */
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genCode() { var s = ''; for (var i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
  Net.defaultPlayer = function (seat) {
    var saved = {}; try { saved = JSON.parse(localStorage.getItem('ttkc.loadout') || '{}'); } catch (e) { }
    var f = saved.faction && TT.FACTIONS[saved.faction] ? saved.faction : 'dragon';
    var pas = TT.FACTIONS[f].passives.some(function (p) { return p.id === saved.passive; }) ? saved.passive : TT.FACTIONS[f].passives[0].id;
    return { seat: seat, name: Net.user.name.slice(0, 24), race: Net.RACE[f], passive: pas, homeTileType: Net.HOME[saved.home] || 'food', ready: false, lastSeen: Net.B.TS };
  };

  Net.createRoom = function (o) {
    var u = Net.user, tries = 0;
    function attempt() {
      var code = genCode();
      return Net.B.get('rooms/' + code + '/meta').then(function (m) {
        if (m) { if (++tries > 5) throw new Error('Không tạo được mã phòng'); return attempt(); }
        var seed = Net.encodeSeed(o);
        var meta = { ruleVersion: TT.RULE_VERSION, mode: o.mode, seed: seed, status: 'lobby', hostUid: u.uid, createdAt: Net.B.TS, turnLimitMs: o.turnLimitMs };
        return Net.B.set('rooms/' + code + '/meta', meta)
          .then(function () { return Net.B.txn('rooms/' + code + '/seats/1', function (c) { return c ? undefined : u.uid; }); })
          .then(function () { return Net.B.set('rooms/' + code + '/players/' + u.uid, Net.defaultPlayer('1')); })
          .then(function () { Net.publishLobby(code, { name: o.name, mode: o.mode, private: !!o.private, count: 1, status: 'lobby', opts: Net.decodeSeed(seed), turnLimitMs: o.turnLimitMs }, true); return code; });
      });
    }
    return attempt();
  };
  Net.publishLobby = function (code, data, first) {
    if (!Net.ext.lobby && !first) return Promise.resolve();
    var d = Object.assign({ hostUid: Net.user.uid, hostName: Net.user.name.slice(0, 24) }, data);
    if (first) d.createdAt = Net.B.TS;
    var p = first ? Net.B.set('lobby/' + code, d) : Net.B.update('lobby/' + code, data);
    return p.then(function () { Net.B.onDisconnectRemove('lobby/' + code); }).catch(function (e) { if (isPerm(e)) Net.ext.lobby = false; });
  };

  Net.joinRoom = function (code) {
    code = String(code || '').trim().toUpperCase();
    var u = Net.user, base = 'rooms/' + code;
    return Net.B.get(base + '/meta').then(function (meta) {
      if (!meta) throw new Error('Không tìm thấy phòng ' + code);
      if (meta.ruleVersion !== TT.RULE_VERSION) throw new Error('Phòng dùng phiên bản luật khác (' + meta.ruleVersion + ')');
      return Net.B.get(base + '/seats').then(function (seats) {
        seats = seats || {};
        var mine = Object.keys(seats).filter(function (s) { return seats[s] === u.uid; });
        if (meta.status !== 'lobby') {
          if (mine.length) return { code: code, rejoin: true };
          throw new Error(meta.status === 'playing' ? 'Trận đã bắt đầu' : 'Trận đã kết thúc');
        }
        // đã có ghế (ví dụ chủ phòng vào lại)
        var p0 = mine.length ? Promise.resolve(mine[0]) : (function claim(n) {
          if (n > meta.mode) throw new Error('Phòng đã đủ người');
          return Net.B.txn(base + '/seats/' + n, function (c) { return c ? undefined : u.uid; })
            .then(function (r) { return r.committed && r.val === u.uid ? String(n) : claim(n + 1); });
        })(1);
        return p0.then(function (seat) {
          return Net.B.set(base + '/players/' + u.uid, Net.defaultPlayer(seat)).then(function () { return { code: code, seat: seat }; });
        });
      });
    });
  };

  Net.watchRoom = function (code, cb) {
    var base = 'rooms/' + code, room = { code: code, meta: null, seats: {}, players: {}, turn: null, result: null, loaded: {} };
    var subs = [];
    function emit() { cb(room); }
    ['meta', 'seats', 'players', 'turn', 'result'].forEach(function (k) {
      subs.push(Net.B.on(base + '/' + k, function (v, err) {
        if (err) { room.loaded[k] = 'err'; room.errors = room.errors || {}; room.errors[k] = err; }
        else { room[k] = v || (k === 'seats' || k === 'players' ? {} : null); room.loaded[k] = true; }
        emit();
      }));
    });
    return function () { subs.forEach(function (f) { f(); }); };
  };
  Net.setMe = function (code, patch) { return Net.B.update('rooms/' + code + '/players/' + Net.user.uid, patch); };
  Net.heartbeat = function (code) { return Net.B.set('rooms/' + code + '/players/' + Net.user.uid + '/lastSeen', Net.B.TS).catch(function () { }); };
  Net.changeSeat = function (code, from, to) {
    var base = 'rooms/' + code;
    return Net.B.txn(base + '/seats/' + to, function (c) { return c ? undefined : Net.user.uid; }).then(function (r) {
      if (!r.committed) throw new Error('Ghế đã có người');
      return Net.setMe(code, { seat: String(to), ready: false }).then(function () { return Net.B.remove(base + '/seats/' + from); });
    });
  };
  Net.addBot = function (code, seat) {
    return Net.B.txn('rooms/' + code + '/seats/' + seat, function (c) { return c ? undefined : Net.user.uid; });
  };
  Net.freeSeat = function (code, seat) { return Net.B.remove('rooms/' + code + '/seats/' + seat); };
  Net.leaveRoom = function (code, room) {
    var u = Net.user, base = 'rooms/' + code;
    if (!room || !room.meta) return Promise.resolve();
    if (room.meta.status === 'lobby') {
      if (room.meta.hostUid === u.uid) return Net.B.remove(base).catch(function () { }).then(function () { return Net.B.remove('lobby/' + code).catch(function () { }); });
      var mySeats = Object.keys(room.seats || {}).filter(function (s) { return room.seats[s] === u.uid; });
      return Net.B.remove(base + '/players/' + u.uid).catch(function () { })
        .then(function () { return Promise.all(mySeats.map(function (s) { return Net.B.remove(base + '/seats/' + s).catch(function () { }); })); });
    }
    return Promise.resolve();
  };
  Net.watchRoomChat = function (code, cb) {
    return Net.B.onAdded('rooms/' + code + '/chat', function (k, m) { cb(m); }, { limitToLast: 60, onError: function () { Net.ext.chat = false; } });
  };
  Net.sendRoomChat = function (code, text) {
    return Net.B.push('rooms/' + code + '/chat', { uid: Net.user.uid, name: Net.user.name.slice(0, 24), text: String(text).slice(0, 200), ts: Net.B.TS })
      .catch(function (e) { if (isPerm(e)) Net.ext.chat = false; throw e; });
  };

  /* ---------- trận ---------- */
  Net.startGame = function (code, firstSeat) {
    var base = 'rooms/' + code;
    return Net.B.set(base + '/turn', { seat: String(firstSeat), startedAt: Net.B.TS, nextSeq: 1 })
      .then(function () { return Net.B.set(base + '/meta/status', 'playing'); })
      .then(function () { Net.B.cancelDisconnect('lobby/' + code); return Net.publishLobby(code, { status: 'playing' }); });
  };
  Net.watchCommands = function (code, cb, onErr) {
    return Net.B.onAdded('rooms/' + code + '/commands', function (k, v) { cb(v); }, { onError: onErr });
  };
  Net.pushTurn = function (code, entry, nextTurn) {
    var up = {}; up['commands/' + entry.seq] = entry; up.turn = nextTurn;
    return Net.B.update('rooms/' + code, up);
  };
  Net.finish = function (code, winnerSeat) {
    var base = 'rooms/' + code;
    return Net.B.set(base + '/result', { winnerSeat: String(winnerSeat), endedAt: Net.B.TS }).catch(function () { })
      .then(function () { return Net.B.set(base + '/meta/status', 'finished').catch(function () { }); })
      .then(function () { return Net.B.remove('lobby/' + code).catch(function () { }); });
  };

  /* dựng thiết lập ván từ dữ liệu phòng (giống hệt trên mọi máy) */
  Net.buildSetup = function (room) {
    var meta = room.meta, mode = meta.mode, opt = Net.decodeSeed(meta.seed);
    var bySeat = {};
    Object.keys(room.players || {}).forEach(function (uid) { var p = room.players[uid]; if (room.seats[p.seat] === uid) bySeat[p.seat] = { uid: uid, p: p }; });
    var players = [];
    for (var n = 1; n <= mode; n++) {
      var s = String(n), uid = room.seats[s];
      if (!uid) continue;
      if (bySeat[s]) {
        var pp = bySeat[s].p;
        players.push({ seat: Net.sideOf(mode, s), roomSeat: s, uid: uid, name: pp.name, faction: Net.RACE_INV[pp.race], passive: pp.passive, home: Net.HOME_INV[pp.homeTileType], bot: false });
      } else {
        var b = Net.botLoadout(meta.seed, s);
        players.push({ seat: Net.sideOf(mode, s), roomSeat: s, uid: uid, name: b.name + ' ' + s, faction: b.faction, passive: b.passive, home: b.home, bot: true });
      }
    }
    return { seed: opt.rngSeed, mode: mode, teamMode: opt.teamMode && mode === 4, ranked: opt.ranked, secondBonus: opt.secondBonus, players: players };
  };
})(window);
