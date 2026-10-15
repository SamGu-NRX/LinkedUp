import { useId } from "react";
import type { MatchIntro as MatchIntroData } from "@/lib/interest-matching/types";

export default function MatchIntro({
  intro,
  compact = false,
}: {
  intro: MatchIntroData | null;
  compact?: boolean;
}) {
  const headingId = useId();
  if (!intro) return null;

  return (
    <section
      aria-labelledby={headingId}
      data-match-intro={compact ? "compact" : "card"}
      className={
        compact
          ? "mx-4 mt-4 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left sm:mx-6"
          : "w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left sm:p-8"
      }
    >
      <h2 id={headingId} className="text-xs font-medium text-emerald-400">
        Start with a question
      </h2>
      <p
        className={`${compact ? "mt-1 text-lg sm:text-xl" : "mt-3 text-2xl sm:text-3xl"} leading-snug font-medium [overflow-wrap:anywhere] break-words text-zinc-100`}
      >
        {intro.question}
      </p>
      <p
        className={`${compact ? "mt-2" : "mt-5"} text-sm leading-relaxed [overflow-wrap:anywhere] break-words text-zinc-400`}
      >
        {intro.reason}
      </p>
      {intro.sharedInterests.length > 0 && (
        <ul
          aria-label="Shared interests"
          className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-relaxed text-zinc-300"
        >
          {intro.sharedInterests.map((interest) => (
            <li
              key={interest}
              className="min-w-0 [overflow-wrap:anywhere] break-words"
            >
              {interest}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
