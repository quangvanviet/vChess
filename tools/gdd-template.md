# TỨ TỘC KỲ CHIẾN 2.0 — Tài liệu thiết kế (Auto-Battler chiến trường)

> **Bản 2.2 — bản đã triển khai** (08/10/2026). Cập nhật từ bản 2.1 theo các yêu cầu chỉnh sửa: bỏ lãi/thưởng tài nguyên, tài nguyên chia đều, Tinh thể kiểu vàng TFT có lãi, Đời kiểu cấp TFT, bán quân hoàn 100%, Băng ghế mua quân, cửa hàng trang bị + Lõi, bản đồ to hơn, bỏ sương mù, Lệnh Soái tự động, giao tranh 100% tự động có giới hạn 5 phút + bão tăng gấp đôi, không giới hạn quân mỗi đội, thêm tầm đánh / Thuật sĩ hồi máu / hào quang, đồ họa khối bo góc kiểu Ragnarok Online 2–3 có viền đậm và chibi.
> Mọi con số trong tài liệu này **được sinh trực tiếp từ `js/core/data.js`** của bản đã code, nên khớp 100% với game. Muốn chỉnh cân bằng: sửa `data.js` (mục `TT.CONFIG` và các bảng), không cần sửa logic.

---

## Mục lục

1. Tổng quan
2. Vòng lặp ván và ngày
3. Kinh tế: Tài nguyên, Tinh thể, Đời
4. Giai đoạn Chuẩn bị (Băng ghế, cửa hàng, đội)
5. Chiến trường, bản đồ, địa hình
6. Giao tranh tự động
7. Chỉ số và công thức
8. Binh chủng (khuôn vai trò, tầm đánh)
9. Bốn tộc (hệ số, nội tại, điểm yếu, thiên phú, Lệnh Soái, 44 quân)
10. Trang bị
11. Lõi
12. Tư thế và Cờ Lệnh
13. Lịch 10 ngày, quái, sự kiện, thời tiết, ngày/đêm
14. Điểm, kết thúc, đầu hàng
15. Cân bằng và kết quả mô phỏng
16. Kiến trúc kỹ thuật và đồng bộ Firebase
17. Đồ họa và hoạt ảnh
18. Giao diện và tooltip
19. Kiểm thử
20. Thay đổi so với bản 2.1 và việc còn để ngỏ

---

## 1. Tổng quan

**Một câu:** mỗi người chỉ ra quyết định ở giai đoạn Chuẩn bị (mua quân nào, xếp ở đâu, gắn đồ gì, chọn Lõi nào, lên Đời khi nào, cắm cờ ra sao); giao tranh hoàn toàn tự động. Ai chi tiêu và xếp đội khéo nhất qua 10 ngày sẽ thắng.

| Trụ cột | Ý nghĩa |
|---|---|
| **Công bằng kinh tế** | Mọi người nhận **cùng một lượng tài nguyên mỗi ngày**; không có lãi tài nguyên, không thưởng hạng, không thưởng hạ gục. Khác biệt chỉ đến từ quyết định. |
| **Ít thao tác, nhiều quyết định** | Kéo thả quân từ Băng ghế, kéo trang bị lên đội. Lệnh Soái và giao tranh tự chạy. |
| **Đọc được trận đấu** | Không sương mù; tooltip cho mọi quân, địa hình, trang bị, Lõi; báo cáo sau trận theo từng đội. |
| **Xác định hoàn toàn** | Cùng đội hình + seed = cùng kết quả trên mọi máy (nền của đồng bộ Firebase không trọng tài). |
| **Bốn tộc, bốn nhịp** | Rồng bền, mạnh, chậm; Nhân đông quân và mạnh nhờ đồ; Tiên nhanh, né, dồn sát thương; Quỷ rẻ, hút máu, mạnh lên theo số quân chết. |

Chế độ: **Đấu tay đôi** (bản đồ {{DIM2}}), **3 người**, **4 người hỗn chiến**, **2 đấu 2** (bản đồ {{DIM4}}); có Bot Dễ / Trung bình / Khó. Thời lượng một ván khoảng 20–35 phút.

---

## 2. Vòng lặp ván và ngày

