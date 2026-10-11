// src/app/demo/layout.tsx
//
// Static metadata for the sample demo route. The title names the demo as
// simulated so the tab itself carries the sample-mode label before the
// client shell refines it per stage (see demo-shell.tsx).

import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedUp — Sample demo (simulated data)",
  description:
    "An offline sample walkthrough of LinkedUp's meeting flow. Every person, queue, and meeting is simulated; no account, camera, or network call is used.",
  robots: { index: false, follow: false },
  // Override the root layout's remote icon link with an inline data URL: the
  // demo route must contain zero outbound references, and browsers fetch the
  // page icon on navigation.
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2318181b'/%3E%3Ctext x='16' y='22' font-family='monospace' font-size='16' fill='%23fafafa' text-anchor='middle'%3ES%3C/text%3E%3C/svg%3E",
  },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
