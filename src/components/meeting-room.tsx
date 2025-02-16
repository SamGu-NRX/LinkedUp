"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import TopBar from "./top-bar"
import VideoChat from "./video-chat"
import ControlBar from "./control-bar"

export default function MeetingRoom() {
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [showControls, setShowControls] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => (prevTime > 0 ? prevTime - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const hideControls = setTimeout(() => setShowControls(false), 3000)
    return () => clearTimeout(hideControls)
  }, [])

  return (
    <motion.div className="flex flex-col h-full relative" onMouseMove={() => setShowControls(true)}>
      <TopBar prompt="Discuss the future of AI" timeLeft={timeLeft} />
      <VideoChat />
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
          >
            <ControlBar />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

