## Douyin HD Pro v2.0.1

v2.0.1 là bản hotfix cho trình cài đặt Windows, tập trung vào lỗi nâng cấp Native Helper khi bản cũ vẫn đang được Chrome sử dụng.

### Sửa lỗi quan trọng

- Sửa lỗi `Copy-Item: The process cannot access the file ... douyin_hd_native.exe because it is being used by another process` khi cài đè hoặc nâng cấp.
- Installer tự nhận diện đúng tiến trình Native Helper đang chạy từ `%LOCALAPPDATA%\DouyinHDPro` và dừng tiến trình cũ trước khi thay executable.
- Dùng file staging `douyin_hd_native.new.exe` để tránh ghi đè trực tiếp lên executable đang hoạt động.
- Có cơ chế retry nhiều lần khi Windows Defender/antivirus hoặc hệ thống còn giữ file trong thời gian ngắn.
- Nếu vẫn không thể thay file, installer báo hướng xử lý cụ thể: đóng Chrome hoàn toàn rồi chạy lại, thay vì dừng ở lỗi PowerShell khó hiểu.
- Áp dụng cùng cơ chế an toàn cho cả bản Windows Full và luồng tự build Native Helper từ source.
- Kiểm tra mã trả về khi đăng ký Native Messaging Host trong Registry.
- Nhắc rõ trình cài đặt **không cần Run as administrator**.

### Không thay đổi nghiệp vụ tải video

Toàn bộ cơ chế v2.0.0 vẫn được giữ nguyên: session riêng cho từng video, reset khi chuyển video, hàng đợi tải, lịch sử, chống tải trùng, quality manager, thư mục tùy chỉnh, diagnostics, 10 ngôn ngữ và giao diện tiếng Việt.

### Gói khuyên dùng

- **Douyin-HD-Pro-v2.0.1-Windows-Full.zip** — Windows 10/11, khuyên dùng.
- **Extension-Only.zip** — chỉ extension.
- **Source.zip** — source để audit/build.
- **douyin_hd_native.exe** — Native Helper độc lập.
- **SHA256SUMS.txt** — checksum SHA-256.

> Native Helper chưa có Code Signing certificate thương mại nên SmartScreen vẫn có thể cảnh báo reputation. Source và pipeline build đều công khai.
