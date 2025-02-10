import type React from "react"
import { Inter } from "next/font/google"
import { MobileNavigation } from "@/components/MobileNavigation"
import { DesktopNavigation } from "@/components/DesktopNavigation"

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
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen">
          <div className="hidden md:flex md:w-64 md:flex-col">
            <DesktopNavigation />
          </div>
          <div className="flex flex-1 flex-col">
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
            <div className="md:hidden">
              <MobileNavigation />
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}



import './globals.css'
