import type { UserInfo } from "@/types/user"

export const mockUsers: UserInfo[] = [
  {
    id: "user1",
    name: "Alex Johnson",
    avatar: null,
    bio: "Product designer with a passion for creating intuitive user experiences. I specialize in design systems and user research methodologies.",
    profession: "Product Designer",
    company: "DesignHub",
    school: "Rhode Island School of Design",
    experience: 7,
    sharedInterests: [
      { type: "industry", name: "UX Design" },
      { type: "skill", name: "Figma" },
      { type: "academic", name: "HCI" },
    ],
    connectionType: "collaboration",
    isBot: false,
    meetingStats: {
      totalMeetings: 12,
      totalMinutes: 420,
      averageRating: 4.8,
    },
    interests: ["Design Systems", "User Research", "Prototyping", "Accessibility"],
    connectionStatus: "excellent",
    isSpeaking: true,
  },
  {
    id: "user2",
    name: "Maya Patel",
    avatar: "/placeholder.svg?height=200&width=200",
    bio: "Full-stack developer with expertise in React, Node.js, and cloud architecture. I love building scalable applications and mentoring junior developers.",
    profession: "Senior Developer",
    company: "TechNova",
    school: "MIT",
    experience: 5,
    sharedInterests: [
      { type: "industry", name: "Web Development" },
      { type: "skill", name: "React" },
      { type: "academic", name: "Computer Science" },
    ],
    connectionType: "mentorship",
    isBot: false,
    meetingStats: {
      totalMeetings: 8,
      totalMinutes: 360,
      averageRating: 4.5,
    },
    interests: ["JavaScript", "Cloud Computing", "System Design", "Open Source"],
    connectionStatus: "good",
    isSpeaking: false,
  },
  {
    id: "user3",
    name: "AI Assistant",
    avatar: null,
    bio: "I'm an AI assistant specialized in helping with technical questions, brainstorming ideas, and providing guidance on best practices.",
    profession: "Virtual Assistant",
    company: "AI Labs",
    school: "Machine Learning Institute",
    experience: 3,
    sharedInterests: [
      { type: "industry", name: "AI/ML" },
      { type: "skill", name: "Natural Language" },
      { type: "academic", name: "Data Science" },
    ],
    connectionType: "b2b",
    isBot: true,
    meetingStats: {
      totalMeetings: 24,
      totalMinutes: 720,
      averageRating: 4.9,
    },
    interests: ["Machine Learning", "NLP", "Data Analysis", "Automation"],
    connectionStatus: "excellent",
    isSpeaking: false,
  },
]

