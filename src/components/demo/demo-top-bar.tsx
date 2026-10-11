"use client";

// src/components/demo/demo-top-bar.tsx
//
// Demo-local equivalent of the shared production TopBar
// (src/components/video-meeting/top-bar.tsx). The production bar's two
// icon-only controls (sidebar, settings) ship without accessible names and
// its props expose no way to label them; in the sample demo those controls
// would also be dead (no sidebar or settings exist here). This equivalent
// keeps the visual language and the shared, unmodified TimeDisplay
// (import-only) while dropping the dead controls and labelling everything
// it renders. The production accessibility rewrite is proposed in
// docs/demo-fixture/INTEGRATION-PROPOSAL.md.

import { TimeDisplay } from "@/components/video-meeting/time-display";
import type { User } from "@/types/meeting";

interface DemoTopBarProps {
  partner: User;
  timeElapsed: number;
  timeRemaining: number;
  showTimeLeft: boolean;
  isAlmostOutOfTime: boolean;
  onToggleTimeDisplay: () => void;
}

export function DemoTopBar({
  partner,
  timeElapsed,
  timeRemaining,
  showTimeLeft,
  isAlmostOutOfTime,
  onToggleTimeDisplay,
}: DemoTopBarProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-6 backdrop-blur-lg">
      <div className="flex items-center space-x-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Sample meeting with {partner.name}
          </h3>
          <p className="text-xs text-zinc-400">
            Simulated preview — sample persona, not a real person
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <TimeDisplay
          showTimeLeft={showTimeLeft}
          timeElapsed={timeElapsed}
          timeRemaining={timeRemaining}
          isAlmostOutOfTime={isAlmostOutOfTime}
          onToggleTimeDisplay={onToggleTimeDisplay}
        />
      </div>
    </div>
  );
}
