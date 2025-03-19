"use client";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  PenLine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { TopBar } from "@/components/video-meeting/top-bar";
import { VideoArea } from "@/components/video-meeting/video-area";
import { ChatDialog } from "@/components/video-meeting/chat-dialog";
import { EndCallDialog } from "@/components/video-meeting/end-call-dialog";
import { UserCard } from "@/components/video-meeting/user-card";
import {
  MOCK_USERS,
  MOCK_SPEAKING_STATES,
  simulateSpeaking,
  MOCK_CONNECTION_STATES,
} from "@/types/meeting";
import { TimeManager } from "@/components/video-meeting/time-manager";
import { SettingsDialog } from "@/components/video-meeting/settings-dialog";
import { ToastContainer } from "@/components/video-meeting/toast";

const userInterests = {
  user1: ["photography", "travel", "tech startups", "AI", "blockchain"],
  user2: ["sustainable design", "meditation", "indie games", "yoga", "writing"],
};

const generatePrompts = (interests1, interests2) => [
  `How has your journey with ${interests1[0]} influenced your perspective on ${interests2[0]}?`,
  `What parallels do you see between ${interests1[1]} and ${interests2[1]}?`,
  `How do you think ${interests1[2]} could benefit from principles of ${interests2[2]}?`,
  "What's the most surprising connection you've discovered between our fields?",
];

const MOCK_MESSAGES = [
  { id: "1", sender: "John Doe", message: "Hey there!", timestamp: "10:30 AM" },
  {
    id: "2",
    sender: "You",
    message: "Hi! Ready to discuss?",
    timestamp: "10:31 AM",
  },
];

export default function VideoMeeting() {
  const [timeManager] = useState(() => new TimeManager());
  const [timeRemaining, setTimeRemaining] = useState(
    timeManager.getRemainingTime(),
  );
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showTimeLeft, setShowTimeLeft] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [showTimeAddedToast, setShowTimeAddedToast] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAlmostOutOfTime, setIsAlmostOutOfTime] = useState(false);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddTimeRequestOpen, setIsAddTimeRequestOpen] = useState(false);
  const [addTimeRequester, setAddTimeRequester] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [speakingStates, setSpeakingStates] = useState(MOCK_SPEAKING_STATES);
  const [isEndCallOpen, setIsEndCallOpen] = useState(false);
  const [currentTimeRequest, setCurrentTimeRequest] = useState(null);
  const [isLeaveRequestPending, setIsLeaveRequestPending] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const prompts = generatePrompts(userInterests.user1, userInterests.user2);

  useEffect(() => {
    const timer = setInterval(() => {
      timeManager.decrementTime();
      setTimeRemaining(timeManager.getRemainingTime());
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeManager]);

  useEffect(() => {
    // Check if time remaining is less than 1 minute
    if (timeRemaining <= 60 && timeRemaining > 0) {
      setShowTimeLeft(true);
      setIsAlmostOutOfTime(true);
    } else {
      setIsAlmostOutOfTime(false);
    }
  }, [timeRemaining]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeakingStates(simulateSpeaking());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVideoClick = (userId: string) => {
    setActiveVideo((prev) => (prev === userId ? null : userId));
  };
  const addTime = () => {
    setTimeRemaining((prev) => prev + 300); // 300 seconds
    setShowTimeAddedToast(true);
    setTimeout(() => setShowTimeAddedToast(false), 3000);
  };

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleSendMessage = (message) => {
    setMessages((prev) => [
      ...prev,
      { sender: "You", message, timestamp: "Now" },
    ]);
  };

  const handleEndCall = useCallback(() => {
    setIsEndCallOpen(false);
    setIsLeaveRequestPending(true);

    window.addToast({
      message: "Leave request sent to John Doe",
      type: "info",
      icon: PhoneOff,
    });

    // Simulate partner response after 2 seconds
    setTimeout(() => {
      setIsLeaveRequestPending(false);
      window.addToast({
        message: "John Doe approved your leave request",
        type: "success",
        icon: PhoneOff,
      });
      // Actually end the call here
    }, 2000);
  }, []);

  const handleAcceptTimeRequest = () => {
    addTime();
    setCurrentTimeRequest(null);
  };

  const handleTimeRequest = useCallback(() => {
    if (!timeManager.canRequestTime()) {
      window.addToast({
        message: "You can only request time every 5 minutes",
        type: "error",
        duration: 3000,
      });
      return;
    }

    window.addToast({
      message: "Time extension request sent",
      type: "info",
      icon: Clock,
    });

    // Simulate partner accepting after 2 seconds
    setTimeout(() => {
      const success = timeManager.addTime();
      if (success) {
        window.addToast({
          message: timeManager.getTimeAddedMessage(),
          type: "success",
          icon: Clock,
        });
        setTimeRemaining(timeManager.getRemainingTime());
      }
    }, 2000);
  }, [timeManager]);

  return (
    <div
      className={`flex h-screen flex-col ${theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"}`}
    >
      <TopBar
        partner={MOCK_USERS.partner}
        timeElapsed={timeElapsed}
        timeRemaining={timeRemaining}
        showTimeLeft={showTimeLeft}
        isAlmostOutOfTime={isAlmostOutOfTime}
        isSidebarOpen={isSidebarOpen}
        onToggleTimeDisplay={() => setShowTimeLeft(!showTimeLeft)}
        onToggleSidebar={handleSidebarToggle}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="sidebar z-10 flex w-72 flex-col space-y-4 border-r border-zinc-800 bg-zinc-900/70 p-4 backdrop-blur-lg"
            >
              {/* User Card */}
              <UserCard user={MOCK_USERS.partner} />
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

        {/* Main Content */}
        <motion.div
          layout
          className={`main-content relative flex-1 p-4 ${isSidebarOpen ? "" : "ml-0"}`}
        >
          <VideoArea
            activeVideo={activeVideo}
            users={MOCK_USERS}
            speakingStates={speakingStates}
            connectionStates={MOCK_CONNECTION_STATES}
            onVideoClick={handleVideoClick}
          />

          {/* Control Bar */}
          <TooltipProvider>
            <motion.div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center space-x-3 rounded-2xl bg-zinc-900/70 p-2 shadow-xl backdrop-blur-xs">
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
                      handleTimeRequest("You");
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
                    onClick={() => setIsEndCallOpen(true)}
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
        </motion.div>

        {/* Dialogs and Toasts */}
        <ChatDialog
          open={isChatOpen}
          onOpenChange={setIsChatOpen}
          messages={messages}
          onSendMessage={(message) => {
            setMessages((prev) => [
              ...prev,
              {
                id: String(Date.now()),
                sender: "You",
                message,
                timestamp: "Now",
              },
            ]);
          }}
        />
        <EndCallDialog
          open={isEndCallOpen}
          onOpenChange={setIsEndCallOpen}
          onConfirm={handleEndCall}
        />
        <SettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          theme={theme}
          onThemeChange={setTheme}
        />
        <ToastContainer />
      </div>
    </div>
  );
}
