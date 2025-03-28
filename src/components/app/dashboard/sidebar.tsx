"use client";
import { TransitionLink } from "@/utils/TransitionLink";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, BarChart2, User, Settings, LogOut } from "lucide-react";
import Image from "next/image"; // Import Image component

const navItems = [
  { name: "Home", href: "/app", icon: Home },
  { name: "Dashboard", href: "/app/dashboard", icon: BarChart2 },
  { name: "Profile", href: "/app/profile", icon: User },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-gray-100/40 dark:bg-gray-800/40 lg:block">
      <div className="flex h-full flex-col gap-2">
        <div className="flex h-[60px] items-center border-b px-6">
          <TransitionLink className="flex items-center gap-2 font-semibold" href="/app">
            <Image src="/logo.png" alt="Logo" width={30} height={30} /> {/* Add logo */}
            <span className="text-2xl font-bold">LinkedUp</span>
          </TransitionLink>
        </div>
        <ScrollArea className="flex-1 px-3 max-h-[calc(100vh-120px)]"> {/* Adjust height */}
          <div className="space-y-1 py-2">
            {navItems.map((item) => (
              <Button
                key={item.name}
                asChild
                variant={pathname === item.href ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <TransitionLink href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </TransitionLink>
              </Button>
            ))}
          </div>
        </ScrollArea>
        <div className="mt-auto p-4">
          <Button variant="outline" className="w-full" asChild>
            <TransitionLink href="/signout">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </TransitionLink>
          </Button>
        </div>
      </div>
    </div>
  );
}
