"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateAvatarColor, getInitials } from "@/data/avatar-utils";

interface UserCardProps {
  name: string;
  avatar: string;
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
}: UserCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const avatarColors = generateAvatarColor(avatar);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex items-center justify-between">
        <Avatar
          className={`bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} h-20 w-20`}
        >
          <AvatarFallback
            className={`bg-transparent ${avatarColors.text} font-semibold text-2xl`}
          >
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
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
        <h3 className="mb-2 text-xl font-bold">{name}</h3>
        <p className="text-muted-foreground mb-2 text-sm">
          {profession} at {company}
        </p>
        <p className="text-muted-foreground mb-4 text-sm">
          {experience} years of experience
        </p>

        {showDetails ? (
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
          <div className="mb-4">
            <h4 className="mb-2 font-semibold">Shared Interests</h4>
            <div className="flex flex-wrap justify-center gap-2">
              {sharedInterests.map((interest) => (
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
          className="mt-4"
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
