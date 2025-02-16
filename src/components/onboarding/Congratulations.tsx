"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function Congratulations() {
  useEffect(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50;

      confetti({
        particleCount,
        spread: 60,
        origin: { x: randomInRange(0.2, 0.8), y: randomInRange(0.2, 0.8) },
        colors: ["#FF0000", "#00FF00", "#0000FF"],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      <div className="text-center space-y-8">
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{
            repeat: Infinity,
            repeatType: "reverse",
            duration: 2,
          }}
        >
          <Sparkles className="h-16 w-16 text-primary mx-auto" />
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-bold">
          Welcome to the Club!
        </h1>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          Your profile is ready. Time to make connections that don't start with
          "hey" and end with ghosting.
        </p>
        <div className="space-x-4">
          <Link href="/dashboard">
            <Button size="lg">Start Connecting</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}