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

  /* tùy chọn ván nằm ở 4 bit thấp của seed (meta không cho thêm trường): bit0 = 2 đấu 2, bit1 = khóa bản đồ */
  Net.encodeSeed = function (o) {
    var base = Math.floor(Math.random() * 0x7fffffff);
    return base * 16 + (o.teamMode ? 1 : 0) + (o.lockMap ? 2 : 0);
  };
  Net.decodeSeed = function (seed) {
    var f = seed % 16;
    return { teamMode: !!(f & 1), lockMap: !!(f & 2), rngSeed: Math.floor(seed / 16) >>> 0 };
  };
  Net.botLoadout = function (seed, seatStr) {
    var lo = TT.Bot.loadout(Math.floor(seed / 16) >>> 0, seatStr);
    return { faction: lo.race, talent: lo.talent, start: lo.start, name: 'Bot ' + TT.FACTIONS[lo.race].short };
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
    var saved = {}; try { saved = JSON.parse(localStorage.getItem('ttkc.loadout2') || '{}'); } catch (e) { }
    var f = saved.faction && TT.FACTIONS[saved.faction] ? saved.faction : 'dragon';
    var tal = TT.TALENTS[f].some(function (t) { return t.id === saved.talent; }) ? saved.talent : TT.TALENTS[f][0].id;
    return { seat: seat, name: Net.user.name.slice(0, 24), race: Net.RACE[f], passive: tal, homeTileType: TT.START_ITEMS[saved.start] ? saved.start : 'gold', ready: false, lastSeen: Net.B.TS };
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
  /* độ khó bot: chỉ máy chủ phòng cần biết (bot chạy ở đó); công bố vào lobby/{mã}/bots để người khác xem */
  Net.botLevels = function (code) { try { return JSON.parse(localStorage.getItem('ttkc.botlv.' + code) || '{}'); } catch (e) { return {}; } };
  Net.setBotLevel = function (code, seat, lv) {
    var m = Net.botLevels(code); m[seat] = lv;
    try { localStorage.setItem('ttkc.botlv.' + code, JSON.stringify(m)); } catch (e) { }
    return Net.B.set('lobby/' + code + '/bots/' + seat, lv).catch(function () { });
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

  /* ---------- đổi thiết lập phòng (chỉ chủ phòng, khi còn ở phòng chờ) ----------
     o: {mode, teamMode, lockMap, turnLimitMs, name, private} — trường nào bỏ trống thì giữ nguyên.
     Hạ số ghế: ghế bot thừa được gỡ; còn người thật ở ghế thừa thì từ chối. */
  Net.updateRoomOpts = function (code, room, o) {
    var meta = room.meta, base = 'rooms/' + code, host = meta.hostUid;
    if (host !== Net.user.uid) return Promise.reject(new Error('Chỉ chủ phòng được đổi thiết lập'));
    if (meta.status !== 'lobby') return Promise.reject(new Error('Trận đã bắt đầu'));
    var cur = Net.decodeSeed(meta.seed);
    var mode = o.mode == null ? meta.mode : o.mode;
    var team = mode === 4 && !!(o.teamMode == null ? cur.teamMode : o.teamMode);
    var lock = !!(o.lockMap == null ? cur.lockMap : o.lockMap);
    var turn = o.turnLimitMs == null ? meta.turnLimitMs : o.turnLimitMs;
    var drop = [];
    for (var n = mode + 1; n <= 4; n++) {
      var s = String(n), uid = room.seats[s];
      if (!uid) continue;
      var pl = room.players[uid];
      if (pl && pl.seat === s) return Promise.reject(new Error('Còn người chơi ở ghế ' + n + ' — mời họ ra trước khi giảm số người'));
      if (uid !== host) return Promise.reject(new Error('Ghế ' + n + ' đang có người vào'));
      drop.push(s);
    }
    var seed = Math.floor(meta.seed / 16) * 16 + (team ? 1 : 0) + (lock ? 2 : 0);
    return Promise.all(drop.map(function (s) { return Net.freeSeat(code, s); }))
      .then(function () { return Net.B.update(base + '/meta', { mode: mode, seed: seed, turnLimitMs: turn }); })
      .then(function () {
        var d = { mode: mode, opts: Net.decodeSeed(seed), turnLimitMs: turn };
        if (o.name != null) d.name = o.name;
        if (o.private != null) d.private = !!o.private;
        d.count = Object.keys(room.seats).filter(function (k) { return drop.indexOf(k) < 0; }).length;
        return Net.publishLobby(code, d, false);
      });
  };
  /* Mở lại phòng chờ sau trận (chủ phòng): dọn dữ liệu ván cũ, đặt status = 'lobby',
     bỏ trạng thái sẵn sàng của mọi người, đăng lại phòng lên sảnh. Người khác chỉ cần chờ status về 'lobby'. */
  Net.reopenRoom = function (code, room) {
    var meta = room && room.meta, base = 'rooms/' + code;
    if (!meta || meta.status !== 'finished') return Promise.resolve(false);
    if (meta.hostUid !== Net.user.uid) return Promise.resolve(false);
    var nop = function () { };
    return Promise.all(['days', 'result', 'quit', 'turn', 'commands'].map(function (k) { return Net.B.remove(base + '/' + k).catch(nop); }))
      .then(function () { return Net.B.set(base + '/meta/status', 'lobby'); })
      .then(function () {
        return Promise.all(Object.keys(room.players || {}).map(function (uid) { return Net.B.set(base + '/players/' + uid + '/ready', false).catch(nop); }));
      })
      .then(function () {
        var opt = Net.decodeSeed(meta.seed), nm, pv = false;
        try { nm = localStorage.getItem('ttkc.roomName.' + code); pv = localStorage.getItem('ttkc.roomPriv.' + code) === '1'; } catch (e) { }
        var lv = Net.botLevels(code);
        return Net.publishLobby(code, { name: nm || ('Phòng ' + meta.mode + ' người'), mode: meta.mode, private: pv, count: Object.keys(room.seats || {}).length, status: 'lobby', opts: opt, turnLimitMs: meta.turnLimitMs }, true)
          .then(function () { return Promise.all(Object.keys(lv).map(function (s) { return Net.B.set('lobby/' + code + '/bots/' + s, lv[s]).catch(nop); })); });
      })
      .then(function () { return true; });
  };

  /* ---------- trận (2.0: chuẩn bị đồng thời, commit–reveal theo ngày) ----------
     rooms/{mã}/days/{n}/c/{ghế}  mã băm đội hình (ghi/xóa được tới khi có lock)
     rooms/{mã}/days/{n}/lock     {at, seats} khóa chuẩn bị (chủ phòng; quá hạn thì ai cũng ghi được)
     rooms/{mã}/days/{n}/r/{ghế}  {p: gói đội hình, n: nonce} (ghi 1 lần sau lock)
     rooms/{mã}/days/{n}/fin      {at, seats} chốt các gói được dùng → mọi máy mô phỏng giao tranh
     rooms/{mã}/days/0/fin        mốc bắt đầu trận
     rooms/{mã}/quit/{ghế}        ngày đầu hàng */
  Net.startGame = function (code) {
    var base = 'rooms/' + code;
    return Net.B.set(base + '/days/0/fin', { at: Net.B.TS, seats: '' })
      .then(function () { return Net.B.set(base + '/meta/status', 'playing'); })
      .then(function () { Net.B.cancelDisconnect('lobby/' + code); return Net.publishLobby(code, { status: 'playing' }); });
  };
  Net.watchDays = function (code, cb) { return Net.B.on('rooms/' + code + '/days', function (v, err) { cb(v || {}, err); }); };
  Net.watchQuit = function (code, cb) { return Net.B.on('rooms/' + code + '/quit', function (v) { cb(v || {}); }); };
  Net.commit = function (code, day, seat, h) { return Net.B.set('rooms/' + code + '/days/' + day + '/c/' + seat, h); };
  Net.uncommit = function (code, day, seat) { return Net.B.remove('rooms/' + code + '/days/' + day + '/c/' + seat); };
  Net.reveal = function (code, day, seat, payload, nonce) { return Net.B.set('rooms/' + code + '/days/' + day + '/r/' + seat, { p: payload, n: nonce }); };
  Net.lockDay = function (code, day, seats) { return Net.B.txn('rooms/' + code + '/days/' + day + '/lock', function (c) { return c ? undefined : { at: Net.B.TS, seats: seats.join(',') }; }); };
  Net.finDay = function (code, day, seats) { return Net.B.txn('rooms/' + code + '/days/' + day + '/fin', function (c) { return c ? undefined : { at: Net.B.TS, seats: seats.join(',') }; }); };
  Net.quit = function (code, seat, day) { return Net.B.set('rooms/' + code + '/quit/' + seat, day); };
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
        var pp = bySeat[s].p, race = Net.RACE_INV[pp.race] || 'dragon';
        var tal = TT.TALENTS[race].some(function (t) { return t.id === pp.passive; }) ? pp.passive : TT.TALENTS[race][0].id;
        players.push({ seat: s, uid: uid, name: pp.name, race: race, talent: tal, start: TT.START_ITEMS[pp.homeTileType] ? pp.homeTileType : 'gold', bot: null });
      } else {
        var b = Net.botLoadout(meta.seed, s);
        players.push({ seat: s, uid: uid, name: b.name + ' ' + s, race: b.faction, talent: b.talent, start: b.start, bot: true });
      }
    }
    return { seed: opt.rngSeed, mode: mode, teamMode: opt.teamMode && mode === 4, lockMap: opt.lockMap, players: players };
  };
})(window);
