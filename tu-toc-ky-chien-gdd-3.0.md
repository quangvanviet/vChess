# TỨ TỘC KỲ CHIẾN 3.0 — Tài liệu thiết kế (Auto-Battler chiến trường)

> **Bản 3.0 — bản đã triển khai.** Luật chơi (mã luật `tt-3.0.0`): một loại tiền duy nhất là **Vàng**; mỗi đạo quân gồm **1 Tướng + lính cùng binh chủng**; chỉ tướng dùng kỹ năng, có MP và đeo trang bị; mọi thứ (quân, đồ, Lõi, Đời) được giữ qua các ngày; giao diện 3.0 với thanh dưới nhiều tab; đồ họa PBR có HDRI, hậu kỳ và nhân vật chibi low-poly.
> Mọi con số trong tài liệu được **sinh trực tiếp từ dữ liệu game** (`js/core/data.js`: `TT.CONFIG`, `TT.ROLES`, `TT.FACTIONS`, `TT.UNITS`, `TT.ITEMS`, `TT.CORES`…) bằng `node tools/gen-gdd.js`, nên khớp với game. Muốn chỉnh cân bằng: sửa `data.js`, rồi chạy lại công cụ.

---

## Mục lục

1. Tổng quan
2. Vòng lặp ván và ngày
3. Kinh tế: Vàng, lãi, Đời
4. Đạo quân: Tướng và Lính
5. Giai đoạn Chuẩn bị
6. Chiến trường, bản đồ, địa hình
7. Giao tranh tự động
8. Chỉ số và công thức
9. Binh chủng
10. Bốn tộc (44 quân)
11. Trang bị
12. Lõi
13. Chiến thuật, Hành quân, Lệnh Soái
14. Lịch 10 ngày, quái, sự kiện, thời tiết
15. Điểm và kết thúc ván
16. Bot và cân bằng
17. Kiến trúc kỹ thuật và đồng bộ mạng
18. Bảo vệ mã nguồn
19. Đồ họa và hoạt ảnh
20. Giao diện 3.0
21. Kiểm thử
22. Thay đổi so với bản 2.x và việc còn để ngỏ

---

## 1. Tổng quan

**Một câu:** mỗi người chỉ ra quyết định ở giai đoạn Chuẩn bị (mua tướng nào, thêm bao nhiêu lính, đặt ở đâu, đeo đồ gì, mua Lõi nào, lên Đời khi nào, cắm cờ ra sao); giao tranh hoàn toàn tự động. Ai tiêu Vàng và xếp quân khéo nhất qua 10 ngày sẽ thắng.

| Trụ cột | Ý nghĩa |
|---|---|
| **Một loại tiền** | Chỉ có **Vàng**: mua tướng, lính, trang bị, Lõi, EXP, đổi bảng Lõi. Ai cũng nhận cùng thu nhập cơ bản; giữ Vàng thì có lãi. |
| **Tướng dẫn quân** | Mỗi đạo quân có 1 tướng to khỏe, dùng kỹ năng, đeo đồ; lính cùng binh chủng đi và đánh theo tướng. |
| **Không mất gì** | Quân, trang bị, Lõi và Đời giữ nguyên qua các ngày; bán lại hoàn 100% giá mua. Thua chỉ mất điểm. |
| **Đọc được trận đấu** | Không sương mù; tooltip cho mọi thẻ, quân, địa hình, trang bị, Lõi. |
| **Xác định hoàn toàn** | Cùng đội hình + seed = cùng kết quả trên mọi máy (nền tảng của đồng bộ không trọng tài). |
| **Bốn tộc, bốn nhịp** | Rồng bền và mạnh nhưng tướng đắt; Nhân đông quân, giỏi dùng đồ; Tiên nhanh, né cao; Quỷ hút máu, mạnh lên theo số quân chết. |

Chế độ: **Đấu tay đôi** (bản đồ 40 × 60 ô), **3 người**, **4 người hỗn chiến**, **2 đấu 2** (bản đồ 68 × 68 ô); có Bot Dễ / Trung bình / Khó. Một ván khoảng 20–35 phút.

---

## 2. Vòng lặp ván và ngày

```
Ngày 1 → … → Ngày 10 → Tổng kết
mỗi ngày: [Chuẩn bị đồng thời] → [Khóa + mở đội hình] → [Giao tranh tự động] → [Kết quả 8 giây]
```

| Pha | Nội dung | Kết thúc khi |
|---|---|---|
| **Chuẩn bị** | Nhận Vàng (+ lãi) và EXP; mua tướng, lính, trang bị, Lõi; lên Đời; xếp đạo quân, chọn chiến thuật, cắm cờ. Quân các ngày trước đứng sẵn ở vị trí cũ. | Hết giờ (phòng chọn 30–180 giây; ngày 1 thêm 45 giây) hoặc mọi người bấm **Sẵn sàng** (bấm lại để sửa). |
| **Khóa / mở** | Mỗi máy gửi mã băm đội hình; khi đủ (hoặc hết giờ) ngày bị khóa; sau đó mỗi người mở gói đội hình thật. | Mọi gói đã mở hoặc quá thời gian chờ. |
| **Giao tranh** | Mọi quân xuất hiện cùng lúc và tự đánh. Xem ở tốc độ ×1 / ×2 / ×4 hoặc bỏ qua. Giao diện chuẩn bị trượt ra khỏi màn hình. | Còn một phe (đội) có quân sống. |
| **Kết quả** | Điểm hạng + điểm hạ gục, thống kê từng đạo quân. Quân chết **hồi sinh** cho ngày sau. | Tự động sau 8 giây. |

---

## 3. Kinh tế: Vàng, lãi, Đời

### 3.1 Vàng

- **Đơn vị tiền duy nhất.** Ai cũng nhận cùng một thu nhập cơ bản mỗi ngày, tăng dần; Vàng dư giữ sang ngày sau.
- Tổng thu nhập cơ bản 10 ngày: **174 Vàng** cho mọi người (chưa tính lãi và thưởng).

| Ngày | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Tổng |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Vàng cơ bản | 12 | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | **174** |

| Nguồn Vàng | Số lượng |
|---|---|
| Thu nhập cơ bản (ai cũng như nhau) | theo bảng trên; ngày 1 là vốn đầu 12 |
| Lãi (từ ngày 2) | mỗi 10 Vàng đang giữ đầu ngày → +1, tối đa +5 (Lõi Ngân Khố: tối đa +7) |
| Săn quái (ngày 3/6/9) | người hạ nhiều quái nhất: +3 / +4 / +6 Vàng |
| Sự kiện Vận May Binh Gia | +5 Vàng cho mọi người |
| Lõi kinh tế | Túi Vàng +1/ngày; Hiệp Ước Hoàng Kim +4 ngay và +1/ngày |
| Bán lại | tướng, lính, trang bị, Lõi: hoàn **100%** giá mua (Lõi trả Vàng tức thời thì trừ phần đã nhận) |

**Bảng giá:**

| Mục | Giá (Vàng) |
|---|---|
| EXP | 4 Vàng = 4 EXP |
| Trang bị Bậc I / II / III / IV | 3 / 5 / 7 / 10 |
| Lõi Đồng / Bạc / Vàng / Lăng Kính | 2 / 4 / 6 / 9 |
| Đổi bảng Lõi | 1 (mỗi ngày 1 lần miễn phí) |
| Tướng / lính | theo binh chủng và tộc (mục 9, 10) |

Giữ 50 Vàng trở lên ở đầu ngày là nhận lãi tối đa +5; đây là lựa chọn chính giữa "tiêu ngay cho mạnh" và "tích để lãi".

### 3.2 Đời (như cấp TFT)

- Mỗi ngày (từ ngày 2) tự nhận **2 EXP**; mua thêm **4 EXP với 4 Vàng** bằng nút **Đời**. Đủ EXP thì lên Đời ngay trong lúc chuẩn bị.
- **Đời không bao giờ mất**, giữ suốt ván.
- Lên Đời mở **binh chủng mới**, **trang bị bậc mới**, thêm **Sức chứa** (dân số tối đa), thêm **bước cờ** mỗi đạo quân, mở **Lệnh Soái** và tăng tỉ lệ Lõi bậc cao trên bảng.

