import pandas as pd
import numpy as np
import lightgbm as lgb
import pickle
from datetime import datetime
from typing import List, Dict, Any, Tuple
import os

from app.ml.features import build_feature_vector
from app.data.database import get_db_connection

def fetch_training_data() -> Tuple[List[List[float]], List[int]]:
    """Fetch historical call data and build features/labels for training."""
    conn = get_db_connection()

    # Fetch call outcomes with positive/negative labels
    query = """
    SELECT
        co.user_a_id,
        co.user_b_id,
        co.match_outcome
    FROM
        call_outcomes co
    WHERE
        co.match_outcome IS NOT NULL
    """
    call_data = pd.read_sql(query, conn)

    # Fetch user data needed for feature calculation
    user_ids = list(set(call_data['user_a_id'].tolist() + call_data['user_b_id'].tolist()))
    user_placeholders = ','.join(['%s'] * len(user_ids))

    user_query = f"""
    SELECT
        u.id,
        pp.personality_vector,
        ui.interests,
        us.user_score,
        pp.pref_personality_weight,
        pp.pref_interests_weight,
        pp.pref_diversity_factor
    FROM
        users u
    JOIN
        personality_profiles pp ON u.id = pp.user_id
    JOIN
        user_interests ui ON u.id = ui.user_id
    JOIN
        user_scores us ON u.id = us.user_id
    WHERE
        u.id IN ({user_placeholders})
    """

    user_data = pd.read_sql(user_query, conn, params=user_ids)

    # Convert to dictionary for easy lookup
    user_dict = {row['id']: row for _, row in user_data.iterrows()}

    # Build feature vectors and labels
    X, y = [], []

    for _, row in call_data.iterrows():
        user_a = user_dict.get(row['user_a_id'])
        user_b = user_dict.get(row['user_b_id'])

        if user_a is None or user_b is None:
            continue  # Skip if we don't have data for both users

        feature_vector = build_feature_vector(user_a, user_b)
        label = row['match_outcome']

        X.append(feature_vector)
        y.append(label)

    return X, y

def train_model() -> None:
    """Train the matching model and save it."""
    X, y = fetch_training_data()

    if len(X) < 100:
        print(f"Warning: Only {len(X)} training examples. Model may not be reliable.")

    # Convert to numpy arrays
    X_np = np.array(X)
    y_np = np.array(y)

    # Create LightGBM datasets
    train_data = lgb.Dataset(X_np, label=y_np)

    # Set parameters
    params = {
        'objective': 'binary',
        'metric': 'auc',
        'boosting_type': 'gbdt',
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.9,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': -1
    }

    # Train the model
    print("Training LightGBM model...")
    model = lgb.train(params, train_data, num_boost_round=1000)

    # Save the model
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_dir = "app/ml/saved_models"
    os.makedirs(model_dir, exist_ok=True)

    model_path = f"{model_dir}/match_model_{timestamp}.txt"
    model.save_model(model_path)

    # Also save as the "latest" model
    latest_path = f"{model_dir}/match_model_latest.txt"
    model.save_model(latest_path)

    print(f"Model saved to {model_path} and {latest_path}")

    # Optional: Feature importance analysis
    feature_names = [
        "personality_cosine_sim",
        "personality_euclidean_sim",
        "interest_overlap",
        "user_score_i",
        "user_score_j",
        "user_score_diff",
        "pref_personality_i",
        "pref_personality_j",
        "pref_interests_i",
        "pref_interests_j",
        "pref_diversity_i",
        "pref_diversity_j"
    ]

    importance = model.feature_importance()
    for i, name in enumerate(feature_names):
        if i < len(importance):
            print(f"{name}: {importance[i]}")

if __name__ == "__main__":
    train_model()
