// @vitest-environment jsdom

// Contract tests for the shadcn toast singleton in src/lib/hooks/use-toast.ts.
//
// - `reducer` is pure: covered with direct calls. Fake timers are active so the
//   removal timeout that DISMISS_TOAST schedules (via addToRemoveQueue) never
//   leaks a pending 1 000 000 ms handle into the test process.
// - `toast()`/`useToast()` share module-level singleton state (memoryState,
//   genId counter, listeners), so every flow test re-imports the module with
//   vi.resetModules() + dynamic import and observes state through a probe
//   component mounted via React 19's act().

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { reducer } from "@/lib/hooks/use-toast";

// Derived from the reducer's own signature so the tests never depend on the
// module's type exports, only on its public function surface.
type ReducerState = Parameters<typeof reducer>[0];
type ToasterToast = ReducerState["toasts"][number];
type ReducerAction = Parameters<typeof reducer>[1];

type UseToastModule = typeof import("@/lib/hooks/use-toast");
type UseToastReturn = ReturnType<UseToastModule["useToast"]>;
type ToastHandle = ReturnType<UseToastModule["toast"]>;

// React 19 requires this flag for act() to treat the runner as a test
// environment; without it react-dom logs an act() configuration warning.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Pinned constant in src/lib/hooks/use-toast.ts (intentionally not exported).
const TOAST_REMOVE_DELAY_MS = 1_000_000;

function makeToast(id: string, overrides: Partial<ToasterToast> = {}): ToasterToast {
  return { open: true, title: `Toast ${id}`, ...overrides, id };
}

// ---------------------------------------------------------------------------
// reducer (pure function, exercised directly)
// ---------------------------------------------------------------------------

