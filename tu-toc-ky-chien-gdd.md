# TỨ TỘC KỲ CHIẾN (tên tạm) — Tài liệu thiết kế game

> Game chiến thuật theo lượt trên bàn cờ, kết hợp tư duy cờ vua với kinh tế kiểu Age of Empires.
> Chơi 2, 3 hoặc 4 người. Thiết kế dùng chung một bộ luật cho PC, mobile, webgame online và boardgame ngoài đời.
> Phiên bản tài liệu: 1.2 (07/10/2026) — kèm bản webgame online thử nghiệm (mục 19). Mọi con số trong tài liệu là giá trị khởi điểm để playtest và có thể chỉnh (xem mục 14).

---

## Mục lục

1. Tổng quan và tầm nhìn
2. Thuật ngữ và quy ước
3. Bàn cờ
4. Tài nguyên và kinh tế
5. Thiết lập ván và trình tự lượt
6. Hệ thống Đời
7. Quân đội
8. Di chuyển, tấn công, nhóm quân
9. Vua và điều kiện thắng
10. Hệ thống kỹ năng tộc
11. Bốn tộc
12. Chế độ 2, 3, 4 người
13. Ví dụ minh họa
14. Cân bằng, tham số và kế hoạch playtest
15. Triển khai đa nền tảng (digital và boardgame)
16. Lộ trình phát triển
17. Quyết định triển khai và điểm cần playtest
18. Phụ lục: bảng tra nhanh và nhật ký quyết định
19. Bản webgame online thử nghiệm (1.2)

---

## 1. Tổng quan và tầm nhìn

### 1.1 Ý tưởng một câu

Mỗi người chỉ có một Vua và 10 vàng. Họ dùng dân để làm kinh tế, mua quân để chiến đấu, lên đời để hành động nhiều hơn và dùng kỹ năng tộc để lật ván. Ai mất Vua trước thì thua, và toàn bộ quân của người đó biến mất khỏi bàn.

### 1.2 Trụ cột thiết kế

| Trụ cột | Ý nghĩa |
|---|---|
| **Thông tin công khai hoàn toàn** | Không có bài úp, không có ẩn thông tin, không có may rủi trong chiến đấu. Thắng thua do quyết định, không do xúc xắc. Điểm ngẫu nhiên duy nhất là cách xếp ô tài nguyên đầu trận. |
| **Kinh tế và chiến đấu cùng trên một bàn** | Dân là quân thật trên bàn. Dân vừa kiếm tiền, vừa là mục tiêu để bị săn, vừa có thể làm lá chắn. |
| **Bốn tộc, một bộ luật di chuyển** | Cách đi của các loại quân giống nhau giữa các tộc. Sự khác biệt đến từ nội tại, kích hoạt và đặc điểm riêng từng quân. |
| **Tốc độ ván tăng theo đời** | Đời cao hành động nhiều hơn mỗi lượt, nên ván chậm lúc đầu và nhanh dần về cuối. |
| **Một bộ luật cho mọi nền tảng** | Luật đủ đơn giản để tính tay trên bàn thật và đủ chặt để máy chủ kiểm tra tự động. |

### 1.3 Đối tượng người chơi

Người thích cờ vua, cờ tướng và game chiến thuật theo lượt như Advance Wars hoặc Age of Empires bản bàn cờ. Thời lượng mục tiêu là 30–50 phút cho ván 2 người và 50–75 phút cho ván 4 người.

---

## 2. Thuật ngữ và quy ước

| Thuật ngữ | Nghĩa |
|---|---|
| **V / T / G** | Vàng / Thực phẩm / Gỗ. |
| **Quân** | Một đơn vị trên bàn (dân, lính, kỵ binh...). |
| **Đội (nhóm)** | Các quân cùng loại, cùng chủ, nằm chung một ô (giới hạn thường 6; Tiên 3; ngoại lệ Đoạt Sinh không có trần). Cả đội di chuyển và đánh như một khối. |
| **HP** | Máu. Mỗi quân thường có 1 HP; chỉ Thần thú có HP riêng. Đội thường N quân có N HP; Thần thú đếm HP riêng. |
| **Hành động** | Chọn 1 quân hoặc 1 đội, cho đi (tối đa tầm di chuyển) rồi đánh (tùy chọn). |
| **Đời** | Cấp phát triển của người chơi: I Huyện, II Quận, III Châu, IV Thành. Đời quyết định số hành động mỗi lượt và quân được mua. |
| **Nghỉ** | Quân vừa mua chưa được hành động trong lượt mua. |
| **Kích hoạt** | Kỹ năng chủ động của tộc, không tốn hành động, có hồi chiêu (giống Q/W/E trong LoL). |
| **Nội tại** | Kỹ năng bị động, chọn 1 trong danh sách trước trận. |
| **Hồi chiêu (hồi N)** | Sau khi dùng ở lượt t, đến lượt t+N của chính người đó mới dùng lại được. |
| **Lượt** | Một lượt của một người chơi. **Vòng** là khi tất cả người chơi đã chơi xong một lượt. |
| **Thẳng** | 4 hướng ngang và dọc. **Chéo**: 4 hướng chéo. **8 hướng**: cả hai. |
| **Tầm k ô** | Đánh được mục tiêu ở bất kỳ ô nào cách 1 đến k ô theo hướng cho phép. |
| **Phạm vi k ô** | Vùng cách tối đa k ô theo khoảng cách Chebyshev (kể cả chéo). |
| **Kề** | Ô sát cạnh theo 4 hướng ngang/dọc, trừ khi ghi "8 hướng". |

Quy ước tọa độ: bàn 8x8 dùng cột A–H và hàng 1–8. Bàn 14x14 dùng cột A–N và hàng 1–14. Khi mô tả vị trí theo phe, "hàng 1" là hàng spawn của người đó và "cột 1" là cột bên trái từ góc nhìn của người đó.

---

## 3. Bàn cờ

### 3.1 Nguyên tắc thiết kế: bàn dạng module

Lõi là bàn 8x8 của cờ vua. Chế độ 2 người dùng riêng lõi này. Chế độ 3–4 người gắn thêm 4 cánh để có bàn chữ thập. Như vậy cả ba chế độ dùng cùng một lõi và cùng một khái niệm "hàng spawn gồm 8 ô".

### 3.2 Bàn 2 người (8x8)

Mỗi người có 4 hàng x 8 cột = 32 ô. Hàng spawn của mỗi người là hàng ngoài cùng.

```
      A  B  C  D  E  F  G  H
 8    S  S  S  S  S  S  S  S     <- Hàng spawn Phe 2 (Vua ở ô E8)
 7    .  .  .  .  .  .  h  .     <- h: ô tài nguyên nhà Phe 2 (G7)
 6    .  .  .  .  .  .  .  .
 5    .  .  .  .  .  .  .  .     <- hết vùng Phe 2
 4    .  .  .  .  .  .  .  .     <- hết vùng Phe 1 (đầu)
 3    .  .  .  .  .  .  .  .
 2    .  h  .  .  .  .  .  .     <- h: ô tài nguyên nhà Phe 1 (B2)
 1    S  S  S  S  S  S  S  S     <- Hàng spawn Phe 1 (Vua ở ô D1)
```

Ô nhà đặt xoay 180° giữa hai phe để công bằng.

### 3.3 Bàn 4 người (chữ thập 14x14, 160 ô)

Gồm lõi 8x8 ở giữa và 4 cánh, mỗi cánh sâu 3 hàng và rộng 8 ô. Mỗi người có 24 ô nhà (cánh của mình) và cùng chia sẻ lõi 64 ô. Hàng ngoài cùng của cánh là hàng spawn gồm 8 ô, giống bản 2 người.

```
        A  B  C  D  E  F  G  H  I  J  K  L  M  N
  1     x  x  x  N  N  N  N  N  N  N  N  x  x  x    <- Spawn Bắc
  2     x  x  x  N  N  N  N  N  N  N  N  x  x  x
  3     x  x  x  N  N  N  N  N  N  N  N  x  x  x
  4     W  W  W  c  c  c  c  c  c  c  c  E  E  E
  5     W  W  W  c  c  c  c  c  c  c  c  E  E  E
  6     W  W  W  c  c  c  c  c  c  c  c  E  E  E
  7     W  W  W  c  c  c  c  c  c  c  c  E  E  E
  8     W  W  W  c  c  c  c  c  c  c  c  E  E  E
  9     W  W  W  c  c  c  c  c  c  c  c  E  E  E
 10     W  W  W  c  c  c  c  c  c  c  c  E  E  E
 11     W  W  W  c  c  c  c  c  c  c  c  E  E  E
 12     x  x  x  S  S  S  S  S  S  S  S  x  x  x
 13     x  x  x  S  S  S  S  S  S  S  S  x  x  x
 14     x  x  x  S  S  S  S  S  S  S  S  x  x  x    <- Spawn Nam

 N/S/E/W = cánh nhà từng phe   c = lõi 8x8 dùng chung   x = ô bị cắt (không tồn tại)
 Spawn Tây = cột A (8 ô từ A4 đến A11); Spawn Đông = cột N (8 ô từ N4 đến N11)
```

Phe Tây và phe Đông có hướng "sâu" nằm ngang, nên quy ước "hàng 1" và "cột 1" của họ xoay 90° theo góc nhìn từ cánh của họ.

### 3.4 Bàn 3 người

Dùng bàn 4 người và bỏ một cánh thành **Hoang Địa**: cánh trống, không có chủ, không có tài nguyên, không có quân trung lập. Ô trong Hoang Địa vẫn đi được và có thể dùng để vòng cánh, phục kích hoặc rút lui.

Phe nằm đối diện Hoang Địa phải đối đầu cả hai đối thủ ở hai bên, nên nhận **+2 vàng khởi đầu** để bù (có thể bốc thăm chỗ ngồi thay vì bù, xem mục 12).

### 3.5 Ô tài nguyên

Ô tài nguyên có ba loại: **ô vàng (mỏ)**, **ô thực (ruộng)** và **ô gỗ (rừng)**. Dân đúng nghề đứng trên ô cùng loại thì sản lượng **x2**: thợ mỏ trên ô vàng, nông dân trên ô thực, tiều phu trên ô gỗ. Dân khác nghề đứng trên ô không được hưởng.

**Ô nhà (cố định):**
- Mỗi phe có đúng 1 ô nhà ở vị trí cố định gần hàng spawn (hàng 2, cột 2 theo góc nhìn của phe).
- Loại tài nguyên của ô nhà do **người chơi chọn lúc bắt đầu ván**.

**Ô ngẫu nhiên ở giữa bàn:**
- Mỗi trận bốc ngẫu nhiên loại và vị trí, nhưng đặt đối xứng để công bằng.
- Bàn 2 người: 3 cặp ô (6 ô) đối xứng xoay 180° trong các hàng 3 đến 6.
- Bàn 4 người: 2 bộ x 4 ô (8 ô) đối xứng xoay 90° trong lõi 8x8, không đặt trong hai hàng/cột ngoài cùng của lõi.
- Bàn 3 người: dùng cách đặt như bàn 4 người; không có ô nào trong Hoang Địa.
- Không đặt ô trùng ô nhà hoặc hàng spawn.

**Quy tắc chiếm ô:** mỗi ô trên bàn chỉ chứa quân của một phe. Ai có dân đúng nghề đứng trên ô thì người đó hưởng x2, kể cả ô nhà của người khác. Muốn chặn kinh tế đối thủ, hãy chiếm hoặc dọn ô của họ.

Trên boardgame, ô ngẫu nhiên là các thẻ ô úp, bốc rồi đặt theo mẫu đối xứng của chế độ chơi (xem mục 15.6).

---

## 4. Tài nguyên và kinh tế

### 4.1 Ba loại tài nguyên

| Tài nguyên | Nguồn | Dùng để |
|---|---|---|
| **Vàng (V)** | +1 mỗi đầu lượt, thợ mỏ | Mua dân, quân, lên đời, kỹ năng một số tộc |
| **Thực phẩm (T)** | Nông dân | Mua quân bộ, quân cưỡi, lên đời |
| **Gỗ (G)** | Tiều phu | Mua quân tầm xa, công thành, chiến xa, lên đời |

Khởi đầu mỗi người có **10 vàng**, 0 thực, 0 gỗ.

### 4.2 Dân

Có 3 nghề: thợ mỏ, nông dân, tiều phu. Giá **2 vàng** mỗi dân, không giới hạn số lượng.
- Di chuyển 1 ô theo 4 hướng, **không đánh được** (trừ Dân của Rồng tộc).
- Mỗi dân thu 1 tài nguyên theo nghề vào đầu lượt (2 nếu đứng đúng ô tài nguyên cùng loại).
- Chỉ khi cả đội Dân bị kết liễu mới trả thưởng theo HP ngay trước hiệu ứng kết liễu, đúng loại nghề (mục 4.4).
- Dân cùng nghề gộp được thành đội (tối đa 6 mỗi ô). Dân khác nghề không gộp.

Số dân không bị giới hạn bằng luật. Giới hạn thực tế là **diện tích hàng spawn** (8 ô x 6 quân = 48 quân mỗi lượt mua) và **diện tích bàn**.

### 4.3 Thu nhập đầu lượt

```
Thu nhập = 1 vàng cơ bản
         + số dân thợ mỏ    (x2 cho dân đứng trên ô vàng)
         + số dân nông dân  (x2 cho dân đứng trên ô thực)
         + số dân tiều phu  (x2 cho dân đứng trên ô gỗ)
         + các hiệu ứng tộc (Lãi Suất, Kỳ Lân Vàng...)
```

### 4.4 Thưởng kết liễu đội

Chỉ trả thưởng khi **toàn bộ đội địch về 0 HP**. Không trả thưởng khi chỉ làm giảm quân/HP.

- Thưởng cơ bản = **HP còn lại ngay trước hiệu ứng sát thương kết liễu**; không dùng HP ban đầu của đội, không cộng sát thương đã gây ở lượt trước hoặc đòn trước.
- Quân chiến đấu: nhận số tài nguyên đó, tự chia giữa V/T/G. Dân: toàn bộ thưởng đúng nghề.
- Ví dụ: đội 10 HP → lượt 1 còn 4 → lượt 2 còn 2 → lượt 3 bị diệt: người kết liễu nhận **2 tài nguyên**. Hai lượt trước nhận 0.
- Nếu trong cùng lượt đánh đội 10 HP còn 4, rồi đòn khác kết liễu: nhận **4**, không phải 10. Mốc tính là đòn/hiệu ứng cuối, không phải đầu lượt.
- Thần thú còn 2 HP bị kết liễu: thưởng 2 tài nguyên, dù chỉ là 1 quân.
- Vua là ngoại lệ: thưởng cố định **3 tài nguyên**. Quân biến mất do chủ mất Vua không tạo thưởng hoặc Hồn và không kích hoạt hiệu ứng chết.
- Tự hy sinh không cho thưởng; đổi chủ không phải kết liễu. Sát thương phụ/lan/phản sát thương kết liễu cũng trả thưởng cho chủ nguồn hiệu ứng.
- Mỗi đội bị diệt trả thưởng đúng một lần. Mỗi mục tiêu của đòn lan có ảnh chụp HP riêng trước hiệu ứng gây chết.
- Thưởng vẫn tồn tại từ lượt 40. Các thưởng thêm của Nhân cộng riêng, không nhân toàn bộ HP thưởng.

### 4.5 Thời Đại Suy Tàn (từ lượt 40)

Từ lượt cá nhân 40: bỏ +1 vàng cơ bản và các nguồn sinh tài nguyên thụ động của tộc (Lãi Suất, Kỳ Lân, Thương Kỵ). **Dân chỉ sản xuất trên ô tài nguyên đúng nghề**, vẫn x2. Dân trên ô thường không sản xuất nhưng vẫn di chuyển. Thưởng kết liễu, Hồn, đổi tài nguyên, mua quân và các kỹ năng tiêu tài nguyên tiếp tục hoạt động.

Mục tiêu: buộc người chơi tranh ruộng/rừng/mỏ thay vì tắt toàn bộ kinh tế. Hồi chiêu và trạng thái vẫn cập nhật đầu lượt bình thường.

### 4.6 Đổi tài nguyên

Mặc định không đổi được. Nội tại Chợ Trời của Nhân tộc cho phép đổi tài nguyên với tỉ giá 2:1 (xem mục 11.2). Người chơi khác không có quyền đổi, trừ khi bạn thêm chế độ Chợ chung (đề xuất cho mục 14.6).

