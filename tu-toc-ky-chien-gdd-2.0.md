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

Chế độ: **Đấu tay đôi** (bản đồ 40 × 60), **3 người**, **4 người hỗn chiến**, **2 đấu 2** (bản đồ 68 × 68); có Bot Dễ / Trung bình / Khó. Thời lượng một ván khoảng 20–35 phút.

---

## 2. Vòng lặp ván và ngày

```
Ngày 1 → … → Ngày 10 → Tổng kết
mỗi ngày: [Chuẩn bị đồng thời] → [Khóa + mở đội hình] → [Giao tranh tự động] → [Kết quả 8 giây]
```

| Pha | Nội dung | Kết thúc khi |
|---|---|---|
| **Chuẩn bị** | Nhận tài nguyên, Tinh thể, EXP; mua quân/trang bị/Lõi, lên Đời, xếp đội, cắm cờ. Quân các ngày trước đứng sẵn theo đội hình cũ. Đội hình hôm trước của đối thủ hiện mờ để tham khảo. | Hết giờ (do phòng chọn 30–180 giây; ngày 1 +45 giây) hoặc mọi người bấm **Sẵn sàng**. |
| **Khóa / mở** | Mỗi máy gửi mã băm đội hình; khi tất cả đã gửi (hoặc hết giờ) chủ phòng khóa ngày; sau đó mỗi người mở gói đội hình thật. | Mọi gói đã mở hoặc quá thời gian chờ. |
| **Giao tranh** | Mọi quân xuất hiện cùng lúc, tự đánh. Xem ở tốc độ ×1/×2/×4 hoặc bỏ qua. | Còn một phe (đội) có quân sống. |
| **Kết quả** | Điểm hạng + điểm hạ gục, thống kê từng đội, gợi ý cải thiện. Quân chết **hồi sinh** cho ngày sau. | Tự động sau 8 giây. |

**Quân không mất vĩnh viễn:** thua một ngày chỉ mất điểm; đội hình còn nguyên sang ngày sau. Đây là cơ chế chống lăn bóng tuyết chính (cùng với tài nguyên chia đều).

---

## 3. Kinh tế: Tài nguyên, Tinh thể, Đời

### 3.1 Tài nguyên (Vàng V, Thực T, Gỗ G)

- **Ai cũng nhận như nhau mỗi ngày**, mỗi loại V/T/G cùng một số, tăng dần theo ngày.
- **Dư giữ sang ngày sau, không có lãi.** Đã bỏ: Lãi tài nguyên, Thưởng thế trận ngày trước, Thưởng hạ gục.
- Tổng 10 ngày **bằng nhau cho mọi người**: 67 mỗi loại.
- Dùng để mua **quân** (ở Băng ghế) và **trang bị** (ở cửa hàng).
- **Bán quân / xóa quân / bán trang bị hoàn 100%** tài nguyên, bất kể lúc nào.

| Ngày | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Tổng |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V / T / G mỗi loại | 15 | 4 | 4 | 5 | 5 | 6 | 6 | 7 | 7 | 8 | **67** |

### 3.2 Tinh thể (như vàng TFT)

| Nguồn | Số lượng |
|---|---|
| Khởi đầu | 4 |
| Mỗi ngày | +5 (cố định, **không** có thưởng thứ hạng) |
| **Lãi** | mỗi 10 Tinh thể đang giữ đầu ngày → +1, tối đa +5 |
| Săn quái (ngày 3/6/9) | người hạ nhiều quái nhất: +1/+1/+2 |
| Sự kiện Vận May Binh Gia | +3 cho mọi người |

Tiêu Tinh thể vào: **EXP** (4 Tinh thể = 4 EXP), **Lõi** (giá theo bậc, mục 11), **đổi bảng Lõi** (1 Tinh thể, lần đầu mỗi ngày miễn phí). Bán Lõi hoàn 50%.

### 3.3 Đời (như cấp TFT)

- Mỗi ngày tự nhận **2 EXP**; mua thêm bằng Tinh thể. Đủ EXP thì lên Đời ngay trong lúc chuẩn bị.
- Lên Đời mở **quân mới** và **trang bị bậc mới**, thêm **Sức chứa**, **ô Lõi**, **ô trang bị** của đội trưởng, **số cờ** mỗi đội, và **Lệnh Soái** (Đời I/III/IV).

| Đời | EXP để lên Đời kế | Tổng EXP | Sức chứa (Nhân +) | Ô Lõi | Ô trang bị | Cờ/đội | Mở khóa quân | Lệnh Soái |
|---|---|---|---|---|---|---|---|---|
| I · Huyện | 6 | 0 | 12 (+1) | 3 | 2 | 2 | Lính, Thuẫn binh, Cung thủ; trang bị Bậc I | Lệnh thứ 1 |
| II · Quận | 14 | 6 | 20 (+2) | 4 | 2 | 3 | Thuật sĩ, Kỵ binh, Chỉ Huy; trang bị Bậc II | — |
| III · Châu | 24 | 20 | 30 (+3) | 5 | 3 | 4 | Thích khách, Pháp sư, Công thành; trang bị Bậc III | Lệnh thứ 2 |
| IV · Thành | — | 44 | 42 (+4) | 6 | 3 | 5 | Tượng binh, Thần thú; trang bị Bậc IV | Lệnh thứ 3 |

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
| Đấu tay đôi | 40 × 60 ô | 24 × 12 ô, hai đầu bản đồ |
| 3 / 4 người, 2 đấu 2 | 68 × 68 ô | 24 × 12 ô, ở 3–4 cạnh |

Bản đồ sinh theo seed, **đối xứng xoay** giữa các phe (công bằng), có kiểm tra liên thông. Phòng có tùy chọn **Khóa bản đồ** (ngày nào cũng Bình Nguyên).

### 5.2 Các bản đồ

| Bản đồ | Đặc điểm |
|---|---|
| **Bình Nguyên Giao Phong** | Gần như đồng bằng, vài rặng rừng, một đồi giữa bản đồ. Cân bằng, dễ làm quen. |
| **Thung Lũng Sông** | Sông cắt ngang, chỉ vài cây cầu. Hợp quân bay, Công thành và lối phòng thủ. |
| **Cao Nguyên Tháp** | Nhiều đồi cao và tháp canh. Hợp Cung thủ, Pháp sư. |
| **Rừng Sâu** | Rừng rậm, đường hẹp. Hợp Thích khách, Kỵ binh đánh úp. |
| **Đầm Hoang** | Đầm lầy trung tâm, đất khô quanh rìa. Quỷ tộc thích nơi này. |
| **Đường Cầu Thập Tự** | Vực đá chia bản đồ, nối bằng cầu; tháp canh ở giữa. Nhiều điểm nghẽn. |

### 5.3 Địa hình (có tooltip khi rê chuột)

