"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User } from "@/types/meeting"
import { Clock, Star, Users } from "lucide-react"

interface UserCardProps {
  user: User
}

export function UserCard({ user }: UserCardProps) {
  return (
    <Card className="bg-zinc-800/30 border-none shadow-lg">
      <CardContent className="p-3">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar className="h-10 w-10 ring-2 ring-blue-500/50">
            <AvatarImage src={user.avatar} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-zinc-200 text-sm font-medium">{user.name}</h3>
            <p className="text-zinc-400 text-xs">
              {user.role} • {user.company}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-zinc-400 text-xs mb-1">Meeting Stats</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center space-x-1.5">
                <Users className="w-3 h-3 text-blue-400" />
                <span className="text-zinc-300 text-xs">{user.meetingStats.totalMeetings}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-zinc-300 text-xs">{Math.round(user.meetingStats.totalMinutes / 60)}h</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Star className="w-3 h-3 text-blue-400" />
                <span className="text-zinc-300 text-xs">{user.meetingStats.averageRating}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">Interests</p>
            <div className="flex flex-wrap gap-1">
              {user.interests.map((interest) => (
                <Badge key={interest} variant="secondary" className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

