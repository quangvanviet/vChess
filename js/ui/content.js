/* Nội dung tĩnh: hướng dẫn, bách khoa, mẹo màn tải. */
(function (G) {
  'use strict';
  var TT = G.TT, I = TT.Icons, U = TT.UNITS, F = TT.FACTIONS;
  var C = TT.Content = {};

  C.costHtml = function (c) {
    if (!c) return '<span class="muted">—</span>';
    var s = [];
    if (c.any) s.push('<i class="cAny">' + c.any + '</i> bất kỳ');
    if (c.V) s.push('<i class="cV">' + c.V + 'V</i>');
    if (c.T) s.push('<i class="cT">' + c.T + 'T</i>');
    if (c.G) s.push('<i class="cG">' + c.G + 'G</i>');
    return '<span class="cost">' + (s.join(' ') || '0') + '</span>';
  };
  function moveText(u) {
    var m = u.move, d = { orth: '4 hướng', diag: 'chéo', all: '8 hướng', knight: 'nhảy chữ L' }[m.dirs];
    return m.dirs === 'knight' ? 'Nhảy chữ L' : 'Đi ' + m.range + ' ô ' + d;
  }
  function atkText(u) {
    var a = u.atk; if (a.kind === 'none') return 'Không đánh';
    var d = { orth: 'thẳng', diag: 'chéo', all: '8 hướng' }[a.dirs];
    return (a.kind === 'melee' ? 'Cận chiến' : 'Tầm xa') + ' ' + d + ' ' + a.range + ' ô' + (a.x2 ? ', ×2, bắn qua đầu' : '');
  }
  C.unitCard = function (type, fid) {
    var u = U[type];
    var ic = I.svg(I.unitKey(type, 'V'), F[fid] ? F[fid].color2 : '#f0e6d2', 28);
    var trait = fid && F[fid].traits[type] ? '<div class="tr">' + I.ui('star', 11) + ' ' + F[fid].traits[type] + '</div>' : '';
    var fakeSt = null;
    var cost = u.cost ? C.costHtml(fid ? C.priceFor(fid, type) : u.cost) : '<span class="muted">Có sẵn</span>';
    return '<div class="unit-card"><div class="ic">' + ic + '</div><div><div class="t">' + u.name + ' <small class="muted">Đời ' + (TT.AGE_ROMAN[u.age] || '—') + '</small></div>' +
      '<div class="d">' + moveText(u) + ' · ' + atkText(u) + (u.hp > 1 ? ' · ' + u.hp + ' HP' : '') + '</div><div class="d">Giá: ' + cost + '</div>' + trait + '</div></div>';
  };
  C.priceFor = function (fid, type) {
    var c = U[type].cost, r = { V: c.V, T: c.T, G: c.G, any: 0 };
    if (fid === 'dragon' && type !== 'worker') r.T += 1;
    if (fid === 'demon' && type === 'soldier') { r.V = 1; r.T = 1; r.G = 0; }
    if (fid === 'human' && type === 'soldier') { r.V = 0; r.T = 0; r.G = 0; r.any = 2; }
    if (fid === 'human' && type === 'siege') r.G -= 1;
    return r;
  };

  C.guideSections = [
    ['Tổng quan', '<h2>Tổng quan</h2><p>Mỗi người chỉ có <b>một Vua</b> và <b>10 vàng</b>. Dùng Dân làm kinh tế, mua quân để chiến đấu, lên Đời để có thêm hành động mỗi lượt, và dùng kỹ năng tộc để lật ván. <b>Mất Vua là thua</b> — toàn bộ quân của người đó biến mất.</p><p>Không có may rủi trong chiến đấu: sát thương luôn tính được trước. Điểm ngẫu nhiên duy nhất là vị trí ô tài nguyên giữa bàn và xúc xắc chọn người đi trước.</p>'],
    ['Lượt chơi', '<h2>Một lượt gồm 3 pha</h2><ol><li><b>Thu hoạch</b> (tự động): +1 Vàng cơ bản + sản lượng Dân. Dân đứng trên ô đúng nghề thu ×2.</li><li><b>Mua sắm & lên Đời</b>: mua tùy ý, không tốn hành động. Quân mới đặt ở <b>hàng spawn</b> và <b>nghỉ</b> tới lượt sau.</li><li><b>Hành động</b>: số hành động = số Đời (I:1, II:2, III:3, IV:4). Mỗi hành động chọn 1 đội: đi (tối đa tầm) rồi có thể đánh 1 mục tiêu.</li></ol><p>Khi bạn thực hiện hành động đầu tiên, pha mua sắm kết thúc. Kỹ năng Q/W/E dùng được trước hoặc giữa các hành động.</p><p><b>3 lượt đầu miễn chiến</b>: không ai được tấn công hay dùng kỹ năng nhắm đối thủ.</p><p><b>Từ lượt 40 — Suy Tàn</b>: mất +1 Vàng cơ bản, Dân chỉ sản xuất trên ô đúng nghề.</p>'],
    ['Điều khiển', '<h2>Điều khiển trên bàn cờ</h2><table><tr><th>Thao tác</th><th>Cách làm</th></tr>' +
      '<tr><td>Mua quân</td><td>Bấm quân trong <b>Cửa hàng</b> → bấm ô sáng vàng ở hàng spawn. Bấm tiếp để mua thêm vào cùng ô. Chuột phải / Esc để thôi.</td></tr>' +
      '<tr><td>Chọn đội</td><td>Bấm vào quân của bạn. Ô <span style="color:#0ac8b9">xanh</span> là nơi đi được, vòng <span style="color:#ff6b6b">đỏ</span> là mục tiêu đánh được.</td></tr>' +
      '<tr><td>Đi rồi đánh</td><td>Bấm ô xanh → bàn hiện bóng mờ ở vị trí mới và các mục tiêu từ đó. Bấm mục tiêu để đánh, bấm lại bóng mờ (hoặc nút <b>Chỉ đi</b>) để chỉ di chuyển.</td></tr>' +
      '<tr><td>Tách đội</td><td>Kéo thanh <b>Số quân</b> ở bảng Đơn vị trước khi đi.</td></tr>' +
      '<tr><td>Xem trước</td><td>Rê chuột lên mục tiêu để thấy sát thương, có diệt được không và thưởng nhận.</td></tr>' +
      '<tr><td>Kỹ năng</td><td>Bấm Q/W/E (hoặc phím Q, W, E) rồi chọn đội theo hướng dẫn phía trên bàn cờ.</td></tr>' +
      '<tr><td>Hoàn tác</td><td>Ctrl+Z hoặc nút Hoàn tác. Mọi thao tác chỉ gửi lên mạng khi bạn bấm <b>Kết thúc lượt</b> (phím Enter).</td></tr>' +
      '<tr><td>Thưởng kết liễu</td><td>Chọn loại tài nguyên muốn nhận (V/T/G) ở góc dưới phải.</td></tr></table>'],
    ['Chiến đấu', '<h2>Sát thương & đội quân</h2><p>Quân cùng loại cùng ô gộp thành <b>đội</b> (tối đa 6, Tiên 3). Đội N quân có N HP và gây <b>N sát thương</b>. Thứ tự tính: cơ bản → nhân (×2 Công thành, +50% Long Lực) → cộng (Chỉ Huy, Tài Trợ…) → giảm (Thuẫn binh, Giáp…).</p><p><b>Cận chiến</b> diệt sạch đội trong ô thì được chiếm ô. <b>Tầm xa</b> không chiếm ô và bị quân giữa đường chặn (trừ Công thành).</p><p><b>Thưởng kết liễu</b> = HP còn lại của đội ngay trước đòn cuối, chỉ trả khi cả đội bị diệt. Diệt Vua: 3 tài nguyên. Không có phản đòn — ai đánh trước gây sát thương trước.</p>'],
    ['Đời', '<h2>Hệ thống Đời</h2><table><tr><th>Đời</th><th>Hành động</th><th>Chi phí</th><th>Mở khóa</th></tr>' +
      '<tr><td>I · Huyện</td><td>1</td><td>—</td><td>Dân, Lính, Cung thủ</td></tr>' +
      '<tr><td>II · Quận</td><td>2</td><td>3V 3T 2G</td><td>Thuẫn binh, Kỵ binh</td></tr>' +
      '<tr><td>III · Châu</td><td>3</td><td>7V 7T 6G</td><td>Thích khách, Pháp sư, Công thành</td></tr>' +
      '<tr><td>IV · Thành</td><td>4</td><td>14V 13T 13G</td><td>Chiến xa, Thần thú, Chỉ Huy, Tượng binh</td></tr></table><p>Lên Đời có hiệu lực ngay trong lượt.</p>'],
    ['Chơi online', '<h2>Phòng & trận online</h2><ul><li><b>Tạo phòng</b> chọn 2/3/4 người, thời gian mỗi lượt và các tùy chọn; mã phòng 6 ký tự để mời bạn.</li><li>Trong phòng chờ chọn <b>tộc</b>, <b>nội tại</b> (như bảng ngọc) và <b>ô nhà</b> (như phép bổ trợ). Kỹ năng Q/W/E cố định theo tộc.</li><li>Chủ phòng có thể <b>thêm Bot</b> vào ghế trống hoặc mời ra.</li><li>Khi mọi người sẵn sàng, chủ phòng bấm <b>Bắt đầu</b>. Xúc xắc quyết định người đi trước, rồi lượt đi theo chiều kim đồng hồ.</li><li>Hết giờ lượt: người khác có thể bỏ lượt hộ bạn. Bỏ lượt 3 lần bị xử thua.</li><li>Mất mạng? Mở lại trang và bấm <b>Vào lại trận</b> — ván được phát lại từ sổ lệnh.</li></ul>']
  ];

  C.renderGuide = function (el) {
    var toc = C.guideSections.map(function (s, i) { return '<button data-i="' + i + '"' + (i ? '' : ' class="active"') + '>' + s[0] + '</button>'; }).join('');
    el.innerHTML = '<div class="guide-grid"><div class="guide-toc panel tight">' + toc + '</div><div class="panel doc" id="guide-body">' + C.guideSections[0][1] + '</div></div>';
    el.querySelectorAll('.guide-toc button').forEach(function (b) {
      b.onclick = function () {
        el.querySelectorAll('.guide-toc button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); el.querySelector('#guide-body').innerHTML = C.guideSections[+b.dataset.i][1];
      };
    });
  };

  C.renderCodex = function (el, fid) {
    fid = fid || 'dragon';
    var f = F[fid];
    var tabs = TT.FACTION_ORDER.map(function (k) { return '<div class="codex-tab' + (k === fid ? ' active' : '') + '" data-f="' + k + '">' + I.crest(k, 40) + '<b>' + F[k].name + '</b></div>'; }).join('');
    var pas = f.passives.map(function (p) { return '<tr><td><b>' + p.name + '</b></td><td>' + p.text + '</td></tr>'; }).join('');
    var act = f.actives.map(function (a) { return '<tr><td><span class="key">' + a.key + '</span> <b>' + a.name + '</b></td><td>Hồi ' + a.cd + '</td><td>' + a.text + '</td></tr>'; }).join('');
    var units = ['king'].concat(TT.UNIT_ORDER).map(function (u) { return C.unitCard(u, fid); }).join('');
    el.innerHTML = '<div class="codex-tabs">' + tabs + '</div><div class="panel doc"><div style="display:flex;gap:18px;align-items:center">' + I.crest(fid, 110) +
      '<div><h2 style="margin:0">' + f.name + '</h2><p style="margin:.3em 0" class="muted"><i>' + f.theme + '</i></p><p class="weak" style="display:inline-block">Điểm yếu — <b>' + f.weakness.name + '</b>: ' + f.weakness.text + '</p></div></div>' +
      '<h3>Nội tại (chọn 1)</h3><table>' + pas + '</table><h3>Kích hoạt</h3><table>' + act + '</table><h3>Quân đội</h3><div class="unit-grid">' + units + '</div></div>';
    el.querySelectorAll('.codex-tab').forEach(function (t) { t.onclick = function () { C.renderCodex(el, t.dataset.f); }; });
  };

  C.tips = [
    'Dân đứng trên ô tài nguyên đúng nghề thu gấp đôi — kể cả ô nhà của đối thủ.',
    'Đội 4 quân đánh trước đội 6 quân vẫn gây 4 sát thương trước. Không có phản đòn!',
    'Công thành không bắn được nếu đã di chuyển trong lượt — hãy đặt nó trước.',
    'Thưởng kết liễu bằng HP còn lại trước đòn cuối: hãy để đồng đội làm yếu, rồi kết liễu bằng đội nhỏ.',
    'Lên Đời II sớm gấp đôi tốc độ, nhưng đổi lấy 8 tài nguyên — khoảng 4 Dân.',
    'Vua Tiên và Vua Quỷ chỉ đi 1 ô — săn Vua họ bằng Kỵ binh hoặc Chiến xa.',
    'Thuẫn binh giảm 1 sát thương mỗi đòn tầm xa: Cung thủ lẻ không làm gì được chúng.',
    'Quân Quỷ chết cho Hồn. Đổi mạng với Quỷ thường khiến họ mạnh hơn.',
    'Hối Lộ của Nhân tộc chỉ chạm được quân lẻ — đi theo đội để an toàn.',
    'Ba lượt đầu miễn chiến: hãy dựng kinh tế và giành ô tài nguyên giữa bàn.'
  ];
})(window);
