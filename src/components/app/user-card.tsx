"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Settings,
  MessageCircle,
  Calendar,
  Clock,
  Star,
  Users,
  ChevronDown,
  Briefcase,
  GraduationCap,
  Award,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateAvatarColor, getInitials } from "@/data/avatar-utils";
import { cn } from "@/lib/utils";

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

const badgeVariants = {
  academic: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    icon: <GraduationCap className="mr-1 h-3 w-3 opacity-70" />,
  },
  industry: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: <Briefcase className="mr-1 h-3 w-3 opacity-70" />,
  },
  skill: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
    icon: <Award className="mr-1 h-3 w-3 opacity-70" />,
  },
};

const connectionTypeInfo = {
  b2b: {
    label: "Business Partnership",
    description: "Seeking B2B opportunities and professional connections",
    color: "from-sky-500 to-indigo-500",
  },
  collaboration: {
    label: "Collaboration",
    description: "Open to project collaborations and teamwork",
    color: "from-amber-500 to-orange-500",
  },
  mentorship: {
    label: "Mentorship",
    description: "Available for mentoring or seeking guidance",
    color: "from-emerald-500 to-teal-500",
  },
  investment: {
    label: "Investment",
    description: "Interested in investment opportunities",
    color: "from-fuchsia-500 to-purple-500",
  },
};

