import { Clock } from "lucide-react";
import { motion } from "framer-motion";

type TopBarProps = {
  prompt: string;
  timeLeft: number;
};

export default function TopBar({ prompt, timeLeft }: TopBarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between p-3"
    >
      <div className="text-sm font-medium text-gray-300">{prompt}</div>
      <div className="flex items-center space-x-2 text-gray-300">
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">{formatTime(timeLeft)}</span>
      </div>
    </motion.div>
  );
}
