# Tứ Tộc Kỳ Chiến 3.0 — Webgame auto-battler online

Cờ **tự động đánh** 2–4 người, 10 ngày, 4 tộc, chạy hoàn toàn trên trình duyệt. Mỗi ngày mọi người **cùng lúc chuẩn bị** (mua tướng và lính, trang bị, Lõi bằng Vàng, lên Đời, xếp đạo quân, cắm cờ hành quân) rồi xem **giao tranh tự động** trên chiến trường 3D. Firebase chỉ lưu phòng và các gói đội hình theo kiểu **commit–reveal**; mỗi máy tự chạy cùng một **mô phỏng xác định** nên ai cũng thấy cùng một trận.

Thiết kế đầy đủ: `tu-toc-ky-chien-gdd-3.0.md` (sinh lại từ số liệu thật bằng `node tools/gen-gdd.js`). Bản luật 1.x cũ (tham khảo): `tu-toc-ky-chien-gdd.md`.

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
js/ui/models.js            44 mẫu quân 3D low-poly chibi (tướng/lính) + quái: tay chân capsule, da/vải mượt, giáp/vũ khí mặt phẳng, viền
js/ui/field3d.js           chiến trường 3D: địa hình, camera, hoạt ảnh, VFX, thanh máu
js/ui/icons.js, sound.js   biểu tượng SVG, âm thanh
js/ui/content.js           Hướng dẫn và Bách khoa (đọc số liệu từ data.js)
js/ui/app.js               đăng nhập, sảnh, tạo phòng, phòng chờ (tộc, thiên phú, trang bị đầu)
js/ui/game.js              trận đấu: điều phối ngày, HUD chuẩn bị, giao tranh, kết quả
js/vendor/                 Firebase JS SDK 10.14 (compat) + three-bundle.min.js (Three.js r158 + HDRI + hậu kỳ) — không cần CDN
assets/hdri/                ánh sáng môi trường HDRI (Poly Haven, CC0)
tools/build.js             bản phát hành: gộp + làm rối mã + khoá tên miền → dist/
tests/run-tests.js         `node tests/run-tests.js` — 63 kiểm tra (Vàng, tướng/lính, tủ đồ, gói chống gian lận, ván bot)
tests/fuzz.js              thao tác ngẫu nhiên → gói → kiểm tra lại phải khớp
tests/balance.js, duel.js  mô phỏng cân bằng tộc / bot
tests/gallery.html         xem 44 mẫu 3D; tests/battle.html xem giao tranh (?mode=2&day=4)
tools/gen-gdd.js           sinh tài liệu thiết kế từ data.js
database.rules.json        luật Realtime Database
```

## Điều khiển trong trận (chỉ cần chạm / chuột trái)

- **Thanh dưới** gộp mọi thứ cần mua, có 3 tab (vuốt ngang nếu nhiều thẻ): **Tướng** · **Lõi** · **Trang bị**. Giá là số trong nền tròn ở góc trên trái icon; rê chuột hoặc chạm để xem thông tin.
- **Mua tướng**: chạm thẻ rồi chạm vùng xuất quân (hoặc kéo thả). Mỗi tướng là một đạo quân.
- **Mua lính**: chạm một tướng trên sân → thanh dưới chuyển sang tab **Lính** của tướng đó → chạm icon lính (hoặc **+5** / **Tối đa**); lính tự nhập vào đạo quân.
- **Menu tướng** (hiện trên đầu tướng khi chọn): Di chuyển · Chiến thuật · Hành quân (cắm cờ Xanh / Đỏ / Vàng) · + Lính. Bảng thông tin tự đặt sang bên không che tướng; điện thoại có nút **Chi tiết**.
- **Bán**: trong bảng tướng — **Bán lính** (kéo / gõ số lượng, Bán hết) hoặc **Bán tướng** (cả đạo quân + trang bị đang đeo). Hoàn 100% giá mua.
- **Trang bị**: đang chọn tướng thì mua xong đeo ngay (tối đa 3); không thì vào **tủ đồ 9 ô** (bên phải thanh dưới). **Lõi** mua là có hiệu lực ngay.
- **Lên Đời**: nút tròn **Đời** ở góc trái thanh dưới (phím F).
- **Camera**: kéo chỗ trống để dời, chuột phải / Shift + kéo để xoay, lăn chuột để phóng to; điện thoại: một ngón dời, hai ngón phóng to / xoay. **H** về góc nhìn mặc định.
- **Sẵn sàng** (Space) khi xong; bấm lại để sửa trước khi khóa. **Ctrl+Z** hoàn tác. **Q** đổi tab, **D** Lõi/Trang bị, **Esc** bỏ chọn.
- Giao tranh: giao diện tự trượt ra ngoài cho thoáng; tốc độ ×1 / ×2 / ×4 (phím 1/2/4) hoặc bỏ qua.
- Rê chuột / giữ ngón tay lên quân, địa hình, trang bị, Lõi để xem mô tả.


## Bảo vệ mã nguồn khi đăng web (khuyến nghị)

Mã chạy trên trình duyệt **không thể giấu tuyệt đối** — trình duyệt phải tải được mã thì mới chạy được. Bản dựng phát hành làm cho việc lấy về, đọc hiểu, sửa và dựng lại trên web khác **tốn công hơn rất nhiều**:

```bash
npm i                                                    # một lần: esbuild + javascript-obfuscator
node tools/build.js --domain=tenban.github.io,tenban.web.app
# đăng thư mục dist/ (KHÔNG đăng thư mục gốc chứa mã nguồn)
```

Dùng Firebase Hosting thì sửa `firebase.json` → `"public": "dist"` rồi `firebase deploy`. Dùng GitHub Pages thì đẩy nội dung `dist/` lên nhánh/repo dùng cho Pages.

Bản dựng làm gì:
- Gộp 16 file mã game thành **một file** tên ngẫu nhiên, thu gọn, **làm rối** (đổi tên biến thành mã hex, mã hoá chuỗi, làm phẳng luồng điều khiển nhẹ, **tự vệ**: định dạng lại / sửa file thì ngừng chạy).
- **Khoá tên miền**: chép `dist/` sang web khác (hoặc mở bằng file:///) sẽ ra trang trắng. Thêm `--nolocal` để cấm cả localhost.
- Chặn web lạ **nhúng** trang của bạn vào iframe.
- Bỏ chú thích HTML, thu gọn CSS, tên file theo mã băm.
- Tuỳ chọn `--light`: làm rối nhẹ hơn nếu máy yếu thấy chậm.

Việc nên làm thêm ở Firebase Console (chống dùng trộm dự án Firebase của bạn):
1. **Authentication → Settings → Authorized domains**: chỉ để tên miền của bạn (xoá các miền không dùng).
2. **App Check** (reCAPTCHA v3/Enterprise) → bật **Enforce** cho Realtime Database: web nhái dùng chung cấu hình Firebase sẽ bị từ chối.
3. **Google Cloud Console → APIs & Services → Credentials**: giới hạn API key theo *HTTP referrer* là tên miền của bạn.
4. Luật Realtime Database (`database.rules.json`) chỉ cho ghi đúng ghế của mình — đã có sẵn, nhớ **Publish**.
5. Đặt repo GitHub ở chế độ **Private** nếu dùng GitHub Pages trả phí / hoặc dùng Firebase Hosting (chỉ đăng `dist/`).

Gian lận trong trận đã được chặn ở tầng luật chơi: mỗi máy tự kiểm tra lại gói đội hình của đối thủ (ngân sách Vàng, Đời, trang bị, Lõi, vị trí) — gói sai bị loại.
