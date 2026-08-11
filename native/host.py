#!/usr/bin/env python3
"""Douyin HD Pro Native Helper v1.1.0.

Wrapper around the stable downloader core. v1.1.0 adds persistent save-folder
settings, a native Windows folder picker and request/response operation IDs.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import host_core as core

HOST_VERSION = '1.1.0'
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
    if default not in data['allowedFolders']:
        data['allowedFolders'].append(default)
    if data['saveFolder'] not in data['allowedFolders']:
        data['allowedFolders'].append(data['saveFolder'])
    return data


def save_settings(data):
    f = settings_file()
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def remember_folder(folder):
    if not folder:
        raise RuntimeError('Đường dẫn thư mục không hợp lệ.')
    p = Path(folder).expanduser().resolve()
    p.mkdir(parents=True, exist_ok=True)
    data = load_settings()
    data['saveFolder'] = str(p)
    allowed = [str(p)] + [str(x) for x in data.get('allowedFolders', []) if str(x) != str(p)]
    data['allowedFolders'] = allowed[:8]
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
        raise RuntimeError('Tùy chỉnh thư mục hiện chỉ hỗ trợ Windows.')
    initial = str(initial_path or downloads_root())
    script = r'''Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Chọn thư mục lưu video Douyin HD Pro'
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
    raise RuntimeError('Tệp không thuộc thư mục lưu đã được Douyin HD Pro cho phép.')


def open_file(raw_path):
    p = safe_open_path(raw_path)
    if not p.exists() or not p.is_file():
        raise RuntimeError('Không tìm thấy tệp đã tải.')
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
    if action == 'get_settings':
        try:
            operation_result(request_id, action, saveFolder=str(downloads_root()))
        except Exception as e:
            operation_result(request_id, action, False, error=str(e))
        return
    if action == 'choose_folder':
        try:
            selected = choose_folder(msg.get('initialPath') or '')
            operation_result(request_id, action, True, cancelled=selected is None, saveFolder=str(selected or downloads_root()))
        except Exception as e:
            operation_result(request_id, action, False, error=str(e))
        return
    if action == 'set_save_folder':
        try:
            selected = remember_folder(msg.get('path') or '')
            operation_result(request_id, action, True, saveFolder=str(selected))
        except Exception as e:
            operation_result(request_id, action, False, error=str(e))
        return
    if action == 'open_file':
        try:
            open_file(msg.get('path') or '')
            operation_result(request_id, action)
        except Exception as e:
            operation_result(request_id, action, False, error=str(e))
        return
    if action == 'open_folder':
        try:
            open_folder(msg.get('path') or '')
            operation_result(request_id, action)
        except Exception as e:
            operation_result(request_id, action, False, error=str(e))
        return
    _old_handle(msg)


# Make the stable downloader core use v1.1.0 save/open path policy.
core.downloads_root = downloads_root
core.safe_open_path = safe_open_path
core.open_file = open_file
core.open_folder = open_folder
core.handle = handle

if __name__ == '__main__':
    core.main()
