"use client";

// src/components/demo/demo-stage-views.tsx
//
// One view per demo flow stage. Every view:
// - keeps the sample-mode framing visible in its copy (what is simulated,
//   what the real product would do),
// - offers its forward action, and (via the shell's persistent controls)
//   back navigation that never dead-ends,
// - uses only provider-free shared components plus demo-local ones.
//
// All interactivity flows up through the props — the views themselves stay
// free of provider calls, network calls, and media APIs.

import { useState } from "react";
import { CameraOff, Clock, MessageSquare, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DemoTopBar } from "./demo-top-bar";
import { SampleProfileCard } from "./sample-profile-card";
import { SampleTile } from "./sample-tile";
import type { DemoStage, FailureStage } from "@/lib/demo/demo-state";
import { FAILURE_COPY, SAMPLE_MATCH_AFTER_SECONDS, SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS } from "@/lib/demo/demo-state";
import { resolveSampleMediaCheck, sampleSpeakingPattern } from "@/lib/demo/sample-media";
import { toMeetingUserViews, SAMPLE_CONNECTION_STATES } from "@/lib/demo/demo-views";
import { SAMPLE_CHAT_REVEAL_EVERY_SECONDS, SAMPLE_CHAT_SCRIPT } from "@/lib/demo/sample-mode";
import {
  SAMPLE_PROFILES,
  sampleProfileById,
} from "@/lib/demo/sample-personas";
import type { SamplePersona, SampleProfile } from "@/lib/demo/sample-identity";
import { TimeManager } from "@/components/video-meeting/time-manager";

interface StageChromeProps {
  step: string;
  title: string;
  children: React.ReactNode;
}

