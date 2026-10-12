// src/app/app/call/[id]/page.tsx
import CallRoom from "./CallRoom";

export const dynamic = "force-dynamic";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CallRoom id={id} />;
}
