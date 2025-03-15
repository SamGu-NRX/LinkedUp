// avatar-utils.ts
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
  // Set of vibrant gradient combinations
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

  // Use the id to deterministically select a gradient
  const hash =
    typeof id === "number"
      ? id
      : parseInt(String(id), 10) ||
        String(id)
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return gradients[hash % gradients.length];
};

/**
 * Get initials from a name
 * @param name - Full name of the user
 * @returns Uppercase initials
 */
export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

/**
 * Format timestamp to readable time
 * @param timestamp - Timestamp in milliseconds
 * @returns Formatted time string (HH:MM)
 */
export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Get status indicator color based on user status
 * @param status - User status
 * @returns Tailwind CSS class for the appropriate color
 */
export const getStatusColor = (
  status: "online" | "away" | "offline",
): string => {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "away":
      return "bg-amber-400";
    case "offline":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
};
