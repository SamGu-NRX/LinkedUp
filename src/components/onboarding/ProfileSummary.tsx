// src/components/onboarding/ProfileSummary.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Pencil } from "lucide-react";
import type { OnboardingFormData } from "@/schemas/onboarding";

interface ProfileSummaryProps {
  onBack: () => void;
  onEdit: (step: number) => void;
  onComplete: () => void;
  isSubmitting: boolean;
}

// List of fields for reference in the summary
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

export default function ProfileSummary({
  onBack,
  onEdit,
  onComplete,
  isSubmitting,
}: ProfileSummaryProps) {
  const { watch } = useFormContext<OnboardingFormData>();

  const data = watch();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Profile Summary</h2>
        <p className="text-muted-foreground">
          Review your profile information before finishing
        </p>

        <div className="grid gap-4">
          {/* Basic Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Basic Information
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(1)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Age
                  </dt>
                  <dd className="text-sm">{data.age} years old</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Gender
                  </dt>
                  <dd className="text-sm capitalize">
                    {data.gender === "prefer-not-to-say"
                      ? "Prefer not to say"
                      : data.gender}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Professional Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Professional Information
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(2)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Field
                  </dt>
                  <dd className="text-sm">
                    {data.field
                      ? fields.find((f) => f.value === data.field)?.label ||
                        data.field
                      : "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Job Title
                  </dt>
                  <dd className="text-sm">
                    {data.jobTitle || "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Company/School
                  </dt>
                  <dd className="text-sm">{data.company || "Not specified"}</dd>
                </div>
                {data.linkedinUrl && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      LinkedIn
                    </dt>
                    <dd className="text-sm">
                      <a
                        href={data.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Profile
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Bio</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(3)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{data.bio}</p>
            </CardContent>
          </Card>

          {/* Interests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Interests</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(4)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.interests && data.interests.length > 0 ? (
                  data.interests.map((interest: any) => (
                    <Badge key={interest.id} variant="secondary">
                      {interest.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No interests selected
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onComplete} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Complete Profile"}
        </Button>
      </div>
    </div>
  );
}
