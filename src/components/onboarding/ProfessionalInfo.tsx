// src/components/onboarding/ProfessionalInfo.tsx
"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/shadcn";
import type { OnboardingFormData } from "@/schemas/onboarding";

// Define available fields
const fields = [
  { value: "software", label: "Software Development" },
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "engineering", label: "Engineering" },
  { value: "research", label: "Research" },
  { value: "consulting", label: "Consulting" },
  { value: "hr", label: "Human Resources" },
  { value: "legal", label: "Legal" },
  { value: "arts", label: "Arts & Entertainment" },
  { value: "science", label: "Science" },
  { value: "student", label: "Student" },
] as const;

interface ProfessionalInfoProps {
  onNext: () => void;
  onBack: () => void;
}

export default function ProfessionalInfo({
  onNext,
  onBack,
}: ProfessionalInfoProps) {
  const {
    register,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<OnboardingFormData>();

  // Popover state for the field selection dropdown.
  const [open, setOpen] = React.useState(false);
  const selectedField = watch("field");

  const handleNext = async () => {
    const isValid = await trigger([
      "field",
      "jobTitle",
      "company",
      "linkedinUrl",
    ]);
    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Professional Information</h2>
        <p className="text-muted-foreground">
          Tell us about your work or studies
        </p>

        <div className="space-y-4">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label>Field</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {selectedField
                    ? fields.find((f) => f.value === selectedField)?.label
                    : "Select field..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search field..." />
                  <CommandEmpty>No field found.</CommandEmpty>
                  <CommandGroup>
                    {fields.map((fieldItem) => (
                      <CommandItem
                        key={fieldItem.value}
                        onSelect={() => {
                          setValue("field", fieldItem.value, {
                            shouldValidate: true,
                          });
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedField === fieldItem.value
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {fieldItem.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.field && (
              <p className="text-destructive text-sm">{errors.field.message}</p>
            )}
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label>Job Title</Label>
            <Input
              {...register("jobTitle")}
              placeholder="e.g., Senior Developer"
              className={errors.jobTitle ? "border-destructive" : ""}
            />
            {errors.jobTitle && (
              <p className="text-destructive text-sm">
                {errors.jobTitle.message}
              </p>
            )}
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label>Company</Label>
            <Input
              {...register("company")}
              placeholder="e.g., Tech Corp"
              className={errors.company ? "border-destructive" : ""}
            />
            {errors.company && (
              <p className="text-destructive text-sm">
                {errors.company.message}
              </p>
            )}
          </div>

          {/* LinkedIn URL (Optional) */}
          <div className="space-y-2">
            <Label>LinkedIn Username (Optional)</Label>
            <div className="flex items-center">
              <div className="bg-muted text-muted-foreground border-input rounded-l-md border border-r-0 px-3 py-2">
                linkedin.com/in/
              </div>
              <Input
                {...register("linkedinUrl", {
                  setValueAs: (value) =>
                    value ? `https://linkedin.com/in/${value}` : undefined,
                })}
                placeholder="username"
                className={cn(
                  "rounded-l-none",
                  errors.linkedinUrl ? "border-destructive" : "",
                )}
              />
            </div>
            {errors.linkedinUrl && (
              <p className="text-destructive text-sm">
                {errors.linkedinUrl.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Enter just your username, not the full URL
            </p>
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
