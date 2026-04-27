import httpx


async def get_weather():
    url = "https://wttr.in/Melbourne?format=j1"

    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()

    return {
        "temperature": data["current_condition"][0]["temp_C"],
        "condition": data["current_condition"][0]["weatherDesc"][0]["value"],
        "description": data["current_condition"][0]["weatherDesc"][0]["value"],
        "wind_speed": data["current_condition"][0]["windspeedKmph"],
        "city": "Melbourne",
    }