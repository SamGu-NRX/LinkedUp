"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

interface LeaveRequestNotificationProps {
  requester: string
  onAccept?: () => void
  onDecline?: () => void
}

export function LeaveRequestNotification({ requester, onAccept, onDecline }: LeaveRequestNotificationProps) {
  const isIncoming = requester !== "You"

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="bg-zinc-800 text-white p-4 rounded-lg shadow-lg min-w-[300px]"
    >
      <div className="flex items-center space-x-3">
        <div className="rounded-full bg-red-500/10 p-2">
          <LogOut className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Leave Request</p>
          <p className="text-sm text-zinc-400">
            {isIncoming ? `${requester} wants to leave the call` : "Waiting for approval to leave..."}
          </p>
        </div>
      </div>

      {isIncoming && (
        <div className="flex justify-end space-x-2 mt-3">
          <Button size="sm" variant="ghost" onClick={onDecline} className="text-zinc-400 hover:text-zinc-100">
            Decline
          </Button>
          <Button size="sm" onClick={onAccept} variant="destructive">
            Allow
          </Button>
        </div>
      )}
    </motion.div>
  )
}

