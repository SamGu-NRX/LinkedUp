import { cn } from "@/lib/utils"
import { InterestBadge, type Interest } from "@/components/app/user-card/interest-badge"

interface UserCardInterestsProps {
  sharedInterests?: Interest[]
  interests?: string[]
  inMeeting?: boolean
  inChat?: boolean
  className?: string
}

export function UserCardInterests({
  sharedInterests = [],
  interests = [],
  inMeeting = false,
  inChat = false,
  className,
}: UserCardInterestsProps) {
  const showInterests = inMeeting && interests.length > 0
  const title = showInterests ? "Interests" : "Shared Interests"

  return (
    <div className={cn("mb-4 px-5", inChat && "mb-3 px-4", className)}>
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {showInterests
          ? interests.map((interest) => <InterestBadge key={interest} interest={interest} />)
          : sharedInterests.map((interest) => <InterestBadge key={interest.name} interest={interest} />)}
      </div>
    </div>
  )
}
