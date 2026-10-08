from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

VERSION = "activity-proxy-1.1"


def total_score(values):
    """Decimal half-up rounding matches the nonnegative browser simulation."""
    total = sum((Decimal(str(value)) for value in values), Decimal(0))
    return float(total.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def activity_score(signals, at=None):
    at = (at or datetime.now(timezone.utc)).astimezone(ZoneInfo("Australia/Melbourne"))
    weather, transit, events = (signals[k] for k in ("weather", "transport", "events"))
    usable = {
        k: v.metadata.status != "unavailable" and not v.metadata.stale for k, v in signals.items()
    }
    components = [
        dict(
            name="Time context",
            contribution=20 if 7 <= at.hour < 22 else 5,
            maximum=20,
            explanation="Day/evening prior (07–22 Melbourne); not observed movement.",
        )
    ]
    if usable["events"]:
        components.append(
            dict(
                name="Event listings",
                contribution=min(events.event_count, 10) * 4,
                maximum=40,
                explanation="4 points per upcoming listing, capped at 10; no attendance estimate.",
            )
        )
    if usable["transport"]:
        components.append(
            dict(
                name="Service notices",
                contribution=min(transit.disruption_count, 10) * 2.5,
                maximum=25,
                explanation="2.5 points per notice, capped at 10; not congestion.",
            )
        )
    if usable["weather"] and weather.temperature is not None:
        comfort = max(0, 1 - abs(weather.temperature - 20) / 20) * max(
            0, 1 - (weather.wind_speed or 0) / 80
        )
        components.append(
            dict(
                name="Weather suitability",
                contribution=round(15 * comfort, 2),
                maximum=15,
                explanation="Temperature comfort around 20°C, reduced by wind; no causal claim.",
            )
        )
    count = sum(usable.values())
    score = total_score(c["contribution"] for c in components) if count else None
    return dict(
        score=score,
        category="Unavailable"
        if score is None
        else "Elevated"
        if score >= 65
        else "Moderate"
        if score >= 35
        else "Quiet",
        components=components,
        main_drivers=[c["name"] for c in sorted(components, key=lambda c: -c["contribution"])[:2]],
        coverage=count / 3,
        demo=any(v.metadata.origin_status == "demo" for v in signals.values()),
        methodology_version=VERSION,
        input_freshness={k: v.metadata.model_dump(mode="json") for k, v in signals.items()},
        limitations=[
            "Heuristic signal index, not measured foot traffic or congestion.",
            "Missing/stale components contribute zero; partial scores are not comparable to full coverage.",
            "Weights are design choices, not learned or statistically calibrated.",
        ],
    )
