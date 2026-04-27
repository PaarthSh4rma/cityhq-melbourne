import os
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException


BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json"


async def get_event_status():
    api_key = os.getenv("TICKETMASTER_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="TICKETMASTER_API_KEY is missing",
        )

    now = datetime.now(timezone.utc)
    end = now + timedelta(days=7)

    params = {
        "apikey": api_key,
        "city": "Melbourne",
        "countryCode": "AU",
        "size": 10,
        "sort": "date,asc",
        "startDateTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "endDateTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(BASE_URL, params=params)
        data = response.json()

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=data,
        )

    events = data.get("_embedded", {}).get("events", [])

    cleaned = []

    for event in events:
        venue = (
            event.get("_embedded", {})
            .get("venues", [{}])[0]
        )

        classification = event.get("classifications", [{}])[0]
        segment = classification.get("segment", {}).get("name", "event")

        cleaned.append(
            {
                "title": event.get("name", "Untitled event"),
                "venue": venue.get("name", "Unknown venue"),
                "area": venue.get("city", {}).get("name", "Melbourne"),
                "category": segment,
                "date": event.get("dates", {}).get("start", {}).get("localDate"),
                "time": event.get("dates", {}).get("start", {}).get("localTime"),
                "url": event.get("url"),
                "impact": "high" if segment in ["Sports", "Music"] else "medium",
            }
        )

    high_impact = len([event for event in cleaned if event["impact"] == "high"])
    medium_impact = len([event for event in cleaned if event["impact"] == "medium"])

    return {
        "status": "High" if high_impact >= 3 else "Moderate" if cleaned else "Low",
        "event_count": len(cleaned),
        "high_impact": high_impact,
        "medium_impact": medium_impact,
        "items": cleaned,
        "updated_at": datetime.now().isoformat(),
    }