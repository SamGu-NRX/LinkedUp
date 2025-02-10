import type React from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import type { Participant } from "../types/call"
import { colors } from "../styles/colors"

interface ParticipantAvatarProps {
  participant: Participant
  isActive: boolean
  connectionQuality: "good" | "poor"
}

const ParticipantAvatar: React.FC<ParticipantAvatarProps> = ({ participant, isActive, connectionQuality }) => {
  return (
    <div className="relative m-2">
      <motion.div
        animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
        className="relative"
      >
        <Image
          src={participant.avatarUrl || "/placeholder.svg"}
          alt={participant.name}
          width={120}
          height={120}
          className="rounded-full"
        />
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: `3px solid ${colors.status.success}`,
              boxShadow: `0 0 0 3px ${colors.status.success}`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </motion.div>
      <p className="text-center mt-2 font-semibold">{participant.name}</p>
      {connectionQuality === "poor" && (
        <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
          Poor Connection
        </div>
      )}
    </div>
  )
}

export default ParticipantAvatar