| Ký hiệu | Địa hình | Hiệu ứng |
|---|---|---|
| `.` | **Đồng bằng** | Không có hiệu ứng. |
| `F` | **Rừng** | Quân trong rừng né thêm 10% đòn tầm xa. Đi chậm 10%. Che tầm bắn: quân xa ngoài rừng bắn vào bị −20% sát thương. |
| `H` | **Đồi cao** | Quân tầm xa đứng trên đồi +1 tầm và +10% ATK. Cận chiến đánh lên đồi −10% sát thương. Leo dốc chậm 15%. |
| `~` | **Sông nông** | Đi chậm 35% (Kỵ chậm 45%). Tiên tộc và quân bay không bị ảnh hưởng. |
| `S` | **Đầm lầy** | Đi chậm 30%, tốc đánh −15%, mất 1% máu mỗi giây. Quỷ tộc không bị ảnh hưởng; Tiên chỉ chậm một nửa. |
| `=` | **Cầu / Đường** | Đi nhanh hơn 15%. Điểm nghẽn chiến thuật. |
| `#` | **Vực đá** | Không đi qua được (trừ quân bay). Chặn đạn thẳng; Công thành bắn vòng qua được. |
| `T` | **Tháp canh** | Một bên đứng giữ 5 giây liên tục, không có địch, sẽ được +8% ATK toàn quân tới hết trận. Địch chiếm lại thì mất. |

**Bỏ sương mù:** cả chuẩn bị lẫn giao tranh đều nhìn thấy toàn bộ chiến trường.

---

## 6. Giao tranh tự động

### 6.1 Nguyên tắc

- **100% tự động**: quân tự tìm đường (flow-field Dijkstra theo chi phí địa hình), tự chọn mục tiêu, tự dùng kỹ năng khi đầy năng lượng; **Lệnh Soái tự kích hoạt** khi đủ điều kiện.
- 20 tick/giây, số nguyên, ngẫu nhiên có seed → mọi máy cùng kết quả.
- **Giới hạn 5 phút**: sau 300 giây, **bão chiến trường** gây sát thương thật lên **mọi quân** mỗi giây: giây thứ k gây 1·2^(k−1) (1, 2, 4, 8, 16…), bỏ qua khiên, cho tới khi còn một phe.
- **Tháp canh**: một phe đứng giữ 5 giây liên tục không có địch → toàn quân +8% ATK tới hết trận (địch chiếm lại thì mất).

### 6.2 Hành vi

| Nhóm | Hành vi |
|---|---|
| Cận chiến | Lao tới mục tiêu gần nhất (ưu tiên địch đang đánh đồng đội), giữ vị trí đánh. |
| Tầm trung | Giữ khoảng cách theo tầm; Thuật sĩ hồi máu đồng minh yếu nhất; Chỉ Huy tỏa hào quang. |
| Tầm xa | Đứng ngoài tầm cận chiến địch, cần đường ngắm (vực đá chặn; Công thành bắn vòng). |
| Quân bay | Bỏ qua địa hình, đi xuyên vực. |

Thứ tự ưu tiên hành vi: khống chế → cờ Xanh (hành quân) → kỹ năng → cờ Đỏ/Vàng → tư thế → tự động. Va chạm tách nhau bằng lưới không gian.

### 6.3 Năng lượng

Mỗi đòn đánh +10, mỗi lần bị đánh +5 (nhân hệ số hồi năng lượng của tộc/thiên phú). Đầy thanh → dùng kỹ năng riêng của quân.

### 6.4 Xếp hạng trong ngày

Phe bị loại **muộn hơn** xếp cao hơn; bị loại cùng lúc thì so tổng máu ngay trước đó, rồi số hạ gục.

---

## 7. Chỉ số và công thức

- Chỉ số mỗi quân = khuôn vai trò (mục 8) × hệ số tộc (mục 9.1) + trang bị (đội trưởng) + Lõi + thiên phú + ngày/đêm + thời tiết + sự kiện.
- **Sát thương vật lý** = ATK × hệ số × 100 / (100 + DEF). **Phép**: DEF tính một nửa. **Sát thương thật** (bão, một số kỹ năng): bỏ qua DEF.
- **Chí mạng** ×150% (trang bị/Lõi tăng được), **né** tối đa 40%, giảm sát thương tối đa 70%, tốc đánh tối đa 300%.
- **Hút máu**, **khiên**, **phản sát thương**, **xuyên giáp**, **choáng / làm chậm / đốt / giảm giáp** là các khối hiệu ứng dùng chung cho kỹ năng, trang bị và Lõi.
- **Ngày/đêm**: ban ngày Rồng và Nhân +4% ATK, ban đêm Tiên và Quỷ +4% ATK (ngày chẵn là đêm).

---

## 8. Binh chủng (khuôn vai trò cho một quân, trước hệ số tộc)

Đã thêm **tầm đánh** (ô) và phân nhóm **Cận chiến / Tầm trung / Tầm xa**; thêm **Thuật sĩ** (hồi máu) và **Chỉ Huy** (hào quang).

| Vai trò | Đời | Nhóm | Máu | ATK | DEF | Đòn/giây | Tầm | Tốc di | Năng lượng | Dân | Giá gốc | Loại |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Lính** | I | Cận chiến | 165 | 18 | 15 | 0.8 | 1 | 2 | 80 (đầu 20) | 1 | 1V 2T | vật lý |
| **Thuẫn binh** | I | Cận chiến | 250 | 12 | 32 | 0.6 | 1 | 1.8 | 60 (đầu 30) | 1 | 2T 2G | vật lý |
| **Cung thủ** | I | Tầm xa | 100 | 21 | 5 | 0.95 | 5 | 2 | 70 (đầu 20) | 1 | 1V 1T 2G | vật lý |
| **Thuật sĩ** | II | Tầm trung | 120 | 10 | 6 | 0.7 | 3.5 | 2 | 60 (đầu 20) | 2 | 2V 2T 2G | phép |
| **Kỵ binh** | II | Cận chiến | 185 | 24 | 12 | 0.9 | 1 | 3.5 | 70 (đầu 20) | 2 | 2V 2T 1G | vật lý |
| **Chỉ Huy** | II | Tầm trung | 170 | 13 | 16 | 0.7 | 2 | 2 | 60 (đầu 30) | 2 | 3V 2T 2G | vật lý |
| **Thích khách** | III | Cận chiến | 125 | 32 | 8 | 1.1 | 1 | 3 | 60 (đầu 30) | 2 | 3V 2G | vật lý |
| **Pháp sư** | III | Tầm xa | 95 | 23 | 5 | 0.8 | 4 | 2 | 50 (đầu 0) | 2 | 3V 1T 2G | phép |
| **Công thành** (nổ lan) | III | Tầm xa | 150 | 46 | 10 | 0.4 | 7 | 1.5 | 90 (đầu 0) | 3 | 2V 1T 4G | vật lý |
| **Tượng binh** | IV | Cận chiến | 560 | 40 | 35 | 0.6 | 1.2 | 2.2 | 100 (đầu 50) | 5 | 2V 4T 3G | vật lý |
| **Thần thú** (duy nhất) | IV | Cận chiến | 1150 | 62 | 40 | 0.7 | 1.5 | 2.5 | 100 (đầu 50) | 8 | 5V 4T 4G | vật lý |

