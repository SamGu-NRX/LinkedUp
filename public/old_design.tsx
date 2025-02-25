"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  Mic,
  Video,
  PhoneOff,
  MessageSquare,
  MicOff,
  VideoOff,
  Plus,
  Settings,
  PenLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const userInterests = {
  user1: ["photography", "travel", "tech startups", "AI", "blockchain"],
  user2: ["sustainable design", "meditation", "indie games", "yoga", "writing"],
};

interface UserInterests {
   user1: string[];
   user2: string[];
}

interface PromptGenerator {
   (interests1: string[], interests2: string[]): string[];
}

const generatePrompts: PromptGenerator = (interests1, interests2) => [
   `How has your journey with ${interests1[0]} influenced your perspective on ${interests2[0]}?`,
   `What parallels do you see between ${interests1[1]} and ${interests2[1]}?`,
   `How do you think ${interests1[2]} could benefit from principles of ${interests2[2]}?`,
   "What's the most surprising connection you've discovered between our fields?",
];

export default function VideoMeeting() {
  const [totalTime] = useState(300);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showTimeLeft, setShowTimeLeft] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [showTimeAddedToast, setShowTimeAddedToast] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAlmostOutOfTime, setIsAlmostOutOfTime] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "John Doe", message: "Hey there!", timestamp: "10:30 AM" },
    { sender: "You", message: "Hi! Ready to discuss?", timestamp: "10:31 AM" },
  ]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddTimeRequestOpen, setIsAddTimeRequestOpen] = useState(false);
  const [addTimeRequester, setAddTimeRequester] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isAutosaving, setIsAutosaving] = useState(false);

  const prompts = generatePrompts(userInterests.user1, userInterests.user2);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Check if time remaining is less than 1 minute
    if (timeRemaining <= 60 && timeRemaining > 0) {
      setShowTimeLeft(true);
      setIsAlmostOutOfTime(true);
    } else {
      setIsAlmostOutOfTime(false);
    }
  }, [timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVideoClick = (video) => {
    if (activeVideo === video) {
      setActiveVideo(null);
    } else {
      setActiveVideo(video);
    }
  };

  const addTime = () => {
    setTimeRemaining((prev) => prev + 300); // 300 seconds
    setShowTimeAddedToast(true);
    setTimeout(() => setShowTimeAddedToast(false), 3000);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* New Top Bar */}
      <motion.div className="z-10 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-6 backdrop-blur-lg">
        <div className="flex items-center space-x-4">
          <Avatar className="h-8 w-8 ring-2 ring-blue-500/50">
            <AvatarImage src="/placeholder.svg" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-medium text-zinc-200">
              Meeting with John Doe
            </h3>
            <p className="text-xs text-zinc-400">1-on-1 discussion</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <motion.div className="flex items-center space-x-2 rounded-full bg-zinc-800/50 px-3 py-1.5">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span className="font-mono text-sm text-zinc-400">
                  {formatTime(timeElapsed)}
                </span>
              </motion.div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
                className="h-8 w-8 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50"
              >
                <Settings className="h-4 w-4 text-zinc-400" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar Toggle */}
        <motion.button
          onClick={toggleSidebar}
          className="absolute top-1/2 left-0 z-20 h-12 w-1.5 -translate-y-1/2 bg-zinc-800 transition-colors hover:bg-zinc-700"
          whileHover={{ width: "8px" }}
        >
          <span className="sr-only">Toggle Sidebar</span>
        </motion.button>

        {/* Modernized Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="z-10 flex w-72 flex-col space-y-4 border-r border-zinc-800 bg-zinc-900/70 p-4 backdrop-blur-lg"
            >
              {/* Compact Prompts Card */}
              <Card className="border-none bg-zinc-800/30 shadow-lg">
                <CardContent className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="h-4 w-4 text-amber-400" />
                      <h3 className="text-xs font-medium text-zinc-300">
                        Discussion Prompt
                      </h3>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCurrentPrompt((prev) => Math.max(0, prev - 1))
                        }
                        disabled={currentPrompt === 0}
                        className="h-6 w-6 hover:bg-zinc-700"
                      >
                        <ChevronLeft className="h-3 w-3 text-zinc-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCurrentPrompt((prev) =>
                            Math.min(prompts.length - 1, prev + 1),
                          )
                        }
                        disabled={currentPrompt === prompts.length - 1}
                        className="h-6 w-6 hover:bg-zinc-700"
                      >
                        <ChevronRight className="h-3 w-3 text-zinc-400" />
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-2 bg-zinc-700" />
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentPrompt}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-xs leading-relaxed text-zinc-300"
                    >
                      {prompts[currentPrompt]}
                    </motion.p>
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Enhanced Profile Card */}
              <Card className="border-none bg-zinc-800/30 shadow-lg">
                <CardContent className="p-3">
                  <div className="mb-3 flex items-center space-x-3">
                    <Avatar className="h-10 w-10 ring-2 ring-blue-500/50">
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">
                        John Doe
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Senior Engineer • TechCorp
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-xs text-zinc-400">Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {userInterests.user1.map((interest) => (
                          <Badge
                            key={interest}
                            variant="secondary"
                            className="bg-blue-500/10 px-2 py-0 text-xs text-blue-400"
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-zinc-400">Status</p>
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs text-zinc-300">Available</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="flex-1 border-none bg-zinc-800/30 shadow-lg">
                <CardContent className="h-full p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <PenLine className="h-4 w-4 text-zinc-400" />
                      <h3 className="text-xs font-medium text-zinc-300">
                        Meeting Notes
                      </h3>
                    </div>
                    <AnimatePresence>
                      {isAutosaving && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-zinc-500"
                        >
                          Saving...
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <Separator className="my-2 bg-zinc-700" />
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setIsAutosaving(true);
                      // Simulate autosave
                      setTimeout(() => setIsAutosaving(false), 1000);
                    }}
                    placeholder="Type your notes here..."
                    className="h-[calc(100%-40px)] w-full resize-none border-none bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 focus:ring-0"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Video Area */}
        <div
          className={`relative flex-1 p-4 transition-all duration-300 ${isSidebarOpen ? "ml-0" : "ml-0"}`}
        >
          {activeVideo === null ? (
            // Split View
            <div className="grid h-[calc(100%-64px)] grid-cols-2 gap-4">
              {/* Partner Video */}
              <motion.div
                layout
                className="relative cursor-pointer overflow-hidden rounded-xl bg-zinc-900 shadow-lg"
                onClick={() => handleVideoClick("partner")}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute inset-0">
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-white">John Doe</span>
                  </div>
                </div>
              </motion.div>

              {/* Self Video */}
              <motion.div
                layout
                className="relative cursor-pointer overflow-hidden rounded-xl bg-zinc-800 shadow-lg"
                onClick={() => handleVideoClick("self")}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute inset-0">
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-white">You</span>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="relative h-[calc(100%-64px)]">
              {/* Main Video */}
              <motion.div
                layout
                className="relative h-full cursor-pointer overflow-hidden rounded-xl bg-zinc-900 shadow-lg"
                onClick={() => handleVideoClick(activeVideo)}
              >
                <div className="absolute inset-0">
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-white">
                      {activeVideo === "partner" ? "John Doe" : "You"}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* PiP Video */}
              <motion.div
                layout
                className="absolute right-4 bottom-4 h-32 w-48 cursor-pointer overflow-hidden rounded-lg bg-zinc-800 shadow-xl"
                onClick={() =>
                  handleVideoClick(
                    activeVideo === "partner" ? "self" : "partner",
                  )
                }
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <div className="absolute inset-0">
                  <div className="absolute bottom-2 left-2 flex items-center space-x-1.5 rounded-full bg-black/50 px-2 py-1 backdrop-blur-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-xs text-white">
                      {activeVideo === "partner" ? "You" : "John Doe"}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Control Bar */}
          <TooltipProvider>
            <motion.div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center space-x-3 rounded-2xl bg-zinc-900/70 p-2 shadow-xl backdrop-blur-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className={`h-11 w-11 rounded-full transition-all duration-200 ${
                      isMuted
                        ? "bg-red-500/90 text-white hover:bg-red-600"
                        : "bg-zinc-700/90 text-zinc-100 hover:bg-zinc-600"
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{isMuted ? "Unmute" : "Mute"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isVideoOff ? "destructive" : "secondary"}
                    size="icon"
                    onClick={() => setIsVideoOff(!isVideoOff)}
                    className={`h-11 w-11 rounded-full transition-all duration-200 ${
                      isVideoOff
                        ? "bg-red-500/90 text-white hover:bg-red-600"
                        : "bg-zinc-700/90 text-zinc-100 hover:bg-zinc-600"
                    }`}
                  >
                    {isVideoOff ? (
                      <VideoOff className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {isVideoOff ? "Start Video" : "Stop Video"}
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setIsChatOpen(true)}
                    className="h-11 w-11 rounded-full bg-zinc-700/90 text-zinc-100 hover:bg-zinc-600"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Chat</p>
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-8 bg-zinc-600" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      setAddTimeRequester("You");
                      setIsAddTimeRequestOpen(true);
                    }}
                    className="h-11 w-11 rounded-full bg-zinc-700/90 text-zinc-100 hover:bg-zinc-600"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Request More Time</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-11 w-11 rounded-full bg-red-500/90 text-white hover:bg-red-600"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">End Call</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          </TooltipProvider>

          {/* Time Added Toast */}
          <AnimatePresence>
            {showTimeAddedToast && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center space-x-2 rounded-full bg-emerald-500 px-4 py-2 text-white shadow-lg"
              >
                <Clock className="h-4 w-4" />
                <span className="text-sm">Added 5 minutes</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Modal */}
          <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
            <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="text-zinc-200">Chat</DialogTitle>
              </DialogHeader>
              <div className="flex h-[400px] flex-col">
                <ScrollArea className="flex-1 px-4">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-4 ${msg.sender === "You" ? "ml-auto text-right" : ""}`}
                    >
                      <div className="mb-1 flex items-center space-x-2">
                        <span className="text-xs text-zinc-400">
                          {msg.sender}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {msg.timestamp}
                        </span>
                      </div>
                      <div
                        className={`inline-block max-w-[80%] rounded-lg px-3 py-2 ${
                          msg.sender === "You"
                            ? "bg-blue-500 text-white"
                            : "bg-zinc-800 text-zinc-200"
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
                <div className="mt-4 border-t border-zinc-800 px-4 pt-4">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 rounded-lg border-none bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:ring-2 focus:ring-blue-500"
                    />
                    <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="text-zinc-200">
                  Call Settings
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-zinc-200">Video Quality</Label>
                    <p className="text-xs text-zinc-400">
                      Adjust video resolution
                    </p>
                  </div>
                  <Select defaultValue="720p">
                    <SelectTrigger className="w-24 border-zinc-700 bg-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900">
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="480p">480p</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-zinc-200">Noise Suppression</Label>
                    <p className="text-xs text-zinc-400">
                      Reduce background noise
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-blue-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-zinc-200">Auto-gain Control</Label>
                    <p className="text-xs text-zinc-400">
                      Automatically adjust mic volume
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-blue-500" />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isAddTimeRequestOpen}
            onOpenChange={setIsAddTimeRequestOpen}
          >
            <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="text-zinc-200">
                  Add Time Request
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-zinc-300">
                  {addTimeRequester === "You"
                    ? "Waiting for other participant to accept..."
                    : "Would you like to add 5 minutes to the call?"}
                </p>
                {addTimeRequester !== "You" && (
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      onClick={() => setIsAddTimeRequestOpen(false)}
                    >
                      Decline
                    </Button>
                    <Button
                      onClick={() => {
                        addTime();
                        setIsAddTimeRequestOpen(false);
                      }}
                    >
                      Accept
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
