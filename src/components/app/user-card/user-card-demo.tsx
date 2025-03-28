"use client"

import { useState } from "react"
import { UserCard } from "@/components/app/user-card"
import { mockUsers } from "@/data/mock-users"

export default function UserCardDemo() {
  const [activeView, setActiveView] = useState<"default" | "meeting" | "chat">("default")

  return (
    <>
      {mockUsers.map((user) => (
        <div key={user.id} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView("default")}
              className={`rounded-md px-3 py-1 text-sm ${
                activeView === "default" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              Default
            </button>
            <button
              onClick={() => setActiveView("meeting")}
              className={`rounded-md px-3 py-1 text-sm ${
                activeView === "meeting" ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              Meeting
            </button>
            <button
              onClick={() => setActiveView("chat")}
              className={`rounded-md px-3 py-1 text-sm ${activeView === "chat" ? "bg-primary text-white" : "bg-muted"}`}
            >
              Chat
            </button>
          </div>
          <UserCard
            key={user.id}
            user={user}
            inMeeting={activeView === "meeting"}
            inChat={activeView === "chat"}
            onMessage={(message) => console.log(`Message to ${user.name}: ${message}`)}
            onSchedule={(date, duration, topic) =>
              console.log(`Meeting with ${user.name}: ${topic} on ${date.toLocaleString()} for ${duration} minutes`)
            }
          />
        </div>
      ))}
    </>
  )
}
