// @/src/components/app/dashboard/chat/chat-app.tsx
"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Phone, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScheduleCallForm } from "./schedule-call-form"; // Assuming this component exists and works
import UserCard from "@/components/app/user-card"; // Import UserCard
import type { UserInfo, Interest, ConnectionStatus } from "@/types/user"; // Import central types
import {
  generateAvatarDataUrl,
  getStatusColor,
  getAvatar,
} from "@/lib/avatar-utils"; // Import utils

// Define Message type locally or import if defined elsewhere
interface Message {
  id: string;
  content: string;
  senderId: string; // 'user' or UserInfo['id']
  timestamp: number;
}

// Define initial profiles using the UserInfo type
// Ensure all required fields are present and types match
export const profiles: UserInfo[] = [
  {
    id: "1",
    name: "Alice Johnson",
    isBot: true,
    avatar: null, // Will use generated avatar
    bio: "Passionate about AI and machine learning. Seeking collaborators for NLP projects.",
    profession: "Data Scientist",
    company: "TechCorp",
    school: "MIT",
    experience: 5,
    sharedInterests: [
      { type: "academic", name: "Machine Learning" },
      { type: "industry", name: "AI Ethics" },
      { type: "skill", name: "Python" },
    ],
    connectionType: "collaboration",
    interests: ["NLP", "Deep Learning", "AI Ethics"],
    connectionStatus: "online",
    isSpeaking: false,
    meetingStats: undefined, // Or provide default stats if applicable
  },
  {
    id: "2",
    name: "Bob Smith",
    isBot: true,
    avatar: null,
    bio: "Experienced software engineer focused on scalable web solutions.",
    profession: "Senior Software Engineer",
    company: "WebSolutions Inc.",
    school: "Stanford University",
    experience: 8,
    sharedInterests: [
      { type: "academic", name: "Web Development" },
      { type: "industry", name: "E-commerce" },
      { type: "skill", name: "JavaScript" },
    ],
    connectionType: "mentorship",
    interests: ["React", "Node.js", "AWS", "Microservices"],
    connectionStatus: "away",
    isSpeaking: false,
    meetingStats: undefined,
  },
  {
    id: "3",
    name: "Charlie Brown",
    isBot: true,
    avatar: null,
    bio: "Entrepreneur and startup enthusiast. Looking for B2B partnerships.",
    profession: "Founder & CEO",
    company: "InnovateTech",
    school: "Harvard Business School",
    experience: 10,
    sharedInterests: [
      { type: "academic", name: "Entrepreneurship" },
      { type: "industry", name: "SaaS" },
      { type: "skill", name: "Business Strategy" },
    ],
    connectionType: "b2b",
    interests: ["Startups", "Venture Capital", "Growth Hacking"],
    connectionStatus: "offline",
    isSpeaking: false,
    meetingStats: undefined,
  },
  {
    id: "4",
    name: "Diana Prince",
    isBot: true,
    avatar: null,
    bio: "UX/UI designer creating intuitive and beautiful user experiences.",
    profession: "Lead UX Designer",
    company: "DesignMasters",
    school: "Rhode Island School of Design",
    experience: 7,
    sharedInterests: [
      { type: "academic", name: "User Experience" },
      { type: "industry", name: "Product Design" },
      { type: "skill", name: "Figma" },
    ],
    connectionType: "collaboration",
    interests: ["Design Systems", "Accessibility", "User Research"],
    connectionStatus: "online",
    isSpeaking: false,
    meetingStats: undefined,
  },
];

// Initial messages structure
const initialMessages: Record<UserInfo["id"], Message[]> = {
  "1": [
    {
      id: "msg1",
      content: "Hey! Interested in discussing potential AI collaborations?",
      senderId: "1",
      timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
    },
    {
      id: "msg2",
      content: "Hi Alice, definitely! What did you have in mind?",
      senderId: "user", // Assuming 'user' is the ID for the current user
      timestamp: Date.now() - 4 * 60 * 1000,
    },
  ],
  "2": [
    {
      id: "msg3",
      content: "Could you mentor me on scaling Node.js applications?",
      senderId: "user",
      timestamp: Date.now() - 10 * 60 * 1000,
    },
    {
      id: "msg4",
      content: "Sure, let's schedule a call to discuss.",
      senderId: "2",
      timestamp: Date.now() - 9 * 60 * 1000,
    },
  ],
  "3": [
    {
      id: "msg5",
      content: "Meeting at 3pm tomorrow?",
      senderId: "3",
      timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    },
  ],
  "4": [], // No messages initially for Diana
};

