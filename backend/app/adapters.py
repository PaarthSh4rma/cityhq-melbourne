"""Provider normalization. All failures handled by the ingestion boundary."""

import asyncio
import math
import os
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx

from app.cities import city_config
from app.provider_schemas import AQEnvelope, PTVNotice, TicketmasterEvent, WeatherEnvelope
from app.services_transport import build_signed_url

UTC = timezone.utc
raw_payloads = ContextVar("provider_raw_payloads", default=None)
rate_headers = ContextVar("provider_rate_headers", default=None)


class CredentialsRequired(Exception):
    pass


class RateLimited(Exception):
    def __init__(self, seconds=60):
        self.seconds = min(3600, max(1, seconds))


def credential(name):
    value = os.getenv(name)
    if not value:
        raise CredentialsRequired()
    return value


def stamp(epoch):
    return datetime.fromtimestamp(epoch, UTC)


def series(values, names, limit=72):
    """Keep actual supplied samples and nulls; never interpolate missing fields."""
    result = []
    for i, time in enumerate(values.get("time", [])[:limit]):
        row = {"timestamp": stamp(time).isoformat()}
        for target, source in names.items():
            data = values.get(source, [])
            value = data[i] if i < len(data) else None
            if value is not None and (
                not isinstance(value, (int, float)) or not math.isfinite(value)
            ):
                raise ValueError("Invalid provider sample")
            row[target] = value
        result.append(row)
    return result


def weather_label(code):
    labels = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return labels.get(code, "Unknown weather code")


async def open_meteo(city, air_quality=False):
    c = city_config(city)
    params = dict(
        latitude=c["center"][1],
        longitude=c["center"][0],
        timezone=c["timezone"],
        timeformat="unixtime",
        forecast_days=3,
    )
    if air_quality:
        fields = "pm2_5,pm10,nitrogen_dioxide,ozone,us_aqi,european_aqi"
        params.update(current=fields, hourly=fields)
        data = AQEnvelope.model_validate(
            await request_json("https://air-quality-api.open-meteo.com/v1/air-quality", params)
        )
        if any(
            data.current_units.get(k) != "μg/m³"
            for k in ("pm2_5", "pm10", "nitrogen_dioxide", "ozone")
        ):
            raise ValueError("Unexpected pollutant units")
        result = data.current.model_dump(exclude={"time"})
        result["hourly"] = series(data.hourly, {k: k for k in result})
        return (
            result,
            stamp(data.current.time),
            [
                "Modelled CAMS global air quality, approximately 45 km resolution; not station measurements.",
                "US AQI and European AQI are distinct standards; neither is the Indian National AQI.",
                "Attribution: Open-Meteo and CAMS ENSEMBLE / CAMS global. CC BY 4.0; public API is for noncommercial use.",
            ],
        )
    params.update(
        current="temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
        hourly="temperature_2m,precipitation_probability",
        daily="temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit="celsius",
        wind_speed_unit="kmh",
        precipitation_unit="mm",
    )
    data = WeatherEnvelope.model_validate(
        await request_json("https://api.open-meteo.com/v1/forecast", params)
    )
    if (
        data.current_units.get("temperature_2m") != "°C"
        or data.current_units.get("wind_speed_10m") != "km/h"
    ):
        raise ValueError("Unexpected weather units")
    w = data.current
    daily = series(
        data.daily,
        {
            "minimum": "temperature_2m_min",
            "maximum": "temperature_2m_max",
            "rain_probability": "precipitation_probability_max",
        },
        3,
    )
    for day in daily:
        day["date"] = (
            datetime.fromisoformat(day.pop("timestamp"))
            .astimezone(ZoneInfo(c["timezone"]))
            .date()
            .isoformat()
        )
    return (
        dict(
            city=c["name"],
            temperature=w.temperature_2m,
            apparent_temperature=w.apparent_temperature,
            humidity=w.relative_humidity_2m,
            precipitation=w.precipitation,
            condition=weather_label(w.weather_code),
            description=weather_label(w.weather_code),
            weather_code=w.weather_code,
            wind_speed=w.wind_speed_10m,
            wind_direction=w.wind_direction_10m,
            forecast=daily,
            hourly=series(
                data.hourly,
                {"temperature": "temperature_2m", "rain_probability": "precipitation_probability"},
            ),
        ),
        stamp(w.time),
        [
            "Modelled numerical weather at the provider grid cell, not a local weather-station observation.",
            "Unix timestamps are UTC instants; daily dates use the configured city time zone.",
            "Attribution: Open-Meteo, CC BY 4.0. Public API for noncommercial evaluation; commercial use requires an appropriate plan.",
        ],
    )