---

## 5. Thiết lập ván và trình tự lượt

### 5.1 Thiết lập

1. Mỗi người chọn **tộc**.
2. Mỗi người chọn **1 nội tại** trong danh sách nội tại của tộc mình (xem mục 11).
3. Mỗi người chọn **loại tài nguyên cho ô nhà** của mình (vàng, thực hoặc gỗ).
4. Xếp bàn theo số người chơi, bốc ô tài nguyên ngẫu nhiên theo mẫu đối xứng (mục 3.5).
5. Đặt **Vua** của mỗi người ở ô giữa hàng spawn của họ (ô thứ 4 từ trái theo góc nhìn của phe).
6. Mỗi người nhận **10 vàng**, ở **Đời I (Huyện)**, mọi kích hoạt đã sẵn sàng.
7. Chọn người đi trước ngẫu nhiên, lượt đi theo chiều kim đồng hồ.

Ghi chú: Quỷ tộc bắt đầu với 1 Hồn (xem mục 11.4).

### 5.2 Cấu trúc một lượt

Mỗi lượt gồm Thu hoạch → Mua sắm/Lên đời → Hành động → Kết thúc, theo thứ tự:

**Pha 1: Thu hoạch.** Tính thu nhập (mục 4.3) và nhận tài nguyên. Cập nhật hồi chiêu và trạng thái trước khi thu hoạch. Từ lượt 40 áp dụng mục 4.5, không bỏ cập nhật đầu lượt.

**Pha 2: Mua sắm.**
- Mua tùy ý đến khi hết tài nguyên hoặc không muốn mua nữa. **Không tốn hành động.**
- Quân mua xong đặt vào **ô trống trong hàng spawn** của mình, hoặc vào ô đã có quân mới mua cùng loại trong lượt này (nếu đội chưa đủ 6).
- Quân vừa mua **nghỉ**: không được hành động cho đến lượt kế tiếp của mình.
- Quân mới mua **không gộp** vào đội cũ trong lượt này (đội cũ còn nằm trong ô thì chặn ô đó).
- Có thể lên đời bất cứ lúc nào trong pha này (xem mục 6).
- Chỉ có một pha mua: khi bắt đầu hành động đầu tiên, không quay lại mua/lên đời. Kỹ năng có cửa sổ START/COMMAND/REACTION (mục 10.2).

**Pha 3: Hành động.** Thực hiện số hành động bằng số Đời của mình (Đời I: 1, Đời II: 2, Đời III: 3, Đời IV: 4). Một hành động là:

1. Chọn 1 quân hoặc 1 đội **không nghỉ** và **chưa hành động trong lượt này**.
2. **Di chuyển** tối đa tầm di chuyển (có thể đi ít hơn hoặc đứng yên).
3. **Đánh** (tùy chọn) một mục tiêu trong tầm.

Quy tắc phụ:
- Mỗi quân hoặc đội hành động tối đa 1 lần mỗi lượt.
- **Tách đội:** chọn k quân trong đội để cùng hành động. Phần tách ra tính là **1 hành động**. Phần còn lại ở nguyên ô, có thể hành động riêng sau đó (tốn thêm 1 hành động) hoặc đứng yên.
- **Gộp đội:** đi vào ô có đội cùng loại của mình (tổng không quá giới hạn mua/gộp của tộc) thì gộp. Gộp **kết thúc hành động** của đội di chuyển: không đánh được sau khi gộp. Lưu cờ đã hành động theo từng quân: quân đã hành động không được đi/đánh lại qua gộp hoặc tách; có thể chọn phần chưa hành động cho action sau.
- Có thể dùng hết hoặc bỏ bớt hành động. Hành động không dùng không tích lũy.

### 5.3 Ba lượt đầu: miễn chiến

Trong **3 lượt đầu** của mỗi người, không ai được tấn công, và các kỹ năng gây sát thương hoặc tác động trực tiếp lên quân địch bị khóa. Mua sắm, di chuyển, lên đời và các kích hoạt không nhắm vào quân địch (như Thu Thuế) vẫn dùng được.

Mục đích: tránh để một Chiến xa hay Thích khách giết Vua ngay đầu ván và cho mọi người thời gian dựng kinh tế.

### 5.4 Kết thúc lượt

Hết lượt, chuyển cho người kế tiếp. Người đã mất Vua bị bỏ qua.

### 5.5 Lượt 40 trở đi

Xem mục 4.5. Vẫn đủ các pha; thu hoạch chỉ còn Dân trên ô đúng nghề.

---

## 6. Hệ thống Đời

### 6.1 Vai trò

Đời có **hai tác dụng**: (1) quyết định số **hành động** mỗi lượt và (2) mở khóa các loại quân mới. Lên đời tức là đổi tài nguyên lấy tốc độ chơi và sức mạnh.

| Đời | Tên | Hành động mỗi lượt | Chi phí lên đời | Quân mở khóa |
|---|---|---|---|---|
| I | **Huyện** | 1 | Miễn phí (khởi đầu) | Dân, Lính, Cung thủ |
| II | **Quận** | 2 | 3V 3T 2G (8) | Thuẫn binh, Kỵ binh |
| III | **Châu** | 3 | 7V 7T 6G (20) | Thích khách, Pháp sư, Công thành |
| IV | **Thành** | 4 | 14V 13T 13G (40) | Chiến xa, Thần thú, Chỉ Huy, Tượng binh |

### 6.2 Quy tắc lên đời

- Lên đời **lần lượt**, không nhảy đời.
- Trả tài nguyên đúng loại như bảng. Lên đời diễn ra tức thời ở pha Mua sắm.
- Hiệu lực áp dụng **ngay trong lượt đó**: lên đời xong thì pha Hành động dùng số hành động của đời mới.
- Không hạ đời. Quân đã mua của đời trước vẫn tồn tại bình thường.
- Chi phí lên đời là tham số cân bằng quan trọng nhất (xem mục 14).

### 6.3 Ý nghĩa chiến lược

- **Đời I chỉ có 1 hành động** nên chơi chậm như cờ vua. Phần lớn lượt đầu là mua dân và dựng kinh tế.
- Lên **Đời II sớm** gấp đôi tốc độ nhưng đổi bằng 8 tài nguyên (khoảng 4 dân).
- Lên **Đời IV** cho 4 hành động nhưng giá 40 tài nguyên, nên thường chỉ người có kinh tế mạnh mới tới được.
- Người lên đời sớm có lợi thế tempo. Người chậm lên đời bù bằng nhiều dân hơn hoặc nhiều quân hơn.

---

## 7. Quân đội

### 7.1 Bảng chỉ số chung

Tất cả tộc dùng chung chỉ số cơ bản dưới đây. Sự khác biệt giữa tộc nằm ở đặc điểm riêng (mục 11).

| Đời | Quân | Di chuyển | Tấn công | Giá |
|---|---|---|---|---|
| I | **Dân** (3 nghề) | 1 ô, 4 hướng | Không | 2V |
| I | **Lính** | 1 ô, 4 hướng | Cận chiến 1 ô, 4 hướng | 1V 2T |
| I | **Cung thủ** | 1 ô, 4 hướng | Tầm xa, thẳng tối đa 2 ô | 1V 1T 2G |
| II | **Thuẫn binh** | 1 ô, 4 hướng | Cận chiến 1 ô; nhận −1 sát thương mỗi đòn tầm xa | 2T 2G |
| II | **Kỵ binh** | Tối đa 3 ô thẳng | Cận chiến 1 ô, 4 hướng | 2V 2T 1G |
| III | **Thích khách** | Nhảy chữ L (như mã cờ vua), bỏ qua vật cản | Cận chiến 1 ô chéo | 3V 2G |
| III | **Pháp sư** | Tối đa 2 ô chéo | Tầm xa, chéo tối đa 2 ô | 3V 1T 2G |
| III | **Công thành** | 1 ô, 4 hướng | Tầm xa, thẳng tối đa 3 ô, sát thương x2, bắn qua đầu quân khác; đã di chuyển thì không bắn | 2V 1T 4G |
| IV | **Chiến xa** | Tối đa 8 ô thẳng | Cận chiến 1 ô, 4 hướng | 3V 3T 4G |
| IV | **Thần thú** (chỉ mua 1 lần cả trận) | Tối đa 3 ô, 8 hướng | Cận chiến 1 ô, 8 hướng; **3 HP** | 5V 3T 4G |
| IV | **Chỉ Huy** | Tối đa 2 ô, 4 hướng | Không đánh; **hào quang**: mọi đội của ta kề (4 hướng) gây +1 sát thương mỗi đòn (không cộng dồn nhiều Chỉ Huy) | 3V 2T 2G |
| IV | **Tượng binh** | Tối đa 2 ô, 4 hướng | Cận chiến 1 ô, 4 hướng; mỗi con **1 HP** | 2V 4T 3G |
| — | **Vua** | Tối đa 2 ô, 8 hướng | Cận chiến 1 ô, 8 hướng | Có sẵn đầu trận, không mua được |

Tổng giá trị (để so sánh nhanh): Lính 3, Cung thủ 4, Thuẫn binh 4, Kỵ binh 5, Thích khách 5, Pháp sư 6, Công thành 7, Chiến xa 10, Chỉ Huy 7, Tượng binh 9, Thần thú 12.

### 7.2 Vai trò chiến thuật

| Quân | Vai trò | Khắc | Bị khắc bởi |
|---|---|---|---|
| Dân | Kinh tế, vật cản, mồi nhử | — | Mọi quân đánh được |
| Lính | Lá chắn rẻ, lấp đầy bàn | Dân, Cung thủ lẻ | Tầm xa, Thuẫn binh |
| Cung thủ | Gây sát thương từ xa, rẻ | Quân cận chiến chậm | Kỵ binh, Thích khách |
| Thuẫn binh | Chống tầm xa | Cung thủ, Pháp sư (yếu) | Công thành (x2), Chiến xa |
| Kỵ binh | Cơ động, săn Cung thủ | Cung thủ, Dân | Thuẫn binh, nhóm đông |
| Thích khách | Nhảy qua hàng rào để diệt quân yếu | Cung thủ, Pháp sư, Công thành | Nhóm đông, Thuẫn binh |
| Pháp sư | Tầm xa chéo, bẻ góc phòng thủ | Quân đi thẳng | Thích khách, Kỵ binh |
| Công thành | Phá đội đông từ xa, sát thương x2 | Nhóm đông, Thuẫn binh | Mọi quân áp sát, không tự vệ khi đã đi |
| Chiến xa | Tốc độ 8 ô, săn Vua | Mọi quân lẻ | Nhóm đông chắn đường, Thuẫn binh |
| Thần thú | Quân vua của đội hình | Hầu hết | Nhóm đông, Công thành |
| Chỉ Huy | Tăng sát thương cho đội kề | Hỗ trợ | Thích khách, tầm xa |
| Tượng binh | Xe tăng cận chiến | Quân cận chiến | Công thành, nhóm đông |

---

## 8. Di chuyển, tấn công, nhóm quân

### 8.1 Di chuyển

- **Tầm di chuyển là tối đa**: quân đi bất kỳ số ô từ 0 đến tầm cho phép (ví dụ Kỵ binh đi 1, 2 hoặc 3 ô đều được).
- Quân đi theo **đường thẳng**, **chéo** hoặc **chữ L** tùy loại. Đường đi bị **chặn** bởi bất kỳ quân nào (ta hoặc địch). Ngoại lệ: Thích khách nhảy chữ L, hoặc các quân có đặc điểm "đi xuyên quân" hoặc "bay" của Tiên tộc và Thần thú Rồng.
- Không đi vào ô có quân địch. Đi vào ô có đội cùng loại của mình thì **gộp** (mục 8.5).
- Không đi vào ô có quân của mình khác loại.
- Ô bị cắt trên bàn chữ thập không tồn tại và không đi vào được.

### 8.2 Hai kiểu tấn công

**Cận chiến** (Lính, Thuẫn binh, Kỵ binh, Thích khách, Chiến xa, Thần thú, Tượng binh, Vua; Dân Rồng tộc):
- Đánh mục tiêu ở ô **kề** (theo hướng của quân).
- Nếu mục tiêu bị diệt **hết HP của cả đội trong ô đó**, quân đánh có thể **chiếm ô** đó (đi vào ô, quyền chọn). Nếu chỉ diệt một phần, quân đánh đứng yên.

**Tầm xa** (Cung thủ, Pháp sư, Công thành):
- Đánh mục tiêu trong tầm theo hướng của quân.
- **Không chiếm ô**, dù mục tiêu bị diệt hết.
- Tầm xa **bị chặn** bởi quân nằm giữa đường (kể cả quân của mình), **trừ Công thành** bắn qua đầu quân khác.
- Nội tại hoặc kích hoạt như Linh Nhãn có thể cho phép đánh xuyên quân cản.

### 8.3 Tầm đánh là phạm vi

Tầm đánh tính theo "tối đa k ô": Cung thủ tầm thẳng tối đa 2 ô nghĩa là đánh được mục tiêu cách 1 hoặc 2 ô theo bốn hướng ngang/dọc. Không còn kiểu "chỉ đúng ô thứ N".

### 8.4 Sát thương và HP

**Quy tắc cốt lõi:** sát thương một đòn bằng **số quân đang hành động trong đội** (đội N quân gây N sát thương), sau đó áp các điều chỉnh.

Thứ tự tính sát thương:
1. **Cơ bản** = N (số quân trong đội đang đánh).
2. **Nhân**: x2 của Công thành, +50% của Long Lực (làm tròn lên).
3. **Cộng thêm**: hào quang Chỉ Huy, Xung Phong, Tài Trợ Chiến Tranh, Thích khách Rồng lên quân tầm xa, Long Nộ...
4. **Giảm**: Thuẫn binh, Giáp Vảy, Long Giáp, Long Hống... Sát thương cuối cùng tối thiểu 0, trừ khi hiệu ứng ghi "tối thiểu 1".

Mục tiêu mất HP bằng sát thương cuối. Quân bị loại theo từng đơn vị khi HP về 0. **Sát thương dư bị mất** (trừ Tên Xuyên Giáp của Cung thủ Rồng).

Chỉ Thần thú có nhiều HP: mặc định 3, Phượng Hoàng 2. Tất cả quân khác, kể cả Tượng và Chỉ Huy, có 1 HP. Thần thú không gộp, không hồi sinh, không đổi chủ và không tạo bản sao; cờ đã mua giữ nguyên sau khi nó chết.

**Không phản đòn.** Người bị đánh không đánh trả ngay. Ai đánh trước, gây sát thương trước.

### 8.5 Nhập quân (đội)

- Các quân **cùng loại, cùng chủ** vào chung một ô thì thành **một đội**. Dân chỉ gộp khi **cùng nghề**.
- Mua/gộp thông thường tối đa **6 quân** (Tiên 3). Đoạt Sinh là nguồn duy nhất tăng đội Quỷ vượt giới hạn, không có trần 10/20/30; xem mục 11.4. Không mua/gộp thêm vào đội đã vượt giới hạn.
- Đội có chỉ số di chuyển, tầm đánh và đặc điểm **y hệt một quân lẻ** của loại đó. Đội chỉ khác ở **HP = số quân** và **sát thương = số quân**.
- Đội di chuyển như một khối. Có thể **tách** (mục 5.2).
- Quân mua trong lượt không gộp vào đội cũ cho đến lượt kế tiếp.
- Gộp kết thúc hành động của đội di chuyển.
- Đội Dân đứng trên ô tài nguyên đúng nghề: **mọi dân trong đội đều x2**.
- Tiên tộc: đội tối đa **3 quân** (điểm yếu Mong Manh).

### 8.6 Nghỉ (quân mới mua)

Quân vừa mua **nghỉ**: không di chuyển, không đánh, không gộp vào đội cũ trong lượt mua. Ngoại lệ Tiên Phong: được di chuyển bằng hành động nhưng không được đánh hoặc gộp đội cũ trong lượt mua.

Quân nghỉ vẫn bị đánh được và vẫn làm vật cản bình thường. Quân nghỉ vẫn có thể bị hy sinh (Huyết Tế).

### 8.7 Thứ tự giải quyết đòn đánh

