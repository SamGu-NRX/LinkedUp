import { useEffect, useState } from "react";

/**
 * Measured window dimensions. `width`/`height` are `undefined` while the
 * component renders on the server or before the first client measurement.
 */
export interface WindowSize {
  width?: number;
  height?: number;
}

/**
 * Breakpoint-derived viewport classification. At most one of the two flags
 * is ever true; both are false while the viewport is unmeasured.
 */
export interface ViewportFlags {
  isMobile: boolean;
  isDesktop: boolean;
}

// Single source of truth for the mobile/desktop breakpoint, in px.
const MOBILE_BREAKPOINT_PX = 768;

/**
 * Pure viewport classifier used by `useWindowSize`:
 * - `width === undefined` (unmeasured) -> both flags false
 * - `width < 768` -> `isMobile` true
 * - `width >= 768` -> `isDesktop` true
 */
export function getViewportFlags(width: number | undefined): ViewportFlags {
  if (width === undefined) {
    return { isMobile: false, isDesktop: false };
  }
  return {
    isMobile: width < MOBILE_BREAKPOINT_PX,
    isDesktop: width >= MOBILE_BREAKPOINT_PX,
  };
}

/**
 * Tracks the current window size and classifies it via `getViewportFlags`.
 * SSR-safe: `window` is only read inside the mount effect.
 */
export default function useWindowSize(): {
  windowSize: WindowSize;
  isMobile: boolean;
  isDesktop: boolean;
} {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // Handler to call on window resize
    function handleResize(): void {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount

  const flags: ViewportFlags = getViewportFlags(windowSize.width);

  return {
    windowSize,
    isMobile: flags.isMobile,
    isDesktop: flags.isDesktop,
  };
}
