/* node tests/run-tests.js — kiểm thử lõi luật (GDD 15.9) + bot tự đấu + replay */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', 'js', 'core');
require(path.join(root, 'data.js'));
require(path.join(root, 'engine.js'));
require(path.join(root, 'bot.js'));
const TT = globalThis.TT, E = TT.Engine;

let pass = 0, fail = 0;
function ok(cond, name, extra) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } }
function A(st, cmd) { const r = E.apply(st, cmd); if (!r.ok) throw new Error(cmd.c + ': ' + r.err); return r; }

function setup(mode, facs, passives, seed) {
  const seats = mode === 2 ? [0, 2] : mode === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  return E.init({
    seed: seed || 1234, mode, teamMode: false, players: seats.map((s, i) => ({
      seat: s, uid: 'u' + s, name: 'P' + s, faction: facs[i], passive: passives[i], home: ['V', 'T', 'G'][i % 3]
    }))
  });
}
// sandbox: xóa mọi quân, đặt quân tùy ý; người đang đi là p0, qua miễn chiến
function sandbox(facs, passives) {
  const st = setup(2, facs, passives || [null, null]);
  st.teams = {}; st.nextId = 1; st.active = 0; st.cur = st.order.indexOf(0);
  st.players.forEach(p => { p.pturn = 10; p.age = 4; p.res = { V: 50, T: 50, G: 50 }; });
  st.phase = 'buy';
  return st;
}
function put(st, o, t, x, y, n, extra) {
  const id = st.nextId++;
  st.teams[id] = Object.assign({ id, o, t, x, y, n: n || 1, na: 0, rest: -99, st: {} }, extra || {});
  if (t === 'beast' && st.teams[id].hp == null) st.teams[id].hp = 3;
  if (t === 'worker' && !st.teams[id].job) st.teams[id].job = 'V';
  return st.teams[id];
}
function resOf(st, p) { const r = st.players[p].res; return r.V + r.T + r.G; }

