"""Public OSM snapshot; never interpreted as live Metro availability."""

import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def network():
    return json.loads((Path(__file__).parent / "data" / "delhi-metro.json").read_text())