/** Common stage scaffolding: step caption, heading, and the content card. */
function StageChrome({ step, title, children }: StageChromeProps) {
  return (
    <Card className="w-full border-zinc-200 bg-white shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
          Sample demo · {step}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900">{title}</h2>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

/** The sample chip every stage shows besides the persistent banner. */
function SampleChip({ label }: { label: string }) {
  return (
    <Badge
      aria-label={`Sample demo: ${label}`}
      className="border border-amber-300 bg-amber-100 text-amber-950"
    >
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Stage 1 — profile choice
// ---------------------------------------------------------------------------

export function ProfileChoiceView({
  onChoose,
}: {
  onChoose: (profileId: SampleProfile["id"]) => void;
}) {
  return (
    <StageChrome step="step 1 of 5" title="Choose a sample profile">
      <p className="text-sm text-zinc-600">
        In the real product, the interests you pick during onboarding shape who
        you meet. Here the choice only selects which scripted sample persona
        appears later — no account is created and nothing is saved.
      </p>
      <div className="mt-4 grid gap-3">
        {SAMPLE_PROFILES.map((profile) => (
          <Button
            key={profile.id}
            variant="outline"
            className="h-auto justify-start p-4 text-left"
            onClick={() => onChoose(profile.id)}
            aria-label={`${profile.label} — sample profile option`}
          >
            <span className="flex flex-col items-start gap-1">
              <span className="text-sm font-semibold text-zinc-900">
                {profile.label}
              </span>
              <span className="text-xs font-normal text-zinc-600">
                {profile.description}
              </span>
              <span className="flex flex-wrap gap-1 pt-1">
                {profile.interests.map((interest) => (
                  <Badge
                    key={interest.name}
                    variant="secondary"
                    className="bg-zinc-100 text-xs text-zinc-700"
                  >
                    {interest.name}
                  </Badge>
                ))}
              </span>
            </span>
          </Button>
        ))}
      </div>
      <div className="mt-4">
        <SampleChip label="all profiles are fictional" />
      </div>
    </StageChrome>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — connection explanation
// ---------------------------------------------------------------------------

export function ConnectionExplanationView({
  profileId,
  onContinue,
}: {
  profileId: SampleProfile["id"];
  onContinue: () => void;
}) {
  const profile = sampleProfileById(profileId);
  return (
    <StageChrome step="step 2 of 5" title="How connecting works — and what happens here">
      <p className="text-sm text-zinc-600">
        In the real product, LinkedUp places two signed-in visitors in a queue
        and matches them for a short, timed video conversation in a Stream
        meeting room.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        This sample demo replays that flow with a fixed script: the queue below
        is a simulated wait, the person you are matched with is a sample
        persona, and the meeting room is a simulated preview. Nothing connects
        to a real service.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Your sample profile:{" "}
        <span className="font-medium text-zinc-900">
          {profile?.label ?? "sample profile"}
        </span>
        .
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onContinue}>
          Continue to the simulated queue
        </Button>
        <SampleChip label="no real matching runs here" />
      </div>
    </StageChrome>
  );
}

// ---------------------------------------------------------------------------
// Stage 3 — simulated queue wait
// ---------------------------------------------------------------------------

export function QueueWaitingView({
  waitedSeconds,
  onSkip,
}: {
  waitedSeconds: number;
  onSkip: () => void;
}) {
  const progress = Math.min(100, (waitedSeconds / SAMPLE_QUEUE_EXPIRES_AFTER_SECONDS) * 100);
  const secondsToMatch = Math.max(0, SAMPLE_MATCH_AFTER_SECONDS - waitedSeconds);
  return (
    <StageChrome step="step 3 of 5" title="Simulated queue wait">
      <p className="text-sm text-zinc-600">
        This wait is simulated — no real matching is running and no real person
        is waiting for you. The script introduces a sample persona after about{" "}
        {SAMPLE_MATCH_AFTER_SECONDS} seconds.
      </p>
      <div
        role="status"
        aria-live="polite"
        className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
        data-testid="demo-queue-status"
      >
        <p className="text-sm text-zinc-700">
          Simulated wait so far: {waitedSeconds} second{waitedSeconds === 1 ? "" : "s"}
          {secondsToMatch > 0
            ? ` — sample match in about ${secondsToMatch}s`
            : " — preparing your sample match…"}
        </p>
        <Progress
          aria-label="Simulated queue wait progress"
          value={progress}
          className="mt-3 h-2"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={onSkip}>
          Skip the simulated wait
        </Button>
        <SampleChip label="wait is scripted, not real" />
      </div>
    </StageChrome>
  );
}

// ---------------------------------------------------------------------------
// Stage 4 — sample persona introduced
// ---------------------------------------------------------------------------

export function MatchExplainedView({
  profileId,
  persona,
  onAccept,
  onDecline,
}: {
  profileId: SampleProfile["id"];
  persona: SamplePersona;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const profile = sampleProfileById(profileId);
  return (
    <StageChrome step="step 4 of 5" title="Your sample connection">
      <p className="text-sm text-zinc-600">
        In the real product this screen would introduce the professional you
        were matched with. Here it introduces a sample persona — a fictional
        character compiled into the demo, not a person who can see or hear you.
      </p>
      <div className="mt-4">
        <SampleProfileCard persona={persona} profile={profile ?? SAMPLE_PROFILES[0]} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onAccept}>Open the simulated meeting</Button>
        <Button variant="outline" onClick={onDecline}>
          Decline and wait again
        </Button>
        <SampleChip label="sample persona — not a real person" />
      </div>
    </StageChrome>
  );
}

// ---------------------------------------------------------------------------
// Stage 5 — simulated device check / join
// ---------------------------------------------------------------------------

export function JoiningView({
  persona,
  onJoin,
}: {
  persona: SamplePersona;
  onJoin: () => void;
}) {
  const media = resolveSampleMediaCheck("ok", persona);
  if (media.outcome !== "ok") {
    // The "ok" script is passed explicitly, so this branch is unreachable;
    // rendered defensively so the view stays total.
    return null;
  }
  return (
    <StageChrome step="step 5 of 5" title="Simulated device check">
      <p className="text-sm text-zinc-600">
        Before a real meeting, LinkedUp asks for camera and microphone
        permission. This demo never touches your devices — the tiles below are
        generated visuals standing in for a camera feed.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SampleTile frame={media.visitorFrame} connectionStatus="good" />
        <SampleTile frame={media.partnerFrame} connectionStatus="good" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onJoin}>Enter the simulated meeting</Button>
        <SampleChip label="no camera or microphone is accessed" />
      </div>
    </StageChrome>
  );
}

// ---------------------------------------------------------------------------
// Stage 6 — simulated meeting
// ---------------------------------------------------------------------------

export function InCallView({
  stage,
  onLeave,
  onTimeRequestSent,
  onTimeRequestResolved,
}: {
  stage: Extract<DemoStage, { kind: "in-call" }>;
  onLeave: () => void;
  onTimeRequestSent: () => void;
  onTimeRequestResolved: () => void;
}) {
  const [showTimeLeft, setShowTimeLeft] = useState(true);
  const [visitorDraft, setVisitorDraft] = useState("");
  const [visitorMessages, setVisitorMessages] = useState<string[]>([]);

  const media = resolveSampleMediaCheck("ok", stage.persona);
  if (media.outcome !== "ok") return null;
  const meetingUsers = toMeetingUserViews(stage.persona);
  const remaining = TimeManager.calculateRemaining(
    stage.elapsedSeconds,
    stage.allowanceSeconds,
  );
  const speaking = sampleSpeakingPattern(stage.elapsedSeconds);
  const revealedCount = Math.min(
    SAMPLE_CHAT_SCRIPT.length,
    Math.floor(stage.elapsedSeconds / SAMPLE_CHAT_REVEAL_EVERY_SECONDS),
  );
  const revealedScript = SAMPLE_CHAT_SCRIPT.slice(0, revealedCount);
  const canRequest = TimeManager.canRequestTime(stage.timeRequest, stage.elapsedSeconds);

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col bg-zinc-950" data-testid="demo-in-call">
      <DemoTopBar
        partner={meetingUsers.partner}
        timeElapsed={stage.elapsedSeconds}
        timeRemaining={remaining}
        showTimeLeft={showTimeLeft}
        isAlmostOutOfTime={remaining <= 60}
        onToggleTimeDisplay={() => setShowTimeLeft((value) => !value)}
      />
      {/* overflow-y-auto: on short/phone viewports the stacked tiles exceed the
          room's fixed height; scrolling keeps tiles above siblings so their
          positioned overlays can never cover the controls. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <SampleTile
              frame={media.partnerFrame}
              connectionStatus={SAMPLE_CONNECTION_STATES.partner.status}
              isSpeaking={speaking.partner}
              className="min-h-40"
            />
            <SampleTile
              frame={media.visitorFrame}
              connectionStatus={SAMPLE_CONNECTION_STATES.you.status}
              isSpeaking={speaking.you}
              className="min-h-40"
            />
          </div>
          <p className="text-xs text-zinc-400">
            Simulated meeting preview — the sample persona’s tile is a scripted
            visual, the clock runs on the product’s own TimeManager, and no
            media or network connection exists.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={onLeave}>
              Leave the simulated meeting
            </Button>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-sm font-medium text-zinc-200">Meeting time (sample)</p>
            <p className="mt-1 text-xs text-zinc-400">
              The room starts with {TimeManager.formatTime(stage.allowanceSeconds)} on
              the clock. In the real product, a participant can ask their peer
              for more time; here the peer’s response is simulated.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stage.timeRequest.pendingRequestId !== null ? (
                <>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-200">
                    <Clock aria-hidden className="mr-1 h-3 w-3" />
                    Sample time request pending
                  </Badge>
                  <Button size="sm" variant="outline" onClick={onTimeRequestResolved}>
                    Simulate the peer accepting
                  </Button>
                </>
              ) : canRequest ? (
                <Button size="sm" variant="outline" onClick={onTimeRequestSent}>
                  <MessageSquare aria-hidden className="mr-1 h-3 w-3" />
                  Request more time (simulated peer)
                </Button>
              ) : (
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-200">
                  <Users aria-hidden className="mr-1 h-3 w-3" />
                  Time requests cool down for a scripted interval
                </Badge>
              )}
            </div>
          </div>
        </div>
        <aside
          aria-label="Sample chat panel (scripted)"
          className="flex w-full flex-col rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 lg:w-80"
        >
          <p className="text-sm font-medium text-zinc-200">Sample chat</p>
          <p className="mt-1 text-xs text-zinc-400">
            Scripted lines from the sample persona; typing below sends nothing
            anywhere.
          </p>
          <div
            role="log"
            aria-live="polite"
            data-testid="demo-chat-log"
            className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto"
          >
            <ChatBubble
              author={`${stage.persona.name} (sample persona)`}
              text={stage.persona.conversationStarter}
              align="left"
            />
            {revealedScript.map((line) => (
              <ChatBubble
                key={line}
                author={`${stage.persona.name} (sample persona)`}
                text={line}
                align="left"
              />
            ))}
            {visitorMessages.map((message) => (
              <ChatBubble key={message} author="Visitor (you, local only)" text={message} align="right" />
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = visitorDraft.trim();
              if (!text) return;
              setVisitorMessages((messages) => [...messages, text]);
              setVisitorDraft("");
            }}
          >
            <label className="sr-only" htmlFor="demo-chat-input">
              Type to try the chat — nothing is sent anywhere
            </label>
            <input
              id="demo-chat-input"
              data-testid="demo-chat-input"
              value={visitorDraft}
              onChange={(event) => setVisitorDraft(event.target.value)}
              placeholder="Type to try the chat (nothing is sent)"
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <Button type="submit" variant="secondary" size="sm">
              Add locally
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function ChatBubble({
  author,
  text,
  align,
}: {
  author: string;
  text: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 text-xs ${
        align === "left"
          ? "bg-zinc-800 text-zinc-100"
          : "bg-blue-900/60 text-zinc-100"
      }`}
    >
      <span className="sr-only">
        {author}, scripted sample line:
      </span>
      <p>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 7 — call ended (visitor left)
// ---------------------------------------------------------------------------

export function CallEndedView({
  persona,
  elapsedSeconds,
  onRestart,
}: {
  persona: SamplePersona;
  elapsedSeconds: number;
  onRestart: () => void;
}) {
  return (
    <StageChrome step="done — sample recap" title="You left the simulated meeting">
      <p className="text-sm text-zinc-600">
        The simulated meeting with the sample persona {persona.name} ended after{" "}
        {TimeManager.formatTime(elapsedSeconds)} on the scripted clock. Nothing
        was recorded, sent, or connected at any point.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        In the real product, leaving a meeting returns you to the queue and
        your meeting history updates — features that need a real account.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onRestart}>Start the sample flow again</Button>
        <SampleChip label="nothing was real" />
      </div>
    </StageChrome>
  );
}

// ---------------------------------------------------------------------------
// Stage 8 — rehearsed failure paths
// ---------------------------------------------------------------------------

export function FailureView({
  stage,
  onRecover,
}: {
  stage: FailureStage;
  onRecover: () => void;
}) {
  const copy = FAILURE_COPY[stage.failure];
  return (
    <StageChrome step="rehearsed failure path" title={copy.title}>
      <p className="text-sm text-zinc-700">{copy.body}</p>
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
        <p className="flex items-start gap-2 text-sm text-amber-950">
          <CameraOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This screen exists so the recovery experience can be inspected
            without causing any of it for real. Real device, permission, queue,
            and meeting failures happen only in the signed-in product.
          </span>
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={onRecover}>{copy.recovery}</Button>
        <SampleChip label="rehearsed path — nothing is broken" />
      </div>
    </StageChrome>
  );
}
