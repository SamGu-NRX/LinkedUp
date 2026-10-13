"use client"

import type { UserInfo } from "@/types/user"
import { cn } from "@/lib/utils"
import { ProfileAvatar } from "@/components/app/user-card/profile-avatar"
import { UserCardActions } from "@/components/app/user-card/user-card-actions"
import { Briefcase } from "lucide-react"

interface UserCardHeaderProps {
  user: UserInfo
  inChat?: boolean
  isSpeaking?: boolean
  onOpenMessage: () => void
  onOpenSchedule: () => void
  className?: string
}

export function UserCardHeader({
  user,
  inChat = false,
  isSpeaking = false,
  onOpenMessage,
  onOpenSchedule,
  className,
}: UserCardHeaderProps) {
  const { name, avatar, profession, company, isBot } = user

  return (
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
            onOpenMessage={onOpenMessage}
            onOpenSchedule={onOpenSchedule}
          />
        </div>
      </div>
    </div>
  )
}