async def fetch_air_quality(adapter, city="melbourne"):
    if adapter == "demo":
        return (
            dict(pm2_5=12, pm10=24, nitrogen_dioxide=15, ozone=40, us_aqi=50, european_aqi=24),
            now(),
            ["Fixed synthetic air-quality fixture, not an observation."],
        )
    if adapter == "open-meteo-aq":
        return await open_meteo(city, air_quality=True)
    raise ValueError("Unsupported air-quality adapter")


def now():
    return datetime.now(UTC)


async def request_json(url, params=None):
    async with httpx.AsyncClient(timeout=httpx.Timeout(8), follow_redirects=True) as client:
        for attempt in range(3):
            try:
                response = await client.get(url, params=params)
                headers = rate_headers.get()
                if headers is not None:
                    headers.update(
                        {
                            k: response.headers[k]
                            for k in (
                                "Rate-Limit-Available",
                                "Rate-Limit-Over",
                                "Rate-Limit-Reset",
                                "X-RateLimit-Remaining",
                                "Retry-After",
                            )
                            if k in response.headers
                        }
                    )
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise ValueError("Expected JSON object")
                captured = raw_payloads.get()
                if captured is not None:
                    captured.append(data)
                return data
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    # Respect a server delay without occupying request slots for minutes.
                    try:
                        seconds = float(exc.response.headers.get("Retry-After", "60"))
                    except ValueError:
                        seconds = 60
                    raise RateLimited(seconds) from None
                if exc.response.status_code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 2:
                    raise
            await asyncio.sleep(0.25 * 2**attempt)


