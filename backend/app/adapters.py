"""Provider normalization. All failures handled by the ingestion boundary."""

import asyncio
import os
from datetime import datetime, timedelta, timezone

import httpx

from app.services_transport import build_signed_url

UTC = timezone.utc


def now():
    return datetime.now(UTC)


async def request_json(url, params=None):
    async with httpx.AsyncClient(timeout=httpx.Timeout(8), follow_redirects=True) as client:
        for attempt in range(3):
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise
            await asyncio.sleep(0.25 * 2**attempt)


async def fetch_weather(adapter):
    if adapter == "demo":
        return (
            dict(
                temperature=18,
                condition="Partly cloudy",
                description="Synthetic demo weather",
                wind_speed=14,
                humidity=62,
            ),
            now(),
            ["Fixed illustrative weather; not an observation."],
        )
    if adapter == "wttr":
        data = await request_json("https://wttr.in/Melbourne?format=j1")
        current = data["current_condition"][0]
        observed = datetime.strptime(current["localObsDateTime"], "%Y-%m-%d %I:%M %p")
        from zoneinfo import ZoneInfo

        observed = observed.replace(tzinfo=ZoneInfo("Australia/Melbourne")).astimezone(UTC)
        forecast = [
            dict(date=d["date"], minimum=float(d["mintempC"]), maximum=float(d["maxtempC"]))
            for d in data.get("weather", [])
        ]
        return (
            dict(
                temperature=float(current["temp_C"]),
                condition=current["weatherDesc"][0]["value"],
                description=current["weatherDesc"][0]["value"],
                wind_speed=float(current["windspeedKmph"]),
                humidity=float(current["humidity"]),
                forecast=forecast,
            ),
            observed,
            ["Area-level weather; wttr.in availability is not guaranteed."],
        )
    if adapter == "openweather":
        key = os.environ["OPENWEATHER_API_KEY"]
        d = await request_json(
            "https://api.openweathermap.org/data/2.5/weather",
            dict(q="Melbourne,AU", appid=key, units="metric"),
        )
        return (
            dict(
                temperature=d["main"]["temp"],
                condition=d["weather"][0]["main"],
                description=d["weather"][0]["description"],
                humidity=d["main"].get("humidity"),
                wind_speed=d["wind"]["speed"] * 3.6,
            ),
            datetime.fromtimestamp(d["dt"], UTC),
            ["Current conditions only; wind normalized to km/h."],
        )
    raise ValueError("Unsupported weather adapter")


async def fetch_transport(adapter):
    if adapter == "demo":
        items = [
            dict(
                title="Demo: CBD tram maintenance",
                description="Illustrative service notice; not a real disruption.",
                mode="tram",
                severity="minor",
                area="CBD",
                routes=["Demo T1"],
            ),
            dict(
                title="Demo: train replacement service",
                description="Illustrative replacement service.",
                mode="train",
                severity="major",
                area="Richmond",
                routes=["Demo R1"],
            ),
            dict(
                title="Demo: bus stop relocation",
                description="Illustrative stop relocation.",
                mode="bus",
                severity="info",
                area="Inner North",
                routes=["Demo B1"],
            ),
        ]
        limitations = [
            "Fictional service notices. Counts are not passenger congestion.",
            "No reliable coordinates; notices are not mapped.",
        ]
    elif adapter == "ptv":
        d = await request_json(build_signed_url("/v3/disruptions", {"route_types": "0,1,2"}))
        items = []
        for group, notices in d.get("disruptions", {}).items():
            if not isinstance(notices, list):
                continue
            mode = (
                "train"
                if "metro" in group or "train" in group
                else "tram"
                if "tram" in group
                else "bus"
                if "bus" in group
                else "other"
            )
            for notice in notices:
                items.append(
                    dict(
                        title=notice.get("title") or "Service notice",
                        description=notice.get("description"),
                        mode=mode,
                        severity="unknown",
                        routes=[r.get("route_name", "") for r in notice.get("routes", [])],
                    )
                )
        limitations = [
            "Snapshot of PTV notices; severity not inferred from publication status.",
            "Counts do not measure passengers or congestion. Locations unavailable.",
        ]
    else:
        raise ValueError("Unsupported transport adapter")
    return (
        dict(
            status="Disrupted" if items else "Normal",
            disruption_count=len(items),
            minor_delays=sum(x["severity"] == "minor" for x in items),
            major_disruptions=sum(x["severity"] == "major" for x in items),
            items=items,
            updated_at=now().isoformat(),
        ),
        now(),
        limitations,
    )


async def fetch_events(adapter):
    if adapter == "demo":
        day = now().date()
        items = [
            dict(
                title="Demo: evening music session",
                venue="Illustrative CBD venue",
                area="CBD",
                category="Music",
                date=str(day + timedelta(days=1)),
                time="19:30:00",
            ),
            dict(
                title="Demo: arts weekend",
                venue="Illustrative Southbank venue",
                area="Southbank",
                category="Arts",
                date=str(day + timedelta(days=2)),
                time="12:00:00",
            ),
            dict(
                title="Demo: community showcase",
                venue="Illustrative Richmond venue",
                area="Richmond",
                category="Community",
                date=str(day + timedelta(days=3)),
                time="10:00:00",
            ),
        ]
        limitations = [
            "Fictional events; no attendance or impact estimates.",
            "Demo locations are not geocoded.",
        ]
    elif adapter == "ticketmaster":
        d = await request_json(
            "https://app.ticketmaster.com/discovery/v2/events.json",
            dict(
                apikey=os.environ["TICKETMASTER_API_KEY"],
                city="Melbourne",
                countryCode="AU",
                size=100,
                sort="date,asc",
                startDateTime=now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                endDateTime=(now() + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            ),
        )
        items = []
        for event in d.get("_embedded", {}).get("events", []):
            venue = (event.get("_embedded", {}).get("venues") or [{}])[0]
            location = venue.get("location", {})
            coords = None
            if location.get("longitude") and location.get("latitude"):
                lon, lat = float(location["longitude"]), float(location["latitude"])
                if -180 <= lon <= 180 and -90 <= lat <= 90:
                    coords = (lon, lat)
            start = event.get("dates", {}).get("start", {})
            items.append(
                dict(
                    title=event["name"],
                    venue=venue.get("name"),
                    area=venue.get("city", {}).get("name", "Melbourne"),
                    category=(event.get("classifications") or [{}])[0]
                    .get("segment", {})
                    .get("name", "Other"),
                    date=start.get("localDate"),
                    time=start.get("localTime"),
                    coordinates=coords,
                    precision="Provider venue coordinate" if coords else None,
                )
            )
        limitations = [
            "First 100 Ticketmaster listings in the next seven days; not all Melbourne events.",
            "Attendance and crowd impact are unknown. Legacy impact counts are zero (not assessed).",
        ]
    else:
        raise ValueError("Unsupported events adapter")
    return (
        dict(
            status="Scheduled" if items else "No listings",
            event_count=len(items),
            items=items,
            updated_at=now().isoformat(),
        ),
        now(),
        limitations,
    )