---

## 9. Bốn tộc

### 9.1 Hệ số tộc (% so với khuôn)

| Tộc | Máu | ATK | DEF | Tốc đánh | Tốc di | Hồi năng lượng | Khác | Giá |
|---|---|---|---|---|---|---|---|---|
| Rồng tộc | 128 | 116 | 110 | 92 | 95 | 85 | — | +1T mỗi quân |
| Nhân tộc | 100 | 100 | 100 | 100 | 100 | 100 | — | gốc |
| Tiên tộc | 85 | 105 | 90 | 108 | 115 | 115 | +6% né  | gốc |
| Quỷ tộc | 100 | 105 | 100 | 102 | 100 | 100 | 9% hút máu | gốc |

### 9.2 Rồng tộc

*Tường cận chiến dày, đánh mạnh và bền; càng đánh lâu càng nguy hiểm.*

- **Nội tại — Long Huyết:** Mỗi 2% máu đã mất cộng 1% tốc đánh (tối đa +30%). Càng bị thương càng hung hãn.
- **Điểm yếu — Long Tham:** Mọi quân Rồng đắt hơn 1 Thực. Chậm và ít né: sợ bị thả diều và đốt máu.

**Thiên phú** (chọn 1 ở phòng chờ):

| Thiên phú | Hiệu ứng |
|---|---|
| **Long Huyết Cuồng** | Long Huyết tối đa +45% tốc đánh (thay vì +30%). |
| **Vảy Thép** | Mọi quân +8 DEF. |
| **Long Diễm** | Đòn đánh thường của quân tầm xa gây đốt 2 giây. |

**Lệnh Soái** (tự động):

| Lệnh | Mở ở | Hiệu ứng |
|---|---|---|
| **Long Lực** | Đời I | Khi quân ta giao chiến lần đầu: đội đang đánh mạnh nhất +40% ATK 6 giây. |
| **Long Hống** | Đời III | Khi có từ 8 địch áp sát một đội ta: địch quanh đó (4 ô) −15% ATK 5 giây. |
| **Long Uy** | Đời IV | Khi tổng máu quân ta dưới 50%: toàn quân giảm 25% sát thương và miễn khống chế 5 giây. |

**Quân** (chỉ số đã nhân hệ số tộc, quân lẻ không trang bị):

| Quân | Vai trò | Máu/ATK/DEF | Tầm | Giá | Nội tại | Kỹ năng (đầy năng lượng) |
|---|---|---|---|---|---|---|
| **Long Binh** | Lính | 211/21/17 | 1 | 1V 3T | Chém lan: mỗi đòn trúng thêm tối đa 2 địch kề mục tiêu với 50% sát thương. | **Chém Vảy:** Chém hình quạt 2 ô trước mặt, 160% ATK. |
| **Thuẫn Giáp Vảy** | Thuẫn binh | 320/14/35 | 1 | 3T 2G | Vảy cứng: đòn đầu tiên mỗi 5 giây chỉ nhận 60% sát thương. | **Gầm Khiêu Chiến:** Khiêu khích địch trong 3 ô 3 giây, bản thân +30% DEF 4 giây. |
| **Cung Xuyên Giáp** | Cung thủ | 128/24/6 | 5 | 1V 2T 2G | Tên xuyên: trúng thêm 1 địch phía sau mục tiêu với 50% sát thương. | **Mưa Tên Rồng:** Bắn 5 mũi vào các địch ít máu nhất trong tầm, mỗi mũi 90% ATK. |
| **Long Mạch Sư** | Thuật sĩ | 154/12/7 | 3.5 | 2V 3T 2G | Đòn đánh hồi máu đồng minh yếu nhất trong tầm (160% ATK) và cho họ +10% ATK 3 giây. | **Long Tuyền:** Hồi 18% máu tối đa cho 4 đồng minh yếu nhất trong 5 ô, họ được giảm 15% sát thương 3 giây. |
| **Long Kỵ** | Kỵ binh | 237/28/13 | 1 | 2V 3T 1G | Xung phong: chạy ít nhất 4 ô rồi đánh thì đòn đó +50% sát thương. | **Giày Xéo:** Lao xuyên qua mục tiêu, gây 140% ATK lên mọi địch trên đường và làm chậm 30% trong 2 giây. |
| **Chiến Hống Tướng** | Chỉ Huy | 218/15/18 | 2 | 3V 3T 2G | Hào quang 4 ô: đồng minh +10% ATK (hào quang cùng loại không cộng dồn). | **Hống Vương:** Đồng minh trong 4 ô +25% tốc đánh trong 5 giây. |
| **Long Trảo** | Thích khách | 160/37/9 | 1 | 3V 1T 2G | +25% sát thương lên quân tầm xa và tầm trung. | **Móc Trảo:** Nhảy tới quân tầm xa gần nhất, gây 220% ATK và giảm 25% DEF mục tiêu 4 giây. |
| **Long Tức Pháp Sư** | Pháp sư | 122/27/6 | 4 | 3V 2T 2G | Tầm đánh +1. | **Hơi Thở Rồng:** Phun lửa hình nón 5 ô, 170% ATK phép và đốt 3 giây. |
| **Pháo Phun Lửa** | Công thành | 192/53/11 | 7 | 2V 2T 4G | Đạn nổ lan 1 ô và gây đốt 3 giây. | **Đạn Lửa:** Nã một quả cầu lửa vùng 2 ô, 300% ATK. |
| **Long Tượng** | Tượng binh | 717/46/39 | 1.2 | 2V 5T 3G | Miễn đẩy lùi. Khi có từ 3 địch kề thì +15% DEF. | **Dậm Chân:** Choáng địch trong 1.8 ô 1.2 giây, 120% ATK. |
| **Cự Long** | Thần thú | 1472/72/44 | 1.5 | 5V 5T 4G | Bay qua mọi địa hình. Dưới 50% máu hồi 2% máu mỗi giây. | **Long Hỏa Thiên Giáng:** Lửa trời vùng 3 ô quanh mục tiêu, 350% ATK và đốt 4 giây. |

### 9.3 Nhân tộc

*Đông quân, linh hoạt, mạnh dần nhờ trang bị và đội hình.*

