"use client"

import { motion } from "framer-motion"
import { GraduationCap, Briefcase, Award } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type InterestType = "academic" | "industry" | "skill"

export interface Interest {
  type: InterestType
  name: string
}

interface InterestBadgeProps {
  interest: Interest | string
  animated?: boolean
  className?: string
}

// Badge variants for different interest types
const badgeVariants = {
  academic: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/60",
    hover: "hover:bg-blue-100 dark:hover:bg-blue-950/50",
    icon: <GraduationCap className="mr-1 h-3 w-3 opacity-70" />,
  },
  industry: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/60",
    hover: "hover:bg-emerald-100 dark:hover:bg-emerald-950/50",
    icon: <Briefcase className="mr-1 h-3 w-3 opacity-70" />,
  },
  skill: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800/60",
    hover: "hover:bg-violet-100 dark:hover:bg-violet-950/50",
    icon: <Award className="mr-1 h-3 w-3 opacity-70" />,
  },
}

export function InterestBadge({ interest, animated = true, className }: InterestBadgeProps) {
  const BadgeWrapper = animated ? motion.div : "div"
  const animationProps = animated
    ? {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.98 },
      }
    : {}

  // Handle both typed interests and plain strings
  if (typeof interest === "string") {
    return (
      <BadgeWrapper {...animationProps}>
        <Badge
          variant="outline"
          className={cn(
            "bg-gray-50 text-gray-700 transition-colors duration-150 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/50",
            className,
          )}
        >
          {interest}
        </Badge>
      </BadgeWrapper>
    )
  }

  const variant = badgeVariants[interest.type]

  return (
    <BadgeWrapper {...animationProps}>
      <Badge
        className={cn(
          "border font-normal transition-colors duration-150",
          variant.bg,
          variant.text,
          variant.border,
          variant.hover,
          className,
        )}
      >
        {variant.icon}
        {interest.name}
      </Badge>
    </BadgeWrapper>
  )
}

