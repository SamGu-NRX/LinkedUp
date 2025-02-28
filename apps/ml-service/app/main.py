# apps/ml-service/app/main.py
from fastapi import FastAPI
from app.api.routes import router as api_router

app = FastAPI(title="ML Matching Service")

app.include_router(api_router)
