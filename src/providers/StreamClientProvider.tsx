"use client";

import { ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import Loader from "@/components/Loader";

const DynamicStreamVideo = dynamic(
  () => import("@stream-io/video-react-sdk").then((mod) => mod.StreamVideo),
  { ssr: false },
);

const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(
    null,
  );

  useEffect(() => {
    async function initClient() {
      try {
        const res = await fetch("/api/stream-token");

        if (!res.ok) {
          // Differentiate between an authentication issue and another error.
          if (res.status === 401 || res.status === 403) {
            console.error("User is not authenticated.");
            // Optionally, you can set some state to redirect the user to a login page.
          } else {
            console.error(`Failed to fetch stream token. Status: ${res.status}`);
          }
          return;
        }

        const { apiKey, user, token } = await res.json();

        if (!apiKey || !user || !token) {
          console.error("Missing required stream data");
          return;
        }

        // Now create the client on the client side using the plain objects.
        const client = new StreamVideoClient({
          apiKey,
          user,
          token,
        });
        setVideoClient(client);
      } catch (error) {
        console.error("An unexpected error occurred while initializing the stream client:", error);
      }
    }
    initClient();
  }, []);

  if (!videoClient) return <Loader />;
  return (
    <DynamicStreamVideo client={videoClient}>{children}</DynamicStreamVideo>
  );
};

export default StreamVideoProvider;
