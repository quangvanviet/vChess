# Tứ Tộc Kỳ Chiến — Webgame online (bản thử nghiệm 1.2)

Webgame chiến thuật theo lượt 2–4 người, chạy hoàn toàn trên trình duyệt. Firebase chỉ làm **sổ ghi lệnh có thứ tự** và nơi lưu phòng; mỗi máy tự chạy cùng một **lõi luật xác định** nên mọi người luôn thấy cùng một bàn cờ (kiểm tra bằng mã băm trạng thái sau mỗi lượt).

## Chạy thử ngay (không cần mạng)

```bash
cd tu-toc-ky-chien
python3 -m http.server 8080
# mở http://localhost:8080/index.html?local=1
```

`?local=1` bật **chế độ demo cục bộ**: mở thêm tab trong cùng trình duyệt để làm người chơi thứ hai/ba/bốn (mỗi tab đăng nhập riêng). Nút **Luyện tập với Bot** cho phép chơi ngay một mình.

Bỏ `?local=1` để chơi online qua Firebase (dự án `vchess-b0dcb` đã cấu hình sẵn trong `js/net/firebase-config.js`).

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
   Phần `rooms/*` giữ nguyên đúng bộ luật bạn đã viết. Các nút thêm vào là **tùy chọn**:
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
css/style.css              giao diện fantasy (tông đen – vàng kim)
js/core/data.js            BalanceConfig, chỉ số quân, 4 tộc (nội tại, kích hoạt, đặc tính)
js/core/engine.js          LÕI LUẬT xác định: init(seed) → apply(state, lệnh) → state + events, hash
js/core/bot.js             bot heuristic dùng chính lõi luật
js/net/firebase-config.js  cấu hình dự án Firebase
js/net/db.js               lớp lưu trữ: Firebase RTDB hoặc demo cục bộ (BroadcastChannel)
js/net/service.js          tài khoản, hồ sơ, sảnh, phòng/ghế, chat, sổ lệnh
js/ui/board.js             bàn cờ 2D (dự phòng khi không có WebGL)
js/ui/board3d.js           bàn cờ 3D Three.js: quân chibi theo tộc, môi trường, VFX, kéo-thả
js/ui/app.js               đăng nhập, sảnh, phòng chờ
js/ui/game.js              màn tải, xúc xắc, đồng bộ lượt, HUD, hoàn tác, hết giờ
js/vendor/                 Firebase JS SDK 10.14 (compat) + Three.js r158 — không cần CDN
tests/run-tests.js         `node tests/run-tests.js`: ca kiểm thử GDD 15.9 + 48 ván bot + replay
database.rules.json        luật Realtime Database
```

## Điều khiển trong trận

- **Mua**: mở tab *Cửa hàng* ở góc dưới phải, **kéo** quân thả vào ô sáng vàng ở hàng spawn (hoặc bấm quân rồi bấm ô, bấm tiếp để mua thêm). Chuột phải/Esc để thôi.
- **Đi/đánh**: **kéo** quân thả vào ô xanh (đi) hoặc mục tiêu đỏ (đánh); hoặc bấm quân → bấm ô. Đi tới ô có mục tiêu → hiện bóng mờ, bấm mục tiêu để đi-rồi-đánh, bấm lại bóng mờ để chỉ đi.
- **Camera 3D**: kéo chỗ trống để xoay, lăn chuột để zoom, 4 nút góc nhìn ở giữa dưới. Nút menu (góc trên trái) → đổi đồ họa 3D/2D.
- **Thu gọn**: dock Kỹ năng/Cửa hàng và khung Nhật ký/Chat đều có nút thu gọn.
- **Q / W / E**: kỹ năng tộc. **Ctrl+Z**: hoàn tác. **Enter**: kết thúc lượt. **Space**: bỏ qua hiệu ứng chờ.
- Rê chuột lên mục tiêu để xem trước sát thương và thưởng.

Thao tác chỉ được gửi lên Firebase một lần khi bấm **Kết thúc lượt** (gói lượt ≤ 6000 ký tự).
