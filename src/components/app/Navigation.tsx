import type React from "react"
import { TransitionLink } from "@/utils/TransitionLink"
import { Home, BarChart2, User, Settings } from "lucide-react"
import { utils } from "@/styles/utils"

const Navigation: React.FC = () => {
  return (
    <nav
      className={`${utils.cardBg} fixed bottom-0 left-0 right-0 flex justify-around py-4 md:py-6`}
    >
      <TransitionLink
        href="/app/home"
        className={`${utils.textPrimary} flex flex-col items-center`}
      >
        <Home size={24} />
        <span className="mt-1 text-xs">Home</span>
      </TransitionLink>
      <TransitionLink
        href="/app/dashboard"
        className={`${utils.textPrimary} flex flex-col items-center`}
      >
        <BarChart2 size={24} />
        <span className="mt-1 text-xs">Dashboard</span>
      </TransitionLink>
      <TransitionLink
        href="/app/profile"
        className={`${utils.textPrimary} flex flex-col items-center`}
      >
        <User size={24} />
        <span className="mt-1 text-xs">Profile</span>
      </TransitionLink>
      <TransitionLink
        href="/app/settings"
        className={`${utils.textPrimary} flex flex-col items-center`}
      >
        <Settings size={24} />
        <span className="mt-1 text-xs">Settings</span>
      </TransitionLink>
    </nav>
  );
}

export default Navigation

