#!/usr/bin/env python3
"""Extract a deterministic page inventory from a Modao offline ZIP.

Usage: python scripts/modao-inventory.py "/path/to/智能知识库V1.0.zip" --output inventory.json
Python 3.9+ standard library; no remote calls and no Python virtualenv required.
"""
import argparse
import base64
import gzip
import json
import re
import zipfile
from pathlib import Path

BLOB_RE = re.compile(r'"(H4sIA[A-Za-z0-9+/=]+)"')


def parse_zip(path):
    with zipfile.ZipFile(path) as zf:
        candidates = [name for name in zf.namelist() if name.endswith("/extra/data.1.js")]
        if len(candidates) != 1:
            raise ValueError("Expected exactly one extra/data.1.js")
        source = zf.read(candidates[0]).decode("utf-8")
    blobs = BLOB_RE.findall(source)
    if len(blobs) != 1:
        raise ValueError(f"Expected one gzip/base64 blob, got {len(blobs)}")
    decoded = gzip.decompress(base64.b64decode(blobs[0])).decode("utf-8")
    pages = []
    folder = None
    current_page = None
    for line in decoded.splitlines():
        if "\t" not in line:
            continue
        head, raw = line.split("\t", 1)
        try:
            node = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(node, dict):
            continue
        name = node.get("N")
        kind = node.get("ic")
        if kind == "folder-0":
            folder = name
            current_page = None
        elif kind == "page-0":
            current_page = {
                "id": head.split(" ")[0],
                "name": name,
                "preceding_folder": folder,
                "raw_canvas_size": node.get("dWH"),
                "named_layer_count": 0,
                "named_layer_sample": [],
            }
            pages.append(current_page)
        elif current_page and isinstance(name, str) and name.strip():
            current_page["named_layer_count"] += 1
            if len(current_page["named_layer_sample"]) < 40:
                current_page["named_layer_sample"].append(name)
    return {
        "source_format": "Modao ZIP internal serialized metadata (NOT rendered UI)",
        "total_canvas_nodes": len(pages),
        "named_business_pages": sum(page["name"] != "画布 8" for page in pages),
        "pages": pages,
        "limitations": [
            "Canvas size is opaque encoded data, not verified pixel dimensions.",
            "The preceding folder marker does not conclusively prove tree parentage.",
            "Named layers do not prove pixels, visual placement, click targets or interaction results.",
            "Use real prototype screenshots before any high-fidelity implementation claim.",
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_file", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    data = json.dumps(parse_zip(args.zip_file), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(data, encoding="utf-8")
    else:
        print(data)


if __name__ == "__main__":
    main()
