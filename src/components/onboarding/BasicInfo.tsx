"use client";

import { useState } from "react";
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

interface BasicInfoProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
}

export default function BasicInfo({ data, onUpdate, onNext }: BasicInfoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!data.age) {
      newErrors.age = "Age is required";
    }
    if (!data.gender) {
      newErrors.gender = "Gender is required";
    }

    if (Object.keys(newErrors).length === 0) {
      onNext();
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Tell us about yourself</h2>
        <p className="text-muted-foreground">
          Let's start with some basic information
        </p>

        {/* Age Slider */}
        <div className="space-y-4">
          <Label>Age</Label>
          <div className="pt-6">
            <Slider
              value={[data.age]}
              onValueChange={(value) => onUpdate({ age: value[0] })}
              min={13}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="text-center text-2xl font-semibold mt-4">
              {data.age} years old
            </p>
          </div>
        </div>

        {/* Gender Selection */}
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select
            value={data.gender}
            onValueChange={(value) => onUpdate({ gender: value })}
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
            <p className="text-sm text-destructive">{errors.gender}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}