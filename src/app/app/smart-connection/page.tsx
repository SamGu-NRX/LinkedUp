// src/app/app/smart-connection/page.tsx
import SmartConnectionEngine from "@/components/queue/SmartConnectionEngine";

export const dynamic = "force-dynamic";

export default async function SmartConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const queueType: "professional" | "casual" = type === "professional" ? "professional" : "casual";

  return <SmartConnectionEngine queueType={queueType} />;
}