- **Nội tại — Quân Đông · Khéo Đồ:** Sức chứa thêm +1/+2/+3/+4 theo Đời. Đội trưởng có thêm 1 ô trang bị và trang bị mạnh hơn 15%. Mỗi trang bị trên đội trưởng cho cả đội +2% ATK.
- **Điểm yếu — Chỉ Số Thường:** Không có chỉ số vượt trội; sức mạnh đến từ số đông và trang bị.

**Thiên phú** (chọn 1 ở phòng chờ):

| Thiên phú | Hiệu ứng |
|---|---|
| **Rèn Khí** | Trang bị mạnh hơn 30% (thay vì 15%). |
| **Kỷ Luật** | Mọi quân +10% máu. |
| **Quân Lương** | Sức chứa thêm +2. |

**Lệnh Soái** (tự động):

| Lệnh | Mở ở | Hiệu ứng |
|---|---|---|
| **Tài Trợ Chiến Tranh** | Đời I | Khi giao chiến lần đầu: đội có nhiều trang bị nhất +25% sát thương 6 giây. |
| **Thu Quân Cứu Thương** | Đời III | Khi tổng máu dưới 60%: hồi 12% máu tối đa cho toàn quân. |
| **Kỳ Binh** | Đời IV | Giây thứ 15: 4 Vệ Binh tiếp viện xuất hiện ở vùng xuất quân. |

**Quân** (chỉ số đã nhân hệ số tộc, quân lẻ không trang bị):

| Quân | Vai trò | Máu/ATK/DEF | Tầm | Giá | Nội tại | Kỹ năng (đầy năng lượng) |
|---|---|---|---|---|---|---|
| **Vệ Binh** | Lính | 165/18/15 | 1 | 1V 2T | Kỷ luật đội ngũ: +2 DEF cho mỗi Vệ Binh đứng trong 2 ô (tối đa +10). | **Phối Hợp:** Đâm 140% ATK và nhận khiên 10% máu tối đa 3 giây. |
| **Thuẫn Hộ Tống** | Thuẫn binh | 250/12/32 | 1 | 2T 2G | Che chắn: quân tầm xa/tầm trung đứng trong 2 ô nhận ít hơn 15% sát thương. | **Tường Khiên:** Tạo khiên 20% máu tối đa cho 3 đồng minh gần nhất trong 4 giây. |
| **Nỏ Thủ** | Cung thủ | 100/21/5 | 5 | 1V 1T 2G | Nỏ nặng: bỏ qua 25% giáp mục tiêu. | **Tên Tẩm Dầu:** Bắn 160% ATK, mục tiêu nhận thêm 15% sát thương trong 4 giây. |
| **Mục Sư** | Thuật sĩ | 120/10/6 | 3.5 | 2V 2T 2G | Đòn đánh hồi máu đồng minh yếu nhất trong tầm (160% ATK) và gỡ 1 hiệu ứng xấu. | **Ánh Sáng Thánh:** Hồi 15% máu tối đa cho đồng minh trong 3 ô quanh người yếu nhất, họ +20% DEF 4 giây. |
| **Thương Kỵ** | Kỵ binh | 185/24/12 | 1 | 2V 2T 1G | Mũi thương: đòn đầu tiên lên mỗi mục tiêu mới +60% sát thương. | **Xung Kích:** Lao tới mục tiêu, 150% ATK và choáng 0.6 giây. |
| **Tướng Quân** | Chỉ Huy | 170/13/16 | 2 | 3V 2T 2G | Hào quang 4 ô: đồng minh +12% DEF và +5% tốc đánh. | **Hiệu Lệnh:** Đồng minh trong 5 ô +20% ATK và +20% DEF trong 5 giây. |
| **Sát Thủ Thuê** | Thích khách | 125/32/8 | 1 | 3V 2G | Săn đội trưởng: ưu tiên quân mang trang bị, +30% sát thương lên họ. | **Hợp Đồng Máu:** Lướt ra sau đội trưởng địch giá trị nhất, 260% ATK. |
| **Pháp Sư Hoàng Gia** | Pháp sư | 95/23/5 | 4 | 3V 1T 2G | Đòn đánh làm chậm 15% trong 1.5 giây. | **Băng Hỏa:** Nổ băng hỏa vùng 2.5 ô, 165% ATK phép và làm chậm 30% trong 2 giây. |
| **Nỏ Thần** | Công thành | 150/46/10 | 7 | 2V 1T 4G | Mũi nỏ lớn xuyên tối đa 3 mục tiêu trên đường bắn (mỗi mục tiêu sau giảm 25%). | **Tên Phá Thành:** Bắn một mũi xuyên thẳng 9 ô, 250% ATK lên mọi địch trúng. |
| **Voi Phá Trận** | Tượng binh | 560/40/35 | 1.2 | 2V 4T 3G | 15% mỗi đòn đẩy lùi mục tiêu 1 ô. | **Phá Tuyến:** Húc hình quạt 3 ô, 130% ATK và đẩy lùi 2 ô. |
| **Kỳ Lân Vàng** | Thần thú | 1150/62/40 | 1.5 | 5V 4T 4G | Phước lành 5 ô: đồng minh hồi 1% máu tối đa mỗi giây. | **Phước Vàng:** Hồi 15% máu cho đồng minh trong 5 ô và +15% ATK 5 giây. |

### 9.4 Tiên tộc

*Nhanh, né cao, dồn sát thương tầm xa; thắng nhờ tốc độ.*

- **Nội tại — Linh Khí:** Đầu giao tranh vô hình 1.5 giây (không bị chọn từ xa quá 2 ô). Đi qua sông không bị chậm, đầm lầy chỉ chậm một nửa.
- **Điểm yếu — Mong Manh:** Nhận thêm 15% sát thương từ kỹ năng diện rộng. Ít máu, sợ bị áp sát.

**Thiên phú** (chọn 1 ở phòng chờ):

| Thiên phú | Hiệu ứng |
|---|---|
| **Phong Thần** | 6 giây đầu giao tranh +20% tốc đánh và tốc di. |
| **Linh Ẩn** | Vô hình đầu trận kéo dài 3.5 giây. |
| **Tinh Linh** | Hồi năng lượng (MP) +20%. |

**Lệnh Soái** (tự động):

| Lệnh | Mở ở | Hiệu ứng |
|---|---|---|
| **Linh Nhãn** | Đời I | Đầu giao tranh: quân tầm xa +2 tầm trong 8 giây. |
| **Gió Thần** | Đời III | Khi giao chiến lần đầu: toàn quân +30% tốc di và +15% tốc đánh 5 giây. |
| **Thiên Mạc** | Đời IV | Khi tổng máu dưới 50%: khiên 20% máu tối đa cho toàn quân 4 giây. |

**Quân** (chỉ số đã nhân hệ số tộc, quân lẻ không trang bị):

