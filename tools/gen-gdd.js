/* Sinh tài liệu GDD 3.0 từ dữ liệu game: node tools/gen-gdd.js [template] [output] */
global.window = global;
const path = require('path'), fs = require('fs');
const R = path.join(__dirname, '../js/core/') + '/';
['data.js', 'maps.js', 'prep.js', 'match.js', 'bot.js'].forEach(f => require(R + f));
const C = TT.CONFIG, F = TT.FACTIONS, rom = TT.AGE_ROMAN, GC = C.gen;
const tbl = (h, rows) => '| ' + h.join(' | ') + ' |\n|' + h.map(() => '---').join('|') + '|\n' + rows.map(r => '| ' + r.map(String).join(' | ') + ' |').join('\n');
const fl = Math.floor;
const v = {};

/* ---------- chung ---------- */
const d2 = TT.mapDims(2), d4 = TT.mapDims(4);
Object.assign(v, {
  DIM2: d2.W + ' × ' + d2.H, DIM4: d4.W + ' × ' + d4.H, DAYS_N: C.days, DAY1: C.prepDay1Bonus, RESSEC: C.resultSec, TICK: C.tick,
  RULEVER: TT.RULE_VERSION, NUNITS: Object.keys(TT.UNITS).length, NITEMS: TT.ITEM_ORDER.length, NCORES: TT.CORE_ORDER.length, NROLES: TT.ROLE_ORDER.length
});

/* ---------- kinh tế: Vàng ---------- */
let tot = 0; for (let d = 1; d <= C.days; d++) tot += C.goldIncome[d];
v.GOLDTOTAL = tot; v.GOLDDAY1 = C.goldIncome[1];
v.INCOME = tbl(['Ngày'].concat(Array.from({ length: C.days }, (_, i) => String(i + 1))).concat(['Tổng']),
  [['Vàng cơ bản'].concat(C.goldIncome.slice(1, C.days + 1)).concat(['**' + tot + '**'])]);
Object.assign(v, { INTPER: C.interestPer, INTMAX: C.interestMax, INTFULL: C.interestPer * C.interestMax, XPDAILY: C.xpDaily, XPCOST: C.xpBuyCost, XPAMT: C.xpBuyAmount,
  REROLL: C.rerollCost, FREERR: C.freeRerolls, COREBOARD: C.coreBoard, CORELOCKS: C.coreLocks, INVSIZE: C.invSize, GENITEMS: C.genItems,
  VANMAY: 5 });
v.ECONSRC = tbl(['Nguồn Vàng', 'Số lượng'], [
  ['Thu nhập cơ bản (ai cũng như nhau)', 'theo bảng trên; ngày 1 là vốn đầu ' + C.goldIncome[1]],
  ['Lãi (từ ngày 2)', 'mỗi ' + C.interestPer + ' Vàng đang giữ đầu ngày → +1, tối đa +' + C.interestMax + ' (Lõi Ngân Khố: tối đa +' + (C.interestMax + TT.CORES.nganhkho.fx.interestAdd) + ')'],
  ['Săn quái (ngày ' + TT.DAYS.map((d, i) => d && d.kind === 'monster' ? i : 0).filter(Boolean).join('/') + ')', 'người hạ nhiều quái nhất: ' + Object.keys(TT.MONSTERS).map(k => '+' + TT.MONSTERS[k].gold).join(' / ') + ' Vàng'],
  ['Sự kiện ' + TT.EVENTS.vanmay.name, '+' + v.VANMAY + ' Vàng cho mọi người'],
  ['Lõi kinh tế', TT.CORES.tuitinhthe.name + ' +' + TT.CORES.tuitinhthe.fx.goldDaily + '/ngày; ' + TT.CORES.hiepuoc.name + ' +' + TT.CORES.hiepuoc.fx.goldNow + ' ngay và +' + TT.CORES.hiepuoc.fx.goldDaily + '/ngày'],
  ['Bán lại', 'tướng, lính, trang bị, Lõi: hoàn **100%** giá mua (Lõi trả Vàng tức thời thì trừ phần đã nhận)']
]);
v.PRICELIST = tbl(['Mục', 'Giá (Vàng)'], [
  ['EXP', C.xpBuyCost + ' Vàng = ' + C.xpBuyAmount + ' EXP'],
  ['Trang bị Bậc I / II / III / IV', [1, 2, 3, 4].map(t => C.itemPrice[t]).join(' / ')],
  ['Lõi ' + [1, 2, 3, 4].map(t => TT.TIER_NAME[t]).join(' / '), [1, 2, 3, 4].map(t => C.corePrice[t]).join(' / ')],
  ['Đổi bảng Lõi', C.rerollCost + ' (mỗi ngày ' + C.freeRerolls + ' lần miễn phí)'],
  ['Tướng / lính', 'theo binh chủng và tộc (mục 9, 10)']
]);

