"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// -------------------------------------------------------------------
// 1. Schema & Types
// -------------------------------------------------------------------

const bioSchema = z.object({
  bio: z
    .string()
    .min(10, "Please write at least 10 characters")
    .max(150, "Maximum 150 characters"),
});

export type BioFormData = z.infer<typeof bioSchema>;

interface BioSectionProps {
  data: Partial<BioFormData>;
  onUpdate: (data: BioFormData) => void;
  onNext: () => void;
  onBack: () => void;
}

const MAX_CHARS = 150;

// -------------------------------------------------------------------
// 2. Component
// -------------------------------------------------------------------

export default function BioSection({
  data,
  onUpdate,
  onNext,
  onBack,
}: BioSectionProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BioFormData>({
    resolver: zodResolver(bioSchema),
    defaultValues: {
      bio: data.bio || "",
    },
  });

  // Watch the bio value and update the character count
  const bioValue = watch("bio", "");
  const [charCount, setCharCount] = useState(bioValue.length);

  useEffect(() => {
    setCharCount(bioValue.length);
  }, [bioValue]);

  const onSubmit = (formData: BioFormData) => {
    onUpdate(formData);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}
