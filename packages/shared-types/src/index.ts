// Define any shared TypeScript interfaces or types here.
export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  personality_vector?: number[];
  interests?: string[];
  user_score?: number;
  pref_personality_weight?: number;
  pref_interests_weight?: number;
  pref_diversity_factor?: number;
}
