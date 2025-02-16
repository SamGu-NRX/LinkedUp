"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Moon, Sun, Home, Users, MessageSquare, Settings, LogOut } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const menuItems = [
  { icon: Home, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Connections", href: "/connections" },
  { icon: MessageSquare, label: "Messages", href: "/messages" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("light")
  const router = useRouter()

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
    document.documentElement.classList.toggle("dark")
  }

  return (
    <SidebarProvider>
      <div className={`min-h-screen ${theme === "dark" ? "dark" : ""}`}>
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
          <Sidebar>
            <SidebarHeader className="p-4">
              <Link href="/" className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                LinkUp
              </Link>
            </SidebarHeader>
            <SidebarContent className="flex flex-col justify-between flex-1">
              <nav className="space-y-2 px-4">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </SidebarContent>
            <SidebarFooter className="p-4">
              <button
                onClick={() => router.push("/logout")}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors w-full"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </SidebarFooter>
          </Sidebar>

          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="bg-white dark:bg-gray-800 shadow-sm">
              <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                  <SidebarTrigger />
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {theme === "light" ? (
                      <Moon className="h-5 w-5 text-gray-800 dark:text-gray-200" />
                    ) : (
                      <Sun className="h-5 w-5 text-gray-800 dark:text-gray-200" />
                    )}
                  </button>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}

