"use client";

import { Toaster } from "sonner";
import { ThemeProvider } from '@/components/theme-provider';
import { ClerkProvider } from "@clerk/nextjs";
import StreamVideoProvider from "@/providers/StreamClientProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <StreamVideoProvider>
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
      </StreamVideoProvider>
    </ClerkProvider>
  );
}
