# Security Policy

## Phiên bản được hỗ trợ

| Version | Trạng thái |
|---|---|
| 2.0.x | ✅ Hỗ trợ đầy đủ |
| 1.1.x | Security fixes khi cần |
| 1.0.x | ❌ Đã hết hỗ trợ |

## Báo cáo lỗ hổng

Không đăng công khai cookie, credential, token, signed media URL hoặc request header nhạy cảm trong Issue. Khi báo lỗi, hãy gửi version, Chrome/Windows, bước tái hiện, tác động và log đã được loại dữ liệu nhạy cảm.

## Mô hình bảo mật

Extension dùng quyền mạnh `debugger` và `nativeMessaging`; chỉ nên cài từ repository/release chính thức hoặc tự audit source.

Native Helper:

- đăng ký trong HKCU của user hiện tại;
- Native Messaging manifest chỉ cho Extension ID cố định;
- chỉ mở file trong root mặc định hoặc folder người dùng đã chọn qua tool;
- sanitize subfolder/template và chặn traversal;
- chỉ nhận URL tải `http/https`;
- không tự giải mã stream được bảo vệ.

Extension yêu cầu Native Helper cùng major version để tránh giao thức cũ hoạt động sai. Nếu không tương thích, native path bị bỏ qua và download có thể fallback qua Chrome.

Dự án không triển khai DRM bypass, credential theft, spyware hoặc cơ chế né kiểm soát truy cập.
