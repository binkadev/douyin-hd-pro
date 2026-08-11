# Native Helper

Native Helper v2.0.0 nhận lệnh từ Chrome qua Native Messaging và xử lý tải file, custom folder, verify và thao tác Windows.

## Định danh

Host:

```text
com.douyin.hd_pro
```

Extension ID:

```text
kfegbbjedamdmoiaomeaaopdeeeeedkm
```

## Cài đặt

Bản Windows Full:

```bat
CAI-DAT-WINDOWS.bat
```

Tự build source:

```bat
native\install_windows.bat
```

Không cần Administrator. Native manifest/registry nằm ở HKCU.

## Tính năng v2

- folder picker Windows và ghi nhớ save folder;
- whitelist các root người dùng đã cho phép;
- sanitize subfolder template;
- direct/HTTP Range/HLS downloader từ `host_core.py`;
- tối đa 2 download đồng thời, phần còn lại ở trạng thái queued;
- verify bằng FFprobe nếu có;
- diagnostics folder/FFmpeg/FFprobe;
- mở file/folder bằng request/response có `requestId`;
- protocol major-version check từ Extension.

## Action Native

- `hello`, `ping`
- `download`
- `get_settings`, `choose_folder`, `set_save_folder`, `reset_settings`
- `open_file`, `open_folder`
- `verify_file`
- `diagnostics`

Download event: `queued`, `started`, `progress`, `merging`, `verifying`, `complete`, `error`.

## Bảo mật

Helper chỉ mở đường dẫn nằm dưới folder mặc định hoặc folder người dùng đã chọn. Relative folder được sanitize và bắt buộc nằm dưới root save folder. URL download phải là HTTP/HTTPS.

Không có backend trung gian và không ghi log cookie/token theo mặc định.
