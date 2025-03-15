// src/components/onboarding/Congratulations.tsx
"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

interface CongratulationsProps {
  onComplete: () => void;
}

export default function Congratulations({ onComplete }: CongratulationsProps) {
  useEffect(() => {
    // Launch confetti effect
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    let frame: number;

    const runConfetti = () => {
      if (Date.now() < end) {
        confetti({
          particleCount: 20,
          spread: 40,
          origin: {
            x: randomInRange(0.4, 0.6),
            y: randomInRange(0.3, 0.5),
          },
          gravity: 0.5,
          startVelocity: 15,
          scalar: 0.8,
          drift: 0,
          ticks: 200,
          colors: ["#4F46E5", "#10B981", "#F59E0B", "#6366F1"],
        });

        setTimeout(() => {
          frame = requestAnimationFrame(runConfetti);
        }, 300);
      }
    };

    frame = requestAnimationFrame(runConfetti);

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-screen items-center justify-center p-4"
    >
      <div className="space-y-8 text-center">
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{
            repeat: Infinity,
            repeatType: "reverse",
            duration: 2,
          }}
        >
          <Sparkles className="text-primary mx-auto h-16 w-16" />
        </motion.div>
        <h1 className="text-4xl font-bold md:text-6xl">Welcome to the Club!</h1>
        <p className="text-muted-foreground mx-auto max-w-md text-xl">
          {`Your profile is ready. Time to make connections that don't start with
          "hey" and end with ghosting.`}
        </p>
        <div className="space-x-4">
          <Button size="lg" onClick={onComplete}>
            Start Connecting
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
