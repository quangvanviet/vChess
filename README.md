# Tứ Tộc Kỳ Chiến 2.0 — Webgame auto-battler online

Cờ **tự động đánh** 2–4 người, 10 ngày, 4 tộc, chạy hoàn toàn trên trình duyệt. Mỗi ngày mọi người **cùng lúc chuẩn bị** (mua quân ở Băng ghế, trang bị, Lõi, lên Đời, xếp đội, cắm cờ) rồi xem **giao tranh tự động** trên chiến trường 3D. Firebase chỉ lưu phòng và các gói đội hình theo kiểu **commit–reveal**; mỗi máy tự chạy cùng một **mô phỏng xác định** nên ai cũng thấy cùng một trận.

Thiết kế đầy đủ: `tu-toc-ky-chien-gdd-2.0.md` (sinh lại từ số liệu thật bằng `node tools/gen-gdd.js`). Bản luật 1.x cũ: `tu-toc-ky-chien-gdd.md`.

## Chạy thử ngay (không cần mạng)

```bash
cd tu-toc-ky-chien
python3 -m http.server 8080
# mở http://localhost:8080/index.html?local=1
```

`?local=1` bật **chế độ cục bộ**: mở thêm tab trong cùng trình duyệt để làm người chơi khác (mỗi tab đăng nhập riêng). Nút **Đấu với Bot** cho phép chơi ngay một mình (1–3 bot, Dễ / Trung bình / Khó).

Bỏ `?local=1` để chơi online qua Firebase (dự án `vchess-b0dcb` đã cấu hình trong `js/net/firebase-config.js`).

## Đăng lên GitHub Pages

1. Đẩy toàn bộ thư mục lên một repo GitHub (nhánh `main`).
2. Repo → **Settings → Pages** → *Source: Deploy from a branch* → chọn `main` / `/ (root)` → Save.
3. Sau 1–2 phút game chạy tại `https://<tên-tài-khoản>.github.io/<tên-repo>/`.
4. Trong Firebase Console → **Authentication → Settings → Authorized domains** → thêm `<tên-tài-khoản>.github.io` (không có thì đăng nhập sẽ báo lỗi miền).

Tệp `.nojekyll` đã có sẵn để GitHub Pages phục vụ nguyên trạng các tệp.

## Bật Firebase (một lần)

1. **Authentication → Sign-in method**: bật **Email/Password** và **Anonymous** (chế độ khách).
2. **Authentication → Settings → Authorized domains**: thêm tên miền bạn đăng web (Firebase Hosting đã có sẵn; nếu chạy `localhost` thì cũng đã có).
3. **Realtime Database → Rules**: dán nội dung `database.rules.json` rồi bấm Publish.
   Phần `rooms/*` giữ nguyên bộ luật bạn đã viết, **thêm nhánh `rooms/{mã}/days` và `rooms/{mã}/quit` (bắt buộc cho bản 2.0** — chứa mã băm, gói đội hình, mốc khóa/kết thúc ngày, đầu hàng). Các nút khác là **tùy chọn**:
   | Nút | Dùng cho | Nếu thiếu |
   |---|---|---|
   | `rooms/{mã}/chat` | Chat trong phòng và trong trận | Ô chat báo cần bật luật |
   | `lobby` | Danh sách phòng ở sảnh, tìm kiếm | Vẫn vào phòng bằng mã 6 ký tự |
   | `lobbyChat` | Kênh thế giới ở sảnh | Kênh bị ẩn |
   | `users` (+ `.indexOn: rating`) | Hồ sơ, lịch sử, bảng xếp hạng | Hồ sơ lưu cục bộ trên máy |
   | `presence` | Số người online | Không hiện số |
