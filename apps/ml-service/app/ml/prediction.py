import lightgbm as lgb
import numpy as np
from typing import List, Dict, Optional
import os

from app.ml.features import build_feature_vector

class MatchingModel:
    def __init__(self):
        model_path = "app/ml/saved_models/match_model_latest.txt"
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}. Run training first.")

        self.model = lgb.Booster(model_file=model_path)

    def predict_match_score(self, user_i: Dict, user_j: Dict) -> float:
        """Predict match quality score between two users."""
        features = build_feature_vector(user_i, user_j)
        features_np = np.array([features])

        # Get raw prediction (0-1 probability)
        score = float(self.model.predict(features_np)[0])
        return score

    def rank_matches(self, target_user: Dict, candidate_users: List[Dict]) -> List[Dict]:
        """Rank all candidate users by match score with target user."""
        results = []

        for candidate in candidate_users:
            if candidate['id'] == target_user['id']:
                continue  # Skip self-matching

            score = self.predict_match_score(target_user, candidate)

            results.append({
                'user': candidate,
                'match_score': score
            })

        # Sort by match score, descending
        results.sort(key=lambda x: x['match_score'], reverse=True)
        return results

    def get_top_matches(self, target_user: Dict, candidate_users: List[Dict],
                        limit: int = 5, diversity_factor: Optional[float] = None) -> List[Dict]:
        """Get top N matches with optional diversity injection."""
        ranked = self.rank_matches(target_user, candidate_users)

        # If no diversity factor specified, use the user's preference
        if diversity_factor is None:
            diversity_factor = target_user.get('pref_diversity_factor', 0.2)

        if diversity_factor <= 0 or len(ranked) <= limit:
            # Just return top matches without diversity consideration
            return ranked[:limit]

        # With diversity: take some top matches but inject some diversity
        # by slightly randomizing within top 2*limit candidates
        top_pool = ranked[:min(limit*2, len(ranked))]

        # Split into definitely-included and maybe-included
        definite = top_pool[:limit//2]
        maybe = top_pool[limit//2:]

        # Apply weighted random selection to the "maybe" pool
        scores = np.array([m['match_score'] for m in maybe])

        # Normalize scores to probabilities and add diversity factor
        if len(scores) > 0:
            probs = scores / scores.sum()
            # Flatten distribution with diversity factor
            probs = probs * (1 - diversity_factor) + (diversity_factor / len(probs))

            # Select remaining matches based on adjusted probabilities
            remaining_count = limit - len(definite)
            if remaining_count > 0 and len(maybe) > 0:
                selected_indices = np.random.choice(
                    len(maybe),
                    size=min(remaining_count, len(maybe)),
                    replace=False,
                    p=probs
                )
                selected = [maybe[i] for i in selected_indices]
                result = definite + selected
                return result

        # Fallback to just top matches
        return ranked[:limit]
