import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRoomForUser } from "@/lib/matching";
import { iceProvider } from "@/server/call/ice-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Sign in to join this call." }, { status: 401, headers });
  const roomId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("roomId"));
  if (!roomId.success) return NextResponse.json({ message: "Invalid call room." }, { status: 400, headers });
  const access = await getRoomForUser(userId, roomId.data);
  if (!access.allowed) return NextResponse.json({ message: "You do not have access to this call." }, { status: 403, headers });
  try {
    const config = await iceProvider({
      TURN_CLOUDFLARE_KEY_ID: process.env.TURN_CLOUDFLARE_KEY_ID,
      TURN_CLOUDFLARE_API_TOKEN: process.env.TURN_CLOUDFLARE_API_TOKEN,
      TURN_SHARED_SECRET: process.env.TURN_SHARED_SECRET,
      TURN_URLS: process.env.TURN_URLS,
    }).issue(String(access.me.id));
    return NextResponse.json(config, { headers });
  } catch {
    return NextResponse.json({ message: "The call service could not prepare network access." }, { status: 503, headers });
  }
}
