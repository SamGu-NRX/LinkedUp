"use client";

import { useState } from "react";
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
];

interface ProfessionalInfoProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ProfessionalInfo({
  data,
  onUpdate,
  onNext,
  onBack,
}: ProfessionalInfoProps) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!data.field) {
      newErrors.field = "Field is required";
    }
    if (!data.jobTitle) {
      newErrors.jobTitle = "Job title or role is required";
    }
    if (!data.company) {
      newErrors.company = "Company or school is required";
    }

    if (Object.keys(newErrors).length === 0) {
      onNext();
    } else {
      setErrors(newErrors);
    }
  };

  const isStudent = data.age >= 14 && data.age <= 30;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Professional Information</h2>
        <p className="text-muted-foreground">Tell us about your work or studies</p>

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
                  {data.field
                    ? fields.find((field) => field.value === data.field)?.label
                    : "Select field..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search field..." />
                  <CommandEmpty>No field found.</CommandEmpty>
                  <CommandGroup>
                    {fields.map((field) => (
                      <CommandItem
                        key={field.value}
                        onSelect={() => {
                          onUpdate({ field: field.value });
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            data.field === field.value
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {field.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.field && (
              <p className="text-sm text-destructive">{errors.field}</p>
            )}
          </div>

          {/* Job Title/Role */}
          <div className="space-y-2">
            <Label>
              {isStudent ? "Role/Position or Year of Study" : "Job Title"}
            </Label>
            <Input
              value={data.jobTitle}
              onChange={(e) => onUpdate({ jobTitle: e.target.value })}
              placeholder={
                isStudent
                  ? "e.g., Computer Science Student, 2nd Year"
                  : "e.g., Senior Developer"
              }
              className={errors.jobTitle ? "border-destructive" : ""}
            />
            {errors.jobTitle && (
              <p className="text-sm text-destructive">{errors.jobTitle}</p>
            )}
          </div>

          {/* Company/School */}
          <div className="space-y-2">
            <Label>{isStudent ? "School/Company" : "Company"}</Label>
            <Input
              value={data.company}
              onChange={(e) => onUpdate({ company: e.target.value })}
              placeholder={
                isStudent
                  ? "e.g., Stanford University or Tech Corp"
                  : "e.g., Tech Corp"
              }
              className={errors.company ? "border-destructive" : ""}
            />
            {errors.company && (
              <p className="text-sm text-destructive">{errors.company}</p>
            )}
          </div>

          {/* LinkedIn URL (Optional) */}
          <div className="space-y-2">
            <Label>LinkedIn URL (Optional)</Label>
            <Input
              value={data.linkedinUrl}
              onChange={(e) => onUpdate({ linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/username"
              type="url"
            />
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
