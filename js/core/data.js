/* Tứ Tộc Kỳ Chiến 2.0 — dữ liệu (một nguồn duy nhất cho số liệu cân bằng).
   Đơn vị trong file này là đơn vị "người đọc" (giây, ô, %). battle.js tự đổi sang số nguyên
   (tick = 1/20 giây, mili-ô) khi khởi tạo nên mọi máy cho cùng kết quả. */
(function (G) {
  'use strict';
  var TT = G.TT = G.TT || {};

  TT.RULE_VERSION = 'tt-2.0.0';

  /* ================= BalanceConfig ================= */
  TT.CONFIG = {
    days: 10,
    tick: 20,                         // tick mỗi giây
    // Tài nguyên: ai cũng nhận như nhau, tăng dần theo ngày, dư thì giữ sang ngày sau, KHÔNG có lãi
    resIncome: [0, 15, 4, 4, 5, 5, 6, 6, 7, 7, 8], // [ngày] mỗi loại V/T/G; ngày 1 = vốn đầu
    // Tinh thể: như vàng TFT
    cryStart: 4, cryDaily: 5, cryInterestPer: 10, cryInterestMax: 5,
    // Đời = cấp TFT
    xpDaily: 2, xpBuyCost: 4, xpBuyAmount: 4,
    xpToNext: [0, 6, 14, 24],        // từ Đời I→II, II→III, III→IV
    capacity: [0, 12, 20, 30, 42],   // Sức chứa (dân số) theo Đời
    humanCapBonus: [0, 1, 2, 3, 4],
    coreSlots: [0, 3, 4, 5, 6],
    itemSlots: [0, 2, 2, 3, 3],
    flagSteps: [0, 2, 3, 4, 5], flagTotal: 20,
    coreCost: { 1: 1, 2: 2, 3: 3, 4: 5 }, coreSellPct: 50,
    rerollCost: 1, freeRerolls: 1, coreBoard: 5, coreLocks: 2,
    // Giao tranh
    battleMaxSec: 300,               // 5 phút
    stormBase: 1,                    // sau 5 phút: giây thứ k gây stormBase·2^(k−1) sát thương thật lên mọi quân
    towerSec: 5, towerAtk: 8,
    mpOnAttack: 10, mpOnHit: 5,
    capDR: 70, capDodge: 40, capCrit: 100, maxAS: 300,
    projSpeed: 14,                   // ô/giây
    // Điểm
    rankPts: { 2: [15, 4], 3: [18, 9, 3], 4: [20, 12, 6, 2] },
    killPopPerPoint: 4,              // mỗi 4 dân số địch hạ gục = 1 điểm
    finalMult: 150,                  // ngày 10: điểm hạng ×1.5
    resultSec: 8,
    prepDay1Bonus: 45
  };
  TT.RES = ['V', 'T', 'G'];
  TT.RES_NAME = { V: 'Vàng', T: 'Thực', G: 'Gỗ' };
  TT.AGE_NAME = ['', 'Huyện', 'Quận', 'Châu', 'Thành'];
  TT.AGE_ROMAN = ['', 'I', 'II', 'III', 'IV'];
  TT.TIER_NAME = { 1: 'Đồng', 2: 'Bạc', 3: 'Vàng', 4: 'Lăng Kính' };

  /* ================= Binh chủng: khuôn vai trò (1 quân lẻ) =================
     hp atk def as(đòn/giây) rng(ô) spd(ô/giây) mp/mp0 crit dodge regen(HP/giây) pop cost
     dt: phys|magic. rad: bán kính thân (ô). */
  TT.ROLES = {
    linh:       { name: 'Lính',        age: 1, hp: 165, atk: 18, def: 15, as: .80, rng: 1,   spd: 2.0, mp: 80,  mp0: 20, crit: 5,  dodge: 3,  regen: 0, pop: 1, cost: { V: 1, T: 2, G: 0 }, rad: .34, dt: 'phys', cls: 'can' },
    thuan:      { name: 'Thuẫn binh',  age: 1, hp: 250, atk: 12, def: 32, as: .60, rng: 1,   spd: 1.8, mp: 60,  mp0: 30, crit: 0,  dodge: 0,  regen: 1, pop: 1, cost: { V: 0, T: 2, G: 2 }, rad: .36, dt: 'phys', cls: 'can' },
    cung:       { name: 'Cung thủ',    age: 1, hp: 100, atk: 21, def: 5,  as: .95, rng: 5,   spd: 2.0, mp: 70,  mp0: 20, crit: 10, dodge: 5,  regen: 0, pop: 1, cost: { V: 1, T: 1, G: 2 }, rad: .32, dt: 'phys', cls: 'xa' },
    y:          { name: 'Thuật sĩ',    age: 2, hp: 120, atk: 10, def: 6,  as: .70, rng: 3.5, spd: 2.0, mp: 60,  mp0: 20, crit: 0,  dodge: 4,  regen: 0, pop: 2, cost: { V: 2, T: 2, G: 2 }, rad: .32, dt: 'magic', cls: 'trung' },
    ky:         { name: 'Kỵ binh',     age: 2, hp: 185, atk: 24, def: 12, as: .90, rng: 1,   spd: 3.5, mp: 70,  mp0: 20, crit: 8,  dodge: 5,  regen: 0, pop: 2, cost: { V: 2, T: 2, G: 1 }, rad: .46, dt: 'phys', cls: 'can' },
    chihuy:     { name: 'Chỉ Huy',     age: 2, hp: 170, atk: 13, def: 16, as: .70, rng: 2,   spd: 2.0, mp: 60,  mp0: 30, crit: 0,  dodge: 0,  regen: 2, pop: 2, cost: { V: 3, T: 2, G: 2 }, rad: .36, dt: 'phys', cls: 'trung' },
    thichkhach: { name: 'Thích khách', age: 3, hp: 125, atk: 32, def: 8,  as: 1.1, rng: 1,   spd: 3.0, mp: 60,  mp0: 30, crit: 20, dodge: 12, regen: 0, pop: 2, cost: { V: 3, T: 0, G: 2 }, rad: .32, dt: 'phys', cls: 'can' },
    phapsu:     { name: 'Pháp sư',     age: 3, hp: 95,  atk: 23, def: 5,  as: .80, rng: 4,   spd: 2.0, mp: 50,  mp0: 0,  crit: 0,  dodge: 0,  regen: 0, pop: 2, cost: { V: 3, T: 1, G: 2 }, rad: .32, dt: 'magic', cls: 'xa' },
    congthanh:  { name: 'Công thành',  age: 3, hp: 150, atk: 46, def: 10, as: .40, rng: 7,   spd: 1.5, mp: 90,  mp0: 0,  crit: 0,  dodge: 0,  regen: 0, pop: 3, cost: { V: 2, T: 1, G: 4 }, rad: .5,  dt: 'phys', cls: 'xa', splash: 1 },
    tuong:      { name: 'Tượng binh',  age: 4, hp: 560, atk: 40, def: 35, as: .60, rng: 1.2, spd: 2.2, mp: 100, mp0: 50, crit: 0,  dodge: 0,  regen: 3, pop: 5, cost: { V: 2, T: 4, G: 3 }, rad: .72, dt: 'phys', cls: 'can' },
    thanthu:    { name: 'Thần thú',    age: 4, hp: 1150, atk: 62, def: 40, as: .70, rng: 1.5, spd: 2.5, mp: 100, mp0: 50, crit: 5,  dodge: 5,  regen: 4, pop: 8, cost: { V: 5, T: 4, G: 4 }, rad: .95, dt: 'phys', cls: 'can', unique: 1 }
  };
  TT.ROLE_ORDER = ['linh', 'thuan', 'cung', 'y', 'ky', 'chihuy', 'thichkhach', 'phapsu', 'congthanh', 'tuong', 'thanthu'];
  TT.CLS_NAME = { can: 'Cận chiến', trung: 'Tầm trung', xa: 'Tầm xa' };
  TT.rangeClass = function (rng) { return rng <= 1.5 ? 'can' : rng < 4 ? 'trung' : 'xa'; };

  /* ================= Bốn tộc ================= */
  TT.FACTION_ORDER = ['dragon', 'human', 'fairy', 'demon'];
  TT.FACTIONS = {
    dragon: {
      name: 'Rồng tộc', short: 'Rồng', color: '#ff6b4a', color2: '#ffd2a8', dark: '#a8321e',
      mods: { hp: 128, atk: 116, def: 110, as: 92, spd: 95, mpGain: 85 }, costAdd: { T: 1 },
      base: { name: 'Long Huyết', desc: 'Mỗi 2% máu đã mất cộng 1% tốc đánh (tối đa +30%). Càng bị thương càng hung hãn.' },
      weak: { name: 'Long Tham', desc: 'Mọi quân Rồng đắt hơn 1 Thực. Chậm và ít né: sợ bị thả diều và đốt máu.' },
      style: 'Tường cận chiến dày, đánh mạnh và bền; càng đánh lâu càng nguy hiểm.'
    },
    human: {
      name: 'Nhân tộc', short: 'Nhân', color: '#4a8cff', color2: '#cfe2ff', dark: '#1f4fa8',
      mods: { hp: 100, atk: 100, def: 100, as: 100, spd: 100, mpGain: 100 }, costAdd: {},
      base: { name: 'Quân Đông · Khéo Đồ', desc: 'Sức chứa thêm +1/+2/+3/+4 theo Đời. Đội trưởng có thêm 1 ô trang bị và trang bị mạnh hơn 15%. Mỗi trang bị trên đội trưởng cho cả đội +2% ATK.' },
      weak: { name: 'Chỉ Số Thường', desc: 'Không có chỉ số vượt trội; sức mạnh đến từ số đông và trang bị.' },
      style: 'Đông quân, linh hoạt, mạnh dần nhờ trang bị và đội hình.'
    },
    fairy: {
      name: 'Tiên tộc', short: 'Tiên', color: '#3ccf8e', color2: '#d4ffe9', dark: '#17855a',
      mods: { hp: 85, atk: 105, def: 90, as: 108, spd: 115, mpGain: 115, dodge: 6 }, costAdd: {},
      base: { name: 'Linh Khí', desc: 'Đầu giao tranh vô hình 1.5 giây (không bị chọn từ xa quá 2 ô). Đi qua sông không bị chậm, đầm lầy chỉ chậm một nửa.' },
      weak: { name: 'Mong Manh', desc: 'Nhận thêm 15% sát thương từ kỹ năng diện rộng. Ít máu, sợ bị áp sát.' },
      style: 'Nhanh, né cao, dồn sát thương tầm xa; thắng nhờ tốc độ.'
    },
    demon: {
      name: 'Quỷ tộc', short: 'Quỷ', color: '#a35cff', color2: '#ead8ff', dark: '#5f2aa8',
      mods: { hp: 100, atk: 105, def: 100, as: 102, spd: 100, mpGain: 100, ls: 9 }, costAdd: {},
      base: { name: 'Hồn', desc: 'Mỗi quân chết trên chiến trường (ta hay địch) cho 1 Hồn (tối đa 25). Mỗi Hồn +1% ATK cho mọi quân Quỷ. Có hút máu 9%. Một số kỹ năng tiêu Hồn.' },
      weak: { name: 'Huyết Nhục', desc: 'Không tự hồi máu; nhận hồi máu từ Thuật sĩ và trang bị chỉ còn 50%.' },
      style: 'Đông quân rẻ, càng chết càng mạnh, hút máu để trụ.'
    }
  };

  /* Thiên phú (chọn ở phòng chờ — lưu vào players.passive) */
  TT.TALENTS = {
    dragon: [
      { id: 'longhuyet', name: 'Long Huyết Cuồng', desc: 'Long Huyết tối đa +45% tốc đánh (thay vì +30%).' },
      { id: 'vaythep', name: 'Vảy Thép', desc: 'Mọi quân +8 DEF.' },
      { id: 'longdiem', name: 'Long Diễm', desc: 'Đòn đánh thường của quân tầm xa gây đốt 2 giây.' }
    ],
    human: [
      { id: 'renkhi', name: 'Rèn Khí', desc: 'Trang bị mạnh hơn 30% (thay vì 15%).' },
      { id: 'kyluat', name: 'Kỷ Luật', desc: 'Mọi quân +10% máu.' },
      { id: 'quanluong', name: 'Quân Lương', desc: 'Sức chứa thêm +2.' }
    ],
    fairy: [
      { id: 'phongthan', name: 'Phong Thần', desc: '6 giây đầu giao tranh +20% tốc đánh và tốc di.' },
      { id: 'linhan', name: 'Linh Ẩn', desc: 'Vô hình đầu trận kéo dài 3.5 giây.' },
      { id: 'tinhlinh', name: 'Tinh Linh', desc: 'Hồi năng lượng (MP) +20%.' }
    ],
    demon: [
      { id: 'huyetam', name: 'Huyết Ẩm', desc: 'Hút máu thêm 6%.' },
      { id: 'honchu', name: 'Hồn Chủ', desc: 'Mỗi Hồn +1.5% ATK (thay vì 1%).' },
      { id: 'batdiet', name: 'Bất Diệt', desc: 'Đội trưởng mỗi đội hồi sinh 1 lần với 30% máu.' }
    ]
  };

  /* Trang bị khởi đầu (chọn ở phòng chờ — lưu vào players.homeTileType) */
  TT.START_ITEMS = { gold: 'kiem', food: 'bua', wood: 'giap' };

  /* ================= 44 quân =================
     ps = nội tại, sk = kỹ năng kích hoạt khi đầy MP. Mỗi hiệu ứng là một "khối" mà battle.js hiểu. */
  var U = TT.UNITS = {};
  function def(f, role, o) { U[f + '.' + role] = o; }

  /* ---------- RỒNG ---------- */
  def('dragon', 'linh', { name: 'Long Binh', ps: { cleave: { n: 2, pct: 50 } }, psd: 'Chém lan: mỗi đòn trúng thêm tối đa 2 địch kề mục tiêu với 50% sát thương.',
    sk: { name: 'Chém Vảy', desc: 'Chém hình quạt 2 ô trước mặt, 160% ATK.', fx: [{ t: 'dmg', area: 'cone', len: 2.2, pct: 160 }] } });
  def('dragon', 'thuan', { name: 'Thuẫn Giáp Vảy', ps: { firstHitDR: { pct: 40, cd: 5 } }, psd: 'Vảy cứng: đòn đầu tiên mỗi 5 giây chỉ nhận 60% sát thương.',
    sk: { name: 'Gầm Khiêu Chiến', desc: 'Khiêu khích địch trong 3 ô 3 giây, bản thân +30% DEF 4 giây.', fx: [{ t: 'taunt', r: 3, dur: 3 }, { t: 'buff', who: 'self', def: 30, dur: 4 }] } });
  def('dragon', 'cung', { name: 'Cung Xuyên Giáp', ps: { pierce: { pct: 50 } }, psd: 'Tên xuyên: trúng thêm 1 địch phía sau mục tiêu với 50% sát thương.',
    sk: { name: 'Mưa Tên Rồng', desc: 'Bắn 5 mũi vào các địch ít máu nhất trong tầm, mỗi mũi 90% ATK.', fx: [{ t: 'dmg', area: 'multi', n: 5, pick: 'lowest', pct: 90 }] } });
  def('dragon', 'y', { name: 'Long Mạch Sư', ps: { healAtk: { pct: 160 }, healBuff: { atk: 10, dur: 3 } }, psd: 'Đòn đánh hồi máu đồng minh yếu nhất trong tầm (160% ATK) và cho họ +10% ATK 3 giây.',
    sk: { name: 'Long Tuyền', desc: 'Hồi 18% máu tối đa cho 4 đồng minh yếu nhất trong 5 ô, họ được giảm 15% sát thương 3 giây.', fx: [{ t: 'heal', pick: 'lowest', n: 4, r: 5, maxPct: 18 }, { t: 'buff', who: 'healed', dr: 15, dur: 3 }] } });
  def('dragon', 'ky', { name: 'Long Kỵ', ps: { charge: { tiles: 4, pct: 50 } }, psd: 'Xung phong: chạy ít nhất 4 ô rồi đánh thì đòn đó +50% sát thương.',
    sk: { name: 'Giày Xéo', desc: 'Lao xuyên qua mục tiêu, gây 140% ATK lên mọi địch trên đường và làm chậm 30% trong 2 giây.', fx: [{ t: 'dash', to: 'target', through: 1, path: 140, st: { slow: 30, dur: 2 } }] } });
  def('dragon', 'chihuy', { name: 'Chiến Hống Tướng', ps: { aura: { r: 4, atk: 10 } }, psd: 'Hào quang 4 ô: đồng minh +10% ATK (hào quang cùng loại không cộng dồn).',
    sk: { name: 'Hống Vương', desc: 'Đồng minh trong 4 ô +25% tốc đánh trong 5 giây.', fx: [{ t: 'buff', who: 'allies', r: 4, as: 25, dur: 5 }] } });
  def('dragon', 'thichkhach', { name: 'Long Trảo', ps: { vsCls: { xa: 25, trung: 25 } }, psd: '+25% sát thương lên quân tầm xa và tầm trung.',
    sk: { name: 'Móc Trảo', desc: 'Nhảy tới quân tầm xa gần nhất, gây 220% ATK và giảm 25% DEF mục tiêu 4 giây.', fx: [{ t: 'dash', to: 'backline', pct: 220, st: { shred: 25, dur: 4 } }] } });
  def('dragon', 'phapsu', { name: 'Long Tức Pháp Sư', ps: { rangeAdd: 1 }, psd: 'Tầm đánh +1.',
    sk: { name: 'Hơi Thở Rồng', desc: 'Phun lửa hình nón 5 ô, 170% ATK phép và đốt 3 giây.', fx: [{ t: 'dmg', area: 'cone', len: 5, pct: 170, st: { burn: 25, dur: 3 } }] } });
  def('dragon', 'congthanh', { name: 'Pháo Phun Lửa', ps: { burnOnHit: { pct: 20, dur: 3 } }, psd: 'Đạn nổ lan 1 ô và gây đốt 3 giây.',
    sk: { name: 'Đạn Lửa', desc: 'Nã một quả cầu lửa vùng 2 ô, 300% ATK.', fx: [{ t: 'dmg', area: 'circle', r: 2, pct: 300, st: { burn: 25, dur: 3 } }] } });
  def('dragon', 'tuong', { name: 'Long Tượng', ps: { immuneKnock: 1, crowdDef: { n: 3, def: 15 } }, psd: 'Miễn đẩy lùi. Khi có từ 3 địch kề thì +15% DEF.',
    sk: { name: 'Dậm Chân', desc: 'Choáng địch trong 1.8 ô 1.2 giây, 120% ATK.', fx: [{ t: 'dmg', area: 'self', r: 1.8, pct: 120, st: { stun: 1.2 } }] } });
  def('dragon', 'thanthu', { name: 'Cự Long', ps: { flying: 1, regenLow: { below: 50, pct: 2 } }, psd: 'Bay qua mọi địa hình. Dưới 50% máu hồi 2% máu mỗi giây.',
    sk: { name: 'Long Hỏa Thiên Giáng', desc: 'Lửa trời vùng 3 ô quanh mục tiêu, 350% ATK và đốt 4 giây.', fx: [{ t: 'dmg', area: 'circle', r: 3, pct: 350, st: { burn: 35, dur: 4 } }] } });

  /* ---------- NHÂN ---------- */
  def('human', 'linh', { name: 'Vệ Binh', ps: { formation: { r: 2, def: 2, max: 10 } }, psd: 'Kỷ luật đội ngũ: +2 DEF cho mỗi Vệ Binh đứng trong 2 ô (tối đa +10).',
    sk: { name: 'Phối Hợp', desc: 'Đâm 140% ATK và nhận khiên 10% máu tối đa 3 giây.', fx: [{ t: 'dmg', area: 'target', pct: 140 }, { t: 'shield', who: 'self', maxPct: 10, dur: 3 }] } });
  def('human', 'thuan', { name: 'Thuẫn Hộ Tống', ps: { guardRanged: { r: 2, pct: 15 } }, psd: 'Che chắn: quân tầm xa/tầm trung đứng trong 2 ô nhận ít hơn 15% sát thương.',
    sk: { name: 'Tường Khiên', desc: 'Tạo khiên 20% máu tối đa cho 3 đồng minh gần nhất trong 4 giây.', fx: [{ t: 'shield', who: 'nearest', n: 3, r: 4, maxPct: 20, dur: 4 }] } });
  def('human', 'cung', { name: 'Nỏ Thủ', ps: { armorPen: 25 }, psd: 'Nỏ nặng: bỏ qua 25% giáp mục tiêu.',
    sk: { name: 'Tên Tẩm Dầu', desc: 'Bắn 160% ATK, mục tiêu nhận thêm 15% sát thương trong 4 giây.', fx: [{ t: 'dmg', area: 'target', pct: 160, st: { vuln: 15, dur: 4 } }] } });
  def('human', 'y', { name: 'Mục Sư', ps: { healAtk: { pct: 160 }, healCleanse: 1 }, psd: 'Đòn đánh hồi máu đồng minh yếu nhất trong tầm (160% ATK) và gỡ 1 hiệu ứng xấu.',
    sk: { name: 'Ánh Sáng Thánh', desc: 'Hồi 15% máu tối đa cho đồng minh trong 3 ô quanh người yếu nhất, họ +20% DEF 4 giây.', fx: [{ t: 'heal', pick: 'cluster', r: 3, maxPct: 15 }, { t: 'buff', who: 'healed', def: 20, dur: 4 }] } });
  def('human', 'ky', { name: 'Thương Kỵ', ps: { firstStrike: { pct: 60 } }, psd: 'Mũi thương: đòn đầu tiên lên mỗi mục tiêu mới +60% sát thương.',
    sk: { name: 'Xung Kích', desc: 'Lao tới mục tiêu, 150% ATK và choáng 0.6 giây.', fx: [{ t: 'dash', to: 'target', pct: 150, st: { stun: .6 } }] } });
  def('human', 'chihuy', { name: 'Tướng Quân', ps: { aura: { r: 4, def: 12, as: 5 } }, psd: 'Hào quang 4 ô: đồng minh +12% DEF và +5% tốc đánh.',
    sk: { name: 'Hiệu Lệnh', desc: 'Đồng minh trong 5 ô +20% ATK và +20% DEF trong 5 giây.', fx: [{ t: 'buff', who: 'allies', r: 5, atk: 20, def: 20, dur: 5 }] } });
  def('human', 'thichkhach', { name: 'Sát Thủ Thuê', ps: { vsItems: 30, huntCaptain: 1 }, psd: 'Săn đội trưởng: ưu tiên quân mang trang bị, +30% sát thương lên họ.',
    sk: { name: 'Hợp Đồng Máu', desc: 'Lướt ra sau đội trưởng địch giá trị nhất, 260% ATK.', fx: [{ t: 'blink', to: 'captain', pct: 260 }] } });
  def('human', 'phapsu', { name: 'Pháp Sư Hoàng Gia', ps: { slowOnHit: { pct: 15, dur: 1.5 } }, psd: 'Đòn đánh làm chậm 15% trong 1.5 giây.',
    sk: { name: 'Băng Hỏa', desc: 'Nổ băng hỏa vùng 2.5 ô, 165% ATK phép và làm chậm 30% trong 2 giây.', fx: [{ t: 'dmg', area: 'circle', r: 2.5, pct: 165, st: { slow: 30, dur: 2 } }] } });
  def('human', 'congthanh', { name: 'Nỏ Thần', ps: { lineShot: { n: 3, fall: 25 } }, psd: 'Mũi nỏ lớn xuyên tối đa 3 mục tiêu trên đường bắn (mỗi mục tiêu sau giảm 25%).',
    sk: { name: 'Tên Phá Thành', desc: 'Bắn một mũi xuyên thẳng 9 ô, 250% ATK lên mọi địch trúng.', fx: [{ t: 'dmg', area: 'line', len: 9, w: .9, pct: 250 }] } });
  def('human', 'tuong', { name: 'Voi Phá Trận', ps: { knockChance: { pct: 15, dist: 1 } }, psd: '15% mỗi đòn đẩy lùi mục tiêu 1 ô.',
    sk: { name: 'Phá Tuyến', desc: 'Húc hình quạt 3 ô, 130% ATK và đẩy lùi 2 ô.', fx: [{ t: 'dmg', area: 'cone', len: 3, pct: 130, st: { knock: 2 } }] } });
  def('human', 'thanthu', { name: 'Kỳ Lân Vàng', ps: { aura: { r: 5, regenPct: 1 } }, psd: 'Phước lành 5 ô: đồng minh hồi 1% máu tối đa mỗi giây.',
    sk: { name: 'Phước Vàng', desc: 'Hồi 15% máu cho đồng minh trong 5 ô và +15% ATK 5 giây.', fx: [{ t: 'heal', pick: 'area', r: 5, maxPct: 15 }, { t: 'buff', who: 'allies', r: 5, atk: 15, dur: 5 }] } });

  /* ---------- TIÊN ---------- */
  def('fairy', 'linh', { name: 'Kiếm Phong', ps: { kite: { chance: 30, dist: 1 } }, psd: '30% sau mỗi đòn lùi 1 ô (thả diều nhẹ).',
    sk: { name: 'Nhát Gió', desc: 'Lướt xuyên qua mục tiêu, 150% ATK.', fx: [{ t: 'dash', to: 'target', through: 1, pct: 150 }] } });
  def('fairy', 'thuan', { name: 'Hộ Pháp', ps: { aura: { r: 3, rangedDR: 15 } }, psd: 'Kết giới 3 ô: đồng minh nhận ít hơn 15% sát thương tầm xa.',
    sk: { name: 'Màn Sáng', desc: 'Khiên 25% máu tối đa cho 3 đồng minh yếu nhất trong 4 ô, 3 giây.', fx: [{ t: 'shield', who: 'lowest', n: 3, r: 4, maxPct: 25, dur: 3 }] } });
  def('fairy', 'cung', { name: 'Thiên Xạ', ps: { rangeAdd: 1, kite: { chance: 20, dist: 1 } }, psd: 'Tầm +1; 20% sau khi bắn lùi 1 ô.',
    sk: { name: 'Phi Tiễn', desc: '3 mũi tên vào 3 địch khác nhau, mỗi mũi 85% ATK.', fx: [{ t: 'dmg', area: 'multi', n: 3, pick: 'distinct', pct: 85 }] } });
  def('fairy', 'y', { name: 'Linh Nữ', ps: { healAtk: { pct: 140 }, healBounce: { pct: 50 } }, psd: 'Đòn đánh hồi máu đồng minh yếu nhất (140% ATK) rồi nảy sang người thứ hai 50%.',
    sk: { name: 'Suối Linh', desc: 'Đồng minh trong 3 ô quanh bản thân hồi 4% máu tối đa mỗi giây trong 4 giây.', fx: [{ t: 'buff', who: 'allies', r: 3, regenPct: 4, dur: 4 }] } });
  def('fairy', 'ky', { name: 'Phi Mã', ps: { flying: 1 }, psd: 'Bay: bỏ qua địa hình và đi xuyên quân.',
    sk: { name: 'Bão Vó', desc: '4 cú đá liên tiếp, mỗi cú 75% ATK vào địch ngẫu nhiên gần đó.', fx: [{ t: 'dmg', area: 'multi', n: 4, pick: 'near', r: 2, pct: 75 }] } });
  def('fairy', 'chihuy', { name: 'Quân Sư', ps: { aura: { r: 4, rngAdd: 1, mpGain: 15 } }, psd: 'Hào quang 4 ô: quân tầm xa +1 tầm, mọi đồng minh +15% hồi MP.',
    sk: { name: 'Thiên Mạc', desc: '4 đồng minh gần nhất miễn hoàn toàn 1 đòn đánh thường (trong 4 giây).', fx: [{ t: 'block', n: 4, r: 4, dur: 4 }] } });
  def('fairy', 'thichkhach', { name: 'Ảnh Bộ', ps: { dodgeAdd: 15, stealthStart: 1.5 }, psd: '+15% né; vô hình đầu trận lâu hơn 1.5 giây.',
    sk: { name: 'Ảnh Kiếm', desc: 'Biến mất, xuất hiện sau lưng mục tiêu gây 260% ATK, vô hình thêm 1.5 giây.', fx: [{ t: 'blink', to: 'target', pct: 260, stealth: 1.5 }] } });
  def('fairy', 'phapsu', { name: 'Linh Quang', ps: { bounce: { pct: 50 } }, psd: 'Đòn đánh nảy sang 1 địch gần đó với 50% sát thương.',
    sk: { name: 'Mưa Sao', desc: '6 quả cầu sao rơi ngẫu nhiên quanh mục tiêu (3 ô), mỗi quả 75% ATK.', fx: [{ t: 'dmg', area: 'rain', n: 6, r: 3, rr: 1, pct: 75 }] } });
  def('fairy', 'congthanh', { name: 'Thạch Lôi Đài', ps: { rangeAdd: 1, moveShoot: 1 }, psd: 'Tầm +1; vừa di chuyển vừa bắn được.',
    sk: { name: 'Sấm Truyền', desc: 'Sét 260% ATK, nảy tiếp 2 địch gần đó với 60%.', fx: [{ t: 'dmg', area: 'chain', n: 2, fall: 40, pct: 260, dt: 'magic' }] } });
  def('fairy', 'tuong', { name: 'Tượng Vân', ps: { passThrough: 1, dodgeAdd: 10 }, psd: 'Đi xuyên quân; +10% né.',
    sk: { name: 'Cuộn Mây', desc: 'Hất tung địch trong 2 ô (choáng 1 giây), 110% ATK.', fx: [{ t: 'dmg', area: 'self', r: 2, pct: 110, st: { stun: 1 } }] } });
  def('fairy', 'thanthu', { name: 'Phượng Hoàng', ps: { flying: 1, rebirth: { pct: 40 } }, psd: 'Bay. Chết lần đầu sẽ hồi sinh tại chỗ với 40% máu.',
    sk: { name: 'Lửa Tái Sinh', desc: 'Vùng lửa 3 ô gây 300% ATK, đồng minh trong vùng hồi 20% máu.', fx: [{ t: 'dmg', area: 'self', r: 3, pct: 300 }, { t: 'heal', pick: 'area', r: 3, maxPct: 20 }] } });

  /* ---------- QUỶ ---------- */
  def('demon', 'linh', { name: 'Tiểu Quỷ', ps: { deathSouls: 1 }, psd: 'Chết cho thêm 1 Hồn.',
    sk: { name: 'Vồ Hồn', desc: 'Vồ 140% ATK, hồi máu bằng 30% sát thương gây ra.', fx: [{ t: 'dmg', area: 'target', pct: 140, drain: 30 }] } });
  def('demon', 'thuan', { name: 'Thuẫn Phản Oán', ps: { deathRetaliate: { pct: 10 } }, psd: 'Khi chết, kẻ kết liễu nhận sát thương bằng 10% máu tối đa của thuẫn.',
    sk: { name: 'Oán Giáp', desc: 'Khiên 15% máu tối đa và phản 30% sát thương nhận trong 3 giây.', fx: [{ t: 'shield', who: 'self', maxPct: 15, dur: 3 }, { t: 'buff', who: 'self', reflect: 30, dur: 3 }] } });
  def('demon', 'cung', { name: 'Ma Tiễn', ps: { kite: { chance: 25, dist: 1 } }, psd: '25% sau khi bắn lùi 1 ô.',
    sk: { name: 'Tên Nguyền', desc: 'Bắn 130% ATK, mục tiêu −20% ATK trong 4 giây.', fx: [{ t: 'dmg', area: 'target', pct: 130, st: { weak: 20, dur: 4 } }] } });
  def('demon', 'y', { name: 'Tế Sư Máu', ps: { drainHeal: { pct: 120 } }, psd: 'Đòn đánh rút máu kẻ địch (120% ATK phép) và hồi đúng lượng đó cho đồng minh yếu nhất.',
    sk: { name: 'Huyết Khế', desc: 'Đồng minh trong 4 ô +20% hút máu và hồi 10% máu tối đa, 5 giây.', fx: [{ t: 'heal', pick: 'area', r: 4, maxPct: 10 }, { t: 'buff', who: 'allies', r: 4, ls: 20, dur: 5 }] } });
  def('demon', 'ky', { name: 'Dạ Kỵ', ps: { killSouls: 1 }, psd: 'Mỗi lần hạ gục +1 Hồn.',
    sk: { name: 'Truy Dạ', desc: 'Lao tới địch ít máu nhất trong 8 ô, 180% ATK.', fx: [{ t: 'dash', to: 'lowest', r: 8, pct: 180 }] } });
  def('demon', 'chihuy', { name: 'Hồn Soái', ps: { aura: { r: 4, ls: 8 } }, psd: 'Hào quang 4 ô: đồng minh +8% hút máu.',
    sk: { name: 'Triệu Hồn', desc: 'Tiêu 3 Hồn triệu 2 Tiểu Quỷ tạm thời (40% chỉ số); thiếu Hồn thì triệu 1.', fx: [{ t: 'summon', role: 'linh', n: 2, pct: 40, souls: 3 }] } });
  def('demon', 'thichkhach', { name: 'Bóng Ma', ps: { killStealth: { heal: 20, dur: 1 } }, psd: 'Hạ gục: hồi 20% máu và vô hình 1 giây.',
    sk: { name: 'Ám Sát', desc: 'Lướt ra sau mục tiêu 250% ATK; nếu hạ gục thì nhận khiên 15% máu.', fx: [{ t: 'blink', to: 'target', pct: 250, killShield: 15 }] } });
  def('demon', 'phapsu', { name: 'Hắc Pháp Sư', ps: { atkDownOnHit: { pct: 8, dur: 3, stack: 2 } }, psd: 'Đòn đánh giảm 8% ATK mục tiêu 3 giây (cộng dồn 2 lần).',
    sk: { name: 'Tử Vong Nguyền', desc: 'Vùng 3 ô: 150% ATK phép và giảm 50% hồi máu nhận trong 5 giây.', fx: [{ t: 'dmg', area: 'circle', r: 3, pct: 150, st: { antiheal: 50, dur: 5 } }] } });
  def('demon', 'congthanh', { name: 'Hồn Pháo', ps: { soulShot: { pct: 100, cd: 5 } }, psd: 'Mỗi 5 giây tiêu 1 Hồn (nếu có) để phát bắn kế +100% sát thương.',
    sk: { name: 'Pháo Oán', desc: 'Vùng 2 ô, 320% ATK.', fx: [{ t: 'dmg', area: 'circle', r: 2, pct: 320 }] } });
  def('demon', 'tuong', { name: 'Tượng Xương', ps: { deathSummon: { role: 'linh', n: 3, pct: 25 } }, psd: 'Khi chết vỡ ra 3 Tiểu Quỷ tạm (25% chỉ số).',
    sk: { name: 'Đại Cốt', desc: 'Choáng địch trong 2 ô 1 giây, bản thân nhận khiên 25% máu.', fx: [{ t: 'dmg', area: 'self', r: 2, pct: 100, st: { stun: 1 } }, { t: 'shield', who: 'self', maxPct: 25, dur: 4 }] } });
  def('demon', 'thanthu', { name: 'Ma Vương', ps: { deathSummon: { role: 'linh', n: 2, pct: 50 } }, psd: 'Khi chết để lại 2 Tiểu Quỷ (50% chỉ số).',
    sk: { name: 'Hấp Hồn', desc: 'Tiêu toàn bộ Hồn: gây 100% ATK + 25% ATK mỗi Hồn lên địch trong 3 ô.', fx: [{ t: 'dmg', area: 'self', r: 3, pct: 100, perSoul: 25, souls: 'all' }] } });

  /* ================= Lệnh Soái (tự động trong giao tranh) =================
     Mở ở Đời I / III / IV. Mỗi lệnh dùng tối đa 1 lần mỗi giao tranh, tự kích hoạt khi đủ điều kiện. */
  TT.ORDERS = {
    dragon: [
      { age: 1, name: 'Long Lực', when: 'engage', desc: 'Khi quân ta giao chiến lần đầu: đội đang đánh mạnh nhất +40% ATK 6 giây.', fx: { t: 'buffSquad', pick: 'engaged', atk: 40, dur: 6 } },
      { age: 3, name: 'Long Hống', when: 'crowd', desc: 'Khi có từ 8 địch áp sát một đội ta: địch quanh đó (4 ô) −15% ATK 5 giây.', fx: { t: 'debuffArea', r: 4, weak: 15, dur: 5 } },
      { age: 4, name: 'Long Uy', when: 'hp50', desc: 'Khi tổng máu quân ta dưới 50%: toàn quân giảm 25% sát thương và miễn khống chế 5 giây.', fx: { t: 'buffAll', dr: 25, cc: 1, dur: 5 } }
    ],
    human: [
      { age: 1, name: 'Tài Trợ Chiến Tranh', when: 'engage', desc: 'Khi giao chiến lần đầu: đội có nhiều trang bị nhất +25% sát thương 6 giây.', fx: { t: 'buffSquad', pick: 'items', dmg: 25, dur: 6 } },
      { age: 3, name: 'Thu Quân Cứu Thương', when: 'hp60', desc: 'Khi tổng máu dưới 60%: hồi 12% máu tối đa cho toàn quân.', fx: { t: 'healAll', maxPct: 12 } },
      { age: 4, name: 'Kỳ Binh', when: 't15', desc: 'Giây thứ 15: 4 Vệ Binh tiếp viện xuất hiện ở vùng xuất quân.', fx: { t: 'summonBase', role: 'linh', n: 4, pct: 100 } }
    ],
    fairy: [
      { age: 1, name: 'Linh Nhãn', when: 'start', desc: 'Đầu giao tranh: quân tầm xa +2 tầm trong 8 giây.', fx: { t: 'buffAll', cls: 'xa', rng: 2, dur: 8 } },
      { age: 3, name: 'Gió Thần', when: 'engage', desc: 'Khi giao chiến lần đầu: toàn quân +30% tốc di và +15% tốc đánh 5 giây.', fx: { t: 'buffAll', spd: 30, as: 15, dur: 5 } },
      { age: 4, name: 'Thiên Mạc', when: 'hp50', desc: 'Khi tổng máu dưới 50%: khiên 20% máu tối đa cho toàn quân 4 giây.', fx: { t: 'shieldAll', maxPct: 20, dur: 4 } }
    ],
    demon: [
      { age: 1, name: 'Lời Nguyền', when: 'engage', desc: 'Khi giao chiến lần đầu: địch trong 4 ô quanh đội ta đang đánh −20% tốc đánh 5 giây.', fx: { t: 'debuffArea', r: 4, slowAs: 20, dur: 5 } },
      { age: 3, name: 'Huyết Tế', when: 'souls5', desc: 'Khi có từ 5 Hồn: hiến tế quân ta yếu máu nhất, nổ 3 ô gây 30% máu tối đa của nó + 40 sát thương, +2 Hồn.', fx: { t: 'sacrifice', r: 3, pct: 30, flat: 40, souls: 2 } },
      { age: 4, name: 'Triệu Hồn Đại Trận', when: 'souls6', desc: 'Khi có từ 6 Hồn: tiêu 6 Hồn triệu 4 Tiểu Quỷ (60% chỉ số) cạnh đội đông nhất.', fx: { t: 'summonSouls', role: 'linh', n: 4, pct: 60, souls: 6 } }
    ]
  };

  /* ================= Trang bị (mua bằng tài nguyên, bán hoàn 100%, mở theo Đời) =================
     Chỉ đội trưởng nhận chỉ số; trang bị có "Hào quang" thì cả đội nhận. */
  TT.ITEMS = {
    // Đời I
    kiem:    { tier: 1, name: 'Kiếm Sắt',   cost: { V: 3, T: 0, G: 0 }, st: { atk: 12 }, desc: '+12 ATK.' },
    giap:    { tier: 1, name: 'Giáp Da',    cost: { V: 0, T: 0, G: 3 }, st: { def: 12 }, desc: '+12 DEF.' },
    bua:     { tier: 1, name: 'Bùa Máu',    cost: { V: 0, T: 3, G: 0 }, st: { hp: 120 }, desc: '+120 máu.' },
    cunggio: { tier: 1, name: 'Cung Gió',   cost: { V: 2, T: 0, G: 1 }, st: { asPct: 12 }, desc: '+12% tốc đánh.' },
    ngoc:    { tier: 1, name: 'Ngọc Linh',  cost: { V: 2, T: 1, G: 0 }, st: { mp0: 20, mpGain: 15 }, desc: '+20 MP khởi đầu, +15% hồi MP.' },
    nhan:    { tier: 1, name: 'Nhẫn Vận',   cost: { V: 2, T: 1, G: 0 }, st: { crit: 8, dodge: 6 }, desc: '+8% chí mạng, +6% né.' },
    // Đời II
    daidao:  { tier: 2, name: 'Đại Đao',    cost: { V: 4, T: 0, G: 2 }, st: { atk: 30 }, fx: { execute: 10 }, desc: '+30 ATK; +10% sát thương lên địch có % máu thấp hơn mình.' },
    thanhtri:{ tier: 2, name: 'Thành Trì',  cost: { V: 2, T: 0, G: 4 }, st: { def: 35 }, fx: { firstHitDR: { pct: 25, cd: 4 } }, desc: '+35 DEF; đòn đầu mỗi 4 giây nhận ít hơn 25%.' },
    cutam:   { tier: 2, name: 'Cự Tâm',     cost: { V: 2, T: 4, G: 0 }, st: { hp: 350 }, fx: { regenPct: 1 }, desc: '+350 máu; hồi 1% máu tối đa mỗi giây.' },
    huyetkiem:{ tier: 2, name: 'Huyết Kiếm', cost: { V: 3, T: 2, G: 1 }, st: { atk: 18, ls: 12 }, desc: '+18 ATK, hút máu 12%.' },
    cohieu:  { tier: 2, name: 'Cờ Hiệu',    cost: { V: 3, T: 1, G: 2 }, aura: { asPct: 10 }, desc: 'Hào quang: cả đội +10% tốc đánh.' },
    cunglinh:{ tier: 2, name: 'Cung Linh',  cost: { V: 3, T: 1, G: 2 }, st: { asPct: 18, mp0: 30 }, fx: { mpPerHit: 3 }, desc: '+18% tốc đánh, +30 MP; mỗi đòn +3 MP.' },
    // Đời III
    phongtoc:{ tier: 3, name: 'Phong Tốc',  cost: { V: 5, T: 1, G: 3 }, st: { asPct: 30 }, fx: { everyN: { n: 4, pct: 100 } }, desc: '+30% tốc đánh; mỗi đòn thứ 4 đánh hai lần.' },
    kiemda:  { tier: 3, name: 'Kiếm Dạ',    cost: { V: 5, T: 2, G: 2 }, st: { atk: 20, crit: 15, critDmg: 25 }, desc: '+20 ATK, +15% chí mạng, chí mạng +25% sát thương.' },
    aogiaplon:{ tier: 3, name: 'Áo Giáp Lớn', cost: { V: 2, T: 3, G: 4 }, st: { def: 20, hp: 250 }, fx: { reflect: 10 }, desc: '+20 DEF, +250 máu; phản 10% sát thương cận chiến.' },
    binhlinh:{ tier: 3, name: 'Bình Linh',  cost: { V: 3, T: 4, G: 2 }, st: { hp: 250, mp0: 30 }, fx: { lowHeal: { below: 40, pct: 25 } }, desc: '+250 máu, +30 MP; lần đầu dưới 40% máu hồi 25%.' },
    quanky:  { tier: 3, name: 'Quân Kỳ',    cost: { V: 4, T: 2, G: 3 }, aura: { defPct: 10, atkPct: 8 }, desc: 'Hào quang: cả đội +10% DEF và +8% ATK.' },
    truonglinh:{ tier: 3, name: 'Trượng Linh', cost: { V: 5, T: 2, G: 2 }, st: { mp0: 30 }, fx: { skillDmg: 25 }, desc: '+30 MP; kỹ năng +25% sát thương và hồi máu.' },
    // Đời IV
    thankiem:{ tier: 4, name: 'Thần Kiếm',  cost: { V: 7, T: 3, G: 4 }, st: { atk: 45, asPct: 15 }, fx: { armorPen: 25 }, desc: '+45 ATK, +15% tốc đánh, bỏ qua 25% giáp.' },
    battu:   { tier: 4, name: 'Ấn Bất Tử',  cost: { V: 5, T: 5, G: 4 }, st: { hp: 300 }, fx: { revive: 40 }, desc: '+300 máu; chết lần đầu hồi sinh với 40% máu.' },
    longgiap:{ tier: 4, name: 'Long Lân Giáp', cost: { V: 3, T: 5, G: 6 }, st: { def: 40, hp: 400 }, fx: { dr: 15 }, desc: '+40 DEF, +400 máu, giảm 15% sát thương nhận.' },
    thientam:{ tier: 4, name: 'Thiên Tâm',  cost: { V: 6, T: 4, G: 4 }, aura: { atkPct: 15, asPct: 15 }, desc: 'Hào quang: cả đội +15% ATK và +15% tốc đánh.' }
  };
  TT.ITEM_ORDER = Object.keys(TT.ITEMS);

  /* ================= Lõi nâng cấp (mua bằng Tinh thể) =================
     Tự áp dụng cho quân phù hợp (toàn quân / theo vai trò / theo tầm đánh) — không cần chọn mục tiêu. */
  var CORE_LIST = [
    // A. Toàn quân (Đồng)
    ['kimcuong', 1, 'all', 'Thân Thể Kim Cương', { hpPct: 8 }, 'Toàn quân +8% máu.'],
    ['luoithep', 1, 'all', 'Lưỡi Thép', { atkPct: 6 }, 'Toàn quân +6% ATK.'],
    ['giapday', 1, 'all', 'Áo Giáp Dày', { def: 6 }, 'Toàn quân +6 DEF.'],
    ['nhiptrong', 1, 'all', 'Nhịp Trống', { asPct: 6 }, 'Toàn quân +6% tốc đánh.'],
    ['giotmau', 1, 'all', 'Giọt Máu', { ls: 4 }, 'Toàn quân hút máu 4%.'],
    ['tamlinh', 1, 'all', 'Tâm Linh Thông', { mp0: 10 }, 'Toàn quân +10 MP khởi đầu.'],
    ['mattinh', 1, 'all', 'Đôi Mắt Tinh Tường', { crit: 5 }, 'Toàn quân +5% chí mạng.'],
    ['buocnhe', 1, 'all', 'Bước Chân Nhẹ', { dodge: 4 }, 'Toàn quân +4% né.'],
    ['muixuyen', 1, 'all', 'Mũi Xuyên', { armorPen: 10 }, 'Toàn quân bỏ qua 10% giáp.'],
    ['tuitinhthe', 1, 'econ', 'Túi Tinh Thể', { cryDaily: 1 }, 'Mỗi ngày +1 Tinh thể.'],
    // B. Theo tầm đánh
    ['huyetchien', 2, 'cls:can', 'Huyết Chiến', { ls: 10 }, 'Quân cận chiến hút máu 10%.'],
    ['thepnguoi', 2, 'cls:can', 'Thép Nguội', { defPct: 15, hpPct: 10 }, 'Quân cận chiến +15% DEF và +10% máu.'],
    ['apsat', 3, 'cls:can', 'Áp Sát', { atkPct: 20, spdPct: 10 }, 'Quân cận chiến +20% ATK và +10% tốc di.'],
    ['phankich', 3, 'cls:can', 'Phản Kích', { reflect: 15 }, 'Quân cận chiến phản 15% sát thương cận chiến nhận.'],
    ['cuongchien', 4, 'cls:can', 'Cuồng Chiến', { killStack: { as: 8, max: 5, heal: 10 } }, 'Quân cận chiến mỗi lần hạ gục +8% tốc đánh (tối đa 5 lần) và hồi 10% máu.'],
    ['linhhoat', 2, 'cls:trung', 'Linh Hoạt', { asPct: 15, dodge: 10 }, 'Quân tầm trung +15% tốc đánh và +10% né.'],
    ['hotam', 3, 'cls:trung', 'Hộ Tâm', { healPct: 25 }, 'Quân tầm trung hồi máu và tạo khiên mạnh hơn 25%.'],
    ['matung', 2, 'cls:xa', 'Mắt Ưng', { rngAdd: 1 }, 'Quân tầm xa +1 tầm đánh.'],
    ['tenlua', 2, 'cls:xa', 'Tên Lửa', { burnOnHit: { pct: 15, dur: 2 } }, 'Đòn của quân tầm xa gây đốt 2 giây.'],
    ['bantia', 3, 'cls:xa', 'Bắn Tỉa', { farDmg: 2 }, 'Quân tầm xa +2% sát thương mỗi ô cách mục tiêu (tối đa +20%).'],
    ['muaten', 3, 'cls:xa', 'Mưa Tên', { extraShot: 20 }, 'Quân tầm xa 20% bắn thêm 1 phát vào địch khác.'],
    ['phaodai', 4, 'cls:xa', 'Pháo Đài', { standAs: 30 }, 'Quân tầm xa đứng yên quá 2 giây +30% tốc đánh.'],
    // C. Theo vai trò
    ['tinhnhue', 2, 'role:linh', 'Chiến Binh Tinh Nhuệ', { hpPct: 20, atkPct: 10 }, 'Lính +20% máu, +10% ATK.'],
    ['thietve', 2, 'role:thuan', 'Thiết Vệ', { def: 25, hpPct: 15 }, 'Thuẫn binh +25 DEF, +15% máu.'],
    ['thantien', 2, 'role:cung', 'Thần Tiễn', { asPct: 20 }, 'Cung thủ +20% tốc đánh.'],
    ['thanhthu', 2, 'role:y', 'Thánh Thủ', { healPct: 30 }, 'Thuật sĩ hồi máu mạnh hơn 30%.'],
    ['vosat', 2, 'role:ky', 'Vó Sắt', { spdPct: 25, atkPct: 15 }, 'Kỵ binh +25% tốc di, +15% ATK.'],
    ['uydanh', 3, 'role:chihuy', 'Uy Danh', { auraR: 2, auraPct: 50 }, 'Hào quang Chỉ Huy rộng thêm 2 ô và mạnh hơn 50%.'],
    ['sathu', 3, 'role:thichkhach', 'Sát Thủ Hoàn Hảo', { crit: 20, critDmg: 30 }, 'Thích khách +20% chí mạng, +30% sát thương chí mạng.'],
    ['daiphap', 3, 'role:phapsu', 'Đại Pháp', { skillDmg: 25, mp0: 20 }, 'Pháp sư kỹ năng +25% sát thương, +20 MP khởi đầu.'],
    ['congchuy', 3, 'role:congthanh', 'Công Thành Chùy', { splashAdd: 1, atkPct: 10 }, 'Công thành nổ lan rộng thêm 1 ô, +10% ATK.'],
    ['voichien', 3, 'role:tuong', 'Voi Chiến', { hpPct: 20, stunAdd: .5 }, 'Tượng binh +20% máu, choáng lâu thêm 0.5 giây.'],
    ['thanuy', 4, 'role:thanthu', 'Thần Uy', { hpPct: 30, atkPct: 30 }, 'Thần thú +30% máu và ATK.'],
    // D. Kỹ năng
    ['suoimana', 2, 'all', 'Dòng Suối Mana', { mpGain: 20 }, 'Toàn quân +20% hồi MP.'],
    ['cuonghoa', 3, 'all', 'Chiêu Thức Cường Hóa', { skillDmg: 20 }, 'Kỹ năng của toàn quân +20% sát thương.'],
    ['tamkiem', 4, 'all', 'Tâm Kiếm Hợp Nhất', { mpStartPct: 50 }, 'Toàn quân vào trận với 50% MP.'],
    // E. Địa hình, chiến thuật, kinh tế
    ['diahinh', 2, 'all', 'Tinh Thông Địa Hình', { terrainFree: 1 }, 'Không bị chậm bởi rừng, đầm, sông, đồi.'],
    ['caodiem', 3, 'cls:xa', 'Chiếm Cao Điểm', { hillAtk: 15 }, 'Quân tầm xa đứng trên đồi +15% ATK.'],
    ['lacochien', 4, 'all', 'Lá Cờ Chiến Thắng', { towerX2: 1 }, 'Chiếm tháp canh nhanh gấp đôi, mỗi tháp +5% ATK thêm.'],
    ['quanlenh', 3, 'econ', 'Quân Lệnh Mở Rộng', { flagAdd: 1 }, 'Mỗi đội được thêm 1 bước cờ.'],
    ['nhatientri', 2, 'econ', 'Nhà Tiên Tri', { freeReroll: 1 }, 'Thêm 1 lần đổi Lõi miễn phí mỗi ngày.'],
    ['nganhkho', 2, 'econ', 'Ngân Khố', { interestAdd: 2 }, 'Lãi Tinh thể tối đa +2.'],
    ['hiepuoc', 4, 'econ', 'Hiệp Ước Hoàng Kim', { cryNow: 3, cryDaily: 1 }, 'Nhận ngay 3 Tinh thể và +1 Tinh thể mỗi ngày.'],
    // F. Riêng tộc
    ['huyetmach', 3, 'race:dragon', 'Huyết Mạch Long', { longhuyetX2: 1 }, 'Long Huyết mạnh gấp đôi (mỗi 1% máu mất +1% tốc đánh).'],
    ['vaycodai', 3, 'race:dragon', 'Giáp Vảy Cổ', { def: 15, reflect: 10 }, 'Quân Rồng +15 DEF và phản 10% sát thương cận chiến.'],
    ['longuy', 4, 'race:dragon', 'Long Uy Tuyệt Đối', { fearStart: { r: 4, dur: 1.5 } }, 'Đầu giao tranh, địch trong 4 ô quanh quân Rồng bị choáng sợ 1.5 giây.'],
    ['thuonghoi', 3, 'race:human', 'Thương Hội', { perItem: 2, perItemMax: 20 }, 'Mỗi trang bị đang gắn: toàn quân +2% ATK và máu (tối đa +20%).'],
    ['thankhi', 3, 'race:human', 'Đúc Thần Khí', { itemPct: 25 }, 'Trang bị mạnh thêm 25%.'],
    ['doanket', 4, 'race:human', 'Đoàn Kết', { squadBig: { n: 10, pct: 15 } }, 'Đội từ 10 quân trở lên +15% ATK, DEF và máu.'],
    ['gioThuan', 3, 'race:fairy', 'Gió Thuận', { spdPct: 10, asPct: 10 }, 'Quân Tiên +10% tốc di và tốc đánh.'],
    ['mehon', 3, 'race:fairy', 'Mê Hồn Trận', { slowOnHit: { pct: 20, dur: 2 }, roleOnly: 'phapsu' }, 'Pháp sư Tiên làm chậm 20% mục tiêu 2 giây.'],
    ['thiengioi', 4, 'race:fairy', 'Thiên Giới Giáng', { rebirthAll: 30 }, 'Đội trưởng Tiên chết lần đầu hồi sinh với 30% máu.'],
    ['honchu2', 3, 'race:demon', 'Hồn Chủ', { soulAtk: 50, soulMaxAdd: 10 }, 'Mỗi Hồn mạnh thêm 50% (1.5% ATK), tối đa thêm 10 Hồn.'],
    ['vucham', 3, 'race:demon', 'Vực Thẳm Hút', { ls: 10 }, 'Quân Quỷ hút máu thêm 10%.'],
    ['vonglinh', 4, 'race:demon', 'Quân Đoàn Vong Linh', { deathRaise: 4 }, 'Cứ 4 quân ta chết thì 1 Tiểu Quỷ (50%) trỗi dậy tại chỗ.']
  ];
  TT.CORES = {};
  CORE_LIST.forEach(function (c) { TT.CORES[c[0]] = { id: c[0], tier: c[1], scope: c[2], name: c[3], fx: c[4], desc: c[5] }; });
  TT.CORE_ORDER = CORE_LIST.map(function (c) { return c[0]; });
  // Trọng số bậc Lõi xuất hiện theo Đời
  TT.CORE_WEIGHTS = [null, [70, 30, 0, 0], [45, 40, 15, 0], [25, 40, 28, 7], [15, 33, 37, 15]];

  /* ================= Địa hình ================= */
  TT.TERRAIN = {
    '.': { name: 'Đồng bằng', cost: 10, desc: 'Không có hiệu ứng.' },
    'F': { name: 'Rừng', cost: 12, spd: 90, desc: 'Quân trong rừng né thêm 10% đòn tầm xa. Đi chậm 10%. Che tầm bắn: quân xa ngoài rừng bắn vào bị −20% sát thương.' },
    'H': { name: 'Đồi cao', cost: 12, spd: 85, desc: 'Quân tầm xa đứng trên đồi +1 tầm và +10% ATK. Cận chiến đánh lên đồi −10% sát thương. Leo dốc chậm 15%.' },
    '~': { name: 'Sông nông', cost: 16, spd: 65, desc: 'Đi chậm 35% (Kỵ chậm 45%). Tiên tộc và quân bay không bị ảnh hưởng.' },
    'S': { name: 'Đầm lầy', cost: 15, spd: 70, desc: 'Đi chậm 30%, tốc đánh −15%, mất 1% máu mỗi giây. Quỷ tộc không bị ảnh hưởng; Tiên chỉ chậm một nửa.' },
    '=': { name: 'Cầu / Đường', cost: 8, spd: 115, desc: 'Đi nhanh hơn 15%. Điểm nghẽn chiến thuật.' },
    '#': { name: 'Vực đá', cost: 0, block: 1, desc: 'Không đi qua được (trừ quân bay). Chặn đạn thẳng; Công thành bắn vòng qua được.' },
    'T': { name: 'Tháp canh', cost: 10, desc: 'Một bên đứng giữ 5 giây liên tục, không có địch, sẽ được +8% ATK toàn quân tới hết trận. Địch chiếm lại thì mất.' }
  };

  /* ================= Lịch 10 ngày ================= */
  TT.DAYS = [null,
    { kind: 'normal', name: 'Ngày 1', map: 'binhnguyen' },
    { kind: 'normal', name: 'Ngày 2' },
    { kind: 'monster', lvl: 1, name: 'Săn Quái' },
    { kind: 'normal', name: 'Ngày 4' },
    { kind: 'event', name: 'Sự kiện' },
    { kind: 'monster', lvl: 2, name: 'Săn Quái II' },
    { kind: 'normal', name: 'Ngày 7' },
    { kind: 'event', name: 'Sự kiện' },
    { kind: 'monster', lvl: 3, name: 'Săn Boss' },
    { kind: 'final', name: 'Chung Kết', map: 'thaptu' }
  ];
  TT.EVENTS = {
    cuongphong: { name: 'Cuồng Phong Chiến Tranh', desc: 'Hôm nay mọi quân +15% tốc đánh nhưng −10% máu.' },
    vanmay: { name: 'Vận May Binh Gia', desc: 'Mọi người nhận ngay 3 Tinh thể.' },
    chiendia: { name: 'Chiến Địa Hoang', desc: 'Bản đồ hôm nay có thêm 2 tháp canh.' }
  };
  TT.EVENT_ORDER = ['cuongphong', 'vanmay', 'chiendia'];
  // Quái trung lập: chỉ số theo cấp
  TT.MONSTERS = {
    1: { name: 'Bầy Sói Rừng', role: 'linh', n: 8, hp: 260, atk: 22, def: 12, model: 'wolf', cry: 1 },
    2: { name: 'Ngưu Ma', role: 'tuong', n: 3, hp: 1100, atk: 50, def: 30, model: 'ox', cry: 1 },
    3: { name: 'Cổ Thụ Yêu Vương', role: 'thanthu', n: 1, hp: 6000, atk: 90, def: 45, model: 'treant', cry: 2 }
  };
  TT.WEATHER = {
    quang: { name: 'Trời quang', desc: 'Không có hiệu ứng.' },
    mua: { name: 'Mưa', desc: 'Quân tầm xa −10% tốc đánh; hiệu ứng đốt yếu đi một nửa.' },
    nang: { name: 'Nắng gắt', desc: 'Hồi máu mọi nguồn −20%.' },
    gio: { name: 'Gió lớn', desc: 'Mọi quân +4% né.' }
  };
  TT.WEATHER_ORDER = ['quang', 'quang', 'mua', 'nang', 'gio'];

  /* ================= Tư thế ================= */
  TT.STANCES = {
    tc: { name: 'Tấn công', desc: 'Tiến về phía địch gần nhất và đánh.' },
    giu: { name: 'Giữ vị trí', desc: 'Chỉ đánh địch tới gần; không rời điểm đứng quá 4 ô.' },
    san: { name: 'Săn hậu tuyến', desc: 'Ưu tiên quân tầm xa, Thuật sĩ, Chỉ Huy của địch.' },
    rut: { name: 'Rút khi yếu', desc: 'Như Tấn công, nhưng còn dưới 30% máu thì lùi về điểm xuất phát.' }
  };
  TT.STANCE_ORDER = ['tc', 'giu', 'san', 'rut'];
  TT.FLAGS = {
    X: { name: 'Cờ Xanh · Hành Quân', desc: 'Đi thẳng tới cờ, không dừng lại đánh (trừ khi bị chặn kín quá 3 giây).' },
    D: { name: 'Cờ Đỏ · Tiến Công', desc: 'Đi về phía cờ, gặp địch thì đánh, đánh xong đi tiếp.' },
    V: { name: 'Cờ Vàng · Hộ Tống', desc: 'Đi sát cánh một đội khác của bạn và cùng đánh mục tiêu của đội đó.' }
  };

  /* ================= Màu ghế ================= */
  TT.SEAT_COLORS = { 1: '#ff5d5d', 2: '#3d9cf0', 3: '#27c46b', 4: '#f2b02c' };
  TT.SEAT_NAMES = { 1: 'Nam', 2: 'Tây', 3: 'Bắc', 4: 'Đông' };
  TT.SIDE_NAMES = ['Nam', 'Tây', 'Bắc', 'Đông'];
  TT.hexA = function (hex, a) { var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };

  /* ================= Tiện ích dùng chung ================= */
  TT.unitDef = function (race, role) { return U[race + '.' + role]; };
  TT.unitCost = function (race, role) {
    var r = TT.ROLES[role], f = TT.FACTIONS[race], u = U[race + '.' + role] || {}, c = { V: r.cost.V, T: r.cost.T, G: r.cost.G };
    [f.costAdd || {}, u.costAdd || {}].forEach(function (a) { for (var k in a) c[k] = Math.max(0, c[k] + a[k]); });
    return c;
  };
  TT.costSum = function (c) { return (c.V || 0) + (c.T || 0) + (c.G || 0); };
  TT.unitName = function (race, role) { var u = U[race + '.' + role]; return u ? u.name : TT.ROLES[role].name; };

  /* RNG xác định */
  TT.mulberry = function (a) {
    a = a >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0); };
  };
  TT.hash32 = function () { var h = 2166136261 >>> 0; for (var i = 0; i < arguments.length; i++) { var s = String(arguments[i]); for (var j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 16777619) >>> 0; } h ^= 124; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  TT.stable = function stable(o) {
    if (o === null || typeof o !== 'object') return JSON.stringify(o);
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    return '{' + Object.keys(o).sort().filter(function (k) { return o[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + stable(o[k]); }).join(',') + '}';
  };
  TT.fnv64 = function (str) {
    var h1 = 0x811c9dc5 >>> 0, h2 = 0xcbf29ce4 >>> 0;
    for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8);
  };
  TT.isqrt = function (n) { if (n <= 0) return 0; var x = Math.floor(Math.sqrt(n)); while (x * x > n) x--; while ((x + 1) * (x + 1) <= n) x++; return x; };

  if (typeof module !== 'undefined') module.exports = TT;
})(typeof window !== 'undefined' ? window : global);
