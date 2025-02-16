"use client";

import { ReactNode, useEffect, useState } from "react";
import { StreamVideoClient, StreamVideo } from "@stream-io/video-react-sdk";
import { createClient } from "@/utils/supabase/server";
import { tokenProvider } from "@/actions/stream.actions";
import Loader from "@/components/Loader";

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY as string;

const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(
    null,
  );

  useEffect(() => {
    createClient().then((supabase) => {
      // Only wrap the getUser call in an async function.
      (async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error(error);
          return;
        }
        const user = data?.user;
        if (!user) {
          console.warn("No authenticated user found.");
          return;
        }

        if (!API_KEY) {
          throw new Error("Stream API key is missing");
        }

        const client = new StreamVideoClient({
          apiKey: API_KEY,
          user: {
            id: user.id,
            name: user.username || user.id,
            image: user.imageUrl,
          },
          tokenProvider,
        });
        setVideoClient(client);
      })();
    });
  }, []);

  if (!videoClient) return <Loader />;

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
