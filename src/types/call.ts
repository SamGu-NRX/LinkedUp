import type { MatchIntro } from "@/lib/interest-matching/types"

export type CallType = "casual" | "professional"

export interface Participant {
  id: string
  name: string
  avatarUrl: string
}

export interface CallState {
  isActive: boolean
  isMuted: boolean
  hasExtensionAvailable: boolean
  connectionQuality: "good" | "poor"
}

export interface VoiceCallProps {
  matchIntro?: MatchIntro | null
  callType: CallType
  participants: [Participant, Participant]
  initialDuration: number
  onEndCall: () => void
  onExtendCall: () => void
  onToggleMute: () => void
  onRateCall: (rating: number) => void
}

