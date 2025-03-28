// src/db/schema.ts
import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  age: integer("age"),
  gender: varchar("gender", { length: 20 }),
  field: varchar("field", { length: 100 }),
  jobTitle: varchar("job_title", { length: 100 }),
  company: varchar("company", { length: 100 }),
  linkedinUrl: varchar("linkedin_url", { length: 255 }),
  bio: text("bio"),
  onboardingComplete: boolean("onboarding_complete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interests = pgTable("interests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  iconName: varchar("icon_name", { length: 50 }),
  customId: varchar("custom_id", { length: 100 }),
});

export const userRelations = relations(users, ({ many }) => ({
  interests: many(interests),
}));

export const interestRelations = relations(interests, ({ one }) => ({
  user: one(users, {
    fields: [interests.userId],
    references: [users.id],
  }),
}));

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