| Đời | EXP lên Đời kế | Tổng EXP | Sức chứa (Nhân tộc +) | Bước cờ / đạo quân | Mở binh chủng | Trang bị | Lệnh Soái | Tỉ lệ Lõi Đồng/Bạc/Vàng/Lăng Kính |
|---|---|---|---|---|---|---|---|---|
| I · Huyện | 6 | 0 | 12 (+1) | 2 | Lính, Thuẫn binh, Cung thủ | Bậc I | Lệnh thứ 1 | 70/30/0/0 |
| II · Quận | 14 | 6 | 20 (+2) | 3 | Thuật sĩ, Kỵ binh, Chỉ Huy | Bậc II | — | 45/40/15/0 |
| III · Châu | 24 | 20 | 30 (+3) | 4 | Thích khách, Pháp sư, Công thành | Bậc III | Lệnh thứ 2 | 25/40/28/7 |
| IV · Thành | — | 44 | 42 (+4) | 5 | Tượng binh, Thần thú | Bậc IV | Lệnh thứ 3 | 15/33/37/15 |

**Nhịp lên Đời tham khảo** (tính từ dữ liệu):

| Cách chơi | Vàng cho EXP / ngày | Đời II | Đời III | Đời IV |
|---|---|---|---|---|
| Chỉ EXP miễn phí | 0 | ngày 4 | không đạt | không đạt |
| Mua 1 lần EXP mỗi ngày | 4 | ngày 2 | ngày 4 | ngày 8 |
| Mua 2 lần EXP mỗi ngày | 8 | ngày 1 | ngày 3 | ngày 5 |

---

## 4. Đạo quân: Tướng và Lính

- **Đạo quân = 1 Tướng + 0..n Lính cùng binh chủng.** Mua tướng để mở đạo quân mới ở một ô trong vùng xuất quân; lính chỉ mua được **vào một tướng đã có** (cùng binh chủng của tướng).
- **Tướng** là quân đầu tiên của đạo quân: chỉ số nhân thêm **Máu ×220%, ATK ×150%, DEF ×120%**, thân to ×120%, có áo choàng. **Chỉ tướng có MP và dùng kỹ năng**, và chỉ tướng **đeo trang bị** (tối đa 3 món).
- **Lính** không có MP, không dùng kỹ năng; đi theo tướng, giữ đúng vị trí tương đối so với tướng như lúc xếp đội hình. Lính đi xa tướng quá 5 ô mà không có địch gần thì quay về, quá 7 ô thì chạy nhanh để bắt kịp.
- **Tướng chết**: lính vẫn đánh tiếp theo chiến thuật của đạo quân, nhưng trang bị trên tướng mất tác dụng.
- **Thần thú** là tướng duy nhất (mỗi người 1), chiến đấu một mình, không có lính.
- Giới hạn duy nhất của số quân là **Sức chứa** (tổng dân số). Không giới hạn số lính mỗi đạo quân.
- Giá: mỗi binh chủng có giá tướng và giá lính riêng (mục 9); Rồng tộc trả thêm cho mỗi tướng (mục 10).

---

## 5. Giai đoạn Chuẩn bị

### 5.1 Thao tác (luật trong `prep.js`)

| Lệnh | Tác dụng |
|---|---|
| **Mua tướng** | Đặt tướng vào ô trống trong vùng xuất quân; cần đủ Đời, Sức chứa và Vàng. |
| **Mua lính** | Thêm 1, +5 hoặc tối đa lính vào tướng đang chọn (giới hạn bởi Vàng và Sức chứa). |
| **Bán lính** | Bán một số lính của đạo quân, hoàn 100% giá lính. |
| **Bán tướng** | Bán cả đạo quân: hoàn 100% giá tướng + lính + **mọi trang bị đang đeo**. |
| **Di chuyển** | Đổi ô xuất phát của cả đạo quân; thả lên đạo quân khác thì đổi chỗ. |
| **Chiến thuật** | Chọn tư thế của đạo quân (mục 13.1). |
| **Hành quân** | Cắm cờ chỉ đường (mục 13.2). |
| **Đeo / tháo đồ** | Từ tủ đồ lên tướng (tối đa 3 món) và ngược lại. |
| **Mua / bán trang bị** | Theo bậc đã mở; bán hoàn 100%. |
| **Mua / bán Lõi** | Mua từ bảng 5 Lõi; Lõi có hiệu lực ngay khi nằm trong tủ đồ; bán hoàn giá mua. |
| **Đổi bảng / khóa Lõi** | Đổi bảng 1 Vàng (1 lần miễn phí mỗi ngày); khóa tối đa 2 ô để giữ qua lần đổi. |
| **Mua EXP** | 4 Vàng = 4 EXP. |
| **Xếp tự động** | Cận chiến phía trước, tầm trung ở giữa, tầm xa phía sau, Kỵ binh và Thích khách ở hai cánh. |

- **Tủ đồ 9 ô** dùng chung cho trang bị chưa đeo và Lõi.
- **Mọi thứ được giữ qua các ngày**: đạo quân, vị trí, chiến thuật, cờ, trang bị, Lõi, Vàng dư, EXP và Đời. Không có gì bị đặt lại khi sang ngày mới.
- Có **Hoàn tác** trong pha chuẩn bị.

### 5.2 Gói đội hình và chống gian lận

Cuối pha chuẩn bị mỗi máy đóng **gói đội hình** gồm hai phần:

- **Nhật ký kinh tế**: các lệnh tiêu/nhận Vàng ngoài quân lính (mua EXP, mua/bán trang bị, mua/bán Lõi, đổi bảng, khóa ô).
- **Quân**: danh sách đạo quân `[id, binh chủng, số quân, x, y, chiến thuật, trang bị, cờ]`, tủ đồ, id kế tiếp.

Máy nhận áp gói lên trạng thái đầu ngày của người đó và kiểm tra: phát lại nhật ký kinh tế đúng luật; **ngân sách Vàng** (Vàng còn + giá trị quân cũ − giá trị quân mới không được âm); **tập trang bị** sở hữu sau phát lại phải khớp đúng từng món (đeo hay trong tủ); tủ đồ không quá 9 ô; binh chủng đã mở theo Đời; vùng xuất quân, không trùng ô; Sức chứa; tối đa 1 Thần thú; tối đa 3 trang bị mỗi tướng; cờ hợp lệ. Sai bất kỳ điều nào thì giữ đội hình cũ.

---

## 6. Chiến trường, bản đồ, địa hình

### 6.1 Kích thước

| Chế độ | Bản đồ | Vùng xuất quân mỗi người |
|---|---|---|
| Đấu tay đôi | 40 × 60 ô | 24 × 12 ô, hai đầu bản đồ |
| 3 / 4 người, 2 đấu 2 | 68 × 68 ô | 24 × 12 ô, ở 3–4 cạnh |

Bản đồ sinh theo seed, **đối xứng xoay** giữa các phe, có kiểm tra liên thông. Phòng có tùy chọn **Khóa bản đồ**.

### 6.2 Các bản đồ

| Bản đồ | Đặc điểm |
|---|---|
| **Bình Nguyên Giao Phong** | Gần như đồng bằng, vài rặng rừng, một đồi giữa bản đồ. Cân bằng, dễ làm quen. |
| **Thung Lũng Sông** | Sông cắt ngang, chỉ vài cây cầu. Hợp quân bay, Công thành và lối phòng thủ. |
| **Cao Nguyên Tháp** | Nhiều đồi cao và tháp canh. Hợp Cung thủ, Pháp sư. |
| **Rừng Sâu** | Rừng rậm, đường hẹp. Hợp Thích khách, Kỵ binh đánh úp. |
| **Đầm Hoang** | Đầm lầy trung tâm, đất khô quanh rìa. Quỷ tộc thích nơi này. |
| **Đường Cầu Thập Tự** | Vực đá chia bản đồ, nối bằng cầu; tháp canh ở giữa. Nhiều điểm nghẽn. |

### 6.3 Địa hình

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

Không có sương mù: cả chuẩn bị lẫn giao tranh đều thấy toàn bộ chiến trường.

---

## 7. Giao tranh tự động

