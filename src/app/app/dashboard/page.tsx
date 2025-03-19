"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardMetrics from "@/components/app/dashboard/DashboardMetrics";
import MyConnections from "@/components/app/dashboard/MyConnections";
import ExtendedProfile from "@/components/app/dashboard/ExtendedProfile";

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="container mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        </motion.div>

        <Tabs defaultValue="metrics" className="space-y-6">
          <TabsList className="bg-background border-border border">
            <TabsTrigger value="metrics" className="text-sm">
              Metrics
            </TabsTrigger>
            <TabsTrigger value="connections" className="text-sm">
              Connections
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-sm">
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <Card className="border-0 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DashboardMetrics />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections">
            <Card className="border-0 shadow-xs">
              {/* <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">Network</CardTitle>
              </CardHeader> */}
              <CardContent>
                <MyConnections />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card className="border-0 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExtendedProfile />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
