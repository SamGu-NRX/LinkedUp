"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardPage() {
  const router = useRouter()
  const [queueType, setQueueType] = useState<"professional" | "casual">("casual")

  const handleStartQueue = (type: string) => {
    if (type === "casual") {
      router.push(`/smart-connection?type=${type}`)
    } else {
      router.push(`/professional/${type}`)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queue">Queue for Call</TabsTrigger>
          <TabsTrigger value="profile">Edit Profile</TabsTrigger>
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
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Edit Your Profile</CardTitle>
              <CardDescription>Update your information to improve your matches</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add profile editing form here */}
              <p>Profile editing form coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