- **100% tự động**, **20 tick/giây**, số nguyên, ngẫu nhiên có seed → mọi máy cho cùng kết quả (mã băm FNV-64).
- Quân tự tìm đường (flow-field Dijkstra theo chi phí địa hình), tự chọn mục tiêu; **tướng** dùng kỹ năng khi đầy MP; **Lệnh Soái** tự kích hoạt.
- **MP (chỉ tướng)**: mỗi đòn đánh +10, mỗi lần bị đánh +5 (nhân hệ số hồi MP của tộc, thiên phú, đồ, Lõi).
- **Giới hạn 5 phút**: sau 300 giây, **bão chiến trường** gây sát thương thật lên mọi quân, giây thứ k gây 1·2^(k−1), bỏ qua khiên. Khi bão bắt đầu, mọi cờ bị bỏ và lính thôi bám theo tướng.
- **Tháp canh**: một phe giữ 5 giây liên tục không có địch → toàn quân +8% ATK tới hết trận (địch chiếm lại thì mất).

| Nhóm | Hành vi |
|---|---|
| Cận chiến | Lao tới mục tiêu gần nhất, giữ vị trí đánh. |
| Tầm trung | Giữ khoảng cách theo tầm; Thuật sĩ hồi máu đồng minh yếu; Chỉ Huy tỏa hào quang. |
| Tầm xa | Đứng ngoài tầm cận chiến của địch, cần đường ngắm (vực đá chặn; Công thành bắn vòng). |
| Quân bay | Bỏ qua địa hình, đi xuyên vực. |

Thứ tự ưu tiên hành vi: khống chế → cờ Xanh → kỹ năng → cờ Đỏ / Vàng → chiến thuật → bám tướng → tự động.

**Xếp hạng trong ngày:** phe bị loại muộn hơn xếp cao hơn; bị loại cùng lúc thì so tổng máu ngay trước đó, rồi số hạ gục.

---

## 8. Chỉ số và công thức

- Chỉ số mỗi quân = khuôn binh chủng (mục 9) × hệ số tộc (mục 10.1) + Lõi + thiên phú + ngày/đêm + thời tiết + sự kiện; **tướng** nhân thêm hệ số tướng và nhận chỉ số trang bị; trang bị **Hào quang** áp cho cả đạo quân.
- **Sát thương vật lý** = ATK × hệ số × 100 / (100 + DEF). **Phép**: DEF tính một nửa. **Sát thương thật**: bỏ qua DEF.
- **Chí mạng** ×150% (tối đa 100% tỉ lệ), **né** tối đa 40%, giảm sát thương tối đa 70%, tốc đánh tối đa 300%.
- Hút máu, khiên, phản sát thương, xuyên giáp, choáng / làm chậm / đốt / giảm giáp là các khối hiệu ứng dùng chung cho kỹ năng, trang bị, Lõi.
- **Ngày/đêm**: ban ngày Rồng và Nhân +4% ATK, ban đêm Tiên và Quỷ +4% ATK (ngày chẵn là đêm).

---

## 9. Binh chủng (khuôn một quân, trước hệ số tộc và hệ số tướng)

MP chỉ áp dụng cho tướng. Giá tướng / giá lính là giá gốc (trước phụ phí tộc).

| Vai trò | Đời | Nhóm | Máu | ATK | DEF | Đòn/giây | Tầm | Tốc di | MP tướng (đầu) | Dân | Giá tướng | Giá lính | Loại |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Lính** | I | Cận chiến | 165 | 18 | 15 | 0.8 | 1 | 2 | 80 (20) | 1 | 3 | 1 | vật lý |
| **Thuẫn binh** | I | Cận chiến | 250 | 12 | 32 | 0.6 | 1 | 1.8 | 60 (30) | 1 | 3 | 1 | vật lý |
| **Cung thủ** | I | Tầm xa | 100 | 21 | 5 | 0.95 | 5 | 2 | 70 (20) | 1 | 3 | 1 | vật lý |
| **Thuật sĩ** | II | Tầm trung | 120 | 10 | 6 | 0.7 | 3.5 | 2 | 60 (20) | 2 | 5 | 2 | phép |
| **Kỵ binh** | II | Cận chiến | 185 | 24 | 12 | 0.9 | 1 | 3.5 | 70 (20) | 2 | 5 | 2 | vật lý |
| **Chỉ Huy** | II | Tầm trung | 170 | 13 | 16 | 0.7 | 2 | 2 | 60 (30) | 2 | 5 | 2 | vật lý |
| **Thích khách** | III | Cận chiến | 125 | 32 | 8 | 1.1 | 1 | 3 | 60 (30) | 2 | 6 | 2 | vật lý |
| **Pháp sư** | III | Tầm xa | 95 | 23 | 5 | 0.8 | 4 | 2 | 50 (0) | 2 | 6 | 2 | phép |
| **Công thành** (nổ lan) | III | Tầm xa | 150 | 46 | 10 | 0.4 | 7 | 1.5 | 90 (0) | 3 | 7 | 3 | vật lý |
| **Tượng binh** | IV | Cận chiến | 560 | 40 | 35 | 0.6 | 1.2 | 2.2 | 100 (50) | 5 | 9 | 4 | vật lý |
| **Thần thú** (duy nhất, không lính) | IV | Cận chiến | 1150 | 62 | 40 | 0.7 | 1.5 | 2.5 | 100 (50) | 8 | 14 | — | vật lý |

---

## 10. Bốn tộc

### 10.1 Hệ số tộc (% so với khuôn)

| Tộc | Máu | ATK | DEF | Tốc đánh | Tốc di | Hồi MP | Khác | Giá |
|---|---|---|---|---|---|---|---|---|
| Rồng tộc | 131 | 119 | 110 | 92 | 95 | 86 | — | tướng +1 Vàng |
| Nhân tộc | 99 | 99 | 100 | 100 | 100 | 100 | — | gốc |
| Tiên tộc | 84 | 102 | 90 | 106 | 115 | 115 | +6% né | gốc |
| Quỷ tộc | 99 | 104 | 100 | 102 | 100 | 100 | 8% hút máu | gốc |

### 10.2 Rồng tộc

*Tường cận chiến dày, đánh mạnh và bền; càng đánh lâu càng nguy hiểm.*

- **Nội tại — Long Huyết:** Mỗi 2% máu đã mất cộng 1% tốc đánh (tối đa +30%). Càng bị thương càng hung hãn.
- **Điểm yếu — Long Tham:** Mọi tướng Rồng đắt hơn 1 Vàng. Chậm và ít né: sợ bị thả diều và đốt máu.

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

**Quân** (chỉ số đã nhân hệ số tộc, chưa có trang bị/Lõi; tướng đã nhân hệ số tướng):

