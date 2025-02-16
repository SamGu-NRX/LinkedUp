// app/api/messages/route.ts
import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { messages, connections } from "@/db/schema";
import { sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

// Set up the Postgres connection using your DATABASE_URL
const { Pool } = await import("pg");
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(dbPool);

/**
 * POST /api/messages
 * Request Body: { connectionId, senderId, content }
 *
 * Inserts a new message if the sender is part of the connection.
 */
export async function POST(req: Request) {
  const { connectionId, senderId, content } = await req.json();

  // Verify that the sender is part of the connection
  const [connection] = await db.select().from(connections).where(sql`
    id = ${connectionId} AND (user1Id = ${senderId} OR user2Id = ${senderId})
  `);

  if (!connection) {
    return NextResponse.json(
      { error: "Invalid connection or unauthorized" },
      { status: 403 },
    );
  }

  // Insert the new message
  const [message] = await db
    .insert(messages)
    .values({
      connectionId,
      senderId,
      content,
    })
    .returning();

  return NextResponse.json({ message });
}

/**
 * GET /api/messages?connectionId=...
 * Retrieves all messages for a given connection, ordered by creation time.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  if (!connectionId) {
    return NextResponse.json(
      { error: "Missing connectionId" },
      { status: 400 },
    );
  }

  // Retrieve messages for this connection
  const msgs = await db
    .select()
    .from(messages)
    .where(
      sql`
    connectionId = ${connectionId}
  `,
    )
    .orderBy(sql`createdAt ASC`);

  return NextResponse.json({ messages: msgs });
}
