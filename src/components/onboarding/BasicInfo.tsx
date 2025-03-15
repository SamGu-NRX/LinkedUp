// src/components/onboarding/BasicInfo.tsx
"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OnboardingFormData } from "@/schemas/onboarding";

interface BasicInfoProps {
  onNext: () => void;
}

export default function BasicInfo({ onNext }: BasicInfoProps) {
  const {
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  // Watch the age and gender values to update the UI
  const age = watch("age");
  const gender = watch("gender");

  const handleNext = async () => {
    const isValid = await trigger(["age", "gender"]);
    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Tell us about yourself</h2>
        <p className="text-muted-foreground">
          {`Let's start with some basic information.`}
        </p>

        {/* Age Slider */}
        <div className="space-y-4">
          <Label>Age</Label>
          <div className="pt-6">
            <Slider
              value={[age]}
              onValueChange={(value) =>
                setValue("age", value[0], { shouldValidate: true })
              }
              min={13}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="mt-4 text-center text-2xl font-semibold">
              {age} years old
            </p>
            {errors.age && (
              <p className="text-destructive text-sm">{errors.age.message}</p>
            )}
          </div>
        </div>

        {/* Gender Selection */}
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select
            value={gender}
            onValueChange={(value: OnboardingFormData["gender"]) =>
              setValue("gender", value, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non-binary">Non-binary</SelectItem>
              <SelectItem value="prefer-not-to-say">
                Prefer not to say
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.gender && (
            <p className="text-destructive text-sm">{errors.gender.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
