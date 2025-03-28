"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/app/user-card/profile-avatar";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  avatar: string | null;
  onSchedule: (date: Date, duration: number, topic: string) => void;
  className?: string;
}

export function ScheduleModal({
  isOpen,
  onClose,
  name,
  avatar,
  onSchedule,
  className,
}: ScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [topic, setTopic] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Generate available time slots (for demo purposes)
  const generateTimeSlots = () => {
    const slots = [];
    const today = new Date();
    today.setHours(9, 0, 0, 0); // Start at 9 AM

    for (let i = 0; i < 8; i++) {
      const slotTime = new Date(today);
      slotTime.setMinutes(today.getMinutes() + i * 60);

      const hour = slotTime.getHours();
      const minutes = slotTime.getMinutes();
      const formattedTime = `${hour % 12 || 12}:${minutes.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;

      slots.push({
        id: `slot-${i}`,
        time: formattedTime,
        available: Math.random() > 0.3, // Randomly make some slots unavailable
      });
    }

    return slots;
  };

  const timeSlots = generateTimeSlots();

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

  const handleSchedule = () => {
    if (selectedTimeSlot && topic.trim()) {
      const scheduledDate = new Date(selectedDate);
      const [timeStr, period] = selectedTimeSlot.split(" ");
      const [hourStr, minuteStr] = timeStr.split(":");

      let hour = Number.parseInt(hourStr);
      const minute = Number.parseInt(minuteStr);

      if (period === "PM" && hour !== 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;

      scheduledDate.setHours(hour, minute, 0, 0);

      onSchedule(scheduledDate, selectedDuration, topic);
      onClose();
    }
  };

  // Get days of the week for the date selector
  const getDaysOfWeek = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 5; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }

    return days;
  };

  const daysOfWeek = getDaysOfWeek();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            className={cn(
              "relative max-h-[90vh] w-full max-w-md overflow-hidden overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-900",
              className,
            )}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center">
                <ProfileAvatar
                  name={name}
                  avatar={avatar}
                  size="sm"
                  showAnimation={false}
                  className="mr-3"
                />
                <div>
                  <h3 className="font-medium">Schedule with {name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select a time slot
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
            <div className="space-y-6 p-4">
              {/* Date selector */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Select Date</h4>
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {daysOfWeek.map((day, index) => {
                    const isSelected =
                      day.toDateString() === selectedDate.toDateString();
                    const dayName = day.toLocaleDateString("en-US", {
                      weekday: "short",
                    });
                    const dayNumber = day.getDate();
                    const isToday =
                      day.toDateString() === new Date().toDateString();

                    return (
                      <motion.button
                        key={index}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "flex flex-shrink-0 flex-col items-center justify-center",
                          "h-20 w-16 rounded-lg border transition-colors duration-200",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-gray-700",
                        )}
                        onClick={() => setSelectedDate(new Date(day))}
                      >
                        <span className="mb-1 text-xs font-medium">
                          {dayName}
                        </span>
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm",
                            isToday ? "bg-primary text-white" : "",
                          )}
                        >
                          {dayNumber}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Available Time Slots
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map((slot) => (
                    <motion.button
                      key={slot.id}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "rounded-lg border p-3 text-sm font-medium transition-all duration-200",
                        !slot.available && "cursor-not-allowed opacity-50",
                        selectedTimeSlot === slot.time
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50",
                        slot.available &&
                          selectedTimeSlot !== slot.time &&
                          "hover:border-gray-300 dark:hover:border-gray-700",
                      )}
                      onClick={() => {
                        if (slot.available) {
                          setSelectedTimeSlot(slot.time);
                        }
                      }}
                      disabled={!slot.available}
                    >
                      {slot.time}
                      {selectedTimeSlot === slot.time && (
                        <Check className="text-primary ml-1.5 inline-block h-4 w-4" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Duration</h4>
                <div className="flex space-x-2">
                  {[15, 30, 45, 60].map((duration) => (
                    <motion.button
                      key={duration}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex-1 rounded-lg border p-2 text-sm font-medium transition-all duration-200",
                        selectedDuration === duration
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-gray-700",
                      )}
                      onClick={() => setSelectedDuration(duration)}
                    >
                      {duration} min
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div>
                <h4 className="mb-2 text-sm font-medium">Meeting Topic</h4>
                <Input
                  placeholder="What would you like to discuss?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 z-10 flex justify-end space-x-2 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="gap-1.5"
                disabled={!selectedTimeSlot || !topic.trim()}
                onClick={handleSchedule}
              >
                <span className="flex items-center">
                  <span className="mr-1.5">
                    <Calendar className="h-4 w-4" />
                  </span>
                  Schedule
                </span>
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
