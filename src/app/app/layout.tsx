import "../globals.css"
import type React from "react";
import { Inter } from "next/font/google";
import { MobileNavigation } from "@/components/app/MobileNavigation";
import { DesktopNavigation } from "@/components/app/DesktopNavigation";
import StreamVideoProvider from "@/providers/StreamClientProvider";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Providers } from "./providers";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ModeToggle } from "@/components/dashboard/ModeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "LinkUp",
  description: "Connect with professionals through voice calls",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <Providers>
        <html lang="en" suppressHydrationWarning>
          <body className={inter.className}>
            <header className="flex h-14 items-center gap-4 border-b bg-gray-100/40 px-6 lg:h-[60px] dark:bg-gray-800/40">
              <h1 className="text-lg font-semibold text-gray-900">
                LinkedUp Dashboard
              </h1>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                  <nav className="flex flex-col gap-4">
                    <Sidebar />
                  </nav>
                </SheetContent>
              </Sheet>
              <div className="flex-1" />
              <ModeToggle />
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
