# apps/ml-service/app/ml/features.py
import numpy as np
from scipy.spatial.distance import cosine, euclidean
from typing import List, Dict, Any

def compute_similarity(vec1: List[float], vec2: List[float]) -> Dict[str, float]:
    """Calculate vector similarity metrics."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return {"cosine_similarity": 0.0, "euclidean_similarity": 0.0}

    vec1 = np.array(vec1)
    vec2 = np.array(vec2)

    # Cosine similarity (1 = identical, 0 = orthogonal)
    cosine_sim = 1 - cosine(vec1, vec2) if not np.all(vec1 == 0) and not np.all(vec2 == 0) else 0

    # Euclidean distance (normalized to 0-1 range)
    # Max possible distance is sqrt(n*4) for n dimensions, assuming each is 0-1 range
    max_dist = np.sqrt(len(vec1) * 4)  # Max possible distance assuming 0-1 range per dimension
    euc_dist = euclidean(vec1, vec2) / max_dist
    euc_sim = 1 - euc_dist  # Convert to similarity

   # Per-dimension differences (optional feature)
    dim_diffs = np.abs(vec1 - vec2).tolist()

    return {
        "cosine_similarity": float(cosine_sim),
        "euclidean_similarity": float(euc_sim),
        "dimension_differences": dim_diffs
    }

def build_match_features(user_i: Dict[str, Any], user_j: Dict[str, Any]) -> List[float]:
    """Build feature vector for a pair of users."""
    features = []

    # Personality similarity features
    if user_i.get("personality_vector") and user_j.get("personality_vector"):
        p_sim = compute_similarity(
            user_i["personality_vector"],
            user_j["personality_vector"]
        )
        features.append(p_sim["cosine_similarity"])
        features.append(p_sim["euclidean_similarity"])
    else:
        features.extend([0.5, 0.5])  # Default values if vectors missing

    # Interest similarity
    if user_i.get("interest_embedding") and user_j.get("interest_embedding"):
        i_sim = compute_similarity(
            user_i["interest_embedding"],
            user_j["interest_embedding"]
        )
        features.append(i_sim["cosine_similarity"])
    else:
        features.append(0.5)  # Default value

    # User scores
    features.append(user_i.get("user_score", 0))
    features.append(user_j.get("user_score", 0))
    features.append(abs(user_i.get("user_score", 0) - user_j.get("user_score", 0)))

    # User preferences
    features.append(user_i.get("pref_personality_weight", 0.7))
    features.append(user_j.get("pref_personality_weight", 0.7))
    features.append(user_i.get("pref_interests_weight", 0.3))
    features.append(user_j.get("pref_interests_weight", 0.3))
    features.append(user_i.get("pref_diversity_factor", 0.2))
    features.append(user_j.get("pref_diversity_factor", 0.2))

    return features

def compute_interest_overlap(interests1: List[str], interests2: List[str]) -> float:
    """Calculate Jaccard similarity between two sets of interests."""
    set1 = set(interests1)
    set2 = set(interests2)

    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))

    if union == 0:
        return 0.0

    return intersection / union
