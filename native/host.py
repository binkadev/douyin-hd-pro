#!/usr/bin/env python3
"""Douyin HD Pro Native Helper v2.0.0.

Native Messaging host for Windows-first high-speed downloads. It keeps the
existing battle-tested downloader core and adds user-selected folders,
subfolder templates, file verification, diagnostics, and reliable operations.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

import host_core as core

HOST_VERSION = '2.0.0'
MAX_CONCURRENT_DOWNLOADS = 2
DOWNLOAD_GATE = threading.Semaphore(MAX_CONCURRENT_DOWNLOADS)
QUEUE_LOCK = threading.Lock()
QUEUE_WAITING = 0
QUEUE_ACTIVE = 0
_old_handle = core.handle


def default_downloads_root():
    return (Path.home() / 'Downloads' / 'DouyinHD').resolve()


def settings_file():
    base = Path(os.environ.get('LOCALAPPDATA') or (Path.home() / '.douyin-hd-pro'))
    return base / 'DouyinHDPro' / 'settings.json'


def load_settings():
    default = str(default_downloads_root())
    data = {'saveFolder': default, 'allowedFolders': [default]}
    try:
        f = settings_file()
        if f.exists():
            raw = json.loads(f.read_text(encoding='utf-8'))
            if isinstance(raw, dict):
                folder = str(raw.get('saveFolder') or default)
                allowed = raw.get('allowedFolders') if isinstance(raw.get('allowedFolders'), list) else []
                data['saveFolder'] = folder
                data['allowedFolders'] = [str(x) for x in allowed if x] or [folder, default]
    except Exception:
        pass
    for p in (default, data['saveFolder']):
        if p not in data['allowedFolders']:
            data['allowedFolders'].append(p)
    return data


def save_settings(data):
    f = settings_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def reset_native_settings():
    default = str(default_downloads_root())
    data = {'saveFolder': default, 'allowedFolders': [default]}
    Path(default).mkdir(parents=True, exist_ok=True)
    save_settings(data)
    return Path(default).resolve()


def remember_folder(folder):
    if not folder:
        raise RuntimeError('Đường dẫn thư mục không hợp lệ.')
    p = Path(folder).expanduser().resolve()
    p.mkdir(parents=True, exist_ok=True)
    data = load_settings()
    data['saveFolder'] = str(p)
    allowed = [str(p)] + [str(x) for x in data.get('allowedFolders', []) if str(x) != str(p)]
    data['allowedFolders'] = allowed[:12]
    save_settings(data)
    return p


def downloads_root():
    data = load_settings()
    try:
        p = Path(data.get('saveFolder') or default_downloads_root()).expanduser().resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p
    except Exception:
        p = default_downloads_root()
        p.mkdir(parents=True, exist_ok=True)
        return p


def choose_folder(initial_path=''):
    if os.name != 'nt':
        raise RuntimeError('Tùy chỉnh thư mục hiện hỗ trợ tốt nhất trên Windows.')
    initial = str(initial_path or downloads_root())
    script = r'''Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Chọn thư mục lưu video - Douyin HD Pro'
$dlg.ShowNewFolderButton = $true
if ($env:DYHD_INITIAL -and (Test-Path -LiteralPath $env:DYHD_INITIAL)) { $dlg.SelectedPath = $env:DYHD_INITIAL }
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dlg.SelectedPath
}'''
    env = os.environ.copy()
    env['DYHD_INITIAL'] = initial
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    r = subprocess.run(
        ['powershell.exe', '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
        capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180,
        env=env, creationflags=flags,
    )
    selected = (r.stdout or '').strip().splitlines()
    return remember_folder(selected[-1].strip()) if selected else None


def allowed_roots():
    roots = []
    for raw in load_settings().get('allowedFolders', []):
        try:
            roots.append(Path(raw).expanduser().resolve())
        except Exception:
            pass
    default = default_downloads_root()
    if default not in roots:
        roots.append(default)
    return roots


def safe_open_path(raw_path):
    if not raw_path:
        raise RuntimeError('Đường dẫn tệp không hợp lệ.')
    p = Path(raw_path).expanduser().resolve()
    for root in allowed_roots():
        try:
            p.relative_to(root)
            return p
        except ValueError:
            continue
    raise RuntimeError('Tệp không thuộc thư mục đã được Douyin HD Pro cho phép.')


def open_file(raw_path):
    p = safe_open_path(raw_path)
    if not p.exists() or not p.is_file():
        raise RuntimeError('Không tìm thấy tệp đã tải. Có thể tệp đã bị di chuyển hoặc xóa.')
    if os.name == 'nt':
        os.startfile(str(p))
    elif sys.platform == 'darwin':
        subprocess.Popen(['open', str(p)])
    else:
        subprocess.Popen(['xdg-open', str(p)])


def open_folder(raw_path=''):
    root = downloads_root()
    root.mkdir(parents=True, exist_ok=True)
    p = safe_open_path(raw_path) if raw_path else root
    target = p if p.is_dir() else p.parent
    if os.name == 'nt':
        if p.exists() and p.is_file():
            subprocess.Popen(['explorer.exe', '/select,', str(p)])
        else:
            os.startfile(str(target))
    elif sys.platform == 'darwin':
        subprocess.Popen(['open', str(target)])
    else:
        subprocess.Popen(['xdg-open', str(target)])


def clean_segment(value):
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', str(value or '')).strip(' .')
    value = re.sub(r'\s+', ' ', value)
    if not value or value in {'.', '..'}:
        return '_'
    return value[:100]


def destination_folder(relative=''):
    root = downloads_root()
    parts = [clean_segment(p) for p in re.split(r'[\\/]+', str(relative or '')) if p.strip()][:6]
    p = root.joinpath(*parts).resolve() if parts else root
    try:
        p.relative_to(root)
    except ValueError:
        raise RuntimeError('Mẫu thư mục con không hợp lệ.')
    p.mkdir(parents=True, exist_ok=True)
    return p


def probe_version(binary):
    path = shutil.which(binary)
    if not path:
        return None, ''
    try:
        r = subprocess.run([path, '-version'], capture_output=True, text=True, errors='replace', timeout=8,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        line = (r.stdout or r.stderr or '').splitlines()[0][:180]
        return path, line
    except Exception:
        return path, ''


def verify_file(path):
    p = Path(path)
    result = {'ok': False, 'method': 'basic', 'size': 0, 'container': p.suffix.lower().lstrip('.')}
    if not p.exists() or not p.is_file():
        result['error'] = 'Tệp không tồn tại sau khi tải.'
        return result
    size = p.stat().st_size
    result['size'] = size
    if size < 1024:
        result['error'] = 'Tệp quá nhỏ để là video hợp lệ.'
        return result
    basic_ok = True
    try:
        with p.open('rb') as f:
            head = f.read(64)
        if p.suffix.lower() in {'.mp4', '.m4v', '.mov'}:
            basic_ok = b'ftyp' in head
        elif p.suffix.lower() == '.ts':
            basic_ok = head[:1] == b'G'
    except Exception:
        basic_ok = False
    ffprobe = shutil.which('ffprobe')
    if ffprobe:
        try:
            cmd = [ffprobe, '-v', 'error', '-show_entries',
                   'format=duration,format_name:stream=codec_type,codec_name,width,height',
                   '-of', 'json', str(p)]
            r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if r.returncode == 0:
                data = json.loads(r.stdout or '{}')
                streams = data.get('streams') or []
                videos = [x for x in streams if x.get('codec_type') == 'video']
                audios = [x for x in streams if x.get('codec_type') == 'audio']
                fmt = data.get('format') or {}
                result.update({
                    'ok': bool(videos), 'method': 'ffprobe',
                    'duration': float(fmt.get('duration') or 0),
                    'container': str(fmt.get('format_name') or result['container']),
                    'videoCodec': str(videos[0].get('codec_name') or '') if videos else '',
                    'audioCodec': str(audios[0].get('codec_name') or '') if audios else '',
                    'hasVideo': bool(videos), 'hasAudio': bool(audios),
                    'width': int(videos[0].get('width') or 0) if videos else 0,
                    'height': int(videos[0].get('height') or 0) if videos else 0,
                })
                if not result['ok']:
                    result['error'] = 'FFprobe không tìm thấy video stream.'
                return result
        except Exception as e:
            result['ffprobeError'] = str(e)[:300]
    result.update({'ok': bool(basic_ok), 'hasVideo': bool(basic_ok), 'hasAudio': None, 'method': 'basic'})
    if not basic_ok:
        result['error'] = 'Không nhận diện được cấu trúc tệp video.'
    return result


def download_audio(url, headers, output):
    h = core.normalize_headers(headers or {})
    with core.request(url, h, None, timeout=35) as r, open(output, 'wb') as f:
        shutil.copyfileobj(r, f, 1024 * 1024)
    return output


def merge_audio_if_needed(video_path, msg, download_id):
    audio_url = str(msg.get('audioUrl') or '')
    if not audio_url:
        return video_path
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        return video_path
    temp_dir = Path(tempfile.mkdtemp(prefix='dyhd_merge_'))
    try:
        audio = temp_dir / 'audio.m4a'
        download_audio(audio_url, msg.get('audioHeaders') or msg.get('headers') or {}, audio)
        merged = video_path.with_name(video_path.stem + '.merged' + video_path.suffix)
        core.send_message({'type': 'merging', 'downloadId': download_id, 'percent': 99})
        cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(video_path), '-i', str(audio),
               '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-movflags', '+faststart', str(merged)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if r.returncode == 0 and merged.exists() and merged.stat().st_size > 1024:
            video_path.unlink(missing_ok=True)
            merged.rename(video_path)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    return video_path


def download_worker_v2(msg):
    download_id = msg.get('downloadId') or f'dl-{int(core.time.time())}'
    try:
        folder = destination_folder(msg.get('relativeFolder') or '')
        core.send_message({'type': 'started', 'downloadId': download_id, 'queueIndex': msg.get('queueIndex') or 0})
        out = core.direct_download(msg, folder)
        out = merge_audio_if_needed(out, msg, download_id)
        core.send_message({'type': 'verifying', 'downloadId': download_id, 'percent': 100})
        verification = verify_file(out)
        size = out.stat().st_size if out.exists() else 0
        core.send_message({
            'type': 'complete', 'downloadId': download_id, 'filename': out.name, 'path': str(out),
            'bytes': size, 'total': size, 'percent': 100, 'verified': bool(verification.get('ok')),
            'verification': verification
        })
    except (core.HTTPError, core.URLError) as e:
        core.send_message({'type': 'error', 'downloadId': download_id, 'errorCode': 'NETWORK', 'error': f'Lỗi mạng/CDN: {e}'})
    except PermissionError as e:
        core.send_message({'type': 'error', 'downloadId': download_id, 'errorCode': 'FOLDER_PERMISSION', 'error': f'Không có quyền ghi vào thư mục lưu: {e}'})
    except Exception as e:
        core.send_message({'type': 'error', 'downloadId': download_id, 'errorCode': 'DOWNLOAD_FAILED', 'error': str(e)})
    finally:
        with core.ACTIVE_LOCK:
            core.ACTIVE.discard(threading.current_thread())


def queued_download_worker(msg):
    global QUEUE_WAITING, QUEUE_ACTIVE
    download_id = msg.get('downloadId') or f'dl-{int(core.time.time())}'
    acquired = DOWNLOAD_GATE.acquire(blocking=False)
    if not acquired:
        with QUEUE_LOCK:
            QUEUE_WAITING += 1
            position = QUEUE_WAITING
            active_now = QUEUE_ACTIVE
        core.send_message({
            'type': 'queued', 'downloadId': download_id, 'queuePosition': position,
            'queueActive': active_now, 'maxConcurrent': MAX_CONCURRENT_DOWNLOADS, 'percent': 0
        })
        DOWNLOAD_GATE.acquire()
        with QUEUE_LOCK:
            QUEUE_WAITING = max(0, QUEUE_WAITING - 1)
    with QUEUE_LOCK:
        QUEUE_ACTIVE += 1
    try:
        download_worker_v2(msg)
    finally:
        with QUEUE_LOCK:
            QUEUE_ACTIVE = max(0, QUEUE_ACTIVE - 1)
        DOWNLOAD_GATE.release()


def diagnostics():
    root = downloads_root()
    root.mkdir(parents=True, exist_ok=True)
    writable = False
    try:
        test = root / '.dyhd-write-test.tmp'
        test.write_bytes(b'ok')
        test.unlink(missing_ok=True)
        writable = True
    except Exception:
        writable = False
    ffmpeg_path, ffmpeg_ver = probe_version('ffmpeg')
    ffprobe_path, ffprobe_ver = probe_version('ffprobe')
    return {
        'version': HOST_VERSION, 'platform': sys.platform, 'saveFolder': str(root), 'folderWritable': writable,
        'ffmpeg': bool(ffmpeg_path), 'ffmpegPath': ffmpeg_path or '', 'ffmpegVersion': ffmpeg_ver,
        'ffprobe': bool(ffprobe_path), 'ffprobePath': ffprobe_path or '', 'ffprobeVersion': ffprobe_ver,
        'python': sys.version.split()[0], 'maxConcurrent': MAX_CONCURRENT_DOWNLOADS,
        'queueWaiting': QUEUE_WAITING, 'queueActive': QUEUE_ACTIVE
    }


def operation_result(request_id, action, ok=True, **extra):
    core.send_message({'type': 'operation_result', 'requestId': request_id, 'ok': ok, 'action': action, **extra})


def handle(msg):
    action = msg.get('action')
    request_id = msg.get('requestId')
    if action == 'hello':
        core.send_message({'type': 'hello', 'ok': True, 'version': HOST_VERSION, 'platform': sys.platform, 'saveFolder': str(downloads_root())})
        return
    if action == 'ping':
        core.send_message({'type': 'pong', 'ok': True, 'version': HOST_VERSION})
        return
    if action == 'download':
        if not str(msg.get('url', '')).startswith(('http://', 'https://')):
            core.send_message({'type':'error','downloadId':msg.get('downloadId'),'errorCode':'INVALID_URL','error':'URL video không hợp lệ.'})
            return
        t = threading.Thread(target=queued_download_worker, args=(msg,), name=f"dyhd-{msg.get('downloadId','download')}", daemon=False)
        with core.ACTIVE_LOCK:
            core.ACTIVE.add(t)
        t.start()
        return
    if action == 'get_settings':
        try:
            operation_result(request_id, action, saveFolder=str(downloads_root()))
        except Exception as e:
            operation_result(request_id, action, False, errorCode='SETTINGS_READ', error=str(e))
        return
    if action == 'choose_folder':
        try:
            selected = choose_folder(msg.get('initialPath') or '')
            operation_result(request_id, action, True, cancelled=selected is None, saveFolder=str(selected or downloads_root()))
        except Exception as e:
            operation_result(request_id, action, False, errorCode='FOLDER_PICKER', error=str(e))
        return
    if action == 'reset_settings':
        try:
            selected = reset_native_settings()
            operation_result(request_id, action, True, saveFolder=str(selected))
        except Exception as e:
            operation_result(request_id, action, False, errorCode='SETTINGS_RESET', error=str(e))
        return
    if action == 'set_save_folder':
        try:
            selected = remember_folder(msg.get('path') or '')
            operation_result(request_id, action, True, saveFolder=str(selected))
        except Exception as e:
            operation_result(request_id, action, False, errorCode='FOLDER_SET', error=str(e))
        return
    if action == 'open_file':
        try:
            open_file(msg.get('path') or '')
            operation_result(request_id, action)
        except Exception as e:
            operation_result(request_id, action, False, errorCode='OPEN_FILE', error=str(e))
        return
    if action == 'open_folder':
        try:
            open_folder(msg.get('path') or '')
            operation_result(request_id, action)
        except Exception as e:
            operation_result(request_id, action, False, errorCode='OPEN_FOLDER', error=str(e))
        return
    if action == 'verify_file':
        try:
            p = safe_open_path(msg.get('path') or '')
            operation_result(request_id, action, True, verification=verify_file(p))
        except Exception as e:
            operation_result(request_id, action, False, errorCode='VERIFY_FILE', error=str(e))
        return
    if action == 'diagnostics':
        try:
            operation_result(request_id, action, True, **diagnostics())
        except Exception as e:
            operation_result(request_id, action, False, errorCode='DIAGNOSTICS', error=str(e))
        return
    _old_handle(msg)


core.downloads_root = downloads_root
core.safe_open_path = safe_open_path
core.open_file = open_file
core.open_folder = open_folder
core.download_worker = download_worker_v2
core.handle = handle

if __name__ == '__main__':
    core.main()
