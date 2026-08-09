# Security Policy

## Phiên bản được hỗ trợ

Hiện tại dự án tập trung hỗ trợ nhánh phát hành mới nhất.

| Version | Supported |
|---|---|
| 1.0.2 | ✅ |
| < 1.0.2 | ❌ |

## Báo cáo lỗ hổng

Không đăng công khai credential, cookie, token, request header nhạy cảm hoặc URL media có chữ ký trong Issue.

Khi báo lỗi bảo mật, hãy mô tả:

- phiên bản Douyin HD Pro;
- phiên bản Chrome/Windows;
- các bước tái hiện;
- tác động bảo mật;
- log đã được xóa cookie/token/URL nhạy cảm.

## Mô hình bảo mật

Extension sử dụng quyền `debugger` và `nativeMessaging`, do đó người dùng chỉ nên cài source/release từ repository chính thức hoặc tự audit source trước khi dùng. Native Helper được đăng ký trong HKCU cho user hiện tại và chỉ cho phép origin của Extension ID cố định.
