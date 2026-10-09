/* Giải đấu cân bằng: mọi cặp tộc 1v1 (đổi ghế), bot cùng mức. node tests/balance.js [số seed] [mức] */
var S = require('./sim.js'), TT = S.TT;
var N = +process.argv[2] || 4, LV = process.argv[3] || 'medium', races = TT.FACTION_ORDER;
var win = {}, games = {}, pair = {}, dw = {}, dg = {}, seat1 = 0, seatG = 0;
races.forEach(function (r) { win[r] = 0; games[r] = 0; dw[r] = 0; dg[r] = 0; });
var t0 = Date.now(), maxSec = 0;
for (var i = 0; i < races.length; i++) for (var j = i + 1; j < races.length; j++) {
  var a = races[i], b = races[j], k = a + '-' + b; pair[k] = 0;
  for (var s = 0; s < N; s++) [[a, b], [b, a]].forEach(function (rr, o) {
    var r = S.playMatch({ seed: 1000 + s * 17 + o, mode: 2, races: rr, levels: [LV, LV] });
    maxSec = Math.max(maxSec, r.maxSec);
    var w = TT.Match.player(r.M, r.standings[0].seat).race;
    win[w]++; games[a]++; games[b]++; if (w === a) pair[k]++;
    r.M.history.forEach(function (h) { Object.keys(h.ranks).forEach(function (st) { var rc = TT.Match.player(r.M, st).race; dg[rc]++; if (h.ranks[st] === 1) { dw[rc]++; if (st === '1') seat1++; } }); seatG++; });
  });
}
races.forEach(function (r) { console.log(r, 'thắng ván', win[r] + '/' + games[r], Math.round(win[r] * 100 / games[r]) + '%', '· thắng ngày', Math.round(dw[r] * 100 / dg[r]) + '%'); });
console.log('ghế 1 thắng ngày', Math.round(seat1 * 100 / seatG) + '%');
Object.keys(pair).forEach(function (k) { console.log(k, pair[k] + '/' + (2 * N)); });
console.log('thời gian', Math.round((Date.now() - t0) / 1000) + 's', 'giao tranh dài nhất', maxSec + 's');
