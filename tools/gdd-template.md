# TỨ TỘC KỲ CHIẾN 3.0 — Tài liệu thiết kế (Auto-Battler chiến trường)

> **Bản 3.0 — bản đã triển khai.** Luật chơi (mã luật `{{RULEVER}}`): một loại tiền duy nhất là **Vàng**; mỗi đạo quân gồm **1 Tướng + lính cùng binh chủng**; chỉ tướng dùng kỹ năng, có MP và đeo trang bị; mọi thứ (quân, đồ, Lõi, Đời) được giữ qua các ngày; giao diện 3.0 với thanh dưới nhiều tab; đồ họa PBR có HDRI, hậu kỳ và nhân vật chibi low-poly.
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
10. Bốn tộc ({{NUNITS}} quân)
11. Trang bị
12. Lõi
13. Chiến thuật, Hành quân, Lệnh Soái
14. Lịch {{DAYS_N}} ngày, quái, sự kiện, thời tiết
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

**Một câu:** mỗi người chỉ ra quyết định ở giai đoạn Chuẩn bị (mua tướng nào, thêm bao nhiêu lính, đặt ở đâu, đeo đồ gì, mua Lõi nào, lên Đời khi nào, cắm cờ ra sao); giao tranh hoàn toàn tự động. Ai tiêu Vàng và xếp quân khéo nhất qua {{DAYS_N}} ngày sẽ thắng.

| Trụ cột | Ý nghĩa |
|---|---|
| **Một loại tiền** | Chỉ có **Vàng**: mua tướng, lính, trang bị, Lõi, EXP, đổi bảng Lõi. Ai cũng nhận cùng thu nhập cơ bản; giữ Vàng thì có lãi. |
| **Tướng dẫn quân** | Mỗi đạo quân có 1 tướng to khỏe, dùng kỹ năng, đeo đồ; lính cùng binh chủng đi và đánh theo tướng. |
| **Không mất gì** | Quân, trang bị, Lõi và Đời giữ nguyên qua các ngày; bán lại hoàn 100% giá mua. Thua chỉ mất điểm. |
| **Đọc được trận đấu** | Không sương mù; tooltip cho mọi thẻ, quân, địa hình, trang bị, Lõi. |
| **Xác định hoàn toàn** | Cùng đội hình + seed = cùng kết quả trên mọi máy (nền tảng của đồng bộ không trọng tài). |
| **Bốn tộc, bốn nhịp** | Rồng bền và mạnh nhưng tướng đắt; Nhân đông quân, giỏi dùng đồ; Tiên nhanh, né cao; Quỷ hút máu, mạnh lên theo số quân chết. |

Chế độ: **Đấu tay đôi** (bản đồ {{DIM2}} ô), **3 người**, **4 người hỗn chiến**, **2 đấu 2** (bản đồ {{DIM4}} ô); có Bot Dễ / Trung bình / Khó. Một ván khoảng 20–35 phút.

---

## 2. Vòng lặp ván và ngày

```
Ngày 1 → … → Ngày {{DAYS_N}} → Tổng kết
mỗi ngày: [Chuẩn bị đồng thời] → [Khóa + mở đội hình] → [Giao tranh tự động] → [Kết quả {{RESSEC}} giây]
```

| Pha | Nội dung | Kết thúc khi |
|---|---|---|
| **Chuẩn bị** | Nhận Vàng (+ lãi) và EXP; mua tướng, lính, trang bị, Lõi; lên Đời; xếp đạo quân, chọn chiến thuật, cắm cờ. Quân các ngày trước đứng sẵn ở vị trí cũ. | Hết giờ (phòng chọn 30–180 giây; ngày 1 thêm {{DAY1}} giây) hoặc mọi người bấm **Sẵn sàng** (bấm lại để sửa). |
| **Khóa / mở** | Mỗi máy gửi mã băm đội hình; khi đủ (hoặc hết giờ) ngày bị khóa; sau đó mỗi người mở gói đội hình thật. | Mọi gói đã mở hoặc quá thời gian chờ. |
| **Giao tranh** | Mọi quân xuất hiện cùng lúc và tự đánh. Xem ở tốc độ ×1 / ×2 / ×4 hoặc bỏ qua. Giao diện chuẩn bị trượt ra khỏi màn hình. | Còn một phe (đội) có quân sống. |
| **Kết quả** | Điểm hạng + điểm hạ gục, thống kê từng đạo quân. Quân chết **hồi sinh** cho ngày sau. | Tự động sau {{RESSEC}} giây. |

