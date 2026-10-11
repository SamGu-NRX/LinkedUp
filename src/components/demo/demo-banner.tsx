"use client";

// src/components/demo/demo-banner.tsx
//
// The persistent sample-mode banner. Rendered above every demo stage — it is
// the first thing on the page and is never dismissed, so no screen of the
// demo can be mistaken for the product.

import { FlaskConical } from "lucide-react";
import { SAMPLE_MODE_BADGE, SAMPLE_MODE_BANNER } from "@/lib/demo/sample-mode";

export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label={SAMPLE_MODE_BADGE}
      data-testid="demo-sample-banner"
      className="flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 motion-reduce:transition-none"
    >
      <FlaskConical aria-hidden className="h-4 w-4 shrink-0" />
      <p>
        <strong className="font-semibold">{SAMPLE_MODE_BADGE}:</strong>{" "}
        {SAMPLE_MODE_BANNER}
      </p>
    </div>
  );
}
