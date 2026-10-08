/* Tứ Tộc Kỳ Chiến 2.0 — nội dung tĩnh: hướng dẫn, bách khoa. Mọi số liệu đọc thẳng từ data.js. */
(function (G) {
  'use strict';
  var TT = G.TT, I = TT.Icons, F = TT.FACTIONS, CFG = TT.CONFIG;
  var C = TT.Content = {};

  C.costHtml = function (c) {
    if (!c) return '<span class="muted">—</span>';
    var s = [];
    if (c.V) s.push('<i class="cV">' + c.V + 'V</i>');
    if (c.T) s.push('<i class="cT">' + c.T + 'T</i>');
    if (c.G) s.push('<i class="cG">' + c.G + 'G</i>');
    return '<span class="cost">' + (s.join(' ') || '0') + '</span>';
  };
  function stat(race, role) {
    var R = TT.ROLES[role], m = F[race].mods;
    return { hp: Math.round(R.hp * m.hp / 100), atk: Math.round(R.atk * m.atk / 100), def: Math.round(R.def * m.def / 100), as: (R.as * m.as / 100).toFixed(2), spd: (R.spd * m.spd / 100).toFixed(1), rng: R.rng };
  }
  C.unitCard = function (race, role) {
    var R = TT.ROLES[role], u = TT.unitDef(race, role) || {}, s = stat(race, role);
    return '<div class="unit-card"><div class="ic" style="background:' + F[race].color + ';box-shadow:0 3px 0 ' + F[race].dark + '">' + I.role(role, '#fff', 28) + '</div><div>' +
      '<div class="t">' + (u.name || R.name) + ' <small class="muted">' + R.name + ' · Đời ' + TT.AGE_ROMAN[R.age] + (R.unique ? ' · duy nhất' : '') + '</small></div>' +
      '<div class="d">Máu ' + s.hp + ' · ATK ' + s.atk + ' · DEF ' + s.def + ' · ' + s.as + ' đòn/giây</div>' +
      '<div class="d">' + TT.CLS_NAME[R.cls] + ' · tầm ' + s.rng + ' ô · ' + R.pop + ' dân · ' + (R.dt === 'magic' ? 'phép' : 'vật lý') + ' · Giá ' + C.costHtml(TT.unitCost(race, role)) + '</div>' +
      (u.psd ? '<div class="tr">' + I.ui('star', 11) + ' ' + u.psd + '</div>' : '') +
      (u.sk ? '<div class="d"><b>' + u.sk.name + '</b> (đầy năng lượng): ' + u.sk.desc + '</div>' : '') + '</div></div>';
  };

  function ageTable() {
    var rows = '', acc = 0;
    for (var a = 1; a <= 4; a++) {
      var roles = TT.ROLE_ORDER.filter(function (r) { return TT.ROLES[r].age === a; }).map(function (r) { return TT.ROLES[r].name; }).join(', ');
      rows += '<tr><td>' + TT.AGE_ROMAN[a] + ' · ' + TT.AGE_NAME[a] + '</td><td>' + (a === 1 ? '—' : (acc += CFG.xpToNext[a - 1]) + ' EXP') + '</td><td>' + CFG.capacity[a] + '</td><td>' + CFG.coreSlots[a] + '</td><td>' + CFG.itemSlots[a] + '</td><td>' + roles + ' · trang bị Bậc ' + TT.AGE_ROMAN[a] + '</td></tr>';
    }
    return '<table><tr><th>Đời</th><th>Tổng EXP cần</th><th>Sức chứa</th><th>Ô Lõi</th><th>Ô trang bị</th><th>Mở khóa</th></tr>' + rows + '</table>';
  }
  function incomeTable() {
    var h = '', b = '', tot = 0;
    for (var d = 1; d <= CFG.days; d++) { h += '<th>' + d + '</th>'; b += '<td>' + CFG.resIncome[d] + '</td>'; tot += CFG.resIncome[d]; }
    return '<table><tr><th>Ngày</th>' + h + '<th>Tổng</th></tr><tr><td>Mỗi loại V/T/G</td>' + b + '<td><b>' + tot + '</b></td></tr></table>';
  }
  function rankTable() {
    var r = CFG.rankPts;
    return '<table><tr><th>Số phe</th><th>Hạng 1</th><th>Hạng 2</th><th>Hạng 3</th><th>Hạng 4</th></tr>' +
      [2, 3, 4].map(function (n) { return '<tr><td>' + n + '</td>' + [0, 1, 2, 3].map(function (i) { return '<td>' + (r[n][i] != null ? r[n][i] : '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }

  C.guideSections = [
    ['Tổng quan', function () {
      return '<h2>Tổng quan</h2><p>Tứ Tộc Kỳ Chiến 2.0 là cờ <b>tự động đánh</b> (auto-battler) kéo dài <b>10 ngày</b>. Mỗi ngày mọi người <b>cùng lúc chuẩn bị</b>: mua quân, xếp đội hình, gắn trang bị, chọn Lõi, cắm cờ. Hết giờ, các đội hình được mở ra và <b>giao tranh tự động 100%</b>.</p>' +
        '<p>Mọi người nhận <b>cùng một lượng tài nguyên</b> mỗi ngày — thắng thua nằm ở cách chi tiêu, đội hình và chiến thuật. Kết quả giao tranh được tính <b>xác định</b>: cùng đội hình luôn cho cùng kết quả trên mọi máy.</p>' +
        '<p>Sau 10 ngày, ai nhiều <b>điểm</b> nhất thắng (chế độ đồng đội: cộng điểm cả đội).</p>';
    }],
    ['Một ngày', function () {
      return '<h2>Một ngày gồm 3 phần</h2><ol><li><b>Chuẩn bị</b> (theo thời gian phòng chọn; ngày 1 thêm ' + CFG.prepDay1Bonus + ' giây): nhận thu nhập, mua quân từ <b>Băng ghế</b>, mua <b>trang bị</b> và <b>Lõi</b>, lên Đời, xếp đội. Bấm <b>Sẵn sàng</b> khi xong (bấm lại để sửa). Hết giờ, đội hình hiện tại được tự động khóa.</li>' +
        '<li><b>Giao tranh</b>: quân tự đi, tự đánh, tự dùng kỹ năng; Lệnh Soái của tộc tự kích hoạt. Không có sương mù — bạn xem được toàn bộ chiến trường, chỉnh tốc độ ×1/×2/×4 hoặc bỏ qua.</li>' +
        '<li><b>Kết quả</b>: điểm hạng, điểm hạ gục, thống kê từng đội của bạn và gợi ý cải thiện.</li></ol>' +
        '<p>Quân sống sót <b>không mất</b>: đội hình được giữ nguyên sang ngày sau, bạn chỉ cần bổ sung và chỉnh sửa. Đội hình hôm trước của đối thủ hiện mờ trên sân để bạn tham khảo.</p>';
    }],
    ['Kinh tế', function () {
      return '<h2>Tài nguyên: Vàng (V) · Thực (T) · Gỗ (G)</h2><p>Mỗi ngày ai cũng nhận như nhau; dư thì giữ sang ngày sau (<b>không có lãi</b>). Tổng 10 ngày bằng nhau cho mọi người.</p>' + incomeTable() +
        '<p>Dùng để mua <b>quân</b> và <b>trang bị</b>. Bán quân hoặc trang bị <b>hoàn lại 100%</b> — cứ thoải mái thử đội hình.</p>' +
        '<h2>Tinh thể</h2><p>Khởi đầu ' + CFG.cryStart + ', mỗi ngày +' + CFG.cryDaily + '. <b>Lãi</b>: mỗi ' + CFG.cryInterestPer + ' Tinh thể đang giữ +1 (tối đa +' + CFG.cryInterestMax + '). Ngày săn quái: người hạ nhiều quái nhất nhận thêm Tinh thể.</p>' +
        '<p>Tinh thể dùng để: mua <b>EXP</b> (' + CFG.xpBuyCost + ' Tinh thể = ' + CFG.xpBuyAmount + ' EXP), mua <b>Lõi</b> (Đồng ' + CFG.coreCost[1] + ' · Bạc ' + CFG.coreCost[2] + ' · Vàng ' + CFG.coreCost[3] + ' · Lăng Kính ' + CFG.coreCost[4] + '), đổi bảng Lõi (' + CFG.rerollCost + ', lần đầu mỗi ngày miễn phí).</p>' +
        '<h2>Đời (giống cấp trong TFT)</h2><p>Mỗi ngày tự nhận ' + CFG.xpDaily + ' EXP; mua thêm bằng Tinh thể. Đời cao mở quân mới, trang bị bậc cao, thêm Sức chứa và ô Lõi.</p>' + ageTable();
    }],
    ['Quân & đội', function () {
      return '<h2>Băng ghế & đội quân</h2><p><b>Kéo</b> quân từ Băng ghế thả vào vùng xuất quân. Thả vào đội cùng loại để thêm quân. Mỗi đội có một <b>đội trưởng</b> (vòng vàng) — trang bị gắn cho đội trưởng. Số quân mỗi đội không giới hạn; giới hạn duy nhất là <b>Sức chứa</b> (dân số).</p>' +
        '<h3>Tầm đánh</h3><p><b>Cận chiến</b> (≤1.5 ô) đỡ đòn ở tiền tuyến, <b>Tầm trung</b> (2–3.5 ô) gồm Thuật sĩ hồi máu và Chỉ Huy tỏa hào quang, <b>Tầm xa</b> (≥4 ô) đứng sau bắn. Nhiều Lõi và trang bị chỉ tác động lên một nhóm tầm.</p>' +
        '<h3>Năng lượng & kỹ năng</h3><p>Mỗi đòn đánh +' + CFG.mpOnAttack + ' năng lượng, mỗi lần bị đánh +' + CFG.mpOnHit + '. Đầy thanh thì tự dùng kỹ năng riêng của quân đó.</p>' +
        '<h3>Tư thế</h3><table>' + TT.STANCE_ORDER.map(function (k) { return '<tr><td><b>' + TT.STANCES[k].name + '</b></td><td>' + TT.STANCES[k].desc + '</td></tr>'; }).join('') + '</table>' +
        '<h3>Cờ lệnh</h3><p>Chọn đội rồi cắm tối đa ' + CFG.flagSteps[4] + ' cờ theo thứ tự (số cờ mỗi đội tăng theo Đời):</p><table>' + Object.keys(TT.FLAGS).map(function (k) { return '<tr><td><b>' + TT.FLAGS[k].name + '</b></td><td>' + TT.FLAGS[k].desc + '</td></tr>'; }).join('') + '</table>';
    }],
    ['Trang bị & Lõi', function () {
      return '<h2>Trang bị</h2><p>Mua ở thẻ <b>Trang bị</b> bằng tài nguyên. Kéo thả lên một đội để gắn cho đội trưởng. Chỉ <b>đội trưởng</b> nhận chỉ số, trừ trang bị có <b>Hào quang</b> thì cả đội nhận. Bậc trang bị mở theo Đời. Số ô trang bị mỗi đội trưởng: ' + CFG.itemSlots.slice(1).join(' / ') + ' theo Đời (Nhân tộc +1).</p>' +
        '<h2>Lõi</h2><p>Lõi là nâng cấp cho cả quân đội (như lõi TFT): cho toàn quân, một nhóm tầm, một binh chủng, tộc, hoặc kinh tế. Bảng có ' + CFG.coreBoard + ' Lõi; khóa được ' + CFG.coreLocks + ' Lõi để giữ qua lần đổi. Lõi bậc cao xuất hiện nhiều hơn khi Đời tăng. Bán Lõi hoàn ' + CFG.coreSellPct + '%.</p>';
    }],
    ['Giao tranh', function () {
      return '<h2>Giao tranh tự động</h2><ul><li>Quân tìm đường quanh địa hình, chọn mục tiêu gần nhất (hoặc theo tư thế/cờ).</li><li>Sát thương = ATK × 100 / (100 + DEF); có chí mạng, né, hút máu, khiên, khống chế.</li>' +
        '<li><b>Tháp canh</b>: đứng giữ ' + CFG.towerSec + ' giây liên tục không có địch → toàn quân +' + CFG.towerAtk + '% ATK.</li>' +
        '<li>Sau <b>' + (CFG.battleMaxSec / 60) + ' phút</b>: <b>bão chiến trường</b> gây sát thương thật lên mọi quân mỗi giây, tăng gấp đôi liên tục (1, 2, 4, 8…) tới khi chỉ còn một phe.</li>' +
        '<li>Đêm (ngày chẵn), thời tiết và sự kiện thay đổi một vài chỉ số — xem biểu tượng trên đầu màn hình.</li></ul>' +
        '<h3>Địa hình</h3><table>' + Object.keys(TT.TERRAIN).map(function (k) { var t = TT.TERRAIN[k]; return '<tr><td><b>' + t.name + '</b></td><td>' + t.desc + '</td></tr>'; }).join('') + '</table>';
    }],
    ['Điểm & 10 ngày', function () {
      return '<h2>Điểm</h2><p><b>Điểm hạng</b> mỗi ngày theo thứ tự còn trụ lại (ngày 10 ×' + (CFG.finalMult / 100) + '):</p>' + rankTable() +
        '<p><b>Điểm hạ gục</b>: mỗi ' + CFG.killPopPerPoint + ' dân số quân địch bạn hạ = 1 điểm (cộng dồn qua các ngày).</p>' +
        '<h2>Lịch 10 ngày</h2><table>' + TT.DAYS.slice(1).map(function (d, i) { var k = { normal: 'Giao tranh thường', monster: 'Có quái trung lập — hạ nhiều quái nhất được thêm Tinh thể', event: 'Sự kiện ngẫu nhiên', final: 'Chung kết, điểm ×1.5' }[d.kind]; return '<tr><td>Ngày ' + (i + 1) + '</td><td>' + d.name + '</td><td>' + k + '</td></tr>'; }).join('') + '</table>';
    }],
    ['Điều khiển', function () {
      return '<h2>Điều khiển</h2><table><tr><th>Thao tác</th><th>Cách làm</th></tr>' +
        '<tr><td>Mua quân</td><td>Kéo thẻ quân ở Băng ghế thả vào ô sáng trong vùng xuất quân (hoặc bấm thẻ → bấm ô).</td></tr>' +
        '<tr><td>Di chuyển / gộp đội</td><td>Kéo đội tới ô khác. Thả lên đội cùng loại để gộp, khác loại để đổi chỗ.</td></tr>' +
        '<tr><td>Bán</td><td>Kéo đội về Băng ghế, hoặc chọn đội và bấm phím Delete. Hoàn 100%.</td></tr>' +
        '<tr><td>Gắn trang bị</td><td>Kéo trang bị (trong kho hoặc cửa hàng) thả lên một đội.</td></tr>' +
        '<tr><td>Cờ lệnh, tư thế, tách đội</td><td>Chọn một đội để mở bảng Đội.</td></tr>' +
        '<tr><td>Camera</td><td>Kéo chỗ trống để dời, chuột phải/Shift + kéo để xoay, lăn chuột để phóng to. Điện thoại: một ngón dời, hai ngón phóng to/xoay. Phím H về góc nhìn mặc định.</td></tr>' +
        '<tr><td>Phím tắt</td><td>Ctrl+Z hoàn tác · Space sẵn sàng · 1/2/4 tốc độ xem · Esc bỏ chọn.</td></tr>' +
        '<tr><td>Thông tin</td><td>Rê chuột (hoặc giữ ngón tay) lên quân, địa hình, trang bị, Lõi để xem mô tả.</td></tr></table>';
    }],
    ['Chơi online', function () {
      return '<h2>Phòng & trận online</h2><ul><li><b>Tạo phòng</b>: chọn chế độ (đấu tay đôi, 3 người, 4 người, 2 đấu 2), thời gian chuẩn bị, khóa bản đồ, phòng riêng.</li>' +
        '<li>Trong phòng chờ chọn <b>tộc</b>, <b>thiên phú</b> và <b>trang bị khởi đầu</b>. Chủ phòng có thể thêm Bot (Dễ / Trung bình / Khó).</li>' +
        '<li>Đội hình được gửi dạng mã băm rồi mới mở ra khi mọi người đã khóa — không ai xem trộm được.</li>' +
        '<li>Mất mạng? Mở lại trang và vào lại trận; ván được dựng lại từ dữ liệu các ngày. Người không gửi kịp sẽ giữ đội hình hôm trước.</li></ul>';
    }]
  ];

  C.renderGuide = function (el) {
    var toc = C.guideSections.map(function (s, i) { return '<button data-i="' + i + '"' + (i ? '' : ' class="active"') + '>' + s[0] + '</button>'; }).join('');
    el.innerHTML = '<div class="guide-grid"><div class="guide-toc panel tight">' + toc + '</div><div class="panel doc" id="guide-body">' + C.guideSections[0][1]() + '</div></div>';
    el.querySelectorAll('.guide-toc button').forEach(function (b) {
      b.onclick = function () {
        el.querySelectorAll('.guide-toc button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); el.querySelector('#guide-body').innerHTML = C.guideSections[+b.dataset.i][1]();
      };
    });
  };

  function tabIc(svg) { return '<span style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--title)">' + svg + '</span>'; }
  C.renderCodex = function (el, tab) {
    tab = tab || 'dragon';
    var tabs = TT.FACTION_ORDER.map(function (k) { return '<div class="codex-tab' + (k === tab ? ' active' : '') + '" data-f="' + k + '">' + I.crest(k, 40) + '<b>' + F[k].name + '</b></div>'; }).join('') +
      '<div class="codex-tab' + (tab === 'items' ? ' active' : '') + '" data-f="items">' + tabIc(I.ui('shield', 20, '#fff')) + '<b>Trang bị</b></div>' +
      '<div class="codex-tab' + (tab === 'cores' ? ' active' : '') + '" data-f="cores">' + tabIc(I.ui('bolt', 20, '#fff')) + '<b>Lõi</b></div>';
    var body;
    if (tab === 'items') {
      body = '<h2>Trang bị</h2>' + [1, 2, 3, 4].map(function (t) {
        return '<h3>Bậc ' + TT.AGE_ROMAN[t] + ' · mở ở Đời ' + TT.AGE_ROMAN[t] + '</h3><table>' + TT.ITEM_ORDER.filter(function (k) { return TT.ITEMS[k].tier === t; }).map(function (k) { var it = TT.ITEMS[k]; return '<tr><td style="width:44px">' + I.item(k, 20) + '</td><td><b>' + it.name + '</b></td><td>' + C.costHtml(it.cost) + '</td><td>' + it.desc + '</td></tr>'; }).join('') + '</table>';
      }).join('');
    } else if (tab === 'cores') {
      body = '<h2>Lõi</h2>' + [1, 2, 3, 4].map(function (t) {
        return '<h3>' + TT.TIER_NAME[t] + ' · ' + CFG.coreCost[t] + ' Tinh thể</h3><table>' + TT.CORE_ORDER.filter(function (k) { return TT.CORES[k].tier === t; }).map(function (k) { var c = TT.CORES[k]; return '<tr><td style="width:44px">' + I.coreIcon(k, 18) + '</td><td><b>' + c.name + '</b></td><td>' + c.desc + '</td></tr>'; }).join('') + '</table>';
      }).join('');
    } else {
      var f = F[tab];
      var tal = TT.TALENTS[tab].map(function (t) { return '<tr><td><b>' + t.name + '</b></td><td>' + t.desc + '</td></tr>'; }).join('');
      var ord = TT.ORDERS[tab].map(function (o) { return '<tr><td><b>' + o.name + '</b></td><td>Đời ' + TT.AGE_ROMAN[o.age] + '</td><td>' + o.desc + '</td></tr>'; }).join('');
      var units = TT.ROLE_ORDER.map(function (r) { return C.unitCard(tab, r); }).join('');
      body = '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' + I.crest(tab, 110) +
        '<div style="flex:1;min-width:220px"><h2 style="margin:0">' + f.name + '</h2><p style="margin:.3em 0" class="muted"><i>' + f.style + '</i></p>' +
        '<p style="margin:.3em 0"><b>' + f.base.name + '</b>: ' + f.base.desc + '</p><p class="weak" style="display:inline-block;margin:.3em 0">Điểm yếu — <b>' + f.weak.name + '</b>: ' + f.weak.desc + '</p></div></div>' +
        '<h3>Thiên phú (chọn 1 ở phòng chờ)</h3><table>' + tal + '</table><h3>Lệnh Soái (tự kích hoạt trong giao tranh)</h3><table>' + ord + '</table><h3>Quân đội</h3><div class="unit-grid">' + units + '</div>';
    }
    el.innerHTML = '<div class="codex-tabs">' + tabs + '</div><div class="panel doc">' + body + '</div>';
    el.querySelectorAll('.codex-tab').forEach(function (t) { t.onclick = function () { C.renderCodex(el, t.dataset.f); }; });
  };
})(window);
