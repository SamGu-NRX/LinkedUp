// src/app/demo/page.tsx
//
// The sample-product (fixture demo) route. A visitor can inspect the whole
// meeting flow here without Clerk, Stream, or a database. This server
// component intentionally imports nothing but the demo shell — no auth
// provider, no data client, no action — so the route is provider-free by
// construction and its client bundle carries only demo code.

import { DemoShell } from "@/components/demo/demo-shell";

export default function DemoPage() {
  return <DemoShell />;
}
