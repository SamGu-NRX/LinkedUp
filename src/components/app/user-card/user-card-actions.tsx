"use client"

import { Settings, MessageCircle, Calendar, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
// import { ActionButton } from "@/components/app/user-card/action-button"

interface UserCardActionsProps {
  onOpenMessage: () => void
  onOpenSchedule: () => void
  className?: string
  buttonSize?: "default" | "sm" | "lg" | "icon"
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
}

export function UserCardActions({
  onOpenMessage,
  onOpenSchedule,
  className,
  buttonSize = "icon",
  buttonVariant = "ghost",
}: UserCardActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={cn("h-8 w-8 rounded-full", className)}>
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>User Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenMessage}>
          <MessageCircle className="mr-2 h-4 w-4 opacity-70" />
          Send Message
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenSchedule}>
          <Calendar className="mr-2 h-4 w-4 opacity-70" />
          Schedule Meeting
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-red-500 dark:text-red-400">
          <AlertCircle className="mr-2 h-4 w-4 opacity-70" />
          Report User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
