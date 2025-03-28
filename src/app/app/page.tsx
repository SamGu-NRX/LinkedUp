"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
  const { user } = useUser();
  const [queueType, setQueueType] = useState<"professional" | "casual">(
    "casual",
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
      icon: <Briefcase className="mr-2 h-5 w-5" />,
      description: "Connect with other businesses",
    },
    {
      id: "collaboration",
      title: "Find Collaborators",
      icon: <Handshake className="mr-2 h-5 w-5" />,
      description: "Meet potential project partners",
    },
    {
      id: "mentorship",
      title: "Seek Mentorship",
      icon: <Lightbulb className="mr-2 h-5 w-5" />,
      description: "Learn from industry experts",
    },
    {
      id: "investment",
      title: "Pitch to Investors",
      icon: <TrendingUp className="mr-2 h-5 w-5" />,
      description: "Present your ideas to investors",
    },
  ];

  return (
    <div className="bg-background/80 min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
            <h1 className="bg-emerald-400 bg-clip-text pb-1 text-4xl font-bold text-transparent md:text-5xl dark:bg-emerald-300">
            Welcome to LinkedUp, {user?.firstName || "Guest"}
            </h1>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Connect with professionals and casual contacts through voice calls
          </p>
        </motion.div>

        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="mb-8 grid h-full w-full grid-cols-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <TabsTrigger
              value="queue"
              className="rounded-lg px-2 py-2 text-sm font-medium"
            >
              Queue for Call
            </TabsTrigger>
            <TabsTrigger
              value="quickActions"
              className="rounded-lg px-2 py-2 text-sm font-medium"
            >
              Quick Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <Card className="overflow-hidden rounded-xl border-none bg-white shadow-lg dark:bg-zinc-900">
              <CardHeader className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <CardTitle className="text-2xl">
                  Start a New Connection
                </CardTitle>
                <CardDescription>
                  Choose your connection type and start matching!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-2">
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-6"
                >
                  <motion.div variants={item}>
                    <div className="rounded-xl bg-emerald-50 p-6 dark:bg-emerald-900/20">
                      <h3 className="mb-3 flex items-center text-xl font-semibold">
                        <Phone className="mr-2 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        Casual Connection
                      </h3>
                      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                        Connect with someone for a friendly conversation
                      </p>
                      <Button
                        size="lg"
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 md:w-auto"
                        onClick={() => handleStartQueue("casual")}
                      >
                        Start Casual Matching
                      </Button>
                    </div>
                  </motion.div>

                  <motion.div variants={item}>
                    <div className="rounded-xl bg-indigo-50 p-6 dark:bg-indigo-900/20">
                      <h3 className="mb-3 flex items-center text-xl font-semibold">
                        <Briefcase className="mr-2 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        Professional Connections
                      </h3>
                      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                        Connect with professionals based on your needs
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {professionalOptions.map((option) => (
                          <Button
                            key={option.id}
                            variant="outline"
                            className="h-auto justify-start border-zinc-200 py-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            onClick={() => handleStartQueue(option.id)}
                          >
                            <div className="flex flex-col items-start text-left">
                              <span className="flex items-center font-medium">
                                {option.icon}
                                {option.title}
                              </span>
                              <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
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
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
            >
              <motion.div variants={item}>
                <Card className="h-full rounded-xl border-none bg-white shadow-lg transition-shadow duration-300 hover:shadow-xl dark:bg-zinc-900">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">Quick Connect</CardTitle>
                      <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                        <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <CardDescription>
                      Start a voice call with a matched professional
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-emerald-400 hover:bg-emerald-600 dark:bg-emerald-300 dark:hover:bg-emerald-500"
                      onClick={() => handleStartQueue("casual")}
                    >
                      Start Call
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card className="h-full rounded-xl border-none bg-white shadow-lg transition-shadow duration-300 hover:shadow-xl dark:bg-zinc-900">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">My Network</CardTitle>
                      <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/30">
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
                <Card className="h-full rounded-xl border-none bg-white shadow-lg transition-shadow duration-300 hover:shadow-xl dark:bg-zinc-900">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">Upcoming Calls</CardTitle>
                      <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
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