| Quân | Vai trò | Tướng Máu/ATK/DEF | Lính Máu/ATK/DEF | Giá tướng | Giá lính | Nội tại | Kỹ năng (chỉ tướng, đầy MP) |
|---|---|---|---|---|---|---|---|
| **Long Binh** | Lính | 475/31/19 | 216/21/16 | 4 | 1 | Chém lan: mỗi đòn trúng thêm tối đa 2 địch kề mục tiêu với 50% sát thương. | **Chém Vảy:** Chém hình quạt 2 ô trước mặt, 160% ATK. |
| **Thuẫn Giáp Vảy** | Thuẫn binh | 719/21/42 | 327/14/35 | 4 | 1 | Vảy cứng: đòn đầu tiên mỗi 5 giây chỉ nhận 60% sát thương. | **Gầm Khiêu Chiến:** Khiêu khích địch trong 3 ô 3 giây, bản thân +30% DEF 4 giây. |
| **Cung Xuyên Giáp** | Cung thủ | 288/36/6 | 131/24/5 | 4 | 1 | Tên xuyên: trúng thêm 1 địch phía sau mục tiêu với 50% sát thương. | **Mưa Tên Rồng:** Bắn 5 mũi vào các địch ít máu nhất trong tầm, mỗi mũi 90% ATK. |
| **Long Mạch Sư** | Thuật sĩ | 345/16/7 | 157/11/6 | 6 | 2 | Đòn đánh hồi máu đồng minh yếu nhất trong tầm (160% ATK) và cho họ +10% ATK 3 giây. | **Long Tuyền:** Hồi 18% máu tối đa cho 4 đồng minh yếu nhất trong 5 ô, họ được giảm 15% sát thương 3 giây. |
| **Long Kỵ** | Kỵ binh | 532/42/15 | 242/28/13 | 6 | 2 | Xung phong: chạy ít nhất 4 ô rồi đánh thì đòn đó +50% sát thương. | **Giày Xéo:** Lao xuyên qua mục tiêu, gây 140% ATK lên mọi địch trên đường và làm chậm 30% trong 2 giây. |
| **Chiến Hống Tướng** | Chỉ Huy | 488/22/20 | 222/15/17 | 6 | 2 | Hào quang 4 ô: đồng minh +10% ATK (hào quang cùng loại không cộng dồn). | **Hống Vương:** Đồng minh trong 4 ô +25% tốc đánh trong 5 giây. |
| **Long Trảo** | Thích khách | 358/57/9 | 163/38/8 | 7 | 2 | +25% sát thương lên quân tầm xa và tầm trung. | **Móc Trảo:** Nhảy tới quân tầm xa gần nhất, gây 220% ATK và giảm 25% DEF mục tiêu 4 giây. |
| **Long Tức Pháp Sư** | Pháp sư | 272/40/6 | 124/27/5 | 7 | 2 | Tầm đánh +1. | **Hơi Thở Rồng:** Phun lửa hình nón 5 ô, 170% ATK phép và đốt 3 giây. |
| **Pháo Phun Lửa** | Công thành | 431/81/13 | 196/54/11 | 8 | 3 | Đạn nổ lan 1 ô và gây đốt 3 giây. | **Đạn Lửa:** Nã một quả cầu lửa vùng 2 ô, 300% ATK. |
| **Long Tượng** | Tượng binh | 1612/70/45 | 733/47/38 | 10 | 4 | Miễn đẩy lùi. Khi có từ 3 địch kề thì +15% DEF. | **Dậm Chân:** Choáng địch trong 1.8 ô 1.2 giây, 120% ATK. |
| **Cự Long** | Thần thú | 3313/109/52 | — | 15 | — | Bay qua mọi địa hình. Dưới 50% máu hồi 2% máu mỗi giây. | **Long Hỏa Thiên Giáng:** Lửa trời vùng 3 ô quanh mục tiêu, 350% ATK và đốt 4 giây. |

### 10.3 Nhân tộc

*Đông quân, linh hoạt, mạnh dần nhờ trang bị và đội hình.*

- **Nội tại — Quân Đông · Khéo Đồ:** Sức chứa thêm +1/+2/+3/+4 theo Đời. Trang bị trên tướng mạnh hơn 15%. Mỗi trang bị trên tướng cho cả đội +2% ATK.
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

**Quân** (chỉ số đã nhân hệ số tộc, chưa có trang bị/Lõi; tướng đã nhân hệ số tướng):

| Quân | Vai trò | Tướng Máu/ATK/DEF | Lính Máu/ATK/DEF | Giá tướng | Giá lính | Nội tại | Kỹ năng (chỉ tướng, đầy MP) |
|---|---|---|---|---|---|---|---|
| **Vệ Binh** | Lính | 358/25/18 | 163/17/15 | 3 | 1 | Kỷ luật đội ngũ: +2 DEF cho mỗi Vệ Binh đứng trong 2 ô (tối đa +10). | **Phối Hợp:** Đâm 140% ATK và nhận khiên 10% máu tối đa 3 giây. |
| **Thuẫn Hộ Tống** | Thuẫn binh | 543/16/38 | 247/11/32 | 3 | 1 | Che chắn: quân tầm xa/tầm trung đứng trong 2 ô nhận ít hơn 15% sát thương. | **Tường Khiên:** Tạo khiên 20% máu tối đa cho 3 đồng minh gần nhất trong 4 giây. |
| **Nỏ Thủ** | Cung thủ | 217/30/6 | 99/20/5 | 3 | 1 | Nỏ nặng: bỏ qua 25% giáp mục tiêu. | **Tên Tẩm Dầu:** Bắn 160% ATK, mục tiêu nhận thêm 15% sát thương trong 4 giây. |
| **Mục Sư** | Thuật sĩ | 259/13/7 | 118/9/6 | 5 | 2 | Đòn đánh hồi máu đồng minh yếu nhất trong tầm (160% ATK) và gỡ 1 hiệu ứng xấu. | **Ánh Sáng Thánh:** Hồi 15% máu tối đa cho đồng minh trong 3 ô quanh người yếu nhất, họ +20% DEF 4 giây. |
| **Thương Kỵ** | Kỵ binh | 402/34/14 | 183/23/12 | 5 | 2 | Mũi thương: đòn đầu tiên lên mỗi mục tiêu mới +60% sát thương. | **Xung Kích:** Lao tới mục tiêu, 150% ATK và choáng 0.6 giây. |
| **Tướng Quân** | Chỉ Huy | 369/18/19 | 168/12/16 | 5 | 2 | Hào quang 4 ô: đồng minh +12% DEF và +5% tốc đánh. | **Hiệu Lệnh:** Đồng minh trong 5 ô +20% ATK và +20% DEF trong 5 giây. |
| **Sát Thủ Thuê** | Thích khách | 270/46/9 | 123/31/8 | 6 | 2 | Săn tướng: ưu tiên tướng mang trang bị, +30% sát thương lên họ. | **Hợp Đồng Máu:** Lướt ra sau tướng địch giá trị nhất, 260% ATK. |
| **Pháp Sư Hoàng Gia** | Pháp sư | 206/33/6 | 94/22/5 | 6 | 2 | Đòn đánh làm chậm 15% trong 1.5 giây. | **Băng Hỏa:** Nổ băng hỏa vùng 2.5 ô, 165% ATK phép và làm chậm 30% trong 2 giây. |
| **Nỏ Thần** | Công thành | 325/67/12 | 148/45/10 | 7 | 3 | Mũi nỏ lớn xuyên tối đa 3 mục tiêu trên đường bắn (mỗi mục tiêu sau giảm 25%). | **Tên Phá Thành:** Bắn một mũi xuyên thẳng 9 ô, 250% ATK lên mọi địch trúng. |
| **Voi Phá Trận** | Tượng binh | 1218/58/42 | 554/39/35 | 9 | 4 | 15% mỗi đòn đẩy lùi mục tiêu 1 ô. | **Phá Tuyến:** Húc hình quạt 3 ô, 130% ATK và đẩy lùi 2 ô. |
| **Kỳ Lân Vàng** | Thần thú | 2503/91/48 | — | 14 | — | Phước lành 5 ô: đồng minh hồi 1% máu tối đa mỗi giây. | **Phước Vàng:** Hồi 15% máu cho đồng minh trong 5 ô và +15% ATK 5 giây. |

### 10.4 Tiên tộc

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

**Quân** (chỉ số đã nhân hệ số tộc, chưa có trang bị/Lõi; tướng đã nhân hệ số tướng):

