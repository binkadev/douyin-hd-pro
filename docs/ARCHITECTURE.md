# Kiến trúc kỹ thuật

Douyin HD Pro v2.0.0 được chia thành ba lớp: Chrome Extension, service worker điều phối và Native Helper cục bộ. Mục tiêu là giữ mỗi video thành một phiên độc lập, không trộn state giữa các video và không cần backend của dự án.

## 1. Chrome Extension

Service worker nạp bốn module bằng `importScripts`:

- `background/core.js`: session, candidate, chấm điểm chất lượng, quét DOM/Performance/JSON/hydration và các tiện ích an toàn.
- `background/capture.js`: Chrome Debugger/CDP, Network events, session epoch, phát hiện response cũ và cầu nối Native Messaging.
- `background/library.js`: preset, lịch sử cục bộ, template tên file/thư mục, import/export settings và update checker theo yêu cầu người dùng.
- `background/download.js`: chọn chất lượng, chống tải trùng, Chrome fallback, activity/history, diagnostics và thao tác file.

State chính của một video:

```text
WAITING → CAPTURING → READY → DOWNLOADING → COMPLETE
                               └────────────→ ERROR
```

Khi Douyin chuyển sang video khác, session epoch tăng, candidate/request cũ bị xóa. Response cũ về muộn không được nhập lại vào phiên mới.

## 2. Nhận diện video đang xem

`content.js` không chọn video đầu tiên trong DOM. Nó chấm điểm các thẻ `<video>` bằng:

- phần trăm đang nằm trong viewport;
- trạng thái đang phát;
- `readyState`;
- khoảng cách tới tâm màn hình.

Context gồm video ID khi có, tiêu đề, tác giả, thumbnail, URL và media signature. Douyin là SPA nên content script theo dõi cả thay đổi URL lẫn DOM/media source.

## 3. Chọn chất lượng

Candidate được hợp nhất theo URL và chấm điểm từ MIME/container, resolution, bitrate, dung lượng, CDN/source hint và watermark hint. UI không hiển thị score nội bộ; người dùng thấy resolution, bitrate, dung lượng và quality label.

Các policy: cao nhất, ưu tiên 1080p, ưu tiên 720p, file nhỏ nhất hoặc chọn mỗi lần.

## 4. Download activity và hàng đợi

Các download đang chạy được lưu trong service worker để popup hiển thị Activity. Native Helper giới hạn tối đa hai tác vụ tải đồng thời; tác vụ dư được giữ ở trạng thái `queued` và bắt đầu khi có slot trống. Người dùng có thể chuyển sang video khác trong lúc file trước tiếp tục tải.

Lịch sử hoàn tất được lưu trong `chrome.storage.local` khi người dùng bật tính năng này. Có thể tắt hoàn toàn hoặc xóa lịch sử bất cứ lúc nào.

## 5. Native Messaging

Host name:

```text
com.douyin.hd_pro
```

Extension ID chính thức:

```text
kfegbbjedamdmoiaomeaaopdeeeeedkm
```

Native Helper v2 hỗ trợ:

- custom save folder bằng Windows folder picker;
- folder/subfolder template đã sanitize;
- HTTP Range song song và HLS từ `host_core.py`;
- hàng đợi tải có giới hạn concurrency;
- verify file bằng FFprobe khi có, basic container check khi không có;
- mở file/thư mục có whitelist;
- diagnostics FFmpeg/FFprobe/folder permission;
- request/response có `requestId` cho thao tác tương tác.

Extension chỉ dùng Native Helper cùng major version 2.x. Nếu Helper cũ, download tự fallback qua Chrome và UI yêu cầu cài lại Helper.

## 6. Lưu file và ranh giới đường dẫn

Native Helper lưu vào folder do người dùng chọn. Mẫu thư mục con bị tách thành từng segment, loại ký tự cấm và giới hạn depth; đường dẫn cuối phải nằm dưới root đã cho phép.

Các lệnh mở file/thư mục chỉ được phép với root mặc định hoặc folder người dùng từng chọn bằng Douyin HD Pro.

Chrome fallback không thể ghi vào đường dẫn tuyệt đối tùy ý; nó dùng `Downloads/DouyinHD/...` theo giới hạn của Chrome Downloads API.

## 7. Xác minh file

Sau khi Native Helper tải xong:

1. kiểm tra file tồn tại và kích thước hợp lệ;
2. kiểm tra container cơ bản;
3. nếu có FFprobe, đọc duration, video/audio stream, codec và resolution;
4. trả metadata verification về popup.

Dự án không vượt DRM/mã hóa. HLS có encryption không được giải mã bằng cơ chế né bảo vệ.

## 8. Quyền riêng tư

Không có backend của dự án, analytics hay telemetry. Update checker chỉ gọi GitHub API khi người dùng bấm **Kiểm tra cập nhật**. Lịch sử tải và settings nằm cục bộ trong Chrome/Native Helper.
