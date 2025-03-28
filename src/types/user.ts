// @/types/user.ts

// Define ConnectionType based on usage in Profile and UserCardTags
export type ConnectionType =
  | "b2b"
  | "collaboration"
  | "mentorship"
  | "investment";

// Define ConnectionStatus based on usage in Profile and UserCard
// Assuming it maps directly from the old 'status'
export type ConnectionStatus = "online" | "away" | "offline";

// Define Interest based on usage in Profile and UserCardInterests
export interface Interest {
  type: "academic" | "industry" | "skill" | string; // Allow string for flexibility if needed
  name: string;
}

// Define MeetingStats based on usage in UserCardStats
export interface MeetingStats {
  totalMeetings: number;
  totalMinutes: number;
  averageRating: number; // Assuming rating is a number (e.g., 1-5)
}

// Central UserInfo type
export interface UserInfo {
  id: string;
  name: string;
  avatar: string | null; // URL or null
  bio: string;
  profession: string;
  company: string;
  school: string;
  experience: number; // Years
  sharedInterests: Interest[]; // Use the defined Interest type
  connectionType: ConnectionType; // Use the defined ConnectionType
  isBot?: boolean;

  // Optional fields potentially used by UserCard or other components
  interests?: string[]; // General list of interests
  connectionStatus?: ConnectionStatus; // Use the defined ConnectionStatus
  isSpeaking?: boolean; // For meeting context
  meetingStats?: MeetingStats; // Use the defined MeetingStats type
}