| Quân | Vai trò | Tướng Máu/ATK/DEF | Lính Máu/ATK/DEF | Giá tướng | Giá lính | Nội tại | Kỹ năng (chỉ tướng, đầy MP) |
|---|---|---|---|---|---|---|---|
| **Kiếm Phong** | Lính | 303/27/15 | 138/18/13 | 3 | 1 | 30% sau mỗi đòn lùi 1 ô (thả diều nhẹ). | **Nhát Gió:** Lướt xuyên qua mục tiêu, 150% ATK. |
| **Hộ Pháp** | Thuẫn binh | 462/18/33 | 210/12/28 | 3 | 1 | Kết giới 3 ô: đồng minh nhận ít hơn 15% sát thương tầm xa. | **Màn Sáng:** Khiên 25% máu tối đa cho 3 đồng minh yếu nhất trong 4 ô, 3 giây. |
| **Thiên Xạ** | Cung thủ | 184/31/4 | 84/21/4 | 3 | 1 | Tầm +1; 20% sau khi bắn lùi 1 ô. | **Phi Tiễn:** 3 mũi tên vào 3 địch khác nhau, mỗi mũi 85% ATK. |
| **Linh Nữ** | Thuật sĩ | 220/15/6 | 100/10/5 | 5 | 2 | Đòn đánh hồi máu đồng minh yếu nhất (140% ATK) rồi nảy sang người thứ hai 50%. | **Suối Linh:** Đồng minh trong 3 ô quanh bản thân hồi 4% máu tối đa mỗi giây trong 4 giây. |
| **Phi Mã** | Kỵ binh | 341/36/12 | 155/24/10 | 5 | 2 | Bay: bỏ qua địa hình và đi xuyên quân. | **Bão Vó:** 4 cú đá liên tiếp, mỗi cú 75% ATK vào địch ngẫu nhiên gần đó. |
| **Quân Sư** | Chỉ Huy | 312/19/16 | 142/13/14 | 5 | 2 | Hào quang 4 ô: quân tầm xa +1 tầm, mọi đồng minh +15% hồi MP. | **Thiên Mạc:** 4 đồng minh gần nhất miễn hoàn toàn 1 đòn đánh thường (trong 4 giây). |
| **Ảnh Bộ** | Thích khách | 231/48/8 | 105/32/7 | 6 | 2 | +15% né; vô hình đầu trận lâu hơn 1.5 giây. | **Ảnh Kiếm:** Biến mất, xuất hiện sau lưng mục tiêu gây 260% ATK, vô hình thêm 1.5 giây. |
| **Linh Quang** | Pháp sư | 173/34/4 | 79/23/4 | 6 | 2 | Đòn đánh nảy sang 1 địch gần đó với 50% sát thương. | **Mưa Sao:** 6 quả cầu sao rơi ngẫu nhiên quanh mục tiêu (3 ô), mỗi quả 75% ATK. |
| **Thạch Lôi Đài** | Công thành | 277/69/10 | 126/46/9 | 7 | 3 | Tầm +1; vừa di chuyển vừa bắn được. | **Sấm Truyền:** Sét 260% ATK, nảy tiếp 2 địch gần đó với 60%. |
| **Tượng Vân** | Tượng binh | 1034/60/37 | 470/40/31 | 9 | 4 | Đi xuyên quân; +10% né. | **Cuộn Mây:** Hất tung địch trong 2 ô (choáng 1 giây), 110% ATK. |
| **Phượng Hoàng** | Thần thú | 2125/94/43 | — | 14 | — | Bay. Chết lần đầu sẽ hồi sinh tại chỗ với 40% máu. | **Lửa Tái Sinh:** Vùng lửa 3 ô gây 300% ATK, đồng minh trong vùng hồi 20% máu. |

### 10.5 Quỷ tộc

*Đông quân rẻ, càng chết càng mạnh, hút máu để trụ.*

- **Nội tại — Hồn:** Mỗi quân chết trên chiến trường (ta hay địch) cho 1 Hồn (tối đa 25). Mỗi Hồn +1% ATK cho mọi quân Quỷ. Có hút máu 9%. Một số kỹ năng tiêu Hồn.
- **Điểm yếu — Huyết Nhục:** Không tự hồi máu; nhận hồi máu từ Thuật sĩ và trang bị chỉ còn 50%.

**Thiên phú** (chọn 1 ở phòng chờ):

| Thiên phú | Hiệu ứng |
|---|---|
| **Huyết Ẩm** | Hút máu thêm 6%. |
| **Hồn Chủ** | Mỗi Hồn +1.5% ATK (thay vì 1%). |
| **Bất Diệt** | Tướng mỗi đội hồi sinh 1 lần với 30% máu. |

**Lệnh Soái** (tự động):

| Lệnh | Mở ở | Hiệu ứng |
|---|---|---|
| **Lời Nguyền** | Đời I | Khi giao chiến lần đầu: địch trong 4 ô quanh đội ta đang đánh −20% tốc đánh 5 giây. |
| **Huyết Tế** | Đời III | Khi có từ 5 Hồn: hiến tế quân ta yếu máu nhất, nổ 3 ô gây 30% máu tối đa của nó + 40 sát thương, +2 Hồn. |
| **Triệu Hồn Đại Trận** | Đời IV | Khi có từ 6 Hồn: tiêu 6 Hồn triệu 4 Tiểu Quỷ (60% chỉ số) cạnh đội đông nhất. |

**Quân** (chỉ số đã nhân hệ số tộc, chưa có trang bị/Lõi; tướng đã nhân hệ số tướng):

| Quân | Vai trò | Tướng Máu/ATK/DEF | Lính Máu/ATK/DEF | Giá tướng | Giá lính | Nội tại | Kỹ năng (chỉ tướng, đầy MP) |
|---|---|---|---|---|---|---|---|
| **Tiểu Quỷ** | Lính | 358/27/18 | 163/18/15 | 3 | 1 | Chết cho thêm 1 Hồn. | **Vồ Hồn:** Vồ 140% ATK, hồi máu bằng 30% sát thương gây ra. |
| **Thuẫn Phản Oán** | Thuẫn binh | 543/18/38 | 247/12/32 | 3 | 1 | Khi chết, kẻ kết liễu nhận sát thương bằng 10% máu tối đa của thuẫn. | **Oán Giáp:** Khiên 15% máu tối đa và phản 30% sát thương nhận trong 3 giây. |
| **Ma Tiễn** | Cung thủ | 217/31/6 | 99/21/5 | 3 | 1 | 25% sau khi bắn lùi 1 ô. | **Tên Nguyền:** Bắn 130% ATK, mục tiêu −20% ATK trong 4 giây. |
| **Tế Sư Máu** | Thuật sĩ | 259/15/7 | 118/10/6 | 5 | 2 | Đòn đánh rút máu kẻ địch (120% ATK phép) và hồi đúng lượng đó cho đồng minh yếu nhất. | **Huyết Khế:** Đồng minh trong 4 ô +20% hút máu và hồi 10% máu tối đa, 5 giây. |
| **Dạ Kỵ** | Kỵ binh | 402/36/14 | 183/24/12 | 5 | 2 | Mỗi lần hạ gục +1 Hồn. | **Truy Dạ:** Lao tới địch ít máu nhất trong 8 ô, 180% ATK. |
| **Hồn Soái** | Chỉ Huy | 369/19/19 | 168/13/16 | 5 | 2 | Hào quang 4 ô: đồng minh +8% hút máu. | **Triệu Hồn:** Tiêu 3 Hồn triệu 2 Tiểu Quỷ tạm thời (40% chỉ số); thiếu Hồn thì triệu 1. |
| **Bóng Ma** | Thích khách | 270/49/9 | 123/33/8 | 6 | 2 | Hạ gục: hồi 20% máu và vô hình 1 giây. | **Ám Sát:** Lướt ra sau mục tiêu 250% ATK; nếu hạ gục thì nhận khiên 15% máu. |
| **Hắc Pháp Sư** | Pháp sư | 206/34/6 | 94/23/5 | 6 | 2 | Đòn đánh giảm 8% ATK mục tiêu 3 giây (cộng dồn 2 lần). | **Tử Vong Nguyền:** Vùng 3 ô: 150% ATK phép và giảm 50% hồi máu nhận trong 5 giây. |
| **Hồn Pháo** | Công thành | 325/70/12 | 148/47/10 | 7 | 3 | Mỗi 5 giây tiêu 1 Hồn (nếu có) để phát bắn kế +100% sát thương. | **Pháo Oán:** Vùng 2 ô, 320% ATK. |
| **Tượng Xương** | Tượng binh | 1218/61/42 | 554/41/35 | 9 | 4 | Khi chết vỡ ra 3 Tiểu Quỷ tạm (25% chỉ số). | **Đại Cốt:** Choáng địch trong 2 ô 1 giây, bản thân nhận khiên 25% máu. |
| **Ma Vương** | Thần thú | 2503/96/48 | — | 14 | — | Khi chết để lại 2 Tiểu Quỷ (50% chỉ số). | **Hấp Hồn:** Tiêu toàn bộ Hồn: gây 100% ATK + 25% ATK mỗi Hồn lên địch trong 3 ô. |

---

## 11. Trang bị