---

## 3. Kinh tế: Vàng, lãi, Đời

### 3.1 Vàng

- **Đơn vị tiền duy nhất.** Ai cũng nhận cùng một thu nhập cơ bản mỗi ngày, tăng dần; Vàng dư giữ sang ngày sau.
- Tổng thu nhập cơ bản {{DAYS_N}} ngày: **{{GOLDTOTAL}} Vàng** cho mọi người (chưa tính lãi và thưởng).

{{INCOME}}

{{ECONSRC}}

**Bảng giá:**

{{PRICELIST}}

Giữ {{INTFULL}} Vàng trở lên ở đầu ngày là nhận lãi tối đa +{{INTMAX}}; đây là lựa chọn chính giữa "tiêu ngay cho mạnh" và "tích để lãi".

### 3.2 Đời (như cấp TFT)

- Mỗi ngày (từ ngày 2) tự nhận **{{XPDAILY}} EXP**; mua thêm **{{XPAMT}} EXP với {{XPCOST}} Vàng** bằng nút **Đời**. Đủ EXP thì lên Đời ngay trong lúc chuẩn bị.
- **Đời không bao giờ mất**, giữ suốt ván.
- Lên Đời mở **binh chủng mới**, **trang bị bậc mới**, thêm **Sức chứa** (dân số tối đa), thêm **bước cờ** mỗi đạo quân, mở **Lệnh Soái** và tăng tỉ lệ Lõi bậc cao trên bảng.

{{AGE}}

**Nhịp lên Đời tham khảo** (tính từ dữ liệu):

{{PACE}}

---

## 4. Đạo quân: Tướng và Lính

- **Đạo quân = 1 Tướng + 0..n Lính cùng binh chủng.** Mua tướng để mở đạo quân mới ở một ô trong vùng xuất quân; lính chỉ mua được **vào một tướng đã có** (cùng binh chủng của tướng).
- **Tướng** là quân đầu tiên của đạo quân: chỉ số nhân thêm **Máu ×{{GENHP}}%, ATK ×{{GENATK}}%, DEF ×{{GENDEF}}%**, thân to ×{{GENRAD}}%, có áo choàng. **Chỉ tướng có MP và dùng kỹ năng**, và chỉ tướng **đeo trang bị** (tối đa {{GENITEMS}} món).
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
| **Đeo / tháo đồ** | Từ tủ đồ lên tướng (tối đa {{GENITEMS}} món) và ngược lại. |
| **Mua / bán trang bị** | Theo bậc đã mở; bán hoàn 100%. |
| **Mua / bán Lõi** | Mua từ bảng {{COREBOARD}} Lõi; Lõi có hiệu lực ngay khi nằm trong tủ đồ; bán hoàn giá mua. |
| **Đổi bảng / khóa Lõi** | Đổi bảng {{REROLL}} Vàng ({{FREERR}} lần miễn phí mỗi ngày); khóa tối đa {{CORELOCKS}} ô để giữ qua lần đổi. |
| **Mua EXP** | {{XPCOST}} Vàng = {{XPAMT}} EXP. |
| **Xếp tự động** | Cận chiến phía trước, tầm trung ở giữa, tầm xa phía sau, Kỵ binh và Thích khách ở hai cánh. |

- **Tủ đồ {{INVSIZE}} ô** dùng chung cho trang bị chưa đeo và Lõi.
- **Mọi thứ được giữ qua các ngày**: đạo quân, vị trí, chiến thuật, cờ, trang bị, Lõi, Vàng dư, EXP và Đời. Không có gì bị đặt lại khi sang ngày mới.
- Có **Hoàn tác** trong pha chuẩn bị.

### 5.2 Gói đội hình và chống gian lận

Cuối pha chuẩn bị mỗi máy đóng **gói đội hình** gồm hai phần:

