import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".db")
os.environ["WEATHER_ADAPTER"] = "demo"
os.environ["TRANSPORT_ADAPTER"] = "demo"
os.environ["EVENTS_ADAPTER"] = "demo"
os.environ["AIR_QUALITY_ADAPTER"] = "demo"
os.environ["DELHI_TRANSPORT_ADAPTER"] = "delhi-metro-static"
os.environ["MODEL_DIR"] = tempfile.mkdtemp()
import pytest

from app.ingestion import ingestion
from app.persistence import Base, engine


@pytest.fixture(autouse=True)
def database():
    Base.metadata.create_all(engine)
    ingestion.cache.clear()
    ingestion.retry_after.clear()
    ingestion.failures.clear()
    yield
    Base.metadata.drop_all(engine)
