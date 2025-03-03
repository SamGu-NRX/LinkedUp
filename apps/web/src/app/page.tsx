"use client";

import React, { useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Phone, Shield, Zap, Users, Star, ArrowRight, Timer,
  MessageSquare, Target, Award, TrendingUp, ChevronRight,
  UserCheck, Globe, Clock, Activity, Sun, Moon
} from 'lucide-react';
import { handleTransition } from '@/utils/TransitionLink';
import { useRouter } from 'next/navigation';
import { SignedOut, SignInButton, SignUpButton, SignedIn, UserButton } from '@clerk/nextjs';

const retentionData = [
  { month: 'Jan', rate: 85 },
  { month: 'Feb', rate: 87 },
  { month: 'Mar', rate: 89 },
  { month: 'Apr', rate: 92 },
  { month: 'May', rate: 94 },
  { month: 'Jun', rate: 95 }
];

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  delay: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, value, label, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg"
  >
    <div className="flex items-center gap-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <h4 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</h4>
        <p className="text-gray-600 dark:text-gray-300">{label}</p>
      </div>
    </div>
  </motion.div>
);

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon: Icon, color = "blue" }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg"
  >
    <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/50 rounded-lg w-fit mb-4`}>
      <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
    </div>
    <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">{title}</h3>
    <p className="text-gray-600 dark:text-gray-300">{description}</p>
  </motion.div>
);

const LandingPage = () => {
  const [theme, setTheme] = useState('light');
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 1000], [0, -150]);

  const router = useRouter();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "dark" : ""}`}>
      <div className="bg-white transition-colors duration-300 dark:bg-gray-900">
        {/* Nav */}
        <nav className="fixed top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              LinkUp
            </span>
            <div className="flex items-center gap-6">
              <button
                onClick={toggleTheme}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5 text-white" />
                )}
              </button>
              {/* <SignedOut>
                <SignInButton />
                <SignUpButton />
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn> */}

              <a
                href="/app"
                className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 dark:bg-white dark:text-black"
                onClick={(e) => handleTransition(e, "/app", router)}
              >
                Start Connecting
              </a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative flex min-h-screen items-center overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="container relative mx-auto px-4 py-20"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mx-auto max-w-4xl text-center"
            >
              <h1 className="mb-6 text-5xl font-bold text-gray-900 dark:text-white md:text-7xl">
                Professional Networking
                <br />
                <span className="text-blue-600">Without the BS.</span>
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-600 dark:text-gray-300">
                Where professionals come to actually connect, not to share
                inspirational quotes or humble brag about their morning
                routines.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => handleTransition(e, "/app", router)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Start Real Networking <ArrowRight className="h-5 w-5" />
              </motion.button>
            </motion.div>
          </motion.div>
        </section>

        {/* Stats */}
        <section className="bg-gray-50 py-20 dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 md:grid-cols-4">
              <StatCard
                icon={UserCheck}
                value="50K+"
                label="BS-Free Conversations"
                delay={0.1}
              />
              <StatCard
                icon={Clock}
                value="92%"
                label="Less Cringe Than LinkedIn"
                delay={0.2}
              />
              <StatCard
                icon={Activity}
                value="0"
                label="Humble Brags Allowed"
                delay={0.3}
              />
              <StatCard
                icon={Globe}
                value="120+"
                label="Countries Tired of LinkedIn"
                delay={0.4}
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
                Features That Actually Matter
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                No fluff. No filler. Just real connection tools.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: Timer,
                  title: "5-Minute Calls",
                  description:
                    "Because 'quick coffee chats' are never quick. Get straight to the point.",
                },
                {
                  icon: Users,
                  title: "Smart Matching",
                  description:
                    "Like dating apps, but for people who want to talk about more than their Myers-Briggs.",
                },
                {
                  icon: Shield,
                  title: "BS Detection",
                  description:
                    "Our AI flags corporate buzzwords faster than you can say 'synergy'.",
                },
                {
                  icon: MessageSquare,
                  title: "Real Talk Only",
                  description:
                    "Save the weather small talk for your next awkward elevator ride.",
                },
                {
                  icon: Award,
                  title: "Trust Score",
                  description:
                    "Earned by being interesting, not by posting motivational quotes.",
                },
                {
                  icon: TrendingUp,
                  title: "Actual Growth",
                  description:
                    "Track connections that matter, not your endorsement count.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <FeatureCard {...feature} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="bg-gray-50 py-20 dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
                What Real Humans Say
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                No paid testimonials. Just honest feedback.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  name: "Sarah K.",
                  role: "Reformed LinkedIn Influencer",
                  text: "Found my co-founder in 5 minutes. My LinkedIn connection requests are still pending.",
                  rating: 5,
                },
                {
                  name: "Alex T.",
                  role: "Professional Human",
                  text: "Finally, networking that doesn't feel like a bad LinkedIn post.",
                  rating: 5,
                },
                {
                  name: "Mike R.",
                  role: "Ex-Corporate Buzzword Expert",
                  text: "Turns out, real conversations work better than 'touching base' emails.",
                  rating: 5,
                },
              ].map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900"
                >
                  <div className="mb-4 flex gap-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-current text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="mb-4 text-gray-600 dark:text-gray-300">
                    &quot;{testimonial.text}&quot;
                  </p>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {testimonial.name}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      {testimonial.role}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="mx-auto max-w-4xl text-center"
            >
              <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                Ready for Real Professional Growth?
              </h2>
              <p className="mb-8 text-xl text-gray-600 dark:text-gray-300">
                Join thousands of professionals building meaningful connections
                through authentic conversations.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Start Your Journey <ArrowRight className="h-5 w-5" />
              </motion.button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-12 dark:border-gray-800">
          <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-300">
            © {new Date().getFullYear()} LinkUp. All rights reserved. No
            corporate jargon was harmed in the making of this site.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
