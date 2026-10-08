"""Generate the frontend city registry from the canonical backend registry."""

import argparse
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "backend/app/cities.json"
target = root / "frontend/lib/cities.json"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
if args.check:
    if json.loads(source.read_text()) != json.loads(target.read_text()):
        raise SystemExit("City registry copies differ; run scripts/sync_city_registry.py")
else:
    target.write_text(source.read_text())
