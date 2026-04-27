from fastapi import FastAPI
from app.services_weather_imm import get_weather
from app.services_transport_imm import get_transport_status
from app.services_events_imm import get_event_status
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
load_dotenv()

app = FastAPI(title="CityHQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {"message": "CityHQ backend running"}


@app.get("/weather")
async def weather():
    data = await get_weather()
    return data

@app.get("/transport")
async def transport():
    return await get_transport_status()

@app.get("/events")
async def events():
    return await get_event_status()