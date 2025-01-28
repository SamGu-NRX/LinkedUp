"use client"

import React from "react"
import { useRouter } from "next/navigation"
import ProfessionalQueue from "@/components/ProfessionalQueue"

export default function MentorshipPage() {
  const router = useRouter()

  const handleLeaveQueue = () => {
    router.push("/dashboard")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted mentorship match with ID: ${matchId}`)
    router.push(`/call/${matchId}?type=mentorship`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined mentorship match with ID: ${matchId}`)
  }

  const handleScheduleCall = (userId: string) => {
    console.log(`Scheduling mentorship call with user ID: ${userId}`)
    router.push(`/schedule/${userId}?type=mentorship`)
  }

  return (
    <ProfessionalQueue
      userId="user123"
      connectionType="mentorship"
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
      onScheduleCall={handleScheduleCall}
    />
  )
}

