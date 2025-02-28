# apps/ml-service/app/ml/sentiment.py
import os
from typing import Dict, Optional
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def analyze_feedback(feedback: str) -> Dict[str, float]:
    """
    Analyze user feedback to extract personality traits.
    Returns a dictionary of trait adjustments.
    """
    if not feedback or len(feedback.strip()) < 10:
        return {}

    prompt = f"""
    Based on the following feedback from a user about a conversation they had,
    analyze which personality traits are exhibited. Rate each trait on a scale from -1 to 1,
    where -1 means very low, 0 means neutral/average, and 1 means very high.

    Feedback: "{feedback}"

    Please analyze for these traits:
    - extraversion: How outgoing, talkative, and energetic they were
    - agreeableness: How cooperative, kind, and sympathetic they were
    - conscientiousness: How organized, responsible, and hardworking they were
    - neuroticism: How anxious, insecure, or emotionally unstable they seemed
    - openness: How creative, curious, and open to new experiences they were

    Return only a JSON object with these traits as keys and the numeric values (-1 to 1) as values.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json_object"}
        )

        # Extract and parse the JSON
        result = response.choices[0].message.content
        import json
        trait_scores = json.loads(result)

        # Ensure we only have the expected traits
        valid_traits = ["extraversion", "agreeableness", "conscientiousness", "neuroticism", "openness"]
        filtered_scores = {k: v for k, v in trait_scores.items() if k in valid_traits}

        return filtered_scores
    except Exception as e:
        print(f"Error analyzing feedback: {e}")
        return {}
