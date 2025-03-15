"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Users,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Info,
  Menu,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScheduleCallForm } from "./chat/schedule-call-form";
import UserCard from "./chat/user-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import types and utilities from our new files
import { Profile, Message } from "@/types/profile";
import { profiles, initialMessages } from "@/data/profiles";
import {
  generateAvatarColor,
  getInitials,
  formatTime,
  getStatusColor,
} from "@/data/avatar-utils"; // URGENT TODO: Change this to a better path

interface ProfileListProps {
  profiles: Profile[];
  activeProfile: Profile;
  unreadCounts: Record<string, number>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveProfile: (profile: Profile) => void;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

const ProfileList: React.FC<ProfileListProps> = ({
  profiles,
  activeProfile,
  unreadCounts,
  sidebarCollapsed,
  setSidebarCollapsed,
  setActiveProfile,
  setUnreadCounts,
}) => {
  const sortedProfiles = [...profiles].sort((a, b) => {
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;

    // Primary sort by online status
    if (a.status === "online" && b.status !== "online") return -1;
    if (a.status !== "online" && b.status === "online") return 1;

    // Secondary sort by unread messages
    return bUnread - aUnread;
  });

  return (
    <Card
      className={`h-[600px] overflow-hidden shadow-lg transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "w-[80px]" : "w-[280px]"
      }`}
    >
      <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
        {!sidebarCollapsed && <h3 className="font-medium">Connections</h3>}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div
        className="space-y-1 overflow-y-auto px-2 py-3"
        style={{ maxHeight: "calc(600px - 60px)" }}
      >
        {sortedProfiles.map((profile) => {
          // Get avatar colors using our utility
          const avatarColors = generateAvatarColor(profile.avatar);

          return (
            <TooltipProvider key={profile.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      activeProfile.id === profile.id ? "secondary" : "ghost"
                    }
                    className={`relative w-full justify-${sidebarCollapsed ? "center" : "start"} gap-2 overflow-hidden transition-all duration-200 ${
                      activeProfile.id === profile.id
                        ? "bg-opacity-90"
                        : "hover:bg-opacity-80"
                    }`}
                    onClick={() => {
                      setActiveProfile(profile);
                      setUnreadCounts((prev) => ({
                        ...prev,
                        [profile.id]: 0,
                      }));
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        className={`bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} h-9 w-9`}
                      >
                        <AvatarFallback
                          className={`bg-transparent ${avatarColors.text} font-semibold`}
                        >
                          {getInitials(profile.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ${getStatusColor(
                          profile.status,
                        )} border-2 border-white dark:border-zinc-900`}
                      />
                    </div>

                    {!sidebarCollapsed && (
                      <div className="flex flex-col items-start truncate overflow-hidden">
                        <span className="text-sm font-medium">
                          {profile.name}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {profile.profession}
                        </span>
                      </div>
                    )}

                    {unreadCounts[profile.id] > 0 && (
                      <Badge
                        variant="destructive"
                        className={
                          sidebarCollapsed
                            ? "absolute top-0 right-0 -mt-1 -mr-1"
                            : "ml-auto"
                        }
                      >
                        {unreadCounts[profile.id]}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div>
                    <p className="font-medium">{profile.name}</p>
                    <p className="text-xs text-zinc-500">
                      {profile.profession}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </Card>
  );
};

interface ChatAppProps {
  activeProfile: Profile;
  messages: Record<string, Message[]>;
  newMessage: string;
  showScheduleCall: boolean;
  showUserProfile: boolean;
  unreadCounts: Record<string, number>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  setActiveProfile: (profile: Profile) => void;
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
  setNewMessage: (message: string) => void;
  setShowScheduleCall: (show: boolean) => void;
  setShowUserProfile: (show: boolean) => void;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleSend: () => void;
}

const ChatArea: React.FC<ChatAppProps> = ({
  activeProfile,
  messages,
  newMessage,
  showScheduleCall,
  showUserProfile,
  unreadCounts,
  messagesEndRef,
  setActiveProfile,
  setMessages,
  setNewMessage,
  setShowScheduleCall,
  setShowUserProfile,
  setUnreadCounts,
  handleSend,
}) => {
  // Get avatar colors for active profile
  const avatarColors = generateAvatarColor(activeProfile.avatar);

  return (
    <Card className="flex h-[600px] flex-1 flex-col overflow-hidden shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b p-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="h-10 w-10 rounded-full p-0"
            onClick={() => setShowUserProfile(true)}
          >
            <Avatar
              className={`bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} h-9 w-9`}
            >
              <AvatarFallback
                className={`bg-transparent ${avatarColors.text} font-semibold`}
              >
                {getInitials(activeProfile.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{activeProfile.name}</h3>
              <div
                className={`h-2 w-2 rounded-full ${getStatusColor(
                  activeProfile.status,
                )}`}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {activeProfile.profession} at {activeProfile.company}
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
                  disabled={activeProfile.status !== "online"}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start a call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                  onClick={() => setShowScheduleCall(true)}
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Schedule a call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950"
                  onClick={() => setShowUserProfile(true)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View profile</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50/50 p-4 dark:bg-zinc-900/50">
        <AnimatePresence mode="popLayout">
          {(messages[activeProfile.id] || []).map((message, index) => {
            const isUser = message.senderId === "user";
            const showAvatar =
              index === 0 ||
              messages[activeProfile.id][index - 1]?.senderId !==
                message.senderId;

            // Get avatar colors for the message sender
            const messageAvatarColors = isUser
              ? {
                  from: "from-blue-500",
                  to: "to-blue-700",
                  text: "text-blue-50",
                }
              : generateAvatarColor(activeProfile.avatar);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`flex items-end gap-2 ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && showAvatar ? (
                  <Button
                    variant="ghost"
                    className="h-10 w-10 rounded-full p-[-0.5]"
                    onClick={() => setShowUserProfile(true)}
                  >
                    <Avatar
                      className={`bg-gradient-to-br ${avatarColors.from} ${avatarColors.to} h-9 w-9`}
                    >
                      <AvatarFallback
                        className={`bg-transparent ${avatarColors.text} font-semibold`}
                      >
                        {getInitials(activeProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                ) : !isUser ? (
                  <div className="w-8" />
                ) : null}

                <div className="flex max-w-[65%] flex-col">
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-2xl px-4 py-2 ${
                      isUser
                        ? "bg-blue-600 text-white"
                        : "bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                    }`}
                  >
                    {message.content}
                  </motion.div>
                  <div
                    className={`mt-1 text-xs text-zinc-500 ${
                      isUser ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-full border-zinc-200 bg-zinc-100/70 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
          />
          <Button
            onClick={handleSend}
            size="icon"
            className="rounded-full bg-blue-600 hover:bg-blue-700"
            disabled={!newMessage.trim()}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};

const ModernChatApp: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<Profile>(profiles[0]);
  const [messages, setMessages] =
    useState<Record<string, Message[]>>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeProfile.id]);

  useEffect(() => {
    // Simulate receiving new messages from random users
    const interval = setInterval(() => {
      const randomProfileId =
        profiles[Math.floor(Math.random() * profiles.length)].id;

      // Don't mark messages as unread for the active chat
      if (randomProfileId !== activeProfile.id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [randomProfileId]: (prev[randomProfileId] || 0) + 1,
        }));
      }
    }, 30000); // Simulate a new message every 30 seconds

    return () => clearInterval(interval);
  }, [activeProfile]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      content: newMessage,
      senderId: "user",
      timestamp: Date.now(),
    };

    setMessages((prev) => ({
      ...prev,
      [activeProfile.id]: [...(prev[activeProfile.id] || []), newMsg],
    }));
    setNewMessage("");

    // Simulate response from the active profile
    setTimeout(() => {
      const responses = [
        "That's interesting!",
        "I see what you mean",
        "Tell me more about that",
        "Sounds good to me",
        "Got it, thanks!",
      ];

      const responseMsg: Message = {
        id: Date.now().toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        senderId: activeProfile.id,
        timestamp: Date.now(),
      };

      setMessages((prev) => ({
        ...prev,
        [activeProfile.id]: [...(prev[activeProfile.id] || []), responseMsg],
      }));
    }, 1000);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-4 p-4">
      {/* Collapsible Sidebar */}
      <ProfileList
        profiles={profiles}
        activeProfile={activeProfile}
        unreadCounts={unreadCounts}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        setActiveProfile={setActiveProfile}
        setUnreadCounts={setUnreadCounts}
      />

      {/* Chat Area */}
      <ChatArea
        activeProfile={activeProfile}
        messages={messages}
        newMessage={newMessage}
        showScheduleCall={showScheduleCall}
        showUserProfile={showUserProfile}
        unreadCounts={unreadCounts}
        messagesEndRef={messagesEndRef}
        setActiveProfile={setActiveProfile}
        setMessages={setMessages}
        setNewMessage={setNewMessage}
        setShowScheduleCall={setShowScheduleCall}
        setShowUserProfile={setShowUserProfile}
        setUnreadCounts={setUnreadCounts}
        handleSend={handleSend}
      />

      {/* Schedule Call Modal */}
      <Dialog open={showScheduleCall} onOpenChange={setShowScheduleCall}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Schedule with {activeProfile.name}</DialogTitle>
            <DialogDescription>
              Select a date and time that works for both of you.
            </DialogDescription>
          </DialogHeader>
          <ScheduleCallForm onSchedule={() => setShowScheduleCall(false)} />
        </DialogContent>
      </Dialog>

      {/* User Profile Modal */}
      <Dialog open={showUserProfile} onOpenChange={setShowUserProfile}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{activeProfile.name}&apos;s Profile</DialogTitle>
          </DialogHeader>
          <UserCard {...activeProfile} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModernChatApp;
