/* Sinh tài liệu GDD 2.0 từ data.js: node tools/gen-gdd.js */
global.window = global;
const R = require('path').join(__dirname, '../js/core/') + '/';
['data.js','maps.js'].forEach(f => require(R + f));
const fs = require('fs'), C = TT.CONFIG;
const cost = c => ['V','T','G'].filter(k => c[k]).map(k => c[k] + k).join(' ') || '0';
const tbl = (h, rows) => '| ' + h.join(' | ') + ' |\n|' + h.map(() => '---').join('|') + '|\n' + rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
const rom = TT.AGE_ROMAN;
const v = {};
v.DIM2 = '40 × 60'; v.DIM4 = '68 × 68'; v.DAY1 = C.prepDay1Bonus; v.RESSEC = C.resultSec;
let tot = 0; for (let d = 1; d <= C.days; d++) tot += C.resIncome[d]; v.RESTOTAL = tot;
v.INCOME = tbl(['Ngày'].concat([1,2,3,4,5,6,7,8,9,10].map(String)).concat(['Tổng']), [['V / T / G mỗi loại'].concat(C.resIncome.slice(1).map(String)).concat(['**' + tot + '**'])]);
Object.assign(v, { CRYSTART: C.cryStart, CRYDAILY: C.cryDaily, CRYPER: C.cryInterestPer, CRYMAX: C.cryInterestMax, XPCOST: C.xpBuyCost, XPAMT: C.xpBuyAmount, REROLL: C.rerollCost, CORESELL: C.coreSellPct, XPDAILY: C.xpDaily,
  BATTLEMAX: C.battleMaxSec, STORM: C.stormBase, TOWERSEC: C.towerSec, TOWERATK: C.towerAtk, MPATK: C.mpOnAttack, MPHIT: C.mpOnHit, CAPDODGE: C.capDodge, CAPDR: C.capDR, MAXAS: C.maxAS,
  ITEMSLOTS: C.itemSlots.slice(1).join(' / '), COREBOARD: C.coreBoard, CC1: C.coreCost[1], CC2: C.coreCost[2], CC3: C.coreCost[3], CC4: C.coreCost[4], CORELOCKS: C.coreLocks, CORESLOTS: C.coreSlots.slice(1).join(' / '),
  FLAGSTEPS: C.flagSteps.slice(1).join(' / '), FLAGTOTAL: C.flagTotal, KILLPOP: C.killPopPerPoint, FINALMULT: C.finalMult / 100 });
v.COREW = TT.CORE_WEIGHTS.slice(1).map((w, i) => 'Đời ' + rom[i + 1] + ' ' + w.join('/')).join(' · ');
let acc = 0;
v.AGE = tbl(['Đời', 'EXP để lên Đời kế', 'Tổng EXP', 'Sức chứa (Nhân +)', 'Ô Lõi', 'Ô trang bị', 'Cờ/đội', 'Mở khóa quân', 'Lệnh Soái'], [1,2,3,4].map(a => {
  const roles = TT.ROLE_ORDER.filter(r => TT.ROLES[r].age === a).map(r => TT.ROLES[r].name).join(', ');
  const tot = a === 1 ? 0 : (acc += C.xpToNext[a - 1]);
  return [rom[a] + ' · ' + TT.AGE_NAME[a], a < 4 ? String(C.xpToNext[a]) : '—', String(tot), C.capacity[a] + ' (+' + C.humanCapBonus[a] + ')', String(C.coreSlots[a]), String(C.itemSlots[a]), String(C.flagSteps[a]), roles + '; trang bị Bậc ' + rom[a], [1,3,4].includes(a) ? 'Lệnh thứ ' + ({1:1,3:2,4:3})[a] : '—'];
}));
v.MAPS = tbl(['Bản đồ', 'Đặc điểm'], Object.keys(TT.MAPS).map(k => ['**' + TT.MAPS[k].name + '**', TT.MAPS[k].desc]));
v.TERRAIN = tbl(['Ký hiệu', 'Địa hình', 'Hiệu ứng'], Object.keys(TT.TERRAIN).map(k => ['`' + k + '`', '**' + TT.TERRAIN[k].name + '**', TT.TERRAIN[k].desc]));
v.ROLES = tbl(['Vai trò', 'Đời', 'Nhóm', 'Máu', 'ATK', 'DEF', 'Đòn/giây', 'Tầm', 'Tốc di', 'Năng lượng', 'Dân', 'Giá gốc', 'Loại'], TT.ROLE_ORDER.map(k => { const r = TT.ROLES[k];
  return ['**' + r.name + '**' + (r.unique ? ' (duy nhất)' : '') + (r.splash ? ' (nổ lan)' : ''), rom[r.age], TT.CLS_NAME[r.cls], r.hp, r.atk, r.def, r.as, r.rng, r.spd, r.mp + ' (đầu ' + r.mp0 + ')', r.pop, cost(r.cost), r.dt === 'magic' ? 'phép' : 'vật lý'].map(String); }));
const F = TT.FACTIONS;
v.FACMODS = tbl(['Tộc', 'Máu', 'ATK', 'DEF', 'Tốc đánh', 'Tốc di', 'Hồi năng lượng', 'Khác', 'Giá'], TT.FACTION_ORDER.map(k => { const m = F[k].mods;
  return [F[k].name, m.hp, m.atk, m.def, m.as, m.spd, m.mpGain, (m.dodge ? '+' + m.dodge + '% né ' : '') + (m.ls ? m.ls + '% hút máu' : '') || '—', Object.keys(F[k].costAdd).length ? '+' + Object.keys(F[k].costAdd).map(x => F[k].costAdd[x] + x).join(' ') + ' mỗi quân' : 'gốc'].map(String); }));
