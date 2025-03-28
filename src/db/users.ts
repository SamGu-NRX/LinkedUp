import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * This users table schema is designed based on the onboarding flow and react-hook-form usage in your components.
 * It includes essential fields such as first name, last name, email, password (if applicable), bio,
 * interests, and professional information.
 *
 * Adjust field types or lengths as needed to match your application requirements.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  /**
   * It's recommended to store passwords as a hashed value.
   * If not using password auth, you might remove this field or mark it as optional.
   */
  password: text('password'),
  /**
   * A brief biography about the user.
   */
  bio: text('bio'),
  /**
   * A JSON string or comma-separated values representing user interests.
   * You can later parse it into an array if needed.
   */
  interests: text('interests'),
  /**
   * Professional information collected during onboarding.
   * This may include job title, company name, industry, etc.
   */
  professionalInfo: text('professional_info'),
  /**
   * Timestamps to track user record creation and updates.
   */
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});
