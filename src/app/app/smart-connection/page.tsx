"use client"

import React, { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import SmartConnectionEngine from "@/components/queue/SmartConnectionEngine"

function SmartConnectionPageContent() {
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

export default function SmartConnectionPage() {
  return (
    <Suspense fallback={null}>
      <SmartConnectionPageContent />
    </Suspense>
  )
}
