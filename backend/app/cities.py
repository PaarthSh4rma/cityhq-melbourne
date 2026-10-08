"""Exactly two supported city contexts. No caller-supplied coordinates or providers."""

import json
from pathlib import Path
from typing import Literal

CityId = Literal["melbourne", "delhi"]
CITIES = json.loads(Path(__file__).with_name("cities.json").read_text())


def city_config(city: CityId = "melbourne"):
    if city not in CITIES:
        raise ValueError("Unsupported city")
    return CITIES[city]


def model_directory(city: CityId = "melbourne"):
    from app.config import settings

    return Path(settings.artifact_dir) / city_config(city)["forecast"]["artifact_subdirectory"]
