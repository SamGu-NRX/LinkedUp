import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from 'dotenv';

config({ path: '.env' }); // or .env.local

const connectionString = process.env.DATABASE_URL! as string;

// Disable prefetch as it is not supported for "Transaction" pool mode
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema, logger: true });

export default db;
export type DrizzleClient = typeof db;
