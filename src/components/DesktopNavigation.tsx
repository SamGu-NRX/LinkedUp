import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BarChart2, User, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/shadcn"

const navItems = [
  { name: "Home", href: "/", icon: Home },
  { name: "Dashboard", href: "/dashboard", icon: BarChart2 },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function DesktopNavigation() {
  const pathname = usePathname()

  return (
    <nav className="flex h-full flex-col bg-gray-900 text-white">
      <div className="flex h-16 shrink-0 items-center px-6">
        <h1 className="text-2xl font-bold">LinkUp</h1>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-2 py-2 text-sm font-medium",
                pathname === item.href ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white",
              )}
            >
              <item.icon className="mr-3 h-6 w-6 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="shrink-0 px-4 py-4">
        <button className="group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white">
          <LogOut className="mr-3 h-6 w-6 flex-shrink-0" aria-hidden="true" />
          Log out
        </button>
      </div>
    </nav>
  )
}

