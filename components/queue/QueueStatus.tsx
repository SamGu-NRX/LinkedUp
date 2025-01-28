import React from "react"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

interface QueueStatusProps {
  queueType: "formal" | "casual"
  estimatedWaitTime: number
}

export default function QueueStatus({ queueType, estimatedWaitTime }: QueueStatusProps) {
  return (
    <div className="text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        className="inline-block mb-4"
      >
        <Loader2 className="w-12 h-12 text-primary" />
      </motion.div>
      <h2 className="text-2xl font-bold mb-2">In Queue</h2>
      <p className="text-muted-foreground mb-2">
        Searching for a {queueType === "formal" ? "professional" : "casual"} match
      </p>
      <p className="text-sm">
        Estimated wait time: {Math.floor(estimatedWaitTime / 60)}:{(estimatedWaitTime % 60).toString().padStart(2, "0")}
      </p>
    </div>
  )
}

