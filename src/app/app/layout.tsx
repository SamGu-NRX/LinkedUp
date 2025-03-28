// RootLayout.jsx
"use client";

import "../globals.css";
import type React from "react";
import { Inter } from "next/font/google";
import { MobileNavigation } from "@/components/app/MobileNavigation";
import { DesktopNavigation } from "@/components/app/DesktopNavigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Image from "next/image";
import { motion } from "framer-motion";

import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Providers } from "./providers";
import { Sidebar } from "@/components/app/dashboard/sidebar";
import { ModeToggle } from "@/components/app/dashboard/ModeToggle";
import Link from "next/link";
import { useTheme } from "next-themes";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <header className="bg-background/80 sticky top-0 z-50 flex h-16 items-center gap-4 border-b px-6 backdrop-blur-xs transition-colors duration-300">
              <div className="relative z-10">
                <Link
                  className="flex items-center gap-2 font-semibold transition-all duration-300 hover:opacity-80"
                  href="/app"
                >
                  <motion.div
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="relative h-9 w-9"
                  >
                    <Image
                      src="/linkeduplogos/linkedupblack.png"
                      alt="Logo"
                      width={36}
                      height={36}
                      className="rounded-lg shadow-md dark:hidden"
                    />
                    <Image
                      src="/linkeduplogos/linkedupwhite.png"
                      alt="Logo"
                      width={36}
                      height={36}
                      className="hidden rounded-lg shadow-md dark:block"
                    />
                  </motion.div>
                  <motion.h1
                    className="bg-emerald-400 bg-clip-text text-xl font-bold text-transparent dark:bg-emerald-300"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    LinkedUp
                  </motion.h1>
                </Link>
              </div>

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

            <div className="flex flex-1 overflow-hidden">
              <div className="hidden border-r transition-all duration-300 md:block md:w-64">
                <DesktopNavigation />
              </div>

              <div className="flex flex-1 flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto p-6 transition-all duration-300">
                  <div className="relative min-h-[calc(100vh-10rem)] w-full">
                    {children}
                  </div>
                </main>
                <div className="md:hidden">
                  <MobileNavigation />
                </div>
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