| Quân | Vai trò | Máu/ATK/DEF | Tầm | Giá | Nội tại | Kỹ năng (đầy năng lượng) |
|---|---|---|---|---|---|---|
| **Kiếm Phong** | Lính | 140/19/14 | 1 | 1V 2T | 30% sau mỗi đòn lùi 1 ô (thả diều nhẹ). | **Nhát Gió:** Lướt xuyên qua mục tiêu, 150% ATK. |
| **Hộ Pháp** | Thuẫn binh | 213/13/29 | 1 | 2T 2G | Kết giới 3 ô: đồng minh nhận ít hơn 15% sát thương tầm xa. | **Màn Sáng:** Khiên 25% máu tối đa cho 3 đồng minh yếu nhất trong 4 ô, 3 giây. |
| **Thiên Xạ** | Cung thủ | 85/22/5 | 5 | 1V 1T 2G | Tầm +1; 20% sau khi bắn lùi 1 ô. | **Phi Tiễn:** 3 mũi tên vào 3 địch khác nhau, mỗi mũi 85% ATK. |
| **Linh Nữ** | Thuật sĩ | 102/11/5 | 3.5 | 2V 2T 2G | Đòn đánh hồi máu đồng minh yếu nhất (140% ATK) rồi nảy sang người thứ hai 50%. | **Suối Linh:** Đồng minh trong 3 ô quanh bản thân hồi 4% máu tối đa mỗi giây trong 4 giây. |
| **Phi Mã** | Kỵ binh | 157/25/11 | 1 | 2V 2T 1G | Bay: bỏ qua địa hình và đi xuyên quân. | **Bão Vó:** 4 cú đá liên tiếp, mỗi cú 75% ATK vào địch ngẫu nhiên gần đó. |
| **Quân Sư** | Chỉ Huy | 145/14/14 | 2 | 3V 2T 2G | Hào quang 4 ô: quân tầm xa +1 tầm, mọi đồng minh +15% hồi MP. | **Thiên Mạc:** 4 đồng minh gần nhất miễn hoàn toàn 1 đòn đánh thường (trong 4 giây). |
| **Ảnh Bộ** | Thích khách | 106/34/7 | 1 | 3V 2G | +15% né; vô hình đầu trận lâu hơn 1.5 giây. | **Ảnh Kiếm:** Biến mất, xuất hiện sau lưng mục tiêu gây 260% ATK, vô hình thêm 1.5 giây. |
| **Linh Quang** | Pháp sư | 81/24/5 | 4 | 3V 1T 2G | Đòn đánh nảy sang 1 địch gần đó với 50% sát thương. | **Mưa Sao:** 6 quả cầu sao rơi ngẫu nhiên quanh mục tiêu (3 ô), mỗi quả 75% ATK. |
| **Thạch Lôi Đài** | Công thành | 128/48/9 | 7 | 2V 1T 4G | Tầm +1; vừa di chuyển vừa bắn được. | **Sấm Truyền:** Sét 260% ATK, nảy tiếp 2 địch gần đó với 60%. |
| **Tượng Vân** | Tượng binh | 476/42/32 | 1.2 | 2V 4T 3G | Đi xuyên quân; +10% né. | **Cuộn Mây:** Hất tung địch trong 2 ô (choáng 1 giây), 110% ATK. |
| **Phượng Hoàng** | Thần thú | 978/65/36 | 1.5 | 5V 4T 4G | Bay. Chết lần đầu sẽ hồi sinh tại chỗ với 40% máu. | **Lửa Tái Sinh:** Vùng lửa 3 ô gây 300% ATK, đồng minh trong vùng hồi 20% máu. |

### 9.5 Quỷ tộc

*Đông quân rẻ, càng chết càng mạnh, hút máu để trụ.*

- **Nội tại — Hồn:** Mỗi quân chết trên chiến trường (ta hay địch) cho 1 Hồn (tối đa 25). Mỗi Hồn +1% ATK cho mọi quân Quỷ. Có hút máu 9%. Một số kỹ năng tiêu Hồn.
- **Điểm yếu — Huyết Nhục:** Không tự hồi máu; nhận hồi máu từ Thuật sĩ và trang bị chỉ còn 50%.

**Thiên phú** (chọn 1 ở phòng chờ):

| Thiên phú | Hiệu ứng |
|---|---|
| **Huyết Ẩm** | Hút máu thêm 6%. |
| **Hồn Chủ** | Mỗi Hồn +1.5% ATK (thay vì 1%). |
| **Bất Diệt** | Đội trưởng mỗi đội hồi sinh 1 lần với 30% máu. |

**Lệnh Soái** (tự động):

| Lệnh | Mở ở | Hiệu ứng |
|---|---|---|
| **Lời Nguyền** | Đời I | Khi giao chiến lần đầu: địch trong 4 ô quanh đội ta đang đánh −20% tốc đánh 5 giây. |
| **Huyết Tế** | Đời III | Khi có từ 5 Hồn: hiến tế quân ta yếu máu nhất, nổ 3 ô gây 30% máu tối đa của nó + 40 sát thương, +2 Hồn. |
| **Triệu Hồn Đại Trận** | Đời IV | Khi có từ 6 Hồn: tiêu 6 Hồn triệu 4 Tiểu Quỷ (60% chỉ số) cạnh đội đông nhất. |

**Quân** (chỉ số đã nhân hệ số tộc, quân lẻ không trang bị):

