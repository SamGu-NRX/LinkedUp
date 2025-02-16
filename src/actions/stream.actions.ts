"use server";

import { StreamClient } from "@stream-io/node-sdk";
import { createClient } from "@/utils/supabase/server";

const STREAM_API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_SECRET_KEY;

export const tokenProvider = async () => {
  try {
    // Initialize Supabase client and retrieve the authenticated user
    // const supabase = await createClient();
    // const { data, error } = await supabase.auth.getUser();

    // if (error) {
    //   console.error("Error fetching user from Supabase:", error);
    //   throw new Error(`Supabase error: ${error.message}`);
    // }

    // if (!data?.user) {
    //   console.warn("User is not authenticated");
    //   throw new Error("User is not authenticated");
    // }

    // Validate environment variables
    if (!STREAM_API_KEY) {
      console.error("Stream API key is missing");
      throw new Error("Stream API key is missing");
    }
    if (!STREAM_API_SECRET) {
      console.error("Stream API secret is missing");
      throw new Error("Stream API secret is missing");
    }

    // Log details for debugging (ensure to remove or secure sensitive info in production)
    console.log("STREAM_API_KEY:", STREAM_API_KEY);
    console.log(
      "STREAM_API_SECRET:",
      STREAM_API_SECRET ? "defined" : "undefined",
    );
    // console.log("User data:", data);

    // Create Stream client and generate token
    const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);

    // Optionally, if needed for custom token generation, you could utilize expirationTime and issuedAt.
    // Currently, the SDK method generateUserToken doesn't use them directly.
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // expires in 1 hour
    const issuedAt = Math.floor(Date.now() / 1000) - 60; // issued 1 minute in the past

    const token = streamClient.generateUserToken({ user_id: "Luminara_Unduli", });
    console.log("Generated stream token:", token);

    return token;
  } catch (err: any) {
    console.error("Error in tokenProvider:", err);
    throw new Error(
      err.message || "An error occurred while generating the token",
    );
  }
};
