import type React from "react"
import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { utils } from "@/styles/utils"
import { colors } from "@/styles/colors"

interface RatingOverlayProps {
  onRate: (rating: number) => void
}

const RatingOverlay: React.FC<RatingOverlayProps> = ({ onRate }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className={`${utils.cardBg} rounded-lg p-8 text-center max-w-md w-full`}
      >
        <h2 className="text-2xl font-bold mb-4">Rate Your Call</h2>
        <p className="mb-6">How was your experience?</p>
        <div className="flex justify-center space-x-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <motion.button
              key={rating}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onRate(rating)}
              className="text-yellow-400 hover:text-yellow-500 transition-colors duration-200"
            >
              <Star size={40} fill={colors.secondary} />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default RatingOverlay

