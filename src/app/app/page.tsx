"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Phone, Users, Calendar } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const [queueType, setQueueType] = useState<"professional" | "casual">("casual")

  const handleStartQueue = (type: string) => {
    if (type === "casual") {
      router.push(`app/smart-connection?type=${type}`)
    } else {
      router.push(`app/professional/${type}`)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <motion.h1
        className="text-3xl font-bold mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Welcome to LinkUp
      </motion.h1>
      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="queue">Queue for Call</TabsTrigger>
          <TabsTrigger value="quickActions">Quick Actions</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Start a New Connection</CardTitle>
              <CardDescription>Choose your connection type and start matching!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Casual Connection</h3>
                <Button onClick={() => handleStartQueue("casual")}>Start Casual Matching</Button>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Professional Connections</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleStartQueue("b2b")}>B2B Networking</Button>
                  <Button onClick={() => handleStartQueue("collaboration")}>Find Collaborators</Button>
                  <Button onClick={() => handleStartQueue("mentorship")}>Seek Mentorship</Button>
                  <Button onClick={() => handleStartQueue("investment")}>Pitch to Investors</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quickActions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Quick Connect</CardTitle>
                  <CardDescription>Start a voice call with a matched professional</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => handleStartQueue("casual")}>
                    <Phone className="mr-2 h-4 w-4" /> Start Call
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>My Network</CardTitle>
                  <CardDescription>View and manage your connections</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => router.push("app/dashboard")}>
                    <Users className="mr-2 h-4 w-4" /> View Network
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Calls</CardTitle>
                  <CardDescription>Your scheduled voice calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => router.push("app/schedule")}>
                    <Calendar className="mr-2 h-4 w-4" /> View Schedule
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