- **Nhật ký kinh tế**: các lệnh tiêu/nhận Vàng ngoài quân lính (mua EXP, mua/bán trang bị, mua/bán Lõi, đổi bảng, khóa ô).
- **Quân**: danh sách đạo quân `[id, binh chủng, số quân, x, y, chiến thuật, trang bị, cờ]`, tủ đồ, id kế tiếp.

Máy nhận áp gói lên trạng thái đầu ngày của người đó và kiểm tra: phát lại nhật ký kinh tế đúng luật; **ngân sách Vàng** (Vàng còn + giá trị quân cũ − giá trị quân mới không được âm); **tập trang bị** sở hữu sau phát lại phải khớp đúng từng món (đeo hay trong tủ); tủ đồ không quá {{INVSIZE}} ô; binh chủng đã mở theo Đời; vùng xuất quân, không trùng ô; Sức chứa; tối đa 1 Thần thú; tối đa {{GENITEMS}} trang bị mỗi tướng; cờ hợp lệ. Sai bất kỳ điều nào thì giữ đội hình cũ.

---

## 6. Chiến trường, bản đồ, địa hình

### 6.1 Kích thước

| Chế độ | Bản đồ | Vùng xuất quân mỗi người |
|---|---|---|
| Đấu tay đôi | {{DIM2}} ô | 24 × 12 ô, hai đầu bản đồ |
| 3 / 4 người, 2 đấu 2 | {{DIM4}} ô | 24 × 12 ô, ở 3–4 cạnh |

Bản đồ sinh theo seed, **đối xứng xoay** giữa các phe, có kiểm tra liên thông. Phòng có tùy chọn **Khóa bản đồ**.

### 6.2 Các bản đồ

{{MAPS}}

### 6.3 Địa hình

{{TERRAIN}}

Không có sương mù: cả chuẩn bị lẫn giao tranh đều thấy toàn bộ chiến trường.

---

## 7. Giao tranh tự động

- **100% tự động**, **{{TICK}} tick/giây**, số nguyên, ngẫu nhiên có seed → mọi máy cho cùng kết quả (mã băm FNV-64).
- Quân tự tìm đường (flow-field Dijkstra theo chi phí địa hình), tự chọn mục tiêu; **tướng** dùng kỹ năng khi đầy MP; **Lệnh Soái** tự kích hoạt.
- **MP (chỉ tướng)**: mỗi đòn đánh +{{MPATK}}, mỗi lần bị đánh +{{MPHIT}} (nhân hệ số hồi MP của tộc, thiên phú, đồ, Lõi).
- **Giới hạn {{BATTLEMIN}} phút**: sau {{BATTLEMAX}} giây, **bão chiến trường** gây sát thương thật lên mọi quân, giây thứ k gây {{STORM}}·2^(k−1), bỏ qua khiên. Khi bão bắt đầu, mọi cờ bị bỏ và lính thôi bám theo tướng.
- **Tháp canh**: một phe giữ {{TOWERSEC}} giây liên tục không có địch → toàn quân +{{TOWERATK}}% ATK tới hết trận (địch chiếm lại thì mất).

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
- **Chí mạng** ×150% (tối đa {{CAPCRIT}}% tỉ lệ), **né** tối đa {{CAPDODGE}}%, giảm sát thương tối đa {{CAPDR}}%, tốc đánh tối đa {{MAXAS}}%.
- Hút máu, khiên, phản sát thương, xuyên giáp, choáng / làm chậm / đốt / giảm giáp là các khối hiệu ứng dùng chung cho kỹ năng, trang bị, Lõi.
- **Ngày/đêm**: ban ngày Rồng và Nhân +4% ATK, ban đêm Tiên và Quỷ +4% ATK (ngày chẵn là đêm).

---

## 9. Binh chủng (khuôn một quân, trước hệ số tộc và hệ số tướng)

MP chỉ áp dụng cho tướng. Giá tướng / giá lính là giá gốc (trước phụ phí tộc).

{{ROLES}}

---

## 10. Bốn tộc

### 10.1 Hệ số tộc (% so với khuôn)

{{FACMODS}}

{{FACTIONS}}

---

## 11. Trang bị

