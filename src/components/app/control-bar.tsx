import { Mic, Video, PhoneOff, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export default function ControlBar() {
  return (
    <motion.div
      className="bg-gray-800/50 backdrop-blur-md p-2 rounded-full flex space-x-2"
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <Button variant="ghost" size="icon" className="rounded-full">
        <Mic className="w-5 h-5" />
      </Button>
      <Button variant="ghost" size="icon" className="rounded-full">
        <Video className="w-5 h-5" />
      </Button>
      <Button variant="destructive" size="icon" className="rounded-full">
        <PhoneOff className="w-5 h-5" />
      </Button>
      <Button variant="ghost" size="icon" className="rounded-full">
        <MessageSquare className="w-5 h-5" />
      </Button>
    </motion.div>
  )
}