| Quân | Vai trò | Máu/ATK/DEF | Tầm | Giá | Nội tại | Kỹ năng (đầy năng lượng) |
|---|---|---|---|---|---|---|
| **Tiểu Quỷ** | Lính | 165/19/15 | 1 | 1V 2T | Chết cho thêm 1 Hồn. | **Vồ Hồn:** Vồ 140% ATK, hồi máu bằng 30% sát thương gây ra. |
| **Thuẫn Phản Oán** | Thuẫn binh | 250/13/32 | 1 | 2T 2G | Khi chết, kẻ kết liễu nhận sát thương bằng 10% máu tối đa của thuẫn. | **Oán Giáp:** Khiên 15% máu tối đa và phản 30% sát thương nhận trong 3 giây. |
| **Ma Tiễn** | Cung thủ | 100/22/5 | 5 | 1V 1T 2G | 25% sau khi bắn lùi 1 ô. | **Tên Nguyền:** Bắn 130% ATK, mục tiêu −20% ATK trong 4 giây. |
| **Tế Sư Máu** | Thuật sĩ | 120/11/6 | 3.5 | 2V 2T 2G | Đòn đánh rút máu kẻ địch (120% ATK phép) và hồi đúng lượng đó cho đồng minh yếu nhất. | **Huyết Khế:** Đồng minh trong 4 ô +20% hút máu và hồi 10% máu tối đa, 5 giây. |
| **Dạ Kỵ** | Kỵ binh | 185/25/12 | 1 | 2V 2T 1G | Mỗi lần hạ gục +1 Hồn. | **Truy Dạ:** Lao tới địch ít máu nhất trong 8 ô, 180% ATK. |
| **Hồn Soái** | Chỉ Huy | 170/14/16 | 2 | 3V 2T 2G | Hào quang 4 ô: đồng minh +8% hút máu. | **Triệu Hồn:** Tiêu 3 Hồn triệu 2 Tiểu Quỷ tạm thời (40% chỉ số); thiếu Hồn thì triệu 1. |
| **Bóng Ma** | Thích khách | 125/34/8 | 1 | 3V 2G | Hạ gục: hồi 20% máu và vô hình 1 giây. | **Ám Sát:** Lướt ra sau mục tiêu 250% ATK; nếu hạ gục thì nhận khiên 15% máu. |
| **Hắc Pháp Sư** | Pháp sư | 95/24/5 | 4 | 3V 1T 2G | Đòn đánh giảm 8% ATK mục tiêu 3 giây (cộng dồn 2 lần). | **Tử Vong Nguyền:** Vùng 3 ô: 150% ATK phép và giảm 50% hồi máu nhận trong 5 giây. |
| **Hồn Pháo** | Công thành | 150/48/10 | 7 | 2V 1T 4G | Mỗi 5 giây tiêu 1 Hồn (nếu có) để phát bắn kế +100% sát thương. | **Pháo Oán:** Vùng 2 ô, 320% ATK. |
| **Tượng Xương** | Tượng binh | 560/42/35 | 1.2 | 2V 4T 3G | Khi chết vỡ ra 3 Tiểu Quỷ tạm (25% chỉ số). | **Đại Cốt:** Choáng địch trong 2 ô 1 giây, bản thân nhận khiên 25% máu. |
| **Ma Vương** | Thần thú | 1150/65/40 | 1.5 | 5V 4T 4G | Khi chết để lại 2 Tiểu Quỷ (50% chỉ số). | **Hấp Hồn:** Tiêu toàn bộ Hồn: gây 100% ATK + 25% ATK mỗi Hồn lên địch trong 3 ô. |

---

## 10. Trang bị

- Mua bằng **tài nguyên** ở thẻ Trang bị; **bán hoàn 100%**. Bậc I–IV mở theo **Đời I–IV** (Đời cao → đồ tốt hơn).
- Chỉ **đội trưởng** nhận chỉ số; trang bị **Hào quang** cho cả đội. Ô trang bị đội trưởng: 2 / 2 / 3 / 3 theo Đời (Nhân tộc +1, và trang bị mạnh hơn 15%).
- Trang bị khởi đầu (chọn ở phòng chờ): Kiếm Sắt / Bùa Máu / Giáp Da.

**Bậc I** (Đời I)

| Trang bị | Giá | Hiệu ứng |
|---|---|---|
| **Kiếm Sắt** | 3V | +12 ATK. |
| **Giáp Da** | 3G | +12 DEF. |
| **Bùa Máu** | 3T | +120 máu. |
| **Cung Gió** | 2V 1G | +12% tốc đánh. |
| **Ngọc Linh** | 2V 1T | +20 MP khởi đầu, +15% hồi MP. |
| **Nhẫn Vận** | 2V 1T | +8% chí mạng, +6% né. |

**Bậc II** (Đời II)

| Trang bị | Giá | Hiệu ứng |
|---|---|---|
| **Đại Đao** | 4V 2G | +30 ATK; +10% sát thương lên địch có % máu thấp hơn mình. |
| **Thành Trì** | 2V 4G | +35 DEF; đòn đầu mỗi 4 giây nhận ít hơn 25%. |
| **Cự Tâm** | 2V 4T | +350 máu; hồi 1% máu tối đa mỗi giây. |
| **Huyết Kiếm** | 3V 2T 1G | +18 ATK, hút máu 12%. |
| **Cờ Hiệu** | 3V 1T 2G | Hào quang: cả đội +10% tốc đánh. |
| **Cung Linh** | 3V 1T 2G | +18% tốc đánh, +30 MP; mỗi đòn +3 MP. |

**Bậc III** (Đời III)

| Trang bị | Giá | Hiệu ứng |
|---|---|---|
| **Phong Tốc** | 5V 1T 3G | +30% tốc đánh; mỗi đòn thứ 4 đánh hai lần. |
| **Kiếm Dạ** | 5V 2T 2G | +20 ATK, +15% chí mạng, chí mạng +25% sát thương. |
| **Áo Giáp Lớn** | 2V 3T 4G | +20 DEF, +250 máu; phản 10% sát thương cận chiến. |
| **Bình Linh** | 3V 4T 2G | +250 máu, +30 MP; lần đầu dưới 40% máu hồi 25%. |
| **Quân Kỳ** | 4V 2T 3G | Hào quang: cả đội +10% DEF và +8% ATK. |
| **Trượng Linh** | 5V 2T 2G | +30 MP; kỹ năng +25% sát thương và hồi máu. |

**Bậc IV** (Đời IV)

| Trang bị | Giá | Hiệu ứng |
|---|---|---|
| **Thần Kiếm** | 7V 3T 4G | +45 ATK, +15% tốc đánh, bỏ qua 25% giáp. |
| **Ấn Bất Tử** | 5V 5T 4G | +300 máu; chết lần đầu hồi sinh với 40% máu. |
| **Long Lân Giáp** | 3V 5T 6G | +40 DEF, +400 máu, giảm 15% sát thương nhận. |
| **Thiên Tâm** | 6V 4T 4G | Hào quang: cả đội +15% ATK và +15% tốc đánh. |

---

## 11. Lõi

- Bảng 5 Lõi mỗi ngày, mua bằng Tinh thể: Đồng 1 · Bạc 2 · Vàng 3 · Lăng Kính 5. Khóa tối đa 2 Lõi để giữ qua lần đổi. Ô Lõi theo Đời: 3 / 4 / 5 / 6.
- Phạm vi: **toàn quân**, **kinh tế**, theo **nhóm tầm** (cận/trung/xa — Lõi theo tầm đánh), theo **binh chủng**, theo **tộc**.
- Tỉ lệ bậc xuất hiện theo Đời (Đồng/Bạc/Vàng/Lăng Kính): Đời I 70/30/0/0 · Đời II 45/40/15/0 · Đời III 25/40/28/7 · Đời IV 15/33/37/15.

**Đồng** (1 Tinh thể)

