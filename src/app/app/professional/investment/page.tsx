"use client"

import React, { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ProfessionalQueue from "@/components/queue/ProfessionalQueue"

function InvestmentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const purpose = searchParams.get("purpose") || ""
  const description = searchParams.get("description") || ""

  const handleLeaveQueue = () => {
    router.push("/app")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted investment match with ID: ${matchId}`)
    router.push(`/videocall/${matchId}?type=investment`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined investment match with ID: ${matchId}`)
  }

  const handleScheduleCall = (userId: string) => {
    console.log(`Scheduling investment call with user ID: ${userId}`)
    router.push(`/app/schedule/${userId}?type=investment`)
  }

  return (
    <ProfessionalQueue
      userId="user123"
      connectionType="investment"
      purpose={purpose}
      description={description}
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
      onScheduleCall={handleScheduleCall}
    />
  )
}

export default function InvestmentPage() {
  return (
    <Suspense fallback={null}>
      <InvestmentPageContent />
    </Suspense>
  )
}

