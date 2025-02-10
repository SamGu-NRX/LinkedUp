import type React from "react"
import Link from "next/link"
import { Home, BarChart2, User, Settings } from "lucide-react"
import { utils } from "@/styles/utils"

const Navigation: React.FC = () => {
  return (
    <nav className={`${utils.cardBg} fixed bottom-0 left-0 right-0 flex justify-around py-4 md:py-6`}>
      <Link href="/home" className={`${utils.textPrimary} flex flex-col items-center`}>
        <Home size={24} />
        <span className="text-xs mt-1">Home</span>
      </Link>
      <Link href="/dashboard" className={`${utils.textPrimary} flex flex-col items-center`}>
        <BarChart2 size={24} />
        <span className="text-xs mt-1">Dashboard</span>
      </Link>
      <Link href="/profile" className={`${utils.textPrimary} flex flex-col items-center`}>
        <User size={24} />
        <span className="text-xs mt-1">Profile</span>
      </Link>
      <Link href="/settings" className={`${utils.textPrimary} flex flex-col items-center`}>
        <Settings size={24} />
        <span className="text-xs mt-1">Settings</span>
      </Link>
    </nav>
  )
}

export default Navigation

