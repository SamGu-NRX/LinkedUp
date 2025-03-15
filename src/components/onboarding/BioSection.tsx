// src/components/onboarding/BioSection.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { OnboardingFormData } from "@/schemas/onboarding";

interface BioSectionProps {
  onNext: () => void;
  onBack: () => void;
}

const MAX_CHARS = 150;

export default function BioSection({ onNext, onBack }: BioSectionProps) {
  const {
    register,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  // Watch the bio value and update the character count
  const bioValue = watch("bio", "");
  const [charCount, setCharCount] = useState(bioValue.length);

  useEffect(() => {
    setCharCount(bioValue.length);
  }, [bioValue]);

  const handleNext = async () => {
    const isValid = await trigger("bio");
    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">About You</h2>
        <p className="text-muted-foreground">
          Write a short bio to help others get to know you
        </p>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            {...register("bio")}
            placeholder="I'm passionate about technology and love discussing new ideas..."
            className={`h-32 resize-none ${errors.bio ? "border-destructive" : ""}`}
            maxLength={MAX_CHARS}
          />
          <div className="flex justify-between text-sm">
            <span
              className={
                errors.bio ? "text-destructive" : "text-muted-foreground"
              }
            >
              {errors.bio
                ? errors.bio.message
                : `${charCount}/${MAX_CHARS} characters`}
            </span>
          </div>
        </div>
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