- Mua bằng **Vàng**, giá theo bậc; **bán hoàn 100%**. Bậc I–IV mở theo Đời I–IV.
- **Chỉ tướng đeo**, tối đa 3 món; chỉ số và hiệu ứng áp cho tướng, riêng trang bị **Hào quang** áp cho cả đạo quân. Đang chọn tướng thì mua xong đeo ngay; không thì vào tủ đồ.
- Nhân tộc: trang bị mạnh hơn 15% (Rèn Khí 30%), mỗi món trên tướng cho cả đạo quân +2% ATK.
- Trang bị khởi đầu (chọn ở phòng chờ): Kiếm Sắt / Bùa Máu / Giáp Da.

**Bậc I** (mở ở Đời I, giá 3 Vàng)

| Trang bị | Hiệu ứng |
|---|---|
| **Kiếm Sắt** | +12 ATK. |
| **Giáp Da** | +12 DEF. |
| **Bùa Máu** | +120 máu. |
| **Cung Gió** | +12% tốc đánh. |
| **Ngọc Linh** | +20 MP khởi đầu, +15% hồi MP. |
| **Nhẫn Vận** | +8% chí mạng, +6% né. |

**Bậc II** (mở ở Đời II, giá 5 Vàng)

| Trang bị | Hiệu ứng |
|---|---|
| **Đại Đao** | +30 ATK; +10% sát thương lên địch có % máu thấp hơn mình. |
| **Thành Trì** | +35 DEF; đòn đầu mỗi 4 giây nhận ít hơn 25%. |
| **Cự Tâm** | +350 máu; hồi 1% máu tối đa mỗi giây. |
| **Huyết Kiếm** | +18 ATK, hút máu 12%. |
| **Cờ Hiệu** | Hào quang: cả đội +10% tốc đánh. |
| **Cung Linh** | +18% tốc đánh, +30 MP; mỗi đòn +3 MP. |

**Bậc III** (mở ở Đời III, giá 7 Vàng)

| Trang bị | Hiệu ứng |
|---|---|
| **Phong Tốc** | +30% tốc đánh; mỗi đòn thứ 4 đánh hai lần. |
| **Kiếm Dạ** | +20 ATK, +15% chí mạng, chí mạng +25% sát thương. |
| **Áo Giáp Lớn** | +20 DEF, +250 máu; phản 10% sát thương cận chiến. |
| **Bình Linh** | +250 máu, +30 MP; lần đầu dưới 40% máu hồi 25%. |
| **Quân Kỳ** | Hào quang: cả đội +10% DEF và +8% ATK. |
| **Trượng Linh** | +30 MP; kỹ năng +25% sát thương và hồi máu. |

**Bậc IV** (mở ở Đời IV, giá 10 Vàng)

| Trang bị | Hiệu ứng |
|---|---|
| **Thần Kiếm** | +45 ATK, +15% tốc đánh, bỏ qua 25% giáp. |
| **Ấn Bất Tử** | +300 máu; chết lần đầu hồi sinh với 40% máu. |
| **Long Lân Giáp** | +40 DEF, +400 máu, giảm 15% sát thương nhận. |
| **Thiên Tâm** | Hào quang: cả đội +15% ATK và +15% tốc đánh. |

---

## 12. Lõi

- Bảng 5 Lõi mỗi ngày, mua bằng Vàng; **Lõi nằm trong tủ đồ là có hiệu lực**, tự áp cho quân phù hợp, không cần chọn mục tiêu. Bán lại hoàn giá mua.
- Đổi bảng 1 Vàng (1 lần miễn phí mỗi ngày); khóa tối đa 2 ô. Lõi riêng tộc chỉ xuất hiện cho đúng tộc.
- Phạm vi: **toàn quân**, **kinh tế**, theo **nhóm tầm** (cận / trung / xa), theo **binh chủng**, theo **tộc**. Tỉ lệ bậc theo Đời xem bảng mục 3.2.

**Đồng** (2 Vàng)

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
| **Túi Vàng** | Kinh tế | Mỗi ngày +1 Vàng. |

**Bạc** (4 Vàng)

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
| **Ngân Khố** | Kinh tế | Lãi Vàng tối đa +2. |

**Vàng** (6 Vàng)

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
| **Thương Hội** | Nhân tộc | Mỗi trang bị tướng đang đeo: toàn quân +2% ATK và máu (tối đa +20%). |
| **Đúc Thần Khí** | Nhân tộc | Trang bị mạnh thêm 25%. |
| **Gió Thuận** | Tiên tộc | Quân Tiên +10% tốc di và tốc đánh. |
| **Mê Hồn Trận** | Tiên tộc | Pháp sư Tiên làm chậm 20% mục tiêu 2 giây. |
| **Hồn Chủ** | Quỷ tộc | Mỗi Hồn mạnh thêm 50% (1.5% ATK), tối đa thêm 10 Hồn. |
| **Vực Thẳm Hút** | Quỷ tộc | Quân Quỷ hút máu thêm 10%. |

**Lăng Kính** (9 Vàng)

| Lõi | Phạm vi | Hiệu ứng |
|---|---|---|
| **Cuồng Chiến** | Cận chiến | Quân cận chiến mỗi lần hạ gục +8% tốc đánh (tối đa 5 lần) và hồi 10% máu. |
| **Pháo Đài** | Tầm xa | Quân tầm xa đứng yên quá 2 giây +30% tốc đánh. |
| **Thần Uy** | Thần thú | Thần thú +30% máu và ATK. |
| **Tâm Kiếm Hợp Nhất** | Toàn quân | Toàn quân vào trận với 50% MP. |
| **Lá Cờ Chiến Thắng** | Toàn quân | Chiếm tháp canh nhanh gấp đôi, mỗi tháp +5% ATK thêm. |
| **Hiệp Ước Hoàng Kim** | Kinh tế | Nhận ngay 4 Vàng và +1 Vàng mỗi ngày. |
| **Long Uy Tuyệt Đối** | Rồng tộc | Đầu giao tranh, địch trong 4 ô quanh quân Rồng bị choáng sợ 1.5 giây. |
| **Đoàn Kết** | Nhân tộc | Đội từ 8 quân trở lên +15% ATK, DEF và máu. |
| **Thiên Giới Giáng** | Tiên tộc | Tướng Tiên chết lần đầu hồi sinh với 30% máu. |
| **Quân Đoàn Vong Linh** | Quỷ tộc | Cứ 4 quân ta chết thì 1 Tiểu Quỷ (50%) trỗi dậy tại chỗ. |

---

## 13. Chiến thuật, Hành quân, Lệnh Soái

### 13.1 Chiến thuật (tư thế của đạo quân)

| Chiến thuật | Hành vi |
|---|---|
| **Tấn công** | Tiến về phía địch gần nhất và đánh. |
| **Giữ vị trí** | Chỉ đánh địch tới gần; không rời điểm đứng quá 4 ô. |
| **Săn hậu tuyến** | Ưu tiên quân tầm xa, Thuật sĩ, Chỉ Huy của địch. |
| **Rút khi yếu** | Như Tấn công, nhưng còn dưới 30% máu thì lùi về điểm xuất phát. |

### 13.2 Hành quân (Cờ Lệnh)

Chọn tướng → **Hành quân** → cắm tối đa 2 / 3 / 4 / 5 bước cờ mỗi đạo quân (theo Đời I–IV; Lõi Quân Lệnh Mở Rộng +1), tổng tối đa 20 cờ mỗi người. Cờ chỉ đường cho tướng, lính đi theo tướng. Cờ được giữ sang ngày sau.

| Cờ | Hành vi |
|---|---|
| **Cờ Xanh · Hành Quân** | Đi thẳng tới cờ, không dừng lại đánh (trừ khi bị chặn kín quá 3 giây). |
| **Cờ Đỏ · Tiến Công** | Đi về phía cờ, gặp địch thì đánh, đánh xong đi tiếp. |
| **Cờ Vàng · Hộ Tống** | Đi sát cánh một đội khác của bạn và cùng đánh mục tiêu của đội đó. |

Cờ Vàng có ba kiểu: **Sát cánh** (đi cạnh và cùng đánh), **Bảo vệ** (giữ sát hơn đạo quân được hộ tống), **Theo sau** (đi phía sau, chỉ đánh khi địch tới gần). Không hộ tống chính mình, không vòng tròn, chuỗi hộ tống tối đa 3 đạo quân.

### 13.3 Lệnh Soái

