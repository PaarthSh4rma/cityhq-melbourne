from datetime import datetime


async def get_event_status():
    events = [
        {
            "title": "Major evening event near Melbourne Park",
            "venue": "Rod Laver Arena",
            "area": "Melbourne Park",
            "category": "sports",
            "impact": "high",
        },
        {
            "title": "Live music activity building in CBD",
            "venue": "Forum Melbourne",
            "area": "CBD",
            "category": "music",
            "impact": "medium",
        },
        {
            "title": "Theatre precinct foot traffic expected",
            "venue": "Princess Theatre",
            "area": "East End",
            "category": "arts",
            "impact": "medium",
        },
    ]

    high_impact = len([event for event in events if event["impact"] == "high"])
    medium_impact = len([event for event in events if event["impact"] == "medium"])

    return {
        "status": "High" if high_impact else "Normal",
        "event_count": len(events),
        "high_impact": high_impact,
        "medium_impact": medium_impact,
        "items": events,
        "updated_at": datetime.now().isoformat(),
    }