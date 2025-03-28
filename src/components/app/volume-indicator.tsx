import { Volume2 } from "lucide-react"
import { motion } from "framer-motion"

export default function VolumeIndicator() {
  return (
    <motion.div
      className="absolute top-4 right-4 bg-gray-800/50 backdrop-blur-md p-2 rounded-full flex items-center space-x-2"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}
    >
      <Volume2 className="w-4 h-4 text-gray-300" />
      <div className="w-16 h-1 bg-gray-600 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-green-500"
          initial={{ width: 0 }}
          animate={{ width: "70%" }}
          transition={{ delay: 1.2, duration: 0.5 }}
        />
      </div>
    </motion.div>
  )
}

