"use client"

import type React from "react"

import { useState, useRef } from "react"
import { motion, useInView } from "framer-motion"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { UserInfo } from "@/types/user"
import { ConnectionStatusIndicator } from "@/components/app/user-card/connection-status"
import { UserCardHeader } from "@/components/app/user-card/user-card-header"
import { UserCardTags } from "@/components/app/user-card/user-card-tags"
import { UserCardStats } from "@/components/app/user-card/user-card-stats"
import { UserCardInterests } from "@/components/app/user-card/user-card-interests"
import { UserCardDetails } from "@/components/app/user-card/user-card-details"

export interface UserCardProps {
  user: UserInfo
  inMeeting?: boolean
  inChat?: boolean
  onMessage?: (message: string) => void
  onSchedule?: (date: Date, duration: number, topic: string) => void
  className?: string
  forceVisible?: boolean
}

export function UserCard({
  user,
  inMeeting = false,
  inChat = false,
  onMessage = () => {},
  onSchedule = () => {},
  className,
  forceVisible,
}: UserCardProps) {
  if (!user) return null;
  const cardRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(cardRef, { once: true })

  // For the card background effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Handle mouse move for dynamic lighting effect
  const handleMouseMove = (e: React.MouseEvent) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  }

  return (
    <TooltipProvider>
      <motion.div
        ref={cardRef}
        className={cn(
          "w-full overflow-hidden",
          "rounded-xl border",
          "relative",
          inChat
            ? "max-w-full border-gray-100 bg-white/90 shadow-sm dark:border-gray-800 dark:bg-gray-900/90"
            : inMeeting
              ? "max-w-sm border-gray-200 bg-white/95 shadow-md dark:border-gray-800 dark:bg-gray-900/95"
              : "max-w-md border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900",
          className,
        )}
        initial="hidden"
        animate={(isInView || forceVisible) ? "visible" : "hidden"}
        variants={cardVariants}
        onMouseMove={handleMouseMove}
        style={{
          backgroundImage: `radial-gradient(
            circle at ${mousePosition.x}px ${mousePosition.y}px,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0) 50%
          )`,
        }}
      >
        {/* Status indicator - only in meeting mode */}
        {inMeeting && user.connectionStatus && (
          <ConnectionStatusIndicator
            status={user.connectionStatus}
            isSpeaking={user.isSpeaking}
            className="absolute left-0 top-0 z-10 m-3"
          />
        )}

        {/* Header with avatar and basic info */}
        <UserCardHeader
          user={user}
          inChat={inChat}
          isSpeaking={inMeeting && user.isSpeaking}
          onMessage={onMessage}
          onSchedule={onSchedule}
        />

        {/* Tags section */}
        <UserCardTags connectionType={user.connectionType ?? "collaboration"} experience={user.experience ?? 0} inChat={inChat} />

        {/* Meeting stats section - only in meeting mode */}
        {inMeeting && user.meetingStats && <UserCardStats stats={user.meetingStats} inChat={inChat} />}

        {/* Interests section */}
        <UserCardInterests
          sharedInterests={user.sharedInterests}
          interests={user.interests}
          inMeeting={inMeeting}
          inChat={inChat}
        />

        {/* Expandable details section */}
        <UserCardDetails
          bio={user.bio}
          school={user.school}
          connectionType={user.connectionType ?? "collaboration"}
          inChat={inChat}
          onMessage={onMessage}
          onSchedule={onSchedule}
          forceOpen={forceVisible}
        />
      </motion.div>
    </TooltipProvider>
  )
}

export default UserCard;