async def fetch_weather(adapter, city="melbourne"):
    c = city_config(city)
    if adapter == "open-meteo":
        return await open_meteo(city)
    if city != "melbourne" and adapter in ("wttr", "openweather"):
        raise ValueError("Legacy weather adapter supports Melbourne only")
    if adapter == "demo":
        return (
            dict(
                city=c["name"],
                temperature=18 if city == "melbourne" else 27,
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
        observed = None
        limitations = ["Area-level weather; wttr.in availability is not guaranteed."]
        if current.get("localObsDateTime"):
            from zoneinfo import ZoneInfo

            observed = (
                datetime.strptime(current["localObsDateTime"], "%Y-%m-%d %I:%M %p")
                .replace(tzinfo=ZoneInfo("Australia/Melbourne"))
                .astimezone(UTC)
            )
        else:
            limitations.append(
                "Provider omitted a dated observation timestamp; observation age is unknown. Retrieval time is available separately."
            )
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
            limitations,
        )
    if adapter == "openweather":
        key = credential("OPENWEATHER_API_KEY")
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


async def fetch_transport(adapter, city="melbourne"):
    if adapter == "delhi-metro-static" and city == "delhi":
        from app.metro import network

        n = network()
        return (
            dict(
                status="Static network · operational status unavailable",
                disruption_count=0,
                network=n,
                operational_status_available=False,
            ),
            datetime.fromisoformat(n["as_of"].replace("Z", "+00:00")),
            n["limitations"],
        )
    if adapter == "ptv" and city != "melbourne":
        raise ValueError("PTV does not cover Delhi")
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
        credential("PTV_DEVID")
        credential("PTV_API_KEY")
        d = await request_json(build_signed_url("/v3/disruptions", {"route_types": [0, 1, 2]}))
        if not isinstance(d.get("disruptions"), dict):
            raise ValueError("Invalid PTV response")
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
            for raw_notice in notices:
                notice = PTVNotice.model_validate(raw_notice).model_dump()
                items.append(
                    dict(
                        id=str(notice["disruption_id"])
                        if notice.get("disruption_id") is not None
                        else None,
                        url=notice.get("url"),
                        start_at=notice.get("from_date"),
                        end_at=notice.get("to_date"),
                        disruption_type=notice.get("disruption_type"),
                        publication_status=notice.get("disruption_status"),
                        geographic_references=notice.get("stops", []),
                        area="Melbourne",
                        title=notice.get("title") or "Service notice",
                        description=notice.get("description"),
                        mode=mode,
                        severity="unknown",
                        routes=[r.get("route_name", "") for r in notice.get("routes", [])],
                    )
                )
        limitations = [
            "PTV notices: publication status and disruption type are supplied separately; severity is unknown, not inferred.",
            "Counts do not measure passengers or congestion. Stop references are preserved; no disruption coordinates are manufactured.",
            "Source: Licensed from Public Transport Victoria under a Creative Commons Attribution 4.0 International Licence.",
        ]
    else:
        raise ValueError("Unsupported transport adapter")
    if adapter == "demo" and city == "delhi":
        for item in items:
            item["area"] = "Delhi"
    return (
        dict(
            status="Notices published" if items else "No published notices",
            disruption_count=len(items),
            minor_delays=sum(x["severity"] == "minor" for x in items),
            major_disruptions=sum(x["severity"] == "major" for x in items),
            items=items,
            updated_at=now().isoformat(),
        ),
        now(),
        limitations,
    )


async def fetch_events(adapter, city="melbourne"):
    c = city_config(city)
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
        params = dict(
            apikey=credential("TICKETMASTER_API_KEY"),
            city=c["name"],
            countryCode=c["country"],
            size=100,
            sort="date,asc",
            startDateTime=now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            endDateTime=(now() + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        )
        listings = []
        seen = set()
        total_pages = 1
        for page in range(10):
            if page:
                await asyncio.sleep(0.5)  # Conservative 2 requests/second.
            d = await request_json(
                "https://app.ticketmaster.com/discovery/v2/events.json", dict(params, page=page)
            )
            if "errors" in d or "fault" in d:
                raise ValueError("Provider error envelope")
            total_pages = int(d.get("page", {}).get("totalPages", 1))
            for event in d.get("_embedded", {}).get("events", []):
                TicketmasterEvent.model_validate(event)
                key = event.get("id")
                if key and key in seen:
                    continue
                if key:
                    seen.add(key)
                listings.append(event)
            if page + 1 >= total_pages:
                break
        items = []
        for event in listings:
            venue = (event.get("_embedded", {}).get("venues") or [{}])[0]
            location = venue.get("location", {})
            coords = None
            if location.get("longitude") and location.get("latitude"):
                lon, lat = float(location["longitude"]), float(location["latitude"])
                if (
                    math.isfinite(lon)
                    and math.isfinite(lat)
                    and -180 <= lon <= 180
                    and -90 <= lat <= 90
                ):
                    coords = (lon, lat)
            start = event.get("dates", {}).get("start", {})
            items.append(
                dict(
                    id=event.get("id"),
                    url=event.get("url"),
                    title=event["name"],
                    venue=venue.get("name"),
                    area=venue.get("city", {}).get("name", c["name"]),
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
            f"Ticketmaster listings for {c['name']}, {c['country']} in the next seven days; maximum 1000 results. Pagination {'truncated at provider deep-paging limit' if total_pages > 10 else 'complete for this query'}.",
            "Provider coverage is incomplete, especially for Delhi. Zero listings does not mean no city events.",
            "Attendance and crowd impact are unknown. Legacy impact counts are zero (not assessed).",
        ]
    else:
        raise ValueError("Unsupported events adapter")
    if adapter == "demo" and city == "delhi":
        for item in items:
            item["area"] = "Delhi"
            item["venue"] = "Illustrative Delhi venue"
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