1. Người chơi tuyên bố hành động: chọn đội, đường đi, mục tiêu.
2. Di chuyển đội đến ô đích.
3. Kích hoạt (nếu có) áp dụng theo thời điểm ghi trên kỹ năng.
4. Tính sát thương theo mục 8.4.
5. Chụp HP trước sát thương; trừ HP, loại quân, ghi death_id; chỉ trả thưởng nếu cả đội bị diệt. Cập nhật Hồn và phản sát thương.
6. Nếu Vua chết, xử lý loại người chơi ngay; quân biến mất không tạo death trigger. Đội đánh còn sống mới được chọn chiếm ô.
7. Giải quyết di chuyển sau đòn (Bóng Ma/Quỷ Xa), rồi kiểm tra Đoạt Sinh tại ô vừa chiếm. Xử lý spawn sau cùng vào ô còn trống hợp lệ. Long Uy chỉ tạo tối đa một đòn thêm; không tự kích hoạt lại. Mọi đòn thêm chạy cùng pipeline và chụp HP mới.

### 8.8 Tóm tắt các trường hợp biên

- Đội A có 4 quân đánh đội B có 3 quân: sát thương 4, đội B bị diệt hết (dư 1 bị mất). Nếu A cận chiến thì có thể chiếm ô.
- Đội A có 2 quân đánh đội B có 3 quân: B mất 2 quân, còn 1. A không chiếm ô.
- Đội A tầm xa không bao giờ chiếm ô.
- Tượng binh 1 HP: đội 2 Tượng có 2 HP và gây 2 sát thương.
- Một quân lẻ đánh Thuẫn binh lẻ (−1 sát thương tầm xa): nếu là tầm xa, sát thương 1 − 1 = 0; nếu là cận chiến, sát thương 1.

---

## 9. Vua và điều kiện thắng

### 9.1 Vua

- **Có sẵn từ đầu trận**, không mua được, không bị ảnh hưởng bởi các hiệu ứng mua chuộc hoặc biến đổi (Hối Lộ, Hấp Hồn).
- **1 HP**. Di chuyển tối đa 2 ô, 8 hướng. Cận chiến 1 ô, 8 hướng. Không gộp.
- Vua Tiên tộc và Vua Quỷ tộc chỉ di chuyển **1 ô** (điểm yếu tộc).
- Vua là **một hành động như quân khác**: tốn 1 hành động để đi hoặc đánh.
- Kỹ năng Vua cũ đã bỏ. Các kỹ năng đó chuyển thành kích hoạt hoặc nội tại của tộc.

### 9.2 Điều kiện thua

Mất Vua là thua ngay lập tức. **Toàn bộ quân của người đó biến mất khỏi bàn**, kể cả dân. Ô tài nguyên trở lại trống. Người diệt Vua nhận **3 tài nguyên tùy chọn**.

### 9.3 Điều kiện thắng

- **2 người:** diệt Vua đối thủ.
- **3–4 người:** là người cuối cùng còn Vua.
- **2v2 (4 người):** cả hai Vua đối phương bị diệt, hoặc tự do quy định đồng minh (mục 12.4).

### 9.4 Chống hòa kéo dài (đề xuất)

Từ lượt 40 kinh tế phụ thuộc ô tài nguyên. Ranked dùng giới hạn **vòng 80** (sau khi mỗi người còn sống hoàn tất lượt cá nhân 80): người chơi còn Vua tính điểm = tổng giá trị quân trên bàn + tài nguyên còn lại; ai cao nhất thắng. Casual có thể tắt giới hạn; bằng điểm thì hòa.

---

## 10. Hệ thống kỹ năng tộc

### 10.1 Cấu trúc

Mỗi tộc có:
- **1 nội tại** (kỹ năng bị động), người chơi **chọn 1** trong danh sách nội tại của tộc trước trận.
- **3 kích hoạt** cố định (kỹ năng chủ động), dùng được **ngay từ Đời I**.
- **1 điểm yếu** cố định (một nhược điểm tộc mang theo mọi trận).
- **Đặc điểm riêng từng quân** (mục 11, bảng của từng tộc).

### 10.2 Timing, hồi chiêu và trạng thái

- Ba kích hoạt không tốn hành động; dùng khi sẵn sàng ở đúng cửa sổ, không chen vào giữa một hiệu ứng đang giải quyết.
- **START:** sau thu hoạch, trước mua. Đổi nghề Dân Nhân thực hiện trước thu hoạch, một lần/Dân/lượt.
- **COMMAND:** trước khi bắt đầu hành động, hoặc sau khi hành động trước giải quyết hoàn toàn. Tất cả Q/W/E dùng COMMAND. Hiến Tế, Oán Hồn, Tái Sinh và Chợ Trời cũng dùng COMMAND; Chợ Trời được dùng trong pha mua.
- **REACTION:** tự động theo trigger ghi rõ, ví dụ Long Nộ, Đoạt Sinh, Phản Oán. Người chơi chọn khi hiệu ứng ghi tùy chọn.
- Dùng ở lượt cá nhân t, CD N → sẵn sàng ở t+N. Lưu `ready_turn`, không phụ thuộc số đối thủ. Đoạt Sinh có CD riêng của người chơi.
- Buff đòn kế tiếp hết khi được tiêu thụ hoặc hết thời hạn ghi rõ; không nhân cho toàn bộ chuỗi đánh thêm. Kỹ năng cho đánh thêm chỉ cho số đòn ghi rõ, không tạo hành động mới.
- Ba lượt miễn chiến khóa mọi hiệu ứng gây hại trực tiếp hoặc lấy tài nguyên đối thủ, kể cả Thu Thuế. Buff đồng minh vẫn được dùng, không vượt luật cấm đánh.
- Hiệu ứng có phí phải kiểm tra mục tiêu, tài nguyên và điều kiện trước khi trừ phí. Không hợp lệ → giữ nguyên state và hồi chiêu.

### 10.3 Triết lý thiết kế

| Tộc | Lối chơi | Đòn bẩy |
|---|---|---|
| Rồng | Áp đảo, đánh mạnh và nhanh | Sát thương, uy áp |
| Nhân | Thương nhân, thắng bằng tiền | Kinh tế đổi thành sức mạnh |
| Tiên | Nhanh nhạy, thao túng tầm đánh | Tốc độ, vị trí, tầm xa |
| Quỷ | Hy sinh, đổi mạng, hồi sinh | Hồn, thế quân đông |

Cả bốn tộc cần có đường lội ngược dòng riêng và điểm yếu để bị khắc chế.

---

## 11. Bốn tộc

### 11.1 Rồng tộc — sức mạnh áp đảo

**Chủ đề:** những kẻ thống trị bằng sức mạnh thuần túy. Màu chủ đạo đỏ và vàng kim. Trực quan: vảy, móng, lửa (chỉ là hình ảnh, không có hiệu ứng ô lửa trên bàn).

**Điểm yếu — Long Tham:** mỗi quân chiến đấu Rồng tộc (mọi quân trừ Dân) **giá +1 thực**. Rồng mạnh nhưng phải nuôi tốn kém, nên cần nhiều nông dân hơn tộc khác.

**Nội tại (chọn 1):**

| Nội tại | Hiệu ứng |
|---|---|
| **Long Giáp** | Đội chiến đấu Rồng giảm 1 sát thương từ đòn đầu tiên nhận mỗi vòng; tổng giảm từ Long Giáp và Giáp Vảy tối đa 2. |
| **Cuồng Huyết** | Đội Rồng từ 4 quân trở lên +1 Movement. |
| **Long Nộ** | Khi đội mất ít nhất 1 quân do địch, đòn kế tiếp +1 damage; không cộng dồn; hết sau khi đánh hoặc cuối lượt kế tiếp của chủ. |

**Kích hoạt (dùng được từ Đời I):**

| Kích hoạt | Hồi | Hiệu ứng |
|---|---|---|
| **Long Lực** | 3 | Một đội: đòn kế tiếp trong lượt +50% sát thương cơ bản, làm tròn lên; chỉ một đòn. |
| **Long Uy** | 4 | Chọn 1 đội cận chiến: trong lượt này, sau khi **chiếm ô thành công**, đội đó được **đánh thêm 1 đòn** (không di chuyển thêm). |
| **Long Hống** | 5 | Chọn đội Rồng: đội địch phạm vi 2 bị −1 damage ở đòn đầu trong lượt kế tiếp của họ (tối thiểu 1). |

**Đặc điểm riêng từng quân:**

| Quân | Đặc điểm Rồng tộc |
|---|---|
| Dân | **1 HP, đánh được như Lính** (cận chiến 1 ô, 4 hướng). |
| Lính | **Long Binh:** cận chiến cả **8 hướng** (kể cả chéo). |
| Cung thủ | **Tên Xuyên Giáp:** sát thương dư sau khi diệt mục tiêu tràn sang quân liền phía sau. |
| Thuẫn binh | **Giáp Vảy:** giảm 1 damage từ đòn đầu tiên nhận mỗi vòng. |
| Kỵ binh | **Xung Phong:** đi đủ 3 ô rồi đánh thì +1 sát thương. |
| Thích khách | **Long Trảo:** +1 sát thương lên **quân tầm xa** (Cung thủ, Pháp sư, Công thành). |
| Pháp sư | **Long Tức:** tầm chéo tối đa **3 ô**. |
| Công thành | **Phun Lửa:** khi đòn chính gây damage, chọn một đội địch kề mục tiêu nhận 1 damage; không lan tiếp. |
| Chiến xa | **Va Chạm:** đòn đánh **đẩy lùi** mục tiêu còn sống 1 ô theo hướng đánh (nếu ô phía sau trống). |
| Thần thú | **Cự Long:** bay, bỏ qua vật cản khi di chuyển. |
| Chỉ Huy | **Chiến Hống:** hào quang áp dụng cho cả ô chéo (8 hướng). |
| Tượng binh | **Long Tượng:** không bị đẩy; +1 damage khi đánh đội có ít nhất 3 quân. |

**Lối chơi gợi ý:** dựng nông dân đủ sớm vì giá quân đắt, rồi dồn nhóm Rồng 4–6 quân, dùng Long Lực + Long Uy để quét liên tục. Chiến thắng thường đến từ việc diệt Vua bằng một chuỗi hành động liên tiếp.

**Cách khắc chế:** Công thành bắn từ xa, nhóm Thuẫn binh chặn Cung thủ Rồng, và kéo dài ván khi Rồng thiếu thực.

### 11.2 Nhân tộc — thương nhân, tiền đổi thành sức mạnh

**Chủ đề:** thương nhân và đế quốc buôn bán. Màu xanh dương và trắng bạc. Không có quân mạnh bẩm sinh nhưng có tài nguyên để mua mọi thứ, kể cả quân của đối thủ.

**Điểm yếu — Chi Tiêu Thuần:** quân chiến đấu Nhân tộc **không có đòn hiểm hay chỉ số vượt trội**. Mọi sức mạnh phải mua bằng tài nguyên, nên người chơi nghèo thì Nhân tộc rất yếu.

**Nội tại (chọn 1):**

| Nội tại | Hiệu ứng |
|---|---|
| **Lãi Suất** | Cuối lượt, mỗi 10 vàng đang giữ sinh 1 vàng, tối đa 3; ngừng từ lượt 40. |
| **Chợ Trời** | Đổi tài nguyên **2:1** (2 tài nguyên bất kỳ lấy 1 tài nguyên bất kỳ), trong pha mua hoặc cửa sổ COMMAND, không chen giữa resolution. |
| **Hợp Đồng Bao Thầu** | Quân đầu tiên mua mỗi lượt giảm 1 tài nguyên có trong giá, tổng giá tối thiểu 1. |

**Kích hoạt (dùng được từ Đời I):**

| Kích hoạt | Hồi | Hiệu ứng |
|---|---|---|
| **Tài Trợ Chiến Tranh** | 3 | Trả 3 tài nguyên bất kỳ: một đội +1 damage cho đòn kế tiếp trong lượt. |
| **Hối Lộ** | 4 | Quân địch lẻ kề quân Nhân, giá trị cơ bản ≤7; không Vua/Thần thú/Chỉ Huy. Trả 2× giá trị cơ bản bằng V/T/G tùy chia. Đổi chủ, giữ loại, áp dụng đặc tính Nhân, nghỉ tới lượt kế; không tạo thưởng/Hồn. |
| **Thu Thuế** | 6 | Mỗi đối thủ mất 1 loại tài nguyên họ đang có nhiều nhất và bạn nhận nó; hòa thì họ chọn; không có tài nguyên thì bỏ qua; loại trừ đồng đội. |

**Đặc điểm riêng từng quân:**

| Quân | Đặc điểm Nhân tộc |
|---|---|
| Dân | **Đổi nghề** miễn phí 1 lần mỗi lượt (thợ mỏ, nông dân, tiều phu tùy ý). |
| Lính | **Dân Binh:** giá **2 tài nguyên bất kỳ** (rẻ và linh hoạt). |
| Cung thủ | **Săn Thưởng:** kết liễu cả đội Dân nhận thêm 1 tài nguyên đúng nghề, ngoài thưởng HP. |
| Thuẫn binh | **Hộ Tống:** chọn một đội Dân kề (4 hướng) không thể bị chọn làm mục tiêu tấn công tầm xa; bảo vệ không chặn sát thương lan. |
| Kỵ binh | **Thương Kỵ:** cuối lượt đứng trên ô tài nguyên giữa bàn thì thu **1 tài nguyên** loại đó. |
| Thích khách | **Sát Thủ Thuê:** kết liễu cả đội nhận thêm 1 tài nguyên tùy chọn, tối đa 1 lần/lượt/người chơi. |
| Pháp sư | **Phép Tạm Ứng:** trả 2V trước hành động để đánh thêm một đòn sau đòn chính, đòn thêm −1 damage (tối thiểu 1); tối đa 1 lần/đội/lượt, mục tiêu còn trong tầm. |
| Công thành | **Công Xưởng:** giảm 1G trong giá. |
| Chiến xa | **Thương Xa:** chở tối đa **2 Dân** đi cùng. |
| Thần thú | **Kỳ Lân Vàng:** +2V đầu lượt nếu còn sống, ngừng từ lượt 40. |
| Chỉ Huy | **Điều Binh:** COMMAND, trả 2V: một đội Nhân kề Chỉ Huy dịch chuyển 1 ô theo 4 hướng tới ô trống, giữ cờ đã hành động; không đánh/gộp. Tối đa 1 lần/lượt/người chơi, không Vua hoặc đội nghỉ; không dùng xuyên quân/vượt ô cắt. |
| Tượng binh | **Phá Trận:** trả 2G trước hành động của đội Tượng: nếu đòn kế gây damage và mục tiêu còn sống, đẩy nó 1 ô theo hướng đánh nếu ô sau tồn tại và trống. Không đẩy Vua hoặc mục tiêu miễn đẩy; hết cuối lượt; tối đa 1 lần/đội/lượt. |

**Lối chơi gợi ý:** kinh tế rộng, nhiều dân trên các ô x2, tích vàng lấy lãi, rồi dùng Tài Trợ Chiến Tranh và Phép Tạm Ứng để biến vàng thành sát thương đúng thời điểm. Hối Lộ biến quân đối thủ thành quân của mình ngay giữa trận. Thu Thuế gây áp lực tài nguyên lên mọi người.

**Cách khắc chế:** bắt đầu quấy rối sớm khi Nhân tộc chưa có quân tinh nhuệ, săn Dân đứng ngoài, và tránh để Hối Lộ chạm quân lẻ giá trị cao (đi theo đội).

### 11.3 Tiên tộc — nhanh nhạy, tốc độ và tầm đánh

**Chủ đề:** các sinh linh siêu nhiên, ẩn hiện, bay lượn và điều khiển không gian. Màu ngọc bích và bạc. Điểm mạnh là vị trí và tầm xa, điểm yếu là không chịu nổi đội hình đông.

**Điểm yếu — Mong Manh:** mỗi đội Tiên tộc tối đa **3 quân** (thay vì 6) và **Vua Tiên chỉ đi 1 ô**.

**Nội tại (chọn 1):**

| Nội tại | Hiệu ứng |
|---|---|
| **Linh Động** | Hành động đầu tiên mỗi lượt, nếu đội được chọn có đúng 1 quân, +1 Movement cho hành động đó; không thêm action, không áp dụng Vua. |
| **Tiên Phong** | Quân mới mua có thể dùng hành động để di chuyển ngay; không đánh, không gộp đội cũ trong lượt mua. |
| **Gió Thuận** | Quân chiến đấu Tiên +1 Movement, không áp dụng Dân hoặc Vua. |

**Kích hoạt (dùng được từ Đời I):**

