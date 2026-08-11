# Hướng dẫn cài nhanh Douyin HD Pro v1.0.3

## Dành cho Windows 10/11

1. Giải nén toàn bộ gói `Douyin-HD-Pro-v1.0.3-Windows-Full.zip`.
2. Chạy `CAI-DAT-WINDOWS.bat`. Không cần **Run as administrator**.
3. Chrome sẽ mở `chrome://extensions`.
4. Bật **Chế độ dành cho nhà phát triển**.
5. Chọn **Tải tiện ích đã giải nén** và chọn thư mục `extension` nằm trong gói vừa giải nén.
6. Mở Douyin, phát video 2–3 giây và bấm **↓ Tải HD** hoặc mở popup Douyin HD Pro để chọn chất lượng.

Video được lưu mặc định tại:

`%USERPROFILE%\Downloads\DouyinHD`

## Ngôn ngữ

Mặc định công cụ dùng **Tiếng Việt**. Trong popup, bạn có thể đổi giữa 10 ngôn ngữ: Tiếng Việt, English, 简体中文, 繁體中文, 한국어, 日本語, ไทย, Bahasa Indonesia, Español và Français.

## Windows SmartScreen

Native Helper được build tự động từ source công khai bằng GitHub Actions nhưng chưa có chứng thư Code Signing thương mại, vì vậy Windows SmartScreen có thể hiển thị cảnh báo reputation. Nếu muốn tự audit/build, chạy `native\install_windows.bat` thay cho bản prebuilt.
