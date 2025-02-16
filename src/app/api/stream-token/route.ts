// /app/api/stream-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { StreamClient } from "@stream-io/node-sdk";

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

const tokenProvider = async (user_id: string) => {
  try {
    if (!STREAM_API_KEY) {
      console.error("Stream API key is missing");
      throw new Error("Stream API key is missing");
    }
    if (!STREAM_API_SECRET) {
      console.error("Stream API secret is missing");
      throw new Error("Stream API secret is missing");
    }

    console.log("STREAM_API_KEY:", STREAM_API_KEY);
    console.log(
      "STREAM_API_SECRET:",
      STREAM_API_SECRET ? "defined" : "undefined",
    );

    // Initialize the Stream client and generate a user token
    const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
    const token = streamClient.generateUserToken({ user_id });
    console.log("Generated stream token:", token);

    return token;
  } catch (err: any) {
    console.error("Error in tokenProvider:", err);
    throw new Error(
      err.message || "An error occurred while generating the token",
    );
  }
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    // Return a 500 if there’s an error fetching the user
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.user) {
    // Redirect to login if no user is found
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // For demonstration, using a static user_id "Luminara_Unduli"
  // You can replace it with data.user.id or any dynamic value as needed.
  const stream_token = await tokenProvider("Luminara_Unduli");

  return NextResponse.json({
    apiKey: STREAM_API_KEY,
    user: "Luminara_Unduli",
    stream_token,
  });
}