| Lõi | Phạm vi | Hiệu ứng |
|---|---|---|
| **Thân Thể Kim Cương** | Toàn quân | Toàn quân +8% máu. |
| **Lưỡi Thép** | Toàn quân | Toàn quân +6% ATK. |
| **Áo Giáp Dày** | Toàn quân | Toàn quân +6 DEF. |
| **Nhịp Trống** | Toàn quân | Toàn quân +6% tốc đánh. |
| **Giọt Máu** | Toàn quân | Toàn quân hút máu 4%. |
| **Tâm Linh Thông** | Toàn quân | Toàn quân +10 MP khởi đầu. |
| **Đôi Mắt Tinh Tường** | Toàn quân | Toàn quân +5% chí mạng. |
| **Bước Chân Nhẹ** | Toàn quân | Toàn quân +4% né. |
| **Mũi Xuyên** | Toàn quân | Toàn quân bỏ qua 10% giáp. |
| **Túi Tinh Thể** | Kinh tế | Mỗi ngày +1 Tinh thể. |

**Bạc** (2 Tinh thể)

| Lõi | Phạm vi | Hiệu ứng |
|---|---|---|
| **Huyết Chiến** | Cận chiến | Quân cận chiến hút máu 10%. |
| **Thép Nguội** | Cận chiến | Quân cận chiến +15% DEF và +10% máu. |
| **Linh Hoạt** | Tầm trung | Quân tầm trung +15% tốc đánh và +10% né. |
| **Mắt Ưng** | Tầm xa | Quân tầm xa +1 tầm đánh. |
| **Tên Lửa** | Tầm xa | Đòn của quân tầm xa gây đốt 2 giây. |
| **Chiến Binh Tinh Nhuệ** | Lính | Lính +20% máu, +10% ATK. |
| **Thiết Vệ** | Thuẫn binh | Thuẫn binh +25 DEF, +15% máu. |
| **Thần Tiễn** | Cung thủ | Cung thủ +20% tốc đánh. |
| **Thánh Thủ** | Thuật sĩ | Thuật sĩ hồi máu mạnh hơn 30%. |
| **Vó Sắt** | Kỵ binh | Kỵ binh +25% tốc di, +15% ATK. |
| **Dòng Suối Mana** | Toàn quân | Toàn quân +20% hồi MP. |
| **Tinh Thông Địa Hình** | Toàn quân | Không bị chậm bởi rừng, đầm, sông, đồi. |
| **Nhà Tiên Tri** | Kinh tế | Thêm 1 lần đổi Lõi miễn phí mỗi ngày. |
| **Ngân Khố** | Kinh tế | Lãi Tinh thể tối đa +2. |

**Vàng** (3 Tinh thể)

| Lõi | Phạm vi | Hiệu ứng |
|---|---|---|
| **Áp Sát** | Cận chiến | Quân cận chiến +20% ATK và +10% tốc di. |
| **Phản Kích** | Cận chiến | Quân cận chiến phản 15% sát thương cận chiến nhận. |
| **Hộ Tâm** | Tầm trung | Quân tầm trung hồi máu và tạo khiên mạnh hơn 25%. |
| **Bắn Tỉa** | Tầm xa | Quân tầm xa +2% sát thương mỗi ô cách mục tiêu (tối đa +20%). |
| **Mưa Tên** | Tầm xa | Quân tầm xa 20% bắn thêm 1 phát vào địch khác. |
| **Uy Danh** | Chỉ Huy | Hào quang Chỉ Huy rộng thêm 2 ô và mạnh hơn 50%. |
| **Sát Thủ Hoàn Hảo** | Thích khách | Thích khách +20% chí mạng, +30% sát thương chí mạng. |
| **Đại Pháp** | Pháp sư | Pháp sư kỹ năng +25% sát thương, +20 MP khởi đầu. |
| **Công Thành Chùy** | Công thành | Công thành nổ lan rộng thêm 1 ô, +10% ATK. |
| **Voi Chiến** | Tượng binh | Tượng binh +20% máu, choáng lâu thêm 0.5 giây. |
| **Chiêu Thức Cường Hóa** | Toàn quân | Kỹ năng của toàn quân +20% sát thương. |
| **Chiếm Cao Điểm** | Tầm xa | Quân tầm xa đứng trên đồi +15% ATK. |
| **Quân Lệnh Mở Rộng** | Kinh tế | Mỗi đội được thêm 1 bước cờ. |
| **Huyết Mạch Long** | Rồng tộc | Long Huyết mạnh gấp đôi (mỗi 1% máu mất +1% tốc đánh). |
| **Giáp Vảy Cổ** | Rồng tộc | Quân Rồng +15 DEF và phản 10% sát thương cận chiến. |
| **Thương Hội** | Nhân tộc | Mỗi trang bị đang gắn: toàn quân +2% ATK và máu (tối đa +20%). |
| **Đúc Thần Khí** | Nhân tộc | Trang bị mạnh thêm 25%. |
| **Gió Thuận** | Tiên tộc | Quân Tiên +10% tốc di và tốc đánh. |
| **Mê Hồn Trận** | Tiên tộc | Pháp sư Tiên làm chậm 20% mục tiêu 2 giây. |
| **Hồn Chủ** | Quỷ tộc | Mỗi Hồn mạnh thêm 50% (1.5% ATK), tối đa thêm 10 Hồn. |
| **Vực Thẳm Hút** | Quỷ tộc | Quân Quỷ hút máu thêm 10%. |

**Lăng Kính** (5 Tinh thể)

| Lõi | Phạm vi | Hiệu ứng |
|---|---|---|
| **Cuồng Chiến** | Cận chiến | Quân cận chiến mỗi lần hạ gục +8% tốc đánh (tối đa 5 lần) và hồi 10% máu. |
| **Pháo Đài** | Tầm xa | Quân tầm xa đứng yên quá 2 giây +30% tốc đánh. |
| **Thần Uy** | Thần thú | Thần thú +30% máu và ATK. |
| **Tâm Kiếm Hợp Nhất** | Toàn quân | Toàn quân vào trận với 50% MP. |
| **Lá Cờ Chiến Thắng** | Toàn quân | Chiếm tháp canh nhanh gấp đôi, mỗi tháp +5% ATK thêm. |
| **Hiệp Ước Hoàng Kim** | Kinh tế | Nhận ngay 3 Tinh thể và +1 Tinh thể mỗi ngày. |
| **Long Uy Tuyệt Đối** | Rồng tộc | Đầu giao tranh, địch trong 4 ô quanh quân Rồng bị choáng sợ 1.5 giây. |
| **Đoàn Kết** | Nhân tộc | Đội từ 10 quân trở lên +15% ATK, DEF và máu. |
| **Thiên Giới Giáng** | Tiên tộc | Đội trưởng Tiên chết lần đầu hồi sinh với 30% máu. |
| **Quân Đoàn Vong Linh** | Quỷ tộc | Cứ 4 quân ta chết thì 1 Tiểu Quỷ (50%) trỗi dậy tại chỗ. |

---