Tự động, mỗi lệnh dùng tối đa một lần mỗi giao tranh, mở ở Đời I / III / IV (danh sách ở mục 10).

---

## 14. Lịch 10 ngày, quái, sự kiện, thời tiết

| Ngày | Tên | Loại | Bản đồ | Trời |
|---|---|---|---|---|
| Ngày 1 | Ngày 1 | Giao tranh thường | Bình Nguyên Giao Phong | ngày |
| Ngày 2 | Ngày 2 | Giao tranh thường | ngẫu nhiên theo seed | đêm |
| Ngày 3 | Săn Quái | Săn quái | ngẫu nhiên theo seed | ngày |
| Ngày 4 | Ngày 4 | Giao tranh thường | ngẫu nhiên theo seed | đêm |
| Ngày 5 | Sự kiện | Sự kiện ngẫu nhiên | ngẫu nhiên theo seed | ngày |
| Ngày 6 | Săn Quái II | Săn quái | ngẫu nhiên theo seed | đêm |
| Ngày 7 | Ngày 7 | Giao tranh thường | ngẫu nhiên theo seed | ngày |
| Ngày 8 | Sự kiện | Sự kiện ngẫu nhiên | ngẫu nhiên theo seed | đêm |
| Ngày 9 | Săn Boss | Săn quái | ngẫu nhiên theo seed | ngày |
| Ngày 10 | Chung Kết | Chung kết (điểm hạng ×1.5) | Đường Cầu Thập Tự | đêm |

**Quái trung lập** (ngày săn quái; người hạ nhiều quái nhất nhận Vàng):

| Cấp | Quái | Số lượng | Máu | ATK | DEF | Thưởng |
|---|---|---|---|---|---|---|
| 1 | Bầy Sói Rừng | 8 | 260 | 22 | 12 | +3 Vàng |
| 2 | Ngưu Ma | 3 | 1100 | 50 | 30 | +4 Vàng |
| 3 | Cổ Thụ Yêu Vương | 1 | 6000 | 90 | 45 | +6 Vàng |

**Sự kiện** (chọn ngẫu nhiên theo seed):

| Sự kiện | Hiệu ứng |
|---|---|
| **Cuồng Phong Chiến Tranh** | Hôm nay mọi quân +15% tốc đánh nhưng −10% máu. |
| **Vận May Binh Gia** | Mọi người nhận ngay 5 Vàng. |
| **Chiến Địa Hoang** | Bản đồ hôm nay có thêm 2 tháp canh. |

**Thời tiết** (ngẫu nhiên theo seed, Trời quang hay gặp nhất):

| Thời tiết | Hiệu ứng |
|---|---|
| **Trời quang** | Không có hiệu ứng. |
| **Mưa** | Quân tầm xa −10% tốc đánh; hiệu ứng đốt yếu đi một nửa. |
| **Nắng gắt** | Hồi máu mọi nguồn −20%. |
| **Gió lớn** | Mọi quân +4% né. |

---

## 15. Điểm và kết thúc ván

| Số phe | Hạng 1 | Hạng 2 | Hạng 3 | Hạng 4 |
|---|---|---|---|---|
| 2 | 15 | 4 | — | — |
| 3 | 18 | 9 | 3 | — |
| 4 | 20 | 12 | 6 | 2 |

2 đấu 2: đội thắng 15, đội thua 4 điểm hạng mỗi người.

- **Điểm hạ gục**: mỗi 4 dân số quân địch bị hạ = 1 điểm (cộng dồn qua các ngày, không mất phần lẻ).
- **Ngày 10 (Chung Kết)**: điểm hạng ×1.5.
- **Thắng ván**: tổng điểm cao nhất; hòa thì so điểm hạng, rồi điểm hạ gục, rồi hạng ngày cuối. 2 đấu 2: cộng điểm hai đồng đội.
- **Đầu hàng / thoát**: bị loại khỏi các ngày sau; còn một phe thì kết thúc ngay. Người không gửi kịp đội hình giữ đội hình hôm trước.

---

## 16. Bot và cân bằng

### 16.1 Ba mức Bot (`js/core/bot.js`, xác định theo seed)

| Mức | Lên Đời II/III/IV (ngày) | Hệ số mua trang bị | Số Lõi tối đa | Bậc Lõi cao nhất | Cắm cờ | Mô phỏng thử đội hình |
|---|---|---|---|---|---|---|
| **Dễ** | 4 / 8 / — | 30% | 2 | Bạc | không | không |
| **Trung bình** | 4 / 6 / 9 | 70% | 3 | Vàng | có | không |
| **Khó** | 4 / 6 / 9 | 75% | 3 | Lăng Kính | có | 5 biến thể |

- **Dễ**: chọn quân nhiễu nhiều, tiêu khoảng 80% Vàng, ít đồ, không cắm cờ.
- **Trung bình**: mua theo công thức binh chủng của tộc, tích Vàng giữa ván để ăn lãi, đeo đồ, cắm cờ.
- **Khó**: như Trung bình, ưu tiên đồ Hào quang và Lõi bậc cao, và **mô phỏng thử nhiều biến thể đội hình bằng chính `battle.js`** để chọn phương án tốt nhất.

### 16.2 Kết quả đo

Bộ mô phỏng (`tests/balance.js`, `tests/duel.js`, `tests/sim.js`) cho Bot chơi nhiều ván với seed khác nhau:

| Hạng mục | Kết quả |
|---|---|
| Tỉ lệ thắng ngày theo tộc (N = 8 ván mỗi cặp) | Rồng 53% · Nhân 52% · Tiên 49% · Quỷ 46% |
| Đối xứng chỗ ngồi (ghế 1) | 51% |
| Bot Khó thắng Bot Dễ | 81% |
| Bot Trung bình thắng Bot Dễ | 83% |
| Bot Khó thắng Bot Trung bình | 53% |

---

## 17. Kiến trúc kỹ thuật và đồng bộ mạng

```
js/core/data.js     Dữ liệu + TT.CONFIG (mọi số cân bằng)
js/core/maps.js     Sinh bản đồ đối xứng theo seed
js/core/prep.js     Luật chuẩn bị thuần: tướng/lính, bán, trang bị, Lõi, EXP, cờ; tạo và kiểm tra gói đội hình
js/core/battle.js   Mô phỏng giao tranh xác định (20 tick/giây, số nguyên)
js/core/match.js    Quản lý ván: ngày, thu nhập, bản đồ, điểm, thưởng săn quái
js/core/bot.js      Bot 3 mức
js/net/             service.js (Firebase / chế độ cục bộ ?local=1), db.js, firebase-config.js
js/ui/              app.js (sảnh, phòng), game.js (trận), field3d.js + models.js (3D), icons.js, content.js, sound.js
tools/              build.js (bản phát hành), gen-gdd.js + gdd-template.md (tài liệu này)
tests/              run-tests.js, fuzz.js, balance.js, duel.js, sim.js, gallery.html, battle.html
```

**Xác định:** số nguyên mili-ô, mulberry32 gieo từ hash(seed, ngày), duyệt theo id, căn bậc hai số nguyên, mã băm FNV-64 kết quả.

**Đồng bộ (commit–reveal, không trọng tài):**

```
rooms/{mã}/days/0/fin            = {at}               mốc bắt đầu ván
rooms/{mã}/days/{n}/c/{ghế}      = hash(gói|nonce)    ghi khi chưa khóa (sửa/xóa được tới lúc khóa)
rooms/{mã}/days/{n}/lock         = {at, seats}        ghi một lần
rooms/{mã}/days/{n}/r/{ghế}      = {p: gói, n: nonce} ghi một lần sau khi khóa, gói ≤ 12.000 ký tự
rooms/{mã}/days/{n}/fin          = {at, seats}        ghi một lần, chốt các gói được dùng
rooms/{mã}/quit/{ghế}            = ngày đầu hàng
```

Máy nhận kiểm tra mã băm và gói (mục 5.2); chủ phòng tính và gửi gói của Bot. Mốc thời gian dùng đồng hồ máy chủ Firebase; lịch ngày tính từ `fin.at`. Luật ghi nằm trong `database.rules.json` (chỉ ghi đúng ghế của mình, ghi một lần đúng thời điểm).

---

## 18. Bảo vệ mã nguồn

