import { useSession } from "@clerk/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

export function createClerkSupabaseClient(
  session: ReturnType<typeof useSession>,
): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      global: {
        // Override the global fetch to inject the Clerk Supabase token
        fetch: async (url, options = {}) => {
          const clerkToken = await session?.session?.getToken({
            template: "supabase",
          });

          // Set up the headers with the token
          const headers = new Headers(options?.headers);
          headers.set("Authorization", `Bearer ${clerkToken}`);

          // Call the default fetch with the new headers
          return fetch(url, {
            ...options,
            headers,
          });
        },
      },
    },
  );
}

/**
 * Custom hook to get the Clerk Supabase client.
 * This hook will re-create the client whenever the session changes.
 */
export function useClerkSupabaseClient(): SupabaseClient {
  const session = useSession();

  // Memoize the client so it's only recreated when the session changes
  return useMemo(() => createClerkSupabaseClient(session), [session]);
}
