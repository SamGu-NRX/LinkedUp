"use client";

import React, { useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Phone, Shield, Zap, Users, Star, ArrowRight, Timer, 
  MessageSquare, Target, Award, TrendingUp, ChevronRight,
  UserCheck, Globe, Clock, Activity, Sun, Moon
} from 'lucide-react';

const retentionData = [
  { month: 'Jan', rate: 85 },
  { month: 'Feb', rate: 87 },
  { month: 'Mar', rate: 89 },
  { month: 'Apr', rate: 92 },
  { month: 'May', rate: 94 },
  { month: 'Jun', rate: 95 }
];

const StatCard = ({ icon: Icon, value, label, delay }) => (
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

const FeatureCard = ({ title, description, icon: Icon, color = "blue" }) => (
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

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 transition-colors duration-300">
        {/* Nav */}
        <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-50 border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">LinkUp</span>
            <div className="flex items-center gap-6">
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                {theme === 'light' ? 
                  <Moon className="w-5 h-5" /> : 
                  <Sun className="w-5 h-5 text-white" />
                }
              </button>
              <button className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90">
                Start Connecting
              </button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="min-h-screen flex items-center relative overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="container mx-auto px-4 py-20 relative"
          >
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl mx-auto text-center"
            >
              <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gray-900 dark:text-white">
                Professional Networking
                <br />
                <span className="text-blue-600">Without the BS.</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
                Where professionals come to actually connect, not to share inspirational quotes or humble brag about their morning routines.
              </p>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                Start Real Networking <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </motion.div>
        </section>

        {/* Stats */}
        <section className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-6">
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
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                Features That Actually Matter
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                No fluff. No filler. Just real connection tools.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Timer,
                  title: "5-Minute Calls",
                  description: "Because 'quick coffee chats' are never quick. Get straight to the point."
                },
                {
                  icon: Users,
                  title: "Smart Matching",
                  description: "Like dating apps, but for people who want to talk about more than their Myers-Briggs."
                },
                {
                  icon: Shield,
                  title: "BS Detection",
                  description: "Our AI flags corporate buzzwords faster than you can say 'synergy'."
                },
                {
                  icon: MessageSquare,
                  title: "Real Talk Only",
                  description: "Save the weather small talk for your next awkward elevator ride."
                },
                {
                  icon: Award,
                  title: "Trust Score",
                  description: "Earned by being interesting, not by posting motivational quotes."
                },
                {
                  icon: TrendingUp,
                  title: "Actual Growth",
                  description: "Track connections that matter, not your endorsement count."
                }
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
        <section className="py-20 bg-gray-50 dark:bg-gray-800">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                What Real Humans Say
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                No paid testimonials. Just honest feedback.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Sarah K.",
                  role: "Reformed LinkedIn Influencer",
                  text: "Found my co-founder in 5 minutes. My LinkedIn connection requests are still pending.",
                  rating: 5
                },
                {
                  name: "Alex T.",
                  role: "Professional Human",
                  text: "Finally, networking that doesn't feel like a bad LinkedIn post.",
                  rating: 5
                },
                {
                  name: "Mike R.",
                  role: "Ex-Corporate Buzzword Expert",
                  text: "Turns out, real conversations work better than 'touching base' emails.",
                  rating: 5
                }
              ].map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">"{testimonial.text}"</p>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
                    <p className="text-gray-500 dark:text-gray-400">{testimonial.role}</p>
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
              className="max-w-4xl mx-auto text-center"
            >
              <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
                Ready for Real Professional Growth?
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Join thousands of professionals building meaningful connections through authentic conversations.
              </p>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                Start Your Journey <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-300">
            © {new Date().getFullYear()} LinkUp. All rights reserved. No corporate jargon was harmed in the making of this site.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;