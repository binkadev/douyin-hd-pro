## Douyin HD Pro v2.0.2

v2.0.2 tập trung vào hai mục tiêu: **khóa đúng video đang xem** và **tăng tốc tải an toàn bằng Adaptive Range v2**.

### Sửa lỗi tải nhầm video

- Khóa session vào `aweme_id` của URL `/video/<id>` khi có.
- Candidate chỉ được chấp nhận từ media element đang active hoặc API node có `aweme_id` khớp chính xác.
- Không dùng generic preload/recommendation media làm candidate tải.
- Kiểm tra lại video hiện tại ngay trước khi tải; nếu người dùng đã chuyển video, tác vụ bị chặn.
- Ưu tiên 0 candidate hơn tải một candidate chưa xác minh.

### Adaptive Range v2 — tăng tốc tải

- Hạ ngưỡng tải song song từ 16 MiB xuống 4 MiB, nên video ngắn 8–12 MiB cũng có thể tận dụng nhiều kết nối.
- Tự chọn 4 / 6 / 10 / 16 / 24 Range connections theo dung lượng file.
- Range tối thiểu khoảng 1.5 MiB để tránh tạo quá nhiều request nhỏ.
- Block I/O tăng lên 2 MiB để giảm overhead Python/file write.
- Retry 4 lần và resume từ byte đã tải của từng range.
- Nếu CDN từ chối hoặc throttling Range bất thường, tự fallback sang một kết nối bình thường.
- HLS tăng tối đa 20 segment workers tùy số segment.
- Đồng hồ tốc độ bắt đầu sau bước probe Range để MB/s hiển thị sát tốc độ truyền thật hơn.

### Độ an toàn

- Không thay đổi cơ chế DRM/encryption: tool không vượt luồng mã hóa.
- Native Helper v2.0.2 vẫn tương thích cùng major v2 và giữ installer nâng cấp an toàn của v2.0.1.

### Gói khuyên dùng

- **Douyin-HD-Pro-v2.0.2-Windows-Full.zip** — Windows 10/11, khuyên dùng.
- **Extension-Only.zip** — chỉ Chrome Extension.
- **Source.zip** — source để audit/build.
- **douyin_hd_native.exe** — Native Helper độc lập.
- **SHA256SUMS.txt** — checksum SHA-256.

> Tốc độ thực tế vẫn phụ thuộc băng thông mạng, CDN, vị trí máy chủ và giới hạn theo kết nối. Adaptive Range có lợi rõ nhất khi CDN giới hạn tốc độ trên từng connection.
