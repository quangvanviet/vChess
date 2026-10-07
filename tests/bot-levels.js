/* node tests/bot-levels.js — đấu chéo các mức bot để kiểm chứng độ khó */
'use strict';
const path = require('path'); const root = path.join(__dirname, '..', 'js', 'core');
require(path.join(root, 'data.js')); require(path.join(root, 'engine.js')); require(path.join(root, 'bot.js'));
const TT = globalThis.TT, E = TT.Engine;
function game(levels, facs, seed) {
  const players = [0, 2].map((s, i) => ({ seat: s, uid: 'b' + s, name: 'B' + s, faction: facs[i], passive: TT.FACTIONS[facs[i]].passives[seed % 3].id, home: 'VTG'[(seed + i) % 3] }));
  let st = E.init({ seed, mode: 2, ranked: true, secondBonus: true, players });
  let n = 0;
  while (!st.over && n++ < 400) {
    const p = st.active;
    for (const c of TT.Bot.planTurn(st, p, levels[p])) { const r = E.apply(st, Object.assign({ p }, c)); if (r.ok) st = r.state; }
    if (!st.over && st.active === p) st = E.apply(st, { c: 'end', p }).state;
  }
  return st;
}
const FAC = TT.FACTION_ORDER, pairs = [['hard', 'easy'], ['hard', 'medium'], ['medium', 'easy']];
const N = +process.argv[2] || 16;
for (const [a, b] of pairs) {
  let wa = 0, wb = 0, dr = 0, rounds = 0, t0 = Date.now();
  for (let g = 0; g < N; g++) {
    const facs = [FAC[g % 4], FAC[(g + 1 + (g >> 2)) % 4]];
    const swap = g % 2 === 1; // đổi bên để công bằng đi trước
    const lv = swap ? [b, a] : [a, b];
    const st = game(lv, swap ? [facs[1], facs[0]] : facs, 5000 + g);
    rounds += st.round;
    const w = st.winner && st.winner.length === 1 ? lv[st.winner[0]] : null;
    if (!w || st.draw) dr++; else if (w === a) wa++; else wb++;
  }
  console.log(`${a} vs ${b}: ${wa}-${wb} (hòa ${dr}) · vòng TB ${(rounds / N).toFixed(1)} · ${((Date.now() - t0) / N / 1000).toFixed(2)}s/ván`);
}
