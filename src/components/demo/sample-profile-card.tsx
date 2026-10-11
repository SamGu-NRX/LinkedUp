"use client";

// src/components/demo/sample-profile-card.tsx
//
// Demo-local profile card for a sample persona. The shared UserCard
// (src/components/app/user-card) was considered first; its Message and
// Schedule actions would appear interactive in sample mode with nothing real
// behind them, which would imply a real person is reachable. Rather than
// rewrite that shared component (outside this task's boundary), the demo
// ships this read-only equivalent and proposes a shared `sampleMode` variant
// in docs/demo-fixture/INTEGRATION-PROPOSAL.md.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { generateAvatarColor } from "@/lib/avatar-utils";
import type { SamplePersona } from "@/lib/demo/sample-identity";
import { sharedInterestNames } from "@/lib/demo/demo-views";
import type { SampleProfile } from "@/lib/demo/sample-identity";

interface SampleProfileCardProps {
  persona: SamplePersona;
  /** The visitor's chosen profile, for computing shared interests. */
  profile: SampleProfile;
  className?: string;
}

export function SampleProfileCard({
  persona,
  profile,
  className = "",
}: SampleProfileCardProps) {
  const gradient = generateAvatarColor(persona.id);
  const shared = sharedInterestNames(profile, persona);

  return (
    <Card
      data-testid="demo-sample-persona-card"
      className={`border-amber-300 bg-amber-50/60 ${className}`}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div
            aria-hidden
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient.from} ${gradient.to} text-xl font-bold ${gradient.text}`}
          >
            {persona.name
              .split(" ")
              .map((part) => part[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-900">
                {persona.name}
              </h3>
              <Badge
                aria-label="This is a sample persona, not a real person"
                className="border border-amber-400 bg-amber-200 text-amber-950"
              >
                Sample persona
              </Badge>
            </div>
            <p className="text-sm text-zinc-600">
              {persona.tagline} at {persona.company} · {persona.experience}{" "}
              years (fictional)
            </p>
            <p className="mt-2 text-sm text-zinc-700">{persona.bio}</p>
            <p className="mt-3 text-sm text-zinc-700">
              <span className="font-medium">Shared interests:</span>{" "}
              {shared.length > 0 ? shared.join(", ") : "none in this sample script"}
            </p>
            <p className="mt-3 rounded-md border border-zinc-200 bg-white/70 p-3 text-sm text-zinc-700">
              <span className="font-medium">
                What this persona would open with:
              </span>{" "}
              “{persona.conversationStarter}”
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
