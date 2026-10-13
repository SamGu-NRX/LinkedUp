// src/app/onboarding/page.tsx
"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ProfessionalInfo from "@/components/onboarding/ProfessionalInfo";
import BioSection from "@/components/onboarding/BioSection";
import InterestsSection from "@/components/onboarding/InterestsSection";
import ProfileSummary from "@/components/onboarding/ProfileSummary";
import BasicInfo from "@/components/onboarding/BasicInfo";
import Congratulations from "@/components/onboarding/Congratulations";
import { saveUserOnboardingData } from "./_actions";
import {
  onboardingSchema,
  OnboardingFormData,
} from "@/schemas/onboarding";
import {
  Briefcase,
  MessageSquare,
  Heart,
  CheckCircle,
  User,
} from "lucide-react";
import { toast } from "sonner";

const steps = [
  { id: 1, title: "Basic Info", icon: User },
  { id: 2, title: "Professional Info", icon: Briefcase },
  { id: 3, title: "Bio", icon: MessageSquare },
  { id: 4, title: "Interests", icon: Heart },
  { id: 5, title: "Summary", icon: CheckCircle },
];

const defaultValues: Partial<OnboardingFormData> = {
  age: 25,
  gender: "prefer-not-to-say",
  field: "",
  jobTitle: "",
  company: "",
  linkedinUrl: "",
  bio: "",
  interests: [],
};

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showCongrats, setShowCongrats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues,
    mode: "onChange",
  });

  const progress = (currentStep / steps.length) * 100;

  const handleNext = () => {
    if (currentStep === steps.length) {
      handleCompleteProfile();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCompleteProfile = async () => {
    try {
      setIsSubmitting(true);

      const isValid = await methods.trigger();
      if (!isValid) {
        toast.error("Some fields need attention", {
          description: "Please fix the highlighted fields before finishing.",
        });
        return;
      }

      const formData = methods.getValues();
      const result = await saveUserOnboardingData(formData);

      if (result.error) {
        toast.error("Couldn't finish onboarding", {
          description: result.error,
        });
        return;
      }
      setShowCongrats(true);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("An unexpected error occurred. Please try again.", {
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="from-background to-secondary/20 min-h-screen bg-linear-to-b">
      <AnimatePresence mode="wait">
        {showCongrats ? (
          <Congratulations
            key="congrats"
            onComplete={() => {
              // Full page load on purpose: the middleware checks the Clerk
              // metadata from the session token, which only refreshes on a
              // new request. A client-side navigation would bounce the user
              // back to /onboarding with the stale token.
              window.location.assign("/app");
            }}
          />
        ) : (
          <FormProvider {...methods}>
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="container mx-auto max-w-4xl px-4 py-8"
            >
              <div className="space-y-6">
                {/* Progress Header */}
                <div className="space-y-2">
                  <h1 className="text-center text-3xl font-bold">
                    Create Your Profile
                  </h1>
                  <p className="text-muted-foreground text-center">
                    {`Let's set up your profile to find the perfect connections.`}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full space-y-2">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between">
                    {steps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center space-x-1 ${
                          currentStep >= step.id
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        <step.icon className="h-4 w-4" />
                        <span className="hidden text-sm sm:inline">
                          {step.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Content */}
                <Card className="p-6">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {currentStep === 1 && (
                      <BasicInfo onNext={handleNext} />
                    )}
                    {currentStep === 2 && (
                      <ProfessionalInfo
                        onNext={handleNext}
                        onBack={handleBack}
                      />
                    )}
                    {currentStep === 3 && (
                      <BioSection
                        onNext={handleNext}
                        onBack={handleBack}
                      />
                    )}
                    {currentStep === 4 && (
                      <InterestsSection
                        onNext={handleNext}
                        onBack={handleBack}
                      />
                    )}
                    {currentStep === 5 && (
                      <ProfileSummary
                        onBack={handleBack}
                        onEdit={(step) => setCurrentStep(step)}
                        onComplete={handleCompleteProfile}
                        isSubmitting={isSubmitting}
                      />
                    )}
                  </motion.div>
                </Card>
              </div>
            </motion.div>
          </FormProvider>
        )}
      </AnimatePresence>
    </div>
  );
}
