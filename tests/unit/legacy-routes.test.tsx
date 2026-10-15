import { expect, it } from "vitest";
import VideoCall from "@/app/videocall/[id]/page";
import MatchQueue from "@/app/app/match-queue/page";
it.each([VideoCall, MatchQueue])(
  "redirects retired simulated routes to persisted matching",
  (page) => {
    expect(page).toThrow(
      expect.objectContaining({
        digest: expect.stringContaining("/app/smart-connection"),
      }),
    );
  },
);
