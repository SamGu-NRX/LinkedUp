"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SmartConnectionEngine from "@/components/queue/SmartConnectionEngine"

export default function SmartConnectionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queueType = searchParams.get("type") as "professional" | "casual"
  const purpose = searchParams.get("purpose")

  const handleLeaveQueue = () => {
    router.push("/app")
  }

  const handleAcceptMatch = (matchId: string) => {
    console.log(`Accepted match with ID: ${matchId}`)
    router.push(`/videocall/${matchId}`)
  }

  const handleDeclineMatch = (matchId: string) => {
    console.log(`Declined match with ID: ${matchId}`)
  }

  return (
    <SmartConnectionEngine
      userId="user123"
      queueType={queueType}
      onLeaveQueue={handleLeaveQueue}
      onAcceptMatch={handleAcceptMatch}
      onDeclineMatch={handleDeclineMatch}
    />
  )
}