Mã chạy trên trình duyệt không thể giấu tuyệt đối; bản phát hành làm việc sao chép, đọc hiểu và dựng lại tốn công hơn nhiều.

```bash
npm i                                                   # một lần: esbuild + javascript-obfuscator
node tools/build.js --domain=tenban.github.io,tenban.web.app
# đăng thư mục dist/ (không đăng thư mục gốc chứa mã nguồn)
```

- Gộp toàn bộ mã game thành **một file** tên theo mã băm, thu gọn bằng **esbuild**, làm rối bằng **javascript-obfuscator** (đổi tên biến, mã hóa chuỗi, làm phẳng luồng điều khiển nhẹ, tự vệ khi bị định dạng lại hoặc sửa).
- **Khóa tên miền**: chạy trên miền khác hoặc mở bằng `file:///` sẽ ra trang trắng; `--nolocal` cấm cả localhost; `--light` làm rối nhẹ hơn cho máy yếu.
- **Chặn nhúng iframe** từ web lạ; bỏ chú thích HTML, thu gọn CSS.
- Khuyến nghị ở Firebase: giới hạn **Authorized domains**; bật **App Check** (reCAPTCHA) và **Enforce** cho Realtime Database; giới hạn API key theo HTTP referrer; publish `database.rules.json`; chỉ đăng `dist/`.
- Chống gian lận thật sự nằm ở tầng luật chơi: mọi máy tự kiểm tra lại gói đội hình của đối thủ.

---

## 19. Đồ họa và hoạt ảnh

**Kết xuất (`js/ui/field3d.js`):**

- **Three.js r158** (gói sẵn trong `js/vendor/three-bundle.min.js`).
- **Ánh sáng môi trường HDRI** (Poly Haven, CC0) làm IBL + nắng chính đổ **bóng mềm PCF** với camera bóng được ôm vừa khung nhìn; vật liệu **MeshStandard PBR** với độ kim loại / độ nhám **theo từng đỉnh**.
- **ACES tone mapping**, không gian màu **sRGB**; sương mù và bầu trời chuyển màu.
- Hậu kỳ **pmndrs postprocessing**: **Bloom**, **N8AO** (SSAO), **Vignette**, **SMAA**. Có chế độ nhẹ cho máy yếu / điện thoại (tắt hậu kỳ).
- **Địa hình heightmap liền mạch** kiểu Dota 2: đồi nổi, sông có mặt nước chuyển động và bờ cát, đầm lầy trũng có lau sậy, rừng cây, vực đá, cầu, tháp canh.

**Nhân vật (`js/ui/models.js`):**

- **Chibi low-poly** theo bảng màu kiểu **Ragnarok Online 3**: tay chân dạng capsule mập, bàn tay và bàn chân to khoảng 1,3 lần.
- **Smooth shading** cho da, tóc, vải; **flat shading** cho giáp, mũ, vũ khí.
- **Viền inverted hull** dùng pháp tuyến mượt (không vỡ viền ở cạnh sắc).
- **Bóng dáng theo lớp**: pháp sư đội mũ cao, quân chống chịu có giáp vai lớn, thuật sĩ đội mũ rộng vành và áo choàng dài, thích khách nhỏ gọn.
- **Màu tộc** phủ trên các mảng lớn (áo, giáp, áo choàng); **tướng to hơn và có áo choàng**.
- Vẽ instanced: mọi quân cùng loại chỉ tốn vài lệnh vẽ mà vẫn có hoạt ảnh (tay, chân, cánh, áo choàng, chân thú cưỡi), chuyển động nội suy theo khung hình.

---

## 20. Giao diện 3.0

- **Thanh dưới** có các tab **Tướng · Lõi · Trang bị**, cuộn ngang. **Chọn một tướng** trên sân thì thanh chuyển sang tab **Lính** của tướng đó: chạm icon lính để mua 1, nút **+5**, **Tối đa**, **Bán lính**.
- Thẻ **chỉ có icon**, giá hiển thị trong **chip tròn ở góc trên trái**; thông tin chi tiết ở **tooltip** khi rê chuột hoặc chạm.
- **Tủ đồ 9 ô** cho trang bị chưa đeo và Lõi.
- **Menu hành động nằm ngang** phía trên tướng đang chọn: **Di chuyển**, **Chiến thuật**, **Hành quân**, **+ Lính**.
- **Bảng thông tin tướng** tự đặt bên trái hoặc phải để không che tướng; trên điện thoại là **bảng trượt từ dưới** với nút **Chi tiết**.
- **Popup bán lính**: thanh trượt hoặc ô nhập số, nút **Bán hết**. **Popup bán tướng**: hiển thị chi tiết số Vàng hoàn lại (tướng, lính, trang bị).
- Trên sân chỉ **tướng** hiện thanh máu, thanh MP và icon trang bị.
- Trong giao tranh, giao diện chuẩn bị **trượt ra ngoài** để nhường chỗ cho trận đấu.
- Điều khiển chỉ bằng **chuột trái hoặc chạm** (kéo thả hoặc chạm thẻ rồi chạm ô). Phím tắt bổ trợ: Ctrl+Z hoàn tác, Space sẵn sàng, Q đổi tab, F mua EXP, Delete bán, 1/2/4 tốc độ, H về góc nhìn, Esc bỏ chọn.
- Toàn bộ chữ tiếng Việt, biểu tượng vẽ bằng SVG, không dùng emoji.

---

## 21. Kiểm thử

- `node tests/run-tests.js` — **63 kiểm tra đạt**: dữ liệu đủ 44 quân / 22 trang bị / 55 Lõi, kinh tế (thu nhập bằng nhau, lãi, EXP, hoàn 100%), tướng/lính, Sức chứa, tủ đồ, gói đội hình và kiểm tra gian lận, xác định (cùng seed cùng mã băm), bão kết thúc trận, tháp canh, cờ, hộ tống, ván đầy đủ với Bot 2/3/4 người ở 3 mức.
- `node tests/fuzz.js` — lệnh ngẫu nhiên và gói đội hình ngẫu nhiên: **0 lỗi**.
- Trình duyệt: `tests/gallery.html` (xem mẫu 3D), `tests/battle.html` (xem giao tranh), `index.html?local=1` (chơi không cần Firebase).

---

## 22. Thay đổi so với bản 2.x và việc còn để ngỏ

| Mục | Bản 2.x | Bản 3.0 |
|---|---|---|
| Tiền tệ | Nhiều loại tiền: một nhóm để mua quân và đồ, một loại riêng cho EXP/Lõi | **Chỉ Vàng**, có lãi (mỗi 10 → +1, tối đa +5) |
| Mua quân | Mua từng đội quân cùng loại | **Tướng** mở đạo quân, **lính** nhập vào tướng |
| Kỹ năng, trang bị | Mọi quân có năng lượng; quân đầu đội đeo đồ | **Chỉ tướng** có MP, dùng kỹ năng, đeo 3 món |
| Lõi | Ô Lõi riêng theo Đời, giá riêng | Nằm trong **tủ đồ 9 ô** chung với trang bị, mua bằng Vàng, bán hoàn giá |
| Bán lại | Lõi hoàn một phần | **Mọi thứ hoàn 100%**, bán tướng hoàn cả đồ đang đeo |
| Kiểm tra gói | Ngân sách nhiều loại tiền | Ngân sách Vàng + đúng tập trang bị + tủ đồ 9 ô |
| Giao diện | Khu mua quân riêng + cửa hàng bên phải | **Thanh dưới nhiều tab**, tab Lính theo tướng, menu ngang trên tướng, bảng thông tin tự đặt |
| Đồ họa | Khối bo góc, viền đậm | **PBR + HDRI + hậu kỳ**, địa hình heightmap, chibi low-poly kiểu Ragnarok Online 3 |
| Phát hành | Đăng mã nguồn | **Bản dựng làm rối + khóa tên miền** |

**Còn để ngỏ (đề xuất):** phát lại trận và phân tích "vì sao thua"; chế độ Thử nghiệm (sandbox); thành tựu; xếp hạng mùa cần Cloud Functions kiểm kết quả (vì không có trọng tài); mẫu đội hình lưu sẵn; cân lại Quỷ tộc (đang thấp nhất, 46%).

*Hết tài liệu.*
