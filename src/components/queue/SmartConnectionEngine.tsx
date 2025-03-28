"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QueueStatus from "./QueueStatus";
import MatchNotification from "./MatchNotification";
import ErrorState from "@/components/app/ErrorState";
import { Button } from "@/components/ui/button";

interface SmartConnectionEngineProps {
  userId: string;
  queueType: "professional" | "casual";
  onLeaveQueue: () => void;
  onAcceptMatch: (matchId: string) => void;
  onDeclineMatch: (matchId: string) => void;
}

const humorousTips = [
  "Pro tip: Wearing pants during video calls is optional, but highly recommended.",
  "Remember, your cat walking across the keyboard is not a valid excuse for typos.",
  "If you run out of things to say, just yell 'PLOT TWIST!' and end the call.",
  "In case of awkward silence, discuss the socioeconomic impact of rubber ducks.",
  "If all else fails, pretend your internet connection is breaking up. Kzzt... Can't hear... Kzzt...",
];

export default function SmartConnectionEngine({
  userId,
  queueType,
  onLeaveQueue,
  onAcceptMatch,
  onDeclineMatch,
}: SmartConnectionEngineProps) {
  const [queueStatus, setQueueStatus] = useState<
    "searching" | "match_found" | "error"
  >("searching");
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number>(60); // in seconds
  const [matchData, setMatchData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    // Simulating queue updates
    const timer = setInterval(() => {
      setEstimatedWaitTime((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Simulating a match found after 10 seconds
    const matchTimer = setTimeout(() => {
      setQueueStatus("match_found");
      setMatchData({
        id: "match123",
        name: "Jane Doe",
        avatar: "/placeholder.svg?height=100&width=100",
        bio: "Software Engineer | AI Enthusiast",
        profession: "Software Engineer",
        tag: "AI Specialist",
        sharedInterests: [
          { type: "academic", name: "Machine Learning" },
          { type: "passion", name: "Open Source" },
          { type: "hobby", name: "Hiking" },
        ],
        upvotes: 42,
      });
    }, 10000);

    // Rotate tips every 5 seconds
    const tipRotationTimer = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % humorousTips.length);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(matchTimer);
      clearInterval(tipRotationTimer);
    };
  }, []);

  const handleAcceptMatch = () => {
    if (matchData) {
      onAcceptMatch(matchData.id);
    }
  };

  const handleDeclineMatch = () => {
    if (matchData) {
      onDeclineMatch(matchData.id);
      setQueueStatus("searching");
      setMatchData(null);
      setEstimatedWaitTime(30); // Reset wait time
    }
  };

  if (queueStatus === "error") {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => setQueueStatus("searching")}
      />
    );
  }

  return (
    <div className=" flex min-h-screen flex-col items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {queueStatus === "searching" && (
          <motion.div
            key="searching"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <QueueStatus
              queueType={queueType === "professional" ? "formal" : "casual"}
              estimatedWaitTime={estimatedWaitTime}
            />
            <Button onClick={onLeaveQueue} variant="outline" className="mt-4">
              Leave Queue
            </Button>
            <motion.p
              key={currentTip}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-muted-foreground mt-8 max-w-md text-sm"
            >
              {humorousTips[currentTip]}
            </motion.p>
          </motion.div>
        )}

        {queueStatus === "match_found" && matchData && (
          <motion.div
            key="match_found"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <MatchNotification
              matchData={matchData}
              onAccept={handleAcceptMatch}
              onDecline={handleDeclineMatch}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
