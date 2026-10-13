// @/types/user.ts

// Define ConnectionType based on usage in Profile and UserCardTags
export type ConnectionType =
  | "b2b"
  | "collaboration"
  | "mentorship"
  | "investment";

// Connection quality as reported during a video meeting.
// Mirrors ConnectionStatus in @/types/meeting — the UserCard renders it
// through ConnectionStatusIndicator, which expects this union.
export type ConnectionStatus = "excellent" | "good" | "poor" | "offline";

// Presence status shown on profile/chat avatars (distinct from connection quality).
export type PresenceStatus = "online" | "away" | "offline";

// Define Interest based on usage in Profile and UserCardInterests
export interface Interest {
  type: "academic" | "industry" | "skill";
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
