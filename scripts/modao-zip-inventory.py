#!/usr/bin/env python3
"""Read-only Modao offline ZIP inventory. No external Python dependencies.

Does not decode scene geometry or attribute objects to pages by serial order.
"""
import argparse
import base64
import gzip
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

GZIP_TOKEN = re.compile(rb"H4sIA[A-Za-z0-9+/=]+")

def inspect(path: Path) -> dict:
    with zipfile.ZipFile(path) as z:
        bad = z.testzip()
        if bad:
            raise ValueError(f"CRC failure: {bad}")
        names = z.namelist()
        source = next((n for n in names if n.endswith("/extra/data.1.js")), None)
        if source is None:
            raise ValueError("Missing extra/data.1.js")
        source_bytes = z.read(source)
    match = GZIP_TOKEN.search(source_bytes)
    if not match:
        raise ValueError("No embedded gzip payload")
    decoded = gzip.decompress(base64.b64decode(match.group(0)))
    pages, folders = [], []
    count = svg_count = errors = 0
    for line in decoded.decode("utf-8").splitlines():
        if "\t" not in line:
            errors += 1
            continue
        ref, payload = line.split("\t", 1)
        try:
            obj = json.loads(payload)
        except json.JSONDecodeError:
            errors += 1
            continue
        if not isinstance(obj, dict):
            continue
        count += 1
        if obj.get("ic") == "page-0":
            pages.append({"name": obj.get("N", ""), "record_id": ref})
        if obj.get("ic") == "folder-0":
            folders.append({"name": obj.get("N", ""), "record_id": ref})
        if isinstance(obj.get("ic"), dict) and "icP" in obj["ic"]:
            svg_count += 1
    return {
        "input": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "zip_entries": len(names),
        "zip_crc": "pass",
        "decoded_bytes": len(decoded),
        "records": count,
        "unparsed_lines": errors,
        "pages": pages,
        "folders": folders,
        "named_pages": sum(x["name"] != "画布 8" for x in pages),
        "unnamed_pages": sum(x["name"] == "画布 8" for x in pages),
        "inline_svg_records": svg_count,
        "limitations": [
            "Compact private Modao xy/wh/style encodings are not decoded.",
            "Element ownership cannot be inferred from record order.",
            "Browser-rendered screenshots are needed for visual acceptance.",
        ],
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    data = json.dumps(inspect(args.zip_path), ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(data, encoding="utf-8")
    else:
        sys.stdout.write(data)
