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
 * Generate an SVG data URL for avatars with gradient backgrounds
 * @param seed - String used to generate a deterministic gradient
 * @returns SVG data URL with gradient background
 */
export const generateAvatarDataUrl = (seed: string | number): string => {
  // Get consistent gradient colors from our existing utility
  const avatarColors = generateAvatarColor(seed);

  // Extract color values from Tailwind class names
  const fromColor = getTailwindColor(avatarColors.from);
  const toColor = getTailwindColor(avatarColors.to);

  // Generate a deterministic angle based on seed
  const seedHash =
    typeof seed === "number"
      ? seed
      : String(seed)
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const angle = seedHash % 360;

  return `data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3ClinearGradient id='g' gradientTransform='rotate(${angle})'%3E%3Cstop offset='0%25' stop-color='%23${fromColor}'/%3E%3Cstop offset='100%25' stop-color='%23${toColor}'/%3E%3C/linearGradient%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E`;
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

/**
 * Convert a Tailwind color class to a hex color value
 * This is a simplified implementation - you may need to expand it based on your color palette
 */
function getTailwindColor(tailwindClass: string): string {
  // Extract the color name and shade from class like "from-blue-500"
  const matches = tailwindClass.match(/-([\w-]+)-(\d+)/);
  if (!matches) return "6366f1"; // Default indigo-500

  const [, color, shade] = matches;

  // Mapping of Tailwind colors to their hex values
  // This is a simplified mapping - you may need to expand it
  const colorMap: Record<string, Record<string, string>> = {
    violet: {
      "500": "8b5cf6",
      "700": "6d28d9",
    },
    blue: {
      "500": "3b82f6",
      "600": "2563eb",
    },
    emerald: {
      "400": "34d399",
      "600": "059669",
    },
    rose: {
      "400": "fb7185",
      "600": "e11d48",
    },
    amber: {
      "400": "fbbf24",
      "600": "d97706",
    },
    cyan: {
      "400": "22d3ee",
      "600": "0891b2",
    },
    red: {
      "500": "ef4444",
    },
    pink: {
      "500": "ec4899",
      "600": "db2777",
    },
    green: {
      "400": "4ade80",
    },
    fuchsia: {
      "500": "d946ef",
    },
    purple: {
      "600": "9333ea",
      "700": "7e22ce",
    },
    yellow: {
      "400": "facc15",
    },
    orange: {
      "600": "ea580c",
    },
    teal: {
      "600": "0d9488",
    },
    indigo: {
      "600": "4f46e5",
    },
  };

  return colorMap[color]?.[shade] || "6366f1"; // Default to indigo-500 if not found
}
