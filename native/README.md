# Native Helper

Native Helper là tiến trình cục bộ nhận lệnh từ Chrome Extension qua Native Messaging và thực hiện tải file lớn ổn định hơn service worker.

## Host name

```text
vn.binkadev.douyin_hd_pro
```

## Cài từ source

```bat
install_windows.bat
```

Cần Python 3.10+ và Internet ở bước đầu để cài PyInstaller vào virtual environment tạm.

## Cài bản prebuilt

Đặt `douyin_hd_native.exe` trong `native/bin/`, sau đó chạy:

```bat
install_prebuilt_windows.bat
```

## Extension ID

Installer hỏi Extension ID đang hiển thị ở `chrome://extensions`. ID được ghi vào `allowed_origins` của native manifest để chỉ extension đó được phép kết nối helper.

## Gỡ cài đặt

```bat
uninstall_windows.bat
```

Gỡ helper/registry nhưng không xóa video đã tải trong `Downloads\DouyinHD`.

## Giao thức

Chrome Native Messaging dùng `stdin/stdout`. Mỗi message là JSON UTF-8 đứng sau 4 byte little-endian biểu diễn độ dài payload.

Các action hiện có:

- `ping`
- `download`
- `open_folder`

Helper không ghi log chứa cookie/token theo mặc định.
