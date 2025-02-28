# apps/ml-service/app/api/routes.py
from fastapi import APIRouter, HTTPException
from app.ml.model import MatchingModel
from app.ml.training import train_model_endpoint
from app.ml.sentiment import analyze_feedback
from app.ml.vector_update import update_personality_vector

router = APIRouter()

# Initialize a global model instance
model_instance = MatchingModel()

@router.post("/predict-match-score")
def predict_match_score(features: list[float]):
    if not model_instance.model:
        raise HTTPException(status_code=503, detail="Model not available")
    import numpy as np
    x = np.array([features], dtype="float32")
    score = float(model_instance.model.predict(x)[0])
    return {"score": score}

@router.post("/find-matches")
def find_matches(user_a: dict, candidates: list[dict], limit: int = 5):
    ranked = model_instance.find_similar_users(user_a, candidates, limit=limit)
    return ranked

@router.post("/analyze-feedback")
def analyze_feedback_endpoint(payload: dict):
    feedback = payload.get("feedback", "")
    if not feedback:
        raise HTTPException(status_code=400, detail="No feedback provided")
    traits = analyze_feedback(feedback)
    return {"traits": traits}

@router.post("/update-personality")
def update_personality(payload: dict):
    user_id = payload.get("user_id")
    current_vector = payload.get("current_vector")  # expect a list of numbers
    feedback_traits = payload.get("feedback_traits")
    if not (user_id and current_vector):
        raise HTTPException(status_code=400, detail="Missing user_id or current_vector")
    updated_vector = update_personality_vector(current_vector, feedback=feedback_traits)
    return {"updated_vector": updated_vector}

@router.post("/train-model")
def train_model_route():
    # Trigger the training process. This could be an async job.
    try:
        train_model_endpoint()
        # Reload the model after training
        global model_instance
        model_instance = MatchingModel()
        return {"status": "Model trained and loaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
