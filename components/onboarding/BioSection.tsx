"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BioSectionProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

const MAX_CHARS = 150;

export default function BioSection({
  data,
  onUpdate,
  onNext,
  onBack,
}: BioSectionProps) {
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    setCharCount(data.bio?.length || 0);
  }, [data.bio]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.bio || data.bio.trim().length < 10) {
      setError("Please write at least 10 characters");
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">About You</h2>
        <p className="text-muted-foreground">
          Write a short bio to help others get to know you
        </p>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={data.bio}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= MAX_CHARS) {
                onUpdate({ bio: value });
                setError("");
              }
            }}
            placeholder="I'm passionate about technology and love discussing new ideas..."
            className={`h-32 resize-none ${error ? "border-destructive" : ""}`}
          />
          <div className="flex justify-between text-sm">
            <span className={error ? "text-destructive" : "text-muted-foreground"}>
              {error || `${charCount}/${MAX_CHARS} characters`}
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