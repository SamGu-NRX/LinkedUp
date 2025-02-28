import Image from "next/image"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import VolumeIndicator from "./volume-indicator"

export default function VideoChat() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      <Card className="w-full max-w-4xl aspect-video overflow-hidden shadow-2xl relative">
        <Image
          src="/placeholder.svg?height=720&width=1280&text=Partner"
          alt="Partner"
          layout="fill"
          objectFit="cover"
          className="filter brightness-95"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-sm"
        >
          Partner
        </motion.div>
        <VolumeIndicator />
      </Card>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-8 right-8 w-48 aspect-video"
      >
        <Card className="w-full h-full overflow-hidden shadow-xl">
          <Image
            src="/placeholder.svg?height=270&width=480&text=You"
            alt="You"
            layout="fill"
            objectFit="cover"
            className="filter brightness-95"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-full text-xs">You</div>
        </Card>
      </motion.div>
    </div>
  )
}

