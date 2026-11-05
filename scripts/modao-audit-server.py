#!/usr/bin/env python3
"""Serve the supplied offline ZIP on localhost, preserving all source bytes."""
import argparse
import hashlib
import http.server
from pathlib import Path
import zipfile

p = argparse.ArgumentParser()
p.add_argument('zip_path', type=Path)
p.add_argument('--output', type=Path, default=Path('work/modao-prototype'))
p.add_argument('--port', type=int, default=8081)
a = p.parse_args()
root = a.output.resolve()
root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(a.zip_path) as z:
    bad = z.testzip()
    if bad:
        raise ValueError('CRC failure: ' + bad)
    for n in z.namelist():
        if not (root / n).resolve().is_relative_to(root):
            raise ValueError('Unsafe archive path: ' + n)
    entries = [n for n in z.namelist() if n.endswith('/index.html') and n.count('/') == 1]
    if len(entries) != 1:
        raise ValueError('Expected exactly one top-level export index.html')
    z.extractall(root)
print('ZIP SHA256:', hashlib.sha256(a.zip_path.read_bytes()).hexdigest(), flush=True)
print(f'Prototype: http://127.0.0.1:{a.port}/{entries[0]}', flush=True)
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
http.server.ThreadingHTTPServer(('127.0.0.1', a.port), Handler).serve_forever()
