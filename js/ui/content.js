/* vChess 3.0 — nội dung tĩnh: hướng dẫn, bách khoa. Mọi số liệu đọc thẳng từ data.js. */
(function (G) {
  'use strict';
  var TT = G.TT, I = TT.Icons, F = TT.FACTIONS, CFG = TT.CONFIG;
  var C = TT.Content = {};

  // giá bằng Vàng (một loại tiền duy nhất)
  C.costHtml = function (n) {
    if (n == null) return '<span class="muted">—</span>';
    return '<span class="cost"><i class="cV">' + n + ' Vàng</i></span>';
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
      '<div class="d">' + TT.CLS_NAME[R.cls] + ' · tầm ' + s.rng + ' ô · ' + R.pop + ' dân · ' + (R.dt === 'magic' ? 'phép' : 'vật lý') + ' · Tướng ' + C.costHtml(TT.genCost(race, role)) + (R.unique ? '' : ' · Lính ' + C.costHtml(TT.unitCost(race, role))) + '</div>' +
      (u.psd ? '<div class="tr">' + I.ui('star', 11) + ' ' + u.psd + '</div>' : '') +
      (u.sk ? '<div class="d"><b>' + u.sk.name + '</b> (tướng, đầy MP): ' + u.sk.desc + '</div>' : '') + '</div></div>';
  };

  function ageTable() {
    var rows = '', acc = 0;
    for (var a = 1; a <= 4; a++) {
      var roles = TT.ROLE_ORDER.filter(function (r) { return TT.ROLES[r].age === a; }).map(function (r) { return TT.ROLES[r].name; }).join(', ');
      rows += '<tr><td>' + TT.AGE_ROMAN[a] + ' · ' + TT.AGE_NAME[a] + '</td><td>' + (a === 1 ? '—' : (acc += CFG.xpToNext[a - 1]) + ' EXP') + '</td><td>' + CFG.capacity[a] + '</td><td>' + roles + ' · trang bị Bậc ' + TT.AGE_ROMAN[a] + '</td></tr>';
    }
    return '<table><tr><th>Đời</th><th>Tổng EXP cần</th><th>Sức chứa</th><th>Mở khóa</th></tr>' + rows + '</table>';
  }
  function incomeTable() {
    var h = '', b = '', tot = 0;
    for (var d = 1; d <= CFG.days; d++) { h += '<th>' + d + '</th>'; b += '<td>' + CFG.goldIncome[d] + '</td>'; tot += CFG.goldIncome[d]; }
    return '<table><tr><th>Ngày</th>' + h + '<th>Tổng</th></tr><tr><td>Vàng nhận</td>' + b + '<td><b>' + tot + '</b></td></tr></table>';
  }
  function rankTable() {
    var r = CFG.rankPts;
    return '<table><tr><th>Số phe</th><th>Hạng 1</th><th>Hạng 2</th><th>Hạng 3</th><th>Hạng 4</th></tr>' +
      [2, 3, 4].map(function (n) { return '<tr><td>' + n + '</td>' + [0, 1, 2, 3].map(function (i) { return '<td>' + (r[n][i] != null ? r[n][i] : '—') + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }

  C.guideSections = [
    ['Mục tiêu', function () {
      return '<h2>Mục tiêu</h2><p>Chơi <b>' + CFG.days + ' ngày</b>. Mỗi ngày: <b>chuẩn bị</b> đạo quân rồi xem quân <b>tự giao tranh</b>. Hạng cao và hạ nhiều địch thì được điểm; hết ngày cuối ai nhiều điểm nhất thắng.</p>' +
        '<ul><li><b>Đạo quân</b> = 1 tướng + lính cùng binh chủng.</li><li><b>Vàng</b> mua mọi thứ; để dư Vàng sẽ có lãi.</li><li>Món đã mua được giữ qua các ngày và bán lại đủ giá (trừ EXP; Lõi kinh tế chỉ hoàn nửa giá).</li></ul>';
    }],
    ['Chuẩn bị', function () {
      return '<h2>Chuẩn bị</h2><ul><li><b>Mua tướng</b>: thẻ Tướng ở thanh dưới, chạm thẻ rồi chạm vùng xuất quân.</li>' +
        '<li><b>Thêm lính</b>: chạm tướng, chọn <b>+</b> hoặc thẻ Lính.</li>' +
        '<li><b>Trang bị</b>: mỗi tướng đeo 3 món. <b>Lõi</b>: buff cho cả quân, có hiệu lực ngay.</li>' +
        '<li><b>Đời</b>: mua EXP để mở binh chủng mới và tăng sức chứa.</li>' +
        '<li><b>Nguyên soái</b>: chỉ huy đặc biệt, có năng lượng riêng để triệu hồi quân.</li></ul>';
    }],
    ['Menu tướng', function () {
      return '<h2>Chạm vào tướng</h2><ul><li>' + I.ui('move', 14) + ' <b>Di chuyển</b>: đổi chỗ xuất phát.</li><li>' + I.ui('swords', 14) + ' <b>Chiến thuật</b>: cách đánh, đội hình, vị trí tướng.</li><li>' + I.ui('flag', 14) + ' <b>Hành quân</b>: cắm cờ chỉ đường.</li><li>' + I.ui('plus', 14) + ' <b>Thêm lính</b>.</li></ul>' +
        '<h3>Cờ hành quân</h3><ul><li><b>Xanh</b>: đi thẳng tới điểm, bỏ qua giao tranh.</li><li><b>Đỏ</b>: đi và đánh; bị đánh là cả đội lao vào phản công.</li><li><b>Vàng</b>: hộ tống đạo quân bạn, giúp khi họ bị đánh.</li><li><b>Tím</b>: chỉ đánh đạo quân địch được chọn.</li></ul>' +
        '<p class="muted">Xong hết cờ, quân tự tìm địch gần nhất. Chạm lại cờ xanh/đỏ để sửa; chạm lại tướng để thoát chế độ cắm cờ.</p>';
    }],
    ['Giao tranh', function () {
      return '<h2>Giao tranh</h2><ul><li>Quân tự di chuyển, tự đánh, tướng tự dùng kỹ năng khi đầy năng lượng.</li><li>Chỉnh tốc độ ×1/×2/×4 hoặc bỏ qua trận.</li><li>Sau ' + (CFG.battleMaxSec / 60) + ' phút có <b>bão</b> gây sát thương tăng dần.</li><li><b>Tháp canh</b> giữ đủ lâu thì cả quân mạnh thêm.</li></ul>' +
        '<h3>Địa hình</h3><table>' + Object.keys(TT.TERRAIN).map(function (k) { var t = TT.TERRAIN[k]; return '<tr><td><b>' + t.name + '</b></td><td>' + t.desc + '</td></tr>'; }).join('') + '</table>';
    }],
    ['Điểm & phòng', function () {
      return '<h2>Điểm</h2>' + rankTable() + '<p>Cứ ' + CFG.killPopPerPoint + ' dân địch hạ được = 1 điểm.</p>' +
        '<h2>Phòng chờ</h2><ul><li>Chọn <b>tộc</b>, <b>thiên phú</b>, <b>trang bị khởi đầu</b>, <b>nguyên soái</b> và <b>skin</b> màu quân.</li><li>Chủ phòng có thể thêm Bot.</li><li>Mất mạng thì mở lại trang để vào lại trận.</li></ul>' +
        '<h2>Điều khiển</h2><p>Kéo để dời camera, hai ngón hoặc lăn chuột để phóng to, nút bên phải để xoay. Giữ chuột/ngón lên vật để xem mô tả.</p>';
    }]
  ];

  C.renderGuide = function (el) {
    var toc = C.guideSections.map(function (s, i) { return '<button data-i="' + i + '"' + (i ? '' : ' class="active"') + '>' + s[0] + '</button>'; }).join('');
    el.innerHTML = '<div class="guide-cta"><div><b>Mới chơi?</b><span>Hướng dẫn tân thủ dẫn bạn từng bước qua một ván thật với Bot (khoảng 5 phút).</span></div><button class="btn gold" id="guide-tut">' + TT.Icons.ui('star', 14) + ' Bắt đầu hướng dẫn</button></div><div class="guide-grid"><div class="guide-toc panel tight">' + toc + '</div><div class="panel doc" id="guide-body">' + C.guideSections[0][1]() + '</div></div>';
    var gt = el.querySelector('#guide-tut'); if (gt) gt.onclick = function () { TT.App.lobbyView('play'); TT.App.tutorial(); };
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
      '<div class="codex-tab' + (tab === 'mars' ? ' active' : '') + '" data-f="mars">' + tabIc(I.ui('crown', 20, '#fff')) + '<b>Nguyên soái</b></div>' +
      '<div class="codex-tab' + (tab === 'items' ? ' active' : '') + '" data-f="items">' + tabIc(I.ui('shield', 20, '#fff')) + '<b>Trang bị</b></div>' +
      '<div class="codex-tab' + (tab === 'cores' ? ' active' : '') + '" data-f="cores">' + tabIc(I.ui('bolt', 20, '#fff')) + '<b>Lõi</b></div>';
    var body;
    if (tab === 'mars') {
      body = '<h2>Nguyên soái</h2><p class="muted">Chọn ở phòng chờ, kết hợp tự do với mọi tộc.</p><table>' + TT.MARSHAL_LIST.map(function (id) { var m = TT.MARSHALS[id]; return '<tr><td style="width:150px"><b>' + m.name + '</b><br><small class="muted">' + m.tag + '</small></td><td>' + m.psd + (m.act ? '<br><b>' + m.act.name + '</b> (hồi ' + m.act.cd + ' giây): ' + m.act.desc : '') + '</td></tr>'; }).join('') + '</table>';
    } else if (tab === 'items') {
      body = '<h2>Trang bị</h2>' + [1, 2, 3, 4].map(function (t) {
        return '<h3>Bậc ' + TT.AGE_ROMAN[t] + ' · mở ở Đời ' + TT.AGE_ROMAN[t] + '</h3><table>' + TT.ITEM_ORDER.filter(function (k) { return TT.ITEMS[k].tier === t; }).map(function (k) { var it = TT.ITEMS[k]; return '<tr><td style="width:44px">' + I.item(k, 20) + '</td><td><b>' + it.name + '</b></td><td>' + C.costHtml(it.price) + '</td><td>' + it.desc + '</td></tr>'; }).join('') + '</table>';
      }).join('');
    } else if (tab === 'cores') {
      body = '<h2>Lõi</h2>' + [1, 2, 3, 4].map(function (t) {
        return '<h3>' + TT.TIER_NAME[t] + ' · ' + CFG.corePrice[t] + ' Vàng</h3><table>' + TT.CORE_ORDER.filter(function (k) { return TT.CORES[k].tier === t; }).map(function (k) { var c = TT.CORES[k]; return '<tr><td style="width:44px">' + I.coreIcon(k, 18) + '</td><td><b>' + c.name + '</b></td><td>' + c.desc + '</td></tr>'; }).join('') + '</table>';
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
