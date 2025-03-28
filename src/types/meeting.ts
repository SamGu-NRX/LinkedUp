export interface User {
  id: string
  name: string
  avatar: string
  role: string
  company: string
  interests: string[]
  meetingStats: {
    totalMeetings: number
    totalMinutes: number
    averageRating: number
  }
}

export interface Message {
  id: string
  sender: string
  message: string
  timestamp: string
}

export interface TimeRequest {
  id: string
  requester: string
  timestamp: string
  status: "pending" | "accepted" | "rejected"
}

export interface SpeakingState {
  [key: string]: boolean
}

export type ConnectionStatus = "excellent" | "good" | "poor" | "offline"

export interface ConnectionState {
  status: ConnectionStatus
  latency: number
}

export const CONNECTION_STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string }> = {
  excellent: { color: "bg-green-500", label: "Excellent Connection" },
  good: { color: "bg-blue-500", label: "Good Connection" },
  poor: { color: "bg-yellow-500", label: "Poor Connection" },
  offline: { color: "bg-red-500", label: "Offline" },
}

export const MOCK_USERS: { [key: string]: User } = {
  you: {
    id: "you",
    name: "You",
    avatar: "/placeholder.svg",
    role: "Product Manager",
    company: "TechCorp",
    interests: ["product strategy", "user research", "agile", "design thinking", "analytics"],
    meetingStats: {
      totalMeetings: 156,
      totalMinutes: 4680,
      averageRating: 4.8,
    },
  },
  partner: {
    id: "partner",
    name: "John Doe",
    avatar: "/placeholder.svg",
    role: "Senior Engineer",
    company: "TechCorp",
    interests: ["system design", "cloud architecture", "AI", "blockchain", "security"],
    meetingStats: {
      totalMeetings: 234,
      totalMinutes: 7020,
      averageRating: 4.9,
    },
  },
}

export const MOCK_MESSAGES: Message[] = [
  { id: "1", sender: "John Doe", message: "Hey there!", timestamp: "10:30 AM" },
  { id: "2", sender: "You", message: "Hi! Ready to discuss?", timestamp: "10:31 AM" },
]

export const MOCK_SPEAKING_STATES: SpeakingState = {
  you: false,
  partner: false,
}

// Add to mock data
export const MOCK_CONNECTION_STATES: Record<string, ConnectionState> = {
  you: { status: "excellent", latency: 35 },
  partner: { status: "good", latency: 85 },
}

// Simulate speaking patterns
export function simulateSpeaking() {
  return {
    you: Math.random() > 0.3,
    partner: Math.random() > 0.3,
  }
}

