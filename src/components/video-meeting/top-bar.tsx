"use client"

import { motion } from "framer-motion"
import { Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { User } from "@/types/meeting"
import { TimeDisplay } from "./time-display"

interface TopBarProps {
  partner: User
  timeElapsed: number
  timeRemaining: number
  showTimeLeft: boolean
  isAlmostOutOfTime: boolean
  isSidebarOpen: boolean
  onToggleTimeDisplay: () => void
  onToggleSidebar: () => void
  onOpenSettings: () => void
}

export function TopBar({
  partner,
  timeElapsed,
  timeRemaining,
  showTimeLeft,
  isAlmostOutOfTime,
  isSidebarOpen,
  onToggleTimeDisplay,
  onToggleSidebar,
  onOpenSettings,
}: TopBarProps) {
  return (
    <motion.div className="h-16 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800 flex items-center justify-between px-6 z-10">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 rounded-full hover:bg-zinc-800/50"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5 text-zinc-400" />
          ) : (
            <PanelLeftOpen className="h-5 w-5 text-zinc-400" />
          )}
        </Button>
        <div>
          <h3 className="text-zinc-200 text-sm font-medium">Meeting with {partner.name}</h3>
          <p className="text-zinc-400 text-xs">1-on-1 discussion</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <TimeDisplay
          showTimeLeft={showTimeLeft}
          timeElapsed={timeElapsed}
          timeRemaining={timeRemaining}
          isAlmostOutOfTime={isAlmostOutOfTime}
          onToggleTimeDisplay={onToggleTimeDisplay}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="h-8 w-8 rounded-full hover:bg-zinc-800/50"
        >
          <Settings className="h-4 w-4 text-zinc-400" />
        </Button>
      </div>
    </motion.div>
  )
}

