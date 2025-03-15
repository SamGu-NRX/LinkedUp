import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from 'dotenv';

config({ path: '.env' }); // or .env.local

const connectionString = process.env.DATABASE_URL! as string;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Configure Postgres with more connection options
const client = postgres(connectionString, {
  max: 10, // Connection pool size
  idle_timeout: 20, // How long a connection can be idle before being removed
  connect_timeout: 10, // Connection timeout in seconds
  prepare: false, // Use simple query protocol, disable prefetch as it is not supported for "Transaction" pool mode
});

// Test the connection immediately
const testConnection = async () => {
  try {
    await client`SELECT 1`;
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};

// Only run in server context
if (typeof window === "undefined") {
  testConnection().catch(console.error);
}

export const db = drizzle(client, { schema, logger: true });

export default db;
export type DrizzleClient = typeof db;
