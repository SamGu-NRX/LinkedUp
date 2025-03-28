// types/profile.ts
export interface Profile {
  id: string;
  name: string;
  avatar: string; // This will store the avatar identifier, not the actual gradient
  status: "online" | "away" | "offline";
  lastCallDate: string;
  bio: string;
  profession: string;
  company: string;
  school: string;
  experience: number;
  sharedInterests: Array<{
    type: "academic" | "industry" | "skill";
    name: string;
  }>;
  connectionType: "b2b" | "collaboration" | "mentorship" | "investment";
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: number;
}

export interface SharedInterest {
  type: "academic" | "industry" | "skill";
  name: string;
}
