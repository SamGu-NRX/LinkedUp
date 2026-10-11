"use client"

import React, { Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import VoiceCallScreen from "@/components/call/VoiceCallScreen"
import type { CallType, Participant } from "@/types/call"

function CallPageContent() {
  const params = useParams()

  const searchParams = useSearchParams()
  const callType = (searchParams.get("type") as CallType) || "casual"
  const callId = params.id as string

  const handleEndCall = () => {
    // Implement call ending logic
    console.log("Call ended")
  }

  const handleExtendCall = () => {
    // Implement call extension logic
    console.log("Call extended")
  }

  const handleToggleMute = () => {
    // Implement mute toggling logic
    console.log("Mute toggled")
  }

  const handleRateCall = (rating: number) => {
    // Implement call rating logic
    console.log(`Call rated: ${rating}`)
  }

  // Mock data for demonstration purposes
  const participants: [Participant, Participant] = [
    { id: "1", name: "You", avatarUrl: "/placeholder.svg?height=120&width=120" },
    { id: "2", name: "John Doe", avatarUrl: "/placeholder.svg?height=120&width=120" },
  ]

  return (
    <VoiceCallScreen
      callType={callType}
      participants={participants}
      initialDuration={300} // 5 minutes
      onEndCall={handleEndCall}
      onExtendCall={handleExtendCall}
      onToggleMute={handleToggleMute}
      onRateCall={handleRateCall}
    />
  )
}

export default function CallPage() {
  // useSearchParams() inside requires a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <CallPageContent />
    </Suspense>
  )
}
