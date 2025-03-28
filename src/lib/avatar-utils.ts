// @/lib/avatar-utils.ts (assuming path)

import type { ConnectionStatus, UserInfo } from "@/types/user"; // Import types

export interface AvatarColor {
  from: string;
  to: string;
  text: string;
}

/**
 * Generate deterministic gradient colors for avatar based on user ID or name
 * @param id - Unique identifier for the user (string or number)
 * @returns Object containing gradient classes and text color
 */
export const generateAvatarColor = (id: string | number): AvatarColor => {
  const gradients: AvatarColor[] = [
    { from: "from-violet-500", to: "to-purple-700", text: "text-violet-50" },
    { from: "from-blue-500", to: "to-indigo-600", text: "text-blue-50" },
    { from: "from-emerald-400", to: "to-teal-600", text: "text-emerald-50" },
    { from: "from-rose-400", to: "to-pink-600", text: "text-rose-50" },
    { from: "from-amber-400", to: "to-orange-600", text: "text-amber-50" },
    { from: "from-cyan-400", to: "to-blue-600", text: "text-cyan-50" },
    { from: "from-red-500", to: "to-pink-500", text: "text-red-50" },
    { from: "from-green-400", to: "to-emerald-600", text: "text-green-50" },
    { from: "from-fuchsia-500", to: "to-purple-600", text: "text-fuchsia-50" },
    { from: "from-yellow-400", to: "to-amber-600", text: "text-yellow-50" },
  ];

  const hash =
    typeof id === "number"
      ? id
      : String(id)
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return gradients[hash % gradients.length];
};

/**
 * Convert a Tailwind color class to a hex color value (simplified)
 */
function getTailwindColor(tailwindClass: string): string {
  const matches = tailwindClass.match(/-([\w-]+)-(\d+)/);
  if (!matches) return "6366f1"; // Default indigo-500

  const [, color, shade] = matches;

  // Simplified mapping - expand as needed for your project's palette
  const colorMap: Record<string, Record<string, string>> = {
    violet: { "500": "8b5cf6", "700": "6d28d9" },
    blue: { "500": "3b82f6", "600": "2563eb" },
    emerald: { "400": "34d399", "600": "059669" },
    rose: { "400": "fb7185", "600": "e11d48" },
    amber: { "400": "fbbf24", "600": "d97706" },
    cyan: { "400": "22d3ee", "600": "0891b2" },
    red: { "500": "ef4444" },
    pink: { "500": "ec4899", "600": "db2777" },
    green: { "400": "4ade80" },
    fuchsia: { "500": "d946ef" },
    purple: { "600": "9333ea", "700": "7e22ce" },
    yellow: { "400": "facc15" },
    orange: { "600": "ea580c" },
    teal: { "600": "0d9488" },
    indigo: { "600": "4f46e5" },
  };

  return colorMap[color]?.[shade] || "6366f1"; // Default
}

/**
 * Generate an SVG data URL for avatars with gradient backgrounds
 * @param seed - String or number used to generate a deterministic gradient (e.g., user ID)
 * @returns SVG data URL string
 */
export const generateAvatarDataUrl = (seed: string | number): string => {
  const avatarColors = generateAvatarColor(seed);
  const fromColor = getTailwindColor(avatarColors.from);
  const toColor = getTailwindColor(avatarColors.to);

  const seedHash =
    typeof seed === "number"
      ? seed
      : String(seed)
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const angle = seedHash % 360;

  // Use encodeURIComponent for color values in the URL
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <linearGradient id='g' gradientTransform='rotate(${angle})'>
      <stop offset='0%' stop-color='#${encodeURIComponent(fromColor)}'/>
      <stop offset='100%' stop-color='#${encodeURIComponent(toColor)}'/>
    </linearGradient>
    <rect width='100' height='100' fill='url(%23g)'/>
  </svg>`;

  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
};

/**
 * Get initials from a name
 * @param name - Full name of the user
 * @returns Uppercase initials (max 2 chars)
 */
export const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean); // Filter out empty strings
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Format timestamp to readable time
 * @param timestamp - Timestamp in milliseconds
 * @returns Formatted time string (HH:MM) or empty string if invalid
 */
export const formatTime = (timestamp: number): string => {
  if (isNaN(timestamp)) return "";
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    console.error("Error formatting time:", e);
    return "";
  }
};

/**
 * Get status indicator color based on user connection status
 * @param status - User connection status
 * @returns Tailwind CSS background color class
 */
export const getStatusColor = (
  status: ConnectionStatus | undefined | null,
): string => {
  switch (status) {
    case "online":
      return "bg-emerald-500"; // Use a slightly different green for better visibility
    case "away":
      return "bg-amber-400";
    case "offline":
      return "bg-gray-500"; // Use a slightly darker gray
    default:
      return "bg-gray-400"; // Default/fallback color
  }
};

/**
 * Generates a fallback avatar URL or returns the existing one.
 * @param user - The UserInfo object
 * @returns A string containing the avatar URL (either original or generated data URL)
 */
export const getAvatar = (user: UserInfo): string => {
  return user.avatar || generateAvatarDataUrl(user.id);
};