```
Ngày 1 → … → Ngày 10 → Tổng kết
mỗi ngày: [Chuẩn bị đồng thời] → [Khóa + mở đội hình] → [Giao tranh tự động] → [Kết quả 8 giây]
```

| Pha | Nội dung | Kết thúc khi |
|---|---|---|
| **Chuẩn bị** | Nhận tài nguyên, Tinh thể, EXP; mua quân/trang bị/Lõi, lên Đời, xếp đội, cắm cờ. Quân các ngày trước đứng sẵn theo đội hình cũ. Đội hình hôm trước của đối thủ hiện mờ để tham khảo. | Hết giờ (do phòng chọn 30–180 giây; ngày 1 +{{DAY1}} giây) hoặc mọi người bấm **Sẵn sàng**. |
| **Khóa / mở** | Mỗi máy gửi mã băm đội hình; khi tất cả đã gửi (hoặc hết giờ) chủ phòng khóa ngày; sau đó mỗi người mở gói đội hình thật. | Mọi gói đã mở hoặc quá thời gian chờ. |
| **Giao tranh** | Mọi quân xuất hiện cùng lúc, tự đánh. Xem ở tốc độ ×1/×2/×4 hoặc bỏ qua. | Còn một phe (đội) có quân sống. |
| **Kết quả** | Điểm hạng + điểm hạ gục, thống kê từng đội, gợi ý cải thiện. Quân chết **hồi sinh** cho ngày sau. | Tự động sau {{RESSEC}} giây. |

**Quân không mất vĩnh viễn:** thua một ngày chỉ mất điểm; đội hình còn nguyên sang ngày sau. Đây là cơ chế chống lăn bóng tuyết chính (cùng với tài nguyên chia đều).

---

## 3. Kinh tế: Tài nguyên, Tinh thể, Đời

### 3.1 Tài nguyên (Vàng V, Thực T, Gỗ G)

- **Ai cũng nhận như nhau mỗi ngày**, mỗi loại V/T/G cùng một số, tăng dần theo ngày.
- **Dư giữ sang ngày sau, không có lãi.** Đã bỏ: Lãi tài nguyên, Thưởng thế trận ngày trước, Thưởng hạ gục.
- Tổng 10 ngày **bằng nhau cho mọi người**: {{RESTOTAL}} mỗi loại.
- Dùng để mua **quân** (ở Băng ghế) và **trang bị** (ở cửa hàng).
- **Bán quân / xóa quân / bán trang bị hoàn 100%** tài nguyên, bất kể lúc nào.

{{INCOME}}

### 3.2 Tinh thể (như vàng TFT)

| Nguồn | Số lượng |
|---|---|
| Khởi đầu | {{CRYSTART}} |
| Mỗi ngày | +{{CRYDAILY}} (cố định, **không** có thưởng thứ hạng) |
| **Lãi** | mỗi {{CRYPER}} Tinh thể đang giữ đầu ngày → +1, tối đa +{{CRYMAX}} |
| Săn quái (ngày 3/6/9) | người hạ nhiều quái nhất: +1/+1/+2 |
| Sự kiện Vận May Binh Gia | +3 cho mọi người |

Tiêu Tinh thể vào: **EXP** ({{XPCOST}} Tinh thể = {{XPAMT}} EXP), **Lõi** (giá theo bậc, mục 11), **đổi bảng Lõi** ({{REROLL}} Tinh thể, lần đầu mỗi ngày miễn phí). Bán Lõi hoàn {{CORESELL}}%.

### 3.3 Đời (như cấp TFT)

- Mỗi ngày tự nhận **{{XPDAILY}} EXP**; mua thêm bằng Tinh thể. Đủ EXP thì lên Đời ngay trong lúc chuẩn bị.
- Lên Đời mở **quân mới** và **trang bị bậc mới**, thêm **Sức chứa**, **ô Lõi**, **ô trang bị** của đội trưởng, **số cờ** mỗi đội, và **Lệnh Soái** (Đời I/III/IV).

{{AGE}}

Nhịp tham khảo: chỉ dùng EXP miễn phí thì lên Đời II ở ngày 4 và **không đủ** lên Đời III — phải mua EXP. Mua 4 EXP mỗi ngày: Đời II ngày 2, Đời III ngày 4, Đời IV ngày 8; dồn mua nhiều hơn để lên Đời IV sớm hơn (đổi lại ít Lõi). Bot Khó nhắm Đời II/III/IV ở ngày 2/4/7.

