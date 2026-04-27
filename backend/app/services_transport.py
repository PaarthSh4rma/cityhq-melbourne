import os
import hmac
import hashlib
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException


BASE_URL = "https://timetableapi.ptv.vic.gov.au"


def build_signed_url(path: str, params: dict | None = None) -> str:
    devid = os.getenv("PTV_DEVID")
    api_key = os.getenv("PTV_API_KEY")

    if not devid or not api_key:
        raise HTTPException(
            status_code=500,
            detail="PTV_DEVID or PTV_API_KEY is missing",
        )

    params = params or {}
    params["devid"] = devid

    query = urlencode(params)
    raw = f"{path}?{query}"

    signature = hmac.new(
        api_key.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha1,
    ).hexdigest().upper()

    return f"{BASE_URL}{raw}&signature={signature}"


async def get_transport_status():
    # PTV route types:
    # 0 = Train, 1 = Tram, 2 = Bus, 3 = V/Line, 4 = Night Bus
    path = "/v3/disruptions"

    url = build_signed_url(
        path,
        {
            "route_types": "0,1,2",
        },
    )

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        data = response.json()

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=data,
        )

    disruptions = data.get("disruptions", {})

    all_items = []

    for category_items in disruptions.values():
        if isinstance(category_items, list):
            for item in category_items:
                all_items.append(item)

    cleaned = []

    for item in all_items[:5]:
        title = item.get("title") or item.get("description") or "Transport disruption"
        mode = item.get("mode_name") or "transport"
        severity = item.get("disruption_status") or "info"

        cleaned.append(
            {
                "title": title,
                "severity": "minor" if severity else "info",
                "mode": mode,
                "area": "Melbourne",
            }
        )

    minor_delays = len(cleaned)
    major_disruptions = 0
    status = "Disrupted" if minor_delays > 0 else "Normal"

    return {
        "status": status,
        "minor_delays": minor_delays,
        "major_disruptions": major_disruptions,
        "items": cleaned,
    }