import { Users, Clock, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export interface UserCardStatsProps {
  stats: {
    totalMeetings: number
    totalMinutes: number
    averageRating: number
  }
  inChat?: boolean
  className?: string
}

export function UserCardStats({ stats, inChat = false, className }: UserCardStatsProps) {
  return (
    <div className={cn("mb-4 px-5", inChat && "px-4", className)}>
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
        <h4 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Meeting History</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            <Users className="mb-1 h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{stats.totalMeetings}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Meetings</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            <Clock className="mb-1 h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{Math.round(stats.totalMinutes / 60)}h</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Total Time</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            <Star className="mb-1 h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{stats.averageRating}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Avg Rating</span>
          </div>
        </div>
      </div>
    </div>
  )
}

