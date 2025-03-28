import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExperienceBadgeProps {
  years: number
  className?: string
}

export function ExperienceBadge({ years, className }: ExperienceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 transition-colors duration-150 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
        className,
      )}
    >
      <Clock className="mr-1 h-3 w-3 opacity-70" />
      {years} years experience
    </span>
  )
}

