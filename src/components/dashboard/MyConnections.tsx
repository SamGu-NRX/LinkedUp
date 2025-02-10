import type React from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { Phone, UserPlus } from "lucide-react"
import { utils } from "@/styles/utils"

interface Connection {
  id: string
  name: string
  avatar: string
  lastCallDate: string
}

const connections: Connection[] = [
  { id: "1", name: "Alice Johnson", avatar: "/placeholder.svg?height=50&width=50", lastCallDate: "2023-05-15" },
  { id: "2", name: "Bob Smith", avatar: "/placeholder.svg?height=50&width=50", lastCallDate: "2023-05-14" },
  { id: "3", name: "Charlie Brown", avatar: "/placeholder.svg?height=50&width=50", lastCallDate: "2023-05-13" },
  { id: "4", name: "Diana Prince", avatar: "/placeholder.svg?height=50&width=50", lastCallDate: "2023-05-12" },
]

const MyConnections: React.FC = () => {
  return (
    <div>
      {connections.map((connection, index) => (
        <motion.div
          key={connection.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className={`${utils.cardBg} rounded-lg p-4 mb-4 flex items-center justify-between`}
        >
          <div className="flex items-center">
            <Image
              src={connection.avatar || "/placeholder.svg"}
              alt={connection.name}
              width={50}
              height={50}
              className="rounded-full mr-4"
            />
            <div>
              <h3 className="font-semibold">{connection.name}</h3>
              <p className="text-sm text-gray-400">Last call: {connection.lastCallDate}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button className={`${utils.buttonPrimary} p-2 rounded-full`}>
              <Phone size={20} />
            </button>
            <button className={`${utils.buttonSecondary} p-2 rounded-full`}>
              <UserPlus size={20} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default MyConnections

