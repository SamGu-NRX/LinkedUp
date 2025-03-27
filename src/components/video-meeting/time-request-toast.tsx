"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TimeRequest } from "@/types/meeting"
import { Toaster } from "sonner";

interface TimeRequestToastProps {
  request: TimeRequest | null
  onAccept?: () => void
  onDecline?: () => void
}

export function TimeRequestToast({ request, onAccept, onDecline }: TimeRequestToastProps) {
  if (!request) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xs text-white px-4 py-3 rounded-lg shadow-lg"
      >
        <div className="flex items-center space-x-3">
          <Clock className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-sm">
              {request.requester === "You"
                ? "Time extension request sent"
                : `${request.requester} requested 5 more minutes`}
            </p>
            {request.requester !== "You" && (
              <div className="flex space-x-2 mt-2">
                <Button size="sm" variant="ghost" onClick={onDecline}>
                  Decline
                </Button>
                <Button size="sm" onClick={onAccept}>
                  Accept
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface TimeRequestNotificationProps {
  message: string
}

export function TimeRequestNotification({ message }: TimeRequestNotificationProps) {
  return (
    <div className="flex items-center space-x-2">
      <Clock className="w-4 h-4 text-blue-400" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

export function TimeRequestToaster() {
  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        className: "bg-zinc-900/90 text-zinc-100 border-zinc-800",
        duration: 4000,
      }}
    />
  )
}

