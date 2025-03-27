"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Settings,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateAvatarColor, getInitials } from "@/data/avatar-utils";
import type { User } from "@/types/meeting";

// Integrated props interface with meeting data as optional
interface UserCardProps {
  name: string;
  avatar: string | null;
  bio: string;
  profession: string;
  company: string;
  school: string;
  experience: number;
  sharedInterests: Array<{
    type: "academic" | "industry" | "skill";
    name: string;
  }>;
  connectionType: "b2b" | "collaboration" | "mentorship" | "investment";
  isBot?: boolean;

  // Meeting-specific properties (optional)
  inMeeting?: boolean;
  meetingStats?: {
    totalMeetings: number;
    totalMinutes: number;
    averageRating: number;
  };
  interests?: string[];
  connectionStatus?: "excellent" | "good" | "poor" | "offline";
  isSpeaking?: boolean;
}

const badgeColors = {
  academic: "bg-blue-100 text-blue-800",
  industry: "bg-green-100 text-green-800",
  skill: "bg-purple-100 text-purple-800",
};

const getConnectionPurpose = (
  connectionType: UserCardProps["connectionType"],
) => {
  switch (connectionType) {
    case "b2b":
      return "Business-to-Business Opportunities";
    case "collaboration":
      return "Project Collaboration";
    case "mentorship":
      return "Mentorship";
    case "investment":
      return "Investment Opportunities";
    default:
      return "Networking";
  }
};

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
  isBot = false,
  inMeeting = false,
  meetingStats,
  interests = [],
  connectionStatus,
  isSpeaking = false,
}: UserCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const avatarColors = generateAvatarColor(avatar || name);
  const shouldShowGradient = !avatar || isBot;

  return (
    <Card
      className={`w-full ${inMeeting ? "bg-card/90 border shadow-lg" : "max-w-md"}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Avatar
            className={`${shouldShowGradient ? `bg-gradient-to-br ${avatarColors.from} ${avatarColors.to}` : ""} ${inMeeting ? `h-12 w-12 ${isSpeaking ? "ring-primary animate-pulse ring-2" : ""}` : "h-16 w-16"}`}
          >
            {avatar && !isBot ? (
              <AvatarImage src={avatar} alt={name} />
            ) : (
              <AvatarFallback
                className={`bg-transparent ${avatarColors.text} font-semibold`}
              >
                {getInitials(name)}
              </AvatarFallback>
            )}
          </Avatar>

          <div>
            <h3
              className={`font-medium ${inMeeting ? "text-base" : "text-lg"}`}
            >
              {name}
            </h3>
            <p className="text-muted-foreground text-sm">
              {profession} at {company}
            </p>

            {/* Connection status indicator - only shown in meetings */}
            {inMeeting && connectionStatus && (
              <div className="mt-1 flex items-center">
                <span
                  className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                    connectionStatus === "excellent"
                      ? "bg-green-500"
                      : connectionStatus === "good"
                        ? "bg-blue-500"
                        : connectionStatus === "poor"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                  }`}
                />
                <span className="text-muted-foreground text-xs capitalize">
                  {connectionStatus} connection
                </span>
              </div>
            )}
          </div>
        </div>

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

      <CardContent>
        {/* Experience info - always show if not in a meeting */}
        {!inMeeting && (
          <p className="text-muted-foreground mb-4 text-sm">
            {experience} years of experience
          </p>
        )}

        {/* Meeting stats - only shown when in a meeting */}
        {inMeeting && meetingStats && (
          <div className="bg-muted/30 mb-4 rounded-md p-2">
            <p className="text-muted-foreground mb-1 text-xs">Meeting Stats</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center space-x-1.5">
                <Users className="text-primary/80 h-3.5 w-3.5" />
                <span className="text-sm">{meetingStats.totalMeetings}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock className="text-primary/80 h-3.5 w-3.5" />
                <span className="text-sm">
                  {Math.round(meetingStats.totalMinutes / 60)}h
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Star className="text-primary/80 h-3.5 w-3.5" />
                <span className="text-sm">{meetingStats.averageRating}</span>
              </div>
            </div>
          </div>
        )}

        {showDetails ? (
          // Detailed info section
          <div className="text-left">
            <h4 className="mb-2 font-semibold">Background</h4>
            <p className="mb-2 text-sm">Education: {school}</p>
            <p className="mb-4 text-sm">{bio}</p>
            <h4 className="mb-2 font-semibold">Seeking</h4>
            <p className="mb-4 text-sm">
              {getConnectionPurpose(connectionType)}
            </p>
          </div>
        ) : (
          // Shared interests section
          <div className="mb-4">
            <h4 className="mb-2 font-semibold">
              {inMeeting && interests.length > 0
                ? "Interests"
                : "Shared Interests"}
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {inMeeting && interests.length > 0
                ? interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      className="bg-primary/10"
                    >
                      {interest}
                    </Badge>
                  ))
                : sharedInterests.map((interest) => (
                    <Badge
                      key={interest.name}
                      variant="secondary"
                      className={badgeColors[interest.type]}
                    >
                      {interest.name}
                    </Badge>
                  ))}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => setShowDetails(!showDetails)}
          className="mt-2 w-full"
        >
          {showDetails ? "Hide Details" : "Show Details"}
          {showDetails ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
