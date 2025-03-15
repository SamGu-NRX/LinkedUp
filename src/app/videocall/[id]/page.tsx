"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { TopBar } from "@/components/video-meeting/top-bar"
import { VideoArea } from "@/components/video-meeting/video-area"
import { ChatDialog } from "@/components/video-meeting/chat-dialog"
import { EndCallDialog } from "@/components/video-meeting/end-call-dialog"
import { UserCard } from "@/components/video-meeting/user-card"
import { MOCK_USERS, MOCK_SPEAKING_STATES, simulateSpeaking, MOCK_CONNECTION_STATES } from "@/types/meeting"
import { TimeManager } from "@/components/video-meeting/time-manager"
import { SettingsDialog } from "@/components/video-meeting/settings-dialog"
import { ToastContainer } from "@/components/video-meeting/toast"

const userInterests = {
  user1: ["photography", "travel", "tech startups", "AI", "blockchain"],
  user2: ["sustainable design", "meditation", "indie games", "yoga", "writing"],
}

const generatePrompts = (interests1: string[], interests2: string[]) => [
  `How has your journey with ${interests1[0]} influenced your perspective on ${interests2[0]}?`,
  `What parallels do you see between ${interests1[1]} and ${interests2[1]}?`,
  `How do you think ${interests1[2]} could benefit from principles of ${interests2[2]}?`,
  "What's the most surprising connection you've discovered between our fields?",
]

const MOCK_MESSAGES = [
  { id: "1", sender: "John Doe", message: "Hey there!", timestamp: "10:30 AM" },
  { id: "2", sender: "You", message: "Hi! Ready to discuss?", timestamp: "10:31 AM" },
]

