export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)
}

export function generateAvatarColor(seed: string) {
  // Simple hash function
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Generate color variations
  const h = Math.abs(hash) % 360

  // Define color pairs for gradients
  const colorPairs = [
    { from: "from-blue-500", to: "to-indigo-600", text: "text-white" },
    { from: "from-emerald-500", to: "to-teal-600", text: "text-white" },
    { from: "from-violet-500", to: "to-purple-600", text: "text-white" },
    { from: "from-rose-500", to: "to-pink-600", text: "text-white" },
    { from: "from-amber-500", to: "to-orange-600", text: "text-white" },
    { from: "from-cyan-500", to: "to-sky-600", text: "text-white" },
  ]

  // Select a color pair based on the hash
  const colorIndex = Math.abs(hash) % colorPairs.length
  return colorPairs[colorIndex]
}

