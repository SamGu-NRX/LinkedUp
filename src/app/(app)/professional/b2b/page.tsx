"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ProfessionalQueue from "@/app/components/ProfessionalQueue"

export default function B2BNetworkingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const purpose = searchParams.get("purpose") || ""
  const description = searchParams.get("description") || ""

  const handleLeaveQueue = () => {
    router.push("/dashboard")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted B2B match with ID: ${matchId}`)
    router.push(`/call/${matchId}?type=b2b`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined B2B match with ID: ${matchId}`)
  }

  const handleScheduleCall = (userId: string) => {
    console.log(`Scheduling B2B call with user ID: ${userId}`)
    router.push(`/schedule/${userId}?type=b2b`)
  }

  return (
    <ProfessionalQueue
      userId="user123"
      connectionType="b2b"
      purpose={purpose}
      description={description}
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
      onScheduleCall={handleScheduleCall}
    />
  )
}