## 12. Tư thế và Cờ Lệnh

### 12.1 Tư thế

| Tư thế | Hành vi |
|---|---|
| **Tấn công** | Tiến về phía địch gần nhất và đánh. |
| **Giữ vị trí** | Chỉ đánh địch tới gần; không rời điểm đứng quá 4 ô. |
| **Săn hậu tuyến** | Ưu tiên quân tầm xa, Thuật sĩ, Chỉ Huy của địch. |
| **Rút khi yếu** | Như Tấn công, nhưng còn dưới 30% máu thì lùi về điểm xuất phát. |

### 12.2 Cờ Lệnh

Chọn đội → cắm tối đa 2 / 3 / 4 / 5 cờ (theo Đời), tổng tối đa 20 cờ mỗi người. Cờ được giữ sang ngày sau.

| Cờ | Hành vi |
|---|---|
| **Cờ Xanh · Hành Quân** | Đi thẳng tới cờ, không dừng lại đánh (trừ khi bị chặn kín quá 3 giây). |
| **Cờ Đỏ · Tiến Công** | Đi về phía cờ, gặp địch thì đánh, đánh xong đi tiếp. |
| **Cờ Vàng · Hộ Tống** | Đi sát cánh một đội khác của bạn và cùng đánh mục tiêu của đội đó. |

Cờ Vàng hộ tống: nếu cách đội được hộ tống quá 6 ô thì đi nhanh hơn 30% để bắt kịp. Khi bão bắt đầu, mọi cờ bị bỏ và đội chuyển sang tự động.

### 12.3 Lệnh Soái

Tự động, mỗi lệnh dùng tối đa một lần mỗi giao tranh (danh sách ở mục 9). Không cần thao tác.

---

## 13. Lịch 10 ngày, quái, sự kiện, thời tiết

| Ngày | Tên | Loại | Bản đồ |
|---|---|---|---|
| Ngày 1 | Ngày 1 | Giao tranh thường | Bình Nguyên Giao Phong |
| Ngày 2 | Ngày 2 | Giao tranh thường | ngẫu nhiên theo seed |
| Ngày 3 | Săn Quái | Săn quái | ngẫu nhiên theo seed |
| Ngày 4 | Ngày 4 | Giao tranh thường | ngẫu nhiên theo seed |
| Ngày 5 | Sự kiện | Sự kiện ngẫu nhiên | ngẫu nhiên theo seed |
| Ngày 6 | Săn Quái II | Săn quái | ngẫu nhiên theo seed |
| Ngày 7 | Ngày 7 | Giao tranh thường | ngẫu nhiên theo seed |
| Ngày 8 | Sự kiện | Sự kiện ngẫu nhiên | ngẫu nhiên theo seed |
| Ngày 9 | Săn Boss | Săn quái | ngẫu nhiên theo seed |
| Ngày 10 | Chung Kết | Chung kết (điểm hạng ×1.5) | Đường Cầu Thập Tự |

**Quái trung lập** (ngày săn quái; ai hạ nhiều quái nhất được Tinh thể):

| Cấp | Quái | Số lượng | Máu | ATK | DEF | Thưởng |
|---|---|---|---|---|---|---|
| 1 | Bầy Sói Rừng | 8 | 260 | 22 | 12 | 1 Tinh thể |
| 2 | Ngưu Ma | 3 | 1100 | 50 | 30 | 1 Tinh thể |
| 3 | Cổ Thụ Yêu Vương | 1 | 6000 | 90 | 45 | 2 Tinh thể |

**Sự kiện** (ngày 5 và 8, chọn ngẫu nhiên theo seed):

| Sự kiện | Hiệu ứng |
|---|---|
| **Cuồng Phong Chiến Tranh** | Hôm nay mọi quân +15% tốc đánh nhưng −10% máu. |
| **Vận May Binh Gia** | Mọi người nhận ngay 3 Tinh thể. |
| **Chiến Địa Hoang** | Bản đồ hôm nay có thêm 2 tháp canh. |

**Thời tiết** (ngẫu nhiên theo seed, Trời quang hay gặp nhất):

| Thời tiết | Hiệu ứng |
|---|---|
| **Trời quang** | Không có hiệu ứng. |
| **Mưa** | Quân tầm xa −10% tốc đánh; hiệu ứng đốt yếu đi một nửa. |
| **Nắng gắt** | Hồi máu mọi nguồn −20%. |
| **Gió lớn** | Mọi quân +4% né. |

---

## 14. Điểm, kết thúc, đầu hàng

| Số phe | Hạng 1 | Hạng 2 | Hạng 3 | Hạng 4 |
|---|---|---|---|---|
| 2 | 15 | 4 | — | — |
| 3 | 18 | 9 | 3 | — |
| 4 | 20 | 12 | 6 | 2 |

2 đấu 2: đội thắng 15, đội thua 4 điểm hạng mỗi người.

- **Điểm hạ gục**: mỗi 4 dân số quân địch bạn hạ = 1 điểm (cộng dồn qua các ngày, không mất phần lẻ).
- **Ngày 10 (Chung Kết)**: điểm hạng ×1.5.
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
| Tinh thể | +4/ngày + thưởng hạng | +5/ngày cố định + **lãi 1/10, tối đa 5** |
| Đời | Mua bằng Tinh thể theo mốc | **EXP như TFT**: 2/ngày + mua 4 EXP/4 Tinh thể |
| Kho / cửa hàng | Kho + cửa hàng 3 tab | **Băng ghế** = mua quân; **cửa hàng** = trang bị + Lõi; lên Đời ở bảng thông tin |
| Bản đồ | ~72×72, có sương mù tùy chọn | 40 × 60 (đôi) / 68 × 68, **không sương mù** |
| Lệnh Soái | Bấm tay | **Tự động** |
| Kết thúc giao tranh | Bão thu hẹp từ 45 giây, hết giờ 90 giây | **5 phút**, sau đó sát thương bão 1, 2, 4, 8… mỗi giây |
| Quy mô đội | Tối đa theo vai trò, Tiên ½, Hàng Ngũ | **Không giới hạn**, bỏ Tiên ½ và Hàng Ngũ |
| Binh chủng | 10 vai trò | 11 vai trò, thêm **tầm đánh**, **Thuật sĩ** hồi máu, **Chỉ Huy** hào quang; Lõi theo tầm |
| Đồ họa | Chibi tròn | **Khối bo góc + viền đậm + chibi**, hoạt ảnh nhảy chân sáo |

**Còn để ngỏ (đề xuất):** phát lại trận và "vì sao thua" chi tiết; chế độ Thử nghiệm (sandbox); thành tựu; xếp hạng mùa cần Cloud Functions kiểm kết quả (vì không có trọng tài); mẫu đội hình lưu sẵn.

*Hết tài liệu.*
