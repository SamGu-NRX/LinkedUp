// /app/api/stream-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { tokenProvider } from "@/actions/stream.actions";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }


  // Instead of creating the client, generate and return the token and necessary user data.
  const user = data?.user;
  // Assume tokenProvider.getToken is a function that returns a token.
  const stream_token = await tokenProvider();


  console.log(stream_token);

  return NextResponse.json({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY as string,
    user: {
      id: user.id,
      name: user.user_metadata.full_name || user.id,
      image: user.user_metadata.avatar_url,
    },
    stream_token,
  });
}
