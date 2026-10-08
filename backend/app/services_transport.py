import hashlib
import hmac
import os
from urllib.parse import urlencode

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

    params = dict(params or {})
    params["devid"] = devid

    query = urlencode(params, doseq=True)
    raw = f"{path}?{query}"

    signature = (
        hmac.new(
            api_key.encode("utf-8"),
            raw.encode("utf-8"),
            hashlib.sha1,
        )
        .hexdigest()
        .upper()
    )

    return f"{BASE_URL}{raw}&signature={signature}"


async def get_transport_status():
    """Compatibility wrapper; configured ingestion owns normalization and errors."""
    from app.ingestion import ingestion

    return (await ingestion.get("transport")).model_dump(mode="json")
