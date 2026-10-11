"use client";

// src/components/demo/demo-shell.tsx
//
// The demo's client shell. It owns the flow reducer, the two scripted
// tickers (queue wait and call clock), the per-stage document title, and the
// persistent controls — the sample banner, Back, exit, and the failure-path
// rehearsal panel — that make sure no demo screen can be mistaken for the
// product or dead-end.
//
// The tickers use chained timeouts keyed on the stage's own seconds counter
// rather than interval+wall-clock arithmetic, so re-entries (skip, decline,
// rejoin, back) always resume from the state's own progress.

import { useEffect, useReducer, type ReactNode } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import FadeInFromTop from "@/utils/motion/FadeInFromTop";
import {
  initialDemoFlowState,
  reduceDemoFlow,
} from "@/lib/demo/demo-state";
import {
  sampleStageAnnouncement,
  sampleStageTitle,
} from "@/lib/demo/sample-mode";
import { DemoBanner } from "./demo-banner";
import { RehearseControls } from "./rehearse-controls";
import {
  CallEndedView,
  ConnectionExplanationView,
  FailureView,
  InCallView,
  JoiningView,
  MatchExplainedView,
  ProfileChoiceView,
  QueueWaitingView,
} from "./demo-stage-views";

/** Stage-change transition that respects the visitor's reduced-motion preference. */
function DemoFadeIn({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  if (reduced) return <div>{children}</div>;
  return <FadeInFromTop>{children}</FadeInFromTop>;
}

export function DemoShell() {
  const [state, dispatch] = useReducer(
    reduceDemoFlow,
    undefined,
    initialDemoFlowState,
  );
  const { stage } = state;
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Persistent sample-mode tab title, refined per stage.
  useEffect(() => {
    document.title = sampleStageTitle(stage);
  }, [stage]);

  // Narrowed stage fields for the timer effects: the dependency arrays are
  // evaluated in component scope, where the stage union is not narrowed, so
  // the guards use explicit null-able locals instead.
  const queueWaited =
    stage.kind === "queue-waiting" ? stage.waitedSeconds : null;
  const callElapsed = stage.kind === "in-call" ? stage.elapsedSeconds : null;

  // Simulated queue wait: one tick of scripted progress per second.
  useEffect(() => {
    if (queueWaited === null) return;
    const timer = setTimeout(
      () =>
        dispatch({
          type: "queue-wait-advanced",
          elapsedSeconds: queueWaited + 1,
        }),
      1000,
    );
    return () => clearTimeout(timer);
  }, [queueWaited]);

  // Simulated meeting clock: advances through TimeManager's public API via
  // the reducer; one scripted tick per second.
  useEffect(() => {
    if (callElapsed === null) return;
    const timer = setTimeout(() => dispatch({ type: "call-tick" }), 1000);
    return () => clearTimeout(timer);
  }, [callElapsed]);

  const canGoBack = state.backStack.length > 0 || stage.kind !== "profile-choice";

  const backButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => dispatch({ type: "back" })}
      disabled={!canGoBack}
      aria-label="Go back one step in the sample demo"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Back
    </Button>
  );

  const rehearse = (kind: Parameters<Parameters<typeof RehearseControls>[0]["onRehearse"]>[0]) =>
    dispatch({ type: "rehearse-failure", kind });

  const exitLink = (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
      aria-label="Leave the sample demo and return to the LinkedUp home page"
    >
      <LogOut aria-hidden className="h-4 w-4" />
      Exit the sample demo
    </Link>
  );

  // The simulated meeting renders full-bleed dark, like the production room.
  if (stage.kind === "in-call") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header>
          <DemoBanner />
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            {backButton}
            {exitLink}
            <RehearseControls onRehearse={rehearse} />
          </div>
        </header>
        <p role="status" aria-live="polite" className="sr-only" data-testid="demo-live-region">
          {sampleStageAnnouncement(stage)}
        </p>
        <main>
          <InCallView
            stage={stage}
            onLeave={() => dispatch({ type: "call-left" })}
            onTimeRequestSent={() => dispatch({ type: "call-time-request-sent" })}
            onTimeRequestResolved={() =>
              dispatch({ type: "call-time-request-resolved" })
            }
          />
        </main>
      </div>
    );
  }

  const stageView = (() => {
    switch (stage.kind) {
      case "profile-choice":
        return (
          <ProfileChoiceView
            onChoose={(profileId) =>
              dispatch({ type: "profile-chosen", profileId })
            }
          />
        );
      case "connection-explanation":
        return (
          <ConnectionExplanationView
            profileId={stage.profileId}
            onContinue={() => dispatch({ type: "explanation-acknowledged" })}
          />
        );
      case "queue-waiting":
        return (
          <QueueWaitingView
            waitedSeconds={stage.waitedSeconds}
            onSkip={() => dispatch({ type: "queue-wait-skipped" })}
          />
        );
      case "match-explained":
        return (
          <MatchExplainedView
            profileId={stage.profileId}
            persona={stage.persona}
            onAccept={() => dispatch({ type: "match-accepted" })}
            onDecline={() => dispatch({ type: "match-declined" })}
          />
        );
      case "joining":
        return (
          <JoiningView
            persona={stage.persona}
            onJoin={() => dispatch({ type: "join-check-passed" })}
          />
        );
      case "call-ended":
        return (
          <CallEndedView
            persona={stage.persona}
            elapsedSeconds={stage.elapsedSeconds}
            onRestart={() => dispatch({ type: "restart" })}
          />
        );
      case "failure":
        return (
          <FailureView
            stage={stage}
            onRecover={() => dispatch({ type: "recover" })}
          />
        );
    }
  })();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header>
        <DemoBanner />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">LinkedUp sample demo</h1>
            <p className="text-sm text-zinc-600">
              A fixture walkthrough of the meeting flow — no sign-up, no
              devices, no network.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {backButton}
            {exitLink}
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only" data-testid="demo-live-region">
          {sampleStageAnnouncement(stage)}
        </p>

        <div className="mt-6" data-testid="demo-stage-root">
          <DemoFadeIn
            key={stage.kind}
            reduced={prefersReducedMotion}
          >
            {stageView}
          </DemoFadeIn>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <RehearseControls onRehearse={rehearse} />
          <p className="text-xs text-zinc-500">
            This sample demo is part of the LinkedUp repository as a fixture
            for reviewing the product flow without accounts or services. Every
            person, queue, and meeting here is scripted sample data.
          </p>
        </div>
      </main>
    </div>
  );
}
