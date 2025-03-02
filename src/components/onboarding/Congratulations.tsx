"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { TransitionLink } from "@/utils/TransitionLink";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function Congratulations() {
  const { user } = useUser();
  const router = useRouter();

    useEffect(() => {
      const updateOnboardingStatus = async () => {
        try {
          await user?.update({
            unsafeMetadata: {
              onboardingComplete: true,
              // Add any other metadata you want to track
            },
          });
          // Create a gentler confetti implementation
          const duration = 2 * 1000; // Shorter duration
          const end = Date.now() + duration;

          const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
          };

          // Use a safer approach with requestAnimationFrame
          let frame: number;

          const runConfetti = () => {
            if (Date.now() < end) {
              confetti({
                particleCount: 20, // Fewer particles
                spread: 40, // Less spread
                origin: {
                  x: randomInRange(0.4, 0.6), // More centered horizontally
                  y: randomInRange(0.3, 0.5), // More centered vertically
                },
                gravity: 0.5, // Lower gravity for gentler falling
                startVelocity: 15, // Lower velocity
                scalar: 0.8, // Smaller confetti pieces
                drift: 0, // No drift
                ticks: 200, // Shorter lifespan for particles
                colors: ["#4F46E5", "#10B981", "#F59E0B", "#6366F1"], // Softer colors
              });

              // Slower animation rate
              setTimeout(() => {
                frame = requestAnimationFrame(runConfetti);
              }, 300); // Longer delay between bursts
            }
          };

          frame = requestAnimationFrame(runConfetti);

          return () => {
            if (frame) {
              cancelAnimationFrame(frame);
            }
          };
        } catch (err) {
          console.error("Error updating onboarding status:", err);
        }
      };

      updateOnboardingStatus();
    }, [user]);

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
          <TransitionLink href="/app">
            <Button size="lg">Start Connecting</Button>
          </TransitionLink>
        </div>
      </div>
    </motion.div>
  );
}
