from app.analytics import activity_score


async def answer(question, signals):
    q = question.lower()
    activity = activity_score(signals)
    if any(w in q for w in ("unavailable", "source", "health", "offline")):
        text = "; ".join(
            f"{name}: {s.metadata.status}" + (" (stale)" if s.metadata.stale else "")
            for name, s in signals.items()
        )
        intent, page, sources = "source_health", "diagnostics", list(signals)
    elif any(w in q for w in ("score", "elevated", "activity")):
        text = (
            f"Activity proxy: {activity['score'] if activity['score'] is not None else 'unavailable'}/100. Contributions: "
            + ", ".join(f"{c['name']} {c['contribution']}" for c in activity["components"])
            + f". Coverage {activity['coverage']:.0%}. This is a heuristic, not measured foot traffic."
        )
        intent, page, sources = "activity", "overview", list(signals)
    elif any(w in q for w in ("forecast", "prediction", "model")):
        from app.ml.inference import forecast

        f = forecast()
        text = (
            f"{f['metadata']['mode']} model: {f['model']}. Target: {f['metadata']['target']}. {f['explanation']}"
            if f["available"]
            else f["reason"]
        )
        intent, page, sources = "forecast", "forecasting", []
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
        intent, page, sources = "transport", "transit", ["transport"]
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
        intent, page, sources = "events", "events", ["events"]
    elif any(w in q for w in ("happening", "summary", "melbourne", "right now")):
        text = (
            f"Melbourne signal summary: activity proxy {activity['score']}, {signals['transport'].disruption_count} service notices, {signals['events'].event_count} event listings. "
            + "; ".join(f"{k}: {v.metadata.status}" for k, v in signals.items())
            + ". Unavailable feeds cannot establish current conditions."
        )
        intent, page, sources = "summary", "overview", list(signals)
    else:
        return dict(
            answer="I can query CityHQ weather, service notices, events, the activity methodology, forecasts and source health. Try a suggested question.",
            intent="help",
            navigation="overview",
            references=[],
            tool_calls=[],
        )
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
        tool_calls=[dict(tool=intent, arguments={})],
    )