---

## 4. Giai đoạn Chuẩn bị

### 4.1 Bố cục màn hình

| Vùng | Nội dung |
|---|---|
| Trên giữa | Ngày, ngày/đêm, thời tiết, sự kiện, tên bản đồ; đồng hồ chuẩn bị; Hoàn tác, Xếp tự động, **Sẵn sàng** (tốc độ ×1/×2/×4 và Bỏ qua khi giao tranh). |
| Trên trái | Tộc, Đời + thanh EXP, V/T/G, Tinh thể, Dân số/Sức chứa, nút **+EXP**. |
| Trên phải | Danh sách người chơi: điểm, hạng hôm qua, trạng thái sẵn sàng; trong giao tranh có thanh máu tổng và số quân. |
| **Dưới giữa — Băng ghế** | Thẻ của 11 binh chủng theo tộc (tên quân riêng, giá, dân số; thẻ khóa ghi Đời cần). **Kéo thả** lên vùng xuất quân để mua; thả vào đội cùng loại để thêm quân; kéo đội về Băng ghế để bán (hoàn 100%). |
| **Phải — Cửa hàng** | Thẻ **Trang bị**: kho đồ, trang bị theo bậc (bậc khóa thu gọn). Thẻ **Lõi**: Lõi đang có, bảng 5 Lõi, khóa, đổi bảng. Thu gọn được (mặc định thu gọn trên điện thoại). |
| Trái dưới | Nhật ký trận / Chat. |
| Khi chọn đội | Bảng Đội: chỉ số thực của đội trưởng và lính, trang bị, tư thế, tách đội, cờ lệnh. |

Đã bỏ "Kho" (mục 3.4 bản cũ): Băng ghế chính là nơi mua quân.

### 4.2 Đội

- Quân cùng loại đứng chung một ô xuất quân là **một đội**, xếp đội hình tự động quanh ô đó. **Không giới hạn số quân mỗi đội** (bỏ giới hạn ½ của Tiên và cơ chế "Hàng Ngũ"); giới hạn duy nhất là **Sức chứa**.
- Mỗi đội có **đội trưởng** (vòng vàng). Trang bị gắn cho đội trưởng; đội trưởng chết thì trang bị chuyển cho quân còn sống kế tiếp.
- Thao tác: kéo đội sang ô khác (thả lên đội cùng loại = gộp, khác loại = đổi chỗ), tách đội, đổi tư thế, cắm cờ.
- **Xếp tự động** (nút đũa phép): cận chiến lên trước, tầm trung giữa, tầm xa sau.

### 4.3 Thông tin

Không còn thông tin ẩn trong giao tranh. Trong chuẩn bị, đội hình mới của đối thủ được gửi dạng **mã băm** nên không ai xem trộm được; đội hình **hôm trước** của họ hiện mờ trên sân.

---

## 5. Chiến trường, bản đồ, địa hình

### 5.1 Kích thước (đã nới rộng)

| Chế độ | Bản đồ | Vùng xuất quân mỗi người |
|---|---|---|
| Đấu tay đôi | {{DIM2}} ô | 24 × 12 ô, hai đầu bản đồ |
| 3 / 4 người, 2 đấu 2 | {{DIM4}} ô | 24 × 12 ô, ở 3–4 cạnh |

Bản đồ sinh theo seed, **đối xứng xoay** giữa các phe (công bằng), có kiểm tra liên thông. Phòng có tùy chọn **Khóa bản đồ** (ngày nào cũng Bình Nguyên).

### 5.2 Các bản đồ

{{MAPS}}

### 5.3 Địa hình (có tooltip khi rê chuột)

{{TERRAIN}}

**Bỏ sương mù:** cả chuẩn bị lẫn giao tranh đều nhìn thấy toàn bộ chiến trường.

---

## 6. Giao tranh tự động

### 6.1 Nguyên tắc

