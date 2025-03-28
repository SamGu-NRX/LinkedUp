"use client"

import { motion } from "framer-motion"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type ConnectionStatus = "excellent" | "good" | "poor" | "offline"

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus
  isSpeaking?: boolean
  className?: string
}

// Pulse animation for the speaking indicator
const speakingPulse = {
  inactive: {
    scale: 1,
    opacity: 0.2,
  },
  active: {
    scale: [1, 1.1, 1],
    opacity: [0.2, 0.8, 0.2],
    transition: {
      duration: 1.5,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
    },
  },
}

export function ConnectionStatusIndicator({ status, isSpeaking = false, className }: ConnectionStatusIndicatorProps) {
  const statusColor =
    status === "excellent"
      ? "bg-green-500"
      : status === "good"
        ? "bg-blue-500"
        : status === "poor"
          ? "bg-amber-500"
          : "bg-red-500"

  return (
    <div className={cn("relative", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <span className={cn("block h-2.5 w-2.5 rounded-full", statusColor)} />
            {isSpeaking && (
              <motion.span
                className={cn("absolute -inset-1 rounded-full", statusColor)}
                variants={speakingPulse}
                initial="inactive"
                animate="active"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="capitalize">{status} connection</p>
          {isSpeaking && <p>Currently speaking</p>}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