| Kích hoạt | Hồi | Hiệu ứng |
|---|---|---|
| **Linh Nhãn** | 3 | Một đội tầm xa +1 range, bỏ qua tối đa một ô có quân chắn đường trong lượt; không xuyên vô hạn. |
| **Hoán Vị** | 3 | Đổi chỗ hai đội Tiên cách nhau ≤3; không chọn Vua. Giữ nguyên nghỉ, đã hành động và mọi trạng thái. |
| **Thiên Mạc** | 6 | Một đội Tiên: đòn tấn công đầu nhắm vào đội gây 0 damage, rồi mất khiên; hết ở đầu lượt tiếp theo của chủ. Không chặn hy sinh hoặc sát thương phụ không nhắm trực tiếp. |

**Đặc điểm riêng từng quân:**

| Quân | Đặc điểm Tiên tộc |
|---|---|
| Dân | Đi tối đa **2 ô**. |
| Lính | **Du Kích:** đánh không diệt hết mục tiêu thì được lùi 1 ô ngược hướng đánh, nếu ô trống hợp lệ; không gộp. |
| Cung thủ | Tầm thẳng tối đa **3 ô** (thay vì 2). |
| Thuẫn binh | **Hộ Pháp:** đội kề giảm 1 damage tầm xa ở đòn đầu nhận mỗi vòng; không cộng dồn nhiều Hộ Pháp. |
| Kỵ binh | **Phi Mã:** đi xuyên quân. |
| Thích khách | **Ảnh Bộ:** thay vì nhảy chữ L, có thể **nhảy vào ô trống kề quân Tiên bất kỳ** của ta. |
| Pháp sư | **Linh Quang:** tầm chéo tối đa 2 ô, **thêm** đánh thẳng 1 ô (4 hướng). |
| Công thành | **Thiên Lôi:** tầm thẳng tối đa **4 ô**; đã di chuyển **vẫn bắn được** (không nhân đôi sát thương). |
| Chiến xa | **Phong Xa:** đi xuyên quân. |
| Thần thú | **Phượng Hoàng:** bay, tối đa 4 ô, **2 HP**. |
| Chỉ Huy | **Quân Sư:** hào quang cho đội tầm xa kề thêm **+1 ô tầm đánh**. |
| Tượng binh | **Tượng Vân:** đi tối đa 3 ô, xuyên quân. |

**Lối chơi gợi ý:** đội nhỏ cơ động, Hoán Vị đổi vị trí, Linh Nhãn mở đường bắn và Thiên Mạc chống một đòn. Số hành động vẫn tuân theo Đời.

**Cách khắc chế:** gây sát thương lên diện tích rộng (Công thành), dồn đội đông chặn đường, và tập kích Vua Tiên vì Vua chỉ đi 1 ô.

### 11.4 Quỷ tộc — hy sinh, đổi mạng, hồi sinh

**Chủ đề:** quân đoàn bóng tối, sống bằng cái chết. Màu tím và đen. Càng chết nhiều, Quỷ càng mạnh nhờ Hồn.

**Cơ chế nền — Hồn:** đây là tài nguyên riêng của Quỷ. **Mỗi quân Quỷ bị diệt cho 1 Hồn, mỗi death_id đúng một lần; Hiến Tế thay tổng bằng 2 Hồn** (mọi nội tại đều có cơ chế này). Quỷ tộc bắt đầu với **1 Hồn**. Hồn dùng cho Lời Nguyền, Tái Sinh, Hồn Pháo và các hiệu ứng khác.

**Điểm yếu:** **Vua Quỷ chỉ đi 1 ô**, dễ bị săn.

**Nội tại (chọn 1):**

| Nội tại | Hiệu ứng |
|---|---|
| **Oán Hồn** | COMMAND: tùy chọn trả 3 Hồn tạo 1 Lính Quỷ tại ô spawn trống, nghỉ; không tự triệu hồi. Có thể dùng nhiều lần nếu đủ Hồn và ô. |
| **Đoạt Sinh** | Khi đội Quỷ cận chiến diệt cả đội địch và thực sự chiếm ô, thêm 1 quân cùng loại vào chính đội chiếm ô, vượt giới hạn 6, không có trần. CD chung 3 lượt cá nhân (tham số thử nghiệm); xem đặc tả dưới bảng. |
| **Tái Sinh** | COMMAND: trả 3 Hồn hồi quân Quỷ hợp lệ chết gần nhất trong vòng hiện tại hoặc vòng trước, giá trị cơ bản ≤7; không Vua/Thần thú/Chiến xa/Tượng/Chỉ Huy. Spawn trống, nghỉ. Mỗi death_id chỉ hồi một lần. |

**Đặc tả Đoạt Sinh và đội vượt giới hạn:**

- Đây là nội tại chọn trước trận, có hồi chiêu riêng để đáp ứng yêu cầu tăng quân có CD. CD 3 là đề xuất triển khai, có thể chỉnh qua BalanceConfig. Lần đầu sẵn sàng; khi trigger ở lượt t thì dùng lại từ t+3; chung cho toàn phe, không phải từng đội.
- Chỉ đội sống sót, có khả năng cận chiến, không phải Vua/Thần thú/Chỉ Huy, kết liễu trực tiếp và chiếm ô mới hợp lệ. Bắn chết, sát thương lan, Huyết Tế, đẩy lùi, đi vào ô trống hoặc chọn không chiếm không kích hoạt.
- +1 **cùng loại**: Kỵ tăng Kỵ, Tượng tăng Tượng, Lính tăng Lính. Đây là thêm đơn vị 1 HP, không hồi máu. Quân mới thừa hưởng đã hành động và trạng thái của đội; không tạo action mới.
- Đội 6 → 7 → 8… có HP và sát thương cơ bản bằng số quân hiện có, được lên 10/20/30 hoặc cao hơn. Không tự mất phần vượt 6 khi di chuyển, đổi lượt hoặc chịu sát thương.
- Không dùng mua/gộp để tăng đội vượt 6. Tách tự chọn số quân, bảo toàn tổng; phần >6 giữ quyền tồn tại nhưng không được gộp thành đội >6. CD theo người chơi nên tách/gộp không reset hoặc nhân bản CD.
- Đoạt Sinh chỉ kiểm tra sau phản sát thương, chiếm ô và lựa chọn quay về; đội chết hoặc quay về không được cộng quân. Quân tăng không sinh ra hồi tố cho đòn vừa đánh.

**Kích hoạt (dùng được từ Đời I):**

| Kích hoạt | Hồi | Hiệu ứng |
|---|---|---|
| **Lời Nguyền** | 3 | Trả 1 Hồn, chọn đội địch: hành động đầu ở lượt kế của họ không được đánh sau khi di chuyển; vẫn được đứng yên đánh. |
| **Huyết Tế** | 4 | Hy sinh 1 quân Quỷ không phải Vua/Thần thú để gây 2 damage lên đội địch phạm vi 2 của quân hy sinh. Cho 1 Hồn cơ bản, không thưởng cho đối thủ. |
| **Hấp Hồn** | 5 | Một đội Quỷ: lần đầu diệt hoàn toàn đội địch trong lượt tạo tối đa 2 Lính Quỷ tại ô mục tiêu nếu trống hoặc ô trống kề; mỗi ô tạo 1, nghỉ. Không áp dụng Vua; giữ thưởng kết liễu. |

**Đặc điểm riêng từng quân:**

| Quân | Đặc điểm Quỷ tộc |
|---|---|
| Dân | **Hiến Tế:** COMMAND, hy sinh một Dân để nhận đúng 2 Hồn tổng cộng, không tài nguyên, không cộng thêm 1 Hồn cơ bản hoặc Hồn Soái. Không tốn action; được chọn Dân nghỉ; chết do kỹ năng khác không kích hoạt Hiến Tế. |
| Lính | Giá **−1** (còn 1V 1T). |
| Cung thủ | **Ma Tiễn:** sau khi bắn được **di chuyển thêm 1 ô**. |
| Thuẫn binh | **Phản Oán:** khi cả đội bị diệt, **kẻ diệt nhận 1 sát thương**. |
| Kỵ binh | **Dạ Kỵ:** kết liễu cả đội địch +1 Hồn, tối đa 1/action. |
| Thích khách | **Bóng Ma:** sau đánh có thể trở về ô bắt đầu hành động nếu ô vẫn trống; nếu vừa chiếm ô rồi quay về thì không kích hoạt Đoạt Sinh. |
| Pháp sư | **Nguyền Yếu:** mục tiêu sống sót −1 damage cho đòn kế tiếp (tối thiểu 1); hết cuối lượt kế của chủ mục tiêu. |
| Công thành | **Hồn Pháo:** trước hành động trả 1 Hồn để đòn kế +2 damage, tối đa 1 lần/action. |
| Chiến xa | **Quỷ Xa:** sau khi **chiếm ô** thành công, đi thêm **2 ô**. |
| Thần thú | **Ma Vương:** khi chết tạo tối đa 2 Lính Quỷ tại ô trống kề, nghỉ. |
| Chỉ Huy | **Hồn Soái:** cái chết Quỷ đầu tiên trong phạm vi 2 mỗi vòng +1 Hồn, giới hạn chung/người chơi; không áp dụng Hiến Tế. |
| Tượng binh | **Tượng Xương:** khi bị diệt hết, để lại **1 Lính Quỷ** miễn phí tại ô đó. |

**Lối chơi gợi ý:** hy sinh quân rẻ (Dân, Lính) để tích Hồn, rồi dùng Hấp Hồn đổi thế trận, Lời Nguyền hạn chế vừa đi vừa đánh của đội đối thủ, Huyết Tế ép trao đổi có lợi. Tái Sinh hoặc Oán Hồn giữ lực lượng liên tục.

**Cách khắc chế:** săn Vua Quỷ vì chỉ đi 1 ô, tránh đổi mạng nhiều (đối thủ thường chết nhiều hơn mà vẫn mạnh lên), và diệt quân ở ngoài tầm Huyết Tế.

---

## 12. Chế độ 2, 3, 4 người

### 12.1 Chế độ 2 người

Bàn 8x8. Cân bằng gần với cờ vua nên là chế độ chuẩn để playtest luật. Phe đi trước có lợi thế tempo nhỏ, bù bằng cách **phe đi sau +1 vàng khởi đầu** (đề xuất, xem 14.6).

### 12.2 Chế độ 3 người

Bàn chữ thập 14x14 với cánh Hoang Địa. Hai tuyến tấn công: phe đối diện cánh trống chịu hai mặt, nhận **+2 vàng khởi đầu** hoặc bốc thăm chỗ ngồi ngẫu nhiên. Vì không có cân bằng hoàn hảo, nên người chơi có thể thỏa thuận thay vì dùng luật bù.

### 12.3 Chế độ 4 người (hỗn chiến)

Mỗi người một cánh. Mỗi người có hai hàng xóm kề và một đối thủ đối diện. Kingmaker (người sắp thua quyết định ai thắng) là rủi ro thiết kế chính, nên:
- Người diệt Vua nhận 3 tài nguyên làm động lực săn Vua trực tiếp.
- Quân của người thua biến mất khỏi bàn, tránh để đống quân vô chủ làm rối bàn.
- Cấm thương lượng chia thưởng ngoài luật nếu chơi giải đấu.

### 12.4 Chế độ 2v2 (đồng đội)

4 người chia hai đội, ngồi đối diện nhau là đồng đội (Bắc với Nam, Đông với Tây).
- Đồng đội **không đánh nhau** và quân đồng đội **không cản đường** (được đi xuyên qua nhau, không gộp).
- Thắng khi cả hai Vua đối phương bị diệt. Thua khi cả hai Vua của đội bị diệt.
- Khi Vua đồng đội chết, quân của người đó biến mất nhưng đồng đội vẫn tiếp tục chiến đấu.
- Thu Thuế không áp dụng cho đồng đội. Hối Lộ không áp dụng cho quân đồng đội.
- Đồng đội **không** chia tài nguyên trực tiếp (giữ độc lập kinh tế). Có thể trao đổi bằng cách bố trí quân hợp lý.

---

## 13. Ví dụ minh họa

### 13.1 Ví dụ 2 người: mở màn (Rồng và Quỷ)

Phe A (Rồng, nội tại Long Giáp, ô nhà chọn Thực) đi trước. Phe B (Quỷ, nội tại Oán Hồn, ô nhà chọn Gỗ).

**Lượt 1 Phe A:** thu hoạch +1 vàng (11 vàng). Mua 5 dân (10 vàng): 2 thợ mỏ, 2 nông dân, 1 tiều phu. Còn 1 vàng. Tất cả dân nghỉ. Đời I chỉ có 1 hành động, và vì dân còn nghỉ nên hành động được dùng để đi Vua hoặc bỏ qua.

**Lượt 1 Phe B:** thu hoạch +1 vàng (11 vàng). Chưa có thực hay gỗ nên chưa mua được quân chiến đấu (Lính Quỷ cần 1V 1T). Mua 5 dân (10 vàng), còn 1 vàng.

**Lượt 2 Phe A:** thu hoạch 1 vàng cơ bản + 2 vàng (thợ mỏ) + 2 thực (nông dân) + 1 gỗ (tiều phu), cộng với 1 vàng còn lại thành 4 vàng, 2 thực, 1 gỗ. Dùng 1 hành động đi 1 nông dân lên ô nhà (thực): từ lượt sau, nông dân đó thu x2.

Các lượt sau tiếp tục mở rộng. Phe nào lên Đời II sớm nhận hành động thứ hai.

### 13.2 Ví dụ trận đánh: sát thương theo số quân

Đội Rồng 4 Lính (Đời II, 2 hành động) đứng cạnh đội Quỷ 3 Lính.
- Phe Rồng dùng **Long Lực** (không tốn hành động): đội 4 Lính gây +50% sát thương.
- Hành động 1: đội 4 Lính cận chiến đội 3 Lính Quỷ. Sát thương cơ bản 4, +50% = 6, đội Quỷ chỉ có 3 HP, dư 3 bị mất. Cả đội Quỷ bị diệt, Phe Rồng nhận 3 tài nguyên (1 mỗi quân), cận chiến nên có thể chiếm ô. Phe Quỷ nhận 3 Hồn (đủ Oán Hồn có thể trả 3 Hồn tại cửa sổ COMMAND tiếp theo để tạo 1 Lính Quỷ ở spawn trống).
- Nếu dùng **Long Uy** trước đó, đội Rồng chiếm ô xong đánh thêm 1 đòn vào mục tiêu kề tiếp.

### 13.3 Ví dụ kinh tế và Tài Trợ Chiến Tranh

Phe Nhân (Đời II) có 3 đội, mỗi đội 2 Lính, cần phá đội Cung thủ 4 quân của đối thủ. Dùng **Tài Trợ Chiến Tranh** (3 tài nguyên): đòn kế tiếp của một đội được +1 sát thương. Đội 2 Lính đánh Cung thủ: sát thương 2+1 = 3, mục tiêu mất 3 quân còn 1. Hai đội còn lại đánh nốt.

### 13.4 Ví dụ Hấp Hồn

Phe Quỷ có đội 3 Kỵ binh. Dùng **Hấp Hồn** (cường hóa đội): đội gây 3 sát thương lên đội 3 Lính địch kề. Cả đội 3 HP bị diệt, tạo tối đa 2 Lính Quỷ mới ở ô hợp lệ (nghỉ). Phe Quỷ nhận thêm 3 tài nguyên thưởng.

---

### 13.5 Đoạt Sinh vượt 6 và Hiến Tế

Đội 6 Kỵ Quỷ có Đoạt Sinh sẵn sàng, tiêu diệt cả đội 2 HP và chọn chiếm ô: thưởng 2 tài nguyên, Dạ Kỵ +1 Hồn; Đoạt Sinh tăng đội thành 7 Kỵ = 7 HP, damage cơ bản 7. Dùng ở lượt 10 → sẵn sàng lượt 13. Đội tiếp tục sống/chiếm mục tiêu ở các lần sẵn sàng có thể tăng tới 10/20/30, không đặt trần. Diệt mục tiêu nhưng không chiếm hoặc đang CD thì không tăng.

Một Dân Quỷ tự Hiến Tế: mất một quân, +2 Hồn tổng cộng, +0 tài nguyên, +0 Hồn cơ bản bổ sung, đối thủ +0 thưởng. Dân bị Huyết Tế hy sinh cho 1 Hồn cơ bản, không tự nhận 2 Hồn Hiến Tế.

