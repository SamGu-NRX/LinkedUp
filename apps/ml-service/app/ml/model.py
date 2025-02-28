# apps/ml-service/app/ml/model.py
import lightgbm as lgb
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import os
import pickle
from sklearn.preprocessing import StandardScaler

class MatchingModel:
    def __init__(self):
        self.model_path = "app/ml/saved_models/match_model_latest.txt"
        self.scaler_path = "app/ml/saved_models/feature_scaler.pkl"

        # Load model if exists, otherwise start with None
        if os.path.exists(self.model_path):
            self.model = lgb.Booster(model_file=self.model_path)
        else:
            self.model = None

        # Load scaler if exists, otherwise create new
        if os.path.exists(self.scaler_path):
            with open(self.scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
        else:
            self.scaler = StandardScaler()

        # Feature names for interpretation
        self.feature_names = [
            "personality_cosine_sim",
            "personality_euclidean_sim",
            "interest_sim",
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

    def predict_match_score(self, user_i: Dict[str, Any], user_j: Dict[str, Any]) -> float:
        """Predict match quality score between two users."""
        from app.ml.features import build_match_features

        if self.model is None:
            # No model yet, use a simple heuristic instead
            return self._fallback_scoring(user_i, user_j)

        features = build_match_features(user_i, user_j)

        # Transform features
        features_np = np.array([features])

        # Apply scaling if we have enough data
        if hasattr(self.scaler, 'mean_') and self.scaler.mean_ is not None:
            features_np = self.scaler.transform(features_np)

        # Get raw prediction (0-1 probability)
        score = float(self.model.predict(features_np)[0])

        # Apply user preference weighting as a post-processing step
        personality_sim = (features[0] + features[1]) / 2  # Average of cosine and euclidean
        interest_sim = features[2]
        p_weight_i = user_i.get("pref_personality_weight", 0.7)
        i_weight_i = user_i.get("pref_interests_weight", 0.3)

        # Blend model score with explicit preference weights
        preference_score = (personality_sim * p_weight_i) + (interest_sim * i_weight_i)

        # Final score is a weighted combination of model score and preference score
        alpha = 0.7  # How much to trust the model vs explicit preferences
        final_score = (alpha * score) + ((1 - alpha) * preference_score)

        return final_score

    def _fallback_scoring(self, user_i: Dict[str, Any], user_j: Dict[str, Any]) -> float:
        """Simple fallback scoring when no model is available."""
        from app.ml.features import compute_similarity

        # Calculate personality similarity
        personality_sim = 0.5  # Default
        if user_i.get("personality_vector") and user_j.get("personality_vector"):
            sim = compute_similarity(user_i["personality_vector"], user_j["personality_vector"])
            personality_sim = sim["cosine_similarity"]

        # Calculate interest similarity
        interest_sim = 0.5  # Default
        if user_i.get("interest_embedding") and user_j.get("interest_embedding"):
            sim = compute_similarity(user_i["interest_embedding"], user_j["interest_embedding"])
            interest_sim = sim["cosine_similarity"]

        # Weight according to user preferences
        p_weight = user_i.get("pref_personality_weight", 0.7)
        i_weight = user_i.get("pref_interests_weight", 0.3)

        # Simple weighted average
        score = (personality_sim * p_weight) + (interest_sim * i_weight)

        return score

    def find_similar_users(self, target_user: Dict[str, Any],
                          candidate_pool: List[Dict[str, Any]],
                          limit: int = 5) -> List[Dict[str, Any]]:
        """Find the most similar users to the target user."""
        results = []

        for candidate in candidate_pool:
            if candidate["id"] == target_user["id"]:
                continue  # Skip self-matching

            score = self.predict_match_score(target_user, candidate)

            results.append({
                "user": candidate,
                "match_score": score
            })

        # Sort by match score, descending
        results.sort(key=lambda x: x["match_score"], reverse=True)

        # Apply diversity injection based on user preference
        diversity_factor = target_user.get("pref_diversity_factor", 0.2)

        if diversity_factor > 0 and len(results) > limit:
            # Select some definite matches plus some diverse options
            return self._apply_diversity(results, limit, diversity_factor)
        else:
            # Just return top matches
            return results[:limit]

    def _apply_diversity(self, ranked_matches: List[Dict],
                         limit: int, diversity_factor: float) -> List[Dict]:
        """Apply diversity to match selection."""
        if len(ranked_matches) <= limit:
            return ranked_matches

        # Take top half matches definitely
        secure_count = limit // 2
        diversity_count = limit - secure_count

        # Get secure matches
        secure_matches = ranked_matches[:secure_count]

        # Get candidates for diversity selection
        diversity_candidates = ranked_matches[secure_count:min(limit*3, len(ranked_matches))]

        if not diversity_candidates:
            return secure_matches

        # Convert scores to probabilities with diversity factor
        scores = np.array([match["match_score"] for match in diversity_candidates])
        # Scale to sum to 1
        probs = scores / scores.sum()
        # Flatten distribution with diversity factor
        probs = probs * (1 - diversity_factor) + (diversity_factor / len(probs))

        # Select based on adjusted probabilities
        indices = np.random.choice(
            len(diversity_candidates),
            size=min(diversity_count, len(diversity_candidates)),
            replace=False,
            p=probs
        )

        diversity_selections = [diversity_candidates[i] for i in indices]

        # Combine and return
        return secure_matches + diversity_selections