/* ---------- Đời ---------- */
let acc = 0;
v.AGE = tbl(['Đời', 'EXP lên Đời kế', 'Tổng EXP', 'Sức chứa (Nhân tộc +)', 'Mở binh chủng', 'Trang bị', 'Lệnh Soái', 'Tỉ lệ Lõi Đồng/Bạc/Vàng/Lăng Kính'], [1, 2, 3, 4].map(a => {
  const roles = TT.ROLE_ORDER.filter(r => TT.ROLES[r].age === a).map(r => TT.ROLES[r].name).join(', ');
  const t = a === 1 ? 0 : (acc += C.xpToNext[a - 1]);
  const ord = TT.ORDERS.dragon.findIndex(o => o.age === a);
  return [rom[a] + ' · ' + TT.AGE_NAME[a], a < 4 ? C.xpToNext[a] : '—', t, C.capacity[a] + ' (+' + C.humanCapBonus[a] + ')', roles, 'Bậc ' + rom[a], ord >= 0 ? 'Lệnh thứ ' + (ord + 1) : '—', TT.CORE_WEIGHTS[a].join('/')];
}));
function pace(buys) { // ngày đạt Đời II/III/IV nếu mỗi ngày mua `buys` lần EXP
  let lv = 1, xp = 0; const out = {};
  for (let d = 1; d <= C.days; d++) {
    if (d > 1) xp += C.xpDaily;
    xp += buys * C.xpBuyAmount;
    while (lv < 4 && xp >= C.xpToNext[lv]) { xp -= C.xpToNext[lv]; lv++; out[lv] = d; }
  }
  return [2, 3, 4].map(l => out[l] ? 'ngày ' + out[l] : 'không đạt');
}
v.PACE = tbl(['Cách chơi', 'Vàng cho EXP / ngày', 'Đời II', 'Đời III', 'Đời IV'], [0, 1, 2].map(b => [b ? 'Mua ' + b + ' lần EXP mỗi ngày' : 'Chỉ EXP miễn phí', b * C.xpBuyCost].concat(pace(b))));

/* ---------- Tướng ---------- */
Object.assign(v, { GENHP: GC.hp, GENATK: GC.atk, GENDEF: GC.def, GENRAD: GC.rad });

/* ---------- bản đồ, địa hình ---------- */
v.MAPS = tbl(['Bản đồ', 'Đặc điểm'], Object.keys(TT.MAPS).map(k => ['**' + TT.MAPS[k].name + '**', TT.MAPS[k].desc]));
v.TERRAIN = tbl(['Ký hiệu', 'Địa hình', 'Hiệu ứng'], Object.keys(TT.TERRAIN).map(k => ['`' + k + '`', '**' + TT.TERRAIN[k].name + '**', TT.TERRAIN[k].desc]));
Object.assign(v, { BATTLEMAX: C.battleMaxSec, BATTLEMIN: C.battleMaxSec / 60, STORM: C.stormBase, TOWERSEC: C.towerSec, TOWERATK: C.towerAtk, MPATK: C.mpOnAttack, MPHIT: C.mpOnHit,
  CAPDODGE: C.capDodge, CAPDR: C.capDR, CAPCRIT: C.capCrit, MAXAS: C.maxAS });

/* ---------- binh chủng ---------- */
v.ROLES = tbl(['Vai trò', 'Đời', 'Nhóm', 'Máu', 'ATK', 'DEF', 'Đòn/giây', 'Tầm', 'Tốc di', 'MP tướng (đầu)', 'Dân', 'Giá tướng', 'Giá lính', 'Loại'], TT.ROLE_ORDER.map(k => { const r = TT.ROLES[k];
  return ['**' + r.name + '**' + (r.unique ? ' (duy nhất, không lính)' : '') + (r.splash ? ' (nổ lan)' : ''), rom[r.age], TT.CLS_NAME[r.cls], r.hp, r.atk, r.def, r.as, r.rng, r.spd, r.mp + ' (' + r.mp0 + ')', r.pop, r.gcost, r.unique ? '—' : r.cost, r.dt === 'magic' ? 'phép' : 'vật lý']; }));