describe("reducer", () => {
  beforeEach(() => {
    // DISMISS_TOAST schedules a real removal timeout as a side effect; fake
    // timers keep those pending handles out of the test process.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("ADD_TOAST inserts the newest toast first and truncates to TOAST_LIMIT (1)", () => {
    const prev: ReducerState = { toasts: [makeToast("t1")] };
    const next = reducer(prev, { type: "ADD_TOAST", toast: makeToast("t2") });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0]?.id).toBe("t2");
    expect(next).not.toBe(prev); // new state object, no in-place mutation
    expect(prev.toasts[0]?.id).toBe("t1"); // previous state untouched
  });

  it("UPDATE_TOAST merges partial fields into the toast with a matching id", () => {
    const t1 = makeToast("t1", { title: "Old", description: "Keep me" });
    const t2 = makeToast("t2");
    const next = reducer(
      { toasts: [t1, t2] },
      { type: "UPDATE_TOAST", toast: { id: "t1", title: "New" } }
    );
    expect(next.toasts[0]?.title).toBe("New");
    expect(next.toasts[0]?.description).toBe("Keep me"); // partial merge preserves siblings
    expect(next.toasts[0]?.open).toBe(true);
  });

  it("UPDATE_TOAST leaves toasts with other ids untouched", () => {
    const t1 = makeToast("t1");
    const t2 = makeToast("t2");
    const next = reducer(
      { toasts: [t1, t2] },
      { type: "UPDATE_TOAST", toast: { id: "t1", title: "New" } }
    );
    expect(next.toasts[1]).toBe(t2);
  });

  it("DISMISS_TOAST with a toastId marks only that toast open: false", () => {
    const t1 = makeToast("t1");
    const t2 = makeToast("t2");
    const next = reducer({ toasts: [t1, t2] }, { type: "DISMISS_TOAST", toastId: "t1" });
    expect(next.toasts[0]?.open).toBe(false);
    expect(next.toasts[1]?.open).toBe(true);
  });

  it("DISMISS_TOAST without a toastId marks every toast open: false", () => {
    const t1 = makeToast("t1");
    const t2 = makeToast("t2");
    const next = reducer({ toasts: [t1, t2] }, { type: "DISMISS_TOAST" });
    expect(next.toasts[0]?.open).toBe(false);
    expect(next.toasts[1]?.open).toBe(false);
  });

  it("REMOVE_TOAST with a toastId filters only that toast out", () => {
    const t1 = makeToast("t1");
    const t2 = makeToast("t2");
    const next = reducer({ toasts: [t1, t2] }, { type: "REMOVE_TOAST", toastId: "t1" });
    expect(next.toasts.map((t) => t.id)).toEqual(["t2"]);
  });

  it("REMOVE_TOAST without a toastId empties the list", () => {
    const next = reducer(
      { toasts: [makeToast("t1"), makeToast("t2")] },
      { type: "REMOVE_TOAST" }
    );
    expect(next.toasts).toEqual([]);
  });

  it("returns the SAME state reference for an unknown action type (total reducer)", () => {
    const state: ReducerState = { toasts: [makeToast("t1")] };
    // SAFETY: the Action union is closed and no valid action can carry the type
    // "SOME_UNKNOWN_ACTION". This deliberately unsafe cast simulates a caller
    // that bypasses the type system (plain JavaScript or an unchecked cast) to
    // prove the reducer is total: it must return the same state reference,
    // never undefined.
    const bogus = { type: "SOME_UNKNOWN_ACTION" } as unknown as ReducerAction;
    const next = reducer(state, bogus);
    expect(next).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// toast() singleton flows (fresh module instance per test)
// ---------------------------------------------------------------------------

describe("toast() singleton flows", () => {
  let mod: UseToastModule;
  let latest: UseToastReturn | undefined;
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  beforeEach(() => {
    vi.resetModules(); // fresh singleton: memoryState, genId counter, listeners
    vi.useFakeTimers();
    latest = undefined;
    container = undefined;
    root = undefined;
  });

  afterEach(() => {
    const mountedRoot = root;
    if (mountedRoot) {
      act(() => {
        mountedRoot.unmount();
      });
    }
    root = undefined;
    if (container) {
      container.remove();
      container = undefined;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // Mounts a probe component that mirrors the hook's state into `latest` on
  // every render, so dispatches from the singleton API are observable.
  const mountProbe = async (): Promise<void> => {
    mod = await import("@/lib/hooks/use-toast");
    const Probe = (): null => {
      latest = mod.useToast();
      return null;
    };
    const el = document.createElement("div");
    document.body.appendChild(el);
    container = el;
    const holder: { root?: Root } = {};
    act(() => {
      holder.root = createRoot(el);
      holder.root.render(React.createElement(Probe));
    });
    if (!holder.root) {
      throw new Error(
        "mountProbe: expected createRoot().render() to run inside act(), but no root was created"
      );
    }
    root = holder.root;
  };

  it("toast() dispatches ADD_TOAST with a fresh unique id and open: true", async () => {
    await mountProbe();
    let first: ToastHandle | undefined;
    act(() => {
      first = mod.toast({ title: "First" });
    });
    if (!first) {
      throw new Error("toast() returned no handle; expected { id, dismiss, update }");
    }
    expect(typeof first.dismiss).toBe("function");
    expect(typeof first.update).toBe("function");
    expect(latest?.toasts[0]?.id).toBe(first.id);
    expect(latest?.toasts[0]?.open).toBe(true);
    expect(latest?.toasts[0]?.title).toBe("First");

    let second: ToastHandle | undefined;
    act(() => {
      second = mod.toast({ title: "Second" });
    });
    if (!second) {
      throw new Error("second toast() call returned no handle; expected { id, dismiss, update }");
    }
    expect(second.id).not.toBe(first.id); // fresh unique id per call
    expect(latest?.toasts[0]?.id).toBe(second.id); // newest first under TOAST_LIMIT 1
  });

  it("toast() wires onOpenChange so onOpenChange(false) dismisses", async () => {
    await mountProbe();
    act(() => {
      mod.toast({ title: "Hi" });
    });
    const onOpenChange = latest?.toasts[0]?.onOpenChange;
    if (!onOpenChange) {
      throw new Error(
        `expected toast ${String(latest?.toasts[0]?.id)} to have onOpenChange wired, but it was missing`
      );
    }
    act(() => {
      onOpenChange(false);
    });
    expect(latest?.toasts[0]?.open).toBe(false);
  });

  it("update() merges a full ToasterToast into the toast created by that toast() call", async () => {
    await mountProbe();
    let handle: ToastHandle | undefined;
    act(() => {
      handle = mod.toast({ title: "Before" });
    });
    if (!handle) {
      throw new Error("toast() returned no handle; expected { id, dismiss, update }");
    }
    const created = handle; // narrowed const so it is usable inside act() closures
    act(() => {
      created.update({ id: "ignored-by-update", open: false, title: "After", description: "Updated" });
    });
    expect(latest?.toasts[0]?.id).toBe(created.id); // merges into THIS toast; id stays pinned
    expect(latest?.toasts[0]?.title).toBe("After");
    expect(latest?.toasts[0]?.description).toBe("Updated");
    expect(latest?.toasts[0]?.open).toBe(false);
  });

  it("dismiss() dispatches DISMISS_TOAST for the id and removes the toast after TOAST_REMOVE_DELAY", async () => {
    await mountProbe();
    let handle: ToastHandle | undefined;
    act(() => {
      handle = mod.toast({ title: "Bye" });
    });
    if (!handle) {
      throw new Error("toast() returned no handle; expected { id, dismiss, update }");
    }
    const created = handle; // narrowed const so it is usable inside act() closures
    act(() => {
      created.dismiss();
    });
    expect(latest?.toasts[0]?.id).toBe(created.id);
    expect(latest?.toasts[0]?.open).toBe(false);
    act(() => {
      vi.advanceTimersByTime(TOAST_REMOVE_DELAY_MS);
    });
    expect(latest?.toasts).toEqual([]); // removal timer fired
  });
});
