"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/shadcn";

const navItems = [
  { name: "Home", href: "/app/", icon: Home },
  { name: "Dashboard", href: "/app/dashboard", icon: BarChart2 },
  { name: "Profile", href: "/app/profile", icon: User },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col border-r border-gray-100 bg-white">
      <div className="flex flex-1 flex-col overflow-y-auto pb-4 pt-5">
        <div className="space-y-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
                pathname === item.href
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50 hover:text-blue-600",
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200",
                  pathname === item.href
                    ? "text-blue-600"
                    : "text-gray-400 group-hover:text-blue-600",
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="shrink-0 px-3 pb-5">
        <button className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 hover:text-red-600">
          <LogOut
            className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 transition-colors duration-200 group-hover:text-red-600"
            aria-hidden="true"
          />
          Log out
        </button>
      </div>
    </nav>
  );
}
