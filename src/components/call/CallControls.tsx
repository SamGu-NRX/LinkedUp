import type React from "react"
import { motion } from "framer-motion"
import { Mic, MicOff, PhoneOff, Clock } from "lucide-react"
import { utils } from "@/styles/utils"
import { colors } from "@/styles/colors"

interface CallControlsProps {
  isMuted: boolean
  hasExtensionAvailable: boolean
  onToggleMute: () => void
  onExtendCall: () => void
  onEndCall: () => void
}

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  hasExtensionAvailable,
  onToggleMute,
  onExtendCall,
  onEndCall,
}) => {
  return (
    <div className="flex justify-center space-x-4 mt-8">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggleMute}
        className={`p-4 rounded-full ${isMuted ? "bg-red-500" : utils.buttonPrimary} text-white`}
      >
        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onExtendCall}
        disabled={!hasExtensionAvailable}
        className={`p-4 rounded-full ${hasExtensionAvailable ? utils.buttonSecondary : "bg-gray-500"} text-white`}
      >
        <Clock size={24} />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onEndCall}
        className={`p-4 rounded-full ${utils.buttonAccent} text-white`}
      >
        <PhoneOff size={24} />
      </motion.button>
    </div>
  )
}

export default CallControls

