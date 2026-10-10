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
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
