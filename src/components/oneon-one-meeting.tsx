"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, MicOff, Video, VideoOff, Clock, Lightbulb, ChevronRight, ChevronLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AfterCallScreen from "./after-call-screen"

// Simulated user interests for personalized prompts
const userInterests = {
  user1: ["photography", "travel", "tech startups"],
  user2: ["sustainable design", "meditation", "indie games"],
}

const generatePrompts = (interests1, interests2) => [
  `How has your journey with ${interests1[0]} influenced your perspective on ${interests2[0]}?`,
  `What parallels do you see between ${interests1[1]} and ${interests2[1]}?`,
  `How do you think ${interests1[2]} could benefit from principles of ${interests2[2]}?`,
  "What's the most surprising connection you've discovered between our fields?",
  "How do you envision our collaboration evolving over the next few months?",
  "Can you share an experience where your background in ${interests1[0]} provided unexpected insights into ${interests2[1]}?",
  "How might combining ${interests1[2]} and ${interests2[0]} lead to innovative solutions?",
  "What skills from ${interests1[1]} do you think could be valuable in ${interests2[2]}?",
]

const OneonOneMeeting = () => {
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState(0)
  const [isExtendRequested, setIsExtendRequested] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState({ user1: false, user2: true })
  const [isEndCallDialogOpen, setIsEndCallDialogOpen] = useState(false)
  const [isCallEnded, setIsCallEnded] = useState(false)
  const [expandedStream, setExpandedStream] = useState(null)

  const prompts = generatePrompts(userInterests.user1, userInterests.user2)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1))
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndCall = () => {
    setIsCallEnded(true)
    setIsEndCallDialogOpen(false)
  }

  const handleStreamClick = (streamId) => {
    setExpandedStream(expandedStream === streamId ? null : streamId)
  }

  if (isCallEnded) {
    return <AfterCallScreen />
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white" onClick={() => setExpandedStream(null)}>
        {/* Time Warning Dialog */}
        <AnimatePresence>
          {timeRemaining <= 60 && !isExtendRequested && (
            <Dialog open>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Time is almost up</DialogTitle>
                  <DialogDescription>
                    You have 1 minute remaining. Would you like to extend the conversation?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsExtendRequested(true)}>
                    Extend 5 minutes
                  </Button>
                  <Button variant="default" onClick={() => setIsExtendRequested(true)}>
                    Continue
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </AnimatePresence>

        {/* End Call Dialog */}
        <Dialog open={isEndCallDialogOpen} onOpenChange={setIsEndCallDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>End Call</DialogTitle>
              <DialogDescription>Are you sure you want to end this call?</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEndCallDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleEndCall}>
                End Call
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Video Feeds */}
          <div className="flex space-x-4 mb-4">
            {/* Your Video */}
            <motion.div
              className={`relative overflow-hidden bg-gray-50 rounded-lg ${
                expandedStream === "user1" ? "w-2/3" : expandedStream === "user2" ? "w-1/3" : "w-1/2"
              }`}
              layout
              onClick={(e) => {
                e.stopPropagation()
                handleStreamClick("user1")
              }}
            >
              <img
                src="/placeholder.svg?height=450&width=800&text=Your+Video"
                alt="Your video feed"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                <Badge variant="secondary" className="bg-white/90">
                  You
                </Badge>
                {isMuted && <MicOff className="w-4 h-4 text-red-500" />}
                {isVideoOff && <VideoOff className="w-4 h-4 text-red-500" />}
              </div>
            </motion.div>

            {/* Partner's Video */}
            <motion.div
              className={`relative overflow-hidden bg-gray-50 rounded-lg ${
                expandedStream === "user2" ? "w-2/3" : expandedStream === "user1" ? "w-1/3" : "w-1/2"
              }`}
              layout
              onClick={(e) => {
                e.stopPropagation()
                handleStreamClick("user2")
              }}
            >
              <img
                src="/placeholder.svg?height=450&width=800&text=Partner+Video"
                alt="Partner video feed"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4">
                <Badge variant="secondary" className="bg-white/90">
                  Sarah Chen
                </Badge>
              </div>
              {isSpeaking.user2 && (
                <motion.div
                  className="absolute inset-0 border-2 border-blue-500 rounded-lg"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                />
              )}
            </motion.div>
          </div>

          {/* Timer */}
          <Card className="bg-gray-50/50 mb-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-lg font-medium">Time Remaining</span>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-lg ${timeRemaining <= 60 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
                >
                  {formatTime(timeRemaining)}
                </Badge>
              </div>
              <Progress value={(timeRemaining / 300) * 100} className="h-2 mb-2" />
              <div className="text-right text-sm text-gray-500">{currentTime.toLocaleTimeString()}</div>
            </CardContent>
          </Card>

          {/* Prompts */}
          <Card className="bg-gray-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Lightbulb className="w-5 h-5 text-amber-500 mr-2" />
                  Conversation Prompts
                </h3>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPrompt((prev) => Math.max(0, prev - 1))}
                    disabled={currentPrompt === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPrompt((prev) => Math.min(prompts.length - 1, prev + 1))}
                    disabled={currentPrompt === prompts.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-24 w-full rounded-md border">
                <div className="p-4">
                  <motion.p
                    key={currentPrompt}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-gray-700 text-lg"
                  >
                    {prompts[currentPrompt]}
                  </motion.p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Control Bar */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white border-t"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
          >
            <div className="container mx-auto px-4 py-4 max-w-7xl">
              <div className="flex items-center justify-center space-x-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isMuted ? "destructive" : "outline"}
                      size="lg"
                      onClick={() => setIsMuted(!isMuted)}
                      className="rounded-full w-12 h-12"
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isMuted ? "Unmute" : "Mute"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isVideoOff ? "destructive" : "outline"}
                      size="lg"
                      onClick={() => setIsVideoOff(!isVideoOff)}
                      className="rounded-full w-12 h-12"
                    >
                      {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isVideoOff ? "Start Video" : "Stop Video"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="lg"
                      className="rounded-full px-6"
                      onClick={() => setIsEndCallDialogOpen(true)}
                    >
                      End Call
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>End Meeting</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default OneonOneMeeting

