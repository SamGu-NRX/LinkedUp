// src/app/app/call/[id]/page.tsx
import CallRoom from "./CallRoom";

export const dynamic = "force-dynamic";

// The call fills the screen edge to edge on phones; its controls pad
// themselves by the safe-area insets, which only apply with viewport-fit=cover.
export const viewport = { viewportFit: "cover" };

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CallRoom id={id} />;
}
