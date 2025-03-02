"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

// -------------------------------------------------------------------
// 1. Schema & Types
// -------------------------------------------------------------------

const basicInfoSchema = z.object({
  age: z
    .number({ required_error: "Age is required" })
    .min(13, "You must be at least 13")
    .max(100, "Age must be 100 or below"),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"], {
    required_error: "Gender is required",
  }),
});

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

interface BasicInfoProps {
  data: Partial<BasicInfoFormData>;
  onUpdate: (data: BasicInfoFormData) => void;
  onNext: () => void;
}

// -------------------------------------------------------------------
// 2. Component
// -------------------------------------------------------------------

export default function BasicInfo({ data, onUpdate, onNext }: BasicInfoProps) {
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      age: data.age ?? 18, // default age if not set
      gender: data.gender ?? undefined,
    },
  });

  // Watch the age and gender values to update the UI
  const age = watch("age");
  const gender = watch("gender");

  const onSubmit = (formData: BasicInfoFormData) => {
    onUpdate(formData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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
              <p className="text-sm text-destructive">{errors.age.message}</p>
            )}
          </div>
        </div>

        {/* Gender Selection */}
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select
            value={gender}
            onValueChange={(value: BasicInfoFormData["gender"]) =>
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
            <p className="text-sm text-destructive">{errors.gender.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}
