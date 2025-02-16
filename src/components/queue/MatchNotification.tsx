import React from "react"
import { motion } from "framer-motion"
import UserCard from "./UserCard"
import { Button } from "@/components/ui/button"

interface MatchNotificationProps {
  matchData: {
    id: string
    name: string
    avatar: string
    bio: string
    profession: string
    tag: string
    sharedInterests: Array<{ type: "academic" | "passion" | "hobby"; name: string }>
    upvotes: number
  }
  onAccept: () => void
  onDecline: () => void
}

export default function MatchNotification({ matchData, onAccept, onDecline }: MatchNotificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-4">Match Found!</h2>
        <UserCard {...matchData} />
        <div className="flex justify-center space-x-4 mt-6">
          <Button onClick={onDecline} variant="outline">
            Decline
          </Button>
          <Button onClick={onAccept}>Accept</Button>
        </div>
      </div>
    </motion.div>
  )
}

