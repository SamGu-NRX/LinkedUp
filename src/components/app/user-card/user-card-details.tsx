"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, GraduationCap, Award, ExternalLink, MessageCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type ConnectionType, connectionTypeInfo } from "@/components/app/user-card/connection-badge"

interface UserCardDetailsProps {
  bio: string
  school: string
  connectionType: ConnectionType
  inChat?: boolean
  onMessage: () => void
  onSchedule: () => void
  className?: string
  forceOpen?: boolean
}

export function UserCardDetails({
  bio,
  school,
  connectionType,
  inChat = false,
  onMessage,
  onSchedule,
  className,
  forceOpen,
}: UserCardDetailsProps) {
  const [detailsVisible, setDetailsVisible] = useState(forceOpen ?? false)

  const toggleDetails = () => {
    setDetailsVisible((prev) => !prev)
  }

  const detailsVariants = {
    hidden: {
      height: 0,
      opacity: 0,
    },
    visible: {
      height: "auto",
      opacity: 1,
      transition: {
        height: {
          duration: 0.3,
          ease: "easeInOut",
        },
        opacity: {
          duration: 0.3,
          delay: 0.1,
        },
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      transition: {
        height: {
          duration: 0.3,
          ease: "easeInOut",
        },
        opacity: {
          duration: 0.2,
        },
      },
    },
  }

  return (
    <div className={cn("px-5 pb-5", inChat && "px-4 pb-4", className)}>
      <AnimatePresence>
        {detailsVisible && (
          <motion.div
            variants={detailsVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="space-y-4 py-4">
              {/* Education info */}
              <div>
                <h4 className="mb-1.5 flex items-center text-sm font-medium">
                  <GraduationCap className="mr-1.5 h-4 w-4 text-primary" />
                  Education
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{school}</p>
              </div>

              {/* Bio info */}
              <div>
                <h4 className="mb-1.5 flex items-center text-sm font-medium">
                  <Award className="mr-1.5 h-4 w-4 text-primary" />
                  About
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{bio}</p>
              </div>

              {/* Connection purpose */}
              <div>
                <h4 className="mb-1.5 flex items-center text-sm font-medium">
                  <ExternalLink className="mr-1.5 h-4 w-4 text-primary" />
                  Seeking
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {connectionTypeInfo[connectionType].description}
                </p>
              </div>

              {/* Contact buttons */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onMessage}>
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Message
                </Button>
                <Button size="sm" className="flex-1" onClick={onSchedule}>
                  <Calendar className="mr-1.5 h-4 w-4" />
                  Schedule
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          variant="ghost"
          onClick={toggleDetails}
          className={cn(
            "w-full border transition-colors duration-200",
            "bg-gray-50 dark:bg-gray-800/50",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            "border-gray-100 dark:border-gray-800",
            detailsVisible && "bg-gray-100 dark:bg-gray-800",
          )}
        >
          <span className="flex-1 text-sm">{detailsVisible ? "Hide Details" : "View Details"}</span>
          <motion.div animate={{ rotate: detailsVisible ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </motion.div>
        </Button>
      </motion.div>
    </div>
  )
}
