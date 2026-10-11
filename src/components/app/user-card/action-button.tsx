import type React from "react"
import { MessageCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ActionType = "message" | "schedule"

type ActionButtonProps = Omit<React.ComponentProps<typeof Button>, "children"> & {
  action: ActionType
  label?: string
}

export function ActionButton({ action, label, className, ...props }: ActionButtonProps) {
  const actionConfig = {
    message: {
      icon: <MessageCircle className="h-4 w-4" />,
      defaultLabel: "Message",
    },
    schedule: {
      icon: <Calendar className="h-4 w-4" />,
      defaultLabel: "Schedule",
    },
  }

  const config = actionConfig[action]
  const displayLabel = label || config.defaultLabel

  return (
    <Button size="sm" className={cn("gap-1.5", className)} {...props}>
      {config.icon}
      <span>{displayLabel}</span>
    </Button>
  )
}

