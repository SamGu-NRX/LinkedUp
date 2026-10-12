// src/app/app/professional/investment/page.tsx
//
// The real professional queue. This page used to render ProfessionalQueue,
// which ran a 20-second timer and then offered a made-up match ("Jane Doe",
// room "match123") that no server knew about. Matching does not yet tell
// b2b, collaboration, investment and mentorship apart, so every professional
// purpose joins the one professional queue.
import SmartConnectionEngine from "@/components/queue/SmartConnectionEngine";

export const dynamic = "force-dynamic";

export default function ProfessionalQueuePage() {
  return <SmartConnectionEngine queueType="professional" />;
}