### 13.6 Tiêu kinh tế để tạo vị trí

Chỉ Huy Nhân trả 2V Điều Binh đưa một đội Cung kề sang ô trống một ô, giữ trạng thái hành động. Nếu Cung chưa hành động, sau đó có thể dùng action bình thường; nếu đã hành động, không được đánh lại. Tượng Nhân trả 2G, đánh mục tiêu 4 HP bằng đội 2 Tượng: mục tiêu còn 2 HP, ô sau trống nên bị đẩy; không thưởng và không chiếm ô. Đây là hai cách tiêu tài nguyên cho vị trí thay vì tạo thu nhập mới.

---

## 14. Cân bằng, tham số và kế hoạch playtest

### 14.1 Bảng tham số có thể chỉnh

| Tham số | Giá trị khởi điểm | Ghi chú |
|---|---|---|
| Vàng khởi đầu | 10 | Ảnh hưởng nhịp mở màn |
| Vàng cơ bản mỗi lượt | 1 | |
| Giá dân | 2V | Đã chốt |
| Giới hạn mua/gộp thường | 6 | Tiên 3; Đoạt Sinh tăng không có trần |
| Hành động theo đời | 1 / 2 / 3 / 4 | Đã chốt |
| Chi phí lên đời | 8 / 20 / 40 | Tham số cân bằng quan trọng nhất |
| Lượt miễn chiến | 3 | |
| Bắt đầu Suy Tàn | 40 | Dân chỉ thu trên ô đúng nghề |
| Thưởng kết liễu thường | HP trước hiệu ứng gây chết | Không thưởng từng quân bị mất |
| Thưởng diệt Vua | 3 | |
| Hồi chiêu kích hoạt | 2 đến 6 lượt | Xem từng tộc |
| Tiên: giới hạn đội | 3 | |
| Chỉ số quân | Theo mục 7.1 | |

### 14.2 Mối quan tâm cân bằng chính

1. **Sát thương theo số quân làm đội đông thắng đội ít.** Đây là quyết định thiết kế đã chốt, và vì game theo lượt nên đội ít quân đánh trước vẫn gây sát thương trước. Giới hạn mua/gộp thường là 6; Đoạt Sinh là ngoại lệ phải theo dõi riêng. Theo dõi tỉ lệ thắng của chiến thuật dồn quân.
2. **Tốc độ lên đời tạo hiệu ứng lăn bóng tuyết.** Lên đời sớm cho nhiều hành động hơn. Giữ chi phí lên đời đủ cao để không phải ai cũng lên ngay lượt 3.
3. **Mua không giới hạn và dân không giới hạn** tạo ra chiến lược "tất cả vào dân". Chốt chặn: ba lượt miễn chiến chỉ là bảo vệ ngắn hạn; Chiến xa ở Đời IV rất xa; quân Đời I–II đủ để săn dân lơ là.
4. **Dân Rồng đánh được** làm Rồng có thể vừa làm kinh tế vừa đánh. Điểm yếu Long Tham (+1 thực mỗi quân chiến đấu) là bù.
5. **Đời I chỉ 1 hành động** nên người chơi lên Đời II rất sớm. Cần xem tỉ lệ lên Đời II ở lượt mấy.

### 14.3 Ma trận tộc (định tính)

| | Rồng | Nhân | Tiên | Quỷ |
|---|---|---|---|---|
| **Rồng** | — | Rồng thắng nếu chặn kinh tế sớm | Rồng cần nhóm đông để thắng tốc độ Tiên | Rồng bị đổi mạng nhưng thắng bằng uy lực |
| **Nhân** | Nhân thắng nếu sống đến Đời III | — | Nhân thắng bằng Hối Lộ quân lẻ | Nhân hưởng lợi khi Quỷ bị kéo dài |
| **Tiên** | Tiên quấy rối và kéo dài | Tiên vòng qua phòng tuyến | — | Tiên bắn từ xa trước Hồn |
| **Quỷ** | Quỷ đổi mạng để chờ Hồn | Quỷ khóa Nhân bằng Lời Nguyền | Quỷ cần tầm xa để chặn Tiên | — |

Đây chỉ là giả thuyết để kiểm chứng bằng mô phỏng.

### 14.4 Các điểm cần theo dõi đặc biệt

Đoạt Sinh: quân tối đa/đội, số lần trigger, CD, sát thương và kết quả khi đạt 10/20/30. Điều Binh/Phá Trận: số lần dùng, tài nguyên tiêu, vị trí tạo được và tỷ lệ thắng. Kỳ Lân +2V, thưởng kết liễu theo HP còn lại, Hấp Hồn tạo tối đa 2, Hối Lộ giá trị ≤7, hiệu quả khiên một đòn, khai thác tách/gộp và trạng thái nghỉ.

### 14.5 Kế hoạch mô phỏng

Lõi headless → test luật → bot ngẫu nhiên/heuristic → 1v1 alpha → người thật. Theo dõi tộc × tộc, nội tại × nội tại, đi trước, bản đồ, trung vị độ dài ván, thời điểm lên đời, kinh tế/quân số mỗi lượt, action có/dùng, sát thương và kill theo loại, cast/giá trị skill, áp lực Vua và khả năng lội ngược sau bất lợi quân/kinh tế. Mục tiêu kiểm tra: overall 47–53%, matchup lý tưởng 40–60%; luôn kèm cỡ mẫu và khoảng tin cậy, không xem bot winrate là chứng minh game vui hoặc cân bằng hoàn chỉnh.

### 14.6 Các đề xuất tùy chọn để bạn quyết định

- Phe đi sau +1 vàng khởi đầu (2 người).
- Chợ chung: ai cũng đổi tài nguyên 3:1 (Nhân tộc có 2:1 nhờ Chợ Trời).
- Thưởng diệt quân gấp đôi cho quân giá từ 8 trở lên.
- Lượt 80 tính điểm (mục 9.4).

---

## 15. Triển khai đa nền tảng

### 15.1 Nguyên tắc kiến trúc

**Một bộ luật, nhiều giao diện.** Luật chơi được viết thành một **lõi luật thuần logic**, độc lập hoàn toàn với đồ họa và mạng. Các nền tảng chỉ khác nhau ở lớp hiển thị và lớp kết nối.

```
+------------------------------------------------------+
|  Lớp hiển thị (PC / Mobile / Web / bản in boardgame) |
+------------------------------------------------------+
|  Lớp mạng và lưu trữ (online, lượt dài, replay)      |
+------------------------------------------------------+
|  LÕI LUẬT (thuần logic, xác định, có thể kiểm tra)   |
+------------------------------------------------------+
```

### 15.2 Lõi luật

- **Trạng thái ván** là một cấu trúc dữ liệu thuần (có thể tuần tự hóa thành JSON): bàn, quân, đội, tài nguyên, đời, hồi chiêu, lượt, tộc và nội tại.
- **Lệnh** là các hành động nhỏ có kiểm tra hợp lệ: `mua(loại, ô)`, `lên_đời`, `di_chuyển(đội, đường)`, `tấn_công(đội, mục_tiêu)`, `tách(đội, k)`, `gộp`, `kích_hoạt(kỹ_năng, đối_số)`, `kết_thúc_lượt`.
- Hàm cốt lõi: `áp_dụng(trạng_thái, lệnh) → trạng_thái_mới hoặc lỗi`.
- **Xác định:** game không có yếu tố ngẫu nhiên khi chiến đấu. Ngẫu nhiên chỉ có ở lúc bốc ô tài nguyên, dùng **seed** để tái hiện được.
- **Nhật ký lệnh** (seed + chuỗi lệnh) đủ để phát lại toàn bộ ván: dùng cho replay, kiểm tra gian lận, báo lỗi.

### 15.3 Bản online (PC, mobile, web)

