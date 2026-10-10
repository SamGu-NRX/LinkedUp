"use client";

import React, { useState, useEffect } from "react";
import {
  motion,
  MotionConfig,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Moon,
  Sun,
  Users,
  Video,
} from "lucide-react";
import { handleTransition } from "@/utils/TransitionLink";
import { useRouter } from "next/navigation";
import Image from "next/image";

const REPO_URL = "https://github.com/SamGu-NRX/LinkedUp";
const CONNVO_URL = "https://github.com/SamGu-NRX/Connvo";

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
            alt="The LinkedUp meeting room: two participant tiles, a discussion prompt, meeting notes, and the time remaining"
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
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
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

// Capability Card component
interface CapabilityCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  index: number;
}

const CapabilityCard: React.FC<CapabilityCardProps> = ({
  icon: Icon,
  title,
  description,
  index,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
    transition={{ delay: index * 0.1, duration: 0.5 }}
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

  // Smooth scroll, unless the visitor asked for reduced motion.
  const scrollToSection = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: element.offsetTop - 100,
        behavior: reduce ? "auto" : "smooth",
      });
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`min-h-screen ${theme === "dark" ? "dark" : ""}`}
      >
        <div className="bg-white transition-colors duration-300 dark:bg-gray-900">
          {/* Nav */}
          <nav className="fixed top-0 z-50 w-full border-b border-emerald-100 bg-white/90 backdrop-blur-xl transition-all duration-300 dark:border-gray-800 dark:bg-gray-900/90">
            <div className="container mx-auto flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2">
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
                  onClick={() => scrollToSection("what-it-is")}
                  className="rounded-full px-3 py-1 text-gray-600 transition-colors hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400"
                >
                  What it is
                </button>
                <button
                  onClick={() => scrollToSection("how-it-works")}
                  className="rounded-full px-3 py-1 text-gray-600 transition-colors hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400"
                >
                  How it works
                </button>
                <button
                  onClick={() => scrollToSection("where-it-stands")}
                  className="rounded-full px-3 py-1 text-gray-600 transition-colors hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400"
                >
                  Where it stands
                </button>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={toggleTheme}
                  className="rounded-full p-2 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:bg-emerald-900/30"
                  aria-label="Toggle theme"
                >
                  {theme === "light" ? (
                    <Moon className="h-5 w-5 text-emerald-700" />
                  ) : (
                    <Sun className="h-5 w-5 text-emerald-400" />
                  )}
                </button>

                <motion.a
                  href="/app"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full bg-emerald-800 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-colors duration-300 hover:bg-emerald-900 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  onClick={(e) => handleTransition(e, "/app", router)}
                >
                  Open the demo
                </motion.a>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative flex min-h-screen items-center pt-32 pb-16 md:pb-0">
            <FloatingShapes />

            <div className="relative container mx-auto px-6 pt-12 pb-32">
              <motion.div
                data-kgu-intro
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mx-auto max-w-4xl text-center"
              >
                <div className="mb-6 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  Maintained in the open · the demo lives in this repo
                </div>

                <h1 className="mb-6 text-5xl font-bold text-gray-900 md:text-6xl lg:text-7xl dark:text-white">
                  Professional Networking
                  <br />
                  <span className="bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Without the BS.
                  </span>
                </h1>

                <p className="mx-auto mb-6 max-w-2xl text-xl text-gray-600 dark:text-gray-300">
                  LinkedUp matches two people on what their interests mean,
                  then puts them straight into a one-on-one video call. Built
                  for a hackathon in 2025, kept alive in this repository, and
                  open to try right now.
                </p>

                <p className="mx-auto mb-10 text-sm text-gray-700 dark:text-gray-300">
                  Second place overall, iSTEM@Stevens Hacks 2025 · piloted with
                  more than 40 users
                </p>

                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <motion.a
                    href="/app"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => handleTransition(e, "/app", router)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-8 py-4 font-medium text-white shadow-md transition-all hover:bg-emerald-900 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:w-auto"
                  >
                    Open the demo <ArrowRight className="h-5 w-5" />
                  </motion.a>

                  <motion.button
                    onClick={() => scrollToSection("how-it-works")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-8 py-4 font-medium text-gray-800 shadow-md transition-all hover:bg-emerald-50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:w-auto dark:border-emerald-800 dark:bg-gray-800 dark:text-white dark:hover:bg-emerald-900/20"
                  >
                    See how it works <ChevronRight className="h-5 w-5" />
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Scroll cue */}
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

          <p className="mx-auto -mt-10 max-w-2xl px-6 text-center text-sm text-gray-500 dark:text-gray-400">
            The picture above is the real simulated meeting room from this
            repository: mock participants, discussion prompts drawn from both
            people&apos;s interests, shared notes, chat, and the
            meeting-time manager.
          </p>

          {/* What it is */}
          <section
            id="what-it-is"
            className="bg-linear-to-b from-emerald-50 to-white py-20 dark:from-gray-800/50 dark:to-gray-900"
          >
            <div className="container mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mx-auto mb-16 max-w-3xl text-center"
              >
                <div className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  What it is
                </div>
                <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                  Networking without the feed
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  You pick your interests, it finds the person whose interests
                  mean the closest thing to yours, and it skips the message
                  thread. Here is what that is made of.
                </p>
              </motion.div>

              <div className="grid gap-8 md:grid-cols-3">
                <CapabilityCard
                  index={0}
                  icon={CalendarCheck}
                  title="Sign-in and onboarding"
                  description="Clerk gates every route. A five-step wizard validates each field with zod and writes your profile and interests to Postgres through Drizzle, and only marks onboarding complete after every write succeeds."
                />
                <CapabilityCard
                  index={1}
                  icon={Users}
                  title="The match queue"
                  description="Casual or professional mode, with B2B, collaboration, mentorship, and investment variants. In this repository the queue runs on mock data; the original pilot matched interests as embeddings in Postgres with pgvector."
                />
                <CapabilityCard
                  index={2}
                  icon={Video}
                  title="The call room"
                  description="The room at /videocall/[id] simulates the meeting: discussion prompts, notes, chat, an elapsed clock, low-time warnings, extension requests with a cooldown, and a hard 20-minute cap."
                />
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" className="py-20">
            <div className="container mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mx-auto mb-16 max-w-3xl text-center"
              >
                <div className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  How it works
                </div>
                <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                  Four steps to a conversation
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  Every step below is something the repository actually
                  implements.
                </p>
              </motion.div>

              <ol className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
                {[
                  "Sign in and finish the five-step onboarding wizard, saved to Postgres.",
                  "Pick the interests that describe you, in your own words.",
                  "Join a queue: casual, or a professional mode like mentorship.",
                  "Accept a match and the simulated room opens with prompts ready.",
                ].map((step, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    className="flex items-start gap-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-800 font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 dark:text-gray-300">{step}</p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </section>

          {/* Where it stands: the honest ledger */}
          <section
            id="where-it-stands"
            className="bg-linear-to-b from-white to-emerald-50 py-20 dark:from-gray-900 dark:to-gray-800/50"
          >
            <div className="container mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mx-auto mb-16 max-w-3xl text-center"
              >
                <div className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  Where it stands
                </div>
                <h2 className="mb-6 text-4xl font-bold text-gray-900 dark:text-white">
                  The honest ledger
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300">
                  LinkedUp is the maintained predecessor: this repository is
                  the live home of the project. Here is exactly what runs and
                  what does not, so you never have to guess.
                </p>
              </motion.div>

              <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-lg dark:border-emerald-800 dark:bg-gray-800"
                >
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                    <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Runs for real in this repo
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li>Clerk sign-in and sign-up routes, gated by middleware.</li>
                    <li>Five-step onboarding persisted to Postgres.</li>
                    <li>Queue, dashboard, profile, and settings screens.</li>
                    <li>The simulated call room with its time manager.</li>
                    <li>Light and dark theme.</li>
                  </ul>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                >
                  <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                    <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Simulated or dormant, stated plainly
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                    <li>
                      Participants and matching are mock data; there is no ML
                      matching service in this repository.
                    </li>
                    <li>
                      The Stream-backed live room was removed; its SDKs are
                      kept for a future real room.
                    </li>
                    <li>
                      Modes beyond one-on-one networking have placeholder
                      screens, and none of them work yet.
                    </li>
                    <li>This page promises no live deployment and no new product.</li>
                  </ul>
                </motion.div>
              </div>

              {/* Counts, honestly derived */}
              <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-4">
                <StatCard icon={ClipboardList} value="5" label="Onboarding steps" delay={0.1} />
                <StatCard icon={Video} value="1" label="Simulated meeting room" delay={0.2} />
                <StatCard icon={Users} value="40+" label="Users in the 2025 pilot" delay={0.3} />
                <StatCard icon={CalendarCheck} value="2nd" label="iSTEM@Stevens Hacks 2025" delay={0.4} />
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mx-auto mt-10 max-w-3xl text-center text-gray-500 dark:text-gray-400"
              >
                LinkedUp was built by a five-person team led by Sam Gu and
                placed second overall at iSTEM@Stevens Hacks 2025; the pilot
                with more than 40 users showed 140% higher match satisfaction.
                The repository&apos;s list of what comes next is still open:
                meeting modes beyond one-on-one networking, better matching,
                and machine-learning moderation. This page does not advertise
                that work as done. The same team&apos;s successor project,{" "}
                <a
                  href={CONNVO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Connvo
                </a>
                , is in development in its own public repository. LinkedUp is
                the hackathon build you can run today; nothing here is a sign
                up for Connvo, and this page makes no claims about Connvo&apos;s
                features or timeline.
              </motion.p>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-linear-to-r from-emerald-700 to-teal-700 py-20 text-white">
            <div className="container mx-auto px-6">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="mx-auto max-w-4xl text-center"
              >
                <h2 className="mb-6 text-4xl font-bold">
                  Open the demo yourself
                </h2>
                <p className="mb-10 text-xl text-emerald-100">
                  Sign in, finish onboarding, join a queue, and the simulated
                  room opens. The full source is on GitHub, and every claim on
                  this page traces to it.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <motion.a
                    href="/app"
                    onClick={(e) => handleTransition(e, "/app", router)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-medium text-emerald-700 shadow-md transition-all hover:bg-gray-100 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Open the demo <ArrowRight className="h-5 w-5" />
                  </motion.a>
                  <motion.a
                    href={REPO_URL}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/60 px-8 py-4 font-medium text-white transition-all hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Read the source
                  </motion.a>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Footer */}
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
                  © {new Date().getFullYear()} LinkedUp. Built by a
                  five-person team at iSTEM@Stevens Hacks 2025, maintained in
                  the open.{" "}
                  <a
                    href={REPO_URL}
                    className="rounded text-emerald-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400"
                  >
                    Source on GitHub
                  </a>
                  .
                  <div className="mt-1 text-sm">
                    No corporate jargon was harmed in the making of this site.
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
};

export default LandingPage;
