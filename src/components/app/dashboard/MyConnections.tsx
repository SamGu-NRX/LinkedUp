"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
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
import { profiles } from "./chat/chat-app";

interface Profile {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "away" | "offline";
  lastCallDate: string;
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

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: number;
}


const initialMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "1",
      content: "Hey! How are you?",
      senderId: "1",
      timestamp: Date.now() - 3000,
    },
    {
      id: "2",
      content: "I am good, thanks!",
      senderId: "user",
      timestamp: Date.now() - 2000,
    },
  ],
  "2": [
    {
      id: "3",
      content: "Did you see the latest update?",
      senderId: "2",
      timestamp: Date.now() - 1000,
    },
  ],
  "3": [
    {
      id: "4",
      content: "Meeting at 3pm tomorrow?",
      senderId: "3",
      timestamp: Date.now(),
    },
  ],
  "4": [],
};

// Generate random gradient colors for avatars
const generateAvatarColor = (id: string | number) => {
  // Set of vibrant gradient combinations
  const gradients = [
    { from: "from-violet-500", to: "to-purple-700", text: "text-violet-50" },
    { from: "from-blue-500", to: "to-indigo-600", text: "text-blue-50" },
    { from: "from-emerald-400", to: "to-teal-600", text: "text-emerald-50" },
    { from: "from-rose-400", to: "to-pink-600", text: "text-rose-50" },
    { from: "from-amber-400", to: "to-orange-600", text: "text-amber-50" },
    { from: "from-cyan-400", to: "to-blue-600", text: "text-cyan-50" },
    { from: "from-red-500", to: "to-pink-500", text: "text-red-50" },
    { from: "from-green-400", to: "to-emerald-600", text: "text-green-50" },
    { from: "from-fuchsia-500", to: "to-purple-600", text: "text-fuchsia-50" },
    { from: "from-yellow-400", to: "to-amber-600", text: "text-yellow-50" },
  ];

  // Use the id to deterministically select a gradient (makes it consistent for each user)
  const hash = typeof id === 'number' ? id : (parseInt(String(id)) || String(id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0));
  return gradients[hash % gradients.length];
};

// Define the type for avatar color
interface AvatarColor {
  from: string;
  to: string;
  text: string;
}

// Build avatar colors mapping for each profile
const avatarColors = profiles.reduce<Record<string, AvatarColor>>((acc, profile) => {
  acc[profile.id] = generateAvatarColor(profile.id);
  return acc;
}, {});

interface ProfileListProps {
  profiles: Profile[];
  activeProfile: Profile;
  unreadCounts: Record<string, number>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveProfile: (profile: Profile) => void;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  getStatusColor: (status: Profile["status"]) => string;
  getInitials: (name: string) => string;
}

const ProfileList: React.FC<ProfileListProps> = ({
  profiles,
  activeProfile,
  unreadCounts,
  sidebarCollapsed,
  setSidebarCollapsed,
  setActiveProfile,
  setUnreadCounts,
  getStatusColor,
  getInitials,
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
      <div className="p-4 border-b dark:border-zinc-800 flex items-center justify-between">
        {!sidebarCollapsed && <h3 className="font-medium">Connections</h3>}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div
        className="py-3 px-2 space-y-1 overflow-y-auto"
        style={{ maxHeight: "calc(600px - 60px)" }}
      >
        {sortedProfiles.map((profile) => (
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
                      className={`bg-gradient-to-br ${
                        generateAvatarColor(profile.id).from
                      } ${generateAvatarColor(profile.id).to} h-9 w-9`}
                    >
                      <AvatarFallback
                        className={generateAvatarColor(profile.id).text}
                      >
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ${getStatusColor(
                        profile.status
                      )} border-2 border-white dark:border-zinc-900`}
                    />
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex flex-col items-start truncate overflow-hidden">
                      <span className="font-medium text-sm">{profile.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {profile.profession}
                      </span>
                    </div>
                  )}

                  {unreadCounts[profile.id] > 0 && (
                    <Badge variant="destructive" className={sidebarCollapsed ? "absolute top-0 right-0 -mt-1 -mr-1" : "ml-auto"}>
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
        ))}
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
  setUnreadCounts: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  handleSend: () => void;
  getStatusColor: (status: Profile["status"]) => string;
  getInitials: (name: string) => string;
  formatTime: (timestamp: number) => string;
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
  getStatusColor,
  getInitials,
  formatTime,
}) => {
  return (
    <Card className="flex flex-col h-[600px] flex-1 overflow-hidden shadow-lg">
      {/* Chat Header */}
      <div className="border-b p-3 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="rounded-full p-0 h-10 w-10"
            onClick={() => setShowUserProfile(true)}
          >
            <Avatar
              className={`bg-gradient-to-br ${
                generateAvatarColor(activeProfile.id).from
              } ${generateAvatarColor(activeProfile.id).to} h-10 w-10`}
            >
              <AvatarFallback className={generateAvatarColor(activeProfile.id).text}>
                {getInitials(activeProfile.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{activeProfile.name}</h3>
              <div
                className={`h-2 w-2 rounded-full ${getStatusColor(
                  activeProfile.status
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
                  className="rounded-full text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
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
                  className="rounded-full text-blue-600 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950"
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
                  className="rounded-full text-purple-600 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/50">
        <AnimatePresence mode="popLayout">
          {(messages[activeProfile.id] || []).map((message, index) => {
            const isUser = message.senderId === "user";
            const showAvatar =
              index === 0 ||
              messages[activeProfile.id][index - 1]?.senderId !==
                message.senderId;

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
                  <Avatar
                    className={`bg-gradient-to-br ${
                      generateAvatarColor(message.senderId).from
                    } ${generateAvatarColor(message.senderId).to} h-8 w-8`}
                  >
                    <AvatarFallback
                      className={generateAvatarColor(message.senderId).text}
                    >
                      {getInitials(activeProfile.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : !isUser ? (
                  <div className="w-8" />
                ) : null}

                <div className="flex flex-col max-w-[65%]">
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-2xl px-4 py-2 ${
                      isUser
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-zinc-800 dark:border-zinc-700 shadow-sm"
                    }`}
                  >
                    {message.content}
                  </motion.div>
                  <div
                    className={`text-xs text-zinc-500 mt-1 ${
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
        <div className="flex gap-2 items-center">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-full border-zinc-200 bg-zinc-100/70 dark:bg-zinc-800 dark:border-zinc-700 focus-visible:ring-blue-500"
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
  const [activeProfile, setActiveProfile] = useState(profiles[0]);
  const [messages, setMessages] = useState(initialMessages);
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
    const interval = setInterval(() => {
      const randomProfileId =
        profiles[Math.floor(Math.random() * profiles.length)].id;
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

    // Simulate response
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

  const getStatusColor = (status: Profile["status"]) => {
    switch (status) {
      case "online":
        return "bg-emerald-500";
      case "away":
        return "bg-amber-400";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl p-4 flex gap-4">
      {/* Collapsible Sidebar */}
      <ProfileList
        profiles={profiles}
        activeProfile={activeProfile}
        unreadCounts={unreadCounts}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        setActiveProfile={setActiveProfile}
        setUnreadCounts={setUnreadCounts}
        getStatusColor={getStatusColor}
        getInitials={getInitials}
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
        getStatusColor={getStatusColor}
        getInitials={getInitials}
        formatTime={formatTime}
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
            <DialogTitle>`{activeProfile.name}{`'s Profile`}</DialogTitle>
          </DialogHeader>
          <UserCard {...activeProfile} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModernChatApp;
