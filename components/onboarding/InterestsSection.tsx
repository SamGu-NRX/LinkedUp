"use client";

import { useState } from "react";
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

interface Interest {
  id: string;
  name: string;
  category: string;
  icon: any;
}

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
  { id: "video-games", name: "Video Games", category: "Gaming", icon: Gamepad2 },
  { id: "board-games", name: "Board Games", category: "Gaming", icon: Gamepad2 },
  
  // Sports
  { id: "fitness", name: "Fitness", category: "Sports", icon: Dumbbell },
  { id: "yoga", name: "Yoga", category: "Sports", icon: Dumbbell },
  { id: "running", name: "Running", category: "Sports", icon: Dumbbell },
  
  // Music
  { id: "playing-music", name: "Playing Music", category: "Music", icon: Music },
  { id: "singing", name: "Singing", category: "Music", icon: Music },
  
  // Photography
  { id: "photography", name: "Photography", category: "Photography", icon: Camera },
  
  // Reading
  { id: "books", name: "Books", category: "Reading", icon: Book },
  { id: "poetry", name: "Poetry", category: "Reading", icon: Book },
  
  // Travel
  { id: "traveling", name: "Traveling", category: "Travel", icon: Plane },
  { id: "backpacking", name: "Backpacking", category: "Travel", icon: Plane },
];

interface InterestsSectionProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function InterestsSection({
  data,
  onUpdate,
  onNext,
  onBack,
}: InterestsSectionProps) {
  const [customInterest, setCustomInterest] = useState("");
  const [error, setError] = useState("");

  const handleToggleInterest = (interest: Interest) => {
    const currentInterests = data.interests || [];
    const exists = currentInterests.find((i: Interest) => i.id === interest.id);
    
    if (exists) {
      onUpdate({
        interests: currentInterests.filter((i: Interest) => i.id !== interest.id),
      });
    } else {
      onUpdate({ interests: [...currentInterests, interest] });
    }
    setError("");
  };

  const handleAddCustom = () => {
    if (customInterest.trim()) {
      const newInterest = {
        id: `custom-${customInterest.toLowerCase().replace(/\s+/g, "-")}`,
        name: customInterest,
        category: "Custom",
        icon: Plus,
      };
      onUpdate({ interests: [...(data.interests || []), newInterest] });
      setCustomInterest("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.interests?.length) {
      setError("Please select at least one interest");
      return;
    }
    onNext();
  };

  const categories = Array.from(
    new Set(predefinedInterests.map((i) => i.category))
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        {data.interests?.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Interests</Label>
            <div className="flex flex-wrap gap-2">
              {data.interests.map((interest: Interest) => (
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

        {/* Interest Categories */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category} className="space-y-2">
                <Label>{category}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {predefinedInterests
                    .filter((i) => i.category === category)
                    .map((interest) => {
                      const isSelected = data.interests?.some(
                        (i: Interest) => i.id === interest.id
                      );
                      return (
                        <motion.button
                          key={interest.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleToggleInterest(interest)}
                          className={`flex items-center space-x-2 p-2 rounded-md border transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-secondary"
                          }`}
                        >
                          <interest.icon className="w-4 h-4" />
                          <span>{interest.name}</span>
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {error && <p className="text-sm text-destructive">{error}</p>}
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