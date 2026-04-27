import os
import httpx
from fastapi import HTTPException

API_KEY = os.getenv("OPENWEATHER_API_KEY")
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


async def get_weather():
    if not API_KEY:
        raise HTTPException(status_code=500, detail="OPENWEATHER_API_KEY is missing")

    params = {
        "q": "Melbourne,AU",
        "appid": API_KEY,
        "units": "metric",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(BASE_URL, params=params)
        data = response.json()

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=data,
        )

    return {
        "temperature": data["main"]["temp"],
        "condition": data["weather"][0]["main"],
        "description": data["weather"][0]["description"],
        "wind_speed": data["wind"]["speed"],
        "city": data["name"],
    }