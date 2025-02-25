"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Clock, AlarmClock } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { TimeManager } from "./time-manager"

interface TimeDisplayProps {
  showTimeLeft: boolean
  timeElapsed: number
  timeRemaining: number
  isAlmostOutOfTime: boolean
  onToggleTimeDisplay: () => void
}

export function TimeDisplay({
  showTimeLeft,
  timeElapsed,
  timeRemaining,
  isAlmostOutOfTime,
  onToggleTimeDisplay,
}: TimeDisplayProps) {
  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Label htmlFor="time-toggle" className="text-zinc-400 text-xs select-none cursor-pointer">
          Show time left
        </Label>
        <Switch
          id="time-toggle"
          checked={showTimeLeft}
          onCheckedChange={onToggleTimeDisplay}
          className="data-[state=checked]:bg-blue-500"
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={showTimeLeft ? "timeLeft" : "timeElapsed"}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${
            isAlmostOutOfTime && showTimeLeft ? "bg-red-500/20" : "bg-zinc-800/70"
          }`}
        >
          <motion.div
            animate={
              isAlmostOutOfTime && showTimeLeft
                ? {
                    rotate: [-5, 5, -5],
                    transition: {
                      repeat: Number.POSITIVE_INFINITY,
                      duration: 0.5,
                    },
                  }
                : {}
            }
          >
            {isAlmostOutOfTime && showTimeLeft ? (
              <AlarmClock className="w-4 h-4 text-red-400" />
            ) : (
              <Clock className="w-4 h-4 text-blue-400" />
            )}
          </motion.div>
          <span className={`font-mono text-sm ${isAlmostOutOfTime && showTimeLeft ? "text-red-400" : "text-blue-400"}`}>
            {showTimeLeft ? TimeManager.formatTime(timeRemaining) : TimeManager.formatTime(timeElapsed)}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

