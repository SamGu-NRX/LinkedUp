"use client";

import React, { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Phone,
  Shield,
  Zap,
  Users,
  Star,
  ArrowRight,
  Timer,
  MessageSquare,
  Target,
  Award,
  TrendingUp,
  ChevronRight,
  UserCheck,
  Globe,
  Clock,
  Activity,
  Sun,
  Moon,
} from "lucide-react";
import { handleTransition } from "@/utils/TransitionLink";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  SignedOut,
  SignInButton,
  SignUpButton,
  SignedIn,
  UserButton,
} from "@clerk/nextjs";

// Retention data for the chart
const retentionData = [
  { month: "Jan", rate: 85 },
  { month: "Feb", rate: 87 },
  { month: "Mar", rate: 89 },
  { month: "Apr", rate: 92 },
  { month: "May", rate: 94 },
  { month: "Jun", rate: 95 },
];

// MacBook Component with improved transitions
const MacbookScroll = () => {
  const { scrollYProgress } = useScroll();

  const scale = useTransform(scrollYProgress, [0, 0.3], [0.8, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [0.5, 1]);
  const translateY = useTransform(scrollYProgress, [0, 0.3], [100, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 0.3], [20, 0]);

  return (
    <div className="flex h-[60vh] items-center justify-center overflow-hidden bg-linear-to-b from-white to-emerald-50 md:h-[80vh] dark:from-gray-900 dark:to-gray-800">
      <motion.div
        style={{
          scale,
          opacity,
          y: translateY,
          rotateX,
          perspective: "1000px",
        }}
        className="relative w-full max-w-4xl"
      >
        <div className="relative aspect-16/10 w-full overflow-hidden rounded-t-xl border-[8px] border-b-0 border-gray-800 bg-gray-900 shadow-2xl">
          <img
            src="landerimage.png"
            alt="App Interface Screenshot"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="h-6 w-full rounded-b-xl bg-gray-800"></div>
        <div className="mx-auto h-1 w-[40%] rounded-b-xl bg-gray-700"></div>
      </motion.div>
    </div>
  );
};

// Improved Stat Card component
interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  delay: number;
}

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  value,
  label,
  delay,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-lg transition-all duration-300 hover:border-emerald-200 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-800"
  >
    <div className="flex items-center gap-4">
      <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/30">
        <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h4 className="mb-1 text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </h4>
        <p className="text-gray-600 dark:text-gray-300">{label}</p>
      </div>
    </div>
  </motion.div>
);

// Improved Feature Card component
interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon: Icon,
  index,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1, duration: 0.5 }}
    whileHover={{ y: -5, scale: 1.02 }}
    className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-lg transition-all duration-300 hover:border-emerald-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-800"
  >
    <div className="mb-4 w-fit rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/30">
      <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
    </div>
    <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-300">{description}</p>
  </motion.div>
);

// Improved Testimonial Card component
interface TestimonialCardProps {
  name: string;
  role: string;
  text: string;
  rating: number;
  index: number;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
  name,
  role,
  text,
  rating,
  index,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.2, duration: 0.5 }}
    className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-lg transition-all duration-300 hover:border-emerald-200 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-800"
  >
    <div className="mb-4 flex gap-1">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="h-5 w-5 fill-current text-emerald-400" />
      ))}
    </div>
    <p className="mb-4 text-gray-600 italic dark:text-gray-300">
      &quot;{text}&quot;
    </p>
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400">
        {name.charAt(0)}
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{role}</p>
      </div>
    </div>
  </motion.div>
);

// Floating Shapes Component for hero background animation
const FloatingShapes = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: [0.1, 0.3, 0.1],
          scale: [1, 1.2, 1],
          x: [0, 20, 0],
          y: [0, -30, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 15,
          ease: "easeInOut",
        }}
        className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: [0.1, 0.2, 0.1],
          scale: [1, 1.1, 1],
          x: [0, -20, 0],
          y: [0, 30, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 20,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute top-40 -left-40 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: [0.05, 0.15, 0.05],
          scale: [1, 1.3, 1],
          x: [0, 30, 0],
          y: [0, 40, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 25,
          ease: "easeInOut",
          delay: 5,
        }}
        className="absolute -bottom-40 left-40 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl"
      />
    </div>
  );
};

