"use client";

import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// -------------------------------------------------------------------
// 1. Define Types & Schema
// -------------------------------------------------------------------

// Define an Interest type. Note: we use z.any() for `icon` since it’s a React component.
const interestSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  icon: z.any(),
});

export type Interest = z.infer<typeof interestSchema>;

// The overall form schema requires an array of interests with at least one entry.
const interestsFormSchema = z.object({
  interests: z
    .array(interestSchema)
    .min(1, "Please select at least one interest"),
});

export type InterestsFormData = z.infer<typeof interestsFormSchema>;

// -------------------------------------------------------------------
// 2. Predefined Interests & Categories
// -------------------------------------------------------------------

const predefinedInterests: Interest[] = [
  // Tech
  { id: "programming", name: "Programming", category: "Tech", icon: Code },
  { id: "ai", name: "Artificial Intelligence", category: "Tech", icon: Code },
  { id: "web-dev", name: "Web Development", category: "Tech", icon: Code },

  // Art
  { id: "drawing", name: "Drawing", category: "Art", icon: Palette },
  { id: "painting", name: "Painting", category: "Art", icon: Palette },
  { id: "design", name: "Design", category: "Art", icon: Palette },

  // Gaming
  {
    id: "video-games",
    name: "Video Games",
    category: "Gaming",
    icon: Gamepad2,
  },
  {
    id: "board-games",
    name: "Board Games",
    category: "Gaming",
    icon: Gamepad2,
  },

  // Sports
  { id: "fitness", name: "Fitness", category: "Sports", icon: Dumbbell },
  { id: "yoga", name: "Yoga", category: "Sports", icon: Dumbbell },
  { id: "running", name: "Running", category: "Sports", icon: Dumbbell },

  // Music
  {
    id: "playing-music",
    name: "Playing Music",
    category: "Music",
    icon: Music,
  },
  { id: "singing", name: "Singing", category: "Music", icon: Music },

  // Photography
  {
    id: "photography",
    name: "Photography",
    category: "Photography",
    icon: Camera,
  },

  // Reading
  { id: "books", name: "Books", category: "Reading", icon: Book },
  { id: "poetry", name: "Poetry", category: "Reading", icon: Book },

  // Travel
  { id: "traveling", name: "Traveling", category: "Travel", icon: Plane },
  { id: "backpacking", name: "Backpacking", category: "Travel", icon: Plane },
];

// Compute the list of categories.
const categories = Array.from(
  new Set(predefinedInterests.map((interest) => interest.category)),
);

// -------------------------------------------------------------------
// 3. Component Props & Main Component
// -------------------------------------------------------------------

interface InterestsSectionProps {
  data: Partial<InterestsFormData>;
  onUpdate: (data: InterestsFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function InterestsSection({
  data,
  onUpdate,
  onNext,
  onBack,
}: InterestsSectionProps) {
  // We use React Hook Form with our Zod schema. The default value for `interests`
  // is either passed via props or an empty array.
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InterestsFormData>({
    resolver: zodResolver(interestsFormSchema),
    defaultValues: {
      interests: data.interests || [],
    },
  });

  // Manage the interests array using useFieldArray.
  const { fields, append, remove } = useFieldArray({
    control,
    name: "interests",
  });

  // We use a separate state for the custom interest input.
  const [customInterest, setCustomInterest] = useState("");

  // Get the current interests from the form.
  const currentInterests: Interest[] = watch("interests");

  // Toggle an interest: if already selected, remove it; otherwise, add it.
  const handleToggleInterest = (interest: Interest) => {
    const index = currentInterests.findIndex((i) => i.id === interest.id);
    if (index !== -1) {
      remove(index);
    } else {
      append(interest);
    }
  };

  // Add a custom interest using the custom input.
  const handleAddCustom = () => {
    if (customInterest.trim()) {
      const newInterest: Interest = {
        id: `custom-${customInterest.toLowerCase().replace(/\s+/g, "-")}`,
        name: customInterest,
        category: "Custom",
        icon: Plus,
      };
      append(newInterest);
      setCustomInterest("");
    }
  };

  // Handle form submission. If there are no interests, the schema will trigger an error.
  const onSubmit = (formData: InterestsFormData) => {
    onUpdate(formData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                          <interest.icon className="h-4 w-4" />
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
          <p className="text-sm text-destructive">{errors.interests.message}</p>
        )}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}
