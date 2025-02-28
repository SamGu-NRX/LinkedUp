from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import os

from app.ml.prediction import MatchingModel
from app.api.schemas import UserData, MatchRequest, MatchResult, PersonalityVector
from app.data.database import get_db_connection

app = FastAPI(title="Personality Matching API")

# Global model instance
model = None

@app.on_event("startup")
async def startup_event():
    global model
    try:
        model = MatchingModel()
        print("Model loaded successfully")
    except Exception as e:
        print(f"Warning: Could not load model. Error: {e}")
        # Don't fail startup, as we may want to train model first

@app.post("/predict-match")
async def predict_match(req: MatchRequest) -> float:
    """Predict match score between two users."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    return model.predict_match_score(req.user_a.dict(), req.user_b.dict())

@app.post("/find-matches")
async def find_matches(req: MatchRequest, limit: int = 5) -> List[MatchResult]:
    """Find top matches for a user from a pool of candidates."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    matches = model.get_top_matches(
        req.user_a.dict(),
        [u.dict() for u in req.candidates],
        limit=limit
    )

    return [MatchResult(**m) for m in matches]

@app.post("/update-personality")
async def update_personality(user_id: str, vector: PersonalityVector):
    """Update a user's personality vector based on feedback."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get current vector
    cursor.execute(
        "SELECT personality_vector FROM personality_profiles WHERE user_id = %s",
        (user_id,)
    )
    result = cursor.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    current_vector = result[0]

    # Apply small update to vector (1-3% shift)
    update_factor = 0.02  # 2% shift
    updated_vector = [
        cv * (1 - update_factor) + nv * update_factor
        for cv, nv in zip(current_vector, vector.values)
    ]

    # Update in database
    cursor.execute(
        """
        UPDATE personality_profiles
        SET personality_vector = %s, updated_at = NOW()
        WHERE user_id = %s
        """,
        (updated_vector, user_id)
    )

    conn.commit()
    return {"status": "success", "updated_vector": updated_vector}

@app.post("/train-model")
async def train_model_endpoint():
    """Endpoint to trigger model training."""
    try:
        from app.ml.training import train_model
        train_model()

        # Reload the model
        global model
        model = MatchingModel()

        return {"status": "success", "message": "Model trained and loaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
