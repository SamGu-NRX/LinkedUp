# train_model.py
import numpy as np
import lightgbm as lgb
from sklearn.metrics.pairwise import cosine_similarity
import numpy.linalg as la

# Dummy functions for feature engineering
def cosine_similarity_feature(p_i, p_j):
    return cosine_similarity([p_i], [p_j])[0][0]

def euclidean_distance(p_i, p_j):
    return la.norm(np.array(p_i) - np.array(p_j))

def compute_interest_overlap(interests_i, interests_j):
    set_i = set(interests_i)
    set_j = set(interests_j)
    intersection = set_i.intersection(set_j)
    union = set_i.union(set_j)
    return len(intersection) / len(union) if union else 0.0

def compute_features(user_i, user_j):
    """
    Compute a feature vector for a pair of users.
    For demonstration, we use a dummy mapping for personality types.
    """
    personality_map = {
        "INTJ": [0.8, 0.2, 0.7],
        "ESTP": [0.3, 0.9, 0.4],
        "INFP": [0.7, 0.5, 0.8]
    }
    p_i = personality_map.get(user_i["personality_type"], [0.5, 0.5, 0.5])
    p_j = personality_map.get(user_j["personality_type"], [0.5, 0.5, 0.5])
    cos_sim = cosine_similarity_feature(p_i, p_j)
    dist = euclidean_distance(p_i, p_j)
    inter_sim = compute_interest_overlap(user_i["interests"], user_j["interests"])
    uscore_i = user_i["activity_score"]
    uscore_j = user_j["activity_score"]
    return [
        cos_sim,     # personality cosine similarity
        dist,        # personality euclidean distance
        inter_sim,   # interest overlap similarity
        uscore_i,    # user i activity score
        uscore_j,    # user j activity score
        abs(uscore_i - uscore_j)  # difference in activity scores
    ]

# Dummy user dataset
users = [
    {"id": "user1", "username": "alice", "personality_type": "INTJ", "activity_score": 0.85,
     "interests": ["AI", "Machine Learning", "Quantum Computing"]},
    {"id": "user2", "username": "bob", "personality_type": "ESTP", "activity_score": 0.65,
     "interests": ["Thermochemistry", "Molecular Biology"]},
    {"id": "user3", "username": "charlie", "personality_type": "INFP", "activity_score": 0.92,
     "interests": ["AI", "Poetry", "Philosophy"]}
]

# Dummy historical call outcomes with labels (1 = good match, 0 = poor match)
historical_calls = [
    {"user_i": "user1", "user_j": "user2", "outcome_label": 0},
    {"user_i": "user1", "user_j": "user3", "outcome_label": 1},
    {"user_i": "user2", "user_j": "user3", "outcome_label": 0}
]

# Build a lookup dictionary for users
user_dict = {user["id"]: user for user in users}

X = []
y = []
for record in historical_calls:
    user_i = user_dict[record["user_i"]]
    user_j = user_dict[record["user_j"]]
    feats = compute_features(user_i, user_j)
    X.append(feats)
    y.append(record["outcome_label"])

X = np.array(X)
y = np.array(y)

# Train the LightGBM model
train_data = lgb.Dataset(X, label=y)
params = {
    "objective": "binary",
    "metric": "auc",
    "learning_rate": 0.05,
    "num_leaves": 31,
    "max_depth": -1,
    "verbosity": -1
}
model = lgb.train(params, train_data, num_boost_round=100)

# Save the trained model to a file that the API will load
model.save_model("match_model.txt")
print("Model trained and saved as match_model.txt")