- **100% tự động**: quân tự tìm đường (flow-field Dijkstra theo chi phí địa hình), tự chọn mục tiêu, tự dùng kỹ năng khi đầy năng lượng; **Lệnh Soái tự kích hoạt** khi đủ điều kiện.
- 20 tick/giây, số nguyên, ngẫu nhiên có seed → mọi máy cùng kết quả.
- **Giới hạn 5 phút**: sau {{BATTLEMAX}} giây, **bão chiến trường** gây sát thương thật lên **mọi quân** mỗi giây: giây thứ k gây {{STORM}}·2^(k−1) (1, 2, 4, 8, 16…), bỏ qua khiên, cho tới khi còn một phe.
- **Tháp canh**: một phe đứng giữ {{TOWERSEC}} giây liên tục không có địch → toàn quân +{{TOWERATK}}% ATK tới hết trận (địch chiếm lại thì mất).

### 6.2 Hành vi

| Nhóm | Hành vi |
|---|---|
| Cận chiến | Lao tới mục tiêu gần nhất (ưu tiên địch đang đánh đồng đội), giữ vị trí đánh. |
| Tầm trung | Giữ khoảng cách theo tầm; Thuật sĩ hồi máu đồng minh yếu nhất; Chỉ Huy tỏa hào quang. |
| Tầm xa | Đứng ngoài tầm cận chiến địch, cần đường ngắm (vực đá chặn; Công thành bắn vòng). |
| Quân bay | Bỏ qua địa hình, đi xuyên vực. |

Thứ tự ưu tiên hành vi: khống chế → cờ Xanh (hành quân) → kỹ năng → cờ Đỏ/Vàng → tư thế → tự động. Va chạm tách nhau bằng lưới không gian.

### 6.3 Năng lượng

Mỗi đòn đánh +{{MPATK}}, mỗi lần bị đánh +{{MPHIT}} (nhân hệ số hồi năng lượng của tộc/thiên phú). Đầy thanh → dùng kỹ năng riêng của quân.

### 6.4 Xếp hạng trong ngày

Phe bị loại **muộn hơn** xếp cao hơn; bị loại cùng lúc thì so tổng máu ngay trước đó, rồi số hạ gục.

---

## 7. Chỉ số và công thức

- Chỉ số mỗi quân = khuôn vai trò (mục 8) × hệ số tộc (mục 9.1) + trang bị (đội trưởng) + Lõi + thiên phú + ngày/đêm + thời tiết + sự kiện.
- **Sát thương vật lý** = ATK × hệ số × 100 / (100 + DEF). **Phép**: DEF tính một nửa. **Sát thương thật** (bão, một số kỹ năng): bỏ qua DEF.
- **Chí mạng** ×150% (trang bị/Lõi tăng được), **né** tối đa {{CAPDODGE}}%, giảm sát thương tối đa {{CAPDR}}%, tốc đánh tối đa {{MAXAS}}%.
- **Hút máu**, **khiên**, **phản sát thương**, **xuyên giáp**, **choáng / làm chậm / đốt / giảm giáp** là các khối hiệu ứng dùng chung cho kỹ năng, trang bị và Lõi.
- **Ngày/đêm**: ban ngày Rồng và Nhân +4% ATK, ban đêm Tiên và Quỷ +4% ATK (ngày chẵn là đêm).

---

## 8. Binh chủng (khuôn vai trò cho một quân, trước hệ số tộc)

Đã thêm **tầm đánh** (ô) và phân nhóm **Cận chiến / Tầm trung / Tầm xa**; thêm **Thuật sĩ** (hồi máu) và **Chỉ Huy** (hào quang).

{{ROLES}}

---

## 9. Bốn tộc

### 9.1 Hệ số tộc (% so với khuôn)

{{FACMODS}}

{{FACTIONS}}

---

## 10. Trang bị

- Mua bằng **tài nguyên** ở thẻ Trang bị; **bán hoàn 100%**. Bậc I–IV mở theo **Đời I–IV** (Đời cao → đồ tốt hơn).
- Chỉ **đội trưởng** nhận chỉ số; trang bị **Hào quang** cho cả đội. Ô trang bị đội trưởng: {{ITEMSLOTS}} theo Đời (Nhân tộc +1, và trang bị mạnh hơn 15%).
- Trang bị khởi đầu (chọn ở phòng chờ): Kiếm Sắt / Bùa Máu / Giáp Da.

{{ITEMS}}

---

## 11. Lõi

