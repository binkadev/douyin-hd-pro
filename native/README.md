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

Script tạo virtual environment tạm, cài PyInstaller rồi build entry point `host_v104.py` (tái sử dụng downloader ổn định trong `host.py`). Cần Python 3.11+ hoặc `winget` để cài Python khi thiếu.

## Gỡ cài đặt

```bat
native\uninstall_windows.bat
```

Việc gỡ Native Helper không xóa video trong `Downloads\DouyinHD`.

## Giao thức

Chrome Native Messaging dùng `stdin/stdout`; mỗi JSON UTF-8 được đặt sau 4 byte little-endian biểu diễn độ dài payload.

Action chính:

- `hello`
- `ping`
- `download`
- `open_file`
- `open_folder`

Progress có thể trả `bytes`, `total`, `percent`, `speed`, `speedBps`, `etaSeconds`. Lệnh mở file/thư mục chỉ chấp nhận đường dẫn nằm bên trong `Downloads\DouyinHD`.

Helper không ghi log cookie/token theo mặc định và không có backend trung gian của dự án.


## v1.0.4: thao tác sau khi tải

`host_v104.py` bổ sung phản hồi có `requestId` cho **Mở video** và **Mở thư mục**. Extension chỉ báo thành công sau khi Native Helper xác nhận thao tác, thay vì trả OK ngay khi vừa gửi lệnh.
