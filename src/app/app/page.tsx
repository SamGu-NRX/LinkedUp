"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Users,
  Calendar,
  Briefcase,
  Handshake,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function HomePage() {
  const router = useRouter();
  const [queueType, setQueueType] = useState<"professional" | "casual">(
    "casual"
  );

  const handleStartQueue = (type: string) => {
    if (type === "casual") {
      router.push(`app/smart-connection?type=${type}`);
    } else {
      router.push(`app/professional/${type}`);
    }
  };

  const professionalOptions = [
    {
      id: "b2b",
      title: "B2B Networking",
      icon: <Briefcase className="h-5 w-5 mr-2" />,
      description: "Connect with other businesses",
    },
    {
      id: "collaboration",
      title: "Find Collaborators",
      icon: <Handshake className="h-5 w-5 mr-2" />,
      description: "Meet potential project partners",
    },
    {
      id: "mentorship",
      title: "Seek Mentorship",
      icon: <Lightbulb className="h-5 w-5 mr-2" />,
      description: "Learn from industry experts",
    },
    {
      id: "investment",
      title: "Pitch to Investors",
      icon: <TrendingUp className="h-5 w-5 mr-2" />,
      description: "Present your ideas to investors",
    },
  ];

  return (
    <div className="min-h-screen bg-background/80">
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="pb-1 text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-emerald-400 dark:bg-emerald-300">
            Welcome to LinkUp, Andrew
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Connect with professionals and casual contacts through voice calls
          </p>
        </motion.div>

        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="grid w-full h-full grid-cols-2 mb-8 rounded-xl p-1 bg-zinc-100 dark:bg-zinc-800">
            <TabsTrigger
              value="queue"
              className="rounded-lg py-2 px-2 text-sm font-medium"
            >
              Queue for Call
            </TabsTrigger>
            <TabsTrigger
              value="quickActions"
              className="rounded-lg py-2 px-2 text-sm font-medium"
            >
              Quick Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <Card className="border-none shadow-lg bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
              <CardHeader className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="text-2xl">Start a New Connection</CardTitle>
                <CardDescription>
                  Choose your connection type and start matching!
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-6"
                >
                  <motion.div variants={item}>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl">
                      <h3 className="text-xl font-semibold mb-3 flex items-center">
                        <Phone className="mr-2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        Casual Connection
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        Connect with someone for a friendly conversation
                      </p>
                      <Button
                        size="lg"
                        className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleStartQueue("casual")}
                      >
                        Start Casual Matching
                      </Button>
                    </div>
                  </motion.div>

                  <motion.div variants={item}>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl">
                      <h3 className="text-xl font-semibold mb-3 flex items-center">
                        <Briefcase className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        Professional Connections
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        Connect with professionals based on your needs
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {professionalOptions.map((option) => (
                          <Button
                            key={option.id}
                            variant="outline"
                            className="justify-start border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-auto py-3"
                            onClick={() => handleStartQueue(option.id)}
                          >
                            <div className="flex flex-col items-start text-left">
                              <span className="flex items-center font-medium">
                                {option.icon}
                                {option.title}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {option.description}
                              </span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quickActions">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <motion.div variants={item}>
                <Card className="border-none shadow-lg bg-white dark:bg-zinc-900 rounded-xl h-full hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">Quick Connect</CardTitle>
                      <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <CardDescription>
                      Start a voice call with a matched professional
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-emerald-400 dark:bg-emerald-300 hover:bg-emerald-600 dark:hover:bg-emerald-500"
                      onClick={() => handleStartQueue("casual")}
                    >
                      Start Call
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-none shadow-lg bg-white dark:bg-zinc-900 rounded-xl h-full hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">My Network</CardTitle>
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                        <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                    <CardDescription>
                      View and manage your connections
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <Button
                      variant="outline"
                      className="w-full border-zinc-200 dark:border-zinc-700"
                      onClick={() => router.push("app")}
                    >
                      View Network
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="border-none shadow-lg bg-white dark:bg-zinc-900 rounded-xl h-full hover:shadow-xl transition-shadow duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">Upcoming Calls</CardTitle>
                      <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                        <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                    <CardDescription>
                      Your scheduled voice calls
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <Button
                      variant="outline"
                      className="w-full border-zinc-200 dark:border-zinc-700"
                      onClick={() => router.push("app/schedule")}
                    >
                      View Schedule
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
