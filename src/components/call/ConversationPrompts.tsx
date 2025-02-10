import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import type { CallType } from "../types/call"
import { utils } from "../styles/utils"

interface ConversationPromptsProps {
  callType: CallType
}

const casualPrompts = [
  "When was the last time you cried?",
  "What's your biggest fear?",
  "Describe your perfect day.",
  "What's your most cherished childhood memory?",
  "If you could change one thing about yourself, what would it be?",
]

const professionalPrompts = [
  "Describe a challenging work situation and how you handled it.",
  "What's your leadership style?",
  "How do you stay updated with industry trends?",
  "Describe a time when you had to adapt to a significant change at work.",
  "What's your approach to problem-solving in a professional setting?",
]

const ConversationPrompts: React.FC<ConversationPromptsProps> = ({ callType }) => {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const prompts = callType === "casual" ? casualPrompts : professionalPrompts

  const handleNextPrompt = () => {
    setCurrentPromptIndex((prevIndex) => (prevIndex + 1) % prompts.length)
  }

  return (
    <div className={`${utils.cardBg} rounded-lg p-6 mb-8 max-w-md w-full mx-auto`}>
      <h3 className="text-lg font-semibold mb-2">Conversation Prompt:</h3>
      <motion.div
        key={currentPromptIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-xl mb-4">{prompts[currentPromptIndex]}</p>
      </motion.div>
      <button
        onClick={handleNextPrompt}
        className={`${utils.buttonSecondary} text-white font-bold py-2 px-4 rounded transition duration-200`}
      >
        Next Prompt
      </button>
    </div>
  )
}

export default ConversationPrompts