4. Đăng web (tùy chọn) bằng Firebase Hosting:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only hosting,database
   ```
   Hoặc đăng thư mục lên bất kỳ máy chủ tĩnh nào (GitHub Pages, Netlify…). Không cần bước build.

## Cấu trúc mã

```
index.html                 5 màn hình: đăng nhập, sảnh, phòng chờ, màn tải, trận đấu
css/style.css              giao diện fantasy sáng (xanh – vàng)
js/core/data.js            TT.CONFIG (mọi số cân bằng), 11 binh chủng, 4 tộc, 44 quân, thiên phú,
                           Lệnh Soái, 22 trang bị, 55 Lõi, địa hình, lịch 10 ngày, quái, sự kiện
js/core/maps.js            sinh 6 loại bản đồ đối xứng theo seed (40×60 đấu đôi, 68×68 3–4 người)
js/core/prep.js            logic chuẩn bị thuần + tạo/kiểm tra gói đội hình (chống gian lận)
js/core/battle.js          mô phỏng giao tranh xác định 20 tick/giây (tìm đường, kỹ năng, bão)
js/core/match.js           quản lý ván: ngày, thu nhập, bản đồ, điểm
js/core/bot.js             bot 3 mức (Khó mô phỏng 5 biến thể đội hình)
js/net/firebase-config.js  cấu hình Firebase
js/net/db.js               lớp lưu trữ: Firebase RTDB hoặc cục bộ (BroadcastChannel)
js/net/service.js          tài khoản, hồ sơ, sảnh, phòng/ghế, chat, commit–reveal theo ngày
js/ui/models.js            44 mẫu quân 3D khối bo góc + quái, viền đậm, chibi
js/ui/field3d.js           chiến trường 3D: địa hình, camera, hoạt ảnh, VFX, thanh máu
js/ui/icons.js, sound.js   biểu tượng SVG, âm thanh
js/ui/content.js           Hướng dẫn và Bách khoa (đọc số liệu từ data.js)
js/ui/app.js               đăng nhập, sảnh, tạo phòng, phòng chờ (tộc, thiên phú, trang bị đầu)
js/ui/game.js              trận đấu: điều phối ngày, HUD chuẩn bị, giao tranh, kết quả
js/vendor/                 Firebase JS SDK 10.14 (compat) + Three.js r158 — không cần CDN
tests/run-tests.js         `node tests/run-tests.js` — 56 kiểm tra (kinh tế, gói, xác định, ván bot)
tests/balance.js, duel.js  mô phỏng cân bằng tộc / bot
tests/gallery.html         xem 44 mẫu 3D; tests/battle.html xem giao tranh (?mode=2&day=4)
tools/gen-gdd.js           sinh tài liệu thiết kế từ data.js
database.rules.json        luật Realtime Database
```

## Điều khiển trong trận

- **Mua quân**: kéo thẻ ở **Băng ghế** (dưới giữa) thả vào vùng xuất quân sáng màu; thả vào đội cùng loại để thêm quân.
- **Xếp đội**: kéo đội sang ô khác (lên đội cùng loại = gộp, khác loại = đổi chỗ). Kéo về Băng ghế hoặc phím **Delete** để bán (hoàn 100%).
- **Trang bị / Lõi**: cửa hàng bên phải. Kéo trang bị thả lên đội; bấm Lõi để mua; khóa / đổi bảng Lõi.
- **Lên Đời**: nút **+4 EXP** ở bảng thông tin góc trên trái.
- **Bảng Đội** (bấm vào đội): chỉ số thực, tư thế, tách đội, cắm cờ Xanh / Đỏ / Vàng.
- **Camera**: kéo chỗ trống để dời, chuột phải / Shift + kéo để xoay, lăn chuột để phóng to (góc nhìn tự hạ thấp khi phóng to); điện thoại: một ngón dời, hai ngón phóng to / xoay. **H** về góc nhìn mặc định.
- **Sẵn sàng** (Space) khi xong; bấm lại để sửa trước khi khóa. **Ctrl+Z** hoàn tác.
- Giao tranh: tốc độ ×1 / ×2 / ×4 (phím 1/2/4) hoặc bỏ qua.
- Rê chuột / giữ ngón tay lên quân, địa hình, trang bị, Lõi để xem mô tả.
