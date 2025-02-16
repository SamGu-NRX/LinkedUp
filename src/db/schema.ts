// db/schema.ts
import { pgTable, serial, text, integer, timestamp, boolean, varchar, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(), // use Supabase's uuid generation
  bio: text("bio").notNull(),
  field: varchar("field", { length: 255 }).notNull(),
  jobTitle: varchar("job_title", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  linkedinUrl: varchar("linkedin_url", { length: 512 }).nullable(),
  resumeUrl: varchar("resume_url", { length: 512 }).nullable(),
  interests: text("interests").notNull(), // store as JSON string or comma-separated values
  score: integer("score").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  user1Id: uuid("user1_id").notNull(),
  user2Id: uuid("user2_id").notNull(),
  scheduledAt: timestamp("scheduled_at", { mode: "string" }).nullable(),
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
