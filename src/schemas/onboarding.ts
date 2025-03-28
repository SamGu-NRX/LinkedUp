// src/schemas/onboarding.ts
import { z } from "zod";

export const basicInfoSchema = z.object({
  age: z
    .number()
    .min(13, "You must be at least 13")
    .max(100, "Age must be 100 or below"),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"], {
    required_error: "Gender is required",
  }),
});

export const professionalInfoSchema = z.object({
  field: z.string().min(1, "Field is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company is required"),
  linkedinUrl: z
    .string()
    .url("Invalid URL")
    .optional()
    .nullable()
    .transform((val) => val ?? undefined),
});

export const bioSchema = z.object({
  bio: z
    .string()
    .min(10, "Please write at least 10 characters")
    .max(150, "Maximum 150 characters"),
});

export const interestSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  iconName: z.string().optional(),
});

export const interestsSchema = z.object({
  interests: z
    .array(interestSchema)
    .min(1, "Please select at least one interest"),
});

export const onboardingSchema = z.object({
  ...basicInfoSchema.shape,
  ...professionalInfoSchema.shape,
  ...bioSchema.shape,
  ...interestsSchema.shape,
});

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type ProfessionalInfoFormData = z.infer<typeof professionalInfoSchema>;
export type BioFormData = z.infer<typeof bioSchema>;
export type InterestType = z.infer<typeof interestSchema>;
export type InterestsFormData = z.infer<typeof interestsSchema>;
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
