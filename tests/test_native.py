import tempfile
import unittest
from pathlib import Path
from unittest import mock
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'native'))
import host  # noqa: E402


class NativeHelperTests(unittest.TestCase):
    def test_version(self):
        self.assertEqual(host.HOST_VERSION, '2.0.0')
        self.assertGreaterEqual(host.MAX_CONCURRENT_DOWNLOADS, 1)

    def test_destination_folder_stays_under_root(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            with mock.patch.object(host, 'downloads_root', return_value=root):
                out = host.destination_folder('../../Creator/2026-08-11')
                out.relative_to(root)
                self.assertTrue(out.is_dir())
                self.assertNotIn('..', out.parts)

    def test_verify_basic_mp4(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / 'sample.mp4'
            p.write_bytes(b'\x00\x00\x00\x18ftypisom' + b'0' * 4096)
            with mock.patch.object(host.shutil, 'which', return_value=None):
                result = host.verify_file(p)
            self.assertTrue(result['ok'])
            self.assertTrue(result['hasVideo'])
            self.assertEqual(result['method'], 'basic')

    def test_safe_open_path_rejects_outside_allowed_folder(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td, 'allowed').resolve()
            root.mkdir()
            outside = Path(td, 'outside.mp4').resolve()
            outside.write_bytes(b'x')
            with mock.patch.object(host, 'allowed_roots', return_value=[root]):
                with self.assertRaises(RuntimeError):
                    host.safe_open_path(outside)


if __name__ == '__main__':
    unittest.main()