- Mua bằng **Vàng**, giá theo bậc; **bán hoàn 100%**. Bậc I–IV mở theo Đời I–IV.
- **Chỉ tướng đeo**, tối đa {{GENITEMS}} món; chỉ số và hiệu ứng áp cho tướng, riêng trang bị **Hào quang** áp cho cả đạo quân. Đang chọn tướng thì mua xong đeo ngay; không thì vào tủ đồ.
- Nhân tộc: trang bị mạnh hơn 15% (Rèn Khí 30%), mỗi món trên tướng cho cả đạo quân +2% ATK.
- Trang bị khởi đầu (chọn ở phòng chờ): {{STARTITEMS}}.

{{ITEMS}}

---

## 12. Lõi

- Bảng {{COREBOARD}} Lõi mỗi ngày, mua bằng Vàng; **Lõi nằm trong tủ đồ là có hiệu lực**, tự áp cho quân phù hợp, không cần chọn mục tiêu. Bán lại hoàn giá mua.
- Đổi bảng {{REROLL}} Vàng ({{FREERR}} lần miễn phí mỗi ngày); khóa tối đa {{CORELOCKS}} ô. Lõi riêng tộc chỉ xuất hiện cho đúng tộc.
- Phạm vi: **toàn quân**, **kinh tế**, theo **nhóm tầm** (cận / trung / xa), theo **binh chủng**, theo **tộc**. Tỉ lệ bậc theo Đời xem bảng mục 3.2.

{{CORES}}

---

## 13. Chiến thuật, Hành quân, Lệnh Soái

### 13.1 Chiến thuật (tư thế của đạo quân)

{{STANCES}}

### 13.2 Hành quân (Cờ Lệnh)

Chọn tướng → **Hành quân** → cắm tối đa {{FLAGSTEPS}} bước cờ mỗi đạo quân (theo Đời I–IV; Lõi Quân Lệnh Mở Rộng +1), tổng tối đa {{FLAGTOTAL}} cờ mỗi người. Cờ chỉ đường cho tướng, lính đi theo tướng. Cờ được giữ sang ngày sau.

{{FLAGS}}

Cờ Vàng có ba kiểu: **Sát cánh** (đi cạnh và cùng đánh), **Bảo vệ** (giữ sát hơn đạo quân được hộ tống), **Theo sau** (đi phía sau, chỉ đánh khi địch tới gần). Không hộ tống chính mình, không vòng tròn, chuỗi hộ tống tối đa 3 đạo quân.

### 13.3 Lệnh Soái

Tự động, mỗi lệnh dùng tối đa một lần mỗi giao tranh, mở ở Đời I / III / IV (danh sách ở mục 10).

---

## 14. Lịch {{DAYS_N}} ngày, quái, sự kiện, thời tiết

{{DAYS}}

**Quái trung lập** (ngày săn quái; người hạ nhiều quái nhất nhận Vàng):

{{MONSTERS}}

**Sự kiện** (chọn ngẫu nhiên theo seed):

{{EVENTS}}

**Thời tiết** (ngẫu nhiên theo seed, Trời quang hay gặp nhất):

{{WEATHER}}

---

## 15. Điểm và kết thúc ván

{{RANKPTS}}

- **Điểm hạ gục**: mỗi {{KILLPOP}} dân số quân địch bị hạ = 1 điểm (cộng dồn qua các ngày, không mất phần lẻ).
- **Ngày {{DAYS_N}} (Chung Kết)**: điểm hạng ×{{FINALMULT}}.
- **Thắng ván**: tổng điểm cao nhất; hòa thì so điểm hạng, rồi điểm hạ gục, rồi hạng ngày cuối. 2 đấu 2: cộng điểm hai đồng đội.
- **Đầu hàng / thoát**: bị loại khỏi các ngày sau; còn một phe thì kết thúc ngay. Người không gửi kịp đội hình giữ đội hình hôm trước.

---

## 16. Bot và cân bằng

### 16.1 Ba mức Bot (`js/core/bot.js`, xác định theo seed)

