// src/db/schema.ts
import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  bigserial,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
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
    // Liveness: the last time the person's queue screen polled. Stale
    // entries expire on this, not on joinedAt (src/lib/matching.ts).
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    exitedAt: timestamp("exited_at", { withTimezone: true }),
  },
  (table) => [
    // One live queue slot per user: no double-joining, ever.
    // Waiting and matched both count: a matched person queueing again
    // must not get a second entry that pairs into a second room.
    uniqueIndex("queue_entries_user_live_unique")
      .on(table.userId)
      .where(sql`status IN ('waiting', 'matched')`),
    // Pairing index: the matcher scans waiting entries by type.
    index("queue_entries_pairing_idx").on(table.queueType, table.status),
  ],
);

// --- Call signaling (LS1) -------------------------------------------------
// Every browser tab in a call room has its own session; signals are
// addressed to a session, not a user (src/lib/call/mesh.ts).

export const callSessions = pgTable(
  "call_sessions",
  {
    id: serial("id").primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "open" while in the call, then "closed" with a reason. */
    state: varchar("state", { length: 10 }).notNull().default("open"),
    closedReason: varchar("closed_reason", { length: 10 }),
    micOn: boolean("mic_on").notNull().default(true),
    cameraOn: boolean("camera_on").notNull().default(true),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
    /** Start of the current send-rate window and the sends counted in it. */
    rateWindowStart: timestamp("rate_window_start", { withTimezone: true }).notNull().defaultNow(),
    rateCount: integer("rate_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("call_sessions_room_session_unique").on(table.roomId, table.sessionId),
    index("call_sessions_room_state_idx").on(table.roomId, table.state),
    index("call_sessions_room_user_state_idx").on(table.roomId, table.userId, table.state),
    index("call_sessions_state_heartbeat_idx").on(table.state, table.lastHeartbeatAt),
  ],
);

export const callSignals = pgTable(
  "call_signals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    fromSessionId: varchar("from_session_id", { length: 64 }).notNull(),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toSessionId: varchar("to_session_id", { length: 64 }).notNull(),
    /** The signal as the browser produced it (description or candidate). */
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("call_signals_unread_idx").on(table.roomId, table.toSessionId, table.processed, table.id),
    index("call_signals_cleanup_idx").on(table.processed, table.createdAt),
  ],
);

/**
 * When call maintenance (the stale-session sweep and cleanup) last ran. One
 * row; polls race to claim a run (src/lib/call/mesh.ts runMaintenanceIfDue).
 */
export const callMaintenance = pgTable("call_maintenance", {
  id: integer("id").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }).notNull(),
});

/**
 * One person's signaling spend in the current window, across every session
 * and room (src/lib/call/mesh.ts spendBudget).
 */
export const callUserBudgets = pgTable("call_user_budgets", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  used: integer("used").notNull(),
});

export const callRatings = pgTable(
  "call_ratings",
  {
    id: serial("id").primaryKey(),
    roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("call_ratings_room_user_unique").on(table.roomId, table.userId),
    check("call_ratings_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);