- Bảng {{COREBOARD}} Lõi mỗi ngày, mua bằng Tinh thể: Đồng {{CC1}} · Bạc {{CC2}} · Vàng {{CC3}} · Lăng Kính {{CC4}}. Khóa tối đa {{CORELOCKS}} Lõi để giữ qua lần đổi. Ô Lõi theo Đời: {{CORESLOTS}}.
- Phạm vi: **toàn quân**, **kinh tế**, theo **nhóm tầm** (cận/trung/xa — Lõi theo tầm đánh), theo **binh chủng**, theo **tộc**.
- Tỉ lệ bậc xuất hiện theo Đời (Đồng/Bạc/Vàng/Lăng Kính): {{COREW}}.

{{CORES}}

---

## 12. Tư thế và Cờ Lệnh

### 12.1 Tư thế

{{STANCES}}

### 12.2 Cờ Lệnh

Chọn đội → cắm tối đa {{FLAGSTEPS}} cờ (theo Đời), tổng tối đa {{FLAGTOTAL}} cờ mỗi người. Cờ được giữ sang ngày sau.

{{FLAGS}}

Cờ Vàng hộ tống: nếu cách đội được hộ tống quá 6 ô thì đi nhanh hơn 30% để bắt kịp. Khi bão bắt đầu, mọi cờ bị bỏ và đội chuyển sang tự động.

### 12.3 Lệnh Soái

Tự động, mỗi lệnh dùng tối đa một lần mỗi giao tranh (danh sách ở mục 9). Không cần thao tác.

---

## 13. Lịch 10 ngày, quái, sự kiện, thời tiết

{{DAYS}}

**Quái trung lập** (ngày săn quái; ai hạ nhiều quái nhất được Tinh thể):

{{MONSTERS}}

**Sự kiện** (ngày 5 và 8, chọn ngẫu nhiên theo seed):

{{EVENTS}}

**Thời tiết** (ngẫu nhiên theo seed, Trời quang hay gặp nhất):

{{WEATHER}}

---

## 14. Điểm, kết thúc, đầu hàng

{{RANKPTS}}

- **Điểm hạ gục**: mỗi {{KILLPOP}} dân số quân địch bạn hạ = 1 điểm (cộng dồn qua các ngày, không mất phần lẻ).
- **Ngày 10 (Chung Kết)**: điểm hạng ×{{FINALMULT}}.
- **Thắng ván**: tổng điểm cao nhất; hòa thì so điểm hạng, rồi điểm hạ gục, rồi hạng ngày cuối. 2 đấu 2: cộng điểm hai đồng đội.
- **Đầu hàng / thoát**: bị loại khỏi các ngày sau; còn một phe thì kết thúc ngay. Người không gửi kịp đội hình giữ đội hình hôm trước.

---

## 15. Cân bằng và kết quả mô phỏng

Bộ mô phỏng (`tests/balance.js`, `tests/duel.js`) cho Bot chơi hàng trăm ván với seed khác nhau:

| Hạng mục | Kết quả |
|---|---|
| Tỉ lệ thắng ngày theo tộc (Rồng / Nhân / Tiên / Quỷ) | ≈ 51% / 55% / 46% / 49% |
| Đối xứng chỗ ngồi (cùng đội hình, đổi ghế) | ≈ 47–53% |
| Bot Khó thắng Bot Dễ | ≈ 82% |
| Bot Trung bình thắng Bot Dễ | ≈ 80% |
| Bot Khó thắng Bot Trung bình | ≈ 61% |

Bot: **Dễ** mua ngẫu nhiên, tiêu ~80%, ít đồ; **Trung bình** mua theo công thức vai trò, gắn đồ, cắm cờ; **Khó** mô phỏng 5 biến thể đội hình bằng chính `battle.js` và chọn phương án tốt nhất, ưu tiên đồ hào quang.

---

## 16. Kiến trúc kỹ thuật

```
js/core/data.js     Dữ liệu + TT.CONFIG (mọi số cân bằng)
js/core/maps.js     Sinh bản đồ đối xứng theo seed
js/core/prep.js     Logic chuẩn bị thuần: mua/bán/gộp/tách/trang bị/Lõi/EXP/cờ; tạo và kiểm tra gói đội hình
js/core/battle.js   Mô phỏng giao tranh xác định (20 tick/giây, số nguyên)
js/core/match.js    Quản lý ván: ngày, thu nhập, bản đồ, điểm
js/core/bot.js      Bot 3 mức
js/net/service.js   Firebase / chế độ cục bộ (?local=1)
js/ui/              app.js (sảnh, phòng), game.js (trận), field3d.js + models.js (3D), icons.js, content.js
tests/              run-tests.js (56 kiểm tra), balance.js, duel.js, gallery.html, battle.html
```

