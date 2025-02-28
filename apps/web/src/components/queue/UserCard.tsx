import React, { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Settings, ChevronDown, ChevronUp } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UserCardProps {
  name: string
  avatar: string
  bio: string
  profession: string
  company: string
  school: string
  experience: number
  sharedInterests: Array<{ type: "academic" | "industry" | "skill"; name: string }>
  connectionType: "b2b" | "collaboration" | "mentorship" | "investment"
}

const badgeColors = {
  academic: "bg-blue-100 text-blue-800",
  industry: "bg-green-100 text-green-800",
  skill: "bg-purple-100 text-purple-800",
}

export default function UserCard({
  name,
  avatar,
  bio,
  profession,
  company,
  school,
  experience,
  sharedInterests,
  connectionType,
}: UserCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex items-center justify-between">
        <Image src={avatar || "/placeholder.svg"} alt={name} width={100} height={100} className="rounded-full" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? "Hide Details" : "Show Details"}
            </DropdownMenuItem>
            <DropdownMenuItem>Report User</DropdownMenuItem>
            <DropdownMenuItem>Block User</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="text-center">
        <h3 className="text-xl font-bold mb-2">{name}</h3>
        <p className="text-sm text-muted-foreground mb-2">
          {profession} at {company}
        </p>
        <p className="text-sm text-muted-foreground mb-4">{experience} years of experience</p>

        {showDetails ? (
          <div className="text-left">
            <h4 className="font-semibold mb-2">Background</h4>
            <p className="text-sm mb-2">Education: {school}</p>
            <p className="text-sm mb-4">{bio}</p>
            <h4 className="font-semibold mb-2">Seeking</h4>
            <p className="text-sm mb-4">{getConnectionPurpose(connectionType)}</p>
          </div>
        ) : (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Shared Interests</h4>
            <div className="flex flex-wrap justify-center gap-2">
              {sharedInterests.map((interest) => (
                <Badge key={interest.name} variant="secondary" className={badgeColors[interest.type]}>
                  {interest.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button variant="outline" onClick={() => setShowDetails(!showDetails)} className="mt-4">
          {showDetails ? "Hide Details" : "Show Details"}
          {showDetails ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
      </CardContent>
    </Card>
  )
}

function getConnectionPurpose(type: "b2b" | "collaboration" | "mentorship" | "investment") {
  switch (type) {
    case "b2b":
      return "Explore business partnership opportunities"
    case "collaboration":
      return "Find potential collaborators for projects"
    case "mentorship":
      return "Offer guidance and share industry insights"
    case "investment":
      return "Discuss potential investment opportunities"
    default:
      return "Connect with industry professionals"
  }
}

