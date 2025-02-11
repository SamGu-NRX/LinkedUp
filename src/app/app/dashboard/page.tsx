"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DashboardMetrics from "@/components/dashboard/DashboardMetrics"
import MyConnections from "@/components/dashboard/MyConnections"
import ExtendedProfile from "@/components/dashboard/ExtendedProfile"

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <motion.h1
        className="text-3xl font-bold mb-8 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Dashboard
      </motion.h1>
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="profile">Extended Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Metrics Summary</CardTitle>
              <CardDescription>Your call statistics and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardMetrics />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="connections">
          <Card>
            <CardHeader>
              <CardTitle>My Connections</CardTitle>
              <CardDescription>Your recent connections and quick actions</CardDescription>
            </CardHeader>
            <CardContent>
              <MyConnections />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Extended Profile</CardTitle>
              <CardDescription>Manage your extended profile settings</CardDescription>
            </CardHeader>
            <CardContent>
              <ExtendedProfile />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

