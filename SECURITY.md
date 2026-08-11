# Security Policy

## Phiên bản được hỗ trợ

| Version | Supported |
|---|---|
| 1.0.3 | ✅ |
| 1.0.2 | Security fixes only |
| < 1.0.2 | ❌ |

## Báo cáo lỗ hổng

Không đăng công khai credential, cookie, token, request header nhạy cảm hoặc signed media URL trong Issue.

Khi báo lỗi bảo mật, hãy mô tả phiên bản Douyin HD Pro, Chrome/Windows, các bước tái hiện, tác động và log đã được xóa dữ liệu nhạy cảm.

## Mô hình bảo mật

Extension dùng `debugger` và `nativeMessaging`, vì vậy chỉ nên cài từ repository/release chính thức hoặc tự audit source. Native Helper được đăng ký trong HKCU cho user hiện tại và chỉ cho phép origin của Extension ID cố định.

Từ v1.0.3, hành động `open_file` và `open_folder` của Native Helper chỉ chấp nhận đường dẫn bên trong `Downloads\DouyinHD`, giảm khả năng bị lạm dụng để mở đường dẫn tùy ý.

Dự án không triển khai DRM bypass, giải mã stream được bảo vệ hoặc cơ chế né kiểm soát truy cập.
