// @/components/app/user-card/index.tsx
"use client";

import type React from "react";
import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UserInfo } from "@/types/user"; // Use the central type
import { ConnectionStatusIndicator } from "@/components/app/user-card/connection-status";
import { UserCardHeader } from "@/components/app/user-card/user-card-header";
import { UserCardTags } from "@/components/app/user-card/user-card-tags";
import { UserCardStats } from "@/components/app/user-card/user-card-stats";
import { UserCardInterests } from "@/components/app/user-card/user-card-interests";
import { UserCardDetails } from "@/components/app/user-card/user-card-details";

// Define props using the central UserInfo type
export interface UserCardProps {
  user: UserInfo; // Use the imported UserInfo type
  inMeeting?: boolean;
  inChat?: boolean;
  onMessage?: (message: string) => void; // Consider more specific types if needed
  onSchedule?: (date: Date, duration: number, topic: string) => void; // Consider more specific types
  className?: string;
  forceVisible?: boolean; // Prop to override inView animation for modals
}

export function UserCard({
  user,
  inMeeting = false,
  inChat = false,
  onMessage = () => {},
  onSchedule = () => {},
  className,
  forceVisible = false, // Default to false
}: UserCardProps) {
  // Early return if user data is somehow missing (though TS should help prevent this)
  if (!user) {
    console.warn("UserCard rendered without user data.");
    return null;
  }

  const cardRef = useRef<HTMLDivElement>(null);
  // Respect forceVisible prop for modals or specific use cases
  const isInView = useInView(cardRef, { once: true });
  const isVisible = forceVisible || isInView;

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
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

  // Determine background/border based on context
  const cardClasses = cn(
    "w-full overflow-hidden rounded-xl border relative",
    inChat
      ? "max-w-full border-gray-100 bg-white/90 shadow-sm dark:border-gray-800 dark:bg-gray-900/90"
      : inMeeting
        ? "max-w-sm border-gray-200 bg-white/95 shadow-md dark:border-gray-800 dark:bg-gray-900/95"
        : "max-w-md border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900", // Default style
    className,
  );

  return (
    <TooltipProvider>
      <motion.div
        ref={cardRef}
        className={cardClasses}
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={cardVariants}
        onMouseMove={handleMouseMove}
        style={{
          // Apply subtle background effect only when not forced visible (e.g., not in modal)
          backgroundImage: !forceVisible
            ? `radial-gradient(
              circle at ${mousePosition.x}px ${mousePosition.y}px,
              rgba(255, 255, 255, 0.08) 0%,
              rgba(255, 255, 255, 0) 50%
            )`
            : undefined, // No effect when forced visible
        }}
      >
        {/* Status indicator - only in meeting mode and if status exists */}
        {inMeeting && user.connectionStatus && (
          <ConnectionStatusIndicator
            status={user.connectionStatus}
            isSpeaking={user.isSpeaking}
            className="absolute top-0 left-0 z-10 m-3"
          />
        )}

        {/* Header */}
        <UserCardHeader
          user={user}
          inChat={inChat}
          isSpeaking={inMeeting && user.isSpeaking}
          onMessage={onMessage}
          onSchedule={onSchedule}
        />

        {/* Tags */}
        <UserCardTags
          // Pass only necessary, non-optional props if possible
          connectionType={user.connectionType} // connectionType is required in UserInfo
          experience={user.experience} // experience is required
          inChat={inChat}
        />

        {/* Meeting stats - only in meeting mode and if stats exist */}
        {inMeeting && user.meetingStats && (
          <UserCardStats stats={user.meetingStats} inChat={inChat} />
        )}

        {/* Interests */}
        <UserCardInterests
          // Pass optional props carefully
          sharedInterests={user.sharedInterests} // required
          interests={user.interests} // optional
          inMeeting={inMeeting}
          inChat={inChat}
        />

        {/* Details */}
        <UserCardDetails
          bio={user.bio} // required
          school={user.school} // required
          connectionType={user.connectionType} // required
          inChat={inChat}
          onMessage={onMessage}
          onSchedule={onSchedule}
          forceOpen={forceVisible} // Pass forceVisible to potentially keep details open in modal
        />
      </motion.div>
    </TooltipProvider>
  );
}

export default UserCard;
