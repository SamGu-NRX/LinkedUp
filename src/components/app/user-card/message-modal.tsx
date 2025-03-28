"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/app/user-card/profile-avatar";
import { MessageCircle } from "lucide-react";

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  avatar: string | null;
  onSend: (message: string) => void;
  className?: string;
}

export function MessageModal({
  isOpen,
  onClose,
  name,
  avatar,
  onSend,
  className,
}: MessageModalProps) {
  const [message, setMessage] = useState("");

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: "easeIn",
      },
    },
  };

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage("");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            className={cn(
              "relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900",
              className,
            )}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center">
                <ProfileAvatar
                  name={name}
                  avatar={avatar}
                  size="sm"
                  showAnimation={false}
                  className="mr-3"
                />
                <div>
                  <h3 className="font-medium">Message {name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Direct message
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-4">
              <Textarea
                placeholder={`Write your message to ${name}...`}
                className="min-h-[120px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 border-t border-gray-200 p-4 dark:border-gray-800">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="gap-1.5"
                disabled={!message.trim()}
                onClick={handleSend}
              >
                <span className="flex items-center">
                  <span className="mr-1.5">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  Send
                </span>
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
