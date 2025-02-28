import "./globals.css"
import { cal, inter } from "@/styles/fonts"
import { Analytics } from "@vercel/analytics/react"
import { Providers } from "./providers"
import type { Metadata } from "next"
import { cn } from "@/lib/shadcn"

const title = "LinkUp – Professional Networking Without the BS"
const description =
  "LinkUp is a professional networking platform that focuses on authentic connections and meaningful conversations."
const image = "https://linkup.com/thumbnail.png" // Replace with your actual image URL

export const metadata: Metadata = {
  title,
  description,
  icons: ["https://linkup.com/favicon.ico"], // Replace with your actual favicon URL
  openGraph: {
    title,
    description,
    images: [image],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
    creator: "@linkup",
  },
  metadataBase: new URL("https://linkup.com"), // Replace with your actual URL
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn(cal.variable, inter.variable)}>
        <Providers>
          {children}
          {/* TODO: make<Analytics /> */}
        </Providers>
      </body>
    </html>
  )
}

