"""Opt-in network smoke test. Never part of deterministic CI; no credentials printed."""

import argparse
import asyncio
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from app import adapters
from app.cities import CITIES


async def main(credentialed=False):
    results = []
    for city in CITIES:
        sources = [
            ("weather", "open-meteo", adapters.fetch_weather),
            ("air_quality", "open-meteo-aq", adapters.fetch_air_quality),
        ]
        if city == "delhi":
            sources.append(("transport", "delhi-metro-static", adapters.fetch_transport))
        elif credentialed:
            sources.append(("transport", "ptv", adapters.fetch_transport))
        if credentialed:
            sources.append(("events", "ticketmaster", adapters.fetch_events))
        for source, provider, fetcher in sources:
            started = datetime.now(timezone.utc)
            try:
                data, observed, limitations = await fetcher(provider, city)
                results.append(
                    dict(
                        city_id=city,
                        source=source,
                        provider=provider,
                        verified_at=started.isoformat(),
                        status="verified",
                        sample_time=observed.isoformat() if observed else None,
                        fields=sorted(data),
                        sample={
                            k: v
                            for k, v in data.items()
                            if k
                            in (
                                "temperature",
                                "wind_speed",
                                "humidity",
                                "us_aqi",
                                "european_aqi",
                                "pm2_5",
                                "event_count",
                                "disruption_count",
                                "operational_status_available",
                            )
                        },
                        normalized_sha256=hashlib.sha256(
                            json.dumps(data, sort_keys=True).encode()
                        ).hexdigest(),
                        limitations=limitations,
                    )
                )
            except adapters.CredentialsRequired:
                results.append(
                    dict(
                        city_id=city,
                        source=source,
                        provider=provider,
                        status="credentials_required",
                        verified_at=started.isoformat(),
                    )
                )
            except Exception:
                results.append(
                    dict(
                        city_id=city,
                        source=source,
                        provider=provider,
                        status="failed",
                        verified_at=started.isoformat(),
                        error="Provider smoke failed; credential-bearing error details withheld.",
                    )
                )
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--credentialed",
        action="store_true",
        help="Also test PTV and Ticketmaster with configured keys",
    )
    parser.add_argument("--output")
    args = parser.parse_args()
    result = asyncio.run(main(args.credentialed))
    body = json.dumps(result, indent=2)
    if args.output:
        Path(args.output).write_text(body + "\n")
    print(body)
    if any(r["status"] == "failed" for r in result):
        raise SystemExit(1)
