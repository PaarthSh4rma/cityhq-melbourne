"""Compatibility wrapper for the original service import path."""


async def get_weather():
    from app.ingestion import ingestion

    return (await ingestion.get("weather")).model_dump(mode="json")
