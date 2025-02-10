"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Pencil } from "lucide-react";

interface ProfileSummaryProps {
  data: any;
  onBack: () => void;
  onEdit: (step: number) => void;
}

export default function ProfileSummary({
  data,
  onBack,
  onEdit,
}: ProfileSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Profile Summary</h2>
        <p className="text-muted-foreground">
          Review your profile information before finishing
        </p>

        <div className="grid gap-4">
          {/* Professional Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Professional Information
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
                  <dt className="text-sm font-medium text-muted-foreground">
                    Connection Type
                  </dt>
                  <dd className="text-sm">
                    {data.connectionType.charAt(0).toUpperCase() +
                      data.connectionType.slice(1)}
                  </dd>
                </div>
                {(data.connectionType === "professional" ||
                  data.connectionType === "both") && (
                  <>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Job Title
                      </dt>
                      <dd className="text-sm">{data.jobTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Company/School
                      </dt>
                      <dd className="text-sm">{data.company}</dd>
                    </div>
                    {data.linkedinUrl && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">
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
                  </>
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
                onClick={() => onEdit(2)}
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
                onClick={() => onEdit(3)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.interests.map((interest: any) => (
                  <Badge key={interest.id} variant="secondary">
                    {interest.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Complete Profile</Button>
      </div>
    </div>
  );
}