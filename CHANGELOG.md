# Changelog

Tất cả thay đổi đáng chú ý của Douyin HD Pro được ghi tại đây.

## [1.0.2] - 2026-08-09

### Fixed
- Sửa lỗi `Could not establish connection. Receiving end does not exist` khi background gửi trạng thái tới tab không có content script.
- Không tạo session giả cho tab ngoài Douyin.
- Bọc Promise rejection khi broadcast trạng thái sang content script.
- Sửa installer với PyInstaller 6.22+: luôn chuyển working directory khỏi `C:\Windows\System32` trước khi build.

### Changed
- Chuẩn hóa tài liệu tiếng Việt cho bản GitHub.
- Bổ sung quy trình đóng gói Release, checksum và gói Extension-only / Windows Full / Source.

## [1.0.1] - 2026-08-09

### Fixed
- Sửa quy trình build Native Helper khi installer được khởi chạy từ working directory không phù hợp.

## [1.0.0] - 2026-08-09

### Added
- Chrome Extension Manifest V3.
- Bắt media bằng Chrome DevTools Protocol.
- Quét DOM, performance entries, JSON API và hydration data.
- Chấm điểm và chọn ứng viên chất lượng cao nhất.
- Native Messaging Host trên Windows.
- Tải MP4 bằng HTTP Range song song.
- HLS fallback và hỗ trợ remux qua FFmpeg khi phù hợp.
- Chrome downloads fallback.
