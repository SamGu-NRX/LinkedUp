"use client"

import { useState } from "react"
import type { UserInfo } from "@/types/user"
import { cn } from "@/lib/utils"
import { ProfileAvatar } from "@/components/app/user-card/profile-avatar"
import { UserCardActions } from "@/components/app/user-card/user-card-actions"
import { MessageModal } from "@/components/app/user-card/message-modal"
import { ScheduleModal } from "@/components/app/user-card/schedule-modal"
import { Briefcase } from "lucide-react"

interface UserCardHeaderProps {
  user: UserInfo
  inChat?: boolean
  isSpeaking?: boolean
  onMessage: (message: string) => void
  onSchedule: (date: Date, duration: number, topic: string) => void
  className?: string
}

export function UserCardHeader({
  user,
  inChat = false,
  isSpeaking = false,
  onMessage,
  onSchedule,
  className,
}: UserCardHeaderProps) {
  const { name, avatar, profession, company, isBot } = user
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)

  const handleSendMessage = (message: string) => {
    if (message.trim()) {
      onMessage(message)
      setMessageModalOpen(false)
    }
  }

  const handleScheduleMeeting = (date: Date, duration: number, topic: string) => {
    onSchedule(date, duration, topic)
    setScheduleModalOpen(false)
  }

  return (
    <>
      {/* Message Modal */}
      <MessageModal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        name={name}
        avatar={avatar}
        onSend={handleSendMessage}
      />

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        name={name}
        avatar={avatar}
        onSchedule={handleScheduleMeeting}
      />

      <div className={cn("flex items-start p-5 pb-3", inChat && "p-4 pb-2", className)}>
        <ProfileAvatar name={name} avatar={avatar} size={inChat ? "md" : "lg"} isBot={isBot} isSpeaking={isSpeaking} />

        <div className="ml-4 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className={cn("font-semibold tracking-tight", inChat ? "text-base" : "text-lg")}>{name}</h3>
              <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Briefcase className="mr-1 h-3 w-3 opacity-70" />
                {profession}
                {company && (
                  <>
                    <span className="mx-1">•</span>
                    {company}
                  </>
                )}
              </p>
            </div>

            <UserCardActions
              onOpenMessage={() => setMessageModalOpen(true)}
              onOpenSchedule={() => setScheduleModalOpen(true)}
            />
          </div>
        </div>
      </div>
    </>
  )
}
