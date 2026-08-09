#!/usr/bin/env python3
import json, os, re, shutil, struct, subprocess, sys, tempfile, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

HOST_VERSION = '1.0.2'
WRITE_LOCK = threading.Lock()
ACTIVE = set()
ACTIVE_LOCK = threading.Lock()

if os.name == 'nt':
    try:
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    except Exception:
        pass


def send_message(obj):
    try:
        raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        with WRITE_LOCK:
            sys.stdout.buffer.write(struct.pack('=I', len(raw)))
            sys.stdout.buffer.write(raw)
            sys.stdout.buffer.flush()
    except Exception:
        pass


def recv_message():
    raw_len = sys.stdin.buffer.read(4)
    if not raw_len or len(raw_len) < 4:
        return None
    n = struct.unpack('=I', raw_len)[0]
    if n <= 0 or n > 64 * 1024 * 1024:
        return None
    raw = sys.stdin.buffer.read(n)
    if len(raw) != n:
        return None
    return json.loads(raw.decode('utf-8'))


def safe_filename(name):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', (name or 'Douyin video')).strip(' .')
    name = re.sub(r'\s+', ' ', name)
    if not name:
        name = 'Douyin video'
    return name[:160]


def unique_path(folder, stem, ext):
    folder.mkdir(parents=True, exist_ok=True)
    p = folder / f'{stem}{ext}'
    i = 2
    while p.exists():
        p = folder / f'{stem} ({i}){ext}'
        i += 1
    return p


def normalize_headers(headers):
    out = {}
    blocked = {'host', 'content-length', 'range', 'connection', 'proxy-connection', 'accept-encoding'}
    for k, v in (headers or {}).items():
        if not isinstance(k, str) or not isinstance(v, str):
            continue
        lk = k.lower().strip()
        if lk in blocked or lk.startswith(':'):
            continue
        if '\r' in v or '\n' in v:
            continue
        out[k] = v
    out['Accept-Encoding'] = 'identity'
    out.setdefault('Accept', '*/*')
    return out


def request(url, headers, range_value=None, timeout=25):
    h = dict(headers)
    if range_value:
        h['Range'] = range_value
    return urlopen(Request(url, headers=h, method='GET'), timeout=timeout)


def parse_total_from_content_range(value):
    if not value:
        return 0
    m = re.search(r'/\s*(\d+)\s*$', value)
    return int(m.group(1)) if m else 0


class Progress:
    def __init__(self, download_id, total=0):
        self.id = download_id
        self.total = int(total or 0)
        self.done = 0
        self.started = time.monotonic()
        self.last_emit = 0.0
        self.lock = threading.Lock()

    def add(self, n):
        now = time.monotonic()
        with self.lock:
            self.done += n
            if now - self.last_emit < 0.35:
                return
            self.last_emit = now
            elapsed = max(0.01, now - self.started)
            speed = self.done / elapsed
            percent = (self.done * 100 / self.total) if self.total else None
        send_message({
            'type': 'progress', 'downloadId': self.id,
            'bytes': self.done, 'total': self.total,
            'percent': percent,
            'speed': human_speed(speed)
        })


def human_speed(bps):
    if bps >= 1024**2:
        return f'{bps/1024**2:.1f} MB/s'
    if bps >= 1024:
        return f'{bps/1024:.0f} KB/s'
    return f'{bps:.0f} B/s'


def probe_range(url, headers):
    try:
        with request(url, headers, 'bytes=0-0', timeout=20) as r:
            status = getattr(r, 'status', r.getcode())
            cr = r.headers.get('Content-Range', '')
            total = parse_total_from_content_range(cr)
            # consume tiny body so connection closes cleanly
            r.read(4)
            return status == 206 and total > 1, total
    except Exception:
        return False, 0


def single_download(url, headers, output, progress, expected=0):
    with request(url, headers, None, timeout=35) as r:
        total = int(r.headers.get('Content-Length') or 0)
        cr_total = parse_total_from_content_range(r.headers.get('Content-Range', ''))
        total = cr_total or total or int(expected or 0)
        progress.total = total
        with open(output, 'wb') as f:
            while True:
                chunk = r.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                progress.add(len(chunk))
    return output