console.log('== Ca kiểm thử bắt buộc (GDD 15.9) ==');
// 1. 10 → 4 → 2 → 0 qua 3 lượt: 0/0/2
{
  let st = sandbox(['human', 'human']);
  const tgt = put(st, 1, 'soldier', 3, 3, 10);
  put(st, 0, 'soldier', 3, 4, 6); // đánh 6 → còn 4
  let before = resOf(st, 0);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(st.teams[1].n === 4 && resOf(st, 0) === before, '10→4 không thưởng');
  st.teams[2].na = 0; st.players[0].used = 0; st.teams[2].n = 2;
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(st.teams[1].n === 2 && resOf(st, 0) === before, '4→2 không thưởng');
  st.teams[2].na = 0; st.players[0].used = 0; st.teams[2].n = 3;
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3], opt: { rw: 'V' } }).state;
  ok(!st.teams[1] && resOf(st, 0) === before + 2, '2→0 thưởng 2', resOf(st, 0) - before);
}
// 2. cùng lượt 10→4→0: 0 rồi 4
{
  let st = sandbox(['human', 'human']);
  put(st, 1, 'soldier', 3, 3, 10); put(st, 0, 'soldier', 3, 4, 6); put(st, 0, 'soldier', 2, 3, 6);
  const b = resOf(st, 0);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(resOf(st, 0) === b, 'đòn 1 không thưởng');
  st = A(st, { c: 'act', p: 0, id: 3, tgt: [3, 3] }).state;
  ok(resOf(st, 0) === b + 4, 'đòn 2 thưởng 4', resOf(st, 0) - b);
}
// 3. overkill 9 lên 2 HP → 2
{
  let st = sandbox(['human', 'human']);
  put(st, 1, 'soldier', 3, 3, 2); put(st, 0, 'soldier', 3, 4, 9);
  const b = resOf(st, 0);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(resOf(st, 0) === b + 2, 'overkill thưởng 2');
}
// 4. Thần thú 2 HP chết → 2, không mua lại
{
  let st = sandbox(['human', 'human']);
  put(st, 1, 'beast', 3, 3, 1, { hp: 2 }); put(st, 0, 'soldier', 3, 4, 3);
  st.players[1].beast = true;
  const b = resOf(st, 0);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(resOf(st, 0) === b + 2, 'thần thú 2HP thưởng 2');
  ok(st.players[1].beast === true, 'cờ mua thần thú giữ nguyên');
}
// 5. 6 Kỵ Quỷ Đoạt Sinh → 7, CD
{
  let st = sandbox(['demon', 'human'], ['doatsinh', 'laisuat']);
  put(st, 1, 'soldier', 3, 3, 2); put(st, 0, 'cavalry', 3, 5, 6);
  st = A(st, { c: 'act', p: 0, id: 2, to: [3, 4], tgt: [3, 3] }).state;
  const t = st.teams[2];
  ok(t && t.n === 7 && t.x === 3 && t.y === 3, 'Đoạt Sinh 6→7', t && t.n);
  ok(st.players[0].ready.doatsinh === 13, 'CD Đoạt Sinh = t+3');
  // CD chưa xong: không tăng
  put(st, 1, 'soldier', 3, 2, 1); st.players[0].used = 0; t.na = 0;
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 2] }).state;
  ok(st.teams[2].n === 7, 'CD chưa xong không tăng');
}
// 6. Đội 20 Quỷ mất 3 → 17
{
  let st = sandbox(['human', 'demon']);
  put(st, 1, 'soldier', 3, 3, 20); put(st, 0, 'soldier', 3, 4, 3);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(st.teams[1].n === 17, 'đội 20 giữ 17');
  ok(st.players[1].souls === 1 + 3, 'Quỷ +3 Hồn');
}
// 7. bắn chết / không chiếm → không cộng
{
  let st = sandbox(['demon', 'human'], ['doatsinh', null]);
  put(st, 1, 'soldier', 3, 3, 1); put(st, 0, 'cavalry', 3, 4, 2);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 3], opt: { occ: false } }).state;
  ok(st.teams[2].n === 2, 'không chiếm thì không tăng');
  let s2 = sandbox(['demon', 'human'], ['doatsinh', null]);
  put(s2, 1, 'soldier', 3, 2, 1); put(s2, 0, 'archer', 3, 4, 2);
  s2 = A(s2, { c: 'act', p: 0, id: 2, tgt: [3, 2] }).state;
  ok(s2.teams[2].n === 2, 'bắn chết không tăng');
}
// 8. Hiến Tế = 2 Hồn; Huyết Tế dùng Dân = 1 Hồn
{
  let st = sandbox(['demon', 'human']);
  put(st, 0, 'worker', 2, 6, 2);
  const s0 = st.players[0].souls;
  st = A(st, { c: 'hiente', p: 0, id: 1 }).state;
  ok(st.players[0].souls === s0 + 2 && resOf(st, 0) === 150, 'Hiến Tế đúng 2 Hồn');
  put(st, 1, 'soldier', 2, 4, 3);
  st = A(st, { c: 'skill', p: 0, a: 'huyette', id: 1, tgt: [2, 4] }).state;
  ok(st.players[0].souls === s0 + 3, 'Huyết Tế 1 Hồn', st.players[0].souls - s0);
  ok(st.teams[2].n === 1, 'Huyết Tế 2 sát thương');
}
// 9. Điều Binh đội đã hành động
{
  let st = sandbox(['human', 'human']);
  put(st, 0, 'commander', 3, 5); put(st, 0, 'archer', 3, 4, 2);
  st = A(st, { c: 'act', p: 0, id: 2, to: [4, 4] }).state;
  // đội cung giờ ở 4,4 không kề CH (3,5)? kề chéo — dời lại
  st.teams[2].x = 3; st.teams[2].y = 4;
  st = A(st, { c: 'dieubinh', p: 0, cmdId: 1, id: 2, to: [2, 4] }).state;
  ok(st.teams[2].x === 2 && st.teams[2].na === 2, 'Điều Binh giữ cờ đã hành động');
  ok(!E.apply(st, { c: 'act', p: 0, id: 2, to: [2, 3] }).ok, 'không hành động lại');
}
// 10. Phá Trận đẩy vào ô có quân → không đẩy, damage vẫn áp
{
  let st = sandbox(['human', 'human']);
  put(st, 0, 'elephant', 3, 5, 2); put(st, 1, 'soldier', 3, 4, 4); put(st, 1, 'soldier', 3, 3, 1);
  st = A(st, { c: 'act', p: 0, id: 1, tgt: [3, 4], opt: { phatran: true } }).state;
  ok(st.teams[2].n === 2 && st.teams[2].y === 4, 'Phá Trận bị chặn vẫn gây sát thương');
  ok(st.players[0].res.G === 48, 'Phá Trận trừ 2G');
}
// 11. Vua chết → loại ngay, không thưởng/Hồn từ quân biến mất
{
  let st = sandbox(['human', 'demon']);
  put(st, 1, 'king', 3, 3); put(st, 1, 'soldier', 6, 1, 5); put(st, 0, 'soldier', 3, 4, 1); put(st, 0, 'king', 0, 7);
  const souls = st.players[1].souls, b = resOf(st, 0);
  st = A(st, { c: 'act', p: 0, id: 3, tgt: [3, 3], opt: { rw: 'G' } }).state;
  ok(!st.players[1].alive && st.over && resOf(st, 0) === b + 3, 'diệt Vua thưởng 3, thắng');
  ok(!E.teamIds(st).some(id => st.teams[id].o === 1), 'quân người thua biến mất');
  ok(st.players[1].souls === souls, 'không Hồn từ quân biến mất');
}
// 12. từ lượt 40 chỉ Dân trên ô đúng nghề
{
  let st = setup(2, ['human', 'dragon'], ['laisuat', 'longgiap'], 99);
  const p = st.active, home = E.homeCell(st, p);
  st.players[p].pturn = 40; st.phase = 'start';
  st.teams[st.nextId] = { id: st.nextId, o: p, t: 'worker', job: st.players[p].home, x: home[0], y: home[1], n: 2, na: 0, rest: -1, st: {} }; st.nextId++;
  const sp = E.spawnCells(st, p)[0];
  st.teams[st.nextId] = { id: st.nextId, o: p, t: 'worker', job: 'V', x: sp[0], y: sp[1], n: 3, na: 0, rest: -1, st: {} }; st.nextId++;
  const b = resOf(st, p);
  st = A(st, { c: 'harvest', p: p }).state;
  ok(resOf(st, p) === b + 4, 'Suy Tàn: chỉ 2 dân trên ô ×2 = 4', resOf(st, p) - b);
}
// 13. miễn chiến
{
  let st = setup(2, ['dragon', 'demon'], ['longgiap', 'oanhon'], 5);
  ok(E.inPeace(st), 'lượt 1 miễn chiến');
  ok(!E.apply(st, { c: 'skill', p: st.active, a: st.players[st.active].faction === 'dragon' ? 'longhong' : 'loinguyen', id: 1 }).ok, 'khóa kỹ năng hostile');
}
// 14. Thuẫn binh −1 tầm xa, Thiên Mạc, Long Giáp mỗi vòng
{
  let st = sandbox(['human', 'fairy']);
  put(st, 1, 'shield', 3, 2, 3); put(st, 0, 'archer', 3, 4, 2);
  st = A(st, { c: 'act', p: 0, id: 2, tgt: [3, 2] }).state;
  ok(st.teams[1].n === 2, 'Cung 2 vào Thuẫn: 1 sát thương');
  let s2 = sandbox(['human', 'fairy']);
  put(s2, 1, 'soldier', 3, 3, 3, { st: { shield: { v: 1, e: { p: 1, t: 11, at: 'start' } } } }); put(s2, 0, 'soldier', 3, 4, 3); put(s2, 0, 'soldier', 2, 3, 2);
  s2 = A(s2, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(s2.teams[1].n === 3 && !s2.teams[1].st.shield, 'Thiên Mạc chặn đòn đầu');
  s2 = A(s2, { c: 'act', p: 0, id: 3, tgt: [3, 3] }).state;
  ok(s2.teams[1].n === 1, 'đòn sau bình thường');
  let s3 = sandbox(['human', 'dragon'], [null, 'longgiap']);
  put(s3, 1, 'soldier', 3, 3, 5); put(s3, 0, 'soldier', 3, 4, 3); put(s3, 0, 'soldier', 2, 3, 3);
  s3 = A(s3, { c: 'act', p: 0, id: 2, tgt: [3, 3] }).state;
  ok(s3.teams[1].n === 3, 'Long Giáp −1 đòn đầu vòng');
  s3 = A(s3, { c: 'act', p: 0, id: 3, tgt: [3, 3] }).state;
  ok(s3.teams[1] == null, 'đòn thứ hai đủ sát thương');
}
// 15. Công thành ×2, Long Lực, Chỉ Huy
{
  let st = sandbox(['dragon', 'human'], ['longno', null]);
  put(st, 0, 'siege', 3, 6, 2); put(st, 1, 'soldier', 3, 3, 10);
  st = A(st, { c: 'skill', p: 0, a: 'longluc', id: 1 }).state;
  st = A(st, { c: 'act', p: 0, id: 1, tgt: [3, 3] }).state;
  ok(st.teams[2].n === 10 - 6 - 0, 'Công thành 2 ×2 +50% = 6', st.teams[2].n);
}
// 16. Tách/gộp không nhân bản
{
  let st = sandbox(['human', 'human']);
  put(st, 0, 'soldier', 3, 5, 4);
  st = A(st, { c: 'act', p: 0, id: 1, k: 2, to: [3, 4] }).state;
  ok(st.teams[1].n === 2 && st.teams[2].n === 2 && st.teams[2].na === 2, 'tách 4→2+2');
  st = A(st, { c: 'act', p: 0, id: 1, to: [3, 4] }).state;
  ok(!st.teams[1] && st.teams[2].n === 4 && st.teams[2].na === 4, 'gộp lại, tất cả đã hành động');
  ok(!E.apply(st, { c: 'act', p: 0, id: 2, to: [3, 3] }).ok, 'không đi lại sau gộp');
}
// 17. Hối Lộ
{
  let st = sandbox(['human', 'demon']);
  put(st, 0, 'soldier', 3, 4); put(st, 1, 'cavalry', 3, 3);
  st = A(st, { c: 'skill', p: 0, a: 'hoilo', id: 2 }).state;
  ok(st.teams[2].o === 0 && resOf(st, 0) === 150 - 10 && E.isResting(st, st.teams[2]), 'Hối Lộ Kỵ (giá 5 → trả 10)');
}

console.log('== Bot tự đấu + replay hash ==');
const FAC = TT.FACTION_ORDER;
const results = {}, lengths = [];
let games = 0, errs = 0;
function playGame(mode, seed, facs) {
  const seats = mode === 2 ? [0, 2] : mode === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  const players = seats.map((s, i) => {
    const f = facs[i]; const ps = TT.FACTIONS[f].passives;
    return { seat: s, uid: 'b' + s, name: 'Bot' + s, faction: f, passive: ps[(seed + i) % 3].id, home: 'VTG'[(seed + i) % 3], bot: true };
  });
  const setupObj = { seed, mode, teamMode: false, ranked: true, secondBonus: true, players };
  let st = E.init(setupObj);
  const log = [];
  let turns = 0;
  while (!st.over && turns < 800) {
    const p = st.active;
    const cmds = TT.Bot.planTurn(st, p, (players[p] && players[p].level) || 'medium');
    for (const c0 of cmds) {
      const c = Object.assign({ p }, c0);
      const r = E.apply(st, c);
      if (!r.ok) { errs++; console.log('  bot cmd fail', c, r.err); break; }
      st = r.state;
    }
    log.push(cmds);
    if (st.active === p && !st.over) { st = E.apply(st, { c: 'end', p }).state; }
    turns++;
  }
  // replay
  let r2 = E.init(setupObj);
  for (const pkg of log) for (const c of pkg) { const r = E.apply(r2, Object.assign({ p: r2.active }, c)); if (r.ok) r2 = r.state; }
  return { st, same: E.hash(r2) === E.hash(st), turns };
}
let replayOK = true;
const t0 = Date.now();
for (let g = 0; g < 48; g++) {
  const mode = g % 6 === 0 ? 4 : g % 6 === 1 ? 3 : 2;
  const n = mode;
  const facs = []; for (let i = 0; i < n; i++) facs.push(FAC[(g + i * (1 + (g % 3))) % 4]);
  const { st, same, turns } = playGame(mode, 1000 + g, facs);
  games++;
  if (!same) replayOK = false;
  lengths.push(st.round);
  if (mode === 2 && st.winner && st.winner.length === 1) {
    const f = st.players[st.winner[0]].faction;
    results[f] = (results[f] || 0) + 1;
  }
  if (g < 6) console.log('  ván', g, 'mode', mode, facs.join('/'), '→ vòng', st.round, st.draw ? 'hòa' : 'thắng: ' + (st.winner || []).map(i => st.players[i].faction).join(','), 'lượt', turns);
}
ok(replayOK, 'replay cùng seed/log ra cùng hash');
ok(errs === 0, 'bot không sinh lệnh lỗi', errs);
console.log('  ' + games + ' ván trong ' + (Date.now() - t0) + 'ms; vòng trung vị', lengths.sort((a, b) => a - b)[lengths.length >> 1], '; thắng 1v1 theo tộc', JSON.stringify(results));
console.log('\nKết quả: ' + pass + ' đạt, ' + fail + ' lỗi');
process.exit(fail ? 1 : 0);
