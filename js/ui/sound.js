/* Âm thanh tổng hợp bằng WebAudio — không cần tệp âm thanh. */
(function (G) {
  'use strict';
  var TT = G.TT, S = TT.Sound = { on: true };
  try { S.on = localStorage.getItem('ttkc.sound') !== '0'; } catch (e) { }
  var ctx = null;
  function ac() { if (!ctx) { try { ctx = new (G.AudioContext || G.webkitAudioContext)(); } catch (e) { ctx = null; } } return ctx; }
  function tone(f, d, type, vol, slide, delay) {
    var c = ac(); if (!c || !S.on) return;
    var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol, hp) {
    var c = ac(); if (!c || !S.on) return;
    var b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), a = b.getChannelData(0);
    for (var i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp || 800; s.buffer = b; g.gain.value = vol || 0.08;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  S.play = function (name) {
    if (!S.on) return;
    switch (name) {
      case 'click': tone(660, 0.05, 'triangle', 0.04); break;
      case 'move': tone(240, 0.09, 'triangle', 0.05, 1.6); break;
      case 'hit': noise(0.12, 0.12, 600); tone(140, 0.12, 'sawtooth', 0.05, 0.5); break;
      case 'shoot': noise(0.08, 0.06, 2500); tone(900, 0.08, 'sine', 0.03, 0.4); break;
      case 'die': tone(300, 0.35, 'sawtooth', 0.05, 0.25); noise(0.25, 0.06, 300); break;
      case 'coin': tone(988, 0.08, 'square', 0.03); tone(1319, 0.14, 'square', 0.03, 1, 0.07); break;
      case 'buy': tone(523, 0.06, 'triangle', 0.04); tone(784, 0.1, 'triangle', 0.04, 1, 0.05); break;
      case 'age': [392, 523, 659, 784].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.05, 1, i * 0.09); }); break;
      case 'turn': tone(440, 0.18, 'sine', 0.06); tone(660, 0.25, 'sine', 0.05, 1, 0.12); break;
      case 'skill': tone(330, 0.3, 'sine', 0.06, 3); noise(0.2, 0.03, 3000); break;
      case 'dice': noise(0.05, 0.05, 1500); break;
      case 'win': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.4, 'triangle', 0.06, 1, i * 0.13); }); break;
      case 'lose': [392, 349, 311, 262].forEach(function (f, i) { tone(f, 0.45, 'sine', 0.06, 1, i * 0.16); }); break;
      case 'err': tone(180, 0.15, 'square', 0.03); break;
      case 'msg': tone(880, 0.06, 'sine', 0.03); break;
    }
  };
  S.toggle = function () { S.on = !S.on; try { localStorage.setItem('ttkc.sound', S.on ? '1' : '0'); } catch (e) { } return S.on; };
})(window);
