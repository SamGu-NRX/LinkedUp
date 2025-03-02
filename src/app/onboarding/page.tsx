"use client";

import { useState } from "react";
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
import {
  Briefcase,
  MessageSquare,
  Heart,
  CheckCircle,
  User,
} from "lucide-react";

const steps = [
  { id: 1, title: "Basic Info", icon: User },
  { id: 2, title: "Professional Info", icon: Briefcase },
  { id: 3, title: "Bio", icon: MessageSquare },
  { id: 4, title: "Interests", icon: Heart },
  { id: 5, title: "Summary", icon: CheckCircle },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    age: 25,
    gender: "prefer-not-to-say" as | "prefer-not-to-say" // wtf
      | "male"
      | "female"
      | "non-binary",
    field: "",
    jobTitle: "",
    company: "",
    linkedinUrl: "",
    bio: "",
    interests: [] as {
      id: string;
      name: string;
      category: string;
      icon?: any;
    }[],
    connectionType: "both",
  });
  const [showCongrats, setShowCongrats] = useState(false);

  const progress = (currentStep / steps.length) * 100;

  const handleNext = () => {
    if (currentStep === steps.length) {
      setShowCongrats(true);
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleUpdateForm = (data: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  return (
    <div className="from-background to-secondary/20 min-h-screen bg-gradient-to-b">
      <AnimatePresence mode="wait">
        {showCongrats ? (
          <Congratulations key="congrats" />
        ) : (
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
                    <BasicInfo
                      data={formData}
                      onUpdate={handleUpdateForm}
                      onNext={handleNext}
                    />
                  )}
                  {currentStep === 2 && (
                    <ProfessionalInfo
                      data={formData}
                      onUpdate={handleUpdateForm}
                      onNext={handleNext}
                      onBack={handleBack}
                    />
                  )}
                  {currentStep === 3 && (
                    <BioSection
                      data={formData}
                      onUpdate={handleUpdateForm}
                      onNext={handleNext}
                      onBack={handleBack}
                    />
                  )}
                  {currentStep === 4 && (
                    <InterestsSection
                      data={formData}
                      onUpdate={handleUpdateForm}
                      onNext={handleNext}
                      onBack={handleBack}
                    />
                  )}
                  {currentStep === 5 && (
                    <ProfileSummary
                      data={formData}
                      onBack={handleBack}
                      onEdit={(step) => setCurrentStep(step)}
                      onComplete={() => setShowCongrats(true)}
                    />
                  )}
                </motion.div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