v.FACTIONS = TT.FACTION_ORDER.map((k, i) => { const f = F[k];
  let s = '### 9.' + (i + 2) + ' ' + f.name + '\n\n*' + f.style + '*\n\n- **Nội tại — ' + f.base.name + ':** ' + f.base.desc + '\n- **Điểm yếu — ' + f.weak.name + ':** ' + f.weak.desc + '\n\n';
  s += '**Thiên phú** (chọn 1 ở phòng chờ):\n\n' + tbl(['Thiên phú', 'Hiệu ứng'], TT.TALENTS[k].map(t => ['**' + t.name + '**', t.desc])) + '\n\n';
  s += '**Lệnh Soái** (tự động):\n\n' + tbl(['Lệnh', 'Mở ở', 'Hiệu ứng'], TT.ORDERS[k].map(o => ['**' + o.name + '**', 'Đời ' + rom[o.age], o.desc])) + '\n\n';
  s += '**Quân** (chỉ số đã nhân hệ số tộc, quân lẻ không trang bị):\n\n' + tbl(['Quân', 'Vai trò', 'Máu/ATK/DEF', 'Tầm', 'Giá', 'Nội tại', 'Kỹ năng (đầy năng lượng)'], TT.ROLE_ORDER.map(r => { const R = TT.ROLES[r], u = TT.unitDef(k, r) || {}, m = f.mods;
    return ['**' + (u.name || R.name) + '**', R.name, Math.round(R.hp * m.hp / 100) + '/' + Math.round(R.atk * m.atk / 100) + '/' + Math.round(R.def * m.def / 100), String(R.rng), cost(TT.unitCost(k, r)), u.psd || '—', u.sk ? '**' + u.sk.name + ':** ' + u.sk.desc : '—']; }));
  return s; }).join('\n\n');
v.ITEMS = [1,2,3,4].map(t => '**Bậc ' + rom[t] + '** (Đời ' + rom[t] + ')\n\n' + tbl(['Trang bị', 'Giá', 'Hiệu ứng'], TT.ITEM_ORDER.filter(k => TT.ITEMS[k].tier === t).map(k => ['**' + TT.ITEMS[k].name + '**', cost(TT.ITEMS[k].cost), TT.ITEMS[k].desc]))).join('\n\n');
const scope = s => s === 'all' ? 'Toàn quân' : s === 'econ' ? 'Kinh tế' : s.startsWith('cls:') ? TT.CLS_NAME[s.slice(4)] : s.startsWith('role:') ? TT.ROLES[s.slice(5)].name : s.startsWith('race:') ? F[s.slice(5)].name : s;
v.CORES = [1,2,3,4].map(t => '**' + TT.TIER_NAME[t] + '** (' + C.coreCost[t] + ' Tinh thể)\n\n' + tbl(['Lõi', 'Phạm vi', 'Hiệu ứng'], TT.CORE_ORDER.filter(k => TT.CORES[k].tier === t).map(k => ['**' + TT.CORES[k].name + '**', scope(TT.CORES[k].scope), TT.CORES[k].desc]))).join('\n\n');
v.STANCES = tbl(['Tư thế', 'Hành vi'], TT.STANCE_ORDER.map(k => ['**' + TT.STANCES[k].name + '**', TT.STANCES[k].desc]));
v.FLAGS = tbl(['Cờ', 'Hành vi'], Object.keys(TT.FLAGS).map(k => ['**' + TT.FLAGS[k].name + '**', TT.FLAGS[k].desc]));
const kind = { normal: 'Giao tranh thường', monster: 'Săn quái', event: 'Sự kiện ngẫu nhiên', final: 'Chung kết (điểm hạng ×' + C.finalMult / 100 + ')' };
v.DAYS = tbl(['Ngày', 'Tên', 'Loại', 'Bản đồ'], TT.DAYS.slice(1).map((d, i) => ['Ngày ' + (i + 1), d.name, kind[d.kind], d.map ? TT.MAPS[d.map].name : 'ngẫu nhiên theo seed']));
v.MONSTERS = tbl(['Cấp', 'Quái', 'Số lượng', 'Máu', 'ATK', 'DEF', 'Thưởng'], Object.keys(TT.MONSTERS).map(k => { const m = TT.MONSTERS[k]; return [k, m.name, m.n, m.hp, m.atk, m.def, m.cry + ' Tinh thể'].map(String); }));
v.EVENTS = tbl(['Sự kiện', 'Hiệu ứng'], TT.EVENT_ORDER.map(k => ['**' + TT.EVENTS[k].name + '**', TT.EVENTS[k].desc]));
v.WEATHER = tbl(['Thời tiết', 'Hiệu ứng'], Object.keys(TT.WEATHER).map(k => ['**' + TT.WEATHER[k].name + '**', TT.WEATHER[k].desc]));
v.RANKPTS = tbl(['Số phe', 'Hạng 1', 'Hạng 2', 'Hạng 3', 'Hạng 4'], [2,3,4].map(n => [String(n)].concat([0,1,2,3].map(i => C.rankPts[n][i] != null ? String(C.rankPts[n][i]) : '—')))) + '\n\n2 đấu 2: đội thắng 15, đội thua 4 điểm hạng mỗi người.';
const src = process.argv[2] || require('path').join(__dirname, 'gdd-template.md'), out = process.argv[3] || require('path').join(__dirname, '../tu-toc-ky-chien-gdd-2.0.md');
let s = fs.readFileSync(src, 'utf8');
s = s.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in v)) throw new Error('thiếu ' + k); return v[k]; });
fs.writeFileSync(out, s);
console.log('ok', s.split('\n').length, 'dòng; quân', Object.keys(TT.UNITS).length, 'đồ', TT.ITEM_ORDER.length, 'lõi', TT.CORE_ORDER.length);
