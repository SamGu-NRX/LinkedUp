# app/main.py
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import lightgbm as lgb
import openai

from app.matching import (
    create_user_text,
    generate_user_embeddings,
    find_similar_users,
    cluster_users
)

app = FastAPI()

# Configure OpenAI API key (set this in your Docker runtime or .env file)
openai.api_key = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY")

# Sample user data
users = [
    {"id": "user1", "username": "alice", "personality_type": "INTJ", "activity_score": 0.85,
     "interests": ["AI", "Machine Learning", "Quantum Computing"]},
    {"id": "user2", "username": "bob", "personality_type": "ESTP", "activity_score": 0.65,
     "interests": ["Thermochemistry", "Molecular Biology"]},
    {"id": "user3", "username": "charlie", "personality_type": "INFP", "activity_score": 0.92,
     "interests": ["AI", "Poetry", "Philosophy"]}
]

# Load the ML model (trained separately via train_model.py)
model = None
model_file = "match_model.txt"
if os.path.exists(model_file):
    model = lgb.Booster(model_file=model_file)

# Request model for prediction
class PredictRequest(BaseModel):
    features: List[float]

@app.post("/predict_match_score")
def predict_match_score(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="ML model not loaded.")
    x = np.array([request.features], dtype=np.float32)
    score = model.predict(x)[0]
    return {"score": float(score)}

# Endpoint to return similar users based on vector similarity
class SimilarUsersRequest(BaseModel):
    user_id: str
    top_n: Optional[int] = 2

@app.get("/similar_users")
def get_similar_users(user_id: str, top_n: int = 2):
    try:
        embeddings = generate_user_embeddings(users)
        similar = find_similar_users(user_id, embeddings, top_n)
        return {"similar_users": similar}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to cluster users based on their embeddings
@app.get("/cluster_users")
def get_cluster_users(n_clusters: int = 2):
    try:
        embeddings = generate_user_embeddings(users)
        clusters = cluster_users(embeddings, n_clusters)
        return {"clusters": clusters}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "Welcome to the ML-based Matching System API"}