{{BOTS}}

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
js/core/battle.js   Mô phỏng giao tranh xác định ({{TICK}} tick/giây, số nguyên)
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
- **Tủ đồ {{INVSIZE}} ô** cho trang bị chưa đeo và Lõi.
- **Menu hành động nằm ngang** phía trên tướng đang chọn: **Di chuyển**, **Chiến thuật**, **Hành quân**, **+ Lính**.
- **Bảng thông tin tướng** tự đặt bên trái hoặc phải để không che tướng; trên điện thoại là **bảng trượt từ dưới** với nút **Chi tiết**.
- **Popup bán lính**: thanh trượt hoặc ô nhập số, nút **Bán hết**. **Popup bán tướng**: hiển thị chi tiết số Vàng hoàn lại (tướng, lính, trang bị).
- Trên sân chỉ **tướng** hiện thanh máu, thanh MP và icon trang bị.
- Trong giao tranh, giao diện chuẩn bị **trượt ra ngoài** để nhường chỗ cho trận đấu.
- Điều khiển chỉ bằng **chuột trái hoặc chạm** (kéo thả hoặc chạm thẻ rồi chạm ô). Phím tắt bổ trợ: Ctrl+Z hoàn tác, Space sẵn sàng, Q đổi tab, F mua EXP, Delete bán, 1/2/4 tốc độ, H về góc nhìn, Esc bỏ chọn.
- Toàn bộ chữ tiếng Việt, biểu tượng vẽ bằng SVG, không dùng emoji.

---

## 21. Kiểm thử

- `node tests/run-tests.js` — **63 kiểm tra đạt**: dữ liệu đủ {{NUNITS}} quân / {{NITEMS}} trang bị / {{NCORES}} Lõi, kinh tế (thu nhập bằng nhau, lãi, EXP, hoàn 100%), tướng/lính, Sức chứa, tủ đồ, gói đội hình và kiểm tra gian lận, xác định (cùng seed cùng mã băm), bão kết thúc trận, tháp canh, cờ, hộ tống, ván đầy đủ với Bot 2/3/4 người ở 3 mức.
- `node tests/fuzz.js` — lệnh ngẫu nhiên và gói đội hình ngẫu nhiên: **0 lỗi**.
- Trình duyệt: `tests/gallery.html` (xem mẫu 3D), `tests/battle.html` (xem giao tranh), `index.html?local=1` (chơi không cần Firebase).

---

## 22. Thay đổi so với bản 2.x và việc còn để ngỏ

| Mục | Bản 2.x | Bản 3.0 |
|---|---|---|
| Tiền tệ | Nhiều loại tiền: một nhóm để mua quân và đồ, một loại riêng cho EXP/Lõi | **Chỉ Vàng**, có lãi (mỗi {{INTPER}} → +1, tối đa +{{INTMAX}}) |
| Mua quân | Mua từng đội quân cùng loại | **Tướng** mở đạo quân, **lính** nhập vào tướng |
| Kỹ năng, trang bị | Mọi quân có năng lượng; quân đầu đội đeo đồ | **Chỉ tướng** có MP, dùng kỹ năng, đeo {{GENITEMS}} món |
| Lõi | Ô Lõi riêng theo Đời, giá riêng | Nằm trong **tủ đồ {{INVSIZE}} ô** chung với trang bị, mua bằng Vàng, bán hoàn giá |
| Bán lại | Lõi hoàn một phần | **Mọi thứ hoàn 100%**, bán tướng hoàn cả đồ đang đeo |
| Kiểm tra gói | Ngân sách nhiều loại tiền | Ngân sách Vàng + đúng tập trang bị + tủ đồ {{INVSIZE}} ô |
| Giao diện | Khu mua quân riêng + cửa hàng bên phải | **Thanh dưới nhiều tab**, tab Lính theo tướng, menu ngang trên tướng, bảng thông tin tự đặt |
| Đồ họa | Khối bo góc, viền đậm | **PBR + HDRI + hậu kỳ**, địa hình heightmap, chibi low-poly kiểu Ragnarok Online 3 |
| Phát hành | Đăng mã nguồn | **Bản dựng làm rối + khóa tên miền** |

**Còn để ngỏ (đề xuất):** phát lại trận và phân tích "vì sao thua"; chế độ Thử nghiệm (sandbox); thành tựu; xếp hạng mùa cần Cloud Functions kiểm kết quả (vì không có trọng tài); mẫu đội hình lưu sẵn; cân lại Quỷ tộc (đang thấp nhất, 46%).

*Hết tài liệu.*
