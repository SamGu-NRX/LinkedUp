// @vitest-environment jsdom
import * as React from "react";

import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import useWindowSize, {
  getViewportFlags,
  type ViewportFlags,
} from "@/lib/hooks/use-window-size";

// React 19's act() requires an explicit opt-in when running outside
// react-test-renderer / @testing-library/react, which normally set this flag.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = ReturnType<typeof useWindowSize>;

describe("getViewportFlags", () => {
  const cases: Array<{
    width: number | undefined;
    expected: ViewportFlags;
  }> = [
    {
      width: undefined,
      expected: { isMobile: false, isDesktop: false },
    },
    { width: 0, expected: { isMobile: true, isDesktop: false } },
    { width: 100, expected: { isMobile: true, isDesktop: false } },
    { width: 767, expected: { isMobile: true, isDesktop: false } },
    { width: 768, expected: { isMobile: false, isDesktop: true } },
    { width: 768.5, expected: { isMobile: false, isDesktop: true } },
    { width: 1920, expected: { isMobile: false, isDesktop: true } },
  ];

  for (const { width, expected } of cases) {
    it(`classifies width ${String(width)} as isMobile=${String(
      expected.isMobile,
    )} isDesktop=${String(expected.isDesktop)}`, () => {
      expect(getViewportFlags(width)).toEqual(expected);
    });
  }

  it("never reports mobile and desktop at the same time", () => {
    for (const width of [-1, 0, 100, 767, 767.999, 768, 1920]) {
      const flags: ViewportFlags = getViewportFlags(width);
      expect(flags.isMobile && flags.isDesktop).toBe(false);
    }
  });
});

describe("useWindowSize mounted in jsdom", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let firstRender: HookResult | null = null;
  let latest: HookResult | null = null;

  function Probe(): null {
    const value: HookResult = useWindowSize();
    if (firstRender === null) {
      firstRender = value;
    }
    latest = value;
    return null;
  }

  function mountHook(): void {
    container = document.createElement("div");
    document.body.appendChild(container);
    // Local const so the render closure below sees a non-null Root
    // (TypeScript cannot narrow the module-level `root` inside a closure).
    const mountedRoot: Root = createRoot(container);
    root = mountedRoot;
    act(() => {
      mountedRoot.render(<Probe />);
    });
  }

  function currentResult(checkedAt: string): HookResult {
    if (latest === null) {
      throw new Error(
        `useWindowSize() has not rendered yet (checked at: ${checkedAt})`,
      );
    }
    return latest;
  }

  afterEach(() => {
    const cleanupRoot: Root | null = root;
    if (cleanupRoot !== null) {
      act(() => {
        cleanupRoot.unmount();
      });
      root = null;
    }
    if (container !== null) {
      container.remove();
      container = null;
    }
    firstRender = null;
    latest = null;
  });

  it("starts with both flags false, tracks resize events, and unmounts cleanly", () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    mountHook();

    // The first render runs before the mount effect measures the window:
    // both flags must be false and the size must be unmeasured.
    expect(firstRender).not.toBeNull();
    expect(firstRender?.windowSize.width).toBeUndefined();
    expect(firstRender?.windowSize.height).toBeUndefined();
    expect(firstRender?.isMobile).toBe(false);
    expect(firstRender?.isDesktop).toBe(false);

    // The mount effect measures jsdom's 1024x768 viewport immediately.
    const measured = currentResult("after mount");
    expect(measured.windowSize).toEqual({ width: 1024, height: 768 });
    expect(measured.isMobile).toBe(false);
    expect(measured.isDesktop).toBe(true);

    // Mobile resize.
    act(() => {
      window.innerWidth = 500;
      window.innerHeight = 800;
      window.dispatchEvent(new Event("resize"));
    });
    const mobile = currentResult("after 500px resize");
    expect(mobile.windowSize).toEqual({ width: 500, height: 800 });
    expect(mobile.isMobile).toBe(true);
    expect(mobile.isDesktop).toBe(false);

    // Desktop resize.
    act(() => {
      window.innerWidth = 1200;
      window.innerHeight = 900;
      window.dispatchEvent(new Event("resize"));
    });
    const desktop = currentResult("after 1200px resize");
    expect(desktop.windowSize).toEqual({ width: 1200, height: 900 });
    expect(desktop.isMobile).toBe(false);
    expect(desktop.isDesktop).toBe(true);

    // Clean unmount: no error thrown from root.unmount inside act.
    act(() => {
      root?.unmount();
    });
    root = null;
  });
});
