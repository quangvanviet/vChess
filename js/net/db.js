/* Lớp lưu trữ: cùng một giao diện cho Firebase Realtime Database và bản demo cục bộ.
 * DB:   now(), TS, get, set, update, remove, push, txn, on, onAdded, onDisconnectRemove, onConnected
 * Auth: onAuth, register, login, guest, logout, current
 */
(function (G) {
  'use strict';
  var TT = G.TT = G.TT || {};

  function viAuthError(e) {
    var c = (e && e.code) || '';
    var map = {
      'auth/email-already-in-use': 'Email này đã được đăng ký.',
      'auth/invalid-email': 'Email không hợp lệ.',
      'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
      'auth/user-not-found': 'Không tìm thấy tài khoản.',
      'auth/wrong-password': 'Sai mật khẩu.',
      'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
      'auth/invalid-login-credentials': 'Email hoặc mật khẩu không đúng.',
      'auth/too-many-requests': 'Thử quá nhiều lần, vui lòng đợi.',
      'auth/network-request-failed': 'Lỗi mạng — không kết nối được Firebase.',
      'auth/operation-not-allowed': 'Phương thức đăng nhập này chưa được bật trong Firebase Console (Authentication → Sign-in method).',
      'auth/admin-restricted-operation': 'Đăng nhập khách (Anonymous) chưa được bật trong Firebase Console.'
    };
    return map[c] || (e && e.message) || 'Lỗi không xác định';
  }
  TT.viAuthError = viAuthError;

  /* ======================= FIREBASE ======================= */
  function FirebaseBackend(cfg) {
    this.kind = 'firebase';
    this.app = firebase.initializeApp(cfg);
    try { if (firebase.analytics && cfg.measurementId) firebase.analytics(); } catch (e) { /* analytics tùy chọn */ }
    this.auth = firebase.auth();
    this.db = firebase.database();
    this.TS = firebase.database.ServerValue.TIMESTAMP;
    this.offset = 0;
    var self = this;
    this.db.ref('.info/serverTimeOffset').on('value', function (s) { self.offset = s.val() || 0; });
  }
  FirebaseBackend.prototype = {
    now: function () { return Date.now() + this.offset; },
    ref: function (p) { return this.db.ref(p); },
    get: function (p) { return this.ref(p).once('value').then(function (s) { return s.val(); }); },
    set: function (p, v) { return this.ref(p).set(v); },
    update: function (p, obj) { return this.ref(p).update(obj); },
    remove: function (p) { return this.ref(p).remove(); },
    push: function (p, v) { var r = this.ref(p).push(); return r.set(v).then(function () { return r.key; }); },
    txn: function (p, fn) {
      return this.ref(p).transaction(fn, null, false).then(function (r) { return { committed: r.committed, val: r.snapshot.val() }; });
    },
    on: function (p, cb) {
      var r = this.ref(p);
      var h = r.on('value', function (s) { cb(s.val(), null); }, function (err) { cb(null, err); });
      return function () { r.off('value', h); };
    },
    onAdded: function (p, cb, opts) {
      var q = this.ref(p).orderByKey();
      if (opts && opts.limitToLast) q = q.limitToLast(opts.limitToLast);
      var h = q.on('child_added', function (s) { cb(s.key, s.val()); }, function (err) { if (opts && opts.onError) opts.onError(err); });
      return function () { q.off('child_added', h); };
    },
    onDisconnectRemove: function (p) { try { this.ref(p).onDisconnect().remove(); } catch (e) { } },
    cancelDisconnect: function (p) { try { this.ref(p).onDisconnect().cancel(); } catch (e) { } },
    onConnected: function (cb) { var r = this.ref('.info/connected'); r.on('value', function (s) { cb(!!s.val()); }); },
    // ---- auth ----
    onAuth: function (cb) {
      this.auth.onAuthStateChanged(function (u) {
        cb(u ? { uid: u.uid, name: u.displayName || (u.isAnonymous ? 'Khách' : (u.email || '').split('@')[0]), email: u.email || '', guest: !!u.isAnonymous } : null);
      });
    },
    setPersist: function (remember) {
      var P = firebase.auth.Auth.Persistence;
      return this.auth.setPersistence(remember ? P.LOCAL : P.SESSION).catch(function () { });
    },
    register: function (email, pw, name, remember) {
      var a = this.auth;
      return this.setPersist(remember).then(function () { return a.createUserWithEmailAndPassword(email, pw); })
        .then(function (c) { return c.user.updateProfile({ displayName: name }).then(function () { return { uid: c.user.uid, name: name, email: email, guest: false }; }); })
        .catch(function (e) { throw new Error(viAuthError(e)); });
    },
    login: function (email, pw, remember) {
      var a = this.auth;
      return this.setPersist(remember).then(function () { return a.signInWithEmailAndPassword(email, pw); })
        .then(function (c) { var u = c.user; return { uid: u.uid, name: u.displayName || email.split('@')[0], email: email, guest: false }; })
        .catch(function (e) { throw new Error(viAuthError(e)); });
    },
    guest: function (name) {
      var a = this.auth;
      return this.setPersist(false).then(function () { return a.signInAnonymously(); })
        .then(function (c) { return c.user.updateProfile({ displayName: name }).then(function () { return { uid: c.user.uid, name: name, email: '', guest: true }; }); })
        .catch(function (e) { throw new Error(viAuthError(e)); });
    },
    rename: function (name) { var u = this.auth.currentUser; return u ? u.updateProfile({ displayName: name }) : Promise.resolve(); },
    logout: function () { return this.auth.signOut(); }
  };

  /* ======================= LOCAL (demo nhiều tab) ======================= */
  var KEY = 'ttkc.db.v1', UKEY = 'ttkc.users.v1', SKEY = 'ttkc.session.v1';
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function parts(p) { return String(p).split('/').filter(Boolean); }
  function getAt(t, p) { var a = parts(p), c = t; for (var i = 0; i < a.length; i++) { if (c == null || typeof c !== 'object') return null; c = c[a[i]]; } return c === undefined ? null : c; }
  function setAt(t, p, v) {
    var a = parts(p); if (!a.length) return v == null ? {} : v;
    var c = t, stack = [];
    for (var i = 0; i < a.length - 1; i++) {
      if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = {};
      stack.push([c, a[i]]); c = c[a[i]];
    }
    if (v == null) delete c[a[a.length - 1]]; else c[a[a.length - 1]] = v;
    for (var j = stack.length - 1; j >= 0; j--) { var o = stack[j][0][stack[j][1]]; if (o && typeof o === 'object' && !Object.keys(o).length) delete stack[j][0][stack[j][1]]; }
    return t;
  }
  function resolveTS(v) {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      var o = Array.isArray(v) ? [] : {};
      Object.keys(v).forEach(function (k) { o[k] = resolveTS(v[k]); });
      return o;
    }
    return v;
  }
  function keySort(a, b) {
    var na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
    if (na && nb) return (+a) - (+b);
    if (na) return -1; if (nb) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  var pushCounter = 0;
  function pushKey() { return '-' + Date.now().toString(36) + ('000' + (pushCounter++ % 1296).toString(36)).slice(-2) + Math.random().toString(36).slice(2, 6); }

  function LocalBackend() {
    this.kind = 'local';
    this.TS = { '.sv': 'timestamp' };
    this.listeners = [];
    this.disc = [];
    this.authCbs = [];
    var self = this;
    try { this.bc = new BroadcastChannel('ttkc'); this.bc.onmessage = function () { self._notify(); }; } catch (e) { this.bc = null; }
    window.addEventListener('storage', function (ev) { if (ev.key === KEY) self._notify(); });
    window.addEventListener('pagehide', function () { self._runDisconnect(); });
    this.user = lsGet(SKEY, null) || (function () { try { var s = sessionStorage.getItem(SKEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } })();
  }
  LocalBackend.prototype = {
    now: function () { return Date.now(); },
    _tree: function () { var t = lsGet(KEY, null); return t || this.mem || {}; },
    _write: function (changes) {
      var t = this._tree();
      changes.forEach(function (c) { t = setAt(t, c[0], resolveTS(c[1])); });
      this.mem = t; lsSet(KEY, t);
      if (this.bc) this.bc.postMessage(1);
      this._notify();
      return Promise.resolve();
    },
    _notify: function () {
      var self = this;
      clearTimeout(this._nt);
      this._nt = setTimeout(function () {
        var t = self._tree();
        self.listeners.slice().forEach(function (l) {
          if (l.dead) return;
          var v = getAt(t, l.path);
          if (l.type === 'value') {
            var s = JSON.stringify(v);
            if (s !== l.last) { l.last = s; l.cb(v == null ? null : JSON.parse(s), null); }
          } else {
            var keys = v && typeof v === 'object' ? Object.keys(v).sort(keySort) : [];
            if (l.limit && !l.primed) { keys.slice(0, Math.max(0, keys.length - l.limit)).forEach(function (k) { l.seen[k] = 1; }); }
            l.primed = true;
            keys.forEach(function (k) { if (!l.seen[k]) { l.seen[k] = 1; l.cb(k, v[k]); } });
          }
        });
      }, 0);
    },
    get: function (p) { return Promise.resolve(getAt(this._tree(), p)); },
    set: function (p, v) { return this._write([[p, v]]); },
    update: function (p, obj) { var ch = []; Object.keys(obj).forEach(function (k) { ch.push([p + '/' + k, obj[k]]); }); return this._write(ch); },
    remove: function (p) { return this._write([[p, null]]); },
    push: function (p, v) { var k = pushKey(); var self = this; return this._write([[p + '/' + k, v]]).then(function () { return k; }); },
    txn: function (p, fn) {
      var cur = getAt(this._tree(), p);
      var nv = fn(cur == null ? null : JSON.parse(JSON.stringify(cur)));
      if (nv === undefined) return Promise.resolve({ committed: false, val: cur });
      var self = this;
      return this._write([[p, nv]]).then(function () { return { committed: true, val: resolveTS(nv) }; });
    },
    on: function (p, cb) {
      var l = { path: p, type: 'value', cb: cb, last: undefined };
      this.listeners.push(l); this._notify();
      return function () { l.dead = true; };
    },
    onAdded: function (p, cb, opts) {
      var l = { path: p, type: 'added', cb: cb, seen: {}, limit: opts && opts.limitToLast };
      this.listeners.push(l); this._notify();
      return function () { l.dead = true; };
    },
    onDisconnectRemove: function (p) { if (this.disc.indexOf(p) < 0) this.disc.push(p); },
    cancelDisconnect: function (p) { this.disc = this.disc.filter(function (x) { return x !== p; }); },
    _runDisconnect: function () { var t = this._tree(); this.disc.forEach(function (p) { t = setAt(t, p, null); }); lsSet(KEY, t); if (this.bc) this.bc.postMessage(1); },
    onConnected: function (cb) { cb(true); },
    // ---- auth (phiên theo từng tab để thử nhiều người chơi) ----
    _setUser: function (u, remember) {
      this.user = u;
      try { sessionStorage.setItem(SKEY, JSON.stringify(u)); } catch (e) { }
      if (remember) lsSet(SKEY, u); else try { localStorage.removeItem(SKEY); } catch (e) { }
      var self = this; this.authCbs.forEach(function (cb) { cb(self.user); });
    },
    onAuth: function (cb) {
      this.authCbs.push(cb);
      var u; try { u = JSON.parse(sessionStorage.getItem(SKEY) || 'null') || lsGet(SKEY, null); } catch (e) { u = null; }
      this.user = u; setTimeout(function () { cb(u); }, 0);
    },
    _hash: function (s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); },
    register: function (email, pw, name, remember) {
      email = (email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error('Email không hợp lệ.'));
      if ((pw || '').length < 6) return Promise.reject(new Error('Mật khẩu cần ít nhất 6 ký tự.'));
      var us = lsGet(UKEY, {});
      if (us[email]) return Promise.reject(new Error('Email này đã được đăng ký.'));
      var u = { uid: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, email: email, guest: false };
      us[email] = { uid: u.uid, pw: this._hash(pw), name: name }; lsSet(UKEY, us);
      this._setUser(u, remember); return Promise.resolve(u);
    },
    login: function (email, pw, remember) {
      email = (email || '').trim().toLowerCase();
      var us = lsGet(UKEY, {}), r = us[email];
      if (!r || r.pw !== this._hash(pw || '')) return Promise.reject(new Error('Email hoặc mật khẩu không đúng.'));
      var u = { uid: r.uid, name: r.name, email: email, guest: false };
      this._setUser(u, remember); return Promise.resolve(u);
    },
    guest: function (name) {
      var u = { uid: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, email: '', guest: true };
      this._setUser(u, false); return Promise.resolve(u);
    },
    rename: function (name) {
      if (this.user) { this.user.name = name; this._setUser(this.user, !!lsGet(SKEY, null)); }
      return Promise.resolve();
    },
    logout: function () {
      try { sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY); } catch (e) { }
      this.user = null; var self = this; this.authCbs.forEach(function (cb) { cb(null); });
      return Promise.resolve();
    }
  };

  TT.createBackend = function () {
    var forceLocal = G.TT_FORCE_LOCAL || /[?&]local=1/.test(location.search);
    if (!forceLocal && G.firebase && G.TT_FIREBASE_CONFIG && G.TT_FIREBASE_CONFIG.apiKey) {
      try { return new FirebaseBackend(G.TT_FIREBASE_CONFIG); } catch (e) { console.warn('Firebase lỗi, chuyển demo cục bộ', e); }
    }
    return new LocalBackend();
  };
})(window);
