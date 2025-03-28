import { cn } from "@/lib/utils"
import type { ConnectionType } from "@/components/app/user-card/connection-badge"
import { ExperienceBadge } from "@/components/app/user-card/experience-badge"
import { ConnectionBadge } from "@/components/app/user-card/connection-badge"

interface UserCardTagsProps {
  connectionType: ConnectionType
  experience: number
  inChat?: boolean
  className?: string
}

export function UserCardTags({ connectionType, experience, inChat = false, className }: UserCardTagsProps) {
  return (
    <div className={cn("px-5 mb-3", inChat && "px-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <ExperienceBadge years={experience} />
        <ConnectionBadge type={connectionType} />
      </div>
    </div>
  )
}
