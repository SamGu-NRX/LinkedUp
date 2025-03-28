import type { ConnectionType } from "@/components/app/user-card/connection-badge";
import type { ConnectionStatus } from "@/components/app/user-card/connection-status";
import type { Interest } from "@/components/app/user-card/interest-badge";

export interface UserInfo {
  id: string;
  name: string;
  avatar: string | null;
  bio: string;
  profession: string;
  company: string;
  school: string;
  experience: number;
  sharedInterests: Interest[];
  connectionType: ConnectionType;
  isBot?: boolean;
  meetingStats?: {
    totalMeetings: number;
    totalMinutes: number;
    averageRating: number;
  };
  interests?: string[];
  connectionStatus?: ConnectionStatus;
  isSpeaking?: boolean;
}
