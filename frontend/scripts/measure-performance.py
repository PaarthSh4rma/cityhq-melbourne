"""Measure emitted assets and warm local HTML responses; never infer browser FPS."""

import argparse
import gzip
import json
import statistics
import time
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--phase", required=True, choices=["before", "after"])
parser.add_argument("--url", default="http://127.0.0.1:3105/")
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
static = Path(__file__).resolve().parents[1] / ".next" / "static"
result = {
    "phase": args.phase,
    "measured_at": datetime.now(UTC).isoformat(),
    "kind": "all emitted production assets, not per-route transfer or FPS",
}
for label, extension in [("javascript", "js"), ("css", "css")]:
    assets = list(static.rglob(f"*.{extension}"))
    result[label] = {
        "files": len(assets),
        "bytes": sum(p.stat().st_size for p in assets),
        "gzip_bytes": sum(len(gzip.compress(p.read_bytes(), mtime=0)) for p in assets),
    }
for _ in range(3):
    with urllib.request.urlopen(args.url, timeout=10) as response:
        response.read()
latencies = []
for _ in range(20):
    start = time.perf_counter()
    with urllib.request.urlopen(args.url, timeout=10) as response:
        body = response.read()
    latencies.append((time.perf_counter() - start) * 1000)
result["warm_document_http"] = {
    "requests": 20,
    "warmups": 3,
    "url": args.url,
    "body_bytes": len(body),
    "median_ms": round(statistics.median(latencies), 3),
    "p95_ms": round(sorted(latencies)[18], 3),
    "conditions": "Local standalone Node production build, sequential urllib GET. Shared host load is uncontrolled; not browser paint, not FPS.",
}
args.output.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
