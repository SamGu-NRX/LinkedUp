"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, User, Settings } from "lucide-react";
import { cn } from "@/lib/shadcn";
import { TransitionLink } from "@/utils/TransitionLink";

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Dashboard", href: "/dashboard", icon: BarChart2 },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <TransitionLink
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center py-2 px-3",
              pathname === item.href ? "text-blue-600" : "text-gray-600 hover:text-blue-600"
            )}
          >
            <item.icon className="h-6 w-6" />
            <span className="text-xs mt-1">{item.name}</span>
          </TransitionLink>
        ))}
      </div>
    </nav>
  );
}

