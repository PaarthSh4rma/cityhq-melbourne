"""Deterministic, bounded tool routing. Provider text is always treated as data."""

import re

from app.analytics import activity_score
from app.cities import CITIES, city_config
from app.schemas import OperatorAction

LOCATIONS = {
    "melbourne park": "melbourne-park",
    "flinders": "flinders",
    "southern cross": "southern-cross",
    "docklands": "docklands",
    "southbank": "southbank",
    "st kilda": "st-kilda",
    "cbd": "cbd",
    "rajiv chowk": "rajiv-chowk",
    "kashmere gate": "kashmere-gate",
    "new delhi": "new-delhi",
    "central secretariat": "central-secretariat",
}


def action(kind, **kwargs):
    return OperatorAction(type=kind, **kwargs).model_dump(exclude_none=True)


def resolve_city(question, current="melbourne"):
    q = question.lower()
    matches = [c for c in CITIES if re.search(r"\b" + c + r"\b", q)]
    return matches[0] if len(matches) == 1 else current


async def compare_air_quality():
    from app.ingestion import ingestion

    values = await __import__("asyncio").gather(
        *(ingestion.get("air_quality", city) for city in CITIES)
    )
    items = {
        city: dict(
            city_id=city,
            value=value.us_aqi,
            pm2_5=value.pm2_5,
            metadata=value.metadata.model_dump(mode="json"),
        )
        for city, value in zip(CITIES, values)
    }
    usable = all(
        v.us_aqi is not None and not v.metadata.stale and v.metadata.status != "unavailable"
        for v in values
    )
    aligned = (
        all(v.metadata.observed_at for v in values)
        and abs((values[0].metadata.observed_at - values[1].metadata.observed_at).total_seconds())
        <= 7200
    )
    same_kind = (
        len({v.metadata.data_kind for v in values}) == 1
        and len({v.metadata.source for v in values}) == 1
    )
    comparable = bool(usable and aligned and same_kind)
    worse = (
        max(items, key=lambda c: items[c]["value"])
        if comparable and values[0].us_aqi != values[1].us_aqi
        else None
    )
    return dict(
        standard="US AQI",
        units="US AQI index points; PM2.5 in μg/m³",
        items=items,
        comparable=comparable,
        higher_city=worse,
        difference=round(abs(values[0].us_aqi - values[1].us_aqi), 2) if comparable else None,
        limitations=[
            "Same US AQI standard, same provider model and city-level coverage; European and Indian AQI are not substituted.",
            "Current model times must be within two hours, both fresh and of the same data kind; timestamps and provenance remain explicit.",
            "CAMS grid estimates do not describe every neighbourhood or replace station measurements.",
        ],
    )


