"use client"

import React from "react"
import { useRouter } from "next/navigation"
import ProfessionalQueue from "@/components/ProfessionalQueue"

export default function CollaborationPage() {
  const router = useRouter()

  const handleLeaveQueue = () => {
    router.push("/dashboard")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted collaboration match with ID: ${matchId}`)
    router.push(`/call/${matchId}?type=collaboration`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined collaboration match with ID: ${matchId}`)
  }

  const handleScheduleCall = (userId: string) => {
    console.log(`Scheduling collaboration call with user ID: ${userId}`)
    router.push(`/schedule/${userId}?type=collaboration`)
  }

  return (
    <ProfessionalQueue
      userId="user123"
      connectionType="collaboration"
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
      onScheduleCall={handleScheduleCall}
    />
  )
}