export default function VideoMeeting() {
  const [timeManager] = useState(() => new TimeManager())
  const [timeRemaining, setTimeRemaining] = useState(timeManager.getRemainingTime())
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showTimeLeft, setShowTimeLeft] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeVideo, setActiveVideo] = useState<"partner" | "self" | null>(null) // URGENT TODO: FIX TYPES
  const [showTimeAddedToast, setShowTimeAddedToast] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isAlmostOutOfTime, setIsAlmostOutOfTime] = useState(false)
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAddTimeRequestOpen, setIsAddTimeRequestOpen] = useState(false)
  const [addTimeRequester, setAddTimeRequester] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [isAutosaving, setIsAutosaving] = useState(false)
  const [speakingStates, setSpeakingStates] = useState(MOCK_SPEAKING_STATES)
  const [isEndCallOpen, setIsEndCallOpen] = useState(false)
  const [currentTimeRequest, setCurrentTimeRequest] = useState(null)
  const [isLeaveRequestPending, setIsLeaveRequestPending] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("dark")

  const prompts = generatePrompts(userInterests.user1, userInterests.user2)

  useEffect(() => {
    const timer = setInterval(() => {
      timeManager.decrementTime()
      setTimeRemaining(timeManager.getRemainingTime())
      setTimeElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeManager])

  useEffect(() => {
    // Check if time remaining is less than 1 minute
    if (timeRemaining <= 60 && timeRemaining > 0) {
      setShowTimeLeft(true)
      setIsAlmostOutOfTime(true)
    } else {
      setIsAlmostOutOfTime(false)
    }
  }, [timeRemaining])

  useEffect(() => {
    const interval = setInterval(() => {
      setSpeakingStates(simulateSpeaking())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleVideoClick = (userId: "partner" | "self" | null) => {
    setActiveVideo((prev) => (prev === userId ? null : userId))
  }
  const addTime = () => {
    setTimeRemaining((prev) => prev + 300) // 300 seconds
    setShowTimeAddedToast(true)
    setTimeout(() => setShowTimeAddedToast(false), 3000)
  }

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleSendMessage = (message: string) => {
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: "You", message, timestamp: "Now" }])
  }

  const handleEndCall = useCallback(() => {
    setIsEndCallOpen(false)
    setIsLeaveRequestPending(true)

    window.addToast({
      message: "Leave request sent to John Doe",
      type: "info",
      icon: PhoneOff,
    })

    // Simulate partner response after 2 seconds
    setTimeout(() => {
      setIsLeaveRequestPending(false)
      window.addToast({
        message: "John Doe approved your leave request",
        type: "success",
        icon: PhoneOff,
      })
      // Actually end the call here
    }, 2000)
  }, [])

  const handleAcceptTimeRequest = () => {
    addTime()
    setCurrentTimeRequest(null)
  }

  const handleTimeRequest = useCallback(() => {
    if (!timeManager.canRequestTime()) {
      window.addToast({
        message: "You can only request time every 5 minutes",
        type: "error",
        duration: 3000,
      })
      return
    }

    window.addToast({
      message: "Time extension request sent",
      type: "info",
      icon: Clock,
    })

    // Simulate partner accepting after 2 seconds
    setTimeout(() => {
      const success = timeManager.addTime()
      if (success) {
        window.addToast({
          message: timeManager.getTimeAddedMessage(),
          type: "success",
          icon: Clock,
        })
        setTimeRemaining(timeManager.getRemainingTime())
      }
    }, 2000)
  }, [timeManager])

  return (
    <div className={`flex flex-col h-screen ${theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"}`}>
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

      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="sidebar w-72 bg-zinc-900/70 backdrop-blur-lg p-4 flex flex-col space-y-4 border-r border-zinc-800 z-10"
            >
              {/* User Card */}
              <UserCard user={MOCK_USERS.partner} />
              {/* Compact Prompts Card */}
              <Card className="bg-zinc-800/30 border-none shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <h3 className="text-zinc-300 text-xs font-medium">Discussion Prompt</h3>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPrompt((prev) => Math.max(0, prev - 1))}
                        disabled={currentPrompt === 0}
                        className="h-6 w-6 hover:bg-zinc-700"
                      >
                        <ChevronLeft className="w-3 h-3 text-zinc-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPrompt((prev) => Math.min(prompts.length - 1, prev + 1))}
                        disabled={currentPrompt === prompts.length - 1}
                        className="h-6 w-6 hover:bg-zinc-700"
                      >
                        <ChevronRight className="w-3 h-3 text-zinc-400" />
                      </Button>
                    </div>
                  </div>
                  <Separator className="bg-zinc-700 my-2" />
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentPrompt}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-zinc-300 text-xs leading-relaxed"
                    >
                      {prompts[currentPrompt]}
                    </motion.p>
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Enhanced Profile Card */}
              {/* <Card className="bg-zinc-800/30 border-none shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3 mb-3">
                    <Avatar className="h-10 w-10 ring-2 ring-blue-500/50">
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-zinc-200 text-sm font-medium">John Doe</h3>
                      <p className="text-zinc-400 text-xs">Senior Engineer • TechCorp</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-zinc-400 text-xs mb-1">Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {userInterests.user1.map((interest) => (
                          <Badge
                            key={interest}
                            variant="secondary"
                            className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0"
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs mb-1">Status</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-zinc-300 text-xs">Available</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card> */}
              <Card className="bg-zinc-800/30 border-none shadow-lg flex-1">
                <CardContent className="p-3 h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <PenLine className="w-4 h-4 text-zinc-400" />
                      <h3 className="text-zinc-300 text-xs font-medium">Meeting Notes</h3>
                    </div>
                    <AnimatePresence>
                      {isAutosaving && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-zinc-500 text-xs"
                        >
                          Saving...
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <Separator className="bg-zinc-700 my-2" />
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value)
                      setIsAutosaving(true)
                      // Simulate autosave
                      setTimeout(() => setIsAutosaving(false), 1000)
                    }}
                    placeholder="Type your notes here..."
                    className="w-full h-[calc(100%-40px)] bg-transparent border-none text-zinc-300 text-sm resize-none focus:ring-0 placeholder:text-zinc-600"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <motion.div layout className={`main-content flex-1 p-4 relative ${isSidebarOpen ? "" : "ml-0"}`}>
          {/*<VideoArea
            activeVideo={activeVideo}
            users={MOCK_USERS}
            speakingStates={speakingStates}
            connectionStates={MOCK_CONNECTION_STATES}
            onVideoClick={handleVideoClick}
          />*/}

          <VideoArea activeVideo={activeVideo} onVideoClick={handleVideoClick} />

          {/* Control Bar */}
          <TooltipProvider>
            <motion.div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-3 backdrop-blur-sm bg-zinc-900/70 p-2 rounded-2xl shadow-xl">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className={`rounded-full w-11 h-11 transition-all duration-200 ${
                      isMuted
                        ? "bg-red-500/90 hover:bg-red-600 text-white"
                        : "bg-zinc-700/90 hover:bg-zinc-600 text-zinc-100"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
                    className={`rounded-full w-11 h-11 transition-all duration-200 ${
                      isVideoOff
                        ? "bg-red-500/90 hover:bg-red-600 text-white"
                        : "bg-zinc-700/90 hover:bg-zinc-600 text-zinc-100"
                    }`}
                  >
                    {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{isVideoOff ? "Start Video" : "Stop Video"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setIsChatOpen(true)}
                    className="rounded-full w-11 h-11 bg-zinc-700/90 hover:bg-zinc-600 text-zinc-100"
                  >
                    <MessageSquare className="w-5 h-5" />
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
                      setAddTimeRequester("You")
                      setIsAddTimeRequestOpen(true)
                      handleTimeRequest()
                    }}
                    className="rounded-full w-11 h-11 bg-zinc-700/90 hover:bg-zinc-600 text-zinc-100"
                  >
                    <Plus className="w-5 h-5" />
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
                    className="rounded-full w-11 h-11 bg-red-500/90 hover:bg-red-600 text-white"
                  >
                    <PhoneOff className="w-5 h-5" />
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
                className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2"
              >
                <Clock className="w-4 h-4" />
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
            setMessages((prev) => [...prev, { id: String(Date.now()), sender: "You", message, timestamp: "Now" }])
          }}
        />
        <EndCallDialog open={isEndCallOpen} onOpenChange={setIsEndCallOpen} onConfirm={handleEndCall} />
        <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} theme={theme} onThemeChange={setTheme} />
        <ToastContainer />
      </div>
    </div>
  )
}

