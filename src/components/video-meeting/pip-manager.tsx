// New component to handle PIP functionality
"use client"

import type React from "react"

import { useState, useCallback } from "react"
import type { User, ConnectionState } from "@/types/meeting"
import { ConnectionBadge } from "./connection-badge"

interface PipManagerProps {
  mainUser: User
  secondaryUser: User
  mainConnection: ConnectionState
  secondaryConnection: ConnectionState
  onSwap: () => void
}

export function PipManager({ mainUser, secondaryUser, mainConnection, secondaryConnection, onSwap }: PipManagerProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleSwap = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSwap()
    },
    [onSwap],
  )

  return (
    <>
      {/* Main Video */}
      <div className="relative h-full w-full rounded-xl overflow-hidden bg-zinc-900">
        <div className="absolute bottom-4 left-4 z-10">
          <ConnectionBadge status={mainConnection.status} latency={mainConnection.latency} name={mainUser.name} />
        </div>
      </div>

      {/* PiP Video */}
      <div
        className="absolute bottom-4 right-4 h-32 w-48 rounded-lg overflow-hidden bg-zinc-800 shadow-lg z-20 transition-all duration-200"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleSwap}
      >
        <div className="relative h-full w-full">
          <div className="absolute bottom-2 left-2 z-10">
            <div className="scale-90">
              <ConnectionBadge status={secondaryConnection.status} latency={secondaryConnection.latency} name={secondaryUser.name} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

