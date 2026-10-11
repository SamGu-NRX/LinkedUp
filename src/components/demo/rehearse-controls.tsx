"use client";

// src/components/demo/rehearse-controls.tsx
//
// The demo's honesty control: a collapsed panel on every stage that jumps
// straight to any of the four rehearsed failure paths. In the real product
// these states arise from real device, permission, queue, and meeting
// conditions; here they are staged on demand so a visitor can inspect the
// recovery screens without breaking anything real.

import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SampleFailureKind } from "@/lib/demo/demo-state";

const REHEARSAL_LABELS: Record<SampleFailureKind, string> = {
  "media-unavailable": "Rehearse: media unavailable",
  "permission-refused": "Rehearse: permission refused",
  "queue-expired": "Rehearse: queue expired",
  "meeting-ended": "Rehearse: meeting ended",
};

interface RehearseControlsProps {
  onRehearse: (kind: SampleFailureKind) => void;
}

export function RehearseControls({ onRehearse }: RehearseControlsProps) {
  return (
    <details
      data-testid="demo-rehearse-controls"
      className="rounded-lg border border-zinc-300 bg-zinc-100/80 text-zinc-800"
    >
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
        <FlaskConical aria-hidden className="mr-2 inline h-4 w-4" />
        Demo controls — rehearse a failure path (sample only)
      </summary>
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {(Object.keys(REHEARSAL_LABELS) as SampleFailureKind[]).map((kind) => (
          <Button
            key={kind}
            variant="outline"
            size="sm"
            onClick={() => onRehearse(kind)}
            aria-label={`${REHEARSAL_LABELS[kind]} (sample path, nothing real is affected)`}
          >
            {REHEARSAL_LABELS[kind]}
          </Button>
        ))}
      </div>
    </details>
  );
}
