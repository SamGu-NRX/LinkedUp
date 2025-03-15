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
import { ScheduleCallForm } from "./schedule-call-form";
import UserCard from "./user-card";

// Function to generate a random gradient avatar with 80% brightness
const generateGradientAvatar = (seed: string) => {
  // Generate random colors but ensure 80% brightness
  const getHSL = () => {
    const h = Math.floor(Math.random() * 360); // Random hue
    const s = 60 + Math.floor(Math.random() * 40); // Saturation between 60-100%
    const l = 60; // Fixed 60% brightness
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  const angle = Math.floor(Math.random() * 360); // Random angle for gradient
  const color1 = getHSL();
  const color2 = getHSL();

  return `data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Crect width='50' height='50' fill='url(%23gradient)'/%3E%3ClinearGradient id='gradient' gradientTransform='rotate(${angle})'%3E%3Cstop offset='0%' stop-color='${encodeURIComponent(color1)}'/%3E%3Cstop offset='100%' stop-color='${encodeURIComponent(color2)}'/%3E%3C/linearGradient%3E%3C/svg%3E`;
};

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

// Generate profiles with consistent gradient avatars at 80% brightness
export const profiles: Profile[] = [
  {
    id: "1",
    name: "Alice Johnson",
    avatar: generateGradientAvatar("alice"),
    status: "online",
    lastCallDate: "2023-05-15",
    bio: "Passionate about AI and machine learning",
    profession: "Data Scientist",
    company: "TechCorp",
    school: "MIT",
    experience: 5,
    sharedInterests: [
      { type: "academic", name: "Machine Learning" },
      { type: "industry", name: "AI" },
      { type: "skill", name: "Python" },
    ],
    connectionType: "collaboration",
  },
  {
    id: "2",
    name: "Bob Smith",
    avatar: generateGradientAvatar("bob"),
    status: "away",
    lastCallDate: "2023-05-14",
    bio: "Experienced software engineer with a focus on web technologies",
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
  },
  {
    id: "3",
    name: "Charlie Brown",
    avatar: generateGradientAvatar("charlie"),
    status: "offline",
    lastCallDate: "2023-05-13",
    bio: "Entrepreneur and startup enthusiast",
    profession: "Founder & CEO",
    company: "InnovateTech",
    school: "Harvard Business School",
    experience: 10,
    sharedInterests: [
      { type: "academic", name: "Entrepreneurship" },
      { type: "industry", name: "Startups" },
      { type: "skill", name: "Business Strategy" },
    ],
    connectionType: "b2b",
  },
  {
    id: "4",
    name: "Diana Prince",
    avatar: generateGradientAvatar("diana"),
    status: "online",
    lastCallDate: "2023-05-12",
    bio: "UX/UI designer with a passion for creating intuitive user experiences",
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
  },
];

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

const ModernChatApp: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState(profiles[0]);
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [showProfiles, setShowProfiles] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const sortedProfiles = [...profiles].sort((a, b) => {
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;
    return bUnread - aUnread;
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-4">
      <Card className="flex h-[600px] w-full">
        {/* Profiles Sidebar */}
        <motion.div
          className="w-64 border-r bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
          initial={false}
          animate={{ width: showProfiles ? 256 : 72 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              className="p-2"
              onClick={() => setShowProfiles(!showProfiles)}
            >
              <Users className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-2">
            {sortedProfiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Button
                  variant={
                    activeProfile.id === profile.id ? "default" : "ghost"
                  }
                  className="relative w-full justify-start gap-2 overflow-hidden"
                  onClick={() => {
                    setActiveProfile(profile);
                    setUnreadCounts((prev) => ({ ...prev, [profile.id]: 0 }));
                  }}
                >
                  <div className="relative">
                    <Image
                      src={
                        // profile.avatar || URGENT TODO: make this actually work
                        generateGradientAvatar(profile.name)
                      }
                      alt={profile.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                    <div
                      className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ${getStatusColor(profile.status)} border-2 border-white`}
                    ></div>
                  </div>
                  <AnimatePresence>
                    {showProfiles && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="flex flex-col items-start truncate"
                      >
                        <span className="font-medium">{profile.name}</span>
                        <span className="text-xs text-gray-500">
                          {profile.status}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {unreadCounts[profile.id] > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {unreadCounts[profile.id]}
                    </Badge>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col">
          {/* Chat Header */}
          <div className="border-b p-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="p-0"
                  onClick={() => setShowUserProfile(true)}
                >
                  <Image
                    src={
                      // activeProfile.avatar || URGENT TODO: make this actually work
                      generateGradientAvatar(activeProfile.name)
                    }
                    alt={activeProfile.name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                </Button>
                <div>
                  <h3 className="font-medium">{activeProfile.name}</h3>
                  <p className="text-sm text-gray-500">
                    {activeProfile.status}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                  disabled={activeProfile.status !== "online"}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={() => setShowScheduleCall(true)}
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`flex ${message.senderId === "user" ? "justify-end" : "justify-start"}`}
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.senderId === "user"
                        ? "rounded-br-none bg-blue-500 text-white"
                        : "rounded-bl-none bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    {message.content}
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="border-t p-4 dark:border-gray-800">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
              />
              <Button onClick={handleSend} size="icon">
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Schedule Call Modal */}
      <Dialog open={showScheduleCall} onOpenChange={setShowScheduleCall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a Call with {activeProfile.name}</DialogTitle>
            <DialogDescription>
              Choose a date and time for your call.
            </DialogDescription>
          </DialogHeader>
          <ScheduleCallForm onSchedule={() => setShowScheduleCall(false)} />
        </DialogContent>
      </Dialog>

      {/* User Profile Modal */}
      <Dialog open={showUserProfile} onOpenChange={setShowUserProfile}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <UserCard {...activeProfile} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModernChatApp;
