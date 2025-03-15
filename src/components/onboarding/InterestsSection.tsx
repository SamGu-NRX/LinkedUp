// src/components/onboarding/InterestsSection.tsx
"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  Code,
  Palette,
  Gamepad2,
  Dumbbell,
  Music,
  Camera,
  Book,
  Plane,
  Plus,
} from "lucide-react";
import type { OnboardingFormData, InterestType } from "@/schemas/onboarding";

// Mapping of iconNames to actual components for UI
const iconMap: Record<string, React.ComponentType<any>> = {
  Code,
  Palette,
  Gamepad2,
  Dumbbell,
  Music,
  Camera,
  Book,
  Plane,
  Plus,
};

// Predefined interests
const predefinedInterests: (Omit<InterestType, "iconName"> & {
  icon: string;
})[] = [
  // Tech
  { id: "programming", name: "Programming", category: "Tech", icon: "Code" },
  { id: "ai", name: "Artificial Intelligence", category: "Tech", icon: "Code" },
  { id: "web-dev", name: "Web Development", category: "Tech", icon: "Code" },

  // Art
  { id: "drawing", name: "Drawing", category: "Art", icon: "Palette" },
  { id: "painting", name: "Painting", category: "Art", icon: "Palette" },
  { id: "design", name: "Design", category: "Art", icon: "Palette" },

  // Gaming
  {
    id: "video-games",
    name: "Video Games",
    category: "Gaming",
    icon: "Gamepad2",
  },
  {
    id: "board-games",
    name: "Board Games",
    category: "Gaming",
    icon: "Gamepad2",
  },

  // Sports
  { id: "fitness", name: "Fitness", category: "Sports", icon: "Dumbbell" },
  { id: "yoga", name: "Yoga", category: "Sports", icon: "Dumbbell" },
  { id: "running", name: "Running", category: "Sports", icon: "Dumbbell" },

  // Music
  {
    id: "playing-music",
    name: "Playing Music",
    category: "Music",
    icon: "Music",
  },
  { id: "singing", name: "Singing", category: "Music", icon: "Music" },

  // Photography
  {
    id: "photography",
    name: "Photography",
    category: "Photography",
    icon: "Camera",
  },

  // Reading
  { id: "books", name: "Books", category: "Reading", icon: "Book" },
  { id: "poetry", name: "Poetry", category: "Reading", icon: "Book" },

  // Travel
  { id: "traveling", name: "Traveling", category: "Travel", icon: "Plane" },
  { id: "backpacking", name: "Backpacking", category: "Travel", icon: "Plane" },
];

// Compute the list of categories
const categories = Array.from(
  new Set(predefinedInterests.map((interest) => interest.category)),
);

interface InterestsSectionProps {
  onNext: () => void;
  onBack: () => void;
}

export default function InterestsSection({
  onNext,
  onBack,
}: InterestsSectionProps) {
  const {
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  // We use a separate state for the custom interest input
  const [customInterest, setCustomInterest] = useState("");

  // Get the current interests from the form
  const currentInterests = watch("interests");

  // Toggle an interest: if already selected, remove it; otherwise, add it
  const handleToggleInterest = (interest: any) => {
    const index = currentInterests.findIndex((i) => i.id === interest.id);
    if (index !== -1) {
      const newInterests = [...currentInterests];
      newInterests.splice(index, 1);
      setValue("interests", newInterests, { shouldValidate: true });
    } else {
      const newInterest = {
        id: interest.id,
        name: interest.name,
        category: interest.category,
        iconName: interest.icon,
      };
      setValue("interests", [...currentInterests, newInterest], {
        shouldValidate: true,
      });
    }
  };

  // Add a custom interest using the custom input
  const handleAddCustom = () => {
    if (customInterest.trim()) {
      const newInterest = {
        id: `custom-${customInterest.toLowerCase().replace(/\s+/g, "-")}`,
        name: customInterest,
        category: "Custom",
        iconName: "Plus",
      };
      setValue("interests", [...currentInterests, newInterest], {
        shouldValidate: true,
      });
      setCustomInterest("");
    }
  };

  const handleNext = async () => {
    const isValid = await trigger("interests");
    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Your Interests</h2>
        <p className="text-muted-foreground">
          Select interests to help us match you with like-minded people
        </p>

        {/* Custom Interest Input */}
        <div className="flex space-x-2">
          <Input
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            placeholder="Add a custom interest"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddCustom}
            disabled={!customInterest.trim()}
          >
            Add Custom
          </Button>
        </div>

        {/* Selected Interests */}
        {currentInterests.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Interests</Label>
            <div className="flex flex-wrap gap-2">
              {currentInterests.map((interest) => (
                <motion.div
                  key={interest.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleToggleInterest(interest)}
                  >
                    {interest.name} ×
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Predefined Interests by Category */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category} className="space-y-2">
                <Label>{category}</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {predefinedInterests
                    .filter((interest) => interest.category === category)
                    .map((interest) => {
                      const isSelected = currentInterests.some(
                        (i) => i.id === interest.id,
                      );
                      const IconComponent = iconMap[interest.icon];
                      return (
                        <motion.button
                          key={interest.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleToggleInterest(interest)}
                          className={`flex items-center space-x-2 rounded-md border p-2 transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-secondary"
                          }`}
                        >
                          {IconComponent && (
                            <IconComponent className="h-4 w-4" />
                          )}
                          <span>{interest.name}</span>
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Display form error from Zod validation */}
        {errors.interests && (
          <p className="text-destructive text-sm">{errors.interests.message}</p>
        )}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
