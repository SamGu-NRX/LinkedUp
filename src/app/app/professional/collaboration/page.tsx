"use client"

import React, { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ProfessionalQueue from "@/components/queue/ProfessionalQueue"

function CollaborationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const purpose = searchParams.get("purpose") || ""
  const description = searchParams.get("description") || ""

  const handleLeaveQueue = () => {
    router.push("/app")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted collaboration match with ID: ${matchId}`)
    router.push(`/videocall/${matchId}?type=collaboration`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined collaboration match with ID: ${matchId}`)
  }

  const handleScheduleCall = (userId: string) => {
    console.log(`Scheduling collaboration call with user ID: ${userId}`)
    router.push(`/app/schedule/${userId}?type=collaboration`)
  }

  return (
    <ProfessionalQueue
      userId="user123"
      connectionType="collaboration"
      purpose={purpose}
      description={description}
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
      onScheduleCall={handleScheduleCall}
    />
  )
}

export default function CollaborationPage() {
  return (
    <Suspense fallback={null}>
      <CollaborationPageContent />
    </Suspense>
  )
}

