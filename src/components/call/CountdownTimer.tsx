import type React from "react"
import { motion } from "framer-motion"
import { formatTime } from "@/utils"
import { colors } from "@/styles/colors"

interface CountdownTimerProps {
  timeRemaining: number
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ timeRemaining }) => {
  const progress = (timeRemaining / 300) * 100 // Assuming 5 minutes initial duration

  return (
    <div className="relative w-32 h-32 mx-auto mb-8">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle className="text-gray-700 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
        <motion.circle
          className="stroke-current"
          style={{ stroke: colors.primary }}
          strokeWidth="8"
          strokeLinecap="round"
          cx="50"
          cy="50"
          r="40"
          fill="transparent"
          initial={{ pathLength: 1 }}
          animate={{ pathLength: progress / 100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{formatTime(timeRemaining)}</span>
      </div>
    </div>
  )
}

export default CountdownTimer

