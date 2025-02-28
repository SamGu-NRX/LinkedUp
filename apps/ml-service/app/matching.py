# app/matching.py
import numpy as np
import openai
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans

def create_user_text(user: dict) -> str:
    """Create a textual representation for a user profile."""
    interests_text = ", ".join(user["interests"])
    return (
        f"Username: {user['username']}\n"
        f"Personality Type: {user['personality_type']}\n"
        f"Activity Score: {user['activity_score']}\n"
        f"Interests: {interests_text}"
    )

def generate_user_embeddings(users_list: list) -> dict:
    """
    Generate embeddings for each user using the OpenAI API.
    Returns a dictionary mapping user IDs to their embeddings.
    """
    user_embeddings = {}
    for user in users_list:
        user_text = create_user_text(user)
        # Generate embedding via OpenAI's text-embedding model
        response = openai.Embedding.create(
            model="text-embedding-ada-002",
            input=user_text
        )
        embedding = response['data'][0]['embedding']
        user_embeddings[user["id"]] = {
            "user": user,
            "embedding": embedding
        }
    return user_embeddings

def find_similar_users(user_id: str, user_embeddings: dict, top_n: int = 2) -> list:
    """Find the top N similar users based on cosine similarity."""
    target_embedding = user_embeddings[user_id]["embedding"]
    similarities = []
    for uid, data in user_embeddings.items():
        if uid != user_id:
            sim_score = cosine_similarity(
                [target_embedding],
                [data["embedding"]]
            )[0][0]
            similarities.append({
                "id": uid,
                "username": data["user"]["username"],
                "personality_type": data["user"]["personality_type"],
                "activity_score": data["user"]["activity_score"],
                "interests": data["user"]["interests"],
                "similarity": sim_score
            })
    similarities.sort(key=lambda x: x["similarity"], reverse=True)
    return similarities[:top_n]

def cluster_users(user_embeddings: dict, n_clusters: int = 2) -> dict:
    """
    Cluster users into groups based on their embeddings using K-means.
    Returns a dictionary mapping cluster IDs to lists of user profiles.
    """
    user_ids = list(user_embeddings.keys())
    embeddings_array = np.array([user_embeddings[uid]["embedding"] for uid in user_ids])
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    clusters = kmeans.fit_predict(embeddings_array)
    clustered_users = {}
    for i, cluster_id in enumerate(clusters):
        if cluster_id not in clustered_users:
            clustered_users[cluster_id] = []
        user_id = user_ids[i]
        clustered_users[cluster_id].append({
            "id": user_id,
            "username": user_embeddings[user_id]["user"]["username"],
            "personality_type": user_embeddings[user_id]["user"]["personality_type"],
            "activity_score": user_embeddings[user_id]["user"]["activity_score"],
            "interests": user_embeddings[user_id]["user"]["interests"]
        })
    return clustered_users