- **Engine:** Godot 4 xuất được cho Windows, macOS, Linux, Android, iOS và HTML5. Với bản web nên viết lõi luật bằng **GDScript** để bảo đảm xuất web được (việc C# xuất web trong Godot 4 phụ thuộc phiên bản, cần kiểm tra phiên bản hiện hành trước khi chọn C#).
- **Bản thử nghiệm 1.2 (đã làm):** webgame HTML5 thuần + Firebase Realtime Database theo mô hình *sổ lệnh không trọng tài* — mỗi máy chạy cùng lõi luật xác định, Firebase chỉ giữ thứ tự lệnh và quyền ghi. Chi tiết ở mục 19. Mô hình máy chủ trọng tài bên dưới vẫn là đích cho bản thương mại/xếp hạng.
- **Máy chủ làm trọng tài (server-authoritative):** client gửi lệnh, máy chủ chạy cùng lõi luật để kiểm tra và cập nhật trạng thái rồi phát lại cho mọi người chơi. Tránh gian lận và đồng bộ lệch.
- **Kết nối:** WebSocket cho mọi nền tảng, vì bản web chỉ dùng được WebSocket hoặc WebRTC.
- **Chế độ lượt dài (bất đồng bộ):** mỗi lượt có thời hạn (ví dụ 24 giờ), thông báo đẩy khi tới lượt. Rất hợp với game cần suy nghĩ.
- **Chế độ thời gian thực theo lượt:** đồng hồ lượt (ví dụ 90 giây mỗi lượt cộng thời gian dự phòng).
- **Chơi chung giữa các nền tảng (cross-play):** cùng lõi luật nên cho phép PC, mobile và web chơi cùng bàn.
- **Hot-seat:** nhiều người chơi chung một máy.
- **Bot:** trí tuệ nhân tạo đơn giản (heuristic) để chơi đơn, luyện tập và làm đối thủ khi thiếu người. Cùng lõi luật sinh ra mọi lệnh hợp lệ cho bot chọn.
- **Phát lại và hoàn tác trong lượt:** cho phép hoàn tác hành động chưa kết thúc lượt, vì lõi luật thuần logic dễ lưu và khôi phục.

### 15.4 Giao diện người chơi

- **Chọn quân** hiện ô có thể đi (xanh) và ô có thể đánh (đỏ), tính cả chặn đường.
- **Xem trước kết quả:** khi chọn mục tiêu hiện số sát thương, quân sẽ bị diệt và thưởng nhận được.
- **Biểu tượng số quân** trên đội (không chặn ở 6; đội vượt giới hạn có số đếm riêng), thanh HP cho quân nhiều HP.
- **Bảng tài nguyên** luôn hiển thị vàng, thực, gỗ, Hồn (Quỷ), đời hiện tại, số hành động còn lại.
- **Thanh kỹ năng** với 3 kích hoạt (hiển thị hồi chiêu như Q/W/E), nội tại ở bên cạnh.
- **Bản đồ thu nhỏ** cho bàn 14x14 trên mobile, phóng to khi cần.
- **Cảnh báo nguy hiểm:** ô mà Vua có thể bị đánh, đội sắp bị diệt.
- **Mobile:** chạm để chọn, chạm lần hai để đi, kéo để tách đội. Tối ưu cho thao tác bằng một tay.

### 15.5 Bản boardgame ngoài đời

**Thành phần:**
- **Bàn:** tấm 8x8 và 4 cánh gài rời (3x8) để lắp bàn chữ thập 14x14.
- **Quân:** token (đứng acrylic hoặc gỗ) cho từng loại quân của mỗi tộc, ba nghề dân phân biệt bằng màu đáy.
- **Đếm HP và số quân của đội:** viên xúc xắc d6 đặt cạnh đội hoặc đế token xoay số (đội thường tối đa 6; đội Đoạt Sinh dùng bộ đếm số nhiều chữ số).
- **Token tài nguyên:** vàng, thực, gỗ (ba màu), kèm chip mệnh giá lớn (x5) để không phải dùng quá nhiều token. Token Hồn riêng cho Quỷ.
- **Thẻ tộc:** mỗi tộc một thẻ ghi điểm yếu, danh sách nội tại để chọn và 3 kích hoạt kèm hồi chiêu.
- **Bảng hồi chiêu:** đường đếm lượt cho 3 kích hoạt (đặt marker).
- **Bảng đời:** tracker Đời I đến IV kèm ghi chú số hành động.
- **Thẻ ô tài nguyên:** các đĩa hoặc thẻ úp để bốc ngẫu nhiên.
- **Bảng tra nhanh:** thẻ tóm tắt chỉ số quân cho mỗi người.
- **Sách luật:** bản rút gọn 4 trang và bản đầy đủ.

**Giới hạn thành phần:** dân là quân không giới hạn bằng luật, nên bản vật lý cần quy ước số token. Đề xuất mỗi nghề 18 token dân và 6 chip "x5 dân" (đại diện 5 dân gộp), khi hết token thì không mua thêm được.

**Thời lượng:** 2 người khoảng 40–50 phút, 4 người khoảng 60–75 phút. Dùng đồng hồ cát hoặc app đếm giờ 3 phút mỗi lượt cho người suy nghĩ chậm.

**Tương thích số hóa:** mọi quy tắc phải tính được bằng tay không cần máy tính, nhờ đó bản boardgame và bản số dùng chung sách luật.

### 15.6 Thiết lập ô ngẫu nhiên cho boardgame

- Bốc một số thẻ ô tương ứng với số ô ngẫu nhiên (6 cho bàn 2 người, 8 cho bàn 4 người), lật từng thẻ.
- Dùng **bảng mẫu đặt** (in sẵn): mỗi thẻ có hai hoặc bốn vị trí đối xứng, người chơi đặt theo bảng.
- Chế độ chọn tay (không bốc) dành cho người muốn chơi thể thao, thích hợp cho giải đấu.

### 15.7 Nghệ thuật và âm thanh (định hướng)

| Tộc | Màu | Hình ảnh gợi ý |
|---|---|---|
| Rồng | Đỏ, vàng kim | Vảy, móng, giáp rồng |
| Nhân | Xanh dương, trắng bạc | Cờ hiệu thương hội, áo giáp bạc, xe thồ |
| Tiên | Ngọc bích, bạc | Cánh mỏng, mây, ánh sáng |
| Quỷ | Tím, đen | Xương, sương, mắt phát sáng |

Phong cách tổng thể có thể là cổ phương Đông, nhất quán với chủ đề "châu quận huyện thành".

---

### 15.8 Đặc tả dữ liệu và engine triển khai

Lõi `state + command → new_state + events` độc lập giao diện; command không hợp lệ không thay state. Replay lưu ruleset_version, BalanceConfig snapshot/hash, seed và command log. Dùng số nguyên, có quy tắc làm tròn rõ; thứ tự sự kiện ổn định. Không hard-code từng tộc ở nhiều nơi; định nghĩa quân cơ sở + modifier tộc + ability_id.

| Dữ liệu | Trường tối thiểu |
|---|---|
| UnitDefinition | id, age, base_cost{V,T,G}, movement_pattern/range, attack_pattern/range, hp, tags, ability_ids |
| UnitInstance | id, owner_id, definition_id, hp_current, purchased_turn, acted_turn, origin, statuses |
| TeamState | id, owner_id, unit_type, cell, unit_ids, statuses; count = số unit_ids; HP = tổng hp_current |
| PlayerState | faction, passive_id, age, resources, souls, personal_turn, actions_remaining, ability_ready_turns, beast_purchased, per_turn/per_round_counters |
| AbilityDefinition | id, timing, target_filter, costs, cooldown_scope, cooldown, effects, expiry, trigger, limits |
| GameState | ruleset_version, config, seed, map_id, board, players, teams, active_player, phase, round, event_queue, next_event_id |
| DeathRecord | death_id, unit_id, owner, type, cell, cause, source_owner, round, soul_processed, revived |
| ResolutionContext | action_id, attack_id, source_team, target_team, target_hp_before, damage_final, target_destroyed, occupied_cell |

**BalanceConfig** (giá trị khởi điểm): starting_gold=10; base_gold_income=1; worker_cost=2V; stack_cap=6; fairy_stack_cap=3; actions_by_age=[1,2,3,4]; age_costs=[3V3T2G,7V7T6G,14V13T13G]; peace_turns=3; decline_turn=40; ranked_round_limit=80; king_reward=3; kill_reward_mode=remaining_hp_before_lethal_effect; dragon_large_team_threshold=4; human_interest_cap=3; commander_reposition_cost=2V; elephant_push_cost=2G; demon_growth_cooldown=3; demon_growth_amount=1; demon_growth_max=null; sacrifice_souls_total=2; soul_spawn_cost=3; absorb_spawn_max=2. Giá/cooldown từng ability lưu trong definition hoặc config override; chỉ có một nguồn dữ liệu giá trị.

Primitive: MOVE, ATTACK, DAMAGE, REDUCE_DAMAGE, ADD_RANGE, ADD_MOVE, PUSH, SWAP, SPAWN, KILL, GAIN_RESOURCE, SPEND_RESOURCE, GAIN_SOUL, SPEND_SOUL, CHANGE_OWNER, APPLY_STATUS, REMOVE_STATUS. Mỗi primitive có validate/resolve và emit_event. Status: RESTING, MOVE_ONLY, ENRAGED, CURSED, SHIELDED, WEAKENED, NEXT_ATTACK_BUFF. Cờ mua Thần thú và hồi chiêu Đoạt Sinh thuộc PlayerState, không thuộc token có thể tách/gộp.

Sự kiện tối thiểu: TURN_STARTED, INCOME_GRANTED, UNIT_PURCHASED, AGE_ADVANCED, ACTION_STARTED, TEAM_MOVED, ATTACK_RESOLVED, UNIT_DIED, TEAM_DESTROYED, RESOURCE_REWARDED, SOUL_GAINED, CELL_OCCUPIED, TEAM_GROWN, UNIT_SPAWNED, ABILITY_USED, PLAYER_ELIMINATED, TURN_ENDED. Mỗi sự kiện ghi source/cause và id; không xử lý một death_id hai lần. Quân triệu hồi chết sau này vẫn cho Hồn cơ bản; SPAWN không tự sinh death, không chạy chuỗi chết–spawn đệ quy trong cùng trigger.

**Thưởng kết liễu:** chụp `target_hp_before` ngay trước từng DAMAGE; nếu sau đó HP=0 và chưa trả thưởng cho destruction_id, thưởng = snapshot (Vua dùng 3). Thưởng thêm xử lý riêng. Không lưu tích lũy sát thương để trả thưởng sau này.

**Đoạt Sinh:** kiểm tra passive_id, ready_turn, đội còn sống, mục tiêu bị diệt trực tiếp bởi cận chiến, ô vừa diệt thực sự được đội chiếm và chưa rời; thêm instance cùng definition_id, 1 HP, cờ đã hành động; set ready_turn=t+CD. Không gọi validate mua/gộp để chặn tăng. Không reset CD khi đội chết, spawn hoặc tách.

**Spawn và thứ tự:** chỉ ô trống tồn tại; khi có nhiều lựa chọn, chủ hiệu ứng chọn bằng command follow-up có validation. Máy giả lập chọn thứ tự tọa độ ổn định. Ô có đội đánh vừa chiếm không dành cho Hấp Hồn/Tượng Xương; thiếu chỗ thì tạo ít hơn, không hoàn tài nguyên hoặc trì hoãn spawn. Các hiệu ứng sau chết chỉ trigger cho quân bị chết bởi damage/hy sinh cho phép, không bởi xóa người thua. Không cho chọn Vua làm chi phí hy sinh.

### 15.9 Combat test harness và kiểm thử bắt buộc

Màn developer chọn phe/nội tại/Đời/tài nguyên, đặt đội với số lượng tùy ý (kể cả 30), cast skill, move, attack, end turn; hiển thị log/state và kết quả preview. Dùng cùng rules engine như game thật, không dùng logic combat riêng.

| Ca kiểm thử | Kết quả bắt buộc |
|---|---|
| Đội 10 → 4 → 2 → 0 qua 3 lượt | 0 / 0 / 2 tài nguyên |
| Đội 10 → 4 → 0 trong cùng lượt | 0 rồi 4 tài nguyên |
| Overkill 9 damage lên 2 HP | Thưởng 2, không 9 |
| Thần thú còn 2 HP chết | 2 tài nguyên; không mua lại |
| 6 Kỵ Quỷ kết liễu/chiếm khi sẵn sàng | 7 Kỵ, 7 HP, CD toàn phe |
| Đội 20 Quỷ mất 3 quân | Giữ 17, không ép về 6 |
| Kết liễu nhưng không chiếm / bắn chết / CD chưa xong | Không cộng quân |
| Tách/gộp/đổi lượt | Không nhân bản quân, action, CD hoặc buff |
| Hiến Tế Dân | Đúng 2 Hồn; không tài nguyên/bonus Hồn Soái |
| Huyết Tế dùng Dân | 1 Hồn cơ bản; không trigger Hiến Tế |
| Điều Binh đội đã hành động | Di chuyển hợp lệ, không đánh lại |
| Phá Trận đẩy vào ô có quân/ngoài bàn | Damage vẫn áp dụng; không đẩy |
| Vua chết | Loại chủ ngay; xóa quân không tạo thưởng/Hồn |
| Từ lượt 40 | Cập nhật CD; chỉ Dân trên ô đúng nghề có income |
| Replay cùng config/seed/log | State hash giống nhau sau mọi command |

Preview damage/thưởng/quân tăng dùng cùng hàm thuần với resolution. Threat preview Vua phải xét đường đi, action, kỹ năng sẵn sàng và tài nguyên công khai; nếu mới tính tầm đánh trực tiếp thì ghi rõ phạm vi, không gọi là bảo đảm an toàn lượt kế.

---

## 16. Lộ trình phát triển

| Giai đoạn | Nội dung | Kết quả |
|---|---|---|
| **0. Chốt luật** | Giải các câu hỏi mở (mục 17), chốt bảng tham số | Bộ luật 1.0 |
| **1. Lõi luật** | Lõi luật thuần logic, bộ lệnh, kiểm tra hợp lệ | Có thể chạy ván bằng dòng lệnh |
| **2. Kiểm thử và mô phỏng** | Test pipeline/edge cases, bot ngẫu nhiên và heuristic, thống kê cân bằng | Báo cáo tỉ lệ thắng, chỉnh tham số |
| **3. Prototype giao diện** | Bàn 8x8, 2 người, Rồng và Quỷ (hai tộc đối lập), hot-seat | Bản chơi thử |
| **4. Đủ 4 tộc** | Thêm Nhân và Tiên, đủ 12 loại quân ngoài Vua, đủ nội tại và kích hoạt | Bản alpha |
| **5. Human playtest và UX** | 1v1 đủ bốn phe; damage/threat preview, tutorial; rồi mở 2v2/FFA | Bản beta cục bộ |
| **6. Online** | Máy chủ trọng tài, lượt dài, ghép trận, replay | Bản beta online |
| **7. Boardgame** | Bản in thử, sách luật, test với người chơi thật | Prototype vật lý |
| **8. Hoàn thiện** | Nghệ thuật, âm thanh, hướng dẫn, xếp hạng | Phát hành |

**Tiến độ tại 1.2:** giai đoạn 1 (lõi luật), 2 (kiểm thử + bot tự đấu) và 3 (giao diện) đã có trong bản web; giai đoạn 4 (đủ 4 tộc, 12 loại quân, toàn bộ nội tại/kích hoạt/đặc tính) đã cài đặt; giai đoạn 6 có bản beta online qua Firebase (phòng, lượt, vào lại trận, hết giờ). Còn lại: human playtest có hệ thống, tutorial tương tác, máy chủ trọng tài cho xếp hạng, bản in boardgame.

---

## 17. Quyết định triển khai và điểm cần playtest

Luật mặc định của 1.1: cận chiến được chọn chiếm; ô nhà địch vẫn x2; Dân vẫn đi từ lượt 40 và chỉ thu trên ô đúng nghề; Tài Trợ chỉ buff một đòn; Tiên không +action; giữ Chỉ Huy và Tượng; Tượng 1 HP; không chia tài nguyên 2v2; Ranked 1v1 có vòng 80; tên Đời giữ Huyện–Quận–Châu–Thành.

Các con số giá, lên Đời, CD, phí Điều Binh/Phá Trận và sản lượng là cấu hình thử nghiệm. **CD Đoạt Sinh 3 là lựa chọn đề xuất trong bản này**, chưa phải con số người dùng chốt. Quyền tăng vượt 6 không có trần là yêu cầu đã chốt.

Cần playtest: sức mạnh đội Quỷ 10/20/30, khả năng săn đội nhỏ để tăng quân, mức hữu ích của tiêu vàng/gỗ, nhịp kinh tế sau 40 và chênh lệch đi trước. Không giảm trần Đoạt Sinh tự động để xử lý kết quả; điều chỉnh CD/giá/khả năng đối phó dựa trên dữ liệu.

## 18. Phụ lục

### 18.1 Bảng tra nhanh luật

| Mục | Quy tắc |
|---|---|
| Khởi đầu | Vua + 10 vàng, Đời I |
| Thu nhập | 1V + Dân x2 trên ô đúng nghề; từ 40 chỉ còn Dân trên ô đúng nghề |
| Mua | Tùy ý, không tốn hành động, đặt ở hàng spawn, nghỉ 1 lượt |
| Hành động | Bằng số đời (1, 2, 3, 4). Mỗi hành động: đi rồi đánh |
| Lên đời | 8 / 20 / 40 tài nguyên, tức thời, hiệu lực ngay |
| Đội | Cùng loại, thường 6/Tiên 3; Đoạt Sinh không trần; quân thường 1 HP |
| Cận chiến | Đánh ô kề; diệt hết thì có thể chiếm ô |
| Tầm xa | Đánh trong tầm; không chiếm ô; bị quân giữa đường chặn (trừ Công thành) |
| Thưởng kết liễu | HP ngay trước hiệu ứng gây chết; Vua 3; Dân đúng nghề |
| Kích hoạt | Không tốn hành động, có hồi chiêu, dùng từ Đời I |
| Miễn chiến | 3 lượt đầu không đánh |
| Thua | Mất Vua, toàn bộ quân biến mất |

### 18.2 Bảng kích hoạt theo tộc

| Tộc | Kích hoạt 1 | Kích hoạt 2 | Kích hoạt 3 |
|---|---|---|---|
| **Rồng** | Long Lực (hồi 3) | Long Uy (hồi 4) | Long Hống (hồi 5) |
| **Nhân** | Tài Trợ Chiến Tranh (hồi 3) | Hối Lộ (hồi 4) | Thu Thuế (hồi 6) |
| **Tiên** | Linh Nhãn (hồi 3) | Hoán Vị (hồi 3) | Thiên Mạc (hồi 6) |
| **Quỷ** | Lời Nguyền (hồi 3) | Huyết Tế (hồi 4) | Hấp Hồn (hồi 5) |

### 18.3 Bảng nội tại theo tộc (chọn 1)

| Tộc | Nội tại A | Nội tại B | Nội tại C |
|---|---|---|---|
| **Rồng** | Long Giáp | Cuồng Huyết | Long Nộ |
| **Nhân** | Lãi Suất | Chợ Trời | Hợp Đồng Bao Thầu |
| **Tiên** | Linh Động | Tiên Phong | Gió Thuận |
| **Quỷ** | Oán Hồn | Đoạt Sinh | Tái Sinh |

### 18.4 Điểm yếu theo tộc

| Tộc | Điểm yếu |
|---|---|
| Rồng | Long Tham: quân chiến đấu giá +1 thực |
| Nhân | Chi Tiêu Thuần: quân chiến đấu không có đòn hiểm, thắng nhờ tiền |
| Tiên | Mong Manh: đội tối đa 3 quân, Vua đi 1 ô |
| Quỷ | Vua đi 1 ô |

### 18.5 Nhật ký quyết định (đã chốt qua trao đổi)

- Bàn 8x8 cho 2 người, mỗi người 4x8 ô; 3–4 người dùng bàn chữ thập 14x14; 3 người có Hoang Địa trống.
- Mua sắm tùy ý, không giới hạn; hành động mỗi lượt bằng số đời; quân mới mua nghỉ 1 lượt.
- Hai kiểu tấn công: cận chiến (chiếm ô khi diệt hết) và tầm xa (không chiếm ô). Tầm đánh là phạm vi.
- Quân thường 1 HP, kể cả Tượng; chỉ Thần thú có HP riêng. Mua/gộp 6 (Tiên 3); Đoạt Sinh tăng không trần.
- Dân không giới hạn, giá 2 vàng; bỏ phong cấp lính.
- Ô nhà cố định, loại tài nguyên người chơi chọn; ô giữa ngẫu nhiên đối xứng.
- Bốn đời tên theo cấp hành chính: Huyện, Quận, Châu, Thành.
- Vua có sẵn, không mua; mất Vua thì toàn bộ quân biến mất.
- Mỗi tộc: 1 nội tại (chọn trong danh sách) + 3 kích hoạt (dùng như Q/W/E, từ Đời I, không tốn hành động).
- Từ lượt 40: Suy Tàn; Dân trên ô đúng nghề vẫn thu x2, nguồn thụ động tắt, thưởng kết liễu vẫn có.
- Bỏ các hiệu ứng tạo ô trên bàn (ô lửa và tương tự); thay Long Giáng, Thương Đoàn, Giả Kim.
- Mục tiêu nền tảng: PC, mobile, webgame online và boardgame.

---

### 18.6 Nhật ký cập nhật 1.1 (07/10/2026)

Áp dụng đề xuất tái cân bằng trong trao đổi làm baseline 1.1; giữ Tượng theo yêu cầu mới. Thay Tổng Quản/Thương Tượng bằng Điều Binh/Phá Trận tiêu tài nguyên. Chốt quân thường 1 HP, Đoạt Sinh cộng cùng loại vượt 6 không trần, Hiến Tế chỉ +2 Hồn, thưởng kết liễu bằng HP còn lại trước đòn cuối. CD Đoạt Sinh 3 và phí hai đặc tính Nhân là đề xuất thử nghiệm. Bổ sung timing, chống khai thác tách/gộp, config, dữ liệu/event và test cases.

### 18.7 Nhật ký cập nhật 1.2 (07/10/2026)

- Hoàn thành bản **webgame online thử nghiệm** (mục 19): đăng nhập/đăng ký/khách, sảnh (danh sách phòng, tìm kiếm, tạo/vào phòng, luyện tập với Bot, kênh thế giới, hướng dẫn, bách khoa 4 tộc, bảng xếp hạng, hồ sơ), phòng chờ 4 ghế kiểu chọn tướng, chọn tộc/nội tại/ô nhà, sẵn sàng/bắt đầu, chat, màn tải, xúc xắc chọn người đi trước, bàn cờ canvas có hoạt ảnh, HUD đầy đủ.
- Lõi luật cài đặt **toàn bộ** mục 3–11 và 15.8; 40 ca kiểm thử (gồm mọi ca bắt buộc 15.9) đạt; 48 ván bot tự đấu ở 2/3/4 người, replay cùng seed/log cho hash giống hệt.
- Chốt các điểm luật còn mơ hồ thành quy tắc xác định (mục 19.6), thêm tham số `threeSeatBonusGold`, `secondPlayerBonusGold`, giới hạn bỏ lượt 3 lần.
- Đồng bộ online theo đúng cấu trúc `rooms/{mã}` và luật bảo mật Firebase của dự án; bổ sung các nút tùy chọn `lobby`, `lobbyChat`, `users`, `presence`, `rooms/{mã}/chat`.
- **1.2.1:** đồ họa 3D (Three.js) phong cách Ragnarok tươi sáng, quân chibi theo tộc, VFX riêng cho từng loại đòn đánh và kỹ năng, HUD nổi với thẻ kỹ năng và dock Kỹ năng/Cửa hàng, khung Nhật ký/Chat thu gọn được, kéo-thả mua quân và di chuyển, toàn bộ biểu tượng SVG tiếng Việt (bỏ emoji và chữ tượng hình) — xem mục 19.9.
- **1.2.2:** bot 3 mức Dễ/Trung bình/Khó; giao diện điện thoại; Kết thúc lượt và đồng hồ lên trên cùng; popup Tạo phòng/Đấu với Bot/Nhập mã với nút **i** xem luật từng chế độ; bố cục HUD tự né không che nhau; camera dời lên/xuống/trái/phải; dọn chữ thừa — xem mục 19.10.

---

## 19. Bản webgame online thử nghiệm (1.2)

### 19.1 Phạm vi và cách chạy

Bản web chạy hoàn toàn phía trình duyệt (HTML/CSS/JavaScript thuần, không bước build), dùng được trên PC và mobile. Hai chế độ kết nối dùng chung một mã nguồn:

| Chế độ | Khi nào | Ghi chú |
|---|---|---|
| **Online — Firebase** | Mặc định | Realtime Database (asia-southeast1) + Authentication (Email/Password, Anonymous). |
| **Demo cục bộ** | Thêm `?local=1` vào địa chỉ | Nhiều tab cùng trình duyệt là nhiều người chơi; dữ liệu trong localStorage, đồng bộ bằng BroadcastChannel. Dùng để thử và kiểm thử tự động. |

Mã nguồn tách lớp đúng mục 15.1: `js/core` (lõi luật, bot — không phụ thuộc giao diện/mạng), `js/net` (Firebase/cục bộ), `js/ui` (màn hình, bàn cờ). Lõi luật chạy được trong Node để kiểm thử (`node tests/run-tests.js`).

### 19.2 Luồng màn hình

1. **Đăng nhập**: ba thẻ *Đăng nhập* (email + mật khẩu, tùy chọn ghi nhớ), *Đăng ký* (tên hiển thị, email, mật khẩu nhập lại), *Chơi khách* (nhập tên người chơi, dùng Anonymous Auth). Lỗi Firebase được dịch sang tiếng Việt. Không ghi nhớ = phiên theo từng tab, cho phép thử nhiều tài khoản trên một máy.
2. **Sảnh**: thanh điều hướng *Sảnh đấu · Hướng dẫn · Bách khoa · Xếp hạng · Hồ sơ*.
   - Sảnh đấu: danh sách phòng đang mở (lọc theo chế độ, tìm theo tên/mã/chủ phòng, số ghế đã có người), vào bằng mã 6 ký tự, tạo phòng (tên, 2/3/4 người, thời gian lượt 60 giây – 24 giờ, 2 đấu 2, giới hạn 80 vòng, bù người đi sau +1V, phòng riêng), **Luyện tập với Bot** (1 chạm), kênh chat thế giới, số người online, thanh *Vào lại trận* khi có trận dang dở.
   - Hướng dẫn: tổng quan, pha lượt, điều khiển, chiến đấu, Đời, chơi online.
   - Bách khoa: từng tộc — điểm yếu, 3 nội tại, 3 kích hoạt, 13 quân với giá đã tính điểm yếu/đặc tính tộc.
   - Xếp hạng: top 20 theo điểm hạng. Hồ sơ: ảnh đại diện, đổi tên, điểm hạng, số trận, tỉ lệ thắng, lịch sử 20 trận, bật/tắt âm thanh, đăng xuất.
3. **Phòng chờ** (bố cục chọn tướng): 4 ghế lớn theo hướng Nam/Tây/Bắc/Đông với huy hiệu tộc, tên, nội tại, ô nhà, trạng thái sẵn sàng, vương miện chủ phòng; ghế ngoài chế độ bị khóa (3 người: ghế 4 là *Hoang Địa*). Bảng trang bị: chọn tộc (4 huy hiệu), **nội tại như bảng ngọc** (chọn 1 trong 3), **ô nhà như phép bổ trợ** (Vàng/Thực/Gỗ), xem 3 kích hoạt Q/W/E cố định và điểm yếu. Người thường bấm *Sẵn sàng* (khóa lựa chọn), chủ phòng bấm *Bắt đầu* khi đủ ghế và mọi người sẵn sàng; chủ phòng có thể *+ Bot* vào ghế trống, mời người ra; ai cũng có thể đổi ghế trống. Chat phòng ở bên phải; mã phòng bấm để sao chép.
4. **Màn tải**: thẻ từng người chơi (huy hiệu, tộc, nội tại, ô nhà) và mẹo chơi ngẫu nhiên.
5. **Xúc xắc**: mỗi người tung 1d6 (giá trị xác định từ seed, mọi máy giống nhau); hòa điểm cao nhất thì những người hòa tung lại; người cao nhất đi trước, sau đó theo chiều kim đồng hồ Nam → Tây → Bắc → Đông.
6. **Trận đấu**: bàn cờ xoay để phe mình luôn ở dưới; cột trái là thẻ người chơi (tài nguyên, Hồn, Đời, số Dân/quân, hành động còn lại, mất kết nối); cột phải là tài nguyên + lên Đời, kỹ năng Q/W/E có đồng hồ hồi chiêu, cửa hàng (khóa theo Đời, giá theo tộc), bảng đơn vị (số quân tách đội, tùy chọn chiếm ô/Bóng Ma/Du Kích, kỹ năng trả phí Tạm Ứng/Hồn Pháo/Phá Trận, Thương Xa chở Dân, Hiến Tế, Điều Binh, đổi nghề). Dưới cùng: nhật ký/chat, chọn loại tài nguyên thưởng kết liễu, Hoàn tác, Kết thúc lượt. Thanh đồng hồ lượt ở góc trên.
7. **Kết thúc**: bảng tổng kết (người thắng, Đời, hạ gục, mất quân, điểm), ghi lịch sử và điểm hạng (+25 thắng, −15 thua), về sảnh hoặc xem lại bàn cờ.

Đồ họa: phong cách fantasy tông đen – vàng kim, huy hiệu tộc và biểu tượng quân là SVG tự vẽ (không cần ảnh), bàn cờ vẽ bằng canvas với hoạt ảnh di chuyển, lao đánh cận chiến, đạn tầm xa (cung/phép/đá), số sát thương bay, hạ gục, thưởng, xuất hiện quân, rung màn hình; âm thanh tổng hợp bằng WebAudio.

### 19.3 Thao tác trên bàn cờ

| Thao tác | Cách làm |
|---|---|
| Mua | Bấm quân trong cửa hàng → ô spawn hợp lệ sáng vàng → bấm để đặt, bấm tiếp để mua thêm vào cùng ô |
| Chọn đội | Bấm quân; ô xanh = đi được, ô tím = gộp đội, vòng đỏ = đánh được từ vị trí hiện tại |
| Đi rồi đánh | Bấm ô xanh có mục tiêu → hiện bóng mờ + mục tiêu từ vị trí mới; bấm mục tiêu để đi-đánh, bấm bóng mờ để chỉ đi |
| Xem trước | Rê chuột lên mục tiêu: sát thương cuối và chuỗi điều chỉnh (8.4), có diệt cả đội không, thưởng nhận |
| Kỹ năng | Q/W/E (phím hoặc nút) → chọn mục tiêu theo gợi ý; Hoán Vị/Huyết Tế/Điều Binh là 2 bước |
| Hiệu ứng chờ | Long Uy, Quỷ Xa, Ma Tiễn, Phép Tạm Ứng tạo bước chờ: chọn mục tiêu/ô hoặc *Bỏ qua* (Space) |
| Hoàn tác | Ctrl+Z hoặc nút ↶ — dựng lại bản nháp từ đầu lượt (không hoàn tác thu hoạch) |
| Kết thúc | Enter hoặc nút; nút nhấp nháy khi đã hết hành động |

### 19.4 Giao thức online (Firebase làm sổ lệnh)

Cấu trúc dữ liệu bám đúng luật bảo mật của dự án:

```
rooms/{mã 6 ký tự}
  meta:     { ruleVersion, mode, seed, status, hostUid, createdAt, turnLimitMs }
  seats:    { "1": uid, "2": uid, ... }            giành ghế bằng transaction
  players:  { uid: { seat, name, race, passive, homeTileType, ready, lastSeen } }
  turn:     { seat, startedAt, nextSeq }
  commands: { "1": { seq, uid, turnNo, payload, stateHash, ts }, ... }
  result:   { winnerSeat, endedAt }
  chat:     { pushId: { uid, name, text, ts } }      (tùy chọn)
lobby/{mã}       chỉ mục phòng cho sảnh (tùy chọn)
lobbyChat/{id}   kênh thế giới (tùy chọn)
users/{uid}      hồ sơ, điểm hạng, lịch sử (tùy chọn)
presence/{uid}   đang online (tùy chọn)
```

- Mã tộc `rong|nhan|tien|quy`, ô nhà `gold|food|wood`, ghế là chuỗi `"1"`–`"4"`. Bàn 2 người dùng ghế 1–2 (Nam, Bắc); 3 người ghế 1–3 (Nam, Tây, Bắc; Đông là Hoang Địa, Tây nhận +2V); 4 người ghế 1–4.
- **Tùy chọn ván trong seed**: `meta` không cho thêm trường nên 4 bit thấp của `seed` mã hóa tùy chọn (bit0 = 2 đấu 2, bit1 = giới hạn 80 vòng, bit2 = bù người đi sau +1V); phần còn lại `floor(seed/16)` là seed của bộ sinh số ngẫu nhiên (ô tài nguyên + xúc xắc).
- **Bot**: ghế bot có `seats[n] = hostUid` nhưng không có bản ghi `players` tương ứng. Tộc/nội tại/ô nhà của bot sinh xác định từ seed và số ghế, nên mọi máy dựng cùng thiết lập. Máy chủ phòng chạy bot và ghi lệnh (luật cho phép vì ghế bot thuộc uid chủ phòng).
- **Bắt đầu**: chủ phòng ghi `turn {seat: người thắng xúc xắc, nextSeq: 1}` rồi đổi `status` sang `playing`. Mỗi máy đọc lại meta/seats/players và chạy `init(seed, người chơi)` ra trạng thái đầu giống hệt.
- **Một lượt**: người đến lượt thao tác trên bản nháp cục bộ (có hoàn tác), bấm Kết thúc thì ghi **một** bản cập nhật nhiều đường dẫn: `commands/{nextSeq}` (gói lượt nén: các lệnh mua giống nhau liên tiếp gộp thành `m`) + `turn {seat kế tiếp, startedAt, nextSeq+1}`. Payload tối đa 6000 ký tự.
- **Kiểm tra phía máy nhận**: chỉ chấp nhận lệnh khi `uid` ghi là chủ ghế đang đến lượt; mọi lệnh bị ép `p = người đang đến lượt`, dừng xử lý khi lượt đã chuyển — người sửa client không thể ra lệnh hộ người khác. Lệnh sai luật bị mọi máy cùng bỏ qua. Sau gói, mã băm trạng thái (FNV-1a 64 bit trên JSON chuẩn hóa) được so với `stateHash`; lệch thì cảnh báo.
- **Hết giờ**: khi quá `startedAt + turnLimitMs` (+4 giây ân hạn), máy còn kết nối có thứ tự thấp nhất ghi gói `[{c:"timeout"}]` (các máy khác chờ thêm 3 giây/thứ tự để tránh ghi trùng; luật `!data.exists()` chặn bản ghi thứ hai). Nếu bản ghi đó đến từ người không phải chủ lượt, mọi máy chỉ áp dụng nó như bỏ lượt. Bị bỏ lượt 3 lần thì bị loại. Máy của người đang đi tự gửi gói hiện có khi hết giờ.
- **Vào lại / mất mạng**: mở lại trang → thanh *Vào lại trận* → đọc toàn bộ sổ lệnh và phát lại không hoạt ảnh (rất nhanh vì chỉ là logic), sau đó tiếp tục với hoạt ảnh.
- **Đầu hàng**: luật chỉ cho chủ lượt ghi lệnh, nên đầu hàng ngoài lượt được xếp hàng và tự gửi đầu lượt kế của người đó.
- **Kết thúc**: máy nào phát hiện trận kết thúc cũng thử ghi `result` (chỉ bản đầu thành công) rồi `status = finished`; mỗi người tự cập nhật hồ sơ của mình.

Giới hạn đã biết của mô hình không trọng tài: hồ sơ/điểm hạng do client tự ghi (chỉ phù hợp chơi giao hữu); khi chủ phòng rời trận, lượt của bot chỉ còn được bỏ qua bằng hết giờ. Bản xếp hạng chính thức cần máy chủ trọng tài như mục 15.3.

### 19.5 Lõi luật — những gì đã cài đặt

- Bàn 8×8 và chữ thập 14×14 (cắt góc), Hoang Địa 3 người, ô nhà cố định (hàng 2 cột 2 theo góc nhìn phe), ô giữa ngẫu nhiên đối xứng xoay 180° (2 người: 3 cặp, mỗi cặp một loại) hoặc 90° (4 người: 2 bộ × 4 ô trong vùng 4×4 trung tâm).
- Kinh tế, Đời, mua sắm, nghỉ, tách/gộp đội theo từng quân đã hành động, sát thương theo mục 8.4, thưởng kết liễu theo HP ngay trước hiệu ứng gây chết, miễn chiến, Suy Tàn từ lượt 40, giới hạn vòng 80 tính điểm, 2 đấu 2 (đồng đội đi xuyên nhau, không đánh nhau, không bị Thu Thuế/Hối Lộ).
- Đủ 4 tộc × (điểm yếu + 3 nội tại + 3 kích hoạt + 12 đặc tính quân), kể cả Đoạt Sinh vượt 6 không trần, Hấp Hồn, Ma Vương, Tượng Xương, Phản Oán, Tên Xuyên Giáp, Phun Lửa, Va Chạm, Phá Trận, Điều Binh, Thương Xa, Ảnh Bộ, Linh Quang, Thiên Lôi.
- Dữ liệu theo mục 15.8: `BalanceConfig` một nguồn, trạng thái là JSON thuần, lệnh nhỏ (`harvest, job, buy, age, trade, act, follow, skip, skill, oanhon, taisinh, hiente, dieubinh, end, resign, timeout`), sự kiện có log tiếng Việt để hiển thị và hoạt ảnh. Không dùng số thực trong logic, không Math.random, duyệt theo id/tọa độ ổn định.

### 19.6 Quyết định luật đã chốt khi cài đặt (cần xác nhận qua playtest)

| Điểm | Cách xử lý trong 1.2 |
|---|---|
| Ba lượt miễn chiến | Tính theo lượt cá nhân của người đang đi (≤3). |
| Đổi nghề Dân Nhân "trước thu hoạch" | Đầu lượt có pha *Thu hoạch*; tộc Nhân có Dân được đổi nghề rồi bấm *Thu hoạch*; lệnh mua/đi bất kỳ tự thu hoạch trước. Tộc khác tự thu hoạch. |
| Di chuyển nhiều ô | Đi theo đường thẳng như quân cờ (không rẽ), bị chặn bởi quân bất kỳ trừ quân có đặc tính bay/xuyên quân. |
| Tách đội đánh tại chỗ | Không tạo đội mới; đánh dấu k quân đã hành động, sát thương = k. Tách khi di chuyển thì phần đi thành đội mới. |
| Buff khi tách/gộp | Buff tấn công (Long Lực, Tài Trợ, Long Uy, Hấp Hồn, Linh Nhãn, Long Nộ) đi theo phần hành động; giáp/hiệu ứng xấu được sao chép để không né được. |
| Gộp đội | Chỉ gộp khi cùng trạng thái nghỉ (quân mới mua chỉ gộp với quân mới mua cùng lượt). |
| Hiệu ứng đánh thêm/đi thêm | Long Uy, Quỷ Xa, Ma Tiễn, Phép Tạm Ứng tạo *hiệu ứng chờ*; phải giải quyết hoặc bỏ qua trước lệnh khác. |
| Tùy chọn trong đòn | Chiếm ô (mặc định có), Bóng Ma quay về (mặc định không), Du Kích lùi (mặc định có) là tham số của lệnh. |
| Hộ Tống | Bảo vệ mọi đội Dân kề Thuẫn binh Nhân (đơn giản hóa "chọn một đội"). |
| Thu Thuế khi hòa | Lấy theo thứ tự ưu tiên Vàng → Thực → Gỗ (thay cho "họ chọn") để không cần lệnh chen ngang của đối thủ. |
| Phun Lửa | Lệnh có thể chỉ định mục tiêu phụ; không chỉ định thì lấy đội địch kề đầu tiên theo thứ tự hướng cố định. |
| Thương Xa | Chở một đội Dân ≤2 quân kề Chiến xa lúc xuất phát; Dân được thả ở ô ngay trước ô đích (Chiến xa phải đi ≥2 ô). |
| Ô xuất hiện quân (Hấp Hồn, Ma Vương, Oán Hồn…) | Tự chọn theo thứ tự ô ổn định; Tái Sinh/Oán Hồn do người chơi chọn ô spawn. |
| Quân sinh ra ngoài lượt mình (Ma Vương) | Nghỉ tới hết lượt hiện tại, hành động được từ lượt kế của chủ. |
| Hồn khi Vua Quỷ chết | Không tính (người chơi bị loại ngay). |
| Long Giáp / Giáp Vảy / Hộ Pháp "mỗi vòng" | Ghi số vòng đã dùng trên đội; vòng tăng khi lượt quay về người đi đầu. |
| Long Nộ, Lời Nguyền, Nguyền Yếu, Long Hống | Hết hạn ở cuối lượt kế tiếp của chủ đội bị ảnh hưởng. |
| Hối Lộ | Thanh toán tự động từ loại tài nguyên đang nhiều nhất (có thể chỉ định). Quân đổi chủ nghỉ hết lượt hiện tại. |
| Bỏ lượt khi hết giờ | Bỏ lượt; 3 lần trong một trận thì bị loại (mới). |
| Kết thúc theo điểm (vòng 80) | Điểm = tổng giá trị cơ bản quân trên bàn (không tính Vua) + tài nguyên; bằng điểm thì hòa. |

### 19.7 Kiểm thử và số liệu đầu tiên

- `tests/run-tests.js`: 40 khẳng định đạt, gồm toàn bộ ca bắt buộc mục 15.9 (thưởng 10→4→2→0, overkill, Thần thú 2 HP, Đoạt Sinh 6→7 và CD, đội 20 mất 3 còn 17, bắn chết/không chiếm không tăng, Hiến Tế = 2 Hồn, Huyết Tế = 1 Hồn, Điều Binh giữ cờ đã hành động, Phá Trận bị chặn, Vua chết, Suy Tàn, tách/gộp không nhân bản) cùng các ca Thuẫn binh, Thiên Mạc, Long Giáp, Công thành + Long Lực, Hối Lộ.
- 48 ván bot heuristic (32 ván 2 người, 8 ván 3 người, 8 ván 4 người) chạy hết không lệnh lỗi; phát lại cùng seed + sổ lệnh cho cùng mã băm ở mọi ván.
- Kiểm thử trình duyệt tự động (2 tab, 2 người, chơi tới hết trận 11 vòng) — hai máy cùng mã băm sau mọi lượt; ván 4 người 2 đấu 2 với 3 bot chạy 17 vòng không lỗi.
- **Tín hiệu cân bằng sơ bộ (bot, chưa phải bằng chứng):** 32 ván 1v1 — Tiên 17 thắng, Rồng 11, Quỷ 3, Nhân 1; trung vị chỉ khoảng 13 vòng vì bot ưu tiên săn Vua. Gợi ý theo dõi khi playtest người thật: (1) Vua 1 HP chết quá sớm sau miễn chiến — cân nhắc thêm HP Vua hoặc kéo dài miễn chiến; (2) tốc độ của Tiên (Gió Thuận, Cung tầm 3) mạnh trong ván ngắn; (3) Nhân tộc cần thời gian tích tiền nên yếu khi ván kết thúc sớm; (4) Thần thú chỉ gây 1 sát thương (vì sát thương = số quân) so với giá 12 — cân nhắc sát thương riêng cho Thần thú.

### 19.9 Đồ họa 3D, VFX và giao diện (bản 1.2.1)

**Phong cách:** fantasy tươi sáng, lấy cảm hứng từ Ragnarok Online 1/2/3. Cửa sổ trắng – xanh nhạt bo tròn, thanh tiêu đề xanh dương, nút dạng viên kẹo vàng – cam, chữ tròn Baloo 2 / Nunito. Toàn bộ chữ trong game là tiếng Việt. Không dùng emoji hay chữ tượng hình: mọi biểu tượng (huy hiệu tộc, ảnh đại diện, nút, trạng thái) là SVG tự vẽ.

**Bàn cờ 3D** (Three.js r158, WebGL; tự chuyển sang bàn 2D nếu máy không hỗ trợ, đổi được trong menu):
- Môi trường gọn và đối xứng: bàn đá viền vàng đặt trên bệ bát giác hai bậc, giữa quảng trường lát gạch. Quanh bệ là 8 cột đá trắng mái xanh có đèn, mỗi phe có cặp cờ màu tộc ở phía mình, xa hơn là đồi xanh mờ trong sương và vài đám mây cao.
- Quân cờ chibi tô bóng hoạt hình (toon shading), mỗi loại một hình dáng riêng: Vua đội vương miện cầm trượng, Lính đội mũ sắt cầm kiếm, Cung thủ trùm mũ cầm cung, Kỵ binh cưỡi ngựa, Pháp sư đội nón phép có quả cầu phát sáng, Công thành là máy bắn đá, Chiến xa có bánh xe, Tượng binh mang bành, Thần thú có cánh, Chỉ Huy cầm cờ…
- Đặc trưng tộc trên mọi quân hình người:
  - Rồng: sừng và đuôi.
  - Nhân: áo choàng xanh và chùm lông mũ.
  - Tiên: cánh bướm trong suốt, bay lơ lửng.
  - Quỷ: sừng xoắn và đuôi mũi giáo.
- Hoạt ảnh nhàn rỗi: quân thở, cờ bay, cánh vỗ, quả cầu phép nhấp nháy.
- Nhãn số quân ×N và HP Thần thú nổi trên đầu. Quân nghỉ hiện "Zz", quân đã hành động có vành xám. Trạng thái hiện thành vòng hào quang màu; riêng Thiên Mạc là vòm khiên trong suốt.
- Camera kéo chuột (hoặc một ngón tay) để xoay, lăn chuột (hoặc chụm hai ngón) để zoom. Có 4 nút góc nhìn: xoay trái, xoay phải, về góc nhìn của mình, nhìn từ trên xuống. Mặc định phe mình luôn ở phía gần camera.

**VFX theo loại quân tấn công** (màu theo tộc: Rồng cam lửa, Nhân vàng kim, Tiên ngọc lam, Quỷ tím):

| Quân | Hiệu ứng |
|---|---|
| Lính, Thuẫn binh, Vua, Dân | Lao tới + vệt chém hình lưỡi liềm, chớp sáng, hạt va chạm theo tộc |
| Kỵ binh | Bụi chạy theo đường đi, hai nhát chém liên tiếp |
| Thích khách | Khói bóng tối ở chỗ đứng, chém chữ X |
| Cung thủ | Mũi tên 3D bay vòng cung có vệt sáng |
| Pháp sư | Tụ phép xoáy, quả cầu phép bay thẳng, sóng nổ hai vòng |
| Công thành | Tảng đá cháy bay vòng cao, nổ lửa, sóng xung kích, bụi, rung màn hình |
| Chiến xa, Tượng binh | Sóng xung kích mặt đất, bụi tung, rung màn hình |
| Thần thú | Phun luồng hơi thở (lửa / ánh ngọc / khói tím theo tộc) |

Mỗi kỹ năng có hiệu ứng riêng:
- Long Lực: cột lửa. Long Uy: ba vết vuốt. Long Hống: ba vòng sóng âm.
- Tài Trợ: mưa đồng vàng. Hối Lộ: xoáy tiền tím. Thu Thuế: đài phun đồng vàng.
- Linh Nhãn: cột sáng xanh. Thiên Mạc: vòm khiên.
- Lời Nguyền: xoáy tím rơi xuống. Huyết Tế: cột máu. Hấp Hồn: xoáy linh hồn.

Ngoài ra: số sát thương bật lên, quân bị hạ xoay thu nhỏ rồi nổ hạt (quân Quỷ để lại hồn bay lên), thưởng hiện đồng vàng rơi kèm chữ "+N Vàng", mua quân có cột sáng và hạt lấp lánh, lên Đời có cột sáng vàng lớn kèm dòng chữ "Đời III · Châu!".

**HUD trận đấu** (bàn cờ phủ toàn màn hình, các bảng nổi phía trên):
- Góc trên trái: khung trạng thái của mình (huy hiệu, tộc, Đời, tài nguyên, viên ngọc hành động, nút lên Đời).
- Góc trên phải: thẻ các đối thủ.
- Giữa trên: băng lượt và đồng hồ.
- Bên trái: bảng đơn vị nổi khi chọn quân.
- Góc dưới trái: khung **Nhật ký / Chat** gộp một chỗ, thu gọn hoặc mở được, ghi nhớ trạng thái.
- Góc dưới phải: **dock chuyển đổi Kỹ năng ↔ Cửa hàng**, thu gọn được.
  - Kỹ năng là 3 **thẻ bài** xếp hình quạt: phím Q/W/E, tranh kỹ năng, che hồi chiêu dạng quạt tròn, nổi lên và hiện mô tả khi rê chuột, nhấp nháy khi đang chọn mục tiêu. Kèm thẻ nội tại và nút hành động phụ (Oán Hồn, Tái Sinh, Chợ Trời).
  - Cửa hàng là lưới 15 ô gọn có khóa theo Đời và giá theo tộc.
- (Bản 1.2.1 ban đầu đặt nút Kết thúc lượt ở góc dưới phải; từ 1.2.2 đã chuyển lên thanh điều khiển trên cùng, xem 19.10.)

**Kéo – thả:**
- Kéo một ô trong cửa hàng ra bàn: các ô spawn hợp lệ sáng vàng có khung, biểu tượng quân bay theo con trỏ và đổi viền khi nằm trên ô hợp lệ, thả để mua. Bấm thường vẫn dùng chế độ đặt liên tiếp.
- Kéo một quân của mình: quân nhấc lên theo con trỏ, ô đi được sáng xanh có khung, mục tiêu đánh sáng đỏ. Thả vào ô đi để di chuyển, thả vào mục tiêu để đánh. Kéo ở chỗ trống thì dời camera (từ 1.2.2, xem 19.10).

**Màn đăng nhập:** nền là bàn cờ 3D 4 tộc quay chậm, thỉnh thoảng phát hiệu ứng kỹ năng. Các màn sảnh và phòng có nền trời xanh, mây trôi, lấp lánh.

**Kiểm thử:** 40 khẳng định lõi luật vẫn đạt. Ván 4 người trên bàn 3D chạy 20 lượt, hai tab có cùng mã băm. Đã kiểm thử kéo-thả mua và kéo-thả di chuyển tự động. Biến `window.TT_FX_SLOW` (mặc định 1) làm chậm VFX để kiểm tra từng khung.

### 19.10 Bot, điện thoại, bố cục tự né và camera (bản 1.2.2)

**Bot ba mức độ khó** (`js/core/bot.js`). Bot dùng chính lõi luật nên không bao giờ đi sai luật và luôn khớp mã băm.

| Mức | Cách chơi |
|---|---|
| Dễ | Chọn nước có nhiễu lớn, đôi khi bỏ qua nước đánh, không dùng kỹ năng, lên Đời chậm. |
| Trung bình | Tham lam theo điểm đánh giá, kiểm tra Vua có bị đe dọa không, mua quân dự trữ, dùng kỹ năng buff và kỹ năng tiện ích. |
| Khó | Mô phỏng từng ứng viên bằng `E.apply` rồi chấm điểm trạng thái: vật chất, kinh tế, bản đồ đe dọa, độ lộ của Vua, áp lực lên Vua địch. Mua quân khắc chế, chọn nghề Dân theo tài nguyên đang thiếu. |

- Giải đấu tự động `tests/bot-levels.js`: Khó thắng Dễ 16-0, Khó thắng Trung bình 15-1, Trung bình thắng Dễ 16-0.
- Ở phòng chờ, chủ phòng thêm Bot vào ghế trống và chọn độ khó ngay trên ghế (Dễ, Trung bình, Khó). Độ khó lưu ở `lobby/{mã}/bots/{ghế}` (tùy chọn) và trên máy chủ phòng.
- Nút **Đấu với Bot** ở sảnh mở popup chọn 1–3 bot và độ khó, tạo phòng riêng rồi vào trận ngay.
- Bot do máy chủ phòng chạy và gửi lệnh qua sổ lệnh như người thật.

**Popup thay cho form cố định ở sảnh.**
- Cột phải của sảnh chỉ còn ba nút: **Tạo phòng**, **Đấu với Bot**, **Nhập mã**. Mỗi nút mở một popup.
- Popup Tạo phòng gồm:
  - Tên phòng.
  - 4 thẻ chế độ ngắn gọn: *1 đấu 1*, *3 người*, *Hỗn chiến*, *2 đấu 2*.
  - Thời gian lượt dạng nút chọn.
  - Công tắc *Giới hạn 80 vòng*, *Bù người đi sau* (chỉ hiện ở 1 đấu 1), *Phòng riêng*.
  - Lựa chọn được ghi nhớ cho lần sau.
- Mỗi chế độ và tùy chọn có nút **i** nhỏ. Bấm vào sẽ hiện bong bóng luật của chế độ đó (bàn, điều kiện thắng, luật bù). Nút i cũng có ở thẻ chế độ trong danh sách phòng, ở dòng tùy chọn của phòng chờ và ở mức độ khó Bot.
- Bộ lọc phòng có thêm "2 đấu 2". Bấm ra ngoài popup thì đóng popup.

**Giao diện điện thoại (≤ 760px).**
- Thanh trên gồm băng lượt rồi đồng hồ, Hoàn tác, Kết thúc lượt và chọn thưởng.
- Dưới đó là dải tài nguyên gọn và hàng thẻ đối thủ cuộn ngang.
- Đáy màn hình có hai nút: Nhật ký/Chat và Kỹ năng/Cửa hàng. Mỗi nút mở một *bottom sheet*, và chỉ một sheet mở tại một thời điểm.
- Chọn quân thì sheet tự đóng để nhìn bàn. Bảng đơn vị cũng là một sheet.
- Trên màn hình cảm ứng, bấm mục tiêu hai lần để xác nhận đánh.

**Thanh điều khiển trên cùng.** Đồng hồ lượt, Hoàn tác, **Kết thúc lượt** (nhấp nháy khi hết hành động) và chọn loại thưởng nằm ngay dưới băng lượt. Băng lượt hiện "Hành động x/y".

**Bố cục tự né** (`layoutHud` trong `js/ui/game.js`). Sau mỗi lần vẽ lại, khi đổi kích thước hoặc khi thu/mở một khung, hệ thống đo vị trí thật của từng khung và xếp lại:
- Khung thông tin và thẻ đối thủ tự xuống dưới thanh trên cùng nếu bị chạm.
- Lời nhắc và thông báo luôn nằm ngay dưới thanh trên cùng.
- Bảng đơn vị đặt ngay dưới khung thông tin và dừng trước khung chat. Nếu quá chật, chat tự thu gọn một lần.
- Khung chat tự thu hẹp khi chạm dock. Dock giới hạn chiều cao để không chạm thẻ đối thủ, quá dài thì cuộn.
- Thanh camera tìm khoảng trống giữa chat và dock ở đáy. Nếu không đủ chỗ thì dựng dọc bên phải, rồi bên trái. Nếu không còn chỗ thì tạm ẩn.
- Trên điện thoại các dải xếp chồng theo chiều cao thật. Sheet không được trùm lên dải thông tin, và thanh camera tự ẩn khi sheet che.
- Ngoại lệ có chủ ý: popup, lớp phủ (menu, xúc xắc, kết thúc trận), bóng kéo thả và bong bóng thông tin.

**Camera di chuyển được.**

| Thao tác | Máy tính | Điện thoại |
|---|---|---|
| Dời camera lên/xuống/trái/phải | Kéo chỗ trống bằng chuột trái, hoặc phím mũi tên | Kéo một ngón |
| Xoay | Chuột phải kéo hoặc Shift + kéo | Xoay hai ngón |
| Phóng to/thu nhỏ | Lăn chuột | Chụm hai ngón |

- Thanh camera có các nút xoay trái/phải, phóng to, thu nhỏ, nhìn từ trên xuống, và **về mặc định** (phím H).
- Camera dời mượt và bị giới hạn trong phạm vi bàn cờ.
- Màn dọc dùng góc nhìn rộng hơn để thấy trọn bàn.

**Dọn chữ.**
- Bỏ khẩu hiệu và các dòng mô tả rải rác.
- Không còn nhắc tên dịch vụ máy chủ trên giao diện.
- Không dùng emoji hay chữ tượng hình; mọi ký hiệu là icon SVG.
- Hướng dẫn chỉ nằm ở mục *Hướng dẫn*, và mục "Điều khiển" đã thêm phần camera.

### 19.8 Việc tiếp theo đề xuất

1. Playtest người thật 1v1 đủ 4 tộc với bản online; thu sổ lệnh để phân tích.
2. Tutorial tương tác cho người mới (dựa trên ví dụ mục 13).
3. Bot Khó đã có mô phỏng 1 lượt (19.10); bước sau là tìm kiếm 2 lượt có tính phản đòn của đối thủ.
4. Cloud Functions làm trọng tài tối thiểu cho xếp hạng (kiểm hash, ghi điểm hạng), chế độ xem trận/replay công khai.
5. Thông báo đẩy cho chế độ lượt dài 24 giờ.

*Hết tài liệu.*
