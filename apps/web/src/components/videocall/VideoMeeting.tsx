"use client"
import { useState, useEffect, use } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Lightbulb, ChevronRight, ChevronLeft, Mic, Video, PhoneOff, MessageSquare, X, MicOff, VideoOff, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const userInterests = {
  user1: ["photography", "travel", "tech startups", "AI", "blockchain"],
  user2: ["sustainable design", "meditation", "indie games", "yoga", "writing"],
}

const generatePrompts = (interests1, interests2) => [
  `How has your journey with ${interests1[0]} influenced your perspective on ${interests2[0]}?`,
  `What parallels do you see between ${interests1[1]} and ${interests2[1]}?`,
  `How do you think ${interests1[2]} could benefit from principles of ${interests2[2]}?`,
  "What's the most surprising connection you've discovered between our fields?",
]

export default function VideoMeeting() {
  const [timeRemaining, setTimeRemaining] = useState(300)
  const [currentPrompt, setCurrentPrompt] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeVideo, setActiveVideo] = useState(null)
  const [showTimeAddedToast, setShowTimeAddedToast] = useState(false)
  const [messages, setMessages] = useState([
    { sender: "John Doe", message: "Hey there!", timestamp: "10:30 AM" },
    { sender: "You", message: "Hi! Ready to discuss?", timestamp: "10:31 AM" },
  ])

  const prompts = generatePrompts(userInterests.user1, userInterests.user2)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleVideoClick = (video) => {
    if (activeVideo === video) {
      setActiveVideo(null) 
    } else {
      setActiveVideo(video) 
    }
  }

  const addTime = () => {
    setTimeRemaining(prev => prev + 300) //300 seconds
    setShowTimeAddedToast(true)
    setTimeout(() => setShowTimeAddedToast(false), 3000)
  }

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar remains the same as before */}
      {/* Modernized Sidebar */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-72 bg-zinc-900/50 backdrop-blur-lg p-4 flex flex-col space-y-4 border-r border-zinc-800"
      >
        {/* Timer Card */}
        <Card className="bg-zinc-800/30 border-none shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-zinc-300 text-xs">Time Remaining</span>
              </div>
              <span className="font-mono text-blue-400 text-sm">{formatTime(timeRemaining)}</span>
            </div>
            <Progress value={(timeRemaining / 300) * 100} className="h-1 bg-zinc-700 mt-2" />
          </CardContent>
        </Card>

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
            <motion.p 
              key={currentPrompt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-zinc-300 text-xs leading-relaxed"
            >
              {prompts[currentPrompt]}
            </motion.p>
          </CardContent>
        </Card>

        {/* Enhanced Profile Card */}
        <Card className="bg-zinc-800/30 border-none shadow-lg">
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
        </Card>
      </motion.div>

      {/* Main Video Area */}
      <div className="flex-1 p-4 relative">
        {activeVideo === null ? (
          // Split View
          <div className="grid grid-cols-2 gap-4 h-[calc(100%-64px)]">
            {/* Partner Video */}
            <motion.div
              layout
              className="relative rounded-xl overflow-hidden bg-zinc-900 cursor-pointer"
              onClick={() => handleVideoClick('partner')}
            >
              <div className="absolute inset-0">
                <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-white text-sm">John Doe</span>
                </div>
              </div>
            </motion.div>

            {/* Self Video */}
            <motion.div
              layout
              className="relative rounded-xl overflow-hidden bg-zinc-800 cursor-pointer"
              onClick={() => handleVideoClick('self')}
            >
              <div className="absolute inset-0">
                <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-white text-sm">You</span>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="relative h-[calc(100%-64px)]">
            {/* Main Video */}
            <motion.div
              layout
              className="relative rounded-xl overflow-hidden bg-zinc-900 h-full cursor-pointer"
              onClick={() => handleVideoClick(activeVideo)}
            >
              <div className="absolute inset-0">
                <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-white text-sm">{activeVideo === 'partner' ? 'John Doe' : 'You'}</span>
                </div>
              </div>
            </motion.div>

            {/* PiP Video */}
            <motion.div
              layout
              className="absolute bottom-4 right-4 w-48 h-32 rounded-lg overflow-hidden bg-zinc-800 cursor-pointer shadow-xl"
              onClick={() => handleVideoClick(activeVideo === 'partner' ? 'self' : 'partner')}
            >
              <div className="absolute inset-0">
                <div className="absolute bottom-2 left-2 flex items-center space-x-1.5 bg-black/50 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span className="text-white text-xs">{activeVideo === 'partner' ? 'You' : 'John Doe'}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Control Bar */}
        <TooltipProvider>
        <motion.div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-3 backdrop-blur-sm bg-zinc-900/70 p-2 rounded-2xl shadow-xl"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className={`rounded-full w-11 h-11 transition-all duration-200 ${
                  isMuted 
                    ? 'bg-red-500/90 hover:bg-red-600 text-white' 
                    : 'bg-zinc-700/90 hover:bg-zinc-600 text-zinc-100'
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
                    ? 'bg-red-500/90 hover:bg-red-600 text-white' 
                    : 'bg-zinc-700/90 hover:bg-zinc-600 text-zinc-100'
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
                onClick={addTime}
                className="rounded-full w-11 h-11 bg-emerald-600/90 hover:bg-emerald-500 text-white"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Add 5 Minutes</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
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

        {/* Chat Modal */}
        <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
          <DialogContent className="sm:max-w-[400px] bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-zinc-200">Chat</DialogTitle>
            </DialogHeader>
            <div className="h-[400px] flex flex-col">
              <ScrollArea className="flex-1 px-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mb-4 ${
                      msg.sender === "You" ? "ml-auto text-right" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-zinc-400 text-xs">{msg.sender}</span>
                      <span className="text-zinc-500 text-xs">{msg.timestamp}</span>
                    </div>
                    <div
                      className={`rounded-lg px-3 py-2 inline-block max-w-[80%] ${
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
              <div className="border-t border-zinc-800 mt-4 pt-4 px-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 bg-zinc-800 border-none rounded-lg px-3 py-2 text-zinc-200 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}