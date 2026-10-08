"""Compatibility wrapper for the original service import path."""


async def get_transport_status():
    from app.ingestion import ingestion

    return (await ingestion.get("transport")).model_dump(mode="json")