const UserCard = ({
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
}: UserCardProps) => {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true });
  const avatarColors = generateAvatarColor(avatar);
  const shouldShowGradient = !avatar || isBot;

  // Generate a uniqueId for this user based on their name (normally you would use a real id)
  const uniqueId = name.toLowerCase().replace(/\s+/g, "-");

  const toggleDetails = () => {
    setDetailsVisible((prev) => !prev);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  const detailsVariants = {
    hidden: {
      height: 0,
      opacity: 0,
    },
    visible: {
      height: "auto",
      opacity: 1,
      transition: {
        height: {
          duration: 0.3,
          ease: "easeInOut",
        },
        opacity: {
          duration: 0.3,
          delay: 0.1,
        },
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      transition: {
        height: {
          duration: 0.3,
          ease: "easeInOut",
        },
        opacity: {
          duration: 0.2,
        },
      },
    },
  };

  // Add a pulse animation for the speaking indicator
  const speakingPulse = {
    inactive: {
      scale: 1,
      opacity: 0.2,
    },
    active: {
      scale: [1, 1.1, 1],
      opacity: [0.2, 0.8, 0.2],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "w-full overflow-hidden",
        "bg-white dark:bg-gray-900/90",
        "rounded-xl border border-gray-200 dark:border-gray-800",
        "backdrop-blur-sm",
        inMeeting ? "max-w-sm shadow-sm" : "max-w-md shadow-md",
        "relative",
      )}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={cardVariants}
    >
      {/* Connection type indicator pill */}
      <div className="absolute top-6 -right-8 origin-left rotate-90">
        <div
          className={cn(
            "px-2 py-1 text-[10px] font-medium tracking-wider uppercase",
            "rounded-sm bg-gradient-to-r text-white",
            connectionTypeInfo[connectionType].color,
          )}
        >
          {connectionTypeInfo[connectionType].label}
        </div>
      </div>

      {/* Status indicator - only in meeting mode */}
      {inMeeting && connectionStatus && (
        <div className="absolute top-0 left-0 m-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <span
                  className={cn(
                    "block h-2.5 w-2.5 rounded-full",
                    connectionStatus === "excellent"
                      ? "bg-green-500"
                      : connectionStatus === "good"
                        ? "bg-blue-500"
                        : connectionStatus === "poor"
                          ? "bg-amber-500"
                          : "bg-red-500",
                  )}
                />
                {isSpeaking && (
                  <motion.span
                    className={cn(
                      "absolute -inset-1 rounded-full",
                      connectionStatus === "excellent"
                        ? "bg-green-500"
                        : connectionStatus === "good"
                          ? "bg-blue-500"
                          : connectionStatus === "poor"
                            ? "bg-amber-500"
                            : "bg-red-500",
                    )}
                    variants={speakingPulse}
                    initial="inactive"
                    animate="active"
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="capitalize">{connectionStatus} connection</p>
              {isSpeaking && <p>Currently speaking</p>}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Header with avatar and basic info */}
      <div className="flex items-start p-5 pb-3">
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="relative"
        >
          <Avatar
            className={cn(
              "h-16 w-16 border-2",
              shouldShowGradient
                ? `bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} border-transparent`
                : "border-gray-200 dark:border-gray-700",
              isSpeaking && "ring-primary ring-2 ring-offset-2",
            )}
          >
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback
              className={cn(
                "text-lg font-semibold",
                `bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} border-transparent`,
                avatarColors.text
              )}
            >
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        <div className="ml-4 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">{name}</h3>
              <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <Briefcase className="mr-1 h-3 w-3 opacity-70" />
                {profession} at {company}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>User Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <MessageCircle className="mr-2 h-4 w-4 opacity-70" />
                  Send Message
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
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
          </div>
        </div>
      </div>

      {/* Experience tag */}
      <div className="px-5">
        <div className="mb-3 flex items-center">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            <Clock className="mr-1 h-3 w-3 opacity-70" />
            {experience} years experience
          </span>
        </div>
      </div>

      {/* Meeting stats section - only in meeting mode */}
      {inMeeting && meetingStats && (
        <div className="mb-4 px-5">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
            <h4 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              Meeting History
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
                <Users className="text-primary mb-1 h-4 w-4" />
                <span className="text-sm font-medium">
                  {meetingStats.totalMeetings}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Meetings
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
                <Clock className="text-primary mb-1 h-4 w-4" />
                <span className="text-sm font-medium">
                  {Math.round(meetingStats.totalMinutes / 60)}h
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Total Time
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
                <Star className="text-primary mb-1 h-4 w-4" />
                <span className="text-sm font-medium">
                  {meetingStats.averageRating}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Avg Rating
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared interests section */}
      <div className="mb-4 px-5">
        <h4 className="mb-2 text-sm font-medium">
          {inMeeting && interests.length > 0 ? "Interests" : "Shared Interests"}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {inMeeting && interests.length > 0
            ? interests.map((interest) => (
                <motion.div
                  key={interest}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Badge
                    variant="outline"
                    className="bg-gray-50 text-gray-700 transition-colors duration-150 hover:bg-gray-100 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {interest}
                  </Badge>
                </motion.div>
              ))
            : sharedInterests.map((interest) => {
                const variant = badgeVariants[interest.type];
                return (
                  <motion.div
                    key={interest.name}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Badge
                      className={cn(
                        "border font-normal",
                        variant.bg,
                        variant.text,
                        variant.border,
                      )}
                    >
                      {variant.icon}
                      {interest.name}
                    </Badge>
                  </motion.div>
                );
              })}
        </div>
      </div>

      {/* Expandable details section */}
      <div className="px-5 pb-5">
        <AnimatePresence>
          {detailsVisible && (
            <motion.div
              key={`details-${uniqueId}`}
              variants={detailsVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="overflow-hidden"
            >
              <div className="space-y-4 py-4">
                {/* Education info */}
                <div>
                  <h4 className="mb-1.5 flex items-center text-sm font-medium">
                    <GraduationCap className="text-primary mr-1.5 h-4 w-4" />
                    Education
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {school}
                  </p>
                </div>

                {/* Bio info */}
                <div>
                  <h4 className="mb-1.5 flex items-center text-sm font-medium">
                    <Award className="text-primary mr-1.5 h-4 w-4" />
                    About
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {bio}
                  </p>
                </div>

                {/* Connection purpose */}
                <div>
                  <h4 className="mb-1.5 flex items-center text-sm font-medium">
                    <ExternalLink className="text-primary mr-1.5 h-4 w-4" />
                    Seeking
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {connectionTypeInfo[connectionType].description}
                  </p>
                </div>

                {/* Contact buttons */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    Message
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Calendar className="mr-1.5 h-4 w-4" />
                    Schedule
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            variant="ghost"
            onClick={toggleDetails}
            className="w-full border border-gray-100 bg-gray-50 transition-colors duration-200 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:bg-gray-800"
          >
            <span className="flex-1 text-sm">
              {detailsVisible ? "Hide Details" : "View Details"}
            </span>
            <motion.div
              animate={{ rotate: detailsVisible ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="h-4 w-4 opacity-70" />
            </motion.div>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default UserCard;
