"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UserCard from "@/components/app/user-card";

interface ProfessionalQueueProps {
  userId: string;
  connectionType: "b2b" | "collaboration" | "mentorship" | "investment";
  purpose: string;
  description: string;
  onLeaveQueue: () => void;
  onAcceptMatch: (matchId: string) => void;
  onDeclineMatch: (matchId: string) => void;
  onScheduleCall: (userId: string) => void;
}

const professionalTips = {
  b2b: [
    "Research potential partners before connecting to make the most of your conversation.",
    "Prepare a brief elevator pitch about your business and its unique value proposition.",
    "Be open to exploring synergies and mutual benefits in potential partnerships.",
  ],
  collaboration: [
    "Clearly define your project goals and the specific skills you're looking for in a collaborator.",
    "Be prepared to discuss your own strengths and how they complement potential collaborators.",
    "Consider discussing intellectual property rights and project ownership early in the conversation.",
  ],
  mentorship: [
    "Prepare specific questions or topics you'd like to discuss with your mentor.",
    "Be open to constructive feedback and willing to learn from others' experiences.",
    "Consider setting clear goals for what you hope to achieve through mentorship.",
  ],
  investment: [
    "Have a concise and compelling pitch deck ready to share with potential investors.",
    "Be prepared to discuss your business model, market opportunity, and financial projections.",
    "Research the investor's portfolio and investment thesis before the call.",
  ],
};

export default function ProfessionalQueue({
  userId,
  connectionType,
  purpose,
  description,
  onLeaveQueue,
  onAcceptMatch,
  onDeclineMatch,
  onScheduleCall,
}: ProfessionalQueueProps) {
  const [queueStatus, setQueueStatus] = useState<
    "searching" | "match_found" | "no_live_matches"
  >("searching");
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number>(300); // 5 minutes in seconds
  const [matchData, setMatchData] = useState<any>(null);
  const [recommendedProfiles, setRecommendedProfiles] = useState<any[]>([]);
  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    // Simulating queue updates
    const timer = setInterval(() => {
      setEstimatedWaitTime((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Simulating a match found or no live matches after 20 seconds
    const matchTimer = setTimeout(() => {
      const randomOutcome = Math.random();
      if (randomOutcome < 0.7) {
        setQueueStatus("match_found");
        setMatchData({
          id: "match123",
          name: "Jane Doe",
          avatar: "/placeholder.svg?height=100&width=100",
          bio: "Experienced software engineer with a passion for AI and machine learning.",
          profession: "Senior Software Engineer",
          company: "Tech Innovations Inc.",
          school: "Stanford University",
          experience: 8,
          sharedInterests: [
            { type: "industry", name: "Artificial Intelligence" },
            { type: "skill", name: "Python" },
            { type: "academic", name: "Computer Science" },
          ],
        });
      } else {
        setQueueStatus("no_live_matches");
        setRecommendedProfiles([
          {
            id: "user1",
            name: "John Smith",
            avatar: "/placeholder.svg?height=100&width=100",
            bio: "Entrepreneur with a focus on sustainable energy solutions.",
            profession: "Founder & CEO",
            company: "GreenTech Solutions",
            school: "MIT",
            experience: 12,
            sharedInterests: [
              { type: "industry", name: "Renewable Energy" },
              { type: "skill", name: "Business Development" },
              { type: "academic", name: "Environmental Science" },
            ],
          },
          // Add more recommended profiles here
        ]);
      }
    }, 20000);

    // Rotate tips every 10 seconds
    const tipRotationTimer = setInterval(() => {
      setCurrentTip(
        (prev) => (prev + 1) % professionalTips[connectionType].length,
      );
    }, 10000);

    return () => {
      clearInterval(timer);
      clearTimeout(matchTimer);
      clearInterval(tipRotationTimer);
    };
  }, [connectionType]);

  const renderQueueStatus = () => {
    switch (queueStatus) {
      case "searching":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Searching for a Match</CardTitle>
              <CardDescription>
                Estimated wait time: {Math.floor(estimatedWaitTime / 60)}:
                {(estimatedWaitTime % 60).toString().padStart(2, "0")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.p
                key={currentTip}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="text-muted-foreground text-sm"
              >
                {professionalTips[connectionType][currentTip]}
              </motion.p>
              <div className="mt-4">
                <h4 className="font-semibold">Your Connection Purpose:</h4>
                <p>{purpose}</p>
                {description && (
                  <>
                    <h4 className="mt-2 font-semibold">Additional Details:</h4>
                    <p>{description}</p>
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={onLeaveQueue} variant="outline">
                Leave Queue
              </Button>
            </CardFooter>
          </Card>
        );
      case "match_found":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Match Found!</CardTitle>
              <CardDescription>
                {`Review the profile and decide if you'd like to connect.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {matchData && (
                <UserCard {...matchData} connectionType={connectionType} />
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                onClick={() => onDeclineMatch(matchData.id)}
                variant="outline"
              >
                Decline
              </Button>
              <Button onClick={() => onAcceptMatch(matchData.id)}>
                Accept
              </Button>
            </CardFooter>
          </Card>
        );
      case "no_live_matches":
        return (
          <Card>
            <CardHeader>
              <CardTitle>No Live Matches Available</CardTitle>
              <CardDescription>
                {`We've found some recommended profiles for you to connect with.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendedProfiles.map((profile) => (
                <div key={profile.id} className="mb-4">
                  <UserCard {...profile} connectionType={connectionType} />
                  <Button
                    onClick={() => onScheduleCall(profile.id)}
                    className="mt-2"
                  >
                    Schedule Call
                  </Button>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={onLeaveQueue} variant="outline">
                Back to Dashboard
              </Button>
            </CardFooter>
          </Card>
        );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-3xl font-bold">
        {getConnectionTypeTitle(connectionType)}
      </h1>
      <AnimatePresence mode="wait">
        <motion.div
          key={queueStatus}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderQueueStatus()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function getConnectionTypeTitle(
  type: "b2b" | "collaboration" | "mentorship" | "investment",
) {
  switch (type) {
    case "b2b":
      return "B2B Networking";
    case "collaboration":
      return "Find Collaborators";
    case "mentorship":
      return "Mentorship Connection";
    case "investment":
      return "Investment Opportunities";
    default:
      return "Professional Connection";
  }
}
