"use client"

import React, { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ProfessionalQueue from "@/components/queue/ProfessionalQueue"

function MentorshipPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const purpose = searchParams.get("purpose") || ""
  const description = searchParams.get("description") || ""

  const handleLeaveQueue = () => {
    router.push("/app")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted mentorship match with ID: ${matchId}`)
    router.push(`/videocall/${matchId}?type=mentorship`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined mentorship match with ID: ${matchId}`)
  }

  const handleScheduleCall = (userId: string) => {
    console.log(`Scheduling mentorship call with user ID: ${userId}`)
    router.push(`/app/schedule/${userId}?type=mentorship`)
  }

  return (
    <ProfessionalQueue
      userId="user123"
      connectionType="mentorship"
      purpose={purpose}
      description={description}
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
      onScheduleCall={handleScheduleCall}
    />
  )
}

export default function MentorshipPage() {
  return (
    <Suspense fallback={null}>
      <MentorshipPageContent />
    </Suspense>
  )
}