/* ---------- tộc ---------- */
v.FACMODS = tbl(['Tộc', 'Máu', 'ATK', 'DEF', 'Tốc đánh', 'Tốc di', 'Hồi MP', 'Khác', 'Giá'], TT.FACTION_ORDER.map(k => { const m = F[k].mods, ca = F[k].costAdd || {};
  return [F[k].name, m.hp, m.atk, m.def, m.as, m.spd, m.mpGain, [m.dodge ? '+' + m.dodge + '% né' : '', m.ls ? m.ls + '% hút máu' : ''].filter(Boolean).join(', ') || '—', ca.gen ? 'tướng +' + ca.gen + ' Vàng' : 'gốc']; }));
const statsOf = (race, role, gen) => { const Rr = TT.ROLES[role], m = F[race].mods;
  let hp = fl(Rr.hp * m.hp / 100), atk = fl(Rr.atk * m.atk / 100), def = fl(Rr.def * m.def / 100);
  if (gen) { hp = fl(hp * GC.hp / 100); atk = fl(atk * GC.atk / 100); def = fl(def * GC.def / 100); }
  return hp + '/' + atk + '/' + def; };
v.FACTIONS = TT.FACTION_ORDER.map((k, i) => { const f = F[k];
  let s = '### 10.' + (i + 2) + ' ' + f.name + '\n\n*' + f.style + '*\n\n- **Nội tại — ' + f.base.name + ':** ' + f.base.desc + '\n- **Điểm yếu — ' + f.weak.name + ':** ' + f.weak.desc + '\n\n';
  s += '**Thiên phú** (chọn 1 ở phòng chờ):\n\n' + tbl(['Thiên phú', 'Hiệu ứng'], TT.TALENTS[k].map(t => ['**' + t.name + '**', t.desc])) + '\n\n';
  s += '**Lệnh Soái** (tự động):\n\n' + tbl(['Lệnh', 'Mở ở', 'Hiệu ứng'], TT.ORDERS[k].map(o => ['**' + o.name + '**', 'Đời ' + rom[o.age], o.desc])) + '\n\n';
  s += '**Quân** (chỉ số đã nhân hệ số tộc, chưa có trang bị/Lõi; tướng đã nhân hệ số tướng):\n\n' + tbl(['Quân', 'Vai trò', 'Tướng Máu/ATK/DEF', 'Lính Máu/ATK/DEF', 'Giá tướng', 'Giá lính', 'Nội tại', 'Kỹ năng (chỉ tướng, đầy MP)'], TT.ROLE_ORDER.map(r => { const Rr = TT.ROLES[r], u = TT.unitDef(k, r) || {};
    return ['**' + (u.name || Rr.name) + '**', Rr.name, statsOf(k, r, true), Rr.unique ? '—' : statsOf(k, r, false), TT.genCost(k, r), Rr.unique ? '—' : TT.unitCost(k, r), u.psd || '—', u.sk ? '**' + u.sk.name + ':** ' + u.sk.desc : '—']; }));
  return s; }).join('\n\n');

/* ---------- trang bị, Lõi ---------- */
const startNames = Object.keys(TT.START_ITEMS).map(k => TT.ITEMS[TT.START_ITEMS[k]].name);
v.STARTITEMS = startNames.join(' / ');
v.ITEMS = [1, 2, 3, 4].map(t => '**Bậc ' + rom[t] + '** (mở ở Đời ' + rom[t] + ', giá ' + C.itemPrice[t] + ' Vàng)\n\n' + tbl(['Trang bị', 'Hiệu ứng'], TT.ITEM_ORDER.filter(k => TT.ITEMS[k].tier === t).map(k => ['**' + TT.ITEMS[k].name + '**', TT.ITEMS[k].desc]))).join('\n\n');
const scope = s => s === 'all' ? 'Toàn quân' : s === 'econ' ? 'Kinh tế' : s.startsWith('cls:') ? TT.CLS_NAME[s.slice(4)] : s.startsWith('role:') ? TT.ROLES[s.slice(5)].name : s.startsWith('race:') ? F[s.slice(5)].name : s;
v.CORES = [1, 2, 3, 4].map(t => '**' + TT.TIER_NAME[t] + '** (' + C.corePrice[t] + ' Vàng)\n\n' + tbl(['Lõi', 'Phạm vi', 'Hiệu ứng'], TT.CORE_ORDER.filter(k => TT.CORES[k].tier === t).map(k => ['**' + TT.CORES[k].name + '**', scope(TT.CORES[k].scope), TT.CORES[k].desc]))).join('\n\n');