// Main Landing Page component
const LandingPage = () => {
  const [theme, setTheme] = useState("light");
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 1000], [0, -150]);
  const router = useRouter();

  // Initialize theme from local storage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") || "light";
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark");
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }
  };

  // Smooth scroll function: URGENT TODO: SWITCH TO LENIS
  const scrollToSection = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "dark" : ""}`}>
      <div className="bg-white transition-colors duration-300 dark:bg-gray-900">
        {/* Improved Nav */}
        <nav className="fixed top-0 z-50 w-full border-b border-emerald-100 bg-white/90 backdrop-blur-xl transition-all duration-300 dark:border-gray-800 dark:bg-gray-900/90">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            {/* Logo that changes based on theme */}
            <div className="flex items-center gap-2">
              {/* Logo that changes based on theme */}
              {theme === "light" ? (
                <Image
                  src="/linkeduplogos/linkedupblack.png"
                  alt="LinkedUp Logo"
                  width={40}
                  height={40}
                  className="h-10 w-auto"
                />
              ) : (
                <Image
                  src="/linkeduplogos/linkedupwhite.png"
                  alt="LinkedUp Logo"
                  width={40}
                  height={40}
                  className="h-10 w-auto"
                />
              )}
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                LinkedUp
              </span>
            </div>

            <div className="hidden items-center gap-8 md:flex">
              <button
                onClick={() => scrollToSection("features")}
                className="text-gray-600 transition-colors hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("testimonials")}
                className="text-gray-600 transition-colors hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400"
              >
                Testimonials
              </button>
              <button
                onClick={() => scrollToSection("pricing")}
                className="text-gray-600 transition-colors hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400"
              >
                Pricing
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="rounded-full p-2 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                aria-label="Toggle theme"
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Sun className="h-5 w-5 text-emerald-400" />
                )}
              </button>

              <motion.a
                href="/app"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-colors duration-300 hover:bg-emerald-700 hover:shadow-lg"
                onClick={(e) => handleTransition(e, "/app", router)}
              >
                Start Connecting
              </motion.a>
            </div>
          </div>
        </nav>

        {/* Improved Hero Section */}
        <section className="relative flex min-h-screen items-center pt-32 pb-16 md:pb-0">
          <FloatingShapes />

          <div className="relative container mx-auto px-6 pt-12 pb-32">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mx-auto max-w-4xl text-center"
            >
              <div className="mb-6 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                Professional networking reimagined
              </div>

              <h1 className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl lg:text-7xl dark:text-white">
                Professional Networking
                <br />
                <span className="bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Without the BS.
                </span>
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-xl text-gray-600 dark:text-gray-300">
                Where professionals come to actually connect, not to share
                inspirational quotes or humble brag about their morning
                routines.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <motion.a
                  href="/app"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => handleTransition(e, "/app", router)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-4 font-medium text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg sm:w-auto"
                >
                  Start Real Networking <ArrowRight className="h-5 w-5" />
                </motion.a>

                <motion.button
                  onClick={() => scrollToSection("how-it-works")}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-8 py-4 font-medium text-gray-800 shadow-md transition-all hover:bg-emerald-50 hover:shadow-lg sm:w-auto dark:border-emerald-800 dark:bg-gray-800 dark:text-white dark:hover:bg-emerald-900/20"
                >
                  See How It Works <ChevronRight className="h-5 w-5" />
                </motion.button>
              </div>
            </motion.div>

            {/* Smooth transition to next section */}
          </div>
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 hidden -translate-x-1/2 transform md:block"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex h-10 w-6 justify-center rounded-full border-2 border-emerald-400 dark:border-emerald-500"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="mt-2 h-2 w-2 rounded-full bg-emerald-400 dark:bg-emerald-500"
            />
          </motion.div>
        </motion.div>

        {/* MacBook Scroll Component */}
        <MacbookScroll />

        {/* Improved Stats Section */}
        <section className="bg-linear-to-b from-emerald-50 to-white py-20 dark:from-gray-800/50 dark:to-gray-900">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-12 text-center"
            >
              <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
                Why professionals choose LinkedUp
              </h2>
              <div className="mx-auto h-1 w-20 rounded-full bg-emerald-600"></div>
            </motion.div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                value="4.8/5"
                label="User Satisfaction"
                delay={0.3}
              />
              <StatCard
                icon={Globe}
                value="120+"
                label="Countries Represented"
                delay={0.4}
              />
            </div>
          </div>
        </section>

        {/* Improved Features Section */}
        <section id="features" className="py-20">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-16 max-w-3xl text-center"
            >
              <div className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                What makes us different
              </div>
              <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                Features That Actually Matter
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                No fluff. No filler. Just real connection tools.
              </p>
            </motion.div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
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
                <FeatureCard key={index} {...feature} index={index} />
              ))}
            </div>
          </div>
        </section>

        {/* Improved Social Proof Section */}
        <section
          id="testimonials"
          className="bg-linear-to-b from-white to-emerald-50 py-20 dark:from-gray-900 dark:to-gray-800/50"
        >
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-16 max-w-3xl text-center"
            >
              <div className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                {`Don't take our word for it`}
              </div>
              <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                What Real Humans Say
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                No paid testimonials. Just honest feedback.
              </p>
            </motion.div>

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
                  text: "Finally, networking that doesn't feel like a bad LinkedIn post. Actually made meaningful connections.",
                  rating: 5,
                },
                {
                  name: "Mike R.",
                  role: "Ex-Corporate Buzzword Expert",
                  text: "Turns out, real conversations work better than 'touching base' emails. Who knew?",
                  rating: 5,
                },
              ].map((testimonial, index) => (
                <TestimonialCard key={index} {...testimonial} index={index} />
              ))}
            </div>
          </div>
        </section>

        {/* Retention Data Visualization */}
        <section className="py-20">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-12 max-w-3xl text-center"
            >
              <div className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                Users stick around
              </div>
              <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                Industry-Leading Retention
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                People who join LinkedUp actually keep using it. Imagine that.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="mb-12 rounded-2xl border border-emerald-100 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={retentionData}>
                    <XAxis
                      dataKey="month"
                      stroke={theme === "dark" ? "#94a3b8" : "#64748b"}
                    />
                    <YAxis stroke={theme === "dark" ? "#94a3b8" : "#64748b"} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor:
                          theme === "dark" ? "#1e293b" : "#ffffff",
                        borderColor: theme === "dark" ? "#334155" : "#e2e8f0",
                        color: theme === "dark" ? "#f8fafc" : "#0f172a",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="Retention %"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{
                        r: 6,
                        strokeWidth: 2,
                        fill: theme === "dark" ? "#1e293b" : "#ffffff",
                      }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Improved CTA Section */}
        <section
          id="pricing"
          className="bg-linear-to-r from-emerald-600 to-teal-600 py-20 text-white"
        >
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="mx-auto max-w-4xl text-center"
            >
              <h2 className="mb-6 text-4xl font-bold">
                Ready for Real Professional Growth?
              </h2>
              <p className="mb-10 text-xl text-emerald-100">
                Join thousands of professionals building meaningful connections
                through authentic conversations.
              </p>
              <motion.a
                href="/app"
                onClick={(e) => handleTransition(e, "/app", router)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-medium text-emerald-600 shadow-md transition-all hover:bg-gray-100 hover:shadow-lg"
              >
                Start Your Journey <ArrowRight className="h-5 w-5" />
              </motion.a>
            </motion.div>
          </div>
        </section>

        {/* Improved Footer */}
        <footer className="border-t border-emerald-100 py-12 dark:border-gray-800">
          <div className="container mx-auto px-6">
            <div className="flex flex-col items-center justify-between md:flex-row">
              <div className="mb-6 flex items-center md:mb-0">
                {theme === "light" ? (
                  <Image
                    src="/linkeduplogos/linkedupblack.png"
                    alt="LinkedUp Logo"
                    width={40}
                    height={40}
                    className="h-10 w-auto"
                  />
                ) : (
                  <Image
                    src="/linkeduplogos/linkedupwhite.png"
                    alt="LinkedUp Logo"
                    width={40}
                    height={40}
                    className="h-10 w-auto"
                  />
                )}
                <span className="pl-2 text-xl font-bold text-gray-900 dark:text-white">
                  LinkedUp
                </span>
              </div>

              <div className="text-center text-gray-600 md:text-right dark:text-gray-300">
                © {new Date().getFullYear()} LinkedUp. All rights reserved.
                <div className="mt-1 text-sm">
                  No corporate jargon was harmed in the making of this site.
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
