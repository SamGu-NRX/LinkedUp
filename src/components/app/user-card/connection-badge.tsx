import { Briefcase, GraduationCap, Users, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ConnectionType = "b2b" | "collaboration" | "mentorship" | "investment"

interface ConnectionBadgeProps {
  type: ConnectionType
  className?: string
  showLabel?: boolean
}

export const connectionTypeInfo = {
  b2b: {
    label: "Business",
    icon: <Briefcase className="h-3 w-3" />,
    description: "Seeking B2B opportunities and professional connections",
    color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60",
    hoverColor: "hover:bg-sky-100 dark:hover:bg-sky-950/50",
  },
  collaboration: {
    label: "Collaboration",
    icon: <Users className="h-3 w-3" />,
    description: "Open to project collaborations and teamwork",
    color:
      "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60",
    hoverColor: "hover:bg-amber-100 dark:hover:bg-amber-950/50",
  },
  mentorship: {
    label: "Mentorship",
    icon: <GraduationCap className="h-3 w-3" />,
    description: "Available for mentoring or seeking guidance",
    color:
      "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60",
    hoverColor: "hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
  },
  investment: {
    label: "Investment",
    icon: <ExternalLink className="h-3 w-3" />,
    description: "Interested in investment opportunities",
    color:
      "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60",
    hoverColor: "hover:bg-purple-100 dark:hover:bg-purple-950/50",
  },
}

export function ConnectionBadge({ type, className, showLabel = true }: ConnectionBadgeProps) {
  const info = connectionTypeInfo[type]

  return (
    <Badge
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors duration-150",
        info.color,
        info.hoverColor,
        className,
      )}
    >
      <span className="mr-1">{info.icon}</span>
      {showLabel && info.label}
    </Badge>
  )
}

