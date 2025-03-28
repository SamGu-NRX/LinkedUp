import "./globals.css";
import { cal, inter } from "@/styles/fonts";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import type { Metadata } from "next";
import { cn } from "@/lib/shadcn";

const title = "LinkedUp – Professional Networking Without the BS";
const description =
  "LinkedUp is a professional networking platform that focuses on authentic connections and meaningful conversations.";
const image = "https://LinkedUp.com/thumbnail.png"; // Replace with your actual image URL

export const metadata: Metadata = {
  title,
  description,
  icons: ["https://LinkedUp.com/favicon.ico"], // Replace with your actual favicon URL
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
    creator: "@LinkedUp",
  },
  metadataBase: new URL("https://LinkedUp.com"), // Replace with your actual URL
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(cal.variable, inter.variable)}>
        <Providers>
          {children}
          {/* TODO: make<Analytics /> */}
        </Providers>
      </body>
    </html>
  );
}
