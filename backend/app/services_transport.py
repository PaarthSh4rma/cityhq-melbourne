from datetime import datetime


async def get_transport_status():
    disruptions = [
        {
            "title": "Minor tram delays through CBD corridor",
            "severity": "minor",
            "mode": "tram",
            "area": "CBD",
        },
        {
            "title": "Increased passenger load around Richmond interchange",
            "severity": "info",
            "mode": "train",
            "area": "Richmond",
        },
        {
            "title": "Bus network operating normally across inner north",
            "severity": "low",
            "mode": "bus",
            "area": "Inner North",
        },
    ]

    minor_delays = len(
        [item for item in disruptions if item["severity"] == "minor"]
    )

    major_disruptions = len(
        [item for item in disruptions if item["severity"] == "major"]
    )

    status = "Disrupted" if minor_delays or major_disruptions else "Normal"

    return {
        "status": status,
        "minor_delays": minor_delays,
        "major_disruptions": major_disruptions,
        "items": disruptions,
        "updated_at": datetime.now().isoformat(),
    }