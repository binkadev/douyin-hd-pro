# Native Helper

Native Helper là tiến trình cục bộ nhận lệnh từ Chrome Extension qua Chrome Native Messaging và thực hiện tải file lớn ổn định hơn service worker.

## Host name

```text
com.douyin.hd_pro
```

Extension ID ổn định của bản chính thức:

```text
kfegbbjedamdmoiaomeaaopdeeeeedkm
```

Native manifest chỉ cho phép origin của Extension ID này kết nối helper.

## Cài bản Windows Full

Trong gói Release, chạy file ở thư mục gốc:

```bat
CAI-DAT-WINDOWS.bat
```

Script dùng `native/bin/douyin_hd_native.exe` đã được GitHub Actions build từ source và đăng ký Native Messaging trong HKCU của user hiện tại. Không cần quyền Administrator.

## Tự build từ source

```bat
native\install_windows.bat
```

Script tạo virtual environment tạm, cài PyInstaller rồi build entry point `host.py` (wrapper v1.1.0) và tự đóng gói `host_core.py` là downloader ổn định. Cần Python 3.11+ hoặc `winget` để cài Python khi thiếu.

## Gỡ cài đặt

```bat
native\uninstall_windows.bat
```

Việc gỡ Native Helper không xóa video đã tải, kể cả khi người dùng đã đổi sang thư mục tùy chỉnh.

## Giao thức

Chrome Native Messaging dùng `stdin/stdout`; mỗi JSON UTF-8 được đặt sau 4 byte little-endian biểu diễn độ dài payload.

Action chính:

- `hello`
- `ping`
- `download`
- `open_file`
- `open_folder`
- `get_settings`
- `choose_folder`
- `set_save_folder`

Progress có thể trả `bytes`, `total`, `percent`, `speed`, `speedBps`, `etaSeconds`. Lệnh mở file/thư mục chỉ chấp nhận đường dẫn nằm trong thư mục mặc định hoặc các thư mục người dùng đã chọn qua Douyin HD Pro. Danh sách cho phép được ghi trong cấu hình cục bộ của Native Helper.

Helper không ghi log cookie/token theo mặc định và không có backend trung gian của dự án.

## v1.1.0: thao tác sau khi tải

`host.py` dùng phản hồi có `requestId` cho **Mở video**, **Mở thư mục**, **Đọc cài đặt** và **Chọn thư mục**. Extension chỉ báo thành công sau khi Native Helper xác nhận thao tác, thay vì trả OK ngay khi vừa gửi lệnh.
