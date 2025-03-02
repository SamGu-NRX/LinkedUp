"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function ProfessionalConnectionPage() {
  const router = useRouter()
  const [purpose, setPurpose] = useState("")
  const [description, setDescription] = useState("")

  const handleStartQueue = (type: string) => {
    router.push(
      `/professional/${type}?purpose=${encodeURIComponent(purpose)}&description=${encodeURIComponent(description)}`,
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <motion.h1
        className="text-3xl font-bold mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Professional Connection
      </motion.h1>
      <Card>
        <CardHeader>
          <CardTitle>Choose Your Connection Purpose</CardTitle>
          <CardDescription>
            {`Select the type of professional connection you're looking for`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="purpose">Connection Purpose</Label>
            <Input
              id="purpose"
              placeholder="e.g., Seeking advice on startup funding"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide more details about what you're looking for"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => handleStartQueue("b2b")}>B2B Networking</Button>
            <Button onClick={() => handleStartQueue("collaboration")}>Find Collaborators</Button>
            <Button onClick={() => handleStartQueue("mentorship")}>Seek Mentorship</Button>
            <Button onClick={() => handleStartQueue("investment")}>Pitch to Investors</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

