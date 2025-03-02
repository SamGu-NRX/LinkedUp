"use client"

import React from "react"
import MatchQueueLobby from "@/components/queue/MatchQueueLobby"
import { useRouter } from "next/navigation"

export default function MatchQueuePage() {
  const router = useRouter()

  const handleLeaveQueue = () => {
    router.push("/app")
  }

  const handleAcceptMatch = (matchId: string) => {
    // In a real application, you would initiate the call here
    console.log(`Accepted match with ID: ${matchId}`)
    router.push(`/app/call/${matchId}`)
  }

  const handleDeclineMatch = (matchId: string) => {
    // In a real application, you would decline the match and continue searching
    console.log(`Declined match with ID: ${matchId}`)
  }

  return (
    <MatchQueueLobby
      userId="user123"
      queueType="casual"
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
    />
  )
}