def ranged_download(url, headers, output, total, progress):
    workers = min(16, max(4, (os.cpu_count() or 4) * 2))
    # Avoid tiny parts; 8 MB minimum per range.
    workers = min(workers, max(1, total // (8 * 1024 * 1024)))
    if workers < 2:
        return single_download(url, headers, output, progress, total)
    part = (total + workers - 1) // workers
    with open(output, 'wb') as f:
        f.truncate(total)

    stop = threading.Event()
    errors = []

    def job(start, end):
        if stop.is_set():
            return
        pos = start
        attempts = 0
        while pos <= end and not stop.is_set():
            try:
                with request(url, headers, f'bytes={pos}-{end}', timeout=40) as r:
                    status = getattr(r, 'status', r.getcode())
                    if status != 206:
                        raise RuntimeError(f'CDN không trả Range 206 (HTTP {status})')
                    with open(output, 'r+b', buffering=0) as f:
                        f.seek(pos)
                        while pos <= end and not stop.is_set():
                            chunk = r.read(min(1024 * 1024, end - pos + 1))
                            if not chunk:
                                break
                            f.write(chunk)
                            pos += len(chunk)
                            progress.add(len(chunk))
                if pos <= end:
                    raise RuntimeError(f'Kết nối Range bị ngắt tại byte {pos}')
            except Exception as e:
                attempts += 1
                if attempts >= 3:
                    stop.set()
                    errors.append(e)
                    raise
                time.sleep(0.45 * attempts)
        if pos != end + 1:
            raise RuntimeError(f'Range thiếu dữ liệu {start}-{end}')

    ranges = [(i * part, min(total - 1, (i + 1) * part - 1)) for i in range(workers)]
    try:
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix='dyhd-range') as ex:
            futures = [ex.submit(job, a, b) for a, b in ranges if a <= b]
            for f in as_completed(futures):
                f.result()
    except Exception:
        try: output.unlink(missing_ok=True)
        except Exception: pass
        raise errors[0] if errors else RuntimeError('Range download failed')
    return output


def fetch_text(url, headers):
    with request(url, headers, None, timeout=25) as r:
        data = r.read(8 * 1024 * 1024)
        enc = r.headers.get_content_charset() or 'utf-8'
        return data.decode(enc, errors='replace')


def attrs(line):
    out = {}
    for m in re.finditer(r'([A-Z0-9-]+)=("[^"]*"|[^,]*)', line, flags=re.I):
        out[m.group(1).upper()] = m.group(2).strip('"')
    return out


def select_hls_variant(base_url, text):
    lines = [x.strip() for x in text.splitlines() if x.strip()]
    variants = []
    for i, line in enumerate(lines):
        if line.startswith('#EXT-X-STREAM-INF:'):
            a = attrs(line.split(':', 1)[1])
            nxt = next((x for x in lines[i+1:] if not x.startswith('#')), '')
            if not nxt:
                continue
            bw = int(a.get('AVERAGE-BANDWIDTH') or a.get('BANDWIDTH') or 0)
            res = a.get('RESOLUTION', '0x0').lower().split('x')
            area = int(res[0] or 0) * int(res[1] or 0) if len(res) == 2 and all(x.isdigit() for x in res) else 0
            variants.append((area, bw, urljoin(base_url, nxt)))
    return max(variants, default=(0, 0, ''))[2]


def hls_download(url, headers, output_stem, download_id):
    text = fetch_text(url, headers)
    variant = select_hls_variant(url, text)
    if variant:
        url = variant
        text = fetch_text(url, headers)
    if '#EXT-X-BYTERANGE' in text:
        raise RuntimeError('HLS dùng BYTERANGE chưa được hỗ trợ trong bộ tải native.')
    for line in text.splitlines():
        if line.startswith('#EXT-X-KEY:') and 'METHOD=NONE' not in line.upper():
            raise RuntimeError('Luồng HLS được mã hóa; tool không vượt cơ chế mã hóa/DRM.')

    init_url = None
    segments = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith('#EXT-X-MAP:'):
            a = attrs(line.split(':', 1)[1])
            if a.get('URI'):
                init_url = urljoin(url, a['URI'])
        elif not line.startswith('#'):
            segments.append(urljoin(url, line))
    if not segments:
        raise RuntimeError('Không tìm thấy segment HLS.')

    temp_dir = Path(tempfile.mkdtemp(prefix='dyhd_hls_'))
    prog = Progress(download_id, len(segments))
    done_segments = 0
    done_lock = threading.Lock()

    def get_segment(index, seg_url):
        nonlocal done_segments
        p = temp_dir / f'{index:07d}.seg'
        last = None
        for attempt in range(3):
            try:
                with request(seg_url, headers, None, timeout=35) as r, open(p, 'wb') as f:
                    while True:
                        chunk = r.read(1024 * 1024)
                        if not chunk: break
                        f.write(chunk)
                last = None
                break
            except Exception as e:
                last = e
                p.unlink(missing_ok=True)
                time.sleep(0.4 * (attempt + 1))
        if last:
            raise last
        with done_lock:
            done_segments += 1
            prog.done = done_segments
            pct = done_segments * 100 / len(segments)
        send_message({'type':'progress','downloadId':download_id,'bytes':done_segments,'total':len(segments),'percent':pct,'speed':f'{done_segments}/{len(segments)} segments'})
        return p

    try:
        init_path = None
        if init_url:
            init_path = temp_dir / '0000000.init'
            with request(init_url, headers, None, timeout=35) as r, open(init_path, 'wb') as f:
                shutil.copyfileobj(r, f, 1024 * 1024)
        workers = min(12, max(4, os.cpu_count() or 4))
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix='dyhd-hls') as ex:
            futures = [ex.submit(get_segment, i + 1, u) for i, u in enumerate(segments)]
            for f in as_completed(futures): f.result()

        first_ext = Path(urlparse(segments[0]).path).suffix.lower()
        fragmented_mp4 = bool(init_url) or first_ext in {'.m4s', '.mp4', '.cmfv', '.cmfa'}
        if fragmented_mp4:
            out = output_stem.with_suffix('.mp4')
            with open(out, 'wb') as dst:
                if init_path: shutil.copyfileobj(open(init_path, 'rb'), dst, 1024 * 1024)
                for i in range(1, len(segments)+1):
                    with open(temp_dir / f'{i:07d}.seg', 'rb') as src:
                        shutil.copyfileobj(src, dst, 1024 * 1024)
            return out

        ts = output_stem.with_suffix('.ts')
        with open(ts, 'wb') as dst:
            for i in range(1, len(segments)+1):
                with open(temp_dir / f'{i:07d}.seg', 'rb') as src:
                    shutil.copyfileobj(src, dst, 1024 * 1024)
        ffmpeg = shutil.which('ffmpeg')
        if ffmpeg:
            mp4 = output_stem.with_suffix('.mp4')
            cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(ts), '-c', 'copy', '-movflags', '+faststart', str(mp4)]
            r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, timeout=600)
            if r.returncode == 0 and mp4.exists():
                ts.unlink(missing_ok=True)
                return mp4
        return ts
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def direct_download(msg, folder):
    download_id = msg.get('downloadId') or f'dl-{int(time.time())}'
    url = msg['url']
    headers = normalize_headers(msg.get('headers') or {})
    stem = safe_filename(msg.get('filename') or 'Douyin video')
    mime = (msg.get('mime') or '').lower()
    is_hls = 'mpegurl' in mime or '.m3u8' in url.lower()
    if is_hls:
        # Find a unique stem before HLS picks .mp4/.ts.
        candidate = unique_path(folder, stem, '.mp4')
        output_stem = candidate.with_suffix('')
        return hls_download(url, headers, output_stem, download_id)

    output = unique_path(folder, stem, '.mp4')
    expected = int(msg.get('expectedSize') or 0)
    progress = Progress(download_id, expected)
    supports, total = probe_range(url, headers)
    if supports and total >= 16 * 1024 * 1024:
        progress.total = total
        try:
            return ranged_download(url, headers, output, total, progress)
        except Exception:
            # Some CDNs advertise ranges but reject parallel ranges. Retry as a normal stream.
            progress = Progress(download_id, expected)
            return single_download(url, headers, output, progress, expected)
    return single_download(url, headers, output, progress, expected)


