"use client";
import { motion } from "framer-motion";

export interface VideoAreaProps {
  activeVideo: "partner" | "self" | null;
  onVideoClick: (video: "partner" | "self" | null) => void;
  partnerName?: string;
  selfName?: string;
  // Optional: a custom height for the video area (defaults to full available height)
  heightClassName?: string;
}

export function VideoArea({
  activeVideo,
  onVideoClick,
  partnerName = "John Doe",
  selfName = "You",
  heightClassName = "h-full",
}: VideoAreaProps) {
  return (
    <div className={`flex-1 p-4 relative transition-all duration-300 ${heightClassName}`}>
      {activeVideo === null ? (
        // Split View (side-by-side)
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Partner Video */}
          <motion.div
            layout
            className="relative rounded-xl overflow-hidden bg-zinc-900 cursor-pointer shadow-lg"
            onClick={() => onVideoClick("partner")}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0">
              <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-white text-sm">{partnerName}</span>
              </div>
            </div>
          </motion.div>

          {/* Self Video */}
          <motion.div
            layout
            className="relative rounded-xl overflow-hidden bg-zinc-800 cursor-pointer shadow-lg"
            onClick={() => onVideoClick("self")}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0">
              <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-white text-sm">{selfName}</span>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        // Single view with Picture-in-Picture (PiP)
        <div className={`relative ${heightClassName}`}>
          {/* Main Video */}
          <motion.div
            layout
            className="relative rounded-xl overflow-hidden bg-zinc-900 h-full cursor-pointer shadow-lg"
            onClick={() => onVideoClick(null)}
          >
            <div className="absolute inset-0">
              <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-white text-sm">
                  {activeVideo === "partner" ? partnerName : selfName}
                </span>
              </div>
            </div>
          </motion.div>

          {/* PiP Video */}
          <motion.div
            layout
            className="absolute bottom-4 right-4 w-48 h-32 rounded-lg overflow-hidden bg-zinc-800 cursor-pointer shadow-xl"
            onClick={() =>
              onVideoClick(activeVideo === "partner" ? "self" : "partner")
            }
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0">
              <div className="absolute bottom-2 left-2 flex items-center space-x-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-white text-xs">
                  {activeVideo === "partner" ? selfName : partnerName}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