/* ---------- chiến thuật, hành quân ---------- */
v.STANCES = tbl(['Chiến thuật', 'Hành vi'], TT.STANCE_ORDER.map(k => ['**' + TT.STANCES[k].name + '**', TT.STANCES[k].desc]));
v.FLAGS = tbl(['Cờ', 'Hành vi'], Object.keys(TT.FLAGS).map(k => ['**' + TT.FLAGS[k].name + '**', TT.FLAGS[k].desc]));
Object.assign(v, { FLAGMAX: C.flagMax });
{
  const PB = C.popBuy; let tot = 0; for (let i = 0; i < PB.max; i++) tot += PB.base + Math.floor(i / PB.every) * PB.step;
  Object.assign(v, { POPAMT: PB.amount, POPBASE: PB.base, POPSTEP: PB.step, POPEVERY: PB.every, POPMAX: PB.max, POPTOTAL: tot, POPCAP: PB.amount * PB.max,
    ITEMBOARD: C.itemBoard, FREEIR: C.freeItemRerolls, 
    ITEMW: tbl(['Ngày', 'Đồng', 'Bạc', 'Vàng', 'Lăng Kính'], TT.ITEM_DAY_W.slice(1).map((w, i) => ['Ngày ' + (i + 1)].concat(w.map(x => x + '%')))),
    FORMS: tbl(['Đội hình', 'Mô tả'], TT.FORM_ORDER.map(k => [TT.FORMATIONS[k].name, TT.FORMATIONS[k].desc])) });
}

/* ---------- lịch ---------- */
const kind = { normal: 'Giao tranh thường', monster: 'Săn quái', event: 'Sự kiện ngẫu nhiên', final: 'Chung kết (điểm hạng ×' + C.finalMult / 100 + ')' };
v.DAYS = tbl(['Ngày', 'Tên', 'Loại', 'Bản đồ', 'Trời'], TT.DAYS.slice(1).map((d, i) => ['Ngày ' + (i + 1), d.name, kind[d.kind], d.map ? TT.MAPS[d.map].name : 'ngẫu nhiên theo seed', (i + 1) % 2 === 0 ? 'đêm' : 'ngày']));
v.MONSTERS = tbl(['Cấp', 'Quái', 'Số lượng', 'Máu', 'ATK', 'DEF', 'Thưởng'], Object.keys(TT.MONSTERS).map(k => { const m = TT.MONSTERS[k]; return [k, m.name, m.n, m.hp, m.atk, m.def, '+' + m.gold + ' Vàng']; }));
v.EVENTS = tbl(['Sự kiện', 'Hiệu ứng'], TT.EVENT_ORDER.map(k => ['**' + TT.EVENTS[k].name + '**', TT.EVENTS[k].desc]));
v.WEATHER = tbl(['Thời tiết', 'Hiệu ứng'], Object.keys(TT.WEATHER).map(k => ['**' + TT.WEATHER[k].name + '**', TT.WEATHER[k].desc]));

/* ---------- điểm ---------- */
v.RANKPTS = tbl(['Số phe', 'Hạng 1', 'Hạng 2', 'Hạng 3', 'Hạng 4'], [2, 3, 4].map(n => [n].concat([0, 1, 2, 3].map(i => C.rankPts[n][i] != null ? C.rankPts[n][i] : '—')))) + '\n\n2 đấu 2: đội thắng ' + C.rankPts[2][0] + ', đội thua ' + C.rankPts[2][1] + ' điểm hạng mỗi người.';
Object.assign(v, { KILLPOP: C.killPopPerPoint, FINALMULT: C.finalMult / 100 });

/* ---------- bot ---------- */
const BL = TT.Bot ? TT.Bot.LEVELS : null;
v.BOTS = BL ? tbl(['Mức', 'Lên Đời II/III/IV (ngày)', 'Hệ số mua trang bị', 'Số Lõi tối đa', 'Bậc Lõi cao nhất', 'Cắm cờ', 'Mô phỏng thử đội hình'], Object.keys(BL).map(k => { const L = BL[k];
  return ['**' + L.name + '**', L.ageDay.slice(2).map(x => x > C.days ? '—' : x).join(' / '), Math.round(L.items * 100) + '%', L.coreMax, TT.TIER_NAME[L.coreTier], L.flags ? 'có' : 'không', L.sim ? L.sim + ' biến thể' : 'không']; })) : '';

/* ---------- ghi file ---------- */
const src = process.argv[2] || path.join(__dirname, 'gdd-template.md'), out = process.argv[3] || path.join(__dirname, '../tu-toc-ky-chien-gdd-3.0.md');
let s = fs.readFileSync(src, 'utf8');
s = s.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in v)) throw new Error('thiếu ' + k); return v[k]; });
fs.writeFileSync(out, s);
console.log('ok', path.basename(out), s.split('\n').length, 'dòng; quân', Object.keys(TT.UNITS).length, 'đồ', TT.ITEM_ORDER.length, 'lõi', TT.CORE_ORDER.length);
