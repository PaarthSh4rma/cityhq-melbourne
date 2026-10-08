from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from app.cities import city_config

VERSION = city_config("melbourne")["scoring"]["version"]


def total_score(values):
    """Decimal half-up rounding matches the nonnegative browser simulation."""
    total = sum((Decimal(str(value)) for value in values), Decimal(0))
    return float(total.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def activity_score(signals, at=None, city="melbourne"):
    config = city_config(city)
    at = (at or datetime.now(timezone.utc)).astimezone(ZoneInfo(config["timezone"]))
    weather, transit, events = (signals[k] for k in ("weather", "transport", "events"))
    usable = {
        k: v.metadata.status != "unavailable" and not v.metadata.stale for k, v in signals.items()
    }
    usable["weather"] = (
        usable["weather"] and weather.temperature is not None and weather.wind_speed is not None
    )
    usable["transport"] = (
        usable["transport"]
        and config["scoring"]["include_disruptions"]
        and transit.operational_status_available
    )
    eligible = ["weather", "events"] + (
        ["transport"] if config["scoring"]["include_disruptions"] else []
    )
    components = [
        dict(
            name="Time context",
            contribution=20 if 7 <= at.hour < 22 else 5,
            maximum=20,
            explanation=f"Day/evening prior (07–22 {config['timezone']}); not observed movement.",
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
        comfort = max(
            0,
            1
            - abs(weather.temperature - config["scoring"]["comfort_temperature"])
            / config["scoring"]["temperature_span"],
        ) * max(0, 1 - (weather.wind_speed or 0) / 80)
        components.append(
            dict(
                name="Weather suitability",
                contribution=round(15 * comfort, 2),
                maximum=15,
                explanation=f"Temperature suitability around {config['scoring']['comfort_temperature']}°C (design prior), reduced by wind; no causal claim.",
            )
        )
    count = sum(usable[k] for k in eligible)
    score = total_score(c["contribution"] for c in components) if count else None
    return dict(
        city_id=city,
        value_kind="derived",
        maximum=100 if city == "melbourne" else 75,
        environmental_risk={
            "standard": "US AQI",
            "value": signals["air_quality"].us_aqi,
            "data_kind": signals["air_quality"].metadata.data_kind,
        }
        if "air_quality" in signals and usable.get("air_quality")
        else None,
        operational_disruption={"notice_count": transit.disruption_count}
        if usable["transport"]
        else None,
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
        coverage=count / len(eligible),
        demo=any(signals[k].metadata.origin_status == "demo" for k in eligible),
        methodology_version=config["scoring"]["version"],
        input_freshness={k: v.metadata.model_dump(mode="json") for k, v in signals.items()},
        limitations=[
            "Heuristic signal index, not measured foot traffic or congestion.",
            "Missing/stale components contribute zero; partial scores are not comparable to full coverage.",
            "Weights are design choices, not learned or statistically calibrated.",
            "Air pollution is reported separately and never raises the activity proxy. Static Metro topology is not operational availability.",
            "Delhi maximum is 75; Melbourne maximum is 100. Different methodology and provider coverage prevent direct city activity comparisons.",
        ],
    )