**Xác định:** số nguyên mili-ô, mulberry32 gieo từ hash(seed, ngày), duyệt theo id, sin/cos số nguyên, căn bậc hai số nguyên, mã băm FNV-64 kết quả.

**Đồng bộ (commit–reveal, không trọng tài):**

```
rooms/{mã}/days/0/fin            = {at}             mốc bắt đầu ván
rooms/{mã}/days/{n}/c/{ghế}      = hash(gói|nonce)  ghi khi chưa khóa (sửa được tới lúc khóa)
rooms/{mã}/days/{n}/lock         = {at, seats}      ghi một lần (chủ phòng; dự phòng mọi máy)
rooms/{mã}/days/{n}/r/{ghế}      = {p: gói, n: nonce} ghi một lần sau khi khóa, ≤ 12.000 ký tự
rooms/{mã}/days/{n}/fin          = {at, seats}      ghi một lần
rooms/{mã}/quit/{ghế}            = ngày đầu hàng
```

Gói đội hình: `{c: lệnh dùng Tinh thể, a: danh sách đội [id, loại, số quân, x, y, tư thế, trang bị, cờ], i: kho đồ, n: id kế}`. Máy nhận kiểm **ngân sách** (tài nguyên + giá trị quân), vùng xuất quân, mở khóa theo Đời, Sức chứa, cờ hợp lệ, và phát lại lệnh Tinh thể; sai luật hoặc sai mã băm thì giữ đội hình cũ. Chủ phòng tính và gửi gói của Bot. Mốc thời gian dùng đồng hồ máy chủ Firebase; lịch ngày tính từ `fin.at` nên mọi máy đồng bộ.

Chơi một mình với Bot: bỏ qua giao tranh sang ngày mới ngay sau màn kết quả.

**Cần cập nhật Firebase Rules** (file `database.rules.json`): thêm nhánh `days` và `quit` như trên.

---

## 17. Đồ họa và hoạt ảnh

- **Phong cách:** khối hộp kiểu Minecraft nhưng **mọi cạnh bo tròn**, màu tươi sáng kiểu Ragnarok Online 2–3, **chibi** đầu to tròn, mắt pixel và má hồng.
- **Viền đậm**: viền ngoài màu tối (inverted hull) cho nhân vật, quái và vật thể sàn đấu; độ dày khoảng 0,02 đơn vị cho nhân vật (đậm vừa, không che chi tiết), 0,035 cho cây, đá, tháp. Chi tiết nhỏ như mắt không có viền để mặt không bị rối.
- **44 mẫu quân khác nhau đúng tên gọi** (Kỵ binh cưỡi thú riêng của tộc — Rồng cưỡi long mã đỏ; Thuẫn binh mang khiên lớn; Cung thủ cầm cung; Pháp sư cầm trượng; Công thành là cỗ máy; Thần thú là sinh vật lớn riêng mỗi tộc như Ma Vương đội vương miện sừng lớn của Quỷ; quân Tiên có cánh, Rồng có sừng và đuôi, Quỷ có sừng), cùng quái Sói / Ngưu Ma / Cổ Thụ.
- **Hoạt ảnh ngộ nghĩnh, mượt**: đi kiểu nhảy chân sáo, lò cò, lắc lư trái phải; nhún khi tiếp đất; thân nghiêng theo bước; xoay mặt mượt; lao tới khi đánh; quân lớn và thú cưỡi có nhịp riêng. Mọi chuyển động nội suy theo khung hình (không giật theo tick 20 Hz).
- **Sàn đấu và VFX cùng phong cách:** ô đất khối bo góc, cây tán khối hai tầng (có cây hoa hồng), đá, cầu ván, hàng rào, tháp canh, mây khối; mũi tên, đá bắn, cầu phép là khối nhỏ xoay; hạt hiệu ứng là khối lập phương bo góc; vòng kỹ năng bát giác.
- Camera: kéo để dời, xoay, phóng to; **góc nhìn tự hạ thấp khi phóng to** để thấy rõ mặt quân, xa thì nhìn từ trên xuống để bao quát.
- Chế độ đồ họa Nhẹ cho điện thoại.

