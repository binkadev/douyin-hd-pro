## Douyin HD Pro v1.0.2

Bản phát hành ổn định đầu tiên được chuẩn hóa để phân phối trên GitHub.

### Điểm chính

- Bắt trực tiếp các luồng media Douyin bằng Chrome DevTools Protocol.
- Tự chấm điểm và ưu tiên bản chất lượng cao nhất được phát hiện.
- Native Helper hỗ trợ tải MP4 bằng HTTP Range song song.
- Hỗ trợ HLS và FFmpeg fallback khi cần remux MPEG-TS.
- Sửa lỗi `Receiving end does not exist` trên Chrome Extension.
- Sửa tương thích PyInstaller 6.22+ khi installer bị khởi chạy từ `System32`.
- Bổ sung gói Windows Full, Extension-only, Source và SHA-256 checksum.

### Chọn file nào?

- **Windows-Full.zip:** dành cho đa số người dùng Windows.
- **Extension-Only.zip:** chỉ cần Extension/fallback Chrome.
- **Source.zip:** dành cho developer hoặc người muốn tự audit/build.
- **douyin_hd_native.exe:** Native Helper độc lập.
- **SHA256SUMS.txt:** kiểm tra toàn vẹn artifact.

> Lưu ý: binary phát hành chưa có Code Signing certificate thương mại nên Windows SmartScreen có thể hiển thị cảnh báo reputation. Người dùng có thể chọn build Native Helper trực tiếp từ source bằng `native/install_windows.bat`.
