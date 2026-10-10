"use client";

// src/components/demo/sample-tile.tsx
//
// The demo's video tile. It renders the inert generated visual from the
// sample media adapter — a deterministic gradient with initials and an
// explicit label — and never a camera feed, a remote stream, or an <img>.
// The speaking ring mirrors the production room's affordance, driven by the
// scripted speaking pattern instead of real audio levels.

import { generateAvatarColor } from "@/lib/avatar-utils";
import { ConnectionBadge } from "@/components/video-meeting/connection-badge";
import type { SampleVideoFrame } from "@/lib/demo/sample-media";
import type { ConnectionStatus } from "@/types/meeting";

interface SampleTileProps {
  frame: SampleVideoFrame;
  connectionStatus: ConnectionStatus;
  isSpeaking?: boolean;
  className?: string;
}

export function SampleTile({
  frame,
  connectionStatus,
  isSpeaking = false,
  className = "",
}: SampleTileProps) {
  const gradient = generateAvatarColor(frame.gradientSeed);

  return (
    <div
      data-testid="demo-sample-tile"
      className={`relative overflow-hidden rounded-xl bg-zinc-900 shadow-lg ${className}`}
    >
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-br ${gradient.from} ${gradient.to} opacity-70 motion-reduce:transition-none`}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <span
          aria-hidden
          className={`text-4xl font-bold ${gradient.text} motion-reduce:transition-none`}
        >
          {frame.initials}
        </span>
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-100">
          {frame.label}
        </span>
      </div>
      <div
        className={`absolute inset-0 rounded-xl transition-shadow duration-300 motion-reduce:transition-none ${
          isSpeaking ? "ring-2 ring-green-500" : "ring-0 ring-transparent"
        }`}
      />
      <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-xs">
        <ConnectionBadge
          status={connectionStatus}
          latency={0}
          name={frame.label}
        />
      </div>
    </div>
  );
}