async def answer(question, signals, city="melbourne", current_city=None):
    q = " ".join(question.lower().strip().split())
    current_city = current_city or city
    config = city_config(city)
    activity = activity_score(signals, city=city)
    actions, extra = [], {}
    allowed_locations = {p["id"] for p in config["places"]}
    location = next(
        (value for key, value in LOCATIONS.items() if key in q and value in allowed_locations), None
    )
    if any(w in q for w in ("air quality", "air-quality", "aqi", "pollution")) and any(
        w in q for w in ("compare", "which city", "worse", "both")
    ):
        extra = await compare_air_quality()
        readings = "; ".join(
            f"{CITIES[c]['name']}: {v['value']} US AQI ({v['metadata']['data_kind']}, {v['metadata']['status']}, model time {v['metadata']['observed_at']})"
            for c, v in extra["items"].items()
        )
        text = (
            readings
            + (
                f". Higher US AQI: {CITIES[extra['higher_city']]['name']} by {extra['difference']} points."
                if extra["higher_city"]
                else ". Equal values."
                if extra["comparable"]
                else ". No valid current comparison: missing, stale, different-kind or unaligned source data."
            )
            + " These readings retain their reported data kind; modelled and demo values are not ground-station measurements. European and Indian AQI use different standards."
        )
        intent, page, sources, tool = (
            "city_comparison",
            "air-quality",
            [],
            "compare_city_air_quality",
        )
        actions = [action("compare_city_metric", metric="us_aqi")]
    elif any(w in q for w in ("switch", "change city")):
        text = f"Selected {config['name']}. All signals, history, forecasting and map context use this city."
        intent, page, sources, tool = "switch_city", "overview", [], "switch_city"
        actions = [action("switch_city", city=city), action("navigate_dashboard", view="overview")]
    elif any(w in q for w in ("air quality", "air-quality", "aqi", "pollution")):
        aq = signals["air_quality"]
        text = (
            f"{config['name']} air quality {aq.metadata.status}: US AQI {aq.us_aqi}; European AQI {aq.european_aqi}; PM2.5 {aq.pm2_5} μg/m³. Data kind: {aq.metadata.data_kind}. Model time: {aq.metadata.observed_at}. These standards are distinct; no Indian National AQI is inferred. Stale values are historical context only."
            if aq.metadata.status != "unavailable"
            else f"{config['name']} air-quality source unavailable. No current estimate can be reported."
        )
        intent, page, sources, tool = (
            "air_quality",
            "air-quality",
            ["air_quality"],
            "get_air_quality",
        )
        extra = aq.model_dump(mode="json")
    elif "metro" in q and city == "delhi":
        t = signals["transport"]
        n = t.network or {}
        text = f"Delhi Metro static network: {len(n.get('stations', []))} OSM station nodes, {len(n.get('lines', []))} directional route relations, extract {n.get('as_of', 'unavailable')}. Community map data, not an official DMRC feed. Live delays and operational availability are unavailable."
        intent, page, sources, tool = "metro", "transit", ["transport"], "get_metro_network"
        extra = {"stations": n.get("stations", [])[:10], "as_of": n.get("as_of")}
        actions = [
            action("navigate_dashboard", view="overview"),
            action("toggle_map_layer", layer="metro", enabled=True),
        ]
    elif location and any(word in q for word in ("show", "focus", "fly", "map", "take me")):
        text = f"Focusing the verified {location.replace('-', ' ')} camera preset. This is geographic context, not evidence of activity at that location. Listings without coordinates remain unlocated."
        intent, page, sources, tool = "map_focus", "overview", [], "focus_map_location"
        actions = [action("navigate_dashboard", view="overview"), action(tool, location=location)]
    elif "compare" in q or "last six" in q or "last 6" in q:
        from app import persistence as db
        from app.timeline import compare

        hours = 6 if re.search(r"\b(6|six)\b", q) else 24
        extra = compare(db.utcnow(), hours, city)
        text = f"Comparing the last {hours} hours with the preceding {hours}. Stored hours: {extra['current']['stored_hours']} current, {extra['previous']['stored_hours']} previous. Gaps are not filled. Only matching input provenance groups are comparable."
        intent, page, sources, tool = "history", "overview", [], "get_historical_trends"
        actions = [
            action("navigate_dashboard", view=page),
            action("select_time_range", hours=hours),
        ]
    elif any(w in q for w in ("alerts", "boundaries")):
        layer = "alerts" if "alerts" in q else "boundaries"
        enabled = not any(w in q for w in ("hide", "disable"))
        text = f"{'Showing' if enabled else 'Hiding'} the {layer} map layer. Notices without coordinates are shown in the unlocated list, never as invented map points."
        intent, page, sources, tool = (
            "map_layer",
            "overview",
            ["transport"] if layer == "alerts" else [],
            "toggle_map_layer",
        )
        actions = [
            action("navigate_dashboard", view=page),
            action(tool, layer=layer, enabled=enabled),
        ]
    elif any(w in q for w in ("unavailable", "source", "health", "offline")):
        text = "; ".join(
            f"{name}: {s.metadata.status}" + (" (stale)" if s.metadata.stale else "")
            for name, s in signals.items()
        )
        intent, page, sources, tool = (
            "source_health",
            "diagnostics",
            list(signals),
            "get_source_health",
        )
    elif any(w in q for w in ("score", "elevated", "activity")):
        text = (
            f"Activity proxy: {activity['score'] if activity['score'] is not None else 'unavailable'}/{activity['maximum']}. Contributions: "
            + ", ".join(f"{c['name']} {c['contribution']}" for c in activity["components"])
            + f". Coverage {activity['coverage']:.0%}. This is a heuristic, not measured foot traffic."
        )
        intent, page, sources = "activity", "overview", list(signals)
        tool = (
            "explain_activity_score"
            if any(w in q for w in ("explain", "why", "based"))
            else "get_activity_score"
        )
        extra = activity
    elif any(w in q for w in ("forecast", "prediction", "model")) and "weather forecast" not in q:
        from app.ml.inference import forecast

        f = forecast(city=city)
        text = (
            f"{f['metadata']['mode']} model: {f['model']}. Target: {f['metadata']['target']}. {f['explanation']}"
            if f["available"]
            else f["reason"]
        )
        intent, page, sources, tool = "forecast", "forecasting", [], "get_forecast"
        extra = {
            "available": f["available"],
            "metadata": f.get("metadata"),
            "predictions": f.get("predictions", []),
        }
    elif any(w in q for w in ("weather", "temperature", "wind")):
        w = signals["weather"]
        text = (
            f"{config['name']} weather {w.metadata.status}: {w.temperature}°C, {w.condition}; wind {w.wind_speed} km/h."
            if w.temperature is not None
            else "Weather source is unavailable; no current conditions can be reported."
        )
        if w.forecast:
            text += " Provider daily outlook: " + "; ".join(
                f"{d['date']}: {d['minimum']}–{d['maximum']}°C" for d in w.forecast
            )
        intent, page, sources = "weather", "weather", ["weather"]
        tool = "get_weather_forecast" if "forecast" in q else "get_current_weather"
        extra = w.model_dump(mode="json")
    elif any(w in q for w in ("disruption", "transit", "transport", "train", "tram", "bus")):
        t = signals["transport"]
        text = (
            f"{config['name']} transport {t.metadata.status}. "
            + (
                "; ".join(i.title for i in t.items[:5])
                if t.items
                else "No notices available; check source status."
            )
            + " Notice counts do not measure passenger congestion."
        )
        intent, page, sources, tool = (
            "transport",
            "transit",
            ["transport"],
            "get_transport_disruptions",
        )
        extra = {"count": t.disruption_count, "items": [i.model_dump() for i in t.items[:5]]}
        if any(w in q for w in ("show", "hide", "enable", "disable", "layer")):
            actions = [
                action("navigate_dashboard", view="overview"),
                action(
                    "toggle_map_layer",
                    layer="transit",
                    enabled=not any(w in q for w in ("hide", "disable")),
                ),
            ]
    elif any(w in q for w in ("event", "cbd")):
        e = signals["events"]
        items = [i for i in e.items if "cbd" not in q or "cbd" in i.area.lower()]
        text = (
            f"{config['name']} events {e.metadata.status}. "
            + (
                "; ".join(f"{i.title} — {i.venue}, {i.date}" for i in items[:5])
                if items
                else "No matching listings available."
            )
            + " Attendance and crowd effects are unknown."
        )
        intent, page, sources, tool = "events", "events", ["events"], "get_upcoming_events"
        extra = {"count": len(items), "items": [i.model_dump() for i in items[:5]]}
        if "layer" in q or "hide" in q:
            actions = [
                action("navigate_dashboard", view="overview"),
                action("toggle_map_layer", layer="events", enabled="hide" not in q),
            ]
    elif any(
        w in q
        for w in (
            "happening",
            "summary",
            "melbourne",
            "delhi",
            "report",
            "right now",
            "situation",
            "overview",
        )
    ):
        text = (
            f"{config['name']} signal summary: activity proxy {activity['score']}, {signals['transport'].disruption_count if signals['transport'].operational_status_available and signals['transport'].metadata.status != 'unavailable' else 'unknown'} service notices, {signals['events'].event_count if signals['events'].metadata.status != 'unavailable' else 'unknown'} event listings. "
            + "; ".join(f"{k}: {v.metadata.status}" for k, v in signals.items())
            + ". Unavailable feeds cannot establish current conditions."
        )
        intent, page, sources, tool = "summary", "overview", list(signals), "get_city_overview"
    else:
        return dict(
            answer="I can query CityHQ signals, explain the score, compare stored periods, show forecasts, focus verified city places and control map layers. Try ‘What is the AQI in Delhi?’ or ‘Compare city air quality’. Only Melbourne and Delhi are supported.",
            intent="help",
            navigation="overview",
            references=[],
            tool_calls=[],
            actions=[],
            supporting_data={},
        )
    # Generic map layer commands are validated against a fixed layer catalogue.
    if not actions and any(w in q for w in ("layer", "show alerts", "hide alerts", "boundaries")):
        layer = next((v for v in ("weather", "alerts", "boundaries", "events") if v in q), None)
        if layer:
            actions = [
                action("navigate_dashboard", view="overview"),
                action(
                    "toggle_map_layer",
                    layer=layer,
                    enabled=not any(w in q for w in ("hide", "disable")),
                ),
            ]
    if not actions:
        actions = [action("navigate_dashboard", view=page)]
    if city != current_city and not any(a["type"] == "switch_city" for a in actions):
        actions.insert(0, action("switch_city", city=city))
    warnings = [
        f"{name}: {signals[name].metadata.status}"
        + ("; stale, last successful observation only" if signals[name].metadata.stale else "")
        for name in sources
    ]
    return dict(
        city_id=city,
        answer=text + (" Source context: " + "; ".join(warnings) + "." if warnings else ""),
        intent=intent,
        navigation=page,
        references=[
            dict(signal=name, **signals[name].metadata.model_dump(mode="json")) for name in sources
        ],
        tool_calls=[dict(tool=tool, arguments={"question": question, "city": city})],
        actions=actions,
        supporting_data=extra,
    )
