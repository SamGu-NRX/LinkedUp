import type React from "react"
import { Inter } from "next/font/google"
import { MobileNavigation } from "@/components/MobileNavigation"
import { DesktopNavigation } from "@/components/DesktopNavigation"
import StreamVideoProvider from "@/providers/StreamClientProvider"

import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "LinkUp",
  description: "Connect with professionals through voice calls",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main>
      <Providers>
        <html lang="en">
          <body className={inter.className}>
            <header className="flex h-16 items-center justify-end gap-4 p-4">
              <SignedOut>
                <SignInButton />
                <SignUpButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </header>
            <div className="flex h-screen">
              <div className="hidden md:flex md:w-64 md:flex-col">
                <DesktopNavigation />
              </div>
              <div className="flex flex-1 flex-col">
                <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
                  {children}
                </main>
                <div className="md:hidden">
                  <MobileNavigation />
                </div>
              </div>
            </div>
          </body>
        </html>
      </Providers>
    </main>
  );
}
