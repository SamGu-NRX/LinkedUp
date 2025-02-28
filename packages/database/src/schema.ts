// packages/database/src/schema.ts
import {
  pgTable,
  serial,
  uuid,
  json,
  integer,
  float,
  timestamp,
  text,
} from "drizzle-orm/pg-core";
import { vector } from "./pgvector-extension"; // Custom vector type for Drizzle

// User's personality profile with vector embedding
export const personalityProfiles = pgTable("personality_profiles", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Store as vector type for efficient similarity search
  personalityVector: vector("personality_vector", 5), // 5-dim for Big Five traits
  // Original quiz answers (useful for retraining)
  quizResponses: json("quiz_responses")
    .$type<Record<string, number>>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Weights used for matching preferences
  prefPersonalityWeight: float("pref_personality_weight").default(0.7),
  prefInterestsWeight: float("pref_interests_weight").default(0.3),
  prefDiversityFactor: float("pref_diversity_factor").default(0.2),
});

// User interests with vector embedding
export const userInterests = pgTable("user_interests", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Store as array of interest names
  interests: text("interests").array().notNull(),
  // Interest embedding for similarity search
  interestEmbedding: vector("interest_embedding", 128), // 128-dim embedding
});

// Call outcomes for model training with sentiment analysis
export const callOutcomes = pgTable("call_outcomes", {
  id: serial("id").primaryKey(),
  callId: uuid("call_id").notNull(),
  userAId: uuid("user_a_id")
    .notNull()
    .references(() => users.id),
  userBId: uuid("user_b_id")
    .notNull()
    .references(() => users.id),
  userARating: integer("user_a_rating"), // 1-5 or null
  userBRating: integer("user_b_rating"), // 1-5 or null
  callDuration: integer("call_duration"), // seconds
  wasCompleted: boolean("was_completed").default(false),
  // 1 = good match, 0 = bad match (derived from ratings and duration)
  matchOutcome: integer("match_outcome").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // User-provided feedback that can affect personality vectors
  userAFeedback: text("user_a_feedback"),
  userBFeedback: text("user_b_feedback"),
  // Processed sentiment/traits from feedback
  sentimentAnalysis: json("sentiment_analysis").$type<Record<string, number>>(),
});

// User scores (trust & engagement)
export const userScores = pgTable("user_scores", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  connectionScore: float("connection_score").default(0),
  reputationScore: float("reputation_score").default(0),
  achievementScore: float("achievement_score").default(0),
  engagementScore: float("engagement_score").default(0),
  // Composite score calculated from above
  userScore: float("user_score").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
