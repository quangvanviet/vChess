/* Tứ Tộc Kỳ Chiến — dữ liệu luật (GDD 1.1 → 1.2). Chỉ số nguyên. */
(function (G) {
  'use strict';
  var TT = G.TT = G.TT || {};

  TT.RULE_VERSION = 'tt-1.2.0';

  /* BalanceConfig (GDD 15.8) — một nguồn dữ liệu duy nhất */
  TT.CONFIG = {
    startingGold: 10,
    baseGoldIncome: 1,
    workerCost: { V: 2, T: 0, G: 0 },
    stackCap: 6,
    fairyStackCap: 3,
    actionsByAge: [0, 1, 2, 3, 4],
    ageCosts: [null, null, { V: 3, T: 3, G: 2 }, { V: 7, T: 7, G: 6 }, { V: 14, T: 13, G: 13 }],
    peaceTurns: 3,
    declineTurn: 40,
    rankedRoundLimit: 80,
    kingReward: 3,
    dragonLargeTeam: 4,
    humanInterestCap: 3,
    commanderRepositionCost: 2,
    elephantPushCost: 2,
    demonGrowthCooldown: 3,
    demonGrowthAmount: 1,
    sacrificeSouls: 2,
    soulSpawnCost: 3,
    absorbSpawnMax: 2,
    threeSeatBonusGold: 2,
    secondPlayerBonusGold: 1
  };

  TT.RES = ['V', 'T', 'G'];
  TT.RES_NAME = { V: 'Vàng', T: 'Thực', G: 'Gỗ' };
  TT.JOB = { V: 'Thợ mỏ', T: 'Nông dân', G: 'Tiều phu' };
  TT.AGE_NAME = ['', 'Huyện', 'Quận', 'Châu', 'Thành'];
  TT.AGE_ROMAN = ['', 'I', 'II', 'III', 'IV'];

  /* move: {dirs:'orth'|'diag'|'all'|'knight', range}
     atk:  {kind:'melee'|'ranged'|'none', dirs, range, x2, lob} */
  TT.UNITS = {
    worker:   { name: 'Dân', age: 1, cost: { V: 2, T: 0, G: 0 }, move: { dirs: 'orth', range: 1 }, atk: { kind: 'none' }, hp: 1, combat: false },
    soldier:  { name: 'Lính', age: 1, cost: { V: 1, T: 2, G: 0 }, move: { dirs: 'orth', range: 1 }, atk: { kind: 'melee', dirs: 'orth', range: 1 }, hp: 1, combat: true },
    archer:   { name: 'Cung thủ', age: 1, cost: { V: 1, T: 1, G: 2 }, move: { dirs: 'orth', range: 1 }, atk: { kind: 'ranged', dirs: 'orth', range: 2 }, hp: 1, combat: true },
    shield:   { name: 'Thuẫn binh', age: 2, cost: { V: 0, T: 2, G: 2 }, move: { dirs: 'orth', range: 1 }, atk: { kind: 'melee', dirs: 'orth', range: 1 }, hp: 1, combat: true },
    cavalry:  { name: 'Kỵ binh', age: 2, cost: { V: 2, T: 2, G: 1 }, move: { dirs: 'orth', range: 3 }, atk: { kind: 'melee', dirs: 'orth', range: 1 }, hp: 1, combat: true },
    assassin: { name: 'Thích khách', age: 3, cost: { V: 3, T: 0, G: 2 }, move: { dirs: 'knight', range: 1 }, atk: { kind: 'melee', dirs: 'diag', range: 1 }, hp: 1, combat: true },
    mage:     { name: 'Pháp sư', age: 3, cost: { V: 3, T: 1, G: 2 }, move: { dirs: 'diag', range: 2 }, atk: { kind: 'ranged', dirs: 'diag', range: 2 }, hp: 1, combat: true },
    siege:    { name: 'Công thành', age: 3, cost: { V: 2, T: 1, G: 4 }, move: { dirs: 'orth', range: 1 }, atk: { kind: 'ranged', dirs: 'orth', range: 3, x2: true, lob: true }, hp: 1, combat: true },
    chariot:  { name: 'Chiến xa', age: 4, cost: { V: 3, T: 3, G: 4 }, move: { dirs: 'orth', range: 8 }, atk: { kind: 'melee', dirs: 'orth', range: 1 }, hp: 1, combat: true },
    beast:    { name: 'Thần thú', age: 4, cost: { V: 5, T: 3, G: 4 }, move: { dirs: 'all', range: 3 }, atk: { kind: 'melee', dirs: 'all', range: 1 }, hp: 3, combat: true, unique: true },
    commander:{ name: 'Chỉ Huy', age: 4, cost: { V: 3, T: 2, G: 2 }, move: { dirs: 'orth', range: 2 }, atk: { kind: 'none' }, hp: 1, combat: true },
    elephant: { name: 'Tượng binh', age: 4, cost: { V: 2, T: 4, G: 3 }, move: { dirs: 'orth', range: 2 }, atk: { kind: 'melee', dirs: 'orth', range: 1 }, hp: 1, combat: true },
    king:     { name: 'Vua', age: 0, cost: null, move: { dirs: 'all', range: 2 }, atk: { kind: 'melee', dirs: 'all', range: 1 }, hp: 1, combat: true }
  };
  TT.UNIT_ORDER = ['worker', 'soldier', 'archer', 'shield', 'cavalry', 'assassin', 'mage', 'siege', 'chariot', 'beast', 'commander', 'elephant'];
  TT.RANGED = { archer: 1, mage: 1, siege: 1 };

  TT.baseValue = function (type) {
    var c = TT.UNITS[type].cost; if (!c) return 0;
    return c.V + c.T + c.G;
  };

  TT.FACTIONS = {
    dragon: {
      name: 'Rồng tộc', short: 'Rồng', color: '#e0483a', color2: '#f3c24f',
      theme: 'Sức mạnh áp đảo — đánh mạnh và nhanh',
      weakness: { name: 'Long Tham', text: 'Mỗi quân chiến đấu (trừ Dân) giá +1 Thực.' },
      passives: [
        { id: 'longgiap', name: 'Long Giáp', text: 'Đội chiến đấu Rồng giảm 1 sát thương từ đòn đầu tiên nhận mỗi vòng (tổng với Giáp Vảy tối đa 2).' },
        { id: 'cuonghuyet', name: 'Cuồng Huyết', text: 'Đội Rồng từ 4 quân trở lên +1 tầm di chuyển.' },
        { id: 'longno', name: 'Long Nộ', text: 'Khi đội mất ít nhất 1 quân do địch, đòn kế tiếp +1 sát thương (hết sau khi đánh hoặc cuối lượt kế của chủ).' }
      ],
      actives: [
        { id: 'longluc', key: 'Q', name: 'Long Lực', cd: 3, target: 'ownTeam', text: 'Một đội: đòn kế tiếp trong lượt +50% sát thương cơ bản (làm tròn lên).' },
        { id: 'longuy', key: 'W', name: 'Long Uy', cd: 4, target: 'ownMelee', text: 'Một đội cận chiến: sau khi chiếm ô thành công trong lượt này, được đánh thêm 1 đòn (không đi thêm).' },
        { id: 'longhong', key: 'E', name: 'Long Hống', cd: 5, target: 'ownTeam', hostile: true, text: 'Đội địch trong phạm vi 2 quanh đội chọn bị −1 sát thương ở đòn đầu trong lượt kế của họ (tối thiểu 1).' }
      ],
      traits: {
        worker: 'Dân Rồng 1 HP, đánh cận chiến 1 ô như Lính.',
        soldier: 'Long Binh: cận chiến cả 8 hướng.',
        archer: 'Tên Xuyên Giáp: sát thương dư tràn sang đội liền phía sau.',
        shield: 'Giáp Vảy: giảm 1 sát thương từ đòn đầu tiên nhận mỗi vòng.',
        cavalry: 'Xung Phong: đi đủ 3 ô rồi đánh thì +1 sát thương.',
        assassin: 'Long Trảo: +1 sát thương lên quân tầm xa.',
        mage: 'Long Tức: tầm chéo tối đa 3 ô.',
        siege: 'Phun Lửa: đòn chính gây sát thương thì 1 đội địch kề mục tiêu nhận 1 sát thương.',
        chariot: 'Va Chạm: đẩy lùi mục tiêu còn sống 1 ô theo hướng đánh.',
        beast: 'Cự Long: bay, bỏ qua vật cản khi di chuyển.',
        commander: 'Chiến Hống: hào quang áp dụng cả 8 hướng.',
        elephant: 'Long Tượng: không bị đẩy; +1 sát thương khi đánh đội ≥3 quân.'
      }
    },
    human: {
      name: 'Nhân tộc', short: 'Nhân', color: '#3b82f6', color2: '#dfe7f2',
      theme: 'Thương nhân — tiền đổi thành sức mạnh',
      weakness: { name: 'Chi Tiêu Thuần', text: 'Quân chiến đấu không có chỉ số vượt trội; sức mạnh phải mua bằng tài nguyên.' },
      passives: [
        { id: 'laisuat', name: 'Lãi Suất', text: 'Cuối lượt, mỗi 10 Vàng đang giữ sinh 1 Vàng (tối đa 3). Ngừng từ lượt 40.' },
        { id: 'chotroi', name: 'Chợ Trời', text: 'Đổi tài nguyên 2:1 trong pha mua hoặc giữa các hành động.' },
        { id: 'baothau', name: 'Hợp Đồng Bao Thầu', text: 'Quân đầu tiên mua mỗi lượt giảm 1 tài nguyên trong giá (tối thiểu 1).' }
      ],
      actives: [
        { id: 'taitro', key: 'Q', name: 'Tài Trợ Chiến Tranh', cd: 3, target: 'ownTeam', pay: 3, text: 'Trả 3 tài nguyên bất kỳ: một đội +1 sát thương cho đòn kế tiếp trong lượt.' },
        { id: 'hoilo', key: 'W', name: 'Hối Lộ', cd: 4, target: 'enemyBribe', hostile: true, text: 'Quân địch lẻ kề quân Nhân, giá trị ≤7 (không Vua/Thần thú/Chỉ Huy). Trả 2× giá trị: quân đổi chủ và nghỉ tới lượt kế.' },
        { id: 'thuthue', key: 'E', name: 'Thu Thuế', cd: 6, target: 'none', hostile: true, text: 'Mỗi đối thủ mất 1 đơn vị loại tài nguyên họ có nhiều nhất và bạn nhận nó.' }
      ],
      traits: {
        worker: 'Đổi nghề miễn phí 1 lần mỗi lượt, trước thu hoạch.',
        soldier: 'Dân Binh: giá 2 tài nguyên bất kỳ.',
        archer: 'Săn Thưởng: kết liễu cả đội Dân +1 tài nguyên đúng nghề.',
        shield: 'Hộ Tống: đội Dân kề không thể bị chọn làm mục tiêu tầm xa.',
        cavalry: 'Thương Kỵ: cuối lượt đứng trên ô tài nguyên giữa bàn thu 1 tài nguyên loại đó.',
        assassin: 'Sát Thủ Thuê: kết liễu cả đội +1 tài nguyên (1 lần/lượt).',
        mage: 'Phép Tạm Ứng: trả 2V trước hành động để đánh thêm 1 đòn (−1 sát thương, tối thiểu 1).',
        siege: 'Công Xưởng: giảm 1 Gỗ trong giá.',
        chariot: 'Thương Xa: chở tối đa 2 Dân kề đi cùng.',
        beast: 'Kỳ Lân Vàng: +2V đầu lượt nếu còn sống (ngừng từ lượt 40).',
        commander: 'Điều Binh: trả 2V, dịch một đội kề 1 ô (giữ trạng thái hành động).',
        elephant: 'Phá Trận: trả 2G trước hành động — mục tiêu sống sót bị đẩy 1 ô.'
      }
    },
    fairy: {
      name: 'Tiên tộc', short: 'Tiên', color: '#22c3a6', color2: '#cfe9f2',
      theme: 'Nhanh nhạy — tốc độ, vị trí và tầm đánh',
      weakness: { name: 'Mong Manh', text: 'Mỗi đội tối đa 3 quân; Vua Tiên chỉ đi 1 ô.' },
      passives: [
        { id: 'linhdong', name: 'Linh Động', text: 'Hành động đầu mỗi lượt, nếu đội chọn có đúng 1 quân: +1 tầm di chuyển (không áp dụng Vua).' },
        { id: 'tienphong', name: 'Tiên Phong', text: 'Quân mới mua được dùng hành động để di chuyển ngay (không đánh, không gộp đội cũ).' },
        { id: 'giothuan', name: 'Gió Thuận', text: 'Quân chiến đấu Tiên +1 tầm di chuyển (không áp dụng Dân, Vua).' }
      ],
      actives: [
        { id: 'linhnhan', key: 'Q', name: 'Linh Nhãn', cd: 3, target: 'ownRanged', text: 'Một đội tầm xa +1 tầm, bỏ qua tối đa một quân chắn đường trong lượt.' },
        { id: 'hoanvi', key: 'W', name: 'Hoán Vị', cd: 3, target: 'swap', text: 'Đổi chỗ hai đội Tiên cách nhau ≤3 ô (không chọn Vua).' },
        { id: 'thienmac', key: 'E', name: 'Thiên Mạc', cd: 6, target: 'ownTeam', text: 'Một đội: đòn tấn công đầu nhắm vào đội gây 0 sát thương; hết ở đầu lượt kế của bạn.' }
      ],
      traits: {
        worker: 'Dân đi tối đa 2 ô.',
        soldier: 'Du Kích: đánh không diệt hết thì lùi 1 ô ngược hướng đánh.',
        archer: 'Tầm thẳng tối đa 3 ô.',
        shield: 'Hộ Pháp: đội kề giảm 1 sát thương tầm xa ở đòn đầu nhận mỗi vòng.',
        cavalry: 'Phi Mã: đi xuyên quân.',
        assassin: 'Ảnh Bộ: có thể nhảy vào ô trống kề quân Tiên bất kỳ của ta.',
        mage: 'Linh Quang: thêm đánh thẳng 1 ô.',
        siege: 'Thiên Lôi: tầm 4; đã đi vẫn bắn được (khi đó không x2).',
        chariot: 'Phong Xa: đi xuyên quân.',
        beast: 'Phượng Hoàng: bay, tối đa 4 ô, 2 HP.',
        commander: 'Quân Sư: đội tầm xa kề +1 tầm đánh.',
        elephant: 'Tượng Vân: đi tối đa 3 ô, xuyên quân.'
      }
    },
    demon: {
      name: 'Quỷ tộc', short: 'Quỷ', color: '#9b5cf6', color2: '#2a1240',
      theme: 'Hy sinh, đổi mạng, hồi sinh — sống bằng Hồn',
      weakness: { name: 'Vương Trì', text: 'Vua Quỷ chỉ đi 1 ô.' },
      passives: [
        { id: 'oanhon', name: 'Oán Hồn', text: 'Trả 3 Hồn: tạo 1 Lính Quỷ ở ô spawn trống (nghỉ). Dùng nhiều lần nếu đủ Hồn.' },
        { id: 'doatsinh', name: 'Đoạt Sinh', text: 'Đội cận chiến diệt cả đội địch và chiếm ô: +1 quân cùng loại, vượt giới hạn 6, không trần. Hồi 3 lượt.' },
        { id: 'taisinh', name: 'Tái Sinh', text: 'Trả 3 Hồn: hồi quân Quỷ chết gần nhất (vòng này/vòng trước, giá trị ≤7) ở spawn trống.' }
      ],
      actives: [
        { id: 'loinguyen', key: 'Q', name: 'Lời Nguyền', cd: 3, target: 'enemyTeam', soul: 1, hostile: true, text: 'Trả 1 Hồn: hành động đầu ở lượt kế của đội địch không được đánh sau khi di chuyển.' },
        { id: 'huyette', key: 'W', name: 'Huyết Tế', cd: 4, target: 'sacrifice', hostile: true, text: 'Hy sinh 1 quân Quỷ (không Vua/Thần thú): gây 2 sát thương lên đội địch trong phạm vi 2. +1 Hồn.' },
        { id: 'haphon', key: 'E', name: 'Hấp Hồn', cd: 5, target: 'ownTeam', text: 'Một đội: lần đầu diệt hoàn toàn đội địch trong lượt tạo tối đa 2 Lính Quỷ (nghỉ).' }
      ],
      traits: {
        worker: 'Hiến Tế: hy sinh 1 Dân nhận đúng 2 Hồn.',
        soldier: 'Giá −1 (còn 1V 1T).',
        archer: 'Ma Tiễn: sau khi bắn được đi thêm 1 ô.',
        shield: 'Phản Oán: khi cả đội bị diệt, kẻ diệt nhận 1 sát thương.',
        cavalry: 'Dạ Kỵ: kết liễu cả đội địch +1 Hồn.',
        assassin: 'Bóng Ma: sau khi đánh có thể trở về ô bắt đầu.',
        mage: 'Nguyền Yếu: mục tiêu sống sót −1 sát thương đòn kế (tối thiểu 1).',
        siege: 'Hồn Pháo: trả 1 Hồn trước hành động để đòn kế +2 sát thương.',
        chariot: 'Quỷ Xa: sau khi chiếm ô, đi thêm 2 ô.',
        beast: 'Ma Vương: khi chết tạo tối đa 2 Lính Quỷ ở ô trống kề.',
        commander: 'Hồn Soái: cái chết Quỷ đầu tiên trong phạm vi 2 mỗi vòng +1 Hồn.',
        elephant: 'Tượng Xương: khi bị diệt hết để lại 1 Lính Quỷ tại ô đó.'
      }
    }
  };
  TT.FACTION_ORDER = ['dragon', 'human', 'fairy', 'demon'];

  TT.SEAT_NAMES = ['Nam', 'Tây', 'Bắc', 'Đông'];
  TT.SEAT_COLORS = ['#f5b942', '#4fd1c5', '#f472b6', '#a3e635'];
})(typeof window !== 'undefined' ? window : globalThis);
