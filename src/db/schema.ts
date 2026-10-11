// src/db/schema.ts
import { relations, sql } from "drizzle-orm";
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
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
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

// --- Matching queue and call rooms (LS0) --------------------------------

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueType: varchar("queue_type", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  user1Id: integer("user1_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  user2Id: integer("user2_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const queueEntries = pgTable(
  "queue_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    queueType: varchar("queue_type", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("waiting"),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    exitedAt: timestamp("exited_at", { withTimezone: true }),
  },
  (table) => [
    // One live queue slot per user: no double-joining, ever.
    uniqueIndex("queue_entries_user_waiting_unique")
      .on(table.userId)
      .where(sql`status = 'waiting'`),
    // Pairing index: the matcher scans waiting entries by type.
    index("queue_entries_pairing_idx").on(table.queueType, table.status),
  ],
);
