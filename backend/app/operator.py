"""Deterministic, bounded tool routing. Provider text is always treated as data."""

import re

from app.analytics import activity_score
from app.schemas import OperatorAction

LOCATIONS = {
    "melbourne park": "melbourne-park",
    "flinders": "flinders",
    "southern cross": "southern-cross",
    "docklands": "docklands",
    "southbank": "southbank",
    "st kilda": "st-kilda",
    "cbd": "cbd",
}


def action(kind, **kwargs):
    return OperatorAction(type=kind, **kwargs).model_dump(exclude_none=True)


async def answer(question, signals):
    q = " ".join(question.lower().strip().split())
    activity = activity_score(signals)
    actions, extra = [], {}
    location = next((value for key, value in LOCATIONS.items() if key in q), None)
    if location and any(word in q for word in ("show", "focus", "fly", "map", "take me")):
        text = f"Focusing the verified {location.replace('-', ' ')} camera preset. This is geographic context, not evidence of activity at that location. Listings without coordinates remain unlocated."
        intent, page, sources, tool = "map_focus", "overview", [], "focus_map_location"
        actions = [action("navigate_dashboard", view="overview"), action(tool, location=location)]
    elif "compare" in q or "last six" in q or "last 6" in q:
        from app import persistence as db
        from app.timeline import compare

        hours = 6 if re.search(r"\b(6|six)\b", q) else 24
        extra = compare(db.utcnow(), hours)
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
            f"Activity proxy: {activity['score'] if activity['score'] is not None else 'unavailable'}/100. Contributions: "
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

        f = forecast()
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
            f"Weather {w.metadata.status}: {w.temperature}°C, {w.condition}; wind {w.wind_speed} km/h."
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
            f"Transport {t.metadata.status}. "
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
            f"Events {e.metadata.status}. "
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
        w in q for w in ("happening", "summary", "melbourne", "right now", "situation", "overview")
    ):
        text = (
            f"Melbourne signal summary: activity proxy {activity['score']}, {signals['transport'].disruption_count} service notices, {signals['events'].event_count} event listings. "
            + "; ".join(f"{k}: {v.metadata.status}" for k, v in signals.items())
            + ". Unavailable feeds cannot establish current conditions."
        )
        intent, page, sources, tool = "summary", "overview", list(signals), "get_city_overview"
    else:
        return dict(
            answer="I can query CityHQ signals, explain the score, compare stored periods, show forecasts, focus verified Melbourne places and control map layers. Try ‘Show Melbourne Park’ or ‘Compare last six hours’.",
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
    warnings = [
        f"{name}: {signals[name].metadata.status}"
        + ("; stale, last successful observation only" if signals[name].metadata.stale else "")
        for name in sources
    ]
    return dict(
        answer=text + (" Source context: " + "; ".join(warnings) + "." if warnings else ""),
        intent=intent,
        navigation=page,
        references=[
            dict(signal=name, **signals[name].metadata.model_dump(mode="json")) for name in sources
        ],
        tool_calls=[dict(tool=tool, arguments={"question": question})],
        actions=actions,
        supporting_data=extra,
    )