def download_worker(msg):
    download_id = msg.get('downloadId') or f'dl-{int(time.time())}'
    try:
        folder = Path.home() / 'Downloads' / 'DouyinHD'
        folder.mkdir(parents=True, exist_ok=True)
        send_message({'type':'started','downloadId':download_id})
        out = direct_download(msg, folder)
        send_message({'type':'complete','downloadId':download_id,'filename':out.name,'path':str(out)})
    except (HTTPError, URLError) as e:
        send_message({'type':'error','downloadId':download_id,'error':f'Lỗi mạng/CDN: {e}'})
    except Exception as e:
        send_message({'type':'error','downloadId':download_id,'error':str(e)})
    finally:
        with ACTIVE_LOCK:
            ACTIVE.discard(threading.current_thread())


def handle(msg):
    action = msg.get('action')
    if action == 'hello':
        send_message({'type':'hello','ok':True,'version':HOST_VERSION,'platform':sys.platform})
    elif action == 'download':
        if not str(msg.get('url', '')).startswith(('http://', 'https://')):
            send_message({'type':'error','downloadId':msg.get('downloadId'),'error':'URL không hợp lệ.'})
            return
        t = threading.Thread(target=download_worker, args=(msg,), name=f"dyhd-{msg.get('downloadId','download')}", daemon=False)
        with ACTIVE_LOCK: ACTIVE.add(t)
        t.start()
    elif action == 'ping':
        send_message({'type':'pong','ok':True,'version':HOST_VERSION})
    else:
        send_message({'type':'error','downloadId':msg.get('downloadId'),'error':'Lệnh native không hỗ trợ.'})


def main():
    while True:
        try:
            msg = recv_message()
        except Exception:
            break
        if msg is None:
            break
        handle(msg)
    # If Chrome disconnects while a download is active, finish the local file instead of killing it.
    while True:
        with ACTIVE_LOCK:
            threads = list(ACTIVE)
        if not threads:
            break
        for t in threads:
            t.join(timeout=0.5)


if __name__ == '__main__':
    main()