---

## 18. Giao diện và tooltip

- **Tooltip** (rê chuột hoặc giữ ngón tay): quân (tên, vai trò, chỉ số thực, tầm, nội tại, kỹ năng), địa hình (hiệu ứng), trang bị, Lõi, thẻ Băng ghế. Ngắn gọn nhưng đủ ý.
- Popup có nút **i** giải thích tùy chọn (chế độ, thời gian chuẩn bị, khóa bản đồ, phòng riêng, độ khó Bot).
- Toàn bộ chữ tiếng Việt, biểu tượng vẽ bằng SVG (không dùng emoji).
- HUD tự sắp xếp không chồng nhau; bố cục riêng cho điện thoại (Băng ghế cuộn ngang, cửa hàng thu gọn).
- Phím tắt: Ctrl+Z hoàn tác, Space sẵn sàng, Delete bán đội, 1/2/4 tốc độ, H về góc nhìn, Esc bỏ chọn.

---

## 19. Kiểm thử

`node tests/run-tests.js` — 56 kiểm tra: dữ liệu đủ 44 quân / 22 trang bị / Lõi, kinh tế (thu nhập bằng nhau, lãi Tinh thể, EXP, hoàn 100%), Sức chứa, gộp/tách không nhân bản, gói đội hình và kiểm tra gian lận, xác định (cùng seed cùng hash), bão kết thúc trận, tháp canh, cờ, hộ tống, ván đầy đủ với Bot 2/3/4 người ở 3 mức. Trình duyệt: `tests/gallery.html` (xem 44 mẫu 3D), `tests/battle.html` (xem giao tranh), và chế độ `index.html?local=1` để chơi không cần Firebase.

---

## 20. Thay đổi so với bản 2.1 và việc còn để ngỏ

**Đã đổi theo yêu cầu:**

| Mục | Bản 2.1 | Bản 2.2 |
|---|---|---|
| Thu nhập tài nguyên | Thu nhập + Lãi + Thưởng thế trận + Thưởng hạ gục | Chia đều, tăng theo ngày, dư giữ lại, không lãi |
| Bán quân | 100% cùng pha, 70% sau | **100% mọi lúc** |
| Tinh thể | +4/ngày + thưởng hạng | +{{CRYDAILY}}/ngày cố định + **lãi 1/10, tối đa {{CRYMAX}}** |
| Đời | Mua bằng Tinh thể theo mốc | **EXP như TFT**: {{XPDAILY}}/ngày + mua {{XPAMT}} EXP/{{XPCOST}} Tinh thể |
| Kho / cửa hàng | Kho + cửa hàng 3 tab | **Băng ghế** = mua quân; **cửa hàng** = trang bị + Lõi; lên Đời ở bảng thông tin |
| Bản đồ | ~72×72, có sương mù tùy chọn | {{DIM2}} (đôi) / {{DIM4}}, **không sương mù** |
| Lệnh Soái | Bấm tay | **Tự động** |
| Kết thúc giao tranh | Bão thu hẹp từ 45 giây, hết giờ 90 giây | **5 phút**, sau đó sát thương bão 1, 2, 4, 8… mỗi giây |
| Quy mô đội | Tối đa theo vai trò, Tiên ½, Hàng Ngũ | **Không giới hạn**, bỏ Tiên ½ và Hàng Ngũ |
| Binh chủng | 10 vai trò | 11 vai trò, thêm **tầm đánh**, **Thuật sĩ** hồi máu, **Chỉ Huy** hào quang; Lõi theo tầm |
| Đồ họa | Chibi tròn | **Khối bo góc + viền đậm + chibi**, hoạt ảnh nhảy chân sáo |

**Còn để ngỏ (đề xuất):** phát lại trận và "vì sao thua" chi tiết; chế độ Thử nghiệm (sandbox); thành tựu; xếp hạng mùa cần Cloud Functions kiểm kết quả (vì không có trọng tài); mẫu đội hình lưu sẵn.

*Hết tài liệu.*
