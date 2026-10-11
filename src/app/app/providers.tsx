"use client";

import { Toaster } from "sonner";
import { ThemeProvider } from '@/components/theme-provider';
import { ClerkProvider } from "@clerk/nextjs";
import StreamVideoProvider from "@/providers/StreamClientProvider";

// L-D4: Stream stays optional in dev. When no NEXT_PUBLIC_STREAM_API_KEY is
// configured, skip the provider entirely instead of throwing, so keyless dev
// (`pnpm dev`) boots with database-only journeys. Call journeys run when the
// key is set (dev/prod) — see docs/plan/CALL-PLAN.md.
const streamApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

export function Providers({ children }: { children: React.ReactNode }) {
  const app = (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background">
        <main
        // className="container mx-auto px-4 py-6"
        >
          {children}
        </main>
      </div>
      <Toaster className="dark:hidden" />
      <Toaster theme="dark" className="hidden dark:block" />
    </ThemeProvider>
  );

  return (
    <ClerkProvider>
      {streamApiKey ? (
        <StreamVideoProvider>{app}</StreamVideoProvider>
      ) : (
        app
      )}
    </ClerkProvider>
  );
}
