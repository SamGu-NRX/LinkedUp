import type React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { VoiceCallProps, CallState } from "@/types/call"
import ParticipantAvatar from "./ParticipantAvatar"
import CountdownTimer from "./CountdownTimer"
import ConversationPrompts from "./ConversationPrompts"
import CallControls from "./CallControls"
import RatingOverlay from "./RatingOverlay"
import { utils } from "@/styles/utils"

const VoiceCallScreen: React.FC<VoiceCallProps> = ({
  callType,
  participants,
  initialDuration,
  onEndCall,
  onExtendCall,
  onToggleMute,
  onRateCall,
}) => {
  const [callState, setCallState] = useState<CallState>({
    isActive: true,
    isMuted: false,
    hasExtensionAvailable: true,
    connectionQuality: "good",
  })
  const [timeRemaining, setTimeRemaining] = useState(initialDuration)
  const [showRating, setShowRating] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          setCallState((prevState) => ({ ...prevState, isActive: false }))
          setShowRating(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Simulate active speaker changes
    const speakerInterval = setInterval(() => {
      setActiveSpeaker(participants[Math.floor(Math.random() * participants.length)].id)
    }, 3000)

    return () => {
      clearInterval(timer)
      clearInterval(speakerInterval)
    }
  }, [participants])

  const handleEndCall = () => {
    setCallState((prevState) => ({ ...prevState, isActive: false }))
    setShowRating(true)
    onEndCall()
  }

  const handleExtendCall = () => {
    setTimeRemaining((prev) => prev + 300) // Add 5 minutes
    setCallState((prevState) => ({ ...prevState, hasExtensionAvailable: false }))
    onExtendCall()
  }

  const handleToggleMute = () => {
    setCallState((prevState) => ({ ...prevState, isMuted: !prevState.isMuted }))
    onToggleMute()
  }

  const handleRateCall = (rating: number) => {
    onRateCall(rating)
    setShowRating(false)
  }

  return (
    <div
      className={`flex flex-col items-center justify-between min-h-screen ${utils.gradientBg} ${utils.textPrimary} p-4`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-4xl flex flex-col h-full"
      >
        <div className="flex justify-center mb-8 flex-wrap">
          {participants.map((participant) => (
            <ParticipantAvatar
              key={participant.id}
              participant={participant}
              isActive={participant.id === activeSpeaker}
              connectionQuality={callState.connectionQuality}
            />
          ))}
        </div>

        <div className="flex-grow flex flex-col justify-center items-center">
          <CountdownTimer timeRemaining={timeRemaining} />
          <ConversationPrompts callType={callType} />
        </div>

        <CallControls
          isMuted={callState.isMuted}
          hasExtensionAvailable={callState.hasExtensionAvailable}
          onToggleMute={handleToggleMute}
          onExtendCall={handleExtendCall}
          onEndCall={handleEndCall}
        />

        <AnimatePresence>{showRating && <RatingOverlay onRate={handleRateCall} />}</AnimatePresence>
      </motion.div>
    </div>
  )
}

export default VoiceCallScreen

