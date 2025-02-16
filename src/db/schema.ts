// db/schema.ts
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(), // Use Supabase's uuid generation
  // Authentication-related fields:
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  imageUrl: text("image_url"),

  // Additional profile fields (fields are nullable by default if you don't chain .notNull())
  bio: text("bio"),
  field: varchar("field", { length: 255 }),
  jobTitle: varchar("job_title", { length: 255 }),
  company: varchar("company", { length: 255 }),
  linkedinUrl: varchar("linkedin_url", { length: 512 }),
  resumeUrl: varchar("resume_url", { length: 512 }),
  interests: text("interests"),
  score: integer("score").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  user1Id: uuid("user1_id").notNull(),
  user2Id: uuid("user2_id").notNull(),
  scheduledAt: timestamp("scheduled_at", { mode: "string" }),
  isRandom: boolean("is_random").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  user1Id: uuid("user1_id").notNull(),
  user2Id: uuid("user2_id").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

// New table for text-based messages between connected users
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").notNull(),
  senderId: uuid("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
