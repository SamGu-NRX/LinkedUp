
"use client";

import React from "react";
import { TransitionLink } from "@/utils/TransitionLink";
import { usePathname } from "next/navigation";
import {
  Home,
  BarChart2,
  User,
  Settings,
  LogOut,
  Phone,
  MessageSquare,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/shadcn";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";

const navItems = [
  { name: "Home", href: "/app", icon: Home, description: "Go to home page" },
  { name: "Dashboard", href: "/app/dashboard", icon: BarChart2, description: "View analytics dashboard" },
  { name: "Profile", href: "/app/profile", icon: User, description: "Edit your profile" },
  { name: "Settings", href: "/app/settings", icon: Settings, description: "Configure settings" },
];

export function DesktopNavigation() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <nav className="flex h-full flex-col bg-background/50 backdrop-blur-xs transition-colors duration-300">
      <div className="space-y-4 py-6">

        <div className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <TooltipProvider key={item.name}>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <TransitionLink
                      href={item.href}
                      className={cn(
                        "group relative flex h-12 w-full items-center space-x-3 rounded-md px-3",
                        isActive
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="bubble"
                          className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-emerald-400 dark:bg-emerald-300"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}

                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.97 }}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          isActive
                            ? "bg-primary/10"
                            : "bg-muted/40 group-hover:bg-primary/10"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5 transition-colors duration-200")} />
                      </motion.div>

                      <span className="text-sm font-medium">{item.name}</span>
                    </TransitionLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="border border-border/30 bg-background/95 backdrop-blur-xs text-black dark:text-white">
                    {item.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
      <div className=" mt-auto px-3 pb-5">
        <Button className="bg-zinc-200 dark:bg-zinc-900 group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200 hover:bg-gray-50 hover:text-red-600 dark:hover:bg-gray-800 dark:hover:text-red-400">
          <LogOut
            className="mr-3 h-5 w-5 shrink-0 text-gray-600 dark:text-gray-200 transition-colors duration-200 group-hover:text-red-600 dark:group-hover:text-red-400"
            aria-hidden="true"
          />
          Log out
        </Button>
      </div>
    </nav>
  );
}
