"""Compatibility wrapper for the original service import path."""


async def get_event_status():
    from app.ingestion import ingestion

    return (await ingestion.get("events")).model_dump(mode="json")
