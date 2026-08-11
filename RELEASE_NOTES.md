## Douyin HD Pro v2.0.0

v2.0.0 là bản tích hợp lớn, tập trung vào **độ tin cậy khi lướt nhiều video liên tục**, khả năng tùy chỉnh và trải nghiệm như một sản phẩm hoàn chỉnh.

### Nổi bật

- Nhận diện video active theo viewport/play state/video ID/media signature.
- 1 video = 1 session riêng, tự reset stream cũ khi chuyển video.
- State machine rõ: Chờ → Phân tích → Sẵn sàng → Tải → Hoàn tất / Lỗi.
- Card video hiện tại có thumbnail, tiêu đề, tác giả và ID.
- Hàng đợi Native thật: tối đa 2 download song song, tác vụ dư chờ theo thứ tự; vẫn có thể tiếp tục lướt video.
- Lịch sử local + chống tải trùng + mở lại file cũ.
- Chọn quality: cao nhất / 1080p / 720p / nhẹ nhất / hỏi mỗi lần.
- Thư mục tùy chỉnh ở onboarding, main screen và Settings.
- Mẫu filename và subfolder bằng biến `{author}`, `{title}`, `{date}`, `{time}`, `{video_id}`.
- Xác minh file sau download bằng FFprobe khi có, basic verification khi không có.
- Diagnostics Native Helper/version / folder / FFmpeg / FFprobe / Douyin / stream / queue + sao chép báo cáo.
- Update checker chủ động, không chạy nền.
- Export / Import Settings JSON.
- Tùy chỉnh nút tải nổi trên Douyin.
- Tắt lịch sử để dùng theo hướng privacy-first.
- Preset Cá nhân / Làm nội dung / Nghiên cứu / Nâng cao.
- Font Segoe UI Variable / Segoe UI / Noto Sans tối ưu hiển thị tiếng Việt.
- 10 ngôn ngữ được giữ nguyên; Tiếng Việt là mặc định với font hệ thống tối ưu dấu tiếng Việt.

### Gói khuyên dùng

- **Douyin-HD-Pro-v2.0.0-Windows-Full.zip** — Windows 10/11.
- **Extension-Only.zip** — chỉ extension.
- **Source.zip** — source sạch để audit/build.
- **douyin_hd_native.exe** — Native Helper độc lập.
- **SHA256SUMS.txt** — SHA-256 artifacts.

> Native Helper chưa có Code Signing certificate thương mại nên SmartScreen có thể cảnh báo reputation. Source và pipeline build đều công khai.

### Độ tin cậy

- Extension kiểm tra major version của Native Helper trước khi dùng.
- Có smoke test Native và background trong CI/Release pipeline.
- Download hoàn tất được prune khỏi runtime state để hạn chế tăng bộ nhớ khi dùng lâu.