const ModernChatApp: React.FC = () => {
  // State with explicit UserInfo type
  const [activeProfile, setActiveProfile] = useState<UserInfo>(profiles[0] as UserInfo);
  const [messages, setMessages] =
    useState<Record<UserInfo["id"], Message[]>>(initialMessages);
  const [newMessage, setNewMessage] = useState<string>("");
  const [showProfiles, setShowProfiles] = useState<boolean>(false);
  const [showScheduleCall, setShowScheduleCall] = useState<boolean>(false);
  const [showUserProfile, setShowUserProfile] = useState<boolean>(false);
  const [unreadCounts, setUnreadCounts] = useState<
    Record<UserInfo["id"], number>
  >({});

  // Simulate incoming messages for unread counts (example)
  useEffect(() => {
    const interval = setInterval(() => {
      const randomProfileIndex = Math.floor(Math.random() * profiles.length);
      const randomProfileId = profiles[randomProfileIndex].id;

      // Only increment if the message is not for the currently active chat
      if (randomProfileId !== activeProfile.id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [randomProfileId]: (prev[randomProfileId] || 0) + 1,
        }));
      }
    }, 30000); // Simulate every 30 seconds

    return () => clearInterval(interval);
  }, [activeProfile.id]); // Depend only on activeProfile.id

  const handleSend = () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}`, // More unique ID
      content: trimmedMessage,
      senderId: "user", // Replace 'user' with actual user ID if available
      timestamp: Date.now(),
    };

    // Update messages for the active profile
    setMessages((prev) => {
      const currentMessages = prev[activeProfile.id] || [];
      return {
        ...prev,
        [activeProfile.id]: [...currentMessages, newMsg],
      };
    });
    setNewMessage("");

    // Simulate bot response (if the active profile is a bot)
    if (activeProfile.isBot) {
      setTimeout(() => {
        const responses = [
          "That's insightful!",
          "Interesting point. Could you elaborate?",
          "I agree. How can we take this forward?",
          "Let me process that. One moment.",
          "Understood. What's the next step?",
          "Thanks for sharing!",
        ];

        const responseMsg: Message = {
          id: `msg-${Date.now() + 1}`, // Ensure unique ID
          content: responses[Math.floor(Math.random() * responses.length)],
          senderId: activeProfile.id,
          timestamp: Date.now(),
        };

        setMessages((prev) => {
          const currentMessages = prev[activeProfile.id] || [];
          return {
            ...prev,
            [activeProfile.id]: [...currentMessages, responseMsg],
          };
        });
      }, 1200); // Slightly longer delay
    }
  };

  // Sort profiles by unread count (descending)
  const sortedProfiles = [...profiles].sort((a, b) => {
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;
    return bUnread - aUnread;
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <Card className="flex h-[600px] w-full overflow-hidden">
        {/* Profiles Sidebar */}
        <motion.div
          className="flex-shrink-0 border-r bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
          initial={false}
          animate={{ width: showProfiles ? 256 : 72 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon" // Use size="icon" for better spacing
              className="p-2"
              onClick={() => setShowProfiles(!showProfiles)}
              aria-label={
                showProfiles ? "Collapse profiles" : "Expand profiles"
              }
            >
              <Users className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-2">
            {sortedProfiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                layout // Add layout animation for smoother sorting/updates
              >
                <Button
                  variant={
                    activeProfile.id === profile.id ? "secondary" : "ghost" // Use secondary for active
                  }
                  className="relative h-auto w-full justify-start gap-2 overflow-hidden px-2 py-2 text-left" // Adjust padding
                  onClick={() => {
                    setActiveProfile(profile);
                    // Clear unread count for the selected profile
                    setUnreadCounts((prev) => ({ ...prev, [profile.id]: 0 }));
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <Image
                      // Use getAvatar utility
                      src={getAvatar(profile)}
                      alt={`${profile.name}'s avatar`}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                    {/* Use getStatusColor utility */}
                    <div
                      className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${getStatusColor(profile.connectionStatus)}`}
                      title={`Status: ${profile.connectionStatus || "unknown"}`} // Add title for accessibility
                    ></div>
                  </div>
                  <AnimatePresence>
                    {showProfiles && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex min-w-0 flex-1 flex-col items-start" // Allow shrinking
                      >
                        <span className="truncate font-medium">
                          {profile.name}
                        </span>
                        <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {/* Display profession or status */}
                          {profile.profession}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {unreadCounts[profile.id] > 0 && (
                    <Badge
                      variant="destructive"
                      className={`ml-auto flex-shrink-0 ${showProfiles ? "" : "absolute top-1 right-1 h-4 w-4 justify-center p-0 text-xs"}`} // Adjust badge position when collapsed
                    >
                      {showProfiles ? unreadCounts[profile.id] : ""}
                    </Badge>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col bg-white dark:bg-gray-950">
          {/* Chat Header */}
          <div className="flex-shrink-0 border-b p-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {" "}
                {/* Increased gap */}
                <Button
                  variant="ghost"
                  className="h-auto flex-shrink-0 rounded-full p-0" // Make button round
                  onClick={() => setShowUserProfile(true)}
                  aria-label={`View ${activeProfile.name}'s profile`}
                >
                  <Image
                    // Use getAvatar utility
                    src={getAvatar(activeProfile)}
                    alt={`${activeProfile.name}'s avatar`}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                </Button>
                <div className="min-w-0 flex-1">
                  {" "}
                  {/* Allow text to truncate */}
                  <h3
                    className="truncate font-medium"
                    onClick={() => setShowUserProfile(true)} // Allow clicking name too
                    style={{ cursor: "pointer" }}
                  >
                    {activeProfile.name}
                  </h3>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {/* Display connection status */}
                    {activeProfile.connectionStatus || "unknown"}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/30"
                  disabled={activeProfile.connectionStatus !== "online"} // Disable based on status
                  aria-label={`Call ${activeProfile.name}`}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  onClick={() => setShowScheduleCall(true)}
                  aria-label={`Schedule call with ${activeProfile.name}`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <AnimatePresence mode="popLayout">
              {(messages[activeProfile.id] || []).map((message) => (
                <motion.div
                  key={message.id}
                  layout // Enable layout animation for message list
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 150 }}
                  className={`flex ${message.senderId === "user" ? "justify-end" : "justify-start"}`}
                >
                  <motion.div
                    whileHover={{ scale: 1.01 }} // Subtle hover effect
                    className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                      message.senderId === "user"
                        ? "rounded-br-none bg-blue-600 text-white" // Slightly darker blue
                        : "rounded-bl-none bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                    }`}
                  >
                    {message.content}
                    {/* Optional: Add timestamp */}
                    {/* <span className="mt-1 block text-right text-xs opacity-70">
                      {formatTime(message.timestamp)}
                    </span> */}
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 border-t p-4 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewMessage(e.target.value)
                }
                placeholder="Type your message..."
                className="flex-1"
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    // Send on Enter, allow Shift+Enter for newline
                    e.preventDefault(); // Prevent default newline on Enter
                    handleSend();
                  }
                }}
                aria-label="Chat message input"
              />
              <Button
                onClick={handleSend}
                size="icon"
                disabled={!newMessage.trim()} // Disable if input is empty
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule Call Modal */}
      <Dialog open={showScheduleCall} onOpenChange={setShowScheduleCall}>
        <DialogContent className="sm:max-w-md">
          {" "}
          {/* Adjusted size */}
          <DialogHeader>
            <DialogTitle>Schedule a Call with {activeProfile.name}</DialogTitle>
            <DialogDescription>
              Choose a date and time for your call. Availability based on mutual
              calendar (mock).
            </DialogDescription>
          </DialogHeader>
          {/* Ensure ScheduleCallForm receives necessary props and handles closing */}
          <ScheduleCallForm
            userName={activeProfile.name}
            onSchedule={() => setShowScheduleCall(false)}
          />
        </DialogContent>
      </Dialog>

      {/* User Profile Modal */}
      <Dialog open={showUserProfile} onOpenChange={setShowUserProfile}>
        <DialogContent
          className="max-w-md bg-white p-0 dark:bg-gray-900"
          aria-describedby="user-profile-dialog-description"
        >
          {/* --- Add this conditional check --- */}
          {activeProfile ? (
            <UserCard user={activeProfile} forceVisible={true} inChat={true} />
          ) : (
            // Optional: Show a loading state or placeholder if activeProfile is somehow null/undefined
            // This part should ideally never be reached if initialization is correct,
            // but it prevents the warning and potential errors.
            <div className="flex h-96 items-center justify-center p-4">
              <p className="text-gray-500">Loading profile...</p>
            </div>
          )}
          {/* ------------------------------------ */}
        </DialogContent>
        {/* Hidden description for aria-describedby */}
        <DialogDescription
          id="user-profile-dialog-description"
          className="sr-only"
        >
          {/* Dynamically update description text if activeProfile might be null */}
          {activeProfile
            ? `Detailed profile information for ${activeProfile.name}.`
            : "Loading profile information."}
        </DialogDescription>
      </Dialog>
    </div>
  );
};

export default ModernChatApp;
